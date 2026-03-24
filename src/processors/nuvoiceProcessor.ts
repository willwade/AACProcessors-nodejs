import {
  BaseProcessor,
  ExtractedString,
  ExtractStringsResult,
  SourceString,
  TranslatedString,
  VocabLocation,
} from "../core/baseProcessor";
import {
  AACTree,
  AACButton,
  AACPage,
  AACSemanticCategory,
  AACSemanticIntent,
} from "../core/treeStructure";
import { detectCasing } from "../core/stringCasing";
import { encodeText, ProcessorInput } from "../utils/io";
import {
  listNuVoiceTextEntries,
  NuVoiceBinaryRecordBase,
  NuVoiceCellRecord,
  NuVoiceDictionaryRecord,
  NuVoiceDocument,
  NuVoiceHeaderRecord,
  NuVoiceMemoryRecord,
  NuVoicePageRecord,
  parseNuVoiceDocument,
  parseTextSegment,
  serializeNuVoiceDocument,
  setNuVoiceLayoutText,
  setNuVoiceMemoryText,
  latin1ToBytes,
  normalizeNuVoiceContent,
} from "./nuvoice/helpers";

type NuVoiceButtonAddress = {
  pageHex: string;
  sequence: number;
};

type NuVoiceMetadataSummary = {
  pages: Array<{
    ascii?: string;
    key?: string;
    value?: string;
    binarySubtype?: number;
    metrics?: number[];
    commands?: Array<{ opcode: number; text?: string }>;
    tlvEntries?: Array<{ controlId: number; text?: string }>;
  }>;
  cells: Array<{
    ascii?: string;
    key?: string;
    value?: string;
    color?: number;
  }>;
  customColors: Record<string, number>;
  pageColors: Record<string, number[]>;
  navigation: Array<{
    sourceRecord: number;
    opcode: number;
    text?: string;
    targetPageHex?: string;
    argument?: string;
  }>;
};

function decodeMemoryAddress(
  record: NuVoiceMemoryRecord,
): NuVoiceButtonAddress | null {
  if (!record.bodyBytes || record.bodyBytes.length < 3) {
    return null;
  }

  const pageId = (record.bodyBytes[1] << 8) | record.bodyBytes[0];
  const pageHex = pageId.toString(16).padStart(4, "0");
  const sequence = record.bodyBytes[2];
  return { pageHex, sequence };
}

const KNOWN_PAGE_NAMES: Record<string, string> = {
  "0400": "Main Page (0x0400)",
  "0100": "Grammar Page (0x0100)",
  "0200": "System Page (0x0200)",
  "0300": "Computer Access (0x0300)",
  "0500": "Vocabulary Builder (0x0500)",
};

function formatNuVoiceColor(value: number): string {
  const rgb = value & 0xffffff;
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

function buildNuVoiceMetadata(
  pageRecords: NuVoicePageRecord[],
  cellRecords: NuVoiceCellRecord[],
): NuVoiceMetadataSummary {
  const customColors: Record<string, number> = {};
  const pageColors: Record<string, number[]> = {};
  let currentPageHex: string | null = null;
  const cellSummaries = cellRecords.map((record) => {
    if (
      record.key &&
      record.value &&
      record.key.toLowerCase().startsWith("customcolor")
    ) {
      const match = record.key.match(/customcolor(\d+)/i);
      if (match) {
        const paletteIndex = match[1];
        const numericValue = record.colorValue ?? Number(record.value);
        if (!Number.isNaN(numericValue)) {
          customColors[paletteIndex] = numericValue;
        }
      }
    }

    if (record.key && record.key.toLowerCase() === "crntpage") {
      const rawValue = record.value ?? record.asciiText?.split("=")[1];
      const numericValue = rawValue ? Number(rawValue) : Number.NaN;
      if (!Number.isNaN(numericValue)) {
        currentPageHex = numericValue.toString(16).padStart(4, "0");
      } else {
        currentPageHex = null;
      }
    } else if (
      record.key &&
      record.key.toLowerCase() === "color" &&
      currentPageHex &&
      (record.colorValue !== undefined || record.value !== undefined)
    ) {
      const colorNumeric = record.colorValue ?? Number(record.value);
      if (!Number.isNaN(colorNumeric)) {
        if (!pageColors[currentPageHex]) {
          pageColors[currentPageHex] = [];
        }
        pageColors[currentPageHex].push(colorNumeric);
      }
    }

    return {
      ascii: record.asciiText,
      key: record.key,
      value: record.value,
      color: record.colorValue,
    };
  });

  const navigationSummary: Array<{
    sourceRecord: number;
    opcode: number;
    text?: string;
    targetPageHex?: string;
    argument?: string;
  }> = [];

  const pageSummaries = pageRecords.map((record, index) => {
    if (record.commands) {
      record.commands.forEach((command) => {
        if (!command.text) {
          return;
        }
        const menuMatch = /^_MENU([0-9A-Fa-f]+),(.*)$/.exec(command.text);
        if (menuMatch) {
          navigationSummary.push({
            sourceRecord: index,
            opcode: command.opcode,
            text: command.text,
            targetPageHex: menuMatch[1].padStart(4, "0").toUpperCase(),
            argument: menuMatch[2],
          });
        }
      });
    }

    return {
      ascii: record.asciiText,
      key: record.key,
      value: record.value,
      binarySubtype: record.binarySubtype,
      metrics: record.metrics,
      commands: record.commands?.map((command) => ({
        opcode: command.opcode,
        text: command.text,
      })),
      tlvEntries: record.tlvEntries?.map((entry) => ({
        controlId: entry.controlId,
        text: entry.text,
      })),
    };
  });

  return {
    pages: pageSummaries,
    cells: cellSummaries,
    customColors,
    pageColors,
    navigation: navigationSummary,
  };
}

class NuVoiceProcessor extends BaseProcessor {
  async extractTexts(filePathOrBuffer: ProcessorInput): Promise<string[]> {
    const document = await this.readDocument(filePathOrBuffer);
    return listNuVoiceTextEntries(document).map((entry) => entry.source);
  }

  async loadIntoTree(filePathOrBuffer: ProcessorInput): Promise<AACTree> {
    const document = await this.readDocument(filePathOrBuffer);
    const tree = new AACTree();

    // Count different record types
    const recordCounts: Record<string, number> = {};
    for (const record of document.records) {
      recordCounts[record.type] = (recordCounts[record.type] || 0) + 1;
    }

    tree.metadata = {
      format: "nuvoice",
      version: (
        document.records.find(
          (record) => record.type === "v",
        ) as NuVoiceHeaderRecord
      )?.version,
      name:
        (
          document.records.find(
            (record) => record.type === "v",
          ) as NuVoiceHeaderRecord
        )?.product || "NuVoice MTI",
      recordCounts,
      invalidChecksumCount: document.records.filter(
        (record) =>
          record.type !== "v" &&
          "checksumValid" in record &&
          !record.checksumValid,
      ).length,
    };

    // Create content pages
    const dictionaryRecords = document.records.filter(
      (record): record is NuVoiceDictionaryRecord => record.type === "d",
    );
    const memoryRecords = document.records.filter(
      (record): record is NuVoiceMemoryRecord =>
        record.type === "m" &&
        "textSegment" in record &&
        record.textSegment !== null,
    );
    const pageRecords = document.records.filter(
      (record): record is NuVoicePageRecord => record.type === "P",
    );
    const cellRecords = document.records.filter(
      (record): record is NuVoiceCellRecord => record.type === "C",
    );
    const nuvoiceMetadata = buildNuVoiceMetadata(pageRecords, cellRecords);

    // Dictionary page
    if (dictionaryRecords.length > 0) {
      const dictPage = new AACPage({
        id: "dictionary",
        name: "Pronunciation Dictionary",
        buttons: [],
      });

      dictionaryRecords.forEach((record, index) => {
        dictPage.addButton(
          new AACButton({
            id: `dict:${index}`,
            label: record.word,
            message: record.pronunciation,
            type: "SPEAK",
            semanticAction: {
              category: AACSemanticCategory.COMMUNICATION,
              intent: AACSemanticIntent.SPEAK_TEXT,
              parameters: { text: record.word },
            },
          }),
        );
      });

      tree.addPage(dictPage);
    }

    const pageMap = new Map<
      string,
      {
        pageHex: string;
        page: AACPage;
        entries: Array<{ button: AACButton; order: number }>;
      }
    >();

    memoryRecords.forEach((record, index) => {
      const address = decodeMemoryAddress(record);
      const parsed = record.parsedButton;
      const text = parsed?.name || record.textSegment?.text?.trim();
      if (!address || !text) {
        return;
      }

      const pageId = `page-${address.pageHex}`;
      const pageName =
        KNOWN_PAGE_NAMES[address.pageHex] ||
        `Page ${address.pageHex.toUpperCase()}`;
      let data = pageMap.get(address.pageHex);
      if (!data) {
        data = {
          pageHex: address.pageHex,
          page: new AACPage({ id: pageId, name: pageName, buttons: [] }),
          entries: [],
        };
        pageMap.set(address.pageHex, data);
      }

      const sequence = address.sequence;
      const button = new AACButton({
        id: `${pageId}:${sequence}:${index}`,
        label: text,
        message: parsed?.speech || text,
        type: parsed?.navigationType ? "NAVIGATE" : "SPEAK",
        semanticAction: parsed?.navigationType
          ? {
              category: AACSemanticCategory.NAVIGATION,
              intent:
                parsed.navigationType === "HOME"
                  ? AACSemanticIntent.GO_HOME
                  : parsed.navigationType === "BACK"
                    ? AACSemanticIntent.GO_BACK
                    : AACSemanticIntent.NAVIGATE_TO,
              parameters: { pageId: parsed.navigationTarget },
            }
          : {
              category: AACSemanticCategory.COMMUNICATION,
              intent: AACSemanticIntent.SPEAK_TEXT,
              parameters: { text: parsed?.speech || text },
            },
      });
      button.parameters = { pageHex: address.pageHex, sequence };
      if (parsed?.navigationTarget) {
        button.targetPageId = `page-${parsed.navigationTarget.toLowerCase()}`;
      }

      data.entries.push({ button, order: data.entries.length });
    });

    pageMap.forEach((data) => {
      if (data.entries.length === 0) {
        return;
      }

      const idealColumns = Math.min(
        16,
        Math.max(4, Math.ceil(Math.sqrt(data.entries.length))),
      );
      const totalColumns = idealColumns;
      const totalRows = Math.ceil(data.entries.length / totalColumns);

      data.page.grid = Array.from({ length: totalRows }, () =>
        Array.from({ length: totalColumns }, () => null),
      );

      data.entries.forEach(({ button, order }) => {
        const row = Math.floor(order / totalColumns);
        const column = order % totalColumns;
        data.page.addButton(button);
        if (
          row >= 0 &&
          row < data.page.grid.length &&
          column >= 0 &&
          column < data.page.grid[row].length
        ) {
          data.page.grid[row][column] = button;
          button.x = column;
          button.y = row;
        }
      });

      tree.addPage(data.page);
    });

    const preferredRoot = tree.pages["page-0400"]
      ? "page-0400"
      : Object.keys(tree.pages)[0];
    if (preferredRoot) {
      tree.rootId = preferredRoot;
    }

    tree.metadata = {
      ...tree.metadata,
      nuvoice: nuvoiceMetadata,
    };

    return tree;
  }

  async processTexts(
    filePathOrBuffer: ProcessorInput,
    translations: Map<string, string>,
    outputPath: string,
  ): Promise<Uint8Array | Buffer> {
    const document = await this.readDocument(filePathOrBuffer);

    for (const record of document.records) {
      if (record.type === "d") {
        const dictRecord = record as NuVoiceDictionaryRecord;
        dictRecord.word = translations.get(dictRecord.word) ?? dictRecord.word;
        dictRecord.pronunciation =
          translations.get(dictRecord.pronunciation) ??
          dictRecord.pronunciation;
      } else if (
        record.type === "m" &&
        "textSegment" in record &&
        record.textSegment
      ) {
        const nextText = translations.get(record.textSegment.text);
        if (nextText !== undefined) {
          setNuVoiceMemoryText(record, nextText);
        }
      } else if (
        record.type === "x" &&
        "textSegment" in record &&
        record.textSegment
      ) {
        const nextText = translations.get(record.textSegment.text);
        if (nextText !== undefined) {
          setNuVoiceLayoutText(record, nextText);
        }
      } else if ("bodyBytes" in record) {
        // Try to update text in other binary records (P, A, n, C, etc.)
        const binaryRecord = record as NuVoiceBinaryRecordBase;
        const textSegment = parseTextSegment(binaryRecord.bodyBytes);
        if (textSegment) {
          const nextText = translations.get(textSegment.text);
          if (nextText !== undefined) {
            // For generic records, try to update the text segment
            // This is a simplified approach - in reality, each record type might have different structures
            const newTextBytes = latin1ToBytes(nextText);
            if (newTextBytes.length <= record.bodyBytes.length) {
              // Replace the text segment in place
              const textStart =
                binaryRecord.bodyBytes.length -
                textSegment.suffixBytes.length -
                (textSegment.hasNullTerminator ? 1 : 0) -
                textSegment.text.length;
              binaryRecord.bodyBytes.set(newTextBytes, textStart);
            }
          }
        }
      }
    }

    const serialized = serializeNuVoiceDocument(document);
    await this.options.fileAdapter.writeTextToPath(outputPath, serialized);
    return encodeText(serialized);
  }

  saveFromTree(_tree: AACTree, _outputPath: string): Promise<void> {
    return Promise.reject(
      new Error(
        "NuVoice MTI saveFromTree is not supported yet; use processTexts on an existing .mti file.",
      ),
    );
  }

  async extractStringsWithMetadata(
    filePath: string,
  ): Promise<ExtractStringsResult> {
    try {
      const document = await this.readDocument(filePath);
      const extractedMap = new Map<
        string,
        ReturnType<typeof this.buildExtractedEntry>
      >();

      for (const entry of listNuVoiceTextEntries(document)) {
        const key = entry.source.toLowerCase();
        const vocabLocation = {
          table: entry.table,
          id: entry.id,
          column: entry.column,
          casing: detectCasing(entry.source),
        };

        const existing = extractedMap.get(key);
        if (existing) {
          existing.vocabPlacementMeta.vocabLocations.push(vocabLocation);
        } else {
          extractedMap.set(
            key,
            this.buildExtractedEntry(entry.source, vocabLocation),
          );
        }
      }

      return {
        errors: [],
        extractedStrings: Array.from(extractedMap.values()),
      };
    } catch (error) {
      return {
        errors: [
          {
            message:
              error instanceof Error
                ? error.message
                : "Unknown extraction error",
            step: "EXTRACT",
          },
        ],
        extractedStrings: [],
      };
    }
  }

  async generateTranslatedDownload(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[],
  ): Promise<string> {
    return this.generateTranslatedDownloadGeneric(
      filePath,
      translatedStrings,
      sourceStrings,
    );
  }

  private buildExtractedEntry(
    source: string,
    vocabLocation: VocabLocation,
  ): ExtractedString {
    return {
      string: source,
      vocabPlacementMeta: {
        vocabLocations: [vocabLocation],
      },
    };
  }

  private async readDocument(
    filePathOrBuffer: ProcessorInput,
  ): Promise<NuVoiceDocument> {
    const binary =
      await this.options.fileAdapter.readBinaryFromInput(filePathOrBuffer);
    const content = normalizeNuVoiceContent(binary);
    return parseNuVoiceDocument(content);
  }
}

export { NuVoiceProcessor };

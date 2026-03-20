import {
  BaseProcessor,
  ExtractStringsResult,
  ProcessorOptions,
  SourceString,
  TranslatedString,
} from '../core/baseProcessor';
import { AACTree, AACButton, AACPage } from '../core/treeStructure';
import { detectCasing } from '../core/stringCasing';
import { encodeText, ProcessorInput } from '../utils/io';
import {
  listNuVoiceTextEntries,
  NuVoiceDictionaryRecord,
  NuVoiceDocument,
  NuVoiceLayoutRecord,
  NuVoiceMemoryRecord,
  parseNuVoiceDocument,
  serializeNuVoiceDocument,
  setNuVoiceLayoutText,
  setNuVoiceMemoryText,
} from './nuvoice/helpers';

class NuVoiceProcessor extends BaseProcessor {
  async extractTexts(filePathOrBuffer: ProcessorInput): Promise<string[]> {
    const document = await this.readDocument(filePathOrBuffer);
    return listNuVoiceTextEntries(document).map((entry) => entry.source);
  }

  async loadIntoTree(filePathOrBuffer: ProcessorInput): Promise<AACTree> {
    const document = await this.readDocument(filePathOrBuffer);
    const tree = new AACTree();

    const dictionaryRecords = document.records.filter(
      (record): record is NuVoiceDictionaryRecord => record.type === 'd'
    );
    const memoryRecords = document.records.filter(
      (record): record is NuVoiceMemoryRecord => record.type === 'm' && record.textSegment !== null
    );
    const layoutRecords = document.records.filter(
      (record): record is NuVoiceLayoutRecord => record.type === 'x' && record.textSegment !== null
    );

    tree.metadata = {
      format: 'nuvoice',
      version: document.records.find((record) => record.type === 'v')?.version,
      name: document.records.find((record) => record.type === 'v')?.product || 'NuVoice MTI',
      recordCounts: {
        dictionary: dictionaryRecords.length,
        memory: memoryRecords.length,
        layout: layoutRecords.length,
      },
      invalidChecksumCount: document.records.filter(
        (record) => record.type !== 'v' && !record.checksumValid
      ).length,
    };

    if (dictionaryRecords.length > 0) {
      const page = new AACPage({
        id: 'nuvoice-dictionary',
        name: 'Pronunciation Dictionary',
        buttons: [],
      });

      dictionaryRecords.forEach((record, index) => {
        page.addButton(
          new AACButton({
            id: `dictionary:${index}`,
            label: record.word,
            message: record.pronunciation,
            type: 'SPEAK',
          })
        );
      });

      tree.addPage(page);
    }

    if (memoryRecords.length > 0) {
      const page = new AACPage({
        id: 'nuvoice-memory',
        name: 'Memory Labels',
        buttons: [],
      });

      memoryRecords.forEach((record) => {
        page.addButton(
          new AACButton({
            id: `memory:${record.addressHex}`,
            label: record.textSegment?.text || '',
            message: record.textSegment?.text || '',
            type: 'SPEAK',
          })
        );
      });

      tree.addPage(page);
    }

    if (layoutRecords.length > 0) {
      const page = new AACPage({
        id: 'nuvoice-layout',
        name: 'Layout Labels',
        buttons: [],
      });

      layoutRecords.forEach((record) => {
        page.addButton(
          new AACButton({
            id: `layout:${record.addressHex}`,
            label: record.textSegment?.text || '',
            message: record.textSegment?.text || '',
            type: 'SPEAK',
          })
        );
      });

      tree.addPage(page);
    }

    return tree;
  }

  async processTexts(
    filePathOrBuffer: ProcessorInput,
    translations: Map<string, string>,
    outputPath: string
  ): Promise<Uint8Array | Buffer> {
    const document = await this.readDocument(filePathOrBuffer);

    for (const record of document.records) {
      if (record.type === 'd') {
        record.word = translations.get(record.word) ?? record.word;
        record.pronunciation = translations.get(record.pronunciation) ?? record.pronunciation;
      } else if (record.type === 'm' && record.textSegment) {
        const nextText = translations.get(record.textSegment.text);
        if (nextText !== undefined) {
          setNuVoiceMemoryText(record, nextText);
        }
      } else if (record.type === 'x' && record.textSegment) {
        const nextText = translations.get(record.textSegment.text);
        if (nextText !== undefined) {
          setNuVoiceLayoutText(record, nextText);
        }
      }
    }

    const serialized = serializeNuVoiceDocument(document);
    await this.options.fileAdapter.writeTextToPath(outputPath, serialized);
    return encodeText(serialized);
  }

  async saveFromTree(_tree: AACTree, _outputPath: string): Promise<void> {
    throw new Error(
      'NuVoice MTI saveFromTree is not supported yet; use processTexts on an existing .mti file.'
    );
  }

  async extractStringsWithMetadata(filePath: string): Promise<ExtractStringsResult> {
    try {
      const document = await this.readDocument(filePath);
      const extractedMap = new Map<string, ReturnType<typeof this.buildExtractedEntry>>();

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
          extractedMap.set(key, this.buildExtractedEntry(entry.source, vocabLocation));
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
            message: error instanceof Error ? error.message : 'Unknown extraction error',
            step: 'EXTRACT',
          },
        ],
        extractedStrings: [],
      };
    }
  }

  async generateTranslatedDownload(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[]
  ): Promise<string> {
    return this.generateTranslatedDownloadGeneric(filePath, translatedStrings, sourceStrings);
  }

  private buildExtractedEntry(
    source: string,
    vocabLocation: {
      table: string;
      id: string;
      column: string;
      casing: ReturnType<typeof detectCasing>;
    }
  ) {
    return {
      string: source,
      vocabPlacementMeta: {
        vocabLocations: [vocabLocation],
      },
    };
  }

  private async readDocument(filePathOrBuffer: ProcessorInput): Promise<NuVoiceDocument> {
    const content = await this.options.fileAdapter.readTextFromInput(filePathOrBuffer, 'utf8');
    return parseNuVoiceDocument(content);
  }
}

export { NuVoiceProcessor };

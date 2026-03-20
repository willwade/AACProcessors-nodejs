import {
  BaseProcessor,
  ExtractStringsResult,
  ProcessorOptions,
  SourceString,
  TranslatedString,
} from '../core/baseProcessor';
import { AACTree, AACButton, AACPage, AACSemanticAction } from '../core/treeStructure';
import { detectCasing } from '../core/stringCasing';
import { encodeText, ProcessorInput } from '../utils/io';
import {
  listNuVoiceTextEntries,
  NuVoiceDictionaryRecord,
  NuVoiceDocument,
  NuVoiceLayoutRecord,
  NuVoiceMemoryRecord,
  parseNuVoiceDocument,
  parseTextSegment,
  serializeNuVoiceDocument,
  setNuVoiceLayoutText,
  setNuVoiceMemoryText,
  latin1ToBytes,
} from './nuvoice/helpers';

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
      format: 'nuvoice',
      version: document.records.find((record) => record.type === 'v')?.version,
      name: document.records.find((record) => record.type === 'v')?.product || 'NuVoice MTI',
      recordCounts,
      invalidChecksumCount: document.records.filter(
        (record) => record.type !== 'v' && !record.checksumValid
      ).length,
    };

    // Create main navigation page
    const mainPage = new AACPage({
      id: 'main',
      name: 'Main',
      buttons: [],
    });

    // Create content pages
    const dictionaryRecords = document.records.filter(
      (record): record is NuVoiceDictionaryRecord => record.type === 'd'
    );
    const memoryRecords = document.records.filter(
      (record): record is NuVoiceMemoryRecord => record.type === 'm' && record.textSegment !== null
    );
    const layoutRecords = document.records.filter(
      (record): record is NuVoiceLayoutRecord => record.type === 'x' && record.textSegment !== null
    );

    // Dictionary page
    if (dictionaryRecords.length > 0) {
      const dictPage = new AACPage({
        id: 'dictionary',
        name: 'Pronunciation Dictionary',
        buttons: [],
      });

      dictionaryRecords.forEach((record, index) => {
        dictPage.addButton(
          new AACButton({
            id: `dict:${index}`,
            label: record.word,
            message: record.pronunciation,
            type: 'SPEAK',
            semanticAction: {
              category: 'communication',
              intent: 'pronunciation',
              parameters: { word: record.word, pronunciation: record.pronunciation },
            },
          })
        );
      });

      tree.addPage(dictPage);

      // Add navigation button to main page
      mainPage.addButton(
        new AACButton({
          id: 'nav-dict',
          label: 'Dictionary',
          message: 'Open pronunciation dictionary',
          type: 'NAVIGATE',
          semanticAction: {
            category: 'navigation',
            intent: 'open_page',
            parameters: { pageId: 'dictionary' },
          },
        })
      );
    }

    // Memory page
    if (memoryRecords.length > 0) {
      const memoryPage = new AACPage({
        id: 'memory',
        name: 'Memory Labels',
        buttons: [],
      });

      memoryRecords.forEach((record, index) => {
        memoryPage.addButton(
          new AACButton({
            id: `mem:${index}`,
            label: record.textSegment?.text || '',
            message: record.textSegment?.text || '',
            type: 'SPEAK',
            semanticAction: semanticAction: {
              category: 'communication',
              intent: 'speak',
              parameters: { text: record.textSegment?.text },
            }),
          })
        );
      });

      tree.addPage(memoryPage);

      mainPage.addButton(
        new AACButton({
          id: 'nav-memory',
          label: 'Memory',
          message: 'Open memory labels',
          type: 'NAVIGATE',
          semanticAction: semanticAction: {
            category: 'navigation',
            intent: 'open_page',
            parameters: { pageId: 'memory' },
          }),
        })
      );
    }

    // Layout page
    if (layoutRecords.length > 0) {
      const layoutPage = new AACPage({
        id: 'layout',
        name: 'Layout Labels',
        buttons: [],
      });

      layoutRecords.forEach((record, index) => {
        layoutPage.addButton(
          new AACButton({
            id: `layout:${index}`,
            label: record.textSegment?.text || '',
            message: record.textSegment?.text || '',
            type: 'SPEAK',
            semanticAction: semanticAction: {
              category: 'communication',
              intent: 'speak',
              parameters: { text: record.textSegment?.text },
            }),
          })
        );
      });

      tree.addPage(layoutPage);

      mainPage.addButton(
        new AACButton({
          id: 'nav-layout',
          label: 'Layout',
          message: 'Open layout labels',
          type: 'NAVIGATE',
          semanticAction: semanticAction: {
            category: 'navigation',
            intent: 'open_page',
            parameters: { pageId: 'layout' },
          }),
        })
      );
    }

    // Try to create additional pages from other record types
    const otherRecords = document.records.filter(
      (record) => !['v', 'd', 'm', 'x', 'X'].includes(record.type) && 'bodyBytes' in record
    );

    if (otherRecords.length > 0) {
      const otherPage = new AACPage({
        id: 'other',
        name: 'Additional Content',
        buttons: [],
      });

      otherRecords.forEach((record, index) => {
        const textSegment = parseTextSegment(record.bodyBytes);
        if (textSegment) {
          otherPage.addButton(
            new AACButton({
              id: `other:${index}`,
              label: textSegment.text,
              message: textSegment.text,
              type: 'SPEAK',
              semanticAction: semanticAction: {
                category: 'communication',
                intent: 'speak',
                parameters: { text: textSegment.text },
              }),
            })
          );
        }
      });

      if (otherPage.buttons.length > 0) {
        tree.addPage(otherPage);
        mainPage.addButton(
          new AACButton({
            id: 'nav-other',
            label: 'More',
            message: 'Open additional content',
            type: 'NAVIGATE',
            semanticAction: semanticAction: {
              category: 'navigation',
              intent: 'open_page',
              parameters: { pageId: 'other' },
            }),
          })
        );
      }
    }

    // Add main page if it has buttons
    if (mainPage.buttons.length > 0) {
      tree.addPage(mainPage);
      tree.rootId = 'main';
    } else if (tree.pages.size > 0) {
      // Set root to first page if no main page
      tree.rootId = Array.from(tree.pages.keys())[0];
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
      } else if ('bodyBytes' in record) {
        // Try to update text in other binary records
        const textSegment = parseTextSegment(record.bodyBytes);
        if (textSegment) {
          const nextText = translations.get(textSegment.text);
          if (nextText !== undefined) {
            // For generic records, try to update the text segment
            // This is a simplified approach - in reality, each record type might have different structures
            const newTextBytes = latin1ToBytes(nextText);
            if (newTextBytes.length <= record.bodyBytes.length) {
              // Replace the text segment in place
              const textStart = record.bodyBytes.length - textSegment.suffixBytes.length - (textSegment.hasNullTerminator ? 1 : 0) - textSegment.text.length;
              record.bodyBytes.set(newTextBytes, textStart);
            }
          }
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
    const content = await this.options.fileAdapter.readTextFromInput(filePathOrBuffer, 'latin1');
    return parseNuVoiceDocument(content);
  }
}

export { NuVoiceProcessor };

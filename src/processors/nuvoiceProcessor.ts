import {
  BaseProcessor,
  ExtractStringsResult,
  ProcessorOptions,
  SourceString,
  TranslatedString,
} from '../core/baseProcessor';
import { AACTree, AACButton, AACPage, AACSemanticAction, AACSemanticCategory, AACSemanticIntent } from '../core/treeStructure';
import { detectCasing } from '../core/stringCasing';
import { encodeText, ProcessorInput } from '../utils/io';
import {
  listNuVoiceTextEntries,
  NuVoiceBinaryRecordBase,
  NuVoiceDictionaryRecord,
  NuVoiceDocument,
  NuVoiceHeaderRecord,
  NuVoiceLayoutRecord,
  NuVoiceMemoryRecord,
  NuVoicePageRecord,
  NuVoiceActionRecord,
  NuVoiceNavigationRecord,
  NuVoiceGridRecord,
  NuVoiceCellRecord,
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
      version: (document.records.find((record) => record.type === 'v') as NuVoiceHeaderRecord)?.version,
      name: (document.records.find((record) => record.type === 'v') as NuVoiceHeaderRecord)?.product || 'NuVoice MTI',
      recordCounts,
      invalidChecksumCount: document.records.filter(
        (record) => record.type !== 'v' && 'checksumValid' in record && !record.checksumValid
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
      (record): record is NuVoiceMemoryRecord => record.type === 'm' && 'textSegment' in record && record.textSegment !== null
    );
    const layoutRecords = document.records.filter(
      (record): record is NuVoiceLayoutRecord => record.type === 'x' && 'textSegment' in record && record.textSegment !== null
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
              category: AACSemanticCategory.COMMUNICATION,
              intent: AACSemanticIntent.SPEAK_TEXT,
              parameters: { text: record.word },
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
            category: AACSemanticCategory.NAVIGATION,
            intent: AACSemanticIntent.NAVIGATE_TO,
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
            semanticAction: {
              category: AACSemanticCategory.COMMUNICATION,
              intent: AACSemanticIntent.SPEAK_TEXT,
              parameters: { text: record.textSegment?.text },
            },
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
          semanticAction: {
            category: AACSemanticCategory.NAVIGATION,
            intent: AACSemanticIntent.NAVIGATE_TO,
            parameters: { pageId: 'memory' },
          },
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
            semanticAction: {
              category: AACSemanticCategory.COMMUNICATION,
              intent: AACSemanticIntent.SPEAK_TEXT,
              parameters: { text: record.textSegment?.text },
            },
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
          semanticAction: {
            category: AACSemanticCategory.NAVIGATION,
            intent: AACSemanticIntent.NAVIGATE_TO,
            parameters: { pageId: 'layout' },
          },
        })
      );
    }

    // Try to create additional pages from other record types
    const pageRecords = document.records.filter(
      (record): record is NuVoicePageRecord => record.type === 'P'
    );
    const actionRecords = document.records.filter(
      (record): record is NuVoiceActionRecord => record.type === 'A'
    );
    const navigationRecords = document.records.filter(
      (record): record is NuVoiceNavigationRecord => record.type === 'n'
    );
    const gridRecords = document.records.filter(
      (record): record is NuVoiceGridRecord => record.type === 'G'
    );
    const cellRecords = document.records.filter(
      (record): record is NuVoiceCellRecord => record.type === 'C'
    );

    // Create pages from P records
    pageRecords.forEach((record, index) => {
      const textSegment = parseTextSegment(record.bodyBytes);
      const pageName = textSegment?.text || `Page ${index + 1}`;
      const page = new AACPage({
        id: `page-${index}`,
        name: pageName,
        buttons: [],
      });

      // Try to find associated cells for this page
      const pageCells = cellRecords.filter(cell => {
        // Simple heuristic: check if cell data references this page
        // In a real implementation, this would need proper MTI format understanding
        return true; // For now, include all cells
      });

      pageCells.forEach((cell, cellIndex) => {
        const cellText = parseTextSegment(cell.bodyBytes);
        if (cellText) {
          page.addButton(
            new AACButton({
              id: `page-${index}-cell-${cellIndex}`,
              label: cellText.text,
              message: cellText.text,
              type: 'SPEAK',
              semanticAction: {
                category: AACSemanticCategory.COMMUNICATION,
              intent: AACSemanticIntent.SPEAK_TEXT,
                parameters: { text: cellText.text },
              },
            })
          );
        }
      });

      if (page.buttons.length > 0) {
        tree.addPage(page);
        mainPage.addButton(
          new AACButton({
            id: `nav-page-${index}`,
            label: pageName,
            message: `Open ${pageName}`,
            type: 'NAVIGATE',
            semanticAction: {
              category: AACSemanticCategory.NAVIGATION,
            intent: AACSemanticIntent.NAVIGATE_TO,
              parameters: { pageId: `page-${index}` },
            },
          })
        );
      }
    });

    // Create actions page from A records
    if (actionRecords.length > 0) {
      const actionsPage = new AACPage({
        id: 'actions',
        name: 'Actions',
        buttons: [],
      });

      actionRecords.forEach((record, index) => {
        const textSegment = parseTextSegment(record.bodyBytes);
        if (textSegment) {
          actionsPage.addButton(
            new AACButton({
              id: `action-${index}`,
              label: textSegment.text,
              message: textSegment.text,
              type: 'SPEAK',
              semanticAction: {
                category: AACSemanticCategory.COMMUNICATION,
                intent: AACSemanticIntent.SPEAK_TEXT,
                parameters: { action: textSegment.text },
              },
            })
          );
        }
      });

      if (actionsPage.buttons.length > 0) {
        tree.addPage(actionsPage);
        mainPage.addButton(
          new AACButton({
            id: 'nav-actions',
            label: 'Actions',
            message: 'Open actions',
            type: 'NAVIGATE',
            semanticAction: {
              category: AACSemanticCategory.NAVIGATION,
              intent: AACSemanticIntent.NAVIGATE_TO,
              parameters: { pageId: 'actions' },
            },
          })
        );
      }
    }

    // Create navigation page from n records
    if (navigationRecords.length > 0) {
      const navPage = new AACPage({
        id: 'navigation',
        name: 'Navigation',
        buttons: [],
      });

      navigationRecords.forEach((record, index) => {
        const textSegment = parseTextSegment(record.bodyBytes);
        if (textSegment) {
          navPage.addButton(
            new AACButton({
              id: `nav-${index}`,
              label: textSegment.text,
              message: textSegment.text,
              type: 'SPEAK',
              semanticAction: {
                category: AACSemanticCategory.NAVIGATION,
                intent: AACSemanticIntent.NAVIGATE_TO,
                parameters: { destination: textSegment.text },
              },
            })
          );
        }
      });

      if (navPage.buttons.length > 0) {
        tree.addPage(navPage);
        mainPage.addButton(
          new AACButton({
            id: 'nav-navigation',
            label: 'Navigation',
            message: 'Open navigation',
            type: 'NAVIGATE',
            semanticAction: {
              category: AACSemanticCategory.NAVIGATION,
              intent: AACSemanticIntent.NAVIGATE_TO,
              parameters: { pageId: 'navigation' },
            },
          })
        );
      }
    }

    // Handle remaining unknown record types
    const otherRecords = document.records.filter(
      (record) => !['v', 'd', 'm', 'x', 'X', 'P', 'A', 'n', 'C'].includes(record.type) && 'bodyBytes' in record
    );

    if (otherRecords.length > 0) {
      const otherPage = new AACPage({
        id: 'other',
        name: 'Additional Content',
        buttons: [],
      });

      // Group by record type for better organization
      const recordsByType: Record<string, typeof otherRecords> = {};
      otherRecords.forEach(record => {
        if (!recordsByType[record.type]) {
          recordsByType[record.type] = [];
        }
        recordsByType[record.type].push(record);
      });

      Object.entries(recordsByType).forEach(([type, records]) => {
        records.forEach((record, index) => {
          const binaryRecord = record as NuVoiceBinaryRecordBase;
          const textSegment = parseTextSegment(binaryRecord.bodyBytes);
          if (textSegment) {
            otherPage.addButton(
              new AACButton({
                id: `other-${type}:${index}`,
                label: `${type}: ${textSegment.text}`,
                message: textSegment.text,
                type: 'SPEAK',
                semanticAction: {
                  category: AACSemanticCategory.COMMUNICATION,
                  intent: AACSemanticIntent.SPEAK_TEXT,
                  parameters: { text: textSegment.text, recordType: type },
                },
              })
            );
          }
        });
      });

      if (otherPage.buttons.length > 0) {
        tree.addPage(otherPage);
        mainPage.addButton(
          new AACButton({
            id: 'nav-other',
            label: 'More',
            message: 'Open additional content',
            type: 'NAVIGATE',
            semanticAction: {
              category: AACSemanticCategory.NAVIGATION,
              intent: AACSemanticIntent.NAVIGATE_TO,
              parameters: { pageId: 'other' },
            },
          })
        );
      }
    }

    // Add main page if it has buttons
    if (mainPage.buttons.length > 0) {
      tree.addPage(mainPage);
      tree.rootId = 'main';
    } else if (Object.keys(tree.pages).length > 0) {
      // Set root to first page if no main page
      tree.rootId = Object.keys(tree.pages)[0];
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
        const dictRecord = record as NuVoiceDictionaryRecord;
        dictRecord.word = translations.get(dictRecord.word) ?? dictRecord.word;
        dictRecord.pronunciation = translations.get(dictRecord.pronunciation) ?? dictRecord.pronunciation;
      } else if (record.type === 'm' && 'textSegment' in record && record.textSegment) {
        const nextText = translations.get(record.textSegment.text);
        if (nextText !== undefined) {
          setNuVoiceMemoryText(record as NuVoiceMemoryRecord, nextText);
        }
      } else if (record.type === 'x' && 'textSegment' in record && record.textSegment) {
        const nextText = translations.get(record.textSegment.text);
        if (nextText !== undefined) {
          setNuVoiceLayoutText(record as NuVoiceLayoutRecord, nextText);
        }
      } else if ('bodyBytes' in record) {
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
              const textStart = binaryRecord.bodyBytes.length - textSegment.suffixBytes.length - (textSegment.hasNullTerminator ? 1 : 0) - textSegment.text.length;
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

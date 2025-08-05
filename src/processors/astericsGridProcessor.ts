import {
  BaseProcessor,
  ProcessorOptions,
  ExtractStringsResult,
  TranslatedString,
  SourceString,
} from '../core/baseProcessor';
import {
  AACTree,
  AACPage,
  AACButton,
  AACSemanticAction,
  AACSemanticCategory,
  AACSemanticIntent,
} from '../core/treeStructure';
import fs from 'fs';

// Asterics Grid data model interfaces
interface GridData {
  id: string;
  modelName: string;
  modelVersion: string;
  label: { [lang: string]: string };
  rowCount: number;
  columnCount?: number;
  minColumnCount?: number;
  gridElements: GridElement[];
  thumbnail?: {
    data: string;
    hash: string;
  };
}

interface GridElement {
  id: string;
  modelName: string;
  modelVersion: string;
  width: number;
  height: number;
  x: number;
  y: number;
  label: { [lang: string]: string };
  wordForms?: WordForm[];
  image?: GridImage;
  backgroundColor?: string;
  actions: GridAction[];
  dontCollect?: boolean;
  type?: string;
  additionalProps?: any;
}

interface GridImage {
  id?: string;
  data?: string | null;
  url?: string;
  author?: string;
  authorURL?: string;
  searchProviderName?: string;
  searchProviderOptions?: any[];
}

interface WordForm {
  lang?: string;
  tags: string[];
  value: string;
  pronunciation?: string;
  base?: string;
}

interface GridAction {
  id: string;
  modelName: string;
  modelVersion?: string;
  [key: string]: any; // For action-specific properties
}

interface AstericsGridFile {
  grids: GridData[];
  metadata?: any;
}

class AstericsGridProcessor extends BaseProcessor {
  private loadAudio: boolean = false;

  constructor(options: ProcessorOptions & { loadAudio?: boolean } = {}) {
    super(options);
    this.loadAudio = options.loadAudio || false;
  }

  extractTexts(filePathOrBuffer: string | Buffer): string[] {
    const tree = this.loadIntoTree(filePathOrBuffer);
    const texts: string[] = [];

    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      if (page.name) texts.push(page.name);

      page.buttons.forEach((btn) => {
        if (btn.label) texts.push(btn.label);
        if (btn.message && btn.message !== btn.label) texts.push(btn.message);
      });
    }

    // Also extract texts from the raw file for comprehensive coverage
    const rawTexts = this.extractRawTexts(filePathOrBuffer);
    rawTexts.forEach((text) => {
      if (text && !texts.includes(text)) {
        texts.push(text);
      }
    });

    return texts;
  }

  private extractRawTexts(filePathOrBuffer: string | Buffer): string[] {
    let content = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer.toString('utf-8')
      : fs.readFileSync(filePathOrBuffer, 'utf-8');

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const texts: string[] = [];

    try {
      const grdFile: AstericsGridFile = JSON.parse(content);

      grdFile.grids.forEach((grid: GridData) => {
        // Extract grid labels
        Object.values(grid.label || {}).forEach((label) => {
          if (label && typeof label === 'string') texts.push(label);
        });

        // Extract element texts
        grid.gridElements.forEach((element: GridElement) => {
          // Element labels
          Object.values(element.label || {}).forEach((label) => {
            if (label && typeof label === 'string') texts.push(label);
          });

          // Word forms
          element.wordForms?.forEach((wordForm: WordForm) => {
            if (wordForm.value) texts.push(wordForm.value);
          });

          // Action-specific texts
          element.actions.forEach((action: GridAction) => {
            this.extractActionTexts(action, texts);
          });
        });
      });
    } catch (error) {
      // If JSON parsing fails, return empty array
    }

    return texts;
  }

  private extractActionTexts(action: GridAction, texts: string[]): void {
    switch (action.modelName) {
      case 'GridActionSpeakCustom':
        if (action.speakText && typeof action.speakText === 'object') {
          Object.values(action.speakText).forEach((text: unknown) => {
            if (text && typeof text === 'string') texts.push(text);
          });
        }
        break;
      case 'GridActionChangeLang':
        if (action.language && typeof action.language === 'string') {
          texts.push(action.language);
        }
        if (action.voice && typeof action.voice === 'string') {
          texts.push(action.voice);
        }
        break;
      case 'GridActionHTTP':
        if (action.restUrl && typeof action.restUrl === 'string') {
          texts.push(action.restUrl);
        }
        if (action.body && typeof action.body === 'string') {
          texts.push(action.body);
        }
        break;
      case 'GridActionOpenWebpage':
        if (action.openURL && typeof action.openURL === 'string') {
          texts.push(action.openURL);
        }
        break;
      case 'GridActionMatrix':
        if (action.sendText && typeof action.sendText === 'string') {
          texts.push(action.sendText);
        }
        break;
      // Add more action types as needed
    }
  }

  loadIntoTree(filePathOrBuffer: string | Buffer): AACTree {
    const tree = new AACTree();
    let content = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer.toString('utf-8')
      : fs.readFileSync(filePathOrBuffer, 'utf-8');

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const grdFile: AstericsGridFile = JSON.parse(content);

    if (!grdFile.grids) {
      return tree;
    }

    // First pass: create all pages
    grdFile.grids.forEach((grid: GridData) => {
      const colorConfig = grdFile.metadata?.colorConfig;
      const page = new AACPage({
        id: grid.id,
        name: this.getLocalizedLabel(grid.label) || grid.id,
        grid: [],
        buttons: [],
        parentId: null,
        style: {
          backgroundColor: colorConfig?.gridBackgroundColor || '#FFFFFF',
          borderColor: colorConfig?.elementBorderColor || '#CCCCCC',
          borderWidth: colorConfig?.borderWidth || 1,
          fontFamily: colorConfig?.fontFamily || 'Arial',
          fontSize: colorConfig?.fontSizePct ? colorConfig.fontSizePct * 16 : 16, // Convert percentage to pixels, default to 16
          fontColor: colorConfig?.fontColor || '#000000',
        },
      });
      tree.addPage(page);
    });

    // Second pass: add buttons and establish navigation
    grdFile.grids.forEach((grid: GridData) => {
      const page = tree.getPage(grid.id);
      if (!page) return;

      // Create a 2D grid to track button positions
      const gridLayout: (AACButton | null)[][] = [];
      const maxRows = Math.max(10, grid.rowCount || 10);
      const maxCols = Math.max(10, grid.minColumnCount || 10);
      for (let r = 0; r < maxRows; r++) {
        gridLayout[r] = new Array(maxCols).fill(null);
      }

      grid.gridElements.forEach((element: GridElement) => {
        const button = this.createButtonFromElement(element, grdFile.metadata?.colorConfig);
        page.addButton(button);

        // Place button in grid layout using its x,y coordinates
        const buttonX = element.x || 0;
        const buttonY = element.y || 0;
        const buttonWidth = element.width || 1;
        const buttonHeight = element.height || 1;

        // Place button in grid (handle width/height span)
        for (let r = buttonY; r < buttonY + buttonHeight && r < maxRows; r++) {
          for (let c = buttonX; c < buttonX + buttonWidth && c < maxCols; c++) {
            if (gridLayout[r] && gridLayout[r][c] === null) {
              gridLayout[r][c] = button;
            }
          }
        }

        // Handle navigation relationships
        const navAction = element.actions.find(
          (a: GridAction) => a.modelName === 'GridActionNavigate'
        );
        if (navAction && navAction.toGridId) {
          const targetPage = tree.getPage(navAction.toGridId);
          if (targetPage) {
            targetPage.parentId = page.id;
          }
        }
      });

      // Set the page's grid layout
      page.grid = gridLayout;
    });

    return tree;
  }

  private getLocalizedLabel(labelMap: { [lang: string]: string } | undefined): string {
    if (!labelMap) return '';

    // Prefer English, then any available language
    return labelMap.en || labelMap.de || labelMap.es || Object.values(labelMap)[0] || '';
  }

  private getLocalizedText(text: any): string {
    if (typeof text === 'string') return text;
    if (typeof text === 'object' && text) {
      return text.en || text.de || text.es || Object.values(text)[0] || '';
    }
    return '';
  }

  private createButtonFromElement(element: GridElement, colorConfig?: any): AACButton {
    let audioRecording;
    if (this.loadAudio) {
      const audioAction = element.actions.find(
        (a: GridAction) => a.modelName === 'GridActionAudio'
      );
      if (audioAction && audioAction.dataBase64) {
        audioRecording = {
          id: parseInt(audioAction.id) || undefined,
          data: Buffer.from(audioAction.dataBase64, 'base64'),
          identifier: audioAction.filename,
          metadata: JSON.stringify({
            mimeType: audioAction.mimeType,
            durationMs: audioAction.durationMs,
          }),
        };
      }
    }

    const navAction = element.actions.find((a: GridAction) => a.modelName === 'GridActionNavigate');
    const targetPageId = navAction ? navAction.toGridId : null;

    // Determine button type based on actions
    let buttonType: 'SPEAK' | 'NAVIGATE' = 'SPEAK';
    if (targetPageId) {
      buttonType = 'NAVIGATE';
    }

    const label = this.getLocalizedLabel(element.label);

    // Create semantic action from AstericsGrid element
    let semanticAction: AACSemanticAction | undefined;
    let legacyAction: any = null;

    // Find the primary action
    const primaryAction = element.actions[0]; // AstericsGrid typically has one primary action

    if (navAction && targetPageId) {
      semanticAction = {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: targetPageId,
        platformData: {
          astericsGrid: {
            modelName: navAction.modelName,
            properties: navAction,
          },
        },
        fallback: {
          type: 'NAVIGATE',
          targetPageId: targetPageId,
        },
      };
      legacyAction = {
        type: 'NAVIGATE',
        targetPageId: targetPageId,
      };
    } else {
      // Check for other action types
      const collectAction = element.actions.find((a) => a.modelName === 'GridActionCollectElement');

      if (collectAction) {
        // Handle text editing actions
        switch (collectAction.action) {
          case 'COLLECT_ACTION_REMOVE_WORD':
            semanticAction = {
              category: AACSemanticCategory.TEXT_EDITING,
              intent: AACSemanticIntent.DELETE_WORD,
              platformData: {
                astericsGrid: {
                  modelName: collectAction.modelName,
                  properties: collectAction,
                },
              },
              fallback: {
                type: 'ACTION',
                message: 'Delete word',
              },
            };
            legacyAction = {
              type: 'DELETE_WORD',
            };
            break;

          case 'COLLECT_ACTION_REMOVE_CHAR':
            semanticAction = {
              category: AACSemanticCategory.TEXT_EDITING,
              intent: AACSemanticIntent.DELETE_CHARACTER,
              platformData: {
                astericsGrid: {
                  modelName: collectAction.modelName,
                  properties: collectAction,
                },
              },
              fallback: {
                type: 'ACTION',
                message: 'Delete character',
              },
            };
            legacyAction = {
              type: 'DELETE_CHARACTER',
            };
            break;

          case 'COLLECT_ACTION_CLEAR':
            semanticAction = {
              category: AACSemanticCategory.TEXT_EDITING,
              intent: AACSemanticIntent.CLEAR_TEXT,
              platformData: {
                astericsGrid: {
                  modelName: collectAction.modelName,
                  properties: collectAction,
                },
              },
              fallback: {
                type: 'ACTION',
                message: 'Clear text',
              },
            };
            legacyAction = {
              type: 'CLEAR_TEXT',
            };
            break;
        }
      }

      // Check for navigation actions with special nav types
      if (!semanticAction && navAction) {
        switch (navAction.navType) {
          case 'TO_LAST':
            semanticAction = {
              category: AACSemanticCategory.NAVIGATION,
              intent: AACSemanticIntent.GO_BACK,
              platformData: {
                astericsGrid: {
                  modelName: navAction.modelName,
                  properties: navAction,
                },
              },
              fallback: {
                type: 'ACTION',
                message: 'Go back',
              },
            };
            legacyAction = {
              type: 'GO_BACK',
            };
            break;

          case 'TO_HOME':
            semanticAction = {
              category: AACSemanticCategory.NAVIGATION,
              intent: AACSemanticIntent.GO_HOME,
              platformData: {
                astericsGrid: {
                  modelName: navAction.modelName,
                  properties: navAction,
                },
              },
              fallback: {
                type: 'ACTION',
                message: 'Go home',
              },
            };
            legacyAction = {
              type: 'GO_HOME',
            };
            break;
        }
      }

      // Check for speak actions if no other semantic action was found
      if (!semanticAction) {
        const speakAction = element.actions.find(
          (a) => a.modelName === 'GridActionSpeakCustom' || a.modelName === 'GridActionSpeak'
        );

        if (speakAction) {
          const speakText =
            speakAction.modelName === 'GridActionSpeakCustom'
              ? this.getLocalizedText(speakAction.speakText)
              : label;

          semanticAction = {
            category: AACSemanticCategory.COMMUNICATION,
            intent: AACSemanticIntent.SPEAK_TEXT,
            text: speakText,
            platformData: {
              astericsGrid: {
                modelName: speakAction.modelName,
                properties: speakAction,
              },
            },
            fallback: {
              type: 'SPEAK',
              message: speakText,
            },
          };
        } else {
          // Default speak action
          semanticAction = {
            category: AACSemanticCategory.COMMUNICATION,
            intent: AACSemanticIntent.SPEAK_TEXT,
            text: label,
            platformData: {
              astericsGrid: {
                modelName: 'GridActionSpeak',
                properties: {},
              },
            },
            fallback: {
              type: 'SPEAK',
              message: label,
            },
          };
        }
      }
    }

    return new AACButton({
      id: element.id,
      label: label,
      message: label,

      targetPageId: targetPageId,

      semanticAction: semanticAction,
      audioRecording: audioRecording,
      style: {
        backgroundColor:
          element.backgroundColor || colorConfig?.elementBackgroundColor || '#FFFFFF',
        borderColor: colorConfig?.elementBorderColor || '#CCCCCC',
        borderWidth: colorConfig?.borderWidth || 1,
        fontFamily: colorConfig?.fontFamily || 'Arial',
        fontSize: colorConfig?.fontSizePct ? colorConfig.fontSizePct * 16 : 16, // Default to 16px
        fontColor: colorConfig?.fontColor || '#000000',
      },
    });
  }

  processTexts(
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string
  ): Buffer {
    // Load and parse the original file
    let content = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer.toString('utf-8')
      : fs.readFileSync(filePathOrBuffer, 'utf-8');

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const grdFile: AstericsGridFile = JSON.parse(content);

    // Apply translations directly to the JSON structure for comprehensive coverage
    this.applyTranslationsToGridFile(grdFile, translations);

    // Write the translated file
    fs.writeFileSync(outputPath, JSON.stringify(grdFile, null, 2));
    return fs.readFileSync(outputPath);
  }

  private applyTranslationsToGridFile(
    grdFile: AstericsGridFile,
    translations: Map<string, string>
  ): void {
    grdFile.grids.forEach((grid: GridData) => {
      // Translate grid labels
      if (grid.label) {
        Object.keys(grid.label).forEach((lang) => {
          const originalText = grid.label[lang];
          if (originalText && translations.has(originalText)) {
            grid.label[lang] = translations.get(originalText)!;
          }
        });
      }

      // Translate grid elements
      grid.gridElements.forEach((element: GridElement) => {
        // Translate element labels
        if (element.label) {
          Object.keys(element.label).forEach((lang) => {
            const originalText = element.label[lang];
            if (originalText && translations.has(originalText)) {
              element.label[lang] = translations.get(originalText)!;
            }
          });
        }

        // Translate word forms
        if (element.wordForms) {
          element.wordForms.forEach((wordForm: WordForm) => {
            if (wordForm.value && translations.has(wordForm.value)) {
              wordForm.value = translations.get(wordForm.value)!;
            }
          });
        }

        // Translate action-specific texts
        element.actions.forEach((action: GridAction) => {
          this.applyTranslationsToAction(action, translations);
        });
      });
    });
  }

  private applyTranslationsToAction(action: GridAction, translations: Map<string, string>): void {
    switch (action.modelName) {
      case 'GridActionSpeakCustom':
        if (action.speakText && typeof action.speakText === 'object') {
          Object.keys(action.speakText).forEach((lang) => {
            const originalText = action.speakText[lang];
            if (typeof originalText === 'string' && translations.has(originalText)) {
              const translation = translations.get(originalText);
              if (translation) {
                action.speakText[lang] = translation;
              }
            }
          });
        }
        break;
      case 'GridActionChangeLang':
        if (typeof action.language === 'string' && translations.has(action.language)) {
          const translation = translations.get(action.language);
          if (translation) {
            action.language = translation;
          }
        }
        if (typeof action.voice === 'string' && translations.has(action.voice)) {
          const translation = translations.get(action.voice);
          if (translation) {
            action.voice = translation;
          }
        }
        break;
      case 'GridActionHTTP':
        if (typeof action.restUrl === 'string' && translations.has(action.restUrl)) {
          const translation = translations.get(action.restUrl);
          if (translation) {
            action.restUrl = translation;
          }
        }
        if (typeof action.body === 'string' && translations.has(action.body)) {
          const translation = translations.get(action.body);
          if (translation) {
            action.body = translation;
          }
        }
        break;
      case 'GridActionOpenWebpage':
        if (typeof action.openURL === 'string' && translations.has(action.openURL)) {
          const translation = translations.get(action.openURL);
          if (translation) {
            action.openURL = translation;
          }
        }
        break;
      case 'GridActionMatrix':
        if (typeof action.sendText === 'string' && translations.has(action.sendText)) {
          const translation = translations.get(action.sendText);
          if (translation) {
            action.sendText = translation;
          }
        }
        break;
      // Add more action types as needed
    }
  }

  saveFromTree(tree: AACTree, outputPath: string): void {
    // Use default Asterics Grid styling instead of taking from first page
    // This prevents issues where the first page has unusual colors (like purple)
    const defaultPageStyle = {
      backgroundColor: '#FFFFFF', // White background by default
      borderColor: '#CCCCCC',
      borderWidth: 1,
      fontFamily: 'Arial',
      fontSize: 16,
      fontColor: '#000000',
    };

    const grids: GridData[] = Object.values(tree.pages).map((page) => {
      // Create a map of button positions from the grid layout
      const buttonPositions = new Map<string, { x: number; y: number }>();

      // Extract positions from the 2D grid if available
      if (page.grid && page.grid.length > 0) {
        page.grid.forEach((row, y) => {
          row.forEach((button, x) => {
            if (button) {
              buttonPositions.set(button.id, { x, y });
            }
          });
        });
      }

      // Filter out navigation/system buttons if configured
      const filteredButtons = this.filterPageButtons(page.buttons);

      const gridElements: GridElement[] = filteredButtons.map((button, index) => {
        // Use grid position if available, otherwise arrange in rows of 4
        const gridWidth = 4;
        const position = buttonPositions.get(button.id);
        const calculatedX = position ? position.x : index % gridWidth;
        const calculatedY = position ? position.y : Math.floor(index / gridWidth);
        const actions: GridAction[] = [];

        // Add appropriate actions - prefer semantic actions
        if (button.semanticAction?.platformData?.astericsGrid) {
          // Use original AstericsGrid action data
          const astericsData = button.semanticAction.platformData.astericsGrid;
          actions.push({
            id: `grid-action-${button.id}`,
            ...astericsData.properties,
            modelName: astericsData.modelName,
            modelVersion:
              astericsData.properties.modelVersion || '{"major": 5, "minor": 0, "patch": 0}',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.NAVIGATE_TO) {
          // Create navigation action from semantic data
          const targetId = button.semanticAction.targetId || button.targetPageId;
          actions.push({
            id: `grid-action-navigate-${button.id}`,
            modelName: 'GridActionNavigate',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            navType: 'navigateToGrid',
            toGridId: targetId,
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.GO_BACK) {
          // Create back navigation action
          actions.push({
            id: `grid-action-navigate-back-${button.id}`,
            modelName: 'GridActionNavigate',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            navType: 'TO_LAST',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.GO_HOME) {
          // Create home navigation action
          actions.push({
            id: `grid-action-navigate-home-${button.id}`,
            modelName: 'GridActionNavigate',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            navType: 'TO_HOME',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.DELETE_WORD) {
          // Create delete word action
          actions.push({
            id: `grid-action-delete-word-${button.id}`,
            modelName: 'GridActionCollectElement',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            action: 'COLLECT_ACTION_REMOVE_WORD',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.DELETE_CHARACTER) {
          // Create delete character action
          actions.push({
            id: `grid-action-delete-char-${button.id}`,
            modelName: 'GridActionCollectElement',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            action: 'COLLECT_ACTION_REMOVE_CHAR',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.CLEAR_TEXT) {
          // Create clear text action
          actions.push({
            id: `grid-action-clear-${button.id}`,
            modelName: 'GridActionCollectElement',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            action: 'COLLECT_ACTION_CLEAR',
          });
        } else if (button.semanticAction?.intent === AACSemanticIntent.SPEAK_TEXT) {
          // Create speak action from semantic data
          if (button.semanticAction.text && button.semanticAction.text !== button.label) {
            actions.push({
              id: `grid-action-speak-${button.id}`,
              modelName: 'GridActionSpeakCustom',
              modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
              speakText: { en: button.semanticAction.text },
            });
          } else {
            actions.push({
              id: `grid-action-speak-${button.id}`,
              modelName: 'GridActionSpeak',
              modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            });
          }
        } else {
          // Default to speak action if no semantic action
          actions.push({
            id: `grid-action-speak-${button.id}`,
            modelName: 'GridActionSpeak',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
          });
        }

        // Add audio action if present
        if (button.audioRecording && button.audioRecording.data) {
          const metadata = JSON.parse(button.audioRecording.metadata || '{}');
          actions.push({
            id: button.audioRecording.id?.toString() || `grid-action-audio-${button.id}`,
            modelName: 'GridActionAudio',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            dataBase64: button.audioRecording.data.toString('base64'),
            mimeType: metadata.mimeType || 'audio/wav',
            durationMs: metadata.durationMs || 0,
            filename: button.audioRecording.identifier || `audio-${button.id}`,
          });
        }

        return {
          id: button.id,
          modelName: 'GridElement',
          modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
          width: 1,
          height: 1,
          x: calculatedX,
          y: calculatedY,
          label: { en: button.label },
          wordForms: [],
          image: {
            data: null,
            author: undefined,
            authorURL: undefined,
          },
          actions: actions,
          type: 'ELEMENT_TYPE_NORMAL',
          additionalProps: {},
          backgroundColor:
            button.style?.backgroundColor ||
            page.style?.backgroundColor ||
            defaultPageStyle.backgroundColor,
        };
      });

      // Calculate grid dimensions based on button count
      const gridWidth = 4;
      const buttonCount = page.buttons.length;
      const calculatedRows = Math.max(3, Math.ceil(buttonCount / gridWidth));
      const calculatedCols = Math.max(3, Math.min(gridWidth, buttonCount));

      return {
        id: page.id,
        modelName: 'GridData',
        modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
        label: { en: page.name },
        rowCount: calculatedRows,
        minColumnCount: calculatedCols,
        gridElements: gridElements,
      };
    });

    const grdFile: AstericsGridFile = {
      grids: grids,
      metadata: {
        colorConfig: {
          gridBackgroundColor: defaultPageStyle.backgroundColor,
          elementBackgroundColor: defaultPageStyle.backgroundColor,
          elementBorderColor: defaultPageStyle.borderColor,
          borderWidth: defaultPageStyle.borderWidth,
          fontFamily: defaultPageStyle.fontFamily,
          fontSizePct: defaultPageStyle.fontSize / 16, // Convert pixels to percentage
          fontColor: defaultPageStyle.fontColor,
          // Add additional properties that might be useful
          elementMargin: 2, // Default margin
          borderRadius: 4, // Default border radius
          colorMode: 'default',
          lineHeight: 1.2,
          maxLines: 2,
          textPosition: 'center',
          fittingMode: 'fit',
        },
      },
    };

    fs.writeFileSync(outputPath, JSON.stringify(grdFile, null, 2));
  }

  /**
   * Add audio recording to a specific grid element
   */
  addAudioToElement(
    filePath: string,
    elementId: string,
    audioData: Buffer,
    metadata?: string
  ): void {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const grdFile: AstericsGridFile = JSON.parse(content);

    // Find the element and add audio action
    let elementFound = false;
    grdFile.grids.forEach((grid: GridData) => {
      grid.gridElements.forEach((element: GridElement) => {
        if (element.id === elementId) {
          elementFound = true;

          // Remove existing audio action if present
          element.actions = element.actions.filter((a) => a.modelName !== 'GridActionAudio');

          // Add new audio action
          const audioAction: GridAction = {
            id: `grid-action-audio-${elementId}`,
            modelName: 'GridActionAudio',
            modelVersion: '{"major": 5, "minor": 0, "patch": 0}',
            dataBase64: audioData.toString('base64'),
            mimeType: 'audio/wav',
            durationMs: 0, // Could be calculated from audio data
            filename: `audio-${elementId}.wav`,
          };

          if (metadata) {
            try {
              const parsedMetadata = JSON.parse(metadata);
              audioAction.mimeType = parsedMetadata.mimeType || audioAction.mimeType;
              audioAction.durationMs = parsedMetadata.durationMs || audioAction.durationMs;
              audioAction.filename = parsedMetadata.filename || audioAction.filename;
            } catch (e) {
              // Use defaults if metadata parsing fails
            }
          }

          element.actions.push(audioAction);
        }
      });
    });

    if (!elementFound) {
      throw new Error(`Element with ID ${elementId} not found`);
    }

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(grdFile, null, 2));
  }

  /**
   * Create a copy of the grid file with audio recordings added
   */
  createAudioEnhancedGridFile(
    sourceFilePath: string,
    targetFilePath: string,
    audioMappings: Map<string, { audioData: Buffer; metadata?: string }>
  ): void {
    // Copy the source file to target
    fs.copyFileSync(sourceFilePath, targetFilePath);

    // Add audio recordings to the copy
    audioMappings.forEach((audioInfo, elementId) => {
      try {
        this.addAudioToElement(targetFilePath, elementId, audioInfo.audioData, audioInfo.metadata);
      } catch (error) {
        // Failed to add audio to element - continue with others
        console.warn(`Failed to add audio to element ${elementId}:`, error);
      }
    });
  }

  /**
   * Extract all element IDs from the grid file for audio mapping
   */
  getElementIds(filePathOrBuffer: string | Buffer): string[] {
    let content = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer.toString('utf-8')
      : fs.readFileSync(filePathOrBuffer, 'utf-8');

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const elementIds: string[] = [];

    try {
      const grdFile: AstericsGridFile = JSON.parse(content);

      grdFile.grids.forEach((grid: GridData) => {
        grid.gridElements.forEach((element: GridElement) => {
          elementIds.push(element.id);
        });
      });
    } catch (error) {
      // If JSON parsing fails, return empty array
    }

    return elementIds;
  }

  /**
   * Check if an element has audio recording
   */
  hasAudioRecording(filePathOrBuffer: string | Buffer, elementId: string): boolean {
    let content = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer.toString('utf-8')
      : fs.readFileSync(filePathOrBuffer, 'utf-8');

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    try {
      const grdFile: AstericsGridFile = JSON.parse(content);

      for (const grid of grdFile.grids) {
        for (const element of grid.gridElements) {
          if (element.id === elementId) {
            return element.actions.some((action) => action.modelName === 'GridActionAudio');
          }
        }
      }
    } catch (error) {
      // If JSON parsing fails, return false
    }

    return false;
  }

  /**
   * Extract strings with metadata for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  extractStringsWithMetadata(filePath: string): Promise<ExtractStringsResult> {
    return this.extractStringsWithMetadataGeneric(filePath);
  }

  /**
   * Generate translated download for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  generateTranslatedDownload(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[]
  ): Promise<string> {
    return this.generateTranslatedDownloadGeneric(filePath, translatedStrings, sourceStrings);
  }
}

export { AstericsGridProcessor };

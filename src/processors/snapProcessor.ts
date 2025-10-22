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
// Removed unused import: FileProcessor
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

interface SnapButton {
  Id: number;
  Label: string;
  Message: string | null;
  LibrarySymbolId?: number | null;
  PageSetImageId?: number | null;
  NavigatePageId: number | null;
  MessageRecordingId?: number | null;
  UseMessageRecording?: number | null;
  SerializedMessageSoundMetadata?: string | null;
  LabelColor?: number;
  BackgroundColor?: number;
  BorderColor?: number;
  BorderThickness?: number;
  FontSize?: number;
  FontFamily?: string;
  FontStyle?: number;
}

interface SnapPage {
  Id: number;
  Name: string;
  Buttons: SnapButton[];
  ParentId: number | null;
  BackgroundColor?: number;
}

class SnapProcessor extends BaseProcessor {
  private symbolResolver: unknown | null = null;
  private loadAudio: boolean = false;

  constructor(
    symbolResolver: unknown | null = null,
    options: ProcessorOptions & { loadAudio?: boolean } = {}
  ) {
    super(options);
    this.symbolResolver = symbolResolver;
    this.loadAudio = options.loadAudio !== undefined ? options.loadAudio : true;
  }

  extractTexts(filePathOrBuffer: string | Buffer): string[] {
    const tree = this.loadIntoTree(filePathOrBuffer);
    const texts: string[] = [];

    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      // Include page names
      if (page.name) texts.push(page.name);

      // Include button texts
      page.buttons.forEach((btn) => {
        if (btn.label) texts.push(btn.label);
        if (btn.message && btn.message !== btn.label) texts.push(btn.message);
      });
    }

    return texts;
  }

  loadIntoTree(filePathOrBuffer: string | Buffer): AACTree {
    const tree = new AACTree();
    const filePath =
      typeof filePathOrBuffer === 'string'
        ? filePathOrBuffer
        : path.join(process.cwd(), 'temp.spb');

    if (Buffer.isBuffer(filePathOrBuffer)) {
      fs.writeFileSync(filePath, filePathOrBuffer);
    }

    let db: any = null;
    try {
      db = new Database(filePath, { readonly: true });

      const getTableColumns = (tableName: string): Set<string> => {
        try {
          const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
          return new Set(rows.map((row) => row.name));
        } catch {
          return new Set();
        }
      };

      // Load pages first, using UniqueId as canonical id
      const pages = db.prepare('SELECT * FROM Page').all() as any[];
      // Map from numeric Id -> UniqueId for later lookup
      const idToUniqueId: Record<string, string> = {};
      pages.forEach((pageRow: SnapPage) => {
        const uniqueId = String((pageRow as any).UniqueId || pageRow.Id);
        idToUniqueId[String(pageRow.Id)] = uniqueId;

        const page = new AACPage({
          id: uniqueId,
          name: (pageRow as any).Title || pageRow.Name,
          grid: [],
          buttons: [],
          parentId: null, // ParentId will be set via navigation buttons below
          style: {
            backgroundColor: pageRow.BackgroundColor
              ? `#${pageRow.BackgroundColor.toString(16)}`
              : undefined,
          },
        });
        tree.addPage(page);
      });

      // Load buttons per page, using UniqueId for page id
      for (const pageRow of pages) {
        let buttons: any[] = [];

        // Create a map to track page grid layouts
        const pageGrids = new Map<string, Array<Array<AACButton | null>>>();

        try {
          const buttonColumns = getTableColumns('Button');
          const selectFields = [
            'b.Id',
            'b.Label',
            'b.Message',
            buttonColumns.has('LibrarySymbolId') ? 'b.LibrarySymbolId' : 'NULL AS LibrarySymbolId',
            buttonColumns.has('PageSetImageId') ? 'b.PageSetImageId' : 'NULL AS PageSetImageId',
            buttonColumns.has('BorderColor') ? 'b.BorderColor' : 'NULL AS BorderColor',
            buttonColumns.has('BorderThickness') ? 'b.BorderThickness' : 'NULL AS BorderThickness',
            buttonColumns.has('FontSize') ? 'b.FontSize' : 'NULL AS FontSize',
            buttonColumns.has('FontFamily') ? 'b.FontFamily' : 'NULL AS FontFamily',
            buttonColumns.has('FontStyle') ? 'b.FontStyle' : 'NULL AS FontStyle',
            buttonColumns.has('LabelColor') ? 'b.LabelColor' : 'NULL AS LabelColor',
            buttonColumns.has('BackgroundColor') ? 'b.BackgroundColor' : 'NULL AS BackgroundColor',
            buttonColumns.has('NavigatePageId') ? 'b.NavigatePageId' : 'NULL AS NavigatePageId',
          ];

          if (this.loadAudio) {
            selectFields.push(
              buttonColumns.has('MessageRecordingId')
                ? 'b.MessageRecordingId'
                : 'NULL AS MessageRecordingId'
            );
            selectFields.push(
              buttonColumns.has('UseMessageRecording')
                ? 'b.UseMessageRecording'
                : 'NULL AS UseMessageRecording'
            );
            selectFields.push(
              buttonColumns.has('SerializedMessageSoundMetadata')
                ? 'b.SerializedMessageSoundMetadata'
                : 'NULL AS SerializedMessageSoundMetadata'
            );
          }

          selectFields.push('ep.GridPosition', 'er.PageId as ButtonPageId');

          const buttonQuery = `
            SELECT ${selectFields.join(', ')}
            FROM Button b
            INNER JOIN ElementReference er ON b.ElementReferenceId = er.Id
            LEFT JOIN ElementPlacement ep ON ep.ElementReferenceId = er.Id
            WHERE er.PageId = ?
          `;
          buttons = db.prepare(buttonQuery).all(pageRow.Id);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const errorCode = err && typeof err === 'object' && 'code' in err ? (err as any).code : undefined;
          if (
            errorCode === 'SQLITE_CORRUPT' ||
            errorCode === 'SQLITE_NOTADB' ||
            /malformed/i.test(errorMessage)
          ) {
            throw new Error(`Snap database is corrupted or incomplete: ${errorMessage}`);
          }

          console.warn(
            `Failed to load buttons for page ${pageRow.Id}: ${errorMessage}`
          );
          // Skip this page instead of loading all buttons
          buttons = [];
        }

        const uniqueId = String(pageRow.UniqueId || pageRow.Id);
        const page = tree.getPage(uniqueId);
        if (!page) {
          continue;
        }

        // Initialize page grid if not exists (assume max 10x10 grid)
        if (!pageGrids.has(uniqueId)) {
          const grid: Array<Array<AACButton | null>> = [];
          for (let r = 0; r < 10; r++) {
            grid[r] = new Array(10).fill(null);
          }
          pageGrids.set(uniqueId, grid);
        }

        const pageGrid = pageGrids.get(uniqueId);
        if (!pageGrid) continue;

        buttons.forEach((btnRow) => {
          // Determine navigation target UniqueId, if possible
          let targetPageUniqueId: string | undefined = undefined;
          if (btnRow.NavigatePageId && idToUniqueId[String(btnRow.NavigatePageId)]) {
            targetPageUniqueId = idToUniqueId[String(btnRow.NavigatePageId)];
          } else if (btnRow.PageUniqueId) {
            targetPageUniqueId = String(btnRow.PageUniqueId);
          }

          // Determine parent page association for this button
          const parentPageId = btnRow.ButtonPageId ? String(btnRow.ButtonPageId) : undefined;
          const parentUniqueId =
            parentPageId && idToUniqueId[parentPageId] ? idToUniqueId[parentPageId] : uniqueId;

          // Load audio recording if requested and available
          let audioRecording;
          if (this.loadAudio && btnRow.MessageRecordingId && btnRow.MessageRecordingId > 0) {
            try {
              const recordingData = db
                .prepare(
                  `
                SELECT Id, Identifier, Data FROM PageSetData WHERE Id = ?
              `
                )
                .get(btnRow.MessageRecordingId) as
                | { Id: number; Identifier: string; Data: Buffer }
                | undefined;

              if (recordingData) {
                audioRecording = {
                  id: recordingData.Id,
                  data: recordingData.Data,
                  identifier: recordingData.Identifier,
                  metadata: btnRow.SerializedMessageSoundMetadata || undefined,
                };
              }
            } catch (e) {
              console.warn(`[SnapProcessor] Failed to load audio for button ${btnRow.Id}:`, e);
            }
          }

          // Create semantic action for Snap button
          let semanticAction: AACSemanticAction | undefined;
          let legacyAction: any = null;

          if (targetPageUniqueId) {
            semanticAction = {
              category: AACSemanticCategory.NAVIGATION,
              intent: AACSemanticIntent.NAVIGATE_TO,
              targetId: targetPageUniqueId,
              platformData: {
                snap: {
                  navigatePageId: btnRow.NavigatePageId,
                  elementReferenceId: btnRow.Id,
                },
              },
              fallback: {
                type: 'NAVIGATE',
                targetPageId: targetPageUniqueId,
              },
            };
            legacyAction = {
              type: 'NAVIGATE',
              targetPageId: targetPageUniqueId,
            };
          } else {
            semanticAction = {
              category: AACSemanticCategory.COMMUNICATION,
              intent: AACSemanticIntent.SPEAK_TEXT,
              text: btnRow.Message || btnRow.Label || '',
              platformData: {
                snap: {
                  elementReferenceId: btnRow.Id,
                },
              },
              fallback: {
                type: 'SPEAK',
                message: btnRow.Message || btnRow.Label || '',
              },
            };
          }

          const button = new AACButton({
            id: String(btnRow.Id),
            label: btnRow.Label || '',
            message: btnRow.Message || btnRow.Label || '',
            targetPageId: targetPageUniqueId,
            semanticAction: semanticAction,
            audioRecording: audioRecording,
            style: {
              backgroundColor: btnRow.BackgroundColor
                ? `#${btnRow.BackgroundColor.toString(16)}`
                : undefined,
              borderColor: btnRow.BorderColor ? `#${btnRow.BorderColor.toString(16)}` : undefined,
              borderWidth: btnRow.BorderThickness,
              fontColor: btnRow.LabelColor ? `#${btnRow.LabelColor.toString(16)}` : undefined,
              fontSize: btnRow.FontSize,
              fontFamily: btnRow.FontFamily,
              fontStyle: btnRow.FontStyle?.toString(),
            },
          });

          // Add to the intended parent page
          const parentPage = tree.getPage(parentUniqueId);
          if (parentPage) {
            parentPage.addButton(button);

            // Add button to grid layout if position data is available
            const gridPositionStr = String(btnRow.GridPosition || '');
            if (gridPositionStr && gridPositionStr.includes(',')) {
              // Parse comma-separated coordinates "x,y"
              const [xStr, yStr] = gridPositionStr.split(',');
              const gridX = parseInt(xStr, 10);
              const gridY = parseInt(yStr, 10);

              // Place button in grid if within bounds and coordinates are valid
              if (
                !isNaN(gridX) &&
                !isNaN(gridY) &&
                gridX >= 0 &&
                gridY >= 0 &&
                gridY < 10 &&
                gridX < 10 &&
                pageGrid[gridY] &&
                pageGrid[gridY][gridX] === null
              ) {
                pageGrid[gridY][gridX] = button;
              }
            }
          }

          // If this is a navigation button, update the target page's parentId
          if (targetPageUniqueId) {
            const targetPage = tree.getPage(targetPageUniqueId);
            if (targetPage) {
              targetPage.parentId = parentUniqueId;
            }
          }
        });

        // Set grid layout for the current page
        const currentPage = tree.getPage(uniqueId);
        if (currentPage && pageGrid) {
          currentPage.grid = pageGrid;
        }
      }

      return tree;
    } catch (error: any) {
      // Provide more specific error messages
      if (error.code === 'SQLITE_NOTADB') {
        throw new Error(
          `Invalid SQLite database file: ${typeof filePathOrBuffer === 'string' ? filePathOrBuffer : 'buffer'}`
        );
      } else if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePathOrBuffer}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied accessing file: ${filePathOrBuffer}`);
      } else {
        throw new Error(`Failed to load Snap file: ${error.message}`);
      }
    } finally {
      // Ensure database is closed
      if (db) {
        db.close();
      }

      // Clean up temporary file if created from buffer
      if (Buffer.isBuffer(filePathOrBuffer) && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('Failed to clean up temporary file:', e);
        }
      }
    }
  }

  processTexts(
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string
  ): Buffer {
    // Load the tree, apply translations, and save to new file
    const tree = this.loadIntoTree(filePathOrBuffer);

    // Apply translations to all text content
    Object.values(tree.pages).forEach((page) => {
      // Translate page names
      if (page.name && translations.has(page.name)) {
        page.name = translations.get(page.name)!;
      }

      // Translate button labels and messages
      page.buttons.forEach((button) => {
        if (button.label && translations.has(button.label)) {
          button.label = translations.get(button.label)!;
        }
        if (button.message && translations.has(button.message)) {
          button.message = translations.get(button.message)!;
        }
      });
    });

    // Save the translated tree and return its content
    this.saveFromTree(tree, outputPath);
    return fs.readFileSync(outputPath);
  }

  saveFromTree(tree: AACTree, outputPath: string): void {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    // Create a new SQLite database for Snap format
    const db = new Database(outputPath, { readonly: false });

    try {
      // Create basic Snap database schema (simplified)
      db.exec(`
        CREATE TABLE IF NOT EXISTS Page (
          Id INTEGER PRIMARY KEY,
          UniqueId TEXT UNIQUE,
          Title TEXT,
          Name TEXT,
          BackgroundColor INTEGER
        );

        CREATE TABLE IF NOT EXISTS Button (
          Id INTEGER PRIMARY KEY,
          Label TEXT,
          Message TEXT,
          NavigatePageId INTEGER,
          ElementReferenceId INTEGER,
          LibrarySymbolId INTEGER,
          PageSetImageId INTEGER,
          MessageRecordingId INTEGER,
          SerializedMessageSoundMetadata TEXT,
          UseMessageRecording INTEGER,
          LabelColor INTEGER,
          BackgroundColor INTEGER,
          BorderColor INTEGER,
          BorderThickness REAL,
          FontSize REAL,
          FontFamily TEXT,
          FontStyle INTEGER
        );

        CREATE TABLE IF NOT EXISTS ElementReference (
          Id INTEGER PRIMARY KEY,
          PageId INTEGER,
          FOREIGN KEY (PageId) REFERENCES Page (Id)
        );

        CREATE TABLE IF NOT EXISTS ElementPlacement (
          Id INTEGER PRIMARY KEY,
          ElementReferenceId INTEGER,
          GridPosition TEXT,
          FOREIGN KEY (ElementReferenceId) REFERENCES ElementReference (Id)
        );

        CREATE TABLE IF NOT EXISTS PageSetData (
          Id INTEGER PRIMARY KEY,
          Identifier TEXT UNIQUE,
          Data BLOB,
          RefCount INTEGER DEFAULT 1
        );
      `);

      // Insert pages
      let pageIdCounter = 1;
      let buttonIdCounter = 1;
      let elementRefIdCounter = 1;
      let placementIdCounter = 1;
      let pageSetDataIdCounter = 1;

      const pageIdMap = new Map<string, number>();
      const pageSetDataIdentifierMap = new Map<string, number>();
      const insertPageSetData = db.prepare(
        'INSERT INTO PageSetData (Id, Identifier, Data, RefCount) VALUES (?, ?, ?, ?)'
      );
      const incrementRefCount = db.prepare('UPDATE PageSetData SET RefCount = RefCount + 1 WHERE Id = ?');

      // First pass: create all pages
      Object.values(tree.pages).forEach((page) => {
        const numericPageId = pageIdCounter++;
        pageIdMap.set(page.id, numericPageId);

        const insertPage = db.prepare(
          'INSERT INTO Page (Id, UniqueId, Title, Name, BackgroundColor) VALUES (?, ?, ?, ?, ?)'
        );
        insertPage.run(
          numericPageId,
          page.id,
          page.name || '',
          page.name || '',
          page.style?.backgroundColor
            ? parseInt(page.style.backgroundColor.replace('#', ''), 16)
            : null
        );
      });

      // Second pass: create buttons with proper page references
      Object.values(tree.pages).forEach((page) => {
        const numericPageId = pageIdMap.get(page.id)!;

        page.buttons.forEach((button, index) => {
          // Find button position in grid layout
          let gridPosition = `${index % 4},${Math.floor(index / 4)}`; // Default fallback

          if (page.grid && page.grid.length > 0) {
            // Search for button in grid layout
            for (let y = 0; y < page.grid.length; y++) {
              for (let x = 0; x < page.grid[y].length; x++) {
                const gridButton = page.grid[y][x];
                if (gridButton && gridButton.id === button.id) {
                  // Convert grid coordinates to comma-separated format
                  gridPosition = `${x},${y}`;
                  break;
                }
              }
            }
          }
          const elementRefId = elementRefIdCounter++;

          // Insert ElementReference
          const insertElementRef = db.prepare(
            'INSERT INTO ElementReference (Id, PageId) VALUES (?, ?)'
          );
          insertElementRef.run(elementRefId, numericPageId);

          // Insert Button - handle semantic actions
          let navigatePageId = null;

          // Use semantic action if available
          if (button.semanticAction?.intent === AACSemanticIntent.NAVIGATE_TO) {
            const targetId = button.semanticAction.targetId || button.targetPageId;
            navigatePageId = targetId ? pageIdMap.get(targetId) || null : null;
          }

          const insertButton = db.prepare(
            'INSERT INTO Button (Id, Label, Message, NavigatePageId, ElementReferenceId, LibrarySymbolId, PageSetImageId, MessageRecordingId, SerializedMessageSoundMetadata, UseMessageRecording, LabelColor, BackgroundColor, BorderColor, BorderThickness, FontSize, FontFamily, FontStyle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          );

          const audio = button.audioRecording;
          let messageRecordingId: number | null = null;
          let serializedMetadata: string | null = null;
          let useMessageRecording = 0;

          if (audio && Buffer.isBuffer(audio.data) && audio.data.length > 0) {
            const identifier =
              audio.identifier && audio.identifier.trim().length > 0
                ? audio.identifier.trim()
                : `audio_${buttonIdCounter}`;

            let audioId = pageSetDataIdentifierMap.get(identifier);
            if (!audioId) {
              audioId = pageSetDataIdCounter++;
              insertPageSetData.run(audioId, identifier, audio.data, 1);
              pageSetDataIdentifierMap.set(identifier, audioId);
            } else {
              incrementRefCount.run(audioId);
            }

            messageRecordingId = audioId;
            serializedMetadata = audio.metadata || null;
            useMessageRecording = 1;
          }

          insertButton.run(
            buttonIdCounter++,
            button.label || '',
            button.message || button.label || '',
            navigatePageId,
            elementRefId,
            null,
            null,
            messageRecordingId,
            serializedMetadata,
            useMessageRecording,
            button.style?.fontColor ? parseInt(button.style.fontColor.replace('#', ''), 16) : null,
            button.style?.backgroundColor
              ? parseInt(button.style.backgroundColor.replace('#', ''), 16)
              : null,
            button.style?.borderColor
              ? parseInt(button.style.borderColor.replace('#', ''), 16)
              : null,
            button.style?.borderWidth,
            button.style?.fontSize,
            button.style?.fontFamily,
            button.style?.fontStyle ? parseInt(button.style.fontStyle) : null
          );

          // Insert ElementPlacement
          const insertPlacement = db.prepare(
            'INSERT INTO ElementPlacement (Id, ElementReferenceId, GridPosition) VALUES (?, ?, ?)'
          );
          insertPlacement.run(placementIdCounter++, elementRefId, gridPosition);
        });
      });
    } finally {
      db.close();
    }
  }

  /**
   * Add audio recording to a button in the database
   */
  addAudioToButton(dbPath: string, buttonId: number, audioData: Buffer, metadata?: string): number {
    const db = new Database(dbPath, { fileMustExist: true });

    try {
      // Ensure PageSetData table exists
      db.exec(`
            CREATE TABLE IF NOT EXISTS PageSetData (
                Id INTEGER PRIMARY KEY,
                Identifier TEXT UNIQUE,
                Data BLOB
            );
        `);

      // Generate SHA1 hash for the identifier
      const sha1Hash = crypto.createHash('sha1').update(audioData).digest('hex');
      const identifier = `SND:${sha1Hash}`;

      // Check if audio with this identifier already exists
      let audioId;
      const existingAudio = db
        .prepare('SELECT Id FROM PageSetData WHERE Identifier = ?')
        .get(identifier) as { Id: number } | undefined;

      if (existingAudio) {
        audioId = existingAudio.Id;
      } else {
        // Insert new audio data
        const result = db
          .prepare('INSERT INTO PageSetData (Identifier, Data) VALUES (?, ?)')
          .run(identifier, audioData);
        audioId = Number(result.lastInsertRowid);
      }

      // Update button to reference the audio
      const updateButton = db.prepare(
        'UPDATE Button SET MessageRecordingId = ?, UseMessageRecording = 1, SerializedMessageSoundMetadata = ? WHERE Id = ?'
      );
      const metadataJson = metadata ? JSON.stringify({ FileName: metadata }) : null;
      updateButton.run(audioId, metadataJson, buttonId);

      return audioId;
    } finally {
      db.close();
    }
  }

  /**
   * Create a copy of the pageset with audio recordings added
   */
  createAudioEnhancedPageset(
    sourceDbPath: string,
    targetDbPath: string,
    audioMappings: Map<number, { audioData: Buffer; metadata?: string }>
  ): void {
    // Copy the source database to target
    fs.copyFileSync(sourceDbPath, targetDbPath);

    // Add audio recordings to the copy
    audioMappings.forEach((audioInfo, buttonId) => {
      this.addAudioToButton(targetDbPath, buttonId, audioInfo.audioData, audioInfo.metadata);
    });
  }

  /**
   * Extract buttons from a specific page that need audio recordings
   */
  extractButtonsForAudio(
    dbPath: string,
    pageUniqueId: string
  ): Array<{
    id: number;
    label: string;
    message: string;
    hasAudio: boolean;
  }> {
    const db = new Database(dbPath, { readonly: true });

    try {
      // Find the page by UniqueId
      const page = db.prepare('SELECT * FROM Page WHERE UniqueId = ?').get(pageUniqueId) as
        | { Id: number }
        | undefined;
      if (!page) {
        throw new Error(`Page with UniqueId ${pageUniqueId} not found`);
      }

      // Get buttons for this page
      const buttons = db
        .prepare(
          `
        SELECT
          b.Id, b.Label, b.Message, b.MessageRecordingId, b.UseMessageRecording
        FROM Button b
        JOIN ElementReference er ON b.ElementReferenceId = er.Id
        WHERE er.PageId = ?
      `
        )
        .all(page.Id) as Array<{
        Id: number;
        Label: string;
        Message: string | null;
        MessageRecordingId: number | null;
        UseMessageRecording: number | null;
      }>;

      return buttons.map((btn) => ({
        id: btn.Id,
        label: btn.Label || '',
        message: btn.Message || btn.Label || '',
        hasAudio: !!(btn.MessageRecordingId && btn.MessageRecordingId > 0),
      }));
    } finally {
      db.close();
    }
  }

  /**
   * Extract strings with metadata for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  async extractStringsWithMetadata(filePath: string): Promise<ExtractStringsResult> {
    return this.extractStringsWithMetadataGeneric(filePath);
  }

  /**
   * Generate translated download for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  async generateTranslatedDownload(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[]
  ): Promise<string> {
    return this.generateTranslatedDownloadGeneric(filePath, translatedStrings, sourceStrings);
  }
}

export { SnapProcessor };

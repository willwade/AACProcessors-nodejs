import { BaseProcessor } from "../core/baseProcessor";
import { AACTree, AACPage, AACButton } from "../core/treeStructure";
// Removed unused import: FileProcessor
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

interface SnapButton {
  Id: number;
  Label: string;
  Message: string | null;
  LibrarySymbolId: number | null;
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
  Name:string;
  Buttons: SnapButton[];
  ParentId: number | null;
  BackgroundColor?: number;
}

class SnapProcessor extends BaseProcessor {
  private symbolResolver: unknown | null = null;
  private loadAudio: boolean = false;

  constructor(
    symbolResolver: unknown | null = null,
    options: { loadAudio?: boolean } = {},
  ) {
    super();
    this.symbolResolver = symbolResolver;
    this.loadAudio = options.loadAudio || false;
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
      typeof filePathOrBuffer === "string"
        ? filePathOrBuffer
        : path.join(process.cwd(), "temp.spb");

    if (Buffer.isBuffer(filePathOrBuffer)) {
      fs.writeFileSync(filePath, filePathOrBuffer);
    }

    let db: any = null;
    try {
      db = new Database(filePath, { readonly: true });

      // Load pages first, using UniqueId as canonical id
      const pages = db.prepare("SELECT * FROM Page").all() as any[];
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
        try {
          const buttonQuery = this.loadAudio
            ? `
            SELECT b.Id, b.Label, b.Message, b.LibrarySymbolId, b.PageSetImageId,
                   b.MessageRecordingId, b.UseMessageRecording, b.SerializedMessageSoundMetadata,
                   b.LabelColor, b.BackgroundColor, b.BorderColor, b.BorderThickness,
                   b.FontSize, b.FontFamily, b.FontStyle,
                   ep.GridPosition, bpl.PageUniqueId, b.NavigatePageId, er.PageId as ButtonPageId
            FROM Button b
            LEFT JOIN ElementReference er ON b.ElementReferenceId = er.Id
            LEFT JOIN ElementPlacement ep ON ep.ElementReferenceId = er.Id
            LEFT JOIN PageLayout pl ON ep.PageLayoutId = pl.Id
            LEFT JOIN ButtonPageLink bpl ON bpl.ButtonId = b.Id
            WHERE er.PageId = ? OR b.ElementReferenceId IN (SELECT Id FROM ElementReference WHERE PageId = ?)
          `
            : `
            SELECT b.Id, b.Label, b.Message, b.LibrarySymbolId, b.PageSetImageId,
                   b.LabelColor, b.BackgroundColor, b.BorderColor, b.BorderThickness,
                   b.FontSize, b.FontFamily, b.FontStyle,
                   ep.GridPosition, bpl.PageUniqueId, b.NavigatePageId, er.PageId as ButtonPageId
            FROM Button b
            LEFT JOIN ElementReference er ON b.ElementReferenceId = er.Id
            LEFT JOIN ElementPlacement ep ON ep.ElementReferenceId = er.Id
            LEFT JOIN PageLayout pl ON ep.PageLayoutId = pl.Id
            LEFT JOIN ButtonPageLink bpl ON bpl.ButtonId = b.Id
            WHERE er.PageId = ? OR b.ElementReferenceId IN (SELECT Id FROM ElementReference WHERE PageId = ?)
          `;
          buttons = db.prepare(buttonQuery).all(pageRow.Id, pageRow.Id);
        } catch (err) {
          try {
            // Try lowercase 'page_id'
            buttons = db
              .prepare(`SELECT * FROM Button WHERE page_id = ?`)
              .all(pageRow.Id);
          } catch (e1) {
            try {
              // Try uppercase 'PageId'
              buttons = db
                .prepare(`SELECT * FROM Button WHERE PageId = ?`)
                .all(pageRow.Id);
            } catch (e2) {
              // Fallback: select all buttons
              buttons = db.prepare(`SELECT * FROM Button`).all();
            }
          }
        }

        const uniqueId = String(pageRow.UniqueId || pageRow.Id);
        const page = tree.getPage(uniqueId);
        if (!page) {
          continue;
        }

        buttons.forEach((btnRow) => {
          // Determine navigation target UniqueId, if possible
          let targetPageUniqueId: string | undefined = undefined;
          if (
            btnRow.NavigatePageId &&
            idToUniqueId[String(btnRow.NavigatePageId)]
          ) {
            targetPageUniqueId = idToUniqueId[String(btnRow.NavigatePageId)];
          } else if (btnRow.PageUniqueId) {
            targetPageUniqueId = String(btnRow.PageUniqueId);
          }

          // Determine parent page association for this button
          const parentPageId = btnRow.ButtonPageId
            ? String(btnRow.ButtonPageId)
            : undefined;
          const parentUniqueId =
            parentPageId && idToUniqueId[parentPageId]
              ? idToUniqueId[parentPageId]
              : uniqueId;

          // Load audio recording if requested and available
          let audioRecording;
          if (
            this.loadAudio &&
            btnRow.MessageRecordingId &&
            btnRow.MessageRecordingId > 0
          ) {
            try {
              const recordingData = db
                .prepare(
                  `
                SELECT Id, Identifier, Data FROM PageSetData WHERE Id = ?
              `,
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
              console.warn(
                `[SnapProcessor] Failed to load audio for button ${btnRow.Id}:`,
                e,
              );
            }
          }

          const button = new AACButton({
            id: String(btnRow.Id),
            label: btnRow.Label || "",
            message: btnRow.Message || btnRow.Label || "",
            type: targetPageUniqueId ? "NAVIGATE" : "SPEAK",
            targetPageId: targetPageUniqueId,
            action: targetPageUniqueId
              ? {
                  type: "NAVIGATE",
                  targetPageId: targetPageUniqueId,
                }
              : null,
            audioRecording: audioRecording,
            style: {
              backgroundColor: btnRow.BackgroundColor
                ? `#${btnRow.BackgroundColor.toString(16)}`
                : undefined,
              borderColor: btnRow.BorderColor
                ? `#${btnRow.BorderColor.toString(16)}`
                : undefined,
              borderWidth: btnRow.BorderThickness,
              fontColor: btnRow.LabelColor
                ? `#${btnRow.LabelColor.toString(16)}`
                : undefined,
              fontSize: btnRow.FontSize,
              fontFamily: btnRow.FontFamily,
              fontStyle: btnRow.FontStyle?.toString(),
            },
          });

          // Add to the intended parent page
          const parentPage = tree.getPage(parentUniqueId);
          if (parentPage) {
            parentPage.addButton(button);
          } else {
          }

          // If this is a navigation button, update the target page's parentId
          if (targetPageUniqueId) {
            const targetPage = tree.getPage(targetPageUniqueId);
            if (targetPage) {
              targetPage.parentId = parentUniqueId;
            }
          }
        });
      }

      return tree;
    } catch (error: any) {
      // Provide more specific error messages
      if (error.code === "SQLITE_NOTADB") {
        throw new Error(
          `Invalid SQLite database file: ${typeof filePathOrBuffer === "string" ? filePathOrBuffer : "buffer"}`,
        );
      } else if (error.code === "ENOENT") {
        throw new Error(`File not found: ${filePathOrBuffer}`);
      } else if (error.code === "EACCES") {
        throw new Error(
          `Permission denied accessing file: ${filePathOrBuffer}`,
        );
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
          console.warn("Failed to clean up temporary file:", e);
        }
      }
    }
  }

  processTexts(
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string,
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
          GridPosition INTEGER,
          FOREIGN KEY (ElementReferenceId) REFERENCES ElementReference (Id)
        );
      `);

      // Insert pages
      let pageIdCounter = 1;
      let buttonIdCounter = 1;
      let elementRefIdCounter = 1;

      const pageIdMap = new Map<string, number>();

      // First pass: create all pages
      Object.values(tree.pages).forEach((page) => {
        const numericPageId = pageIdCounter++;
        pageIdMap.set(page.id, numericPageId);

        const insertPage = db.prepare(
          "INSERT INTO Page (Id, UniqueId, Title, Name, BackgroundColor) VALUES (?, ?, ?, ?, ?)",
        );
        insertPage.run(
          numericPageId,
          page.id,
          page.name || "",
          page.name || "",
          page.style?.backgroundColor
            ? parseInt(page.style.backgroundColor.replace("#", ""), 16)
            : null,
        );
      });

      // Second pass: create buttons with proper page references
      Object.values(tree.pages).forEach((page) => {
        const numericPageId = pageIdMap.get(page.id)!;

        page.buttons.forEach((button, index) => {
          const elementRefId = elementRefIdCounter++;

          // Insert ElementReference
          const insertElementRef = db.prepare(
            "INSERT INTO ElementReference (Id, PageId) VALUES (?, ?)",
          );
          insertElementRef.run(elementRefId, numericPageId);

          // Insert Button
          const navigatePageId =
            button.type === "NAVIGATE" && button.targetPageId
              ? pageIdMap.get(button.targetPageId) || null
              : null;

          const insertButton = db.prepare(
            "INSERT INTO Button (Id, Label, Message, NavigatePageId, ElementReferenceId, LabelColor, BackgroundColor, BorderColor, BorderThickness, FontSize, FontFamily, FontStyle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          );
          insertButton.run(
            buttonIdCounter++,
            button.label || "",
            button.message || button.label || "",
            navigatePageId,
            elementRefId,
            button.style?.fontColor
              ? parseInt(button.style.fontColor.replace("#", ""), 16)
              : null,
            button.style?.backgroundColor
              ? parseInt(button.style.backgroundColor.replace("#", ""), 16)
              : null,
            button.style?.borderColor
              ? parseInt(button.style.borderColor.replace("#", ""), 16)
              : null,
            button.style?.borderWidth,
            button.style?.fontSize,
            button.style?.fontFamily,
            button.style?.fontStyle
              ? parseInt(button.style.fontStyle)
              : null,
          );

          // Insert ElementPlacement
          const insertPlacement = db.prepare(
            "INSERT INTO ElementPlacement (Id, ElementReferenceId, GridPosition) VALUES (?, ?, ?)",
          );
          insertPlacement.run(elementRefIdCounter++, elementRefId, index);
        });
      });
    } finally {
      db.close();
    }
  }

  /**
   * Add audio recording to a button in the database
   */
  addAudioToButton(
    dbPath: string,
    buttonId: number,
    audioData: Buffer,
    metadata?: string,
  ): number {
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
      const sha1Hash = crypto
        .createHash("sha1")
        .update(audioData)
        .digest("hex");
      const identifier = `SND:${sha1Hash}`;

      // Check if audio with this identifier already exists
      let audioId;
      const existingAudio = db
        .prepare("SELECT Id FROM PageSetData WHERE Identifier = ?")
        .get(identifier) as { Id: number } | undefined;

      if (existingAudio) {
        audioId = existingAudio.Id;
      } else {
        // Insert new audio data
        const result = db
          .prepare("INSERT INTO PageSetData (Identifier, Data) VALUES (?, ?)")
          .run(identifier, audioData);
        audioId = Number(result.lastInsertRowid);
      }

      // Update button to reference the audio
      const updateButton = db.prepare(
        "UPDATE Button SET MessageRecordingId = ?, UseMessageRecording = 1, SerializedMessageSoundMetadata = ? WHERE Id = ?",
      );
      const metadataJson = metadata
        ? JSON.stringify({ FileName: metadata })
        : null;
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
    audioMappings: Map<number, { audioData: Buffer; metadata?: string }>,
  ): void {
    // Copy the source database to target
    fs.copyFileSync(sourceDbPath, targetDbPath);

    // Add audio recordings to the copy
    audioMappings.forEach((audioInfo, buttonId) => {
      this.addAudioToButton(
        targetDbPath,
        buttonId,
        audioInfo.audioData,
        audioInfo.metadata,
      );
    });
  }

  /**
   * Extract buttons from a specific page that need audio recordings
   */
  extractButtonsForAudio(
    dbPath: string,
    pageUniqueId: string,
  ): Array<{
    id: number;
    label: string;
    message: string;
    hasAudio: boolean;
  }> {
    const db = new Database(dbPath, { readonly: true });

    try {
      // Find the page by UniqueId
      const page = db
        .prepare("SELECT * FROM Page WHERE UniqueId = ?")
        .get(pageUniqueId) as { Id: number } | undefined;
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
      `,
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
        label: btn.Label || "",
        message: btn.Message || btn.Label || "",
        hasAudio: !!(btn.MessageRecordingId && btn.MessageRecordingId > 0),
      }));
    } finally {
      db.close();
    }
  }
}

export { SnapProcessor };

import { BaseProcessor } from '../core/baseProcessor';
import { AACTree, AACPage, AACButton } from '../core/treeStructure';
// Removed unused import: FileProcessor
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

interface SnapButton {
  Id: number;
  Label: string;
  Message: string | null;
  LibrarySymbolId: number | null;
  NavigatePageId: number | null;
  MessageRecordingId?: number | null;
  UseMessageRecording?: number | null;
  SerializedMessageSoundMetadata?: string | null;
}

interface SnapPage {
  Id: number;
  Name: string;
  Buttons: SnapButton[];
  ParentId: number | null;
}

class SnapProcessor extends BaseProcessor {
  private symbolResolver: unknown | null = null;
  private loadAudio: boolean = false;

  constructor(symbolResolver = null, options: { loadAudio?: boolean } = {}) {
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
    console.error('[SnapProcessor] ENTER loadIntoTree', filePathOrBuffer);
    const tree = new AACTree();
    const filePath =
      typeof filePathOrBuffer === 'string'
        ? filePathOrBuffer
        : path.join(process.cwd(), 'temp.spb');

    if (Buffer.isBuffer(filePathOrBuffer)) {
      fs.writeFileSync(filePath, filePathOrBuffer);
    }

    try {
      const db = new Database(filePath, { readonly: true });

      // Load pages first, using UniqueId as canonical id
      const pages = db.prepare('SELECT * FROM Page').all() as any[];
      // Map from numeric Id -> UniqueId for later lookup
      const idToUniqueId: Record<string, string> = {};
      pages.forEach((pageRow) => {
        const uniqueId = String(pageRow.UniqueId || pageRow.Id);
        idToUniqueId[String(pageRow.Id)] = uniqueId;
        console.error(`[SnapProcessor] Page: numeric Id=${pageRow.Id}, UniqueId=${uniqueId}, Title=${pageRow.Title || pageRow.Name}`);
        const page = new AACPage({
          id: uniqueId,
          name: pageRow.Title || pageRow.Name,
          grid: [],
          buttons: [],
          parentId: null, // ParentId will be set via navigation buttons below
        });
        tree.addPage(page);
      });

      // Load buttons per page, using UniqueId for page id
      for (const pageRow of pages) {
        let buttons: any[] = [];
        try {
          const buttonQuery = this.loadAudio ? `
            SELECT b.Id, b.Label, b.Message, b.LibrarySymbolId, b.PageSetImageId,
                   b.MessageRecordingId, b.UseMessageRecording, b.SerializedMessageSoundMetadata,
                   ep.GridPosition, bpl.PageUniqueId, b.NavigatePageId, er.PageId as ButtonPageId
            FROM Button b
            LEFT JOIN ElementReference er ON b.ElementReferenceId = er.Id
            LEFT JOIN ElementPlacement ep ON ep.ElementReferenceId = er.Id
            LEFT JOIN PageLayout pl ON ep.PageLayoutId = pl.Id
            LEFT JOIN ButtonPageLink bpl ON bpl.ButtonId = b.Id
            WHERE er.PageId = ? OR b.ElementReferenceId IN (SELECT Id FROM ElementReference WHERE PageId = ?)
          ` : `
            SELECT b.Id, b.Label, b.Message, b.LibrarySymbolId, b.PageSetImageId,
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
            buttons = db.prepare(`SELECT * FROM Button WHERE page_id = ?`).all(pageRow.Id);
          } catch (e1) {
            try {
              // Try uppercase 'PageId'
              buttons = db.prepare(`SELECT * FROM Button WHERE PageId = ?`).all(pageRow.Id);
            } catch (e2) {
              // Fallback: select all buttons
              buttons = db.prepare(`SELECT * FROM Button`).all();
            }
          }
        }

        const uniqueId = String(pageRow.UniqueId || pageRow.Id);
        const page = tree.getPage(uniqueId);
        if (!page) {
          console.error(`[SnapProcessor] No page found for UniqueId=${uniqueId} (original pageRow.Id=${pageRow.Id})`);
          continue;
        }

        buttons.forEach((btnRow) => {
          // Determine navigation target UniqueId, if possible
          let targetPageUniqueId: string | undefined = undefined;
          if (btnRow.NavigatePageId && idToUniqueId[String(btnRow.NavigatePageId)]) {
            targetPageUniqueId = idToUniqueId[String(btnRow.NavigatePageId)];
          } else if (btnRow.PageUniqueId) {
            targetPageUniqueId = String(btnRow.PageUniqueId);
          }

          // Determine parent page association for this button
          let parentPageId = btnRow.ButtonPageId ? String(btnRow.ButtonPageId) : undefined;
          let parentUniqueId = parentPageId && idToUniqueId[parentPageId] ? idToUniqueId[parentPageId] : uniqueId;
          console.error(`[SnapProcessor] Button: Id=${btnRow.Id}, Label=${btnRow.Label}, ButtonPageId=${parentPageId}, AssociatedPageUniqueId=${parentUniqueId}`);

          // Load audio recording if requested and available
          let audioRecording;
          if (this.loadAudio && btnRow.MessageRecordingId && btnRow.MessageRecordingId > 0) {
            try {
              const recordingData = db.prepare(`
                SELECT Id, Identifier, Data FROM PageSetData WHERE Id = ?
              `).get(btnRow.MessageRecordingId) as { Id: number; Identifier: string; Data: Buffer } | undefined;

              if (recordingData) {
                audioRecording = {
                  id: recordingData.Id,
                  data: recordingData.Data,
                  identifier: recordingData.Identifier,
                  metadata: btnRow.SerializedMessageSoundMetadata || undefined
                };
              }
            } catch (e) {
              console.warn(`[SnapProcessor] Failed to load audio for button ${btnRow.Id}:`, e);
            }
          }

          const button = new AACButton({
            id: String(btnRow.Id),
            label: btnRow.Label || '',
            message: btnRow.Message || btnRow.Label || '',
            type: targetPageUniqueId ? 'NAVIGATE' : 'SPEAK',
            targetPageId: targetPageUniqueId,
            action: targetPageUniqueId
              ? {
                  type: 'NAVIGATE',
                  targetPageId: targetPageUniqueId,
                }
              : null,
            audioRecording: audioRecording,
          });

          // Add to the intended parent page
          const parentPage = tree.getPage(parentUniqueId);
          if (parentPage) {
            parentPage.addButton(button);
          } else {
            console.error(`[SnapProcessor] Could not associate button Id=${btnRow.Id} with page UniqueId=${parentUniqueId}`);
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

      db.close();
      return tree;
    } finally {
      if (Buffer.isBuffer(filePathOrBuffer)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to clean up temporary file:', e);
        }
      }
    }
  }

  processTexts(
    _filePathOrBuffer: string | Buffer,
    _translations: Map<string, string>,
    _outputPath: string
  ): Buffer {
    throw new Error('Snap processTexts not implemented');
  }

  saveFromTree(_tree: AACTree, _outputPath: string): void {
    throw new Error('Snap saveFromTree not implemented');
  }

  /**
   * Add audio recording to a button in the database
   */
  addAudioToButton(
    dbPath: string,
    buttonId: number,
    audioData: Buffer,
    metadata?: string
  ): number {
    const db = new Database(dbPath, { readonly: false });

    try {
      // Generate SHA1 hash for the identifier
      const sha1Hash = crypto.createHash('sha1').update(audioData).digest('base64');
      const identifier = `SND:${sha1Hash}`;

      // Check if audio with this identifier already exists
      let audioId;
      const existingAudio = db.prepare(`
        SELECT Id FROM PageSetData WHERE Identifier = ?
      `).get(identifier) as { Id: number } | undefined;

      if (existingAudio) {
        audioId = existingAudio.Id;
      } else {
        // Insert new audio data
        const insertAudio = db.prepare(`
          INSERT INTO PageSetData (Identifier, Data) VALUES (?, ?)
        `);
        const result = insertAudio.run(identifier, audioData);
        audioId = result.lastInsertRowid as number;
      }

      // Update button to reference the audio
      const updateButton = db.prepare(`
        UPDATE Button
        SET MessageRecordingId = ?,
            UseMessageRecording = 1,
            SerializedMessageSoundMetadata = ?
        WHERE Id = ?
      `);

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
      try {
        this.addAudioToButton(
          targetDbPath,
          buttonId,
          audioInfo.audioData,
          audioInfo.metadata
        );
      } catch (error) {
        console.error(`Failed to add audio to button ${buttonId}:`, error);
      }
    });
  }

  /**
   * Extract buttons from a specific page that need audio recordings
   */
  extractButtonsForAudio(dbPath: string, pageUniqueId: string): Array<{
    id: number;
    label: string;
    message: string;
    hasAudio: boolean;
  }> {
    const db = new Database(dbPath, { readonly: true });

    try {
      // Find the page by UniqueId
      const page = db.prepare('SELECT * FROM Page WHERE UniqueId = ?').get(pageUniqueId) as { Id: number } | undefined;
      if (!page) {
        throw new Error(`Page with UniqueId ${pageUniqueId} not found`);
      }

      // Get buttons for this page
      const buttons = db.prepare(`
        SELECT
          b.Id, b.Label, b.Message, b.MessageRecordingId, b.UseMessageRecording
        FROM Button b
        JOIN ElementReference er ON b.ElementReferenceId = er.Id
        WHERE er.PageId = ?
      `).all(page.Id) as Array<{
        Id: number;
        Label: string;
        Message: string | null;
        MessageRecordingId: number | null;
        UseMessageRecording: number | null;
      }>;

      return buttons.map(btn => ({
        id: btn.Id,
        label: btn.Label || '',
        message: btn.Message || btn.Label || '',
        hasAudio: !!(btn.MessageRecordingId && btn.MessageRecordingId > 0)
      }));

    } finally {
      db.close();
    }
  }
}

export { SnapProcessor };

import { BaseProcessor } from '../core/baseProcessor';
import { AACTree, AACPage, AACButton } from '../core/treeStructure';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

interface TouchChatButton {
  id: number;
  resource_id: number;
  label: string | null;
  message: string | null;
  symbol_link_id: number | null;
  visible: number;
  button_style_id: number;
  pronunciation: string | null;
  skin_tone_override: number | null;
}

interface TouchChatPage {
  id: number;
  resource_id: number;
  name: string;
  symbol_link_id: number | null;
  page_style_id: number;
  button_style_id: number;
  feature: number | null;
}

class TouchChatProcessor extends BaseProcessor {
  private tree: AACTree | null = null;
  private sourceFile: string | Buffer | null = null;

  extractTexts(filePathOrBuffer: string | Buffer): string[] {
    // Extracts all button labels/texts from TouchChat .ce file
    if (!this.tree && filePathOrBuffer) {
      this.tree = this.loadIntoTree(filePathOrBuffer);
    }
    if (!this.tree) {
      throw new Error('No tree available - call loadIntoTree first');
    }
    const texts: string[] = [];
    for (const pageId in this.tree.pages) {
      const page = this.tree.pages[pageId];
      page.buttons.forEach((btn) => {
        if (btn.label) texts.push(btn.label);
        if (btn.message && btn.message !== btn.label) texts.push(btn.message);
      });
    }
    return texts;
  }

  loadIntoTree(filePathOrBuffer: string | Buffer): AACTree {
    // Unzip .ce file, extract the .c4v SQLite DB, and parse pages/buttons
    let tmpDir: string | null = null;
    let db: Database.Database | null = null;

    try {
      // Store source file path or buffer
      this.sourceFile = filePathOrBuffer;

      // Step 1: Unzip
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'touchchat-'));
      const zip = new AdmZip(
        typeof filePathOrBuffer === 'string' ? filePathOrBuffer : Buffer.from(filePathOrBuffer)
      );
      zip.extractAllTo(tmpDir, true);

      // Step 2: Find and open SQLite DB
      const files = fs.readdirSync(tmpDir);
      console.log('Files in CE archive:', files);
      const vocabFile = files.find((f) => f.endsWith('.c4v'));
      if (!vocabFile) {
        throw new Error('No .c4v vocab DB found in TouchChat export');
      }

      const dbPath = path.join(tmpDir, vocabFile);
      db = new Database(dbPath, { readonly: true });

      // Step 3: Create tree and load pages
      const tree = new AACTree();

      // First, load all pages and get their names from resources
      const pageQuery = `
        SELECT p.*, r.name
        FROM pages p
        JOIN resources r ON r.id = p.resource_id
      `;
      const pages = db.prepare(pageQuery).all() as (TouchChatPage & { name: string })[];
      pages.forEach((pageRow) => {
        const page = new AACPage({
          id: String(pageRow.id),
          name: pageRow.name || '',
          grid: [],
          buttons: [],
          parentId: null,
        });
        tree.addPage(page);
      });

      // Load button boxes and their cells
      const buttonBoxQuery = `
        SELECT bbc.*, b.*, bb.id as box_id 
        FROM button_box_cells bbc
        JOIN buttons b ON b.resource_id = bbc.resource_id
        JOIN button_boxes bb ON bb.id = bbc.button_box_id
      `;
      try {
        const buttonBoxCells = db.prepare(buttonBoxQuery).all() as (TouchChatButton & {
          box_id: number;
        })[];
        const buttonBoxes = new Map<
          number,
          Array<{
            button: AACButton;
            location: number;
            spanX: number;
            spanY: number;
          }>
        >();

        buttonBoxCells.forEach((cell) => {
          if (!buttonBoxes.has(cell.box_id)) {
            buttonBoxes.set(cell.box_id, []);
          }
          const button = new AACButton({
            id: String(cell.id),
            label: cell.label || '',
            message: cell.message || '',
            type: 'SPEAK',
            action: null,
          });
          buttonBoxes.get(cell.box_id)?.push({
            button,
            location: (cell as any).location,
            spanX: (cell as any).span_x,
            spanY: (cell as any).span_y,
          });
        });

        // Map button boxes to pages
        const boxInstances = db.prepare('SELECT * FROM button_box_instances').all() as {
          id: number;
          page_id: number;
          button_box_id: number;
          position_x: number;
          position_y: number;
          size_x: number;
          size_y: number;
        }[];

        boxInstances.forEach((instance) => {
          const page = tree.getPage(String(instance.page_id));
          const buttons = buttonBoxes.get(instance.button_box_id);
          if (page && buttons) {
            buttons.forEach(({ button }) => {
              page.addButton(button);
            });
          }
        });
      } catch (e) {
        console.log('No button box cells found:', e);
      }

      // Load buttons directly linked to pages via resources
      const pageButtonsQuery = `
        SELECT b.*, r.*
        FROM buttons b
        JOIN resources r ON r.id = b.resource_id
        WHERE r.type = 7
      `;
      try {
        const pageButtons = db.prepare(pageButtonsQuery).all() as (TouchChatButton & {
          type: number;
        })[];
        pageButtons.forEach((btnRow) => {
          const button = new AACButton({
            id: String(btnRow.id),
            label: btnRow.label || '',
            message: btnRow.message || '',
            type: 'SPEAK',
            action: null,
          });
          // Find the page that references this resource
          const page = Object.values(tree.pages).find((p) => p.id === String(btnRow.id));
          if (page) page.addButton(button);
        });
      } catch (e) {
        console.log('No direct page buttons found:', e);
      }

      // Load navigation actions
      const navActionsQuery = `
        SELECT b.id as button_id, ad.value as target_page_id
        FROM buttons b
        JOIN actions a ON a.resource_id = b.resource_id
        JOIN action_data ad ON ad.action_id = a.id
        WHERE a.code = 1
      `;
      try {
        const navActions = db.prepare(navActionsQuery).all() as {
          button_id: number;
          target_page_id: string;
        }[];
        navActions.forEach((nav) => {
          // Find button in any page
          for (const pageId in tree.pages) {
            const page = tree.pages[pageId];
            const button = page.buttons.find((b) => b.id === String(nav.button_id));
            if (button) {
              button.type = 'NAVIGATE';
              button.targetPageId = String(nav.target_page_id);
              break;
            }
          }
        });
      } catch (e) {
        console.log('No navigation actions found:', e);
      }

      return tree;
    } finally {
      // Clean up
      if (db) db.close();
      if (tmpDir) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) {
          console.warn('Failed to clean up temp directory:', e);
        }
      }
    }
  }

  processTexts(
    _filePathOrBuffer: string | Buffer,
    _translations: Map<string, string>,
    _outputPath: string
  ): Buffer {
    throw new Error('TouchChat processTexts not implemented');
  }

  saveFromTree(_tree: AACTree, _outputPath: string): void {
    throw new Error('TouchChat saveFromTree not implemented');
  }
}

export { TouchChatProcessor };

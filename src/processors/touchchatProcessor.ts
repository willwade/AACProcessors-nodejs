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

function intToHex(colorInt: number | null | undefined): string | undefined {
  if (colorInt === null || typeof colorInt === 'undefined') {
    return undefined;
  }
  // Assuming the color is in ARGB format, we mask out the alpha channel
  return `#${(colorInt & 0x00ffffff).toString(16).padStart(6, '0')}`;
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
      const vocabFile = files.find((f) => f.endsWith('.c4v'));
      if (!vocabFile) {
        throw new Error('No .c4v vocab DB found in TouchChat export');
      }

      const dbPath = path.join(tmpDir, vocabFile);
      db = new Database(dbPath, { readonly: true });

      // Step 3: Create tree and load pages
      const tree = new AACTree();

      // Set root ID to the first page ID (will be updated if we find a better root)
      let rootPageId: string | null = null;

      // Load ID mappings first
      const idMappings = new Map<number, string>();
      try {
        const mappingQuery = 'SELECT numeric_id, string_id FROM page_id_mapping';
        const mappings = db.prepare(mappingQuery).all() as {
          numeric_id: number;
          string_id: string;
        }[];
        mappings.forEach((mapping) => {
          idMappings.set(mapping.numeric_id, mapping.string_id);
        });
      } catch (e) {
        // No mapping table, use numeric IDs as strings
      }

      // Load styles
      const buttonStyles = new Map();
      const pageStyles = new Map();
      try {
        const buttonStyleRows = db.prepare('SELECT * FROM button_styles').all();
        buttonStyleRows.forEach((style: any) => {
          buttonStyles.set(style.id, style);
        });
        const pageStyleRows = db.prepare('SELECT * FROM page_styles').all();
        pageStyleRows.forEach((style: any) => {
          pageStyles.set(style.id, style);
        });
      } catch (e) {
        // console.log('No styles found:', e);
      }

      // First, load all pages and get their names from resources
      const pageQuery = `
        SELECT p.*, r.name
        FROM pages p
        JOIN resources r ON r.id = p.resource_id
      `;
      const pages = db.prepare(pageQuery).all() as (TouchChatPage & {
        name: string;
      })[];
      pages.forEach((pageRow) => {
        // Use mapped string ID if available, otherwise use numeric ID as string
        const pageId = idMappings.get(pageRow.id) || String(pageRow.id);
        const style = pageStyles.get(pageRow.page_style_id);

        const page = new AACPage({
          id: pageId,
          name: pageRow.name || '',
          grid: [],
          buttons: [],
          parentId: null,
          style: {
            backgroundColor: intToHex(style?.bg_color),
          },
        });
        tree.addPage(page);

        // Set the first page as root if no root is set
        if (!rootPageId) {
          rootPageId = pageId;
        }
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
          const style = buttonStyles.get(cell.button_style_id);
          const button = new AACButton({
            id: String(cell.id),
            label: cell.label || '',
            message: cell.message || '',
            type: 'SPEAK',
            action: null,
            style: {
              backgroundColor: intToHex(style?.body_color),
              borderColor: intToHex(style?.border_color),
              borderWidth: style?.border_width,
              fontColor: intToHex(style?.font_color),
              fontSize: style?.font_height,
              fontFamily: style?.font_name,
              fontWeight: style?.font_bold ? 'bold' : 'normal',
              fontStyle: style?.font_italic ? 'italic' : 'normal',
              textUnderline: style?.font_underline,
              transparent: style?.transparent,
              labelOnTop: style?.label_on_top,
            },
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
          // Use mapped string ID if available, otherwise use numeric ID as string
          const pageId = idMappings.get(instance.page_id) || String(instance.page_id);
          const page = tree.getPage(pageId);
          const buttons = buttonBoxes.get(instance.button_box_id);
          if (page && buttons) {
            buttons.forEach(({ button }) => {
              page.addButton(button);
            });
          }
        });
      } catch (e) {
        // console.log('No button box cells found:', e);
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
          const style = buttonStyles.get(btnRow.button_style_id);
          const button = new AACButton({
            id: String(btnRow.id),
            label: btnRow.label || '',
            message: btnRow.message || '',
            type: 'SPEAK',
            action: null,
            style: {
              backgroundColor: intToHex(style?.body_color),
              borderColor: intToHex(style?.border_color),
              borderWidth: style?.border_width,
              fontColor: intToHex(style?.font_color),
              fontSize: style?.font_height,
              fontFamily: style?.font_name,
              fontWeight: style?.font_bold ? 'bold' : 'normal',
              fontStyle: style?.font_italic ? 'italic' : 'normal',
              textUnderline: style?.font_underline,
              transparent: style?.transparent,
              labelOnTop: style?.label_on_top,
            },
          });
          // Find the page that references this resource
          const page = Object.values(tree.pages).find((p) => p.id === String(btnRow.id));
          if (page) page.addButton(button);
        });
      } catch (e) {
        // console.log('No direct page buttons found:', e);
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
              // Use mapped string ID for target page if available
              const targetPageId =
                idMappings.get(parseInt(nav.target_page_id)) || nav.target_page_id;
              button.targetPageId = String(targetPageId);
              break;
            }
          }
        });
      } catch (e) {
        // console.log('No navigation actions found:', e);
      }

      // Try to load root ID from metadata, fallback to first page
      try {
        const metadataQuery = "SELECT value FROM tree_metadata WHERE key = 'rootId'";
        const rootIdRow = db.prepare(metadataQuery).get() as { value: string } | undefined;
        if (rootIdRow && tree.getPage(rootIdRow.value)) {
          tree.rootId = rootIdRow.value;
        } else if (rootPageId) {
          tree.rootId = rootPageId;
        }
      } catch (e) {
        // No metadata table, use first page as root
        if (rootPageId) {
          tree.rootId = rootPageId;
        }
      }

      return tree;
    } finally {
      // Clean up
      if (db) {
        db.close();
      }
      if (tmpDir && fs.existsSync(tmpDir)) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) {
          console.warn('Failed to clean up temp directory:', e);
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
    // Create a TouchChat database that matches the expected schema for loading
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'touchchat-export-'));
    const dbPath = path.join(tmpDir, 'vocab.c4v');

    try {
      const db = new Database(dbPath);

      // Create schema that matches what loadIntoTree expects
      db.exec(`
        CREATE TABLE IF NOT EXISTS resources (
          id INTEGER PRIMARY KEY,
          name TEXT,
          type INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS pages (
          id INTEGER PRIMARY KEY,
          resource_id INTEGER,
          name TEXT,
          symbol_link_id INTEGER,
          page_style_id INTEGER DEFAULT 1,
          button_style_id INTEGER DEFAULT 1,
          feature INTEGER,
          FOREIGN KEY (resource_id) REFERENCES resources (id)
        );

        CREATE TABLE IF NOT EXISTS buttons (
          id INTEGER PRIMARY KEY,
          resource_id INTEGER,
          label TEXT,
          message TEXT,
          symbol_link_id INTEGER,
          visible INTEGER DEFAULT 1,
          button_style_id INTEGER DEFAULT 1,
          pronunciation TEXT,
          skin_tone_override INTEGER,
          FOREIGN KEY (resource_id) REFERENCES resources (id)
        );

        CREATE TABLE IF NOT EXISTS button_boxes (
          id INTEGER PRIMARY KEY
        );

        CREATE TABLE IF NOT EXISTS button_box_cells (
          id INTEGER PRIMARY KEY,
          button_box_id INTEGER,
          resource_id INTEGER,
          location INTEGER,
          span_x INTEGER DEFAULT 1,
          span_y INTEGER DEFAULT 1,
          button_style_id INTEGER DEFAULT 1,
          label TEXT,
          message TEXT,
          box_id INTEGER,
          FOREIGN KEY (button_box_id) REFERENCES button_boxes (id),
          FOREIGN KEY (resource_id) REFERENCES resources (id),
          FOREIGN KEY (button_style_id) REFERENCES button_styles (id)
        );

        CREATE TABLE IF NOT EXISTS button_box_instances (
          id INTEGER PRIMARY KEY,
          page_id INTEGER,
          button_box_id INTEGER,
          position_x INTEGER DEFAULT 0,
          position_y INTEGER DEFAULT 0,
          size_x INTEGER DEFAULT 1,
          size_y INTEGER DEFAULT 1,
          FOREIGN KEY (page_id) REFERENCES pages (id),
          FOREIGN KEY (button_box_id) REFERENCES button_boxes (id)
        );

        CREATE TABLE IF NOT EXISTS actions (
          id INTEGER PRIMARY KEY,
          resource_id INTEGER,
          code INTEGER,
          FOREIGN KEY (resource_id) REFERENCES resources (id)
        );

        CREATE TABLE IF NOT EXISTS action_data (
          id INTEGER PRIMARY KEY,
          action_id INTEGER,
          value TEXT,
          FOREIGN KEY (action_id) REFERENCES actions (id)
        );

        CREATE TABLE IF NOT EXISTS tree_metadata (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS page_id_mapping (
          numeric_id INTEGER PRIMARY KEY,
          string_id TEXT UNIQUE
        );

        CREATE TABLE IF NOT EXISTS button_styles (
          id INTEGER PRIMARY KEY,
          label_on_top INTEGER DEFAULT 0,
          force_label_on_top INTEGER DEFAULT 0,
          transparent INTEGER DEFAULT 0,
          force_transparent INTEGER DEFAULT 0,
          font_color INTEGER,
          force_font_color INTEGER DEFAULT 0,
          body_color INTEGER,
          force_body_color INTEGER DEFAULT 0,
          border_color INTEGER,
          force_border_color INTEGER DEFAULT 0,
          border_width REAL,
          force_border_width INTEGER DEFAULT 0,
          font_name TEXT,
          font_bold INTEGER DEFAULT 0,
          font_underline INTEGER DEFAULT 0,
          font_italic INTEGER DEFAULT 0,
          font_height REAL,
          force_font INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS page_styles (
          id INTEGER PRIMARY KEY,
          bg_color INTEGER,
          force_bg_color INTEGER DEFAULT 0,
          bg_alignment INTEGER DEFAULT 0,
          force_bg_alignment INTEGER DEFAULT 0
        );
      `);

      // Insert default styles
      db.prepare('INSERT INTO button_styles (id) VALUES (1)').run();
      db.prepare('INSERT INTO page_styles (id) VALUES (1)').run();

      // Helper function to convert hex color to integer
      const hexToInt = (hexColor?: string): number | null => {
        if (!hexColor) return null;
        const hex = hexColor.replace('#', '');
        return parseInt(hex, 16);
      };

      // Insert pages and buttons using the proper schema
      let resourceIdCounter = 1;
      let pageIdCounter = 1;
      let buttonIdCounter = 1;
      let buttonBoxIdCounter = 1;
      let buttonBoxInstanceIdCounter = 1;
      let actionIdCounter = 1;
      let buttonStyleIdCounter = 2; // Start from 2 since 1 is reserved for default
      let pageStyleIdCounter = 2; // Start from 2 since 1 is reserved for default

      // Create mapping from string IDs to numeric IDs
      const pageIdMap = new Map<string, number>();
      const insertedButtonIds = new Set<number>();
      const buttonStyleMap = new Map<string, number>();
      const pageStyleMap = new Map<string, number>();

      // First pass: create pages and map IDs
      Object.values(tree.pages).forEach((page) => {
        // Try to use numeric ID if possible, otherwise assign sequential ID
        const numericPageId = /^\d+$/.test(page.id) ? parseInt(page.id) : pageIdCounter++;
        pageIdMap.set(page.id, numericPageId);

        // Create page style if needed
        let pageStyleId = 1; // default style
        if (page.style && page.style.backgroundColor) {
          const styleKey = JSON.stringify(page.style);
          if (!pageStyleMap.has(styleKey)) {
            pageStyleId = pageStyleIdCounter++;
            pageStyleMap.set(styleKey, pageStyleId);

            const insertPageStyle = db.prepare(
              'INSERT INTO page_styles (id, bg_color, force_bg_color) VALUES (?, ?, ?)'
            );
            insertPageStyle.run(
              pageStyleId,
              hexToInt(page.style.backgroundColor),
              page.style.backgroundColor ? 1 : 0
            );
          } else {
            pageStyleId = pageStyleMap.get(styleKey)!;
          }
        }

        // Insert resource for page name
        const pageResourceId = resourceIdCounter++;
        const insertResource = db.prepare(
          'INSERT INTO resources (id, name, type) VALUES (?, ?, ?)'
        );
        insertResource.run(pageResourceId, page.name || 'Page', 0);

        // Insert page with original ID preserved and style
        const insertPage = db.prepare(
          'INSERT INTO pages (id, resource_id, name, page_style_id) VALUES (?, ?, ?, ?)'
        );
        insertPage.run(numericPageId, pageResourceId, page.name || 'Page', pageStyleId);

        // Store ID mapping
        const insertIdMapping = db.prepare(
          'INSERT INTO page_id_mapping (numeric_id, string_id) VALUES (?, ?)'
        );
        insertIdMapping.run(numericPageId, page.id);
      });

      // Second pass: create buttons and their relationships
      Object.values(tree.pages).forEach((page) => {
        const numericPageId = pageIdMap.get(page.id)!;

        if (page.buttons.length > 0) {
          // Create a button box for this page's buttons
          const buttonBoxId = buttonBoxIdCounter++;
          const insertButtonBox = db.prepare('INSERT INTO button_boxes (id) VALUES (?)');
          insertButtonBox.run(buttonBoxId);

          // Create button box instance
          const insertButtonBoxInstance = db.prepare(
            'INSERT INTO button_box_instances (id, page_id, button_box_id, position_x, position_y, size_x, size_y) VALUES (?, ?, ?, ?, ?, ?, ?)'
          );
          insertButtonBoxInstance.run(
            buttonBoxInstanceIdCounter++,
            numericPageId,
            buttonBoxId,
            0,
            0,
            1,
            1
          );

          // Insert buttons
          page.buttons.forEach((button, index) => {
            const buttonResourceId = resourceIdCounter++;
            const insertResource = db.prepare(
              'INSERT INTO resources (id, name, type) VALUES (?, ?, ?)'
            );
            insertResource.run(buttonResourceId, button.label || 'Button', 7);

            const numericButtonId = parseInt(button.id) || buttonIdCounter++;

            // Create button style if needed
            let buttonStyleId = 1; // default style
            if (button.style) {
              const styleKey = JSON.stringify(button.style);
              if (!buttonStyleMap.has(styleKey)) {
                buttonStyleId = buttonStyleIdCounter++;
                buttonStyleMap.set(styleKey, buttonStyleId);

                const insertButtonStyle = db.prepare(
                  'INSERT INTO button_styles (id, label_on_top, transparent, font_color, body_color, border_color, border_width, font_name, font_bold, font_underline, font_italic, font_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                insertButtonStyle.run(
                  buttonStyleId,
                  button.style.labelOnTop ? 1 : 0,
                  button.style.transparent ? 1 : 0,
                  hexToInt(button.style.fontColor),
                  hexToInt(button.style.backgroundColor),
                  hexToInt(button.style.borderColor),
                  button.style.borderWidth,
                  button.style.fontFamily,
                  button.style.fontWeight === 'bold' ? 1 : 0,
                  button.style.textUnderline ? 1 : 0,
                  button.style.fontStyle === 'italic' ? 1 : 0,
                  button.style.fontSize
                );
              } else {
                buttonStyleId = buttonStyleMap.get(styleKey)!;
              }
            }

            if (!insertedButtonIds.has(numericButtonId)) {
              const insertButton = db.prepare(
                'INSERT INTO buttons (id, resource_id, label, message, visible, button_style_id) VALUES (?, ?, ?, ?, ?, ?)'
              );
              insertButton.run(
                numericButtonId,
                buttonResourceId,
                button.label || '',
                button.message || button.label || '',
                1,
                buttonStyleId
              );
              insertedButtonIds.add(numericButtonId);
            }

            // Insert button box cell with styling
            const insertButtonBoxCell = db.prepare(
              'INSERT INTO button_box_cells (button_box_id, resource_id, location, span_x, span_y, button_style_id, label, message, box_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            insertButtonBoxCell.run(
              buttonBoxId,
              buttonResourceId,
              index,
              1,
              1,
              buttonStyleId,
              button.label || '',
              button.message || button.label || '',
              index
            );

            // Handle navigation actions
            if (button.type === 'NAVIGATE' && button.targetPageId) {
              const targetPageId = pageIdMap.get(button.targetPageId);
              if (targetPageId) {
                // Insert action
                const insertAction = db.prepare(
                  'INSERT INTO actions (id, resource_id, code) VALUES (?, ?, ?)'
                );
                insertAction.run(actionIdCounter, buttonResourceId, 1); // code 1 = navigation

                // Insert action data
                const insertActionData = db.prepare(
                  'INSERT INTO action_data (action_id, value) VALUES (?, ?)'
                );
                insertActionData.run(actionIdCounter, String(targetPageId));
                actionIdCounter++;
              }
            }
          });
        }
      });

      // Save tree metadata (root ID)
      if (tree.rootId) {
        const insertMetadata = db.prepare('INSERT INTO tree_metadata (key, value) VALUES (?, ?)');
        insertMetadata.run('rootId', tree.rootId);
      }

      db.close();

      // Create zip file with the database
      const zip = new AdmZip();
      zip.addLocalFile(dbPath, '', 'vocab.c4v');
      zip.writeZip(outputPath);
    } finally {
      // Clean up
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  }
}

export { TouchChatProcessor };

// TouchChatProcessor for .ce files (SQLite-based TouchChat exports)
// Uses adm-zip for zip extraction and better-sqlite3 for SQLite access
const BaseProcessor = require('../core/baseProcessor');
const { AACTree, AACPage, AACButton } = require('../core/treeStructure');
const FileProcessor = require('../core/fileProcessor');
const AdmZip = require('adm-zip');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

class TouchChatProcessor extends BaseProcessor {
  constructor() {
    super();
    this.tree = null;
    this.sourceFile = null;
  }

  extractTexts(filePathOrBuffer) {
    // Extracts all button labels/texts from TouchChat .ce file
    if (!this.tree && filePathOrBuffer) {
      this.tree = this.loadIntoTree(filePathOrBuffer);
    }
    if (!this.tree) {
      throw new Error('No tree available - call loadIntoTree first');
    }
    const texts = [];
    for (const pageId in this.tree.pages) {
      const page = this.tree.pages[pageId];
      page.buttons.forEach(btn => {
        if (btn.label) texts.push(btn.label);
        if (btn.message && btn.message !== btn.label) texts.push(btn.message);
      });
    }
    return texts;
  }

  loadIntoTree(filePathOrBuffer) {
    // Unzip .ce file, extract the .c4v SQLite DB, and parse pages/buttons
    // Returns an AACTree
    let tmpDir = null;
    let db = null;
    try {
      // Store source file path or buffer
      this.sourceFile = filePathOrBuffer;
      
      // Step 1: Unzip
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'touchchat-'));
      const zip = new AdmZip(typeof filePathOrBuffer === 'string' ? filePathOrBuffer : Buffer.from(filePathOrBuffer));
      zip.extractAllTo(tmpDir, true);
      
      // Step 2: Find the .c4v file (main vocab DB)
      const files = fs.readdirSync(tmpDir);
      console.log('Files in CE archive:', files);
      const vocabFile = files.find(f => f.endsWith('.c4v'));
      if (!vocabFile) {
        throw new Error('No .c4v vocab DB found in .ce file');
      }
      
      const dbPath = path.join(tmpDir, vocabFile);
      // Step 3: Open SQLite DB and extract pages/buttons
      db = new Database(dbPath, { readonly: true });
      const tree = new AACTree();
      
      // First, load all pages and get their names from resources
      const pageQuery = `
        SELECT p.*, r.name
        FROM pages p
        JOIN resources r ON r.id = p.resource_id
      `;
      const pages = db.prepare(pageQuery).all();
      pages.forEach(pageRow => {
        const page = new AACPage({
          id: String(pageRow.id),
          name: pageRow.name || '',
          grid: [],
          buttons: [],
          parentId: null
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
        const buttonBoxCells = db.prepare(buttonBoxQuery).all();
        const buttonBoxes = new Map(); // Map of box id to array of buttons
        buttonBoxCells.forEach(cell => {
          if (!buttonBoxes.has(cell.box_id)) {
            buttonBoxes.set(cell.box_id, []);
          }
          const button = new AACButton({
            id: String(cell.id),
            label: cell.label || '',
            message: cell.message || '',
            type: 'SPEAK',
            action: null
          });
          buttonBoxes.get(cell.box_id).push({
            button,
            location: cell.location,
            spanX: cell.span_x,
            spanY: cell.span_y
          });
        });

        // Map button boxes to pages
        const boxInstances = db.prepare('SELECT * FROM button_box_instances').all();
        boxInstances.forEach(instance => {
          const page = tree.getPage(String(instance.page_id));
          const buttons = buttonBoxes.get(instance.button_box_id);
          if (page && buttons) {
            buttons.forEach(({button}) => {
              page.addButton(button);
            });
          }
        });
      } catch (e) {
        console.log('No button box cells found:', e.message);
      }

      // Load buttons directly linked to pages via resources
      const pageButtonsQuery = `
        SELECT b.*, r.*
        FROM buttons b
        JOIN resources r ON r.id = b.resource_id
        WHERE r.type = 7
      `;
      try {
        const pageButtons = db.prepare(pageButtonsQuery).all();
        pageButtons.forEach(btnRow => {
          const button = new AACButton({
            id: String(btnRow.id),
            label: btnRow.label || '',
            message: btnRow.message || '',
            type: 'SPEAK',
            action: null
          });
          // Find the page that references this resource
          const page = Object.values(tree.pages).find(p => p.id === String(btnRow.id));
          if (page) page.addButton(button);
        });
      } catch (e) {
        console.log('No direct page buttons found:', e.message);
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
        const navActions = db.prepare(navActionsQuery).all();
        navActions.forEach(nav => {
          // Find button in any page
          for (const pageId in tree.pages) {
            const page = tree.pages[pageId];
            const button = page.buttons.find(b => b.id === String(nav.button_id));
            if (button) {
              button.type = 'NAVIGATE';
              button.targetPageId = String(nav.target_page_id);
              break;
            }
          }
        });
      } catch (e) {
        console.log('No navigation actions found:', e.message);
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

  updateTexts(translations) {
    // Update button labels and messages with translations
    let translationIndex = 0;
    for (const pageId in this.tree.pages) {
      const page = this.tree.pages[pageId];
      page.buttons.forEach(btn => {
        if (btn.label) {
          btn.label = translations[translationIndex++];
        }
        if (btn.message && btn.message !== btn.label) {
          btn.message = translations[translationIndex++];
        }
      });
    }
  }

  processTexts(filePathOrBuffer, translations, outputPath) {
    // Load the tree, update texts, and save
    this.tree = this.loadIntoTree(filePathOrBuffer);
    this.updateTexts(translations);
    if (outputPath) {
      this.saveFromTree(this.tree, outputPath);
    }
  }

  saveFromTree(tree, outputPath) {
    // Export AACTree as a TouchChat-compatible .ce file
    if (!outputPath) {
      throw new Error('Output path is required');
    }

    // Create a temporary directory for building the new .ce file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'touchchat-out-'));
    try {
      // Copy all files from the original .ce file
      const zip = new AdmZip(this.sourceFile);
      zip.extractAllTo(tmpDir, true);

      // Find and modify the .c4v file
      const files = fs.readdirSync(tmpDir);
      const vocabFile = files.find(f => f.endsWith('.c4v'));
      if (!vocabFile) {
        throw new Error('No .c4v vocab DB found in .ce file');
      }

      const dbPath = path.join(tmpDir, vocabFile);
      const db = new Database(dbPath);

      // Update buttons in the database
      try {
        for (const pageId in tree.pages) {
          const page = tree.pages[pageId];
          page.buttons.forEach(btn => {
            db.prepare('UPDATE buttons SET label = ?, message = ? WHERE id = ?')
              .run(btn.label, btn.message, btn.id);
          });
        }
      } finally {
        db.close();
      }

      // Create a new zip file with the updated content
      const outZip = new AdmZip();
      files.forEach(file => {
        const filePath = path.join(tmpDir, file);
        outZip.addLocalFile(filePath);
      });
      outZip.writeZip(outputPath);
    } finally {
      // Clean up
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {
        console.warn('Failed to clean up temp directory:', e);
      }
    }
  }
}

module.exports = TouchChatProcessor;

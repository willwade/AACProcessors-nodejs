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
    // Debug: print schema and sample rows from buttons table
    try {
      const schemaRows = db.prepare("PRAGMA table_info(buttons)").all();
      console.log('TouchChatProcessor: buttons table schema:', schemaRows);
      const sampleRows = db.prepare("SELECT * FROM buttons LIMIT 5").all();
      console.log('TouchChatProcessor: first 5 button rows:', sampleRows);
    } catch (e) {
      console.warn('TouchChatProcessor: Could not print buttons schema/sample:', e);
    }
    // Pages
    const pages = db.prepare('SELECT * FROM pages').all();
    pages.forEach(pageRow => {
      const page = new AACPage({
        id: String(pageRow.id),
        name: pageRow.name,
        grid: [],
        buttons: [],
        parentId: null // Could be filled if parent info available
      });
      tree.addPage(page);
    });
    // Buttons
    const buttons = db.prepare('SELECT * FROM buttons').all();
    if (buttons.length > 0) {
      console.log('TouchChatProcessor: button row keys:', Object.keys(buttons[0]));
    }
    let pageIdField = null;
    if (buttons.length > 0) {
      // Try to detect a page id field
      const possibleFields = ['page_id', 'resource_id'];
      for (const field of possibleFields) {
        if (buttons[0].hasOwnProperty(field)) {
          pageIdField = field;
          break;
        }
      }
    }
    if (pageIdField) {
      buttons.forEach(btnRow => {
        const button = new AACButton({
          id: String(btnRow.id),
          label: btnRow.label || btnRow.message || '',
          message: btnRow.message || '',
          type: btnRow.action === 'navigate' ? 'NAVIGATE' : 'SPEAK',
          targetPageId: btnRow.target_page_id ? String(btnRow.target_page_id) : null,
          action: btnRow.action
        });
        const page = tree.getPage(String(btnRow[pageIdField]));
        if (page) page.addButton(button);
      });
    } else {
      // Fallback: add all buttons to a dummy page
      const fallbackPage = new AACPage({ id: 'all', name: 'All Buttons', grid: [], buttons: [], parentId: null });
      buttons.forEach(btnRow => {
        const button = new AACButton({
          id: String(btnRow.id),
          label: btnRow.label || btnRow.message || '',
          message: btnRow.message || '',
          type: btnRow.action === 'navigate' ? 'NAVIGATE' : 'SPEAK',
          targetPageId: btnRow.target_page_id ? String(btnRow.target_page_id) : null,
          action: btnRow.action
        });
        fallbackPage.addButton(button);
      });
      tree.addPage(fallbackPage);
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

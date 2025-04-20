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
  extractTexts(filePathOrBuffer) {
    // Extracts all button labels/texts from TouchChat .ce file
    const tree = this.loadIntoTree(filePathOrBuffer);
    const texts = [];
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      page.buttons.forEach(btn => {
        if (btn.label) texts.push(btn.label);
        else if (btn.message) texts.push(btn.message);
      });
    }
    return texts;
  }

  loadIntoTree(filePathOrBuffer) {
    // Unzip .ce file, extract the .c4v SQLite DB, and parse pages/buttons
    // Returns an AACTree
    // Step 1: Unzip
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'touchchat-'));
    const zip = new AdmZip(filePathOrBuffer);
    zip.extractAllTo(tmpDir, true);
    // Step 2: Find the .c4v file (main vocab DB)
    const files = fs.readdirSync(tmpDir);
    const vocabFile = files.find(f => f.endsWith('.c4v'));
    if (!vocabFile) throw new Error('No .c4v vocab DB found in .ce file');
    const dbPath = path.join(tmpDir, vocabFile);
    // Step 3: Open SQLite DB and extract pages/buttons
    const db = new Database(dbPath, { readonly: true });
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
    db.close();
    // Clean up temp files (optional: for now, leave for debugging)
    // fs.rmSync(tmpDir, { recursive: true, force: true });
    return tree;
  }

  processTexts(filePathOrBuffer, translations, outputPath) {
    // TODO: Implement translation and export logic
    return null;
  }

  saveFromTree(tree, outputPath) {
    // Export AACTree as a TouchChat-compatible JSON file
    const fs = require('fs');
    const obj = {
      pages: {},
      rootId: tree.rootId
    };
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      obj.pages[pageId] = {
        id: page.id,
        name: page.name,
        grid: page.grid,
        parentId: page.parentId,
        buttons: page.buttons.map(btn => ({
          id: btn.id,
          label: btn.label,
          message: btn.message,
          type: btn.type,
          targetPageId: btn.targetPageId,
          action: btn.action
        }))
      };
    }
    fs.writeFileSync(outputPath, JSON.stringify(obj, null, 2), 'utf8');
  }
}

module.exports = TouchChatProcessor;

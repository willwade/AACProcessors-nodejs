// SnapProcessor for .sps files (Snap Core First)
// Loads Snap .sps file (SQLite), extracts texts, navigation, builds tree
const BaseProcessor = require('../core/baseProcessor');
const { AACTree, AACPage, AACButton } = require('../core/treeStructure');
const FileProcessor = require('../core/fileProcessor');
const Database = require('better-sqlite3');

class SnapProcessor extends BaseProcessor {
  extractTexts(filePathOrBuffer) {
    const tree = this.loadIntoTree(filePathOrBuffer);
    const texts = [];
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      page.buttons.forEach(btn => {
        if (btn.label) texts.push(btn.label);
      });
    }
    return texts;
  }

  loadIntoTree(filePathOrBuffer) {
    // Open .sps SQLite DB, extract pages, buttons, navigation
    // Accepts path or Buffer
    let db;
    if (Buffer.isBuffer(filePathOrBuffer)) {
      // Write to temp file
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-')) + '/db.sps';
      fs.writeFileSync(tmpPath, filePathOrBuffer);
      db = new Database(tmpPath, { readonly: true });
    } else {
      db = new Database(filePathOrBuffer, { readonly: true });
    }
    const tree = new AACTree();
    // 1. Pages
    // Load pages (Id, UniqueId, Title, GridDimension)
    const pages = db.prepare('SELECT Id, UniqueId, Title, GridDimension FROM Page').all();
    const pagesById = {};
    pages.forEach(pageRow => {
      const pageId = String(pageRow.UniqueId || pageRow.Id);
      const page = new AACPage({
        id: pageId,
        name: pageRow.Title,
        grid: [],
        buttons: [],
        parentId: null
      });
      tree.addPage(page);
      pagesById[pageId] = page;
    });
    // For each page, get its buttons using the same SQL as Python
    for (const pageId in pagesById) {
      const page = pagesById[pageId];
      // pageId here is UniqueId or fallback to Id
      // Find the actual numeric Id for this UniqueId
      const pageRow = pages.find(p => String(p.UniqueId || p.Id) === pageId);
      if (!pageRow) continue;
      const sql = `
        SELECT b.Id, b.Label, b.Message, b.LibrarySymbolId, b.ElementReferenceId,
               ep.GridPosition, bpl.PageUniqueId
        FROM Button b
        JOIN ElementReference er ON b.ElementReferenceId = er.Id
        JOIN ElementPlacement ep ON ep.ElementReferenceId = er.Id
        JOIN PageLayout pl ON ep.PageLayoutId = pl.Id
        LEFT JOIN ButtonPageLink bpl ON bpl.ButtonId = b.Id
        WHERE er.PageId = ?
      `;
      const buttons = db.prepare(sql).all(pageRow.Id);
      buttons.forEach(btnRow => {
        let type = 'SPEAK';
        let targetPageId = null;
        if (btnRow.PageUniqueId) {
          type = 'NAVIGATE';
          targetPageId = String(btnRow.PageUniqueId);
        }
        const button = new AACButton({
          id: String(btnRow.Id),
          label: btnRow.Label || '',
          type,
          targetPageId,
          action: undefined // Could map more fields if needed
        });
        page.addButton(button);
      });
    }
    // Set parentId for each page by examining navigation buttons
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      for (const btn of page.buttons) {
        if (btn.type === 'NAVIGATE' && btn.targetPageId && tree.pages[btn.targetPageId]) {
          tree.pages[btn.targetPageId].parentId = page.id;
        }
      }
    }
    db.close();
    return tree;
  }
  saveFromTree(tree, outputPath) {
    // Export AACTree as a Snap-compatible JSON file
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
          type: btn.type,
          targetPageId: btn.targetPageId,
          action: btn.action
        }))
      };
    }
    fs.writeFileSync(outputPath, JSON.stringify(obj, null, 2), 'utf8');
  }
}

module.exports = SnapProcessor;

// OBF/OBZ (Open Board Format/Zip) Processor for AAC Processors
// Handles both .obf (JSON) and .obz (zip) files

const fs = require('fs');
const path = require('path');
const { AACButton, AACPage, AACTree } = require('../core/treeStructure');
const AdmZip = require('adm-zip');

class OBFProcessor {
  static canProcess(filePath) {
    return filePath.endsWith('.obf') || filePath.endsWith('.obz');
  }

  static async loadIntoTree(filePath) {
    if (filePath.endsWith('.obf')) {
      const boardData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return this._parseBoard(boardData);
    } else if (filePath.endsWith('.obz')) {
      const zip = new AdmZip(filePath);
      // Find manifest.json
      const manifestEntry = zip.getEntry('manifest.json');
      if (!manifestEntry) throw new Error('manifest.json missing from .obz');
      const manifest = JSON.parse(zip.readAsText(manifestEntry));
      // Load root board
      const rootPath = manifest.root;
      const rootEntry = zip.getEntry(rootPath);
      if (!rootEntry) throw new Error(`Root board not found: ${rootPath}`);
      const boardData = JSON.parse(zip.readAsText(rootEntry));
      // Recursively load boards as needed
      return this._parseBoard(boardData, zip, manifest.paths);
    } else {
      throw new Error('Unsupported file extension');
    }
  }

  static _parseBoard(boardData, zip = null, paths = null, seen = new Set()) {
    const tree = new AACTree();
    const pageId = boardData.id || '';
    const grid = boardData.grid || {};
    const rows = grid.rows || 1;
    const cols = grid.columns || 1;
    const gridOrder = grid.order || [];
    const imagesMap = {};
    if (Array.isArray(boardData.images)) {
      for (const img of boardData.images) {
        if (img.id) imagesMap[img.id] = img;
      }
    }
    const page = new AACPage({
      id: pageId,
      name: boardData.name || '',
      grid: gridOrder,
      buttons: [],
      parentId: null
    });
    // Add buttons
    if (Array.isArray(boardData.buttons)) {
      for (const btn of boardData.buttons) {
        let type = 'SPEAK';
        let targetPageId = null;
        let action = null;
        let image = null;
        if (btn.load_board) {
          type = 'NAVIGATE';
          targetPageId = btn.load_board.id || btn.load_board;
        } else if (btn.action) {
          action = btn.action;
        }
        if (btn.image_id && imagesMap[btn.image_id]) {
          // Attach image info directly; could be extended to AACSymbol if needed
          image = imagesMap[btn.image_id];
        }
        const button = new AACButton({
          id: btn.id,
          label: btn.label || '',
          type,
          targetPageId,
          action
        });
        if (image) button.image = image;
        page.addButton(button);
        // Recursively load linked boards if .obz and not already seen
        if (type === 'NAVIGATE' && targetPageId && zip && paths) {
          if (!seen.has(targetPageId) && paths.boards && paths.boards[targetPageId]) {
            seen.add(targetPageId);
            const linkedPath = paths.boards[targetPageId];
            const linkedEntry = zip.getEntry(linkedPath);
            if (linkedEntry) {
              const linkedData = JSON.parse(zip.readAsText(linkedEntry));
              const linkedTree = this._parseBoard(linkedData, zip, paths, seen);
              // Merge linkedTree pages into main tree
              Object.values(linkedTree.pages).forEach(p => tree.addPage(p));
            }
          }
        }
      }
    }
    tree.addPage(page);
    if (!tree.rootId) tree.rootId = pageId;
    return tree;
  }
}

module.exports = OBFProcessor;

// OBF/OBZ (Open Board Format/Zip) Processor for AAC Processors
// Handles both .obf (JSON) and .obz (zip) files

const fs = require('fs');
const path = require('path');
const { AACButton, AACPage, AACTree } = require('../core/treeStructure');
const AdmZip = require('adm-zip');

class OBFProcessor {
  constructor() {
    this.tree = null;
    this.sourceFile = null;
    this.manifest = null;
    this.zip = null;
  }

  canProcess(filePath) {
    return filePath.endsWith('.obf') || filePath.endsWith('.obz');
  }

  loadIntoTree(filePathOrBuffer) {
    // Store source file path or buffer
    this.sourceFile = filePathOrBuffer;

    if (filePathOrBuffer.endsWith('.obf')) {
      const boardData = JSON.parse(fs.readFileSync(filePathOrBuffer, 'utf8'));
      this.tree = this._parseBoard(boardData);
    } else if (filePathOrBuffer.endsWith('.obz')) {
      this.zip = new AdmZip(filePathOrBuffer);
      // Find manifest.json
      const manifestEntry = this.zip.getEntry('manifest.json');
      if (!manifestEntry) throw new Error('manifest.json missing from .obz');
      this.manifest = JSON.parse(this.zip.readAsText(manifestEntry));
      // Load root board
      const rootPath = this.manifest.root;
      const rootEntry = this.zip.getEntry(rootPath);
      if (!rootEntry) throw new Error(`Root board not found: ${rootPath}`);
      const boardData = JSON.parse(this.zip.readAsText(rootEntry));
      // Recursively load boards as needed
      this.tree = this._parseBoard(boardData, this.zip, this.manifest.paths);
    } else {
      throw new Error('Unsupported file extension');
    }
    return this.tree;
  }

  _parseBoard(boardData, zip = null, paths = null, seen = new Set()) {
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

  extractTexts(filePathOrBuffer) {
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
      });
    }
    return texts;
  }

  processTexts(filePathOrBuffer, translations, outputPath) {
    if (!outputPath) {
      throw new Error('Output path is required');
    }

    // Load the tree if not already loaded
    if (!this.tree) {
      this.tree = this.loadIntoTree(filePathOrBuffer);
    }

    // Update texts with translations
    let translationIndex = 0;
    for (const pageId in this.tree.pages) {
      const page = this.tree.pages[pageId];
      page.buttons.forEach(btn => {
        if (btn.label) {
          btn.label = translations[translationIndex++];
        }
      });
    }

    // Save the updated tree
    this.saveFromTree(this.tree, outputPath);
  }

  saveFromTree(tree, outputPath) {
    if (!this.sourceFile) {
      throw new Error('No source file available');
    }

    if (this.sourceFile.endsWith('.obf')) {
      // For .obf files, save directly
      const boardData = {
        format: 'open-board-0.1',
        id: tree.rootId,
        locale: 'en',
        name: tree.pages[tree.rootId].name,
        buttons: []
      };

      // Add buttons from root page
      const rootPage = tree.pages[tree.rootId];
      boardData.buttons = rootPage.buttons.map(btn => ({
        id: btn.id,
        label: btn.label,
        load_board: btn.type === 'NAVIGATE' ? { id: btn.targetPageId } : undefined,
        action: btn.action,
        image_id: btn.image ? btn.image.id : undefined
      }));

      fs.writeFileSync(outputPath, JSON.stringify(boardData, null, 2), 'utf8');
    } else if (this.sourceFile.endsWith('.obz')) {
      // For .obz files, update each board file and create new zip
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obf-out-'));
      try {
        // Extract original obz
        this.zip.extractAllTo(tmpDir, true);

        // Update each board file
        for (const pageId in tree.pages) {
          const page = tree.pages[pageId];
          const boardPath = this.manifest.paths.boards[pageId];
          if (boardPath) {
            const boardFile = path.join(tmpDir, boardPath);
            if (fs.existsSync(boardFile)) {
              const boardData = JSON.parse(fs.readFileSync(boardFile, 'utf8'));
              // Update button labels
              if (boardData.buttons) {
                boardData.buttons.forEach(btn => {
                  const updatedBtn = page.buttons.find(b => b.id === btn.id);
                  if (updatedBtn) {
                    btn.label = updatedBtn.label;
                  }
                });
              }
              fs.writeFileSync(boardFile, JSON.stringify(boardData, null, 2), 'utf8');
            }
          }
        }

        // Create new zip with updated content
        const outZip = new AdmZip();
        const files = fs.readdirSync(tmpDir);
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
}

module.exports = OBFProcessor;

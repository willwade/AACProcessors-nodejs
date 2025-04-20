// GridsetProcessor for Grid 3 .gridset files (XML-based, zipped)
// Uses adm-zip for zip extraction and fast-xml-parser for XML parsing
const BaseProcessor = require('../core/baseProcessor');
const { AACTree, AACPage, AACButton } = require('../core/treeStructure');
const FileProcessor = require('../core/fileProcessor');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { XMLParser } = require('fast-xml-parser');

class GridsetProcessor extends BaseProcessor {
  constructor() {
    super();
    this.tree = null;
    this.sourceFile = null;
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

  loadIntoTree(filePathOrBuffer) {
    // Store source file path or buffer
    this.sourceFile = filePathOrBuffer;

    // Unzip .gridset, parse settings.xml for StartGrid, parse Grids/*.xml for pages/cells
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gridset-'));
    try {
      const zip = new AdmZip(filePathOrBuffer);
      zip.extractAllTo(tmpDir, true);
      // Parse StartGrid from Settings0/settings.xml
      let startGridName = null;
      const settingsPath = path.join(tmpDir, 'Settings0', 'settings.xml');
      if (fs.existsSync(settingsPath)) {
        const xml = fs.readFileSync(settingsPath, 'utf8');
        const parser = new XMLParser();
        const doc = parser.parse(xml);
        if (doc.GridSetSettings && doc.GridSetSettings.StartGrid) {
          startGridName = doc.GridSetSettings.StartGrid;
        }
      }
      // Parse all grids in Grids/
      const gridsDir = path.join(tmpDir, 'Grids');
      this.tree = new AACTree();
      if (fs.existsSync(gridsDir)) {
        const gridDirs = fs.readdirSync(gridsDir);
        gridDirs.forEach(subdir => {
          const gridXmlPath = path.join(gridsDir, subdir, 'grid.xml');
          if (fs.existsSync(gridXmlPath)) {
            const xml = fs.readFileSync(gridXmlPath, 'utf8');
            const parser = new XMLParser();
            const doc = parser.parse(xml);
            // Each grid is a page
            const gridGuid = doc.Grid && doc.Grid.GridGuid ? doc.Grid.GridGuid : gridXmlPath;
            const page = new AACPage({
              id: String(gridGuid),
              name: doc.Grid && doc.Grid.Name ? doc.Grid.Name : subdir,
              grid: [],
              buttons: [],
              parentId: null
            });
            // Parse cells as buttons
            if (doc.Grid && doc.Grid.Cells && doc.Grid.Cells.Cell) {
              const cells = Array.isArray(doc.Grid.Cells.Cell) ? doc.Grid.Cells.Cell : [doc.Grid.Cells.Cell];
              cells.forEach(cell => {
                // Defensive: check for Content
                const content = cell.Content || {};
                // Extract label from Content.CaptionAndImage.Caption
                let label = '';
                if (content.CaptionAndImage && content.CaptionAndImage.Caption) {
                  label = content.CaptionAndImage.Caption;
                }
                // Navigation detection
                let type = 'SPEAK';
                let targetPageId = null;
                let action = null;
                if (content.Commands && content.Commands.Command) {
                  const commands = Array.isArray(content.Commands.Command)
                    ? content.Commands.Command
                    : [content.Commands.Command];
                  for (const cmd of commands) {
                    if (cmd.ID === 'Jump.To') {
                      type = 'NAVIGATE';
                      // Find Parameter with Key="grid" for target
                      if (cmd.Parameter) {
                        const params = Array.isArray(cmd.Parameter) ? cmd.Parameter : [cmd.Parameter];
                        const gridParam = params.find(p => p.Key === 'grid');
                        if (gridParam) {
                          targetPageId = gridParam['#text'] || gridParam.Value || null;
                        }
                      }
                      action = 'Jump.To';
                      break;
                    }
                  }
                }
                const btn = new AACButton({
                  id: cell.CellGuid || label || Math.random().toString(),
                  label,
                  type,
                  targetPageId,
                  action
              });
              page.addButton(btn);
            });
          }
          this.tree.addPage(page);
        }
      });
    }
    // Optionally set rootId based on StartGrid
    if (startGridName) {
      for (const pageId in this.tree.pages) {
        if (this.tree.pages[pageId].name === startGridName) {
          this.tree.rootId = pageId;
          break;
        }
      }
    }
    // Clean up temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to clean up temp directory:', e);
    }
    return this.tree;
    } finally {
      // Clean up in case of error
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {
        console.warn('Failed to clean up temp directory:', e);
      }
    }
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

    // Create a temporary directory for building the new .gridset file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gridset-out-'));
    try {
      // Extract the original gridset
      const zip = new AdmZip(this.sourceFile);
      zip.extractAllTo(tmpDir, true);

      // Update each grid.xml file with translated labels
      const gridsDir = path.join(tmpDir, 'Grids');
      if (fs.existsSync(gridsDir)) {
        const gridDirs = fs.readdirSync(gridsDir);
        gridDirs.forEach(subdir => {
          const gridXmlPath = path.join(gridsDir, subdir, 'grid.xml');
          if (fs.existsSync(gridXmlPath)) {
            const xml = fs.readFileSync(gridXmlPath, 'utf8');
            const parser = new XMLParser();
            const doc = parser.parse(xml);

            // Find matching page in our tree
            const gridGuid = doc.Grid && doc.Grid.GridGuid ? doc.Grid.GridGuid : gridXmlPath;
            const page = tree.pages[gridGuid];
            if (page && doc.Grid && doc.Grid.Cells && doc.Grid.Cells.Cell) {
              const cells = Array.isArray(doc.Grid.Cells.Cell) ? doc.Grid.Cells.Cell : [doc.Grid.Cells.Cell];
              cells.forEach(cell => {
                // Find matching button
                const btn = page.buttons.find(b => b.id === cell.CellGuid);
                if (btn && cell.Content && cell.Content.CaptionAndImage) {
                  cell.Content.CaptionAndImage.Caption = btn.label;
                }
              });
            }

            // Write updated XML back to file
            fs.writeFileSync(gridXmlPath, JSON.stringify(doc, null, 2), 'utf8');
          }
        });
      }

      // Create a new zip file with the updated content
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

module.exports = GridsetProcessor;


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
    // Unzip .gridset, parse settings.xml for StartGrid, parse Grids/*.xml for pages/cells
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gridset-'));
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
    const tree = new AACTree();
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
          tree.addPage(page);
        }
      });
    }
    // Optionally set rootId based on StartGrid
    if (startGridName) {
      for (const pageId in tree.pages) {
        if (tree.pages[pageId].name === startGridName) {
          tree.rootId = pageId;
          break;
        }
      }
    }
    // Clean up temp files (optional: for now, leave for debugging)
    // fs.rmSync(tmpDir, { recursive: true, force: true });
    return tree;
  }

  processTexts(filePathOrBuffer, translations, outputPath) {
    // TODO: Implement translation and export logic
    return null;
  }

  saveFromTree(tree, outputPath) {
    // Export AACTree as a Gridset-compatible JSON file
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

module.exports = GridsetProcessor;


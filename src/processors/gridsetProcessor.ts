import { BaseProcessor } from '../core/baseProcessor';
import { AACTree, AACPage, AACButton } from '../core/treeStructure';
import AdmZip from 'adm-zip';
import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

interface GridsetButton {
  label: string;
  message?: string;
  navigationTarget?: string;
}

interface GridsetGrid {
  id: string;
  name: string;
  buttons: GridsetButton[];
}

class GridsetProcessor extends BaseProcessor {
  extractTexts(filePathOrBuffer: string | Buffer): string[] {
    const buffer = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer
      : fs.readFileSync(filePathOrBuffer);
    const tree = this.loadIntoTree(buffer);
    const texts: string[] = [];

    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      if (page.name) texts.push(page.name);
      page.buttons.forEach((btn) => {
        if (btn.label) texts.push(btn.label);
        if (btn.message && btn.message !== btn.label) texts.push(btn.message);
      });
    }

    return texts;
  }

  loadIntoTree(filePathOrBuffer: Buffer): AACTree {
    const tree = new AACTree();
    const zip = new AdmZip(filePathOrBuffer);
    const parser = new XMLParser();

    // Debug: log all entry names
    // console.log('Gridset zip entries:', zip.getEntries().map(e => e.entryName));
    // Process each grid file in the gridset
    zip.getEntries().forEach((entry) => {
      // Only process files named grid.xml under Grids/ (any subdir)
      if (entry.entryName.startsWith('Grids/') && entry.entryName.endsWith('grid.xml')) {

        let xmlContent: string;
        try {
          xmlContent = entry.getData().toString('utf8');
        } catch (e) {
          // Skip unreadable files
          return;
        }
        let data: any;
        try {
          data = parser.parse(xmlContent);
        } catch (e) {
          // Skip malformed XML
          console.log('Malformed XML in:', entry.entryName);
          return;
        }



        // Grid3 XML: <Grid> root
        const grid = data.Grid || data.grid;
        if (!grid) {
          return;
        }
        // Defensive: GridGuid and Name required
        function extractText(val: any): string | undefined {
          if (!val) return undefined;
          if (typeof val === 'string') return val;
          if (typeof val === 'object' && '#text' in val) return val['#text'];
          return undefined;
        }
        const gridId = extractText(grid.GridGuid || grid.gridGuid || grid.id);
        let gridName = extractText(grid.Name) || extractText(grid.name) || extractText(grid['@_Name']);
        if (!gridName) {
          // Fallback: get folder name from entry path
          const match = entry.entryName.match(/^Grids\/([^/]+)\//);
          if (match) gridName = match[1];
        }
        if (!gridId || !gridName) {
          return;
        }

        const page = new AACPage({
          id: String(gridId),
          name: String(gridName),
          grid: [],
          buttons: [],
          parentId: null,
        });

        // Process buttons: <Cells><Cell>
        const cells = grid.Cells?.Cell || grid.cells?.cell;
        if (cells) {
          // Cells may be array or single object
          const cellArr = Array.isArray(cells) ? cells : [cells];
          cellArr.forEach((cell: any, idx: number) => {
            if (!cell || !cell.Content) return;

            // Extract label from CaptionAndImage/Caption
            const content = cell.Content;
            const captionAndImage = content.CaptionAndImage || content.captionAndImage;
            let label = captionAndImage?.Caption || captionAndImage?.caption || '';

            // If no caption, try other sources or create a placeholder
            if (!label) {
              // For cells without captions (like AutoContent cells), create a meaningful label
              if (content.ContentType === 'AutoContent') {
                label = `AutoContent_${idx}`;
              } else {
                return; // Skip cells without labels
              }
            }

            const message = label; // Use caption as message

            // Check for navigation commands
            let navigationTarget: string | undefined;
            const commands = content.Commands?.Command || content.commands?.command;
            if (commands) {
              const commandArr = Array.isArray(commands) ? commands : [commands];
              for (const command of commandArr) {
                if (command.ID === 'Jump.To' || command.id === 'Jump.To') {
                  const parameters = command.Parameter || command.parameter;
                  if (parameters) {
                    const paramArr = Array.isArray(parameters) ? parameters : [parameters];
                    for (const param of paramArr) {
                      if ((param.Key === 'grid' || param.key === 'grid') && param['#text']) {
                        navigationTarget = param['#text'];
                        break;
                      }
                    }
                  }
                  break;
                }
              }
            }

            const button = new AACButton({
              id: `${gridId}_btn_${idx}`,
              label: String(label),
              message: String(message),
              type: navigationTarget ? 'NAVIGATE' : 'SPEAK',
              targetPageId: navigationTarget ? String(navigationTarget) : undefined,
              action: navigationTarget
                ? {
                    type: 'NAVIGATE',
                    targetPageId: String(navigationTarget),
                  }
                : null,
            });
            page.addButton(button);
          });
        }

        tree.addPage(page);
      }
    });

    // After all pages are loaded, set parentId for navigation targets
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      page.buttons.forEach((btn: AACButton) => {
        if (btn.type === 'NAVIGATE' && btn.targetPageId) {
          const targetPage = tree.getPage(btn.targetPageId);
          if (targetPage) {
            targetPage.parentId = page.id;
          }
        }
      });
    }

    return tree;
  }

  processTexts(
    _filePathOrBuffer: string | Buffer,
    _translations: Map<string, string>,
    _outputPath: string
  ): Buffer {
    throw new Error('Gridset processTexts not implemented');
  }

  saveFromTree(_tree: AACTree, _outputPath: string): void {
    throw new Error('Gridset saveFromTree not implemented');
  }
}

export { GridsetProcessor };

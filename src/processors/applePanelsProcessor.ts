import { BaseProcessor } from '../core/baseProcessor';
import { AACTree, AACPage, AACButton } from '../core/treeStructure';
// Removed unused import: FileProcessor
import plist from 'plist';
import fs from 'fs';

interface ApplePanelsButton {
  label: string;
  message?: string;
  targetPanel?: string;
}

interface ApplePanelsPanel {
  id: string;
  name: string;
  buttons: ApplePanelsButton[];
}

interface ApplePanelsDocument {
  panels: ApplePanelsPanel[];
}

class ApplePanelsProcessor extends BaseProcessor {
  extractTexts(filePathOrBuffer: string | Buffer): string[] {
    const tree = this.loadIntoTree(filePathOrBuffer);
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

  loadIntoTree(filePathOrBuffer: string | Buffer): AACTree {
    const content =
      typeof filePathOrBuffer === 'string'
        ? fs.readFileSync(filePathOrBuffer, 'utf8')
        : filePathOrBuffer.toString('utf8');

    const parsedData = plist.parse(content);
    const data = {
      panels: Array.isArray((parsedData as any).panels) ? (parsedData as any).panels : []
    } as ApplePanelsDocument;
    const tree = new AACTree();

    data.panels.forEach((panel) => {
      const page = new AACPage({
        id: panel.id,
        name: panel.name,
        grid: [],
        buttons: [],
        parentId: null,
      });

      panel.buttons.forEach((btn, idx) => {
        const button = new AACButton({
          id: `${panel.id}_btn_${idx}`,
          label: btn.label,
          message: btn.message || btn.label,
          type: btn.targetPanel ? 'NAVIGATE' : 'SPEAK',
          targetPageId: btn.targetPanel,
          action: btn.targetPanel
            ? {
                type: 'NAVIGATE',
                targetPageId: btn.targetPanel,
              }
            : null,
        });
        page.addButton(button);
      });

      tree.addPage(page);
    });

    return tree;
  }

  processTexts(
    _filePathOrBuffer: string | Buffer,
    _translations: Map<string, string>,
    _outputPath: string
  ): Buffer {
    throw new Error('ApplePanels processTexts not implemented');
  }

  saveFromTree(_tree: AACTree, _outputPath: string): void {
    throw new Error('ApplePanels saveFromTree not implemented');
  }
}

export { ApplePanelsProcessor };

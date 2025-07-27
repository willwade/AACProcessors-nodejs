import { BaseProcessor } from '../core/baseProcessor';
import { AACTree, AACPage, AACButton } from '../core/treeStructure';
import fs from 'fs';

class AstericsGridProcessor extends BaseProcessor {
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

  private loadAudio: boolean = false;

  constructor(options: { loadAudio?: boolean } = {}) {
    super();
    this.loadAudio = options.loadAudio || false;
  }

  loadIntoTree(filePathOrBuffer: string | Buffer): AACTree {
    const tree = new AACTree();
    const content = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer.toString('utf-8')
      : fs.readFileSync(filePathOrBuffer, 'utf-8');
    
    const grdFile = JSON.parse(content);

    if (!grdFile.grids) {
      return tree;
    }

    // First pass: create all pages
    grdFile.grids.forEach((grid: any) => {
      const page = new AACPage({
        id: grid.id,
        name: grid.label?.en || grid.id,
        grid: [],
        buttons: [],
        parentId: null,
      });
      tree.addPage(page);
    });

    // Second pass: add buttons and establish navigation
    grdFile.grids.forEach((grid: any) => {
      const page = tree.getPage(grid.id);
      if (!page) return;

      grid.gridElements.forEach((element: any) => {
        let audioRecording;
        if (this.loadAudio) {
            const audioAction = element.actions.find((a: any) => a.modelName === 'GridActionAudio');
            if (audioAction) {
                audioRecording = {
                    id: audioAction.id,
                    data: Buffer.from(audioAction.dataBase64, 'base64'),
                    identifier: audioAction.filename,
                    metadata: JSON.stringify({ mimeType: audioAction.mimeType, durationMs: audioAction.durationMs }),
                };
            }
        }

        const navAction = element.actions.find((a: any) => a.modelName === 'GridActionNavigate');
        const targetPageId = navAction ? navAction.toGridId : null;

        const button = new AACButton({
          id: element.id,
          label: element.label?.en || '',
          message: element.label?.en || '',
          type: targetPageId ? 'NAVIGATE' : 'SPEAK',
          targetPageId: targetPageId,
          action: targetPageId
            ? {
                type: 'NAVIGATE',
                targetPageId: targetPageId,
              }
            : null,
          audioRecording: audioRecording,
        });

        page.addButton(button);

        if (targetPageId) {
          const targetPage = tree.getPage(targetPageId);
          if (targetPage) {
            targetPage.parentId = page.id;
          }
        }
      });
    });

    return tree;
  }

  processTexts(
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string
  ): Buffer {
    const tree = this.loadIntoTree(filePathOrBuffer);

    Object.values(tree.pages).forEach((page) => {
      if (page.name && translations.has(page.name)) {
        page.name = translations.get(page.name)!;
      }

      page.buttons.forEach((button) => {
        if (button.label && translations.has(button.label)) {
          button.label = translations.get(button.label)!;
        }
        if (button.message && translations.has(button.message)) {
          button.message = translations.get(button.message)!;
        }
      });
    });

    this.saveFromTree(tree, outputPath);
    return fs.readFileSync(outputPath);
  }

  saveFromTree(tree: AACTree, outputPath: string): void {
    const grids = Object.values(tree.pages).map(page => {
      const gridElements = page.buttons.map(button => {
        const actions: any[] = [];
        if (button.type === 'NAVIGATE' && button.targetPageId) {
          actions.push({
            id: `grid-action-navigate-${button.id}`,
            modelName: 'GridActionNavigate',
            navType: 'navigateToGrid',
            toGridId: button.targetPageId,
          });
        } else {
            actions.push({
                id: `grid-action-speak-${button.id}`,
                modelName: 'GridActionSpeak',
            });
        }

        if (button.audioRecording) {
            const metadata = JSON.parse(button.audioRecording.metadata || '{}');
            actions.push({
                id: button.audioRecording.id,
                modelName: 'GridActionAudio',
                dataBase64: button.audioRecording.data.toString('base64'),
                mimeType: metadata.mimeType,
                durationMs: metadata.durationMs,
                filename: button.audioRecording.identifier,
            });
        }

        return {
          id: button.id,
          modelName: 'GridElement',
          label: { en: button.label },
          actions: actions,
          // other properties would need to be preserved or defaulted
        };
      });

      return {
        id: page.id,
        modelName: 'GridData',
        label: { en: page.name },
        gridElements: gridElements,
        // other properties would need to be preserved or defaulted
      };
    });

    const grdFile = {
        grids: grids,
        // metadata and other top-level properties would need to be preserved
    };

    fs.writeFileSync(outputPath, JSON.stringify(grdFile, null, 2));
  }
}

export { AstericsGridProcessor };

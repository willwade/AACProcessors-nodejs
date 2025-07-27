import { BaseProcessor } from "../core/baseProcessor";
import { AACTree, AACPage, AACButton } from "../core/treeStructure";
// Removed unused import: FileProcessor
import plist from "plist";
import fs from "fs";

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
      typeof filePathOrBuffer === "string"
        ? fs.readFileSync(filePathOrBuffer, "utf8")
        : filePathOrBuffer.toString("utf8");

    const parsedData = plist.parse(content);
    const data = {
      panels: Array.isArray((parsedData as any).panels)
        ? (parsedData as any).panels
        : [],
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
          type: btn.targetPanel ? "NAVIGATE" : "SPEAK",
          targetPageId: btn.targetPanel,
          action: btn.targetPanel
            ? {
                type: "NAVIGATE",
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
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string,
  ): Buffer {
    // Load the tree, apply translations, and save to new file
    const tree = this.loadIntoTree(filePathOrBuffer);

    // Apply translations to all text content
    Object.values(tree.pages).forEach((page) => {
      // Translate page names
      if (page.name && translations.has(page.name)) {
        page.name = translations.get(page.name)!;
      }

      // Translate button labels and messages
      page.buttons.forEach((button) => {
        if (button.label && translations.has(button.label)) {
          button.label = translations.get(button.label)!;
        }
        if (button.message && translations.has(button.message)) {
          button.message = translations.get(button.message)!;
        }
      });
    });

    // Save the translated tree to a temporary file and return its content
    this.saveFromTree(tree, outputPath);
    return fs.readFileSync(outputPath);
  }

  saveFromTree(tree: AACTree, outputPath: string): void {
    const panels: ApplePanelsPanel[] = Object.values(tree.pages).map(
      (page) => ({
        id: page.id,
        name: page.name || "Panel",
        buttons: page.buttons.map((button) => ({
          label: button.label,
          message: button.message || button.label,
          targetPanel:
            button.type === "NAVIGATE" ? button.targetPageId : undefined,
        })),
      }),
    );

    const document = { panels } as any;
    const plistContent = plist.build(document);
    fs.writeFileSync(outputPath, plistContent);
  }
}

export { ApplePanelsProcessor };

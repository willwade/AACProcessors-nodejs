import { AACTree } from "../core/treeStructure";

export function prettyPrintTree(tree: AACTree): string {
  let output = "";
  for (const pageId in tree.pages) {
    const page = tree.pages[pageId];
    output += `Page: ${page.name} (ID: ${page.id})\n`;
    if (!page.buttons || page.buttons.length === 0) {
      output += "  (no buttons)\n";
    } else {
      for (const btn of page.buttons) {
        output += `  - Button: ${JSON.stringify(btn.label)} [${btn.type}`;
        if (btn.type === "NAVIGATE" && btn.targetPageId) {
          output += ` to page: ${btn.targetPageId}`;
        }
        output += "]\n";
      }
    }
  }
  return output;
}

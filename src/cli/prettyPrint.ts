import { AACTree, AACSemanticIntent } from '../core/treeStructure';

export function prettyPrintTree(tree: AACTree): string {
  let output = '';
  for (const pageId in tree.pages) {
    const page = tree.pages[pageId];
    output += `Page: ${page.name} (ID: ${page.id})\n`;
    if (!page.buttons || page.buttons.length === 0) {
      output += '  (no buttons)\n';
    } else {
      for (const btn of page.buttons) {
        const buttonType =
          btn.semanticAction?.intent === AACSemanticIntent.NAVIGATE_TO ? 'NAVIGATE' : 'SPEAK';
        output += `  - Button: ${JSON.stringify(btn.label)} [${buttonType}`;
        if (btn.semanticAction?.intent === AACSemanticIntent.NAVIGATE_TO && btn.targetPageId) {
          output += ` to page: ${btn.targetPageId}`;
        }
        output += ']\n';
      }
    }
  }
  return output;
}

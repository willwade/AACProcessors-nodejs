import { AACTree } from '../core/treeStructure';

export function prettyPrintTree(tree: AACTree): string {
  let output = '';
  for (const pageId in tree.pages) {
    const page = tree.pages[pageId];
    output += `Page: ${page.name} (ID: ${page.id})\n`;
    if (!page.buttons || page.buttons.length === 0) {
      output += '  (no buttons)\n';
    } else {
      for (const btn of page.buttons) {
        const intentStr = String(btn.semanticAction?.intent);
        const isNavigate = intentStr === 'NAVIGATE_TO' || !!btn.targetPageId;
        const buttonType = isNavigate ? 'NAVIGATE' : 'SPEAK';
        output += `  - Button: ${JSON.stringify(btn.label)} [${buttonType}`;
        if (isNavigate) {
          const target = btn.semanticAction?.targetId || btn.targetPageId;
          if (target) output += ` to page: ${target}`;
        }
        output += ']\n';
      }
    }
  }
  return output;
}

// Pretty printer for AACTree, AACPage, AACButton
// Usage: prettyPrintTree(tree)

function prettyPrintTree(tree, opts = {}) {
  const indent = (level) => '  '.repeat(level);
  let out = '';
  for (const pageId in tree.pages) {
    const page = tree.pages[pageId];
    out += `Page: ${page.name} (id: ${page.id})\n`;
    if (page.buttons && page.buttons.length > 0) {
      page.buttons.forEach((btn, idx) => {
        out += `${indent(1)}- Button: "${btn.label || btn.message || '[no label]'}"`;
        if (btn.type === 'NAVIGATE' && btn.targetPageId) {
          out += ` [NAVIGATE to page: ${btn.targetPageId}]`;
        }
        out += `\n`;
      });
    } else {
      out += `${indent(1)}(no buttons)\n`;
    }
  }
  return out;
}

module.exports = { prettyPrintTree };

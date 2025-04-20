// Pretty Printer / Viewer for AACTree
// Usage: prettyPrintTree(tree)

function prettyPrintTree(tree, { showNavigation = true, maxDepth = 10 } = {}) {
  if (!tree.rootId) {
    console.log('Tree is empty.');
    return;
  }
  const visited = new Set();
  function printPage(pageId, depth) {
    if (depth > maxDepth) return;
    if (visited.has(pageId)) {
      console.log('  '.repeat(depth) + `↳ [${pageId}] (cycle)`);
      return;
    }
    visited.add(pageId);
    const page = tree.getPage(pageId);
    if (!page) return;
    console.log('  '.repeat(depth) + `- Page: ${page.name} [${page.id}]`);
    page.buttons.forEach(btn => {
      if (btn.type === 'NAVIGATE' && btn.targetPageId && showNavigation) {
        console.log('  '.repeat(depth + 1) + `→ NAVIGATE: ${btn.label} → [${btn.targetPageId}]`);
        printPage(btn.targetPageId, depth + 2);
      } else if (btn.type === 'SPEAK') {
        console.log('  '.repeat(depth + 1) + `• SPEAK: ${btn.label}`);
      }
    });
  }
  printPage(tree.rootId, 0);
}

module.exports = { prettyPrintTree };

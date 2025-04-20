// DOT (Graphviz) Processor for AAC Processors
// Reads .dot or .gv files and builds an AACTree
const fs = require('fs');
const { AACButton, AACPage, AACTree } = require('../core/treeStructure');

class DotProcessor {
  static canProcess(filePath) {
    return filePath.endsWith('.dot') || filePath.endsWith('.gv');
  }

  static loadIntoTree(filePath) {
    const dotContent = fs.readFileSync(filePath, 'utf8');
    // Parse nodes and edges
    const { nodes, edges } = this._parseDot(dotContent);
    const tree = new AACTree();
    // Add pages (nodes)
    Object.entries(nodes).forEach(([nodeId, label]) => {
      const page = new AACPage({
        id: nodeId,
        name: label,
        grid: [],
        buttons: [],
        parentId: null
      });
      tree.addPage(page);
    });
    // Add navigation buttons (edges)
    edges.forEach(([source, target, edgeLabel]) => {
      if (tree.pages[source] && tree.pages[target]) {
        const button = new AACButton({
          id: `${source}->${target}`,
          label: edgeLabel || `Go to ${nodes[target]}`,
          type: 'NAVIGATE',
          targetPageId: target,
          action: null
        });
        tree.pages[source].addButton(button);
        // Optionally set parentId for hierarchy
        tree.pages[target].parentId = source;
      }
    });
    return tree;
  }

  static _parseDot(dotContent) {
    // Very basic DOT parser for nodes and edges
    // node [label="Name"];
    const nodeRegex = /([\w-]+)\s*\[label\s*=\s*"([^"]*)"\]/g;
    // edge: a -> b [label="Go"];
    const edgeRegex = /([\w-]+)\s*->\s*([\w-]+)(?:\s*\[label\s*=\s*"([^"]*)"\])?/g;
    const nodes = {};
    let match;
    while ((match = nodeRegex.exec(dotContent))) {
      nodes[match[1]] = match[2];
    }
    const edges = [];
    while ((match = edgeRegex.exec(dotContent))) {
      edges.push([match[1], match[2], match[3] || null]);
    }
    return { nodes, edges };
  }

  static saveFromTree(tree, outputPath) {
    // Write the AACTree as a DOT file
    const lines = ['digraph AACBoard {'];
    // Write nodes
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      // Escape quotes in label
      const label = page.name ? page.name.replace(/"/g, '\\"') : pageId;
      lines.push(`  ${pageId} [label="${label}"]`);
    }
    // Write edges (navigation buttons)
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      page.buttons.forEach(btn => {
        if (btn.type === 'NAVIGATE' && btn.targetPageId) {
          let edge = `  ${pageId} -> ${btn.targetPageId}`;
          if (btn.label) {
            const edgeLabel = btn.label.replace(/"/g, '\\"');
            edge += ` [label="${edgeLabel}"]`;
          }
          lines.push(edge);
        }
      });
    }
    lines.push('}');
    require('fs').writeFileSync(outputPath, lines.join('\n'), 'utf8');
  }
}

module.exports = DotProcessor;

// OPML Processor for AAC Processors
// Reads .opml files and builds an AACTree
const fs = require('fs');
const { AACButton, AACPage, AACTree } = require('../core/treeStructure');
const { XMLParser } = require('fast-xml-parser');

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

class OPMLProcessor {
  static canProcess(filePath) {
    return filePath.endsWith('.opml');
  }

  static loadIntoTree(filePath) {
    const xml = fs.readFileSync(filePath, 'utf8');
    const parser = new XMLParser({ ignoreAttributes: false });
    const opml = parser.parse(xml);
    const body = opml.opml && opml.opml.body ? opml.opml.body : opml.body;
    if (!body || !body.outline) return new AACTree();
    // Normalize outlines to array
    const rootOutlines = Array.isArray(body.outline) ? body.outline : [body.outline];
    const tree = new AACTree();
    // Create a super root page
    const superRootId = makeId();
    const superRootPage = new AACPage({ id: superRootId, name: 'Super Root', grid: [], buttons: [] });
    tree.addPage(superRootPage);
    // Create main root page
    const rootPageId = makeId();
    const rootPage = new AACPage({ id: rootPageId, name: 'Root', grid: [], buttons: [], parentId: superRootId });
    tree.addPage(rootPage);
    // Super root button to root
    const rootButton = new AACButton({
      id: makeId(),
      label: 'Root',
      type: 'NAVIGATE',
      targetPageId: rootPageId,
      action: null
    });
    superRootPage.addButton(rootButton);
    // Recursively process outlines
    this._processOutlines(rootOutlines, rootPage, tree);
    return tree;
  }

  static _processOutlines(outlines, parentPage, tree) {
    outlines.forEach(outline => {
      const title = outline['@_text'] || outline['@_title'] || 'Untitled';
      const pageId = makeId();
      const page = new AACPage({ id: pageId, name: title, grid: [], buttons: [], parentId: parentPage.id });
      tree.addPage(page);
      // Button from parent to this page
      const btn = new AACButton({
        id: makeId(),
        label: title,
        type: 'NAVIGATE',
        targetPageId: pageId,
        action: null
      });
      parentPage.addButton(btn);
      // Recurse for children
      if (outline.outline) {
        const children = Array.isArray(outline.outline) ? outline.outline : [outline.outline];
        this._processOutlines(children, page, tree);
      }
    });
  }

  static saveFromTree(tree, outputPath) {
    // Export AACTree to OPML XML
    const { XMLBuilder } = require('fast-xml-parser');
    // Helper: recursively build outlines
    function buildOutlines(page, visited = new Set()) {
      if (visited.has(page.id)) return null; // Prevent cycles
      visited.add(page.id);
      // Find child pages (via NAVIGATE buttons)
      const children = page.buttons
        .filter(btn => btn.type === 'NAVIGATE' && btn.targetPageId && tree.pages[btn.targetPageId])
        .map(btn => tree.pages[btn.targetPageId]);
      const outline = { '@_text': page.name || page.id };
      if (children.length) {
        outline.outline = children.map(child => buildOutlines(child, visited)).filter(Boolean);
      }
      return outline;
    }
    // Find the logical root (skip super root/root if present)
    let rootPage = tree.getPage(tree.rootId);
    if (rootPage && rootPage.name === 'Super Root' && rootPage.buttons.length) {
      // Super Root → Root
      const rootBtn = rootPage.buttons.find(btn => btn.type === 'NAVIGATE' && btn.targetPageId);
      if (rootBtn && tree.pages[rootBtn.targetPageId]) {
        rootPage = tree.pages[rootBtn.targetPageId];
      }
    }
    // Build OPML object
    const opmlObj = {
      opml: {
        '@_version': '2.0',
        head: { title: rootPage ? rootPage.name : 'AAC Board' },
        body: {
          outline: rootPage ? buildOutlines(rootPage) : []
        }
      }
    };
    const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
    const xml = builder.build(opmlObj);
    const xmlWithDecl = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
    require('fs').writeFileSync(outputPath, xmlWithDecl, 'utf8');
  }
}

module.exports = OPMLProcessor;

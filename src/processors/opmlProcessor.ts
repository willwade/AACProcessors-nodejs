import { BaseProcessor } from '../core/baseProcessor';
import { AACTree, AACPage, AACButton } from '../core/treeStructure';
// Removed unused import: FileProcessor
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';

interface OpmlOutline {
  '@_text'?: string;
  _attributes?: {
    text: string;
    [key: string]: string;
  };
  outline?: OpmlOutline[];
}

interface OpmlDocument {
  opml: {
    body: {
      outline: OpmlOutline[];
    };
  };
}

class OpmlProcessor extends BaseProcessor {
  private processOutline(
    outline: OpmlOutline,
    parentId: string | null = null
  ): { page: AACPage | null; childPages: AACPage[] } {
    if (!outline || (typeof outline !== 'object')) {
      return { page: null, childPages: [] };
    }
    const text = outline['@_text'] ||
                 (outline._attributes && outline._attributes.text) ||
                 (outline as any).text;
    if (!text || typeof text !== 'string') {
      // Skip invalid outlines
      return { page: null, childPages: [] };
    }
    const page = new AACPage({
      id: text.replace(/[^a-zA-Z0-9]/g, '_'),
      name: text,
      grid: [],
      buttons: [],
      parentId,
    });

    const childPages: AACPage[] = [];

    if (outline.outline) {
      outline.outline.forEach((child) => {
        const childText = child['@_text'] ||
                         (child._attributes && child._attributes.text) ||
                         (child as any).text;
        if (childText && typeof childText === 'string') {
          const button = new AACButton({
            id: `nav_${page.id}_${childText}`,
            label: childText,
            message: '',
            type: 'NAVIGATE',
            targetPageId: childText.replace(/[^a-zA-Z0-9]/g, '_'),
            action: {
              type: 'NAVIGATE',
              targetPageId: childText.replace(/[^a-zA-Z0-9]/g, '_'),
            },
          });
          page.addButton(button);

          const { page: childPage, childPages: grandChildren } = this.processOutline(child, page.id);
          if (childPage && childPage.id) childPages.push(childPage, ...grandChildren);
        }
      });
    }

    if (!page || !page.id) return { page: null, childPages: [] };
    return { page, childPages };
  }

  extractTexts(filePathOrBuffer: string | Buffer): string[] {
    const content =
      typeof filePathOrBuffer === 'string'
        ? fs.readFileSync(filePathOrBuffer, 'utf8')
        : filePathOrBuffer.toString('utf8');

    const parser = new XMLParser({ ignoreAttributes: false });
    const data = parser.parse(content) as OpmlDocument;
    const texts: string[] = [];

    function processNode(node: any) {
      if (node && node._attributes && typeof node._attributes.text === 'string') {
        texts.push(node._attributes.text);
      }
      if (node && Array.isArray(node.outline)) {
        node.outline.forEach(processNode);
      }
    };

    const outlines = Array.isArray(data.opml.body.outline) ? data.opml.body.outline : [data.opml.body.outline];
    outlines.forEach(processNode);
    return texts;
  }

  loadIntoTree(filePathOrBuffer: string | Buffer): AACTree {
    const content =
      typeof filePathOrBuffer === 'string'
        ? fs.readFileSync(filePathOrBuffer, 'utf8')
        : filePathOrBuffer.toString('utf8');

    const parser = new XMLParser({ ignoreAttributes: false });
    const data = parser.parse(content) as OpmlDocument;
    const tree = new AACTree();

    const outlines = Array.isArray(data.opml.body.outline) ? data.opml.body.outline : [data.opml.body.outline];
    let firstRootId: string | null = null;
    outlines.forEach((outline) => {
      const { page, childPages } = this.processOutline(outline);
      if (page && page.id) {
        tree.addPage(page);
        if (!firstRootId) firstRootId = page.id;
      }
      childPages.forEach((childPage) => { if (childPage && childPage.id) tree.addPage(childPage); });
    });
    // Set rootId to first root page, or fallback to first page if any exist
    if (firstRootId) {
      tree.rootId = firstRootId;
    } else if (Object.keys(tree.pages).length > 0) {
      tree.rootId = Object.keys(tree.pages)[0];
    }
    return tree;
  }

  processTexts(
    _filePathOrBuffer: string | Buffer,
    _translations: Map<string, string>,
    _outputPath: string
  ): Buffer {
    throw new Error('OPML processTexts not implemented');
  }

  saveFromTree(tree: AACTree, outputPath: string) {
      // Helper to recursively build outline nodes
      function buildOutline(page: AACPage): any {
      const outline: any = {
        '@_text': page.name,
      };
      // Find child pages (by NAVIGATE buttons)
      const childOutlines = page.buttons
        .filter((b) => b.type === 'NAVIGATE' && !!b.targetPageId && !!tree.pages[b.targetPageId!])
        .map((b) => buildOutline(tree.pages[b.targetPageId!]));
      if (childOutlines.length) outline.outline = childOutlines;
      return outline;
    }
    // Find root pages (no parentId or not navigated to by any button)
    const navigatedIds = new Set<string>();
    Object.values(tree.pages).forEach((page) => {
      page.buttons.forEach((b) => {
        if (b.type === 'NAVIGATE' && b.targetPageId) navigatedIds.add(b.targetPageId);
      });
    });
    let rootPages = Object.values(tree.pages).filter((page) => !navigatedIds.has(page.id));
    // If no rootPages, fall back to tree.rootId
    const treeRootId = tree.rootId;
    if ((!rootPages || rootPages.length === 0) && treeRootId && tree.pages[treeRootId]) {
      rootPages = [tree.pages[treeRootId]];
    } else if (treeRootId) {
      rootPages = rootPages.sort((a, b) => (a.id === treeRootId ? -1 : b.id === treeRootId ? 1 : 0));
    }
    // Build outlines
    const outlines = rootPages.map(buildOutline);
    // Compose OPML document
    const opmlObj = {
      opml: {
        '@_version': '2.0',
        head: { title: 'Exported OPML' },
        body: { outline: outlines },
      },
    };
    // Convert to XML
    const { XMLBuilder } = require('fast-xml-parser');
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: '    ',
      suppressEmptyNode: false,
      attributeNamePrefix: '@_',
    });
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(opmlObj);
    fs.writeFileSync(outputPath, xml, 'utf8');
  }
}

export { OpmlProcessor };

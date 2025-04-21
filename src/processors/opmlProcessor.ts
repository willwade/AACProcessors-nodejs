import { BaseProcessor } from '../core/baseProcessor';
import { AACTree, AACPage, AACButton } from '../core/treeStructure';
// Removed unused import: FileProcessor
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';

interface OpmlOutline {
  _attributes: {
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
  ): { page: AACPage; childPages: AACPage[] } {
    if (!outline || (typeof outline !== 'object')) {
      return { page: null as any, childPages: [] };
    }
    const text = (outline._attributes && typeof outline._attributes.text === 'string')
      ? outline._attributes.text
      : (typeof (outline as any).text === 'string' ? (outline as any).text : undefined);
    if (!text) {
      // Skip invalid outlines
      return { page: null as any, childPages: [] };
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
        const button = new AACButton({
          id: `nav_${page.id}_${child._attributes.text}`,
          label: child._attributes.text,
          message: '',
          type: 'NAVIGATE',
          targetPageId: child._attributes.text.replace(/[^a-zA-Z0-9]/g, '_'),
          action: {
            type: 'NAVIGATE',
            targetPageId: child._attributes.text.replace(/[^a-zA-Z0-9]/g, '_'),
          },
        });
        page.addButton(button);

        const { page: childPage, childPages: grandChildren } = this.processOutline(child, page.id);
        if (childPage && childPage.id) childPages.push(childPage, ...grandChildren);
      });
    }

    if (!page || !page.id) return { page: null as any, childPages: [] };
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
    console.log('PARSED OPML DATA:', JSON.stringify(data, null, 2));
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
    console.log('saveFromTree: ENTERED');
    const fs = require('fs');
    fs.writeFileSync(require('path').join(__dirname, '../../test/sft_was_called.txt'), 'saveFromTree was called');
    try {
      const resolvedPath = require('path').resolve(outputPath);
      console.log('saveFromTree: resolved outputPath =', resolvedPath);
      fs.writeFileSync(resolvedPath, 'TEST STRING - confirming write');
      console.log('saveFromTree: test string written to', resolvedPath);
      // Now proceed with XML export
      console.log('saveFromTree: starting OPML export to', outputPath);
      // Helper to recursively build outline nodes
      function buildOutline(page: AACPage): any {
      const outline: any = {
        _attributes: { text: page.name },
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
        _attributes: { version: '2.0' },
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
      attributeNamePrefix: '',
    });
    let xml = '';
    try {
      const resolvedPath = require('path').resolve(outputPath);
      console.log('saveFromTree: resolved outputPath =', resolvedPath);
      xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(opmlObj);
      console.log('saveFromTree: XML to write:', xml.slice(0, 500));
      const FileProcessor = require('../core/fileProcessor').default;
      FileProcessor.writeFile(outputPath, xml);
      if (fs.existsSync(outputPath)) {
        console.log('saveFromTree: out.opml EXISTS at', outputPath);
        try {
          const written = fs.readFileSync(outputPath, 'utf8');
          console.log('saveFromTree: out.opml contents:', written.slice(0, 500));
        } catch (e) {
          console.error('saveFromTree: Could not read back out.opml:', e);
        }
      } else {
        console.error('saveFromTree: out.opml DOES NOT EXIST at', outputPath);
      }
    } catch (err) {
      console.error('saveFromTree: ERROR during XML build or file write:', err);
    }
    console.log('saveFromTree: OPML export complete');
    } catch (err) {
      console.error('saveFromTree: ERROR exporting OPML (outer catch):', err);
      throw err;
    }
    console.log('saveFromTree: EXITED');
  
}

}

export { OpmlProcessor };

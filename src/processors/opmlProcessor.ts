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
    if (!outline || typeof outline !== 'object') {
      return { page: null, childPages: [] };
    }
    const text =
      outline['@_text'] ||
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
      const children = Array.isArray(outline.outline) ? outline.outline : [outline.outline];
      children.forEach((child) => {
        const childText =
          child['@_text'] || (child._attributes && child._attributes.text) || (child as any).text;
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

          const { page: childPage, childPages: grandChildren } = this.processOutline(
            child,
            page.id
          );
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
      // Handle different attribute formats
      let textValue: string | undefined;

      if (node && node._attributes && typeof node._attributes.text === 'string') {
        textValue = node._attributes.text;
      } else if (node && typeof node['@_text'] === 'string') {
        textValue = node['@_text'];
      } else if (node && typeof node.text === 'string') {
        textValue = node.text;
      }

      if (textValue) {
        texts.push(textValue);
      }

      if (node && node.outline) {
        const children = Array.isArray(node.outline) ? node.outline : [node.outline];
        children.forEach(processNode);
      }
    }

    const outlines = Array.isArray(data.opml.body.outline)
      ? data.opml.body.outline
      : [data.opml.body.outline];
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

    // Handle case where body.outline might not exist or be in different formats
    const bodyOutline = data.opml?.body?.outline;
    if (!bodyOutline) {
      return tree; // Return empty tree if no outline data
    }

    const outlines = Array.isArray(bodyOutline) ? bodyOutline : [bodyOutline];
    let firstRootId: string | null = null;
    outlines.forEach((outline) => {
      const { page, childPages } = this.processOutline(outline);
      if (page && page.id) {
        tree.addPage(page);
        if (!firstRootId) firstRootId = page.id;
      }
      childPages.forEach((childPage) => {
        if (childPage && childPage.id) tree.addPage(childPage);
      });
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
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string
  ): Buffer {
    const content =
      typeof filePathOrBuffer === 'string'
        ? fs.readFileSync(filePathOrBuffer, 'utf8')
        : filePathOrBuffer.toString('utf8');

    let translatedContent = content;

    // Apply translations to text attributes in OPML outline elements
    translations.forEach((translation, originalText) => {
      if (typeof originalText === 'string' && typeof translation === 'string') {
        // Replace text attributes in outline elements
        const textAttrRegex = new RegExp(
          `text="${originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
          'g'
        );
        translatedContent = translatedContent.replace(textAttrRegex, `text="${translation}"`);
      }
    });

    const resultBuffer = Buffer.from(translatedContent, 'utf8');

    // Save to output path
    fs.writeFileSync(outputPath, resultBuffer);

    return resultBuffer;
  }

  saveFromTree(tree: AACTree, outputPath: string) {
    // Helper to recursively build outline nodes with cycle detection
    function buildOutline(page: AACPage, visited: Set<string> = new Set()): any {
      // Prevent infinite recursion by tracking visited pages
      if (visited.has(page.id)) {
        return {
          '@_text': `${page.name || page.id} (circular reference)`,
        };
      }

      visited.add(page.id);

      const outline: any = {
        '@_text': page.name || page.id,
      };

      // Find child pages (by NAVIGATE buttons)
      const childOutlines = page.buttons
        .filter((b) => b.type === 'NAVIGATE' && !!b.targetPageId && !!tree.pages[b.targetPageId])
        .map((b) => buildOutline(tree.pages[b.targetPageId!], new Set(visited))); // Pass copy of visited set
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
      rootPages = rootPages.sort((a, b) =>
        a.id === treeRootId ? -1 : b.id === treeRootId ? 1 : 0
      );
    }
    // Build outlines
    const outlines = rootPages.map((page) => buildOutline(page));
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

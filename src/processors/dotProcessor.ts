import {
  BaseProcessor,
  ProcessorOptions,
  ExtractStringsResult,
  TranslatedString,
  SourceString,
} from '../core/baseProcessor';
import { AACTree, AACPage, AACButton, AACSemanticIntent } from '../core/treeStructure';
// Removed unused import: FileProcessor
import fs from 'fs';

interface DotNode {
  id: string;
  label: string;
}

interface DotEdge {
  from: string;
  to: string;
  label?: string;
}

class DotProcessor extends BaseProcessor {
  constructor(options?: ProcessorOptions) {
    super(options);
  }
  private parseDotFile(content: string): {
    nodes: Array<DotNode & { id: string; label: string }>;
    edges: Array<DotEdge & { from: string; to: string }>;
  } {
    const nodes = new Map<string, DotNode>();
    const edges: DotEdge[] = [];

    // Extract all edge statements using regex to handle single-line DOT files
    const edgeRegex = /"?([^"\s]+)"?\s*->\s*"?([^"\s]+)"?(?:\s*\[label="([^"]+)"\])?/g;
    const nodeRegex = /"?([^"\s]+)"?\s*\[label="([^"]+)"\]/g;

    // Find all explicit node definitions
    let nodeMatch;
    while ((nodeMatch = nodeRegex.exec(content)) !== null) {
      const [, id, label] = nodeMatch;
      nodes.set(id, { id, label });
    }

    // Find all edge definitions
    let edgeMatch;
    while ((edgeMatch = edgeRegex.exec(content)) !== null) {
      const [, from, to, label] = edgeMatch;
      edges.push({ from, to, label });

      // Add nodes if they don't exist (implicit definition)
      if (!nodes.has(from)) {
        nodes.set(from, { id: from, label: from });
      }
      if (!nodes.has(to)) {
        nodes.set(to, { id: to, label: to });
      }
    }

    return { nodes: Array.from(nodes.values()), edges };
  }

  extractTexts(filePathOrBuffer: string | Buffer): string[] {
    const content =
      typeof filePathOrBuffer === 'string'
        ? fs.readFileSync(filePathOrBuffer, 'utf8')
        : filePathOrBuffer.toString('utf8');

    const { nodes, edges } = this.parseDotFile(content);
    const texts: string[] = [];

    // Collect node labels
    for (const node of nodes) {
      texts.push(node.label);
    }

    // Collect edge labels
    for (const edge of edges) {
      if (edge.label) {
        texts.push(edge.label);
      }
    }

    return texts;
  }

  loadIntoTree(filePathOrBuffer: string | Buffer): AACTree {
    let content: string;

    try {
      content =
        typeof filePathOrBuffer === 'string'
          ? fs.readFileSync(filePathOrBuffer, 'utf8')
          : filePathOrBuffer.toString('utf8');
    } catch (error) {
      // Re-throw file system errors (like file not found)
      if (typeof filePathOrBuffer === 'string') {
        throw error;
      }
      // For buffer errors, return empty tree
      return new AACTree();
    }

    // Check if content looks like text and is non-empty
    if (!content || content.trim().length === 0) {
      return new AACTree();
    }

    // Check for binary data (contains null bytes or non-printable characters) without control-regex
    const head = content.substring(0, 100);
    let hasControl = false;
    for (let i = 0; i < head.length; i++) {
      const code = head.charCodeAt(i);
      if (code === 0 || (code >= 0 && code <= 8) || (code >= 14 && code <= 31) || code >= 127) {
        hasControl = true;
        break;
      }
    }
    if (hasControl) {
      return new AACTree();
    }

    const { nodes, edges } = this.parseDotFile(content);
    const tree = new AACTree();

    // Create pages for each node and add a self button representing the node label
    for (const node of nodes) {
      const page = new AACPage({
        id: node.id,
        name: node.label,
        grid: [],
        buttons: [],
        parentId: null,
      });
      tree.addPage(page);

      // Add a self button so single-node graphs yield one button
      page.addButton(
        new AACButton({
          id: `${node.id}_self`,
          label: node.label,
          message: node.label,
          semanticAction: {
            intent: AACSemanticIntent.SPEAK_TEXT,
            text: node.label,
            fallback: { type: 'SPEAK', message: node.label },
          },
        })
      );
    }

    // Create navigation buttons based on edges
    for (const edge of edges) {
      const fromPage = tree.getPage(edge.from);
      if (fromPage) {
        const button = new AACButton({
          id: `nav_${edge.from}_${edge.to}`,
          label: edge.label || edge.to,
          message: '',

          targetPageId: edge.to,
        });
        fromPage.addButton(button);
      }
    }

    return tree;
  }

  processTexts(
    filePathOrBuffer: string | Buffer,
    translations: Map<string, string>,
    outputPath: string
  ): Buffer {
    const safeBuffer = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer
      : fs.readFileSync(filePathOrBuffer);

    const content = safeBuffer.toString('utf8');
    let translatedContent = content;

    translations.forEach((translation, text) => {
      if (typeof text === 'string' && typeof translation === 'string') {
        // Escape special regex characters in the text
        const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedTranslation = translation.replace(/\$/g, '$$$$'); // Escape $ in replacement

        translatedContent = translatedContent.replace(
          new RegExp(`label="${escapedText}"`, 'g'),
          `label="${escapedTranslation}"`
        );
      }
    });

    const resultBuffer = Buffer.from(translatedContent || '', 'utf8');

    // Save to output path
    fs.writeFileSync(outputPath, resultBuffer);

    return resultBuffer;
  }

  saveFromTree(tree: AACTree, _outputPath: string): void {
    let dotContent = 'digraph AACBoard {\n';

    // Add nodes
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      dotContent += `  "${page.id}" [label="${page.name}"]\n`;
    }

    // Add edges from navigation buttons (semantic intent or legacy targetPageId)
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      page.buttons
        .filter((btn: AACButton) => {
          const intentStr = String(btn.semanticAction?.intent);
          return (
            intentStr === 'NAVIGATE_TO' || !!btn.targetPageId || !!btn.semanticAction?.targetId
          );
        })
        .forEach((btn: AACButton) => {
          const target = btn.semanticAction?.targetId || btn.targetPageId;
          if (target) {
            dotContent += `  "${page.id}" -> "${target}" [label="${btn.label}"]\n`;
          }
        });
    }

    dotContent += '}\n';
    fs.writeFileSync(_outputPath, dotContent);
  }

  /**
   * Extract strings with metadata for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  async extractStringsWithMetadata(filePath: string): Promise<ExtractStringsResult> {
    return this.extractStringsWithMetadataGeneric(filePath);
  }

  /**
   * Generate translated download for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  async generateTranslatedDownload(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[]
  ): Promise<string> {
    return this.generateTranslatedDownloadGeneric(filePath, translatedStrings, sourceStrings);
  }
}

export { DotProcessor };

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
import path from 'path';
import { ValidationFailureError, buildValidationResultFromMessage } from '../validation';

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

    // We need to find nodes, but avoid matching the target of an edge which might look like a node definition
    // e.g. A -> B [label="L"]  -- "B [label="L"]" looks like a node def
    // Strategy: Find all edges, record them, and then "mask" them in the content to avoid false positives for nodes

    let maskedContent = content;
    let edgeMatch;

    // Find all edge definitions
    while ((edgeMatch = edgeRegex.exec(content)) !== null) {
      const [fullMatch, from, to, label] = edgeMatch;
      edges.push({ from, to, label });

      // Add nodes if they don't exist (implicit definition)
      if (!nodes.has(from)) {
        nodes.set(from, { id: from, label: from });
      }
      if (!nodes.has(to)) {
        nodes.set(to, { id: to, label: to });
      }

      // Mask this edge in the content so we don't match it as a node
      // We replace it with spaces to preserve indices if needed, but simple replacement is enough here
      maskedContent = maskedContent.replace(fullMatch, ' '.repeat(fullMatch.length));
    }

    // Now find explicit node definitions in the masked content
    // This regex matches: ID [label="LABEL"]
    // We use a non-greedy match for the label content to handle escaped quotes if possible,
    // but the previous regex `[^"]+` was too simple.
    // Better regex for quoted string content: (?:[^"\\]|\\.)*
    const nodeRegex = /"?([^"\s]+)"?\s*\[label="((?:[^"\\]|\\.)*)"\]/g;

    let nodeMatch;
    while ((nodeMatch = nodeRegex.exec(maskedContent)) !== null) {
      const [, id, rawLabel] = nodeMatch;
      // Unescape the label: replace \" with " and \\ with \
      const label = rawLabel.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      // Only update if not already defined or if we want to override the implicit label
      nodes.set(id, { id, label });
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
    const filename =
      typeof filePathOrBuffer === 'string' ? path.basename(filePathOrBuffer) : 'upload.dot';
    const buffer = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer
      : fs.readFileSync(filePathOrBuffer);
    const filesize = buffer.byteLength;

    try {
      const content = buffer.toString('utf8');

      if (!content || content.trim().length === 0) {
        const validation = buildValidationResultFromMessage({
          filename,
          filesize,
          format: 'dot',
          message: 'DOT file is empty',
          type: 'content',
          description: 'DOT file content',
        });
        throw new ValidationFailureError('Empty DOT content', validation);
      }

      // Check for binary data (contains null bytes or non-printable characters)
      const head = content.substring(0, 100);
      for (let i = 0; i < head.length; i++) {
        const code = head.charCodeAt(i);
        if (code === 0 || (code >= 0 && code <= 8) || (code >= 14 && code <= 31)) {
          const validation = buildValidationResultFromMessage({
            filename,
            filesize,
            format: 'dot',
            message: 'DOT appears to be binary data',
            type: 'content',
            description: 'DOT file content',
          });
          throw new ValidationFailureError('Invalid DOT content', validation);
        }
      }

      const { nodes, edges } = this.parseDotFile(content);
      const tree = new AACTree();
      tree.metadata.format = 'dot';

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
    } catch (error: any) {
      if (error instanceof ValidationFailureError) {
        throw error;
      }

      const validation = buildValidationResultFromMessage({
        filename,
        filesize,
        format: 'dot',
        message: error?.message || 'Failed to parse DOT file',
        type: 'parse',
        description: 'Parse DOT graph',
      });
      throw new ValidationFailureError('Failed to load DOT file', validation, error);
    }
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
    let dotContent = `digraph "${tree.metadata?.name || 'AACBoard'}" {\n`;

    // Helper to escape DOT string
    const escapeDotString = (str: string): string => {
      return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    };

    if (tree.metadata?.name) {
      dotContent += `  label="${escapeDotString(tree.metadata.name)}";\n`;
    }

    // Add nodes
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      dotContent += `  "${page.id}" [label="${escapeDotString(page.name)}"]\n`;
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
            dotContent += `  "${page.id}" -> "${target}" [label="${escapeDotString(btn.label)}"]\n`;
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

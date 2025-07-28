import { BaseProcessor } from '../core/baseProcessor';
import { AACTree, AACPage, AACButton } from '../core/treeStructure';
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

    // Check if content looks like binary data or is empty
    if (!content || content.trim().length === 0) {
      return new AACTree();
    }

    // Check for binary data (contains null bytes or non-printable characters)
    if (content.includes('\0') || /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(content.substring(0, 100))) {
      return new AACTree();
    }

    const { nodes, edges } = this.parseDotFile(content);
    const tree = new AACTree();

    // Create pages for each node
    for (const node of nodes) {
      const page = new AACPage({
        id: node.id,
        name: node.label,
        grid: [],
        buttons: [],
        parentId: null,
      });
      tree.addPage(page);
    }

    // Create navigation buttons based on edges
    for (const edge of edges) {
      const fromPage = tree.getPage(edge.from);
      if (fromPage) {
        const button = new AACButton({
          id: `nav_${edge.from}_${edge.to}`,
          label: edge.label || edge.to,
          message: '',
          type: 'NAVIGATE',
          targetPageId: edge.to,
          action: {
            type: 'NAVIGATE',
            targetPageId: edge.to,
          },
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

    // Add edges from navigation buttons
    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      page.buttons
        .filter((btn: AACButton) => btn.type === 'NAVIGATE' && btn.targetPageId)
        .forEach((btn: AACButton) => {
          dotContent += `  "${page.id}" -> "${btn.targetPageId}" [label="${btn.label}"]\n`;
        });
    }

    dotContent += '}\n';
    fs.writeFileSync(_outputPath, dotContent);
  }
}

export { DotProcessor };

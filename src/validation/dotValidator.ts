/* eslint-disable @typescript-eslint/require-await */
import { BaseValidator } from "./baseValidator";
import { ValidationResult } from "./validationTypes";
import {
  decodeText,
  defaultFileAdapter,
  FileAdapter,
  getBasename,
  toUint8Array,
} from "../utils/io";

/**
 * Validator for Graphviz DOT files
 */
export class DotValidator extends BaseValidator {
  static async validateFile(
    filePath: string,
    fileAdapter?: FileAdapter,
  ): Promise<ValidationResult> {
    const { readBinaryFromInput, getFileSize } =
      fileAdapter ?? defaultFileAdapter;
    const validator = new DotValidator();
    const content = await readBinaryFromInput(filePath);
    const size = await getFileSize(filePath);
    return validator.validate(content, getBasename(filePath), size);
  }

  static async identifyFormat(
    content: any,
    filename: string,
  ): Promise<boolean> {
    const name = filename.toLowerCase();
    if (name.endsWith(".dot")) return true;

    try {
      if (
        typeof content !== "string" &&
        !(content instanceof ArrayBuffer) &&
        !(content instanceof Uint8Array)
      ) {
        return false;
      }
      const str =
        typeof content === "string"
          ? content
          : decodeText(toUint8Array(content));
      return str.includes("digraph") || str.includes("->");
    } catch {
      return false;
    }
  }

  async validate(
    content: Buffer | Uint8Array,
    filename: string,
    filesize: number,
  ): Promise<ValidationResult> {
    this.reset();

    await this.add_check("filename", "file extension", async () => {
      if (!filename.toLowerCase().endsWith(".dot")) {
        this.warn("filename should end with .dot");
      }
    });

    let text = "";
    await this.add_check("text", "text content", async () => {
      text = decodeText(content);
      if (!text.trim()) {
        this.err("DOT file is empty", true);
      }
      // Basic control character check
      const head = text.substring(0, 200);
      for (let i = 0; i < head.length; i++) {
        const code = head.charCodeAt(i);
        if (code === 0) {
          this.err("DOT appears to be binary data", true);
        }
      }
    });

    if (!text) {
      return this.buildResult(filename, filesize, "dot");
    }

    let nodes: Array<{ id: string; label: string }> = [];
    let edges: Array<{ from: string; to: string; label?: string }> = [];

    await this.add_check("structure", "graph structure", async () => {
      const edgeRegex =
        /"?([^"\s]+)"?\s*->\s*"?([^"\s]+)"?(?:\s*\[label="([^"]+)"\])?/g;
      let maskedContent = text;
      let edgeMatch;
      edges = [];
      const nodeMap = new Map<string, { id: string; label: string }>();

      while ((edgeMatch = edgeRegex.exec(text)) !== null) {
        const [fullMatch, from, to, label] = edgeMatch;
        edges.push({ from, to, label });
        nodeMap.set(from, { id: from, label: from });
        nodeMap.set(to, { id: to, label: to });
        maskedContent = maskedContent.replace(
          fullMatch,
          " ".repeat(fullMatch.length),
        );
      }

      const nodeRegex = /"?([^"\s]+)"?\s*\[label="((?:[^"\\]|\\.)*)"\]/g;
      let nodeMatch;
      while ((nodeMatch = nodeRegex.exec(maskedContent)) !== null) {
        const [, id, rawLabel] = nodeMatch;
        const label = rawLabel.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        nodeMap.set(id, { id, label });
      }

      nodes = Array.from(nodeMap.values());
      if (nodes.length === 0 && edges.length === 0) {
        this.err("no nodes or edges found in DOT content", true);
      }
    });

    await this.add_check("connections", "navigation edges", async () => {
      if (edges.length === 0) {
        this.warn("graph contains no edges; navigation buttons may be missing");
      }
    });

    return this.buildResult(filename, filesize, "dot");
  }
}

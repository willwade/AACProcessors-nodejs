import fs from "fs";
import path from "path";

type FileFormat =
  | "gridset"
  | "coughdrop"
  | "touchchat"
  | "snap"
  | "dot"
  | "opml"
  | "unknown";

class FileProcessor {
  // Read a file and return its contents as a Buffer
  static readFile(filePath: string): Buffer {
    return fs.readFileSync(filePath);
  }

  // Write data (Buffer or string) to a file
  static writeFile(filePath: string, data: Buffer | string): void {
    fs.writeFileSync(filePath, data);
  }

  // Detect file format based on extension or magic bytes
  static detectFormat(filePathOrBuffer: string | Buffer): FileFormat {
    if (typeof filePathOrBuffer === "string") {
      const ext = path.extname(filePathOrBuffer).toLowerCase();
      switch (ext) {
        case ".gridset":
          return "gridset";
        case ".obf":
        case ".obz":
          return "coughdrop";
        case ".ce":
        case ".wfl":
        case ".touchchat":
          return "touchchat";
        case ".sps":
        case ".spb":
          return "snap";
        case ".dot":
          return "dot";
        case ".opml":
          return "opml";
        default:
          return "unknown";
      }
    } else if (Buffer.isBuffer(filePathOrBuffer)) {
      // Optionally: inspect magic bytes here
      return "unknown";
    }
    return "unknown";
  }
}

export default FileProcessor;

// Step 6: Implement FileProcessor (file reading/writing, format detection)
const fs = require('fs');
const path = require('path');

class FileProcessor {
  // Read a file and return its contents as a Buffer
  static readFile(filePath) {
    return fs.readFileSync(filePath);
  }

  // Write data (Buffer or string) to a file
  static writeFile(filePath, data) {
    fs.writeFileSync(filePath, data);
  }

  // Detect file format based on extension or magic bytes
  static detectFormat(filePathOrBuffer) {
    if (typeof filePathOrBuffer === 'string') {
      const ext = path.extname(filePathOrBuffer).toLowerCase();
      switch (ext) {
        case '.gridset':
          return 'gridset';
        case '.obf':
        case '.obz':
          return 'coughdrop';
        case '.touchchat':
          return 'touchchat';
        case '.spb':
          return 'snap';
        case '.dot':
          return 'dot';
        case '.opml':
          return 'opml';
        default:
          return 'unknown';
      }
    } else if (Buffer.isBuffer(filePathOrBuffer)) {
      // Optionally: inspect magic bytes here
      return 'unknown';
    }
    return 'unknown';
  }
}

module.exports = FileProcessor;

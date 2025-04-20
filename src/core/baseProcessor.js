// Step 5: Implement BaseProcessor (abstract class/interface)
// All format processors should extend this class

class BaseProcessor {
  // Extract all text content (for translation, analysis, etc.)
  extractTexts(filePathOrBuffer) {
    throw new Error('extractTexts() must be implemented by subclass');
  }

  // Load file into common tree structure
  loadIntoTree(filePathOrBuffer) {
    throw new Error('loadIntoTree() must be implemented by subclass');
  }

  // Process texts (e.g., apply translations) and return new file/buffer
  processTexts(filePathOrBuffer, translations, outputPath) {
    throw new Error('processTexts() must be implemented by subclass');
  }

  // Save tree structure back to file/buffer
  saveFromTree(tree, outputPath) {
    throw new Error('saveFromTree() must be implemented by subclass');
  }
}

module.exports = BaseProcessor;

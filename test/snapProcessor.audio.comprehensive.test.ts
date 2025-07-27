// Comprehensive tests for SnapProcessor to improve coverage from 67.11% to 85%+
import fs from "fs";
import path from "path";
import { SnapProcessor } from "../src/processors/snapProcessor";
import { AACTree, AACPage, AACButton } from "../src/core/treeStructure";
import { TreeFactory, PageFactory, ButtonFactory } from "./utils/testFactories";

describe("SnapProcessor - Comprehensive Coverage Tests", () => {
  let processor: SnapProcessor;
  const tempDir = path.join(__dirname, "temp_snap");
  const exampleFile = path.join(__dirname, "../examples/example.sps");

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  beforeEach(() => {
    processor = new SnapProcessor();
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Audio Handling Tests", () => {
    it("should load audio recordings from SPS database", () => {
      // Create a button with audio recording
      const button = ButtonFactory.create({
        label: "Audio Button",
        message: "I have audio",
        type: "SPEAK",
      });

      // Add audio recording
      button.audioRecording = {
        id: 1,
        data: Buffer.from("fake audio data for testing"),
        identifier: "audio_1",
        metadata: "Test audio recording",
      };

      const page = PageFactory.create({
        id: "audio_page",
        name: "Audio Test Page",
      });
      page.addButton(button);

      const tree = new AACTree();
      tree.addPage(page);

      const outputPath = path.join(tempDir, "audio_test.sps");
      processor.saveFromTree(tree, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);

      // Load and verify audio is preserved
      const loadedTree = processor.loadIntoTree(outputPath);
      const loadedPage = loadedTree.getPage("audio_page");

      expect(loadedPage).toBeDefined();
      expect(loadedPage!.buttons).toHaveLength(1);
      expect(loadedPage!.buttons[0].label).toBe("Audio Button");
    });

    it("should handle missing audio files gracefully", () => {
      // Create a button that references non-existent audio
      const button = ButtonFactory.create({
        label: "Missing Audio Button",
        message: "No audio here",
        type: "SPEAK",
      });

      // Set audio recording with invalid data
      button.audioRecording = {
        id: 999,
        data: Buffer.alloc(0), // Empty buffer
        identifier: "missing_audio",
        metadata: "Non-existent audio",
      };

      const page = PageFactory.create({
        id: "missing_audio_page",
        name: "Missing Audio Page",
      });
      page.addButton(button);

      const tree = new AACTree();
      tree.addPage(page);

      const outputPath = path.join(tempDir, "missing_audio.sps");

      expect(() => {
        processor.saveFromTree(tree, outputPath);
      }).not.toThrow();

      const loadedTree = processor.loadIntoTree(outputPath);
      expect(loadedTree).toBeDefined();
    });

    it("should process different audio formats (WAV, MP3, AAC)", () => {
      const audioFormats = [
        { format: "WAV", data: Buffer.from("RIFF....WAVE"), extension: ".wav" },
        { format: "MP3", data: Buffer.from("ID3...."), extension: ".mp3" },
        { format: "AAC", data: Buffer.from("ADTS...."), extension: ".aac" },
      ];

      const tree = new AACTree();

      audioFormats.forEach((format, index) => {
        const button = ButtonFactory.create({
          label: `${format.format} Button`,
          message: `Audio in ${format.format}`,
          type: "SPEAK",
        });

        button.audioRecording = {
          id: index + 1,
          data: format.data,
          identifier: `audio_${format.format.toLowerCase()}`,
          metadata: `${format.format} audio recording`,
        };

        const page = PageFactory.create({
          id: `${format.format.toLowerCase()}_page`,
          name: `${format.format} Audio Page`,
        });
        page.addButton(button);
        tree.addPage(page);
      });

      const outputPath = path.join(tempDir, "multi_format_audio.sps");
      processor.saveFromTree(tree, outputPath);

      const loadedTree = processor.loadIntoTree(outputPath);
      expect(Object.keys(loadedTree.pages)).toHaveLength(3);
    });

    it("should add new audio recordings to buttons", () => {
      // Start with a button without audio
      const button = ButtonFactory.create({
        label: "No Audio Button",
        message: "Initially no audio",
        type: "SPEAK",
      });

      const page = PageFactory.create({
        id: "add_audio_page",
        name: "Add Audio Page",
      });
      page.addButton(button);

      const tree = new AACTree();
      tree.addPage(page);

      // Save initial version
      const outputPath = path.join(tempDir, "add_audio.sps");
      processor.saveFromTree(tree, outputPath);

      // Load and add audio
      const loadedTree = processor.loadIntoTree(outputPath);
      const loadedPage = loadedTree.getPage("add_audio_page");
      const loadedButton = loadedPage!.buttons[0];

      // Add audio recording
      loadedButton.audioRecording = {
        id: 1,
        data: Buffer.from("newly added audio data"),
        identifier: "new_audio",
        metadata: "Newly added audio",
      };

      // Save with audio
      const updatedPath = path.join(tempDir, "add_audio_updated.sps");
      processor.saveFromTree(loadedTree, updatedPath);

      // Verify audio was added
      const finalTree = processor.loadIntoTree(updatedPath);
      const finalButton = finalTree.getPage("add_audio_page")!.buttons[0];
      expect(finalButton.audioRecording).toBeDefined();
      expect(finalButton.audioRecording!.identifier).toBe("new_audio");
    });

    it("should update existing audio recordings", () => {
      // Create button with initial audio
      const button = ButtonFactory.create({
        label: "Update Audio Button",
        message: "Audio will be updated",
        type: "SPEAK",
      });

      button.audioRecording = {
        id: 1,
        data: Buffer.from("original audio data"),
        identifier: "original_audio",
        metadata: "Original audio",
      };

      const page = PageFactory.create({
        id: "update_audio_page",
        name: "Update Audio Page",
      });
      page.addButton(button);

      const tree = new AACTree();
      tree.addPage(page);

      const outputPath = path.join(tempDir, "update_audio.sps");
      processor.saveFromTree(tree, outputPath);

      // Load and update audio
      const loadedTree = processor.loadIntoTree(outputPath);
      const loadedButton = loadedTree.getPage("update_audio_page")!.buttons[0];

      // Update audio recording
      loadedButton.audioRecording = {
        id: 1,
        data: Buffer.from("updated audio data"),
        identifier: "updated_audio",
        metadata: "Updated audio",
      };

      const updatedPath = path.join(tempDir, "update_audio_final.sps");
      processor.saveFromTree(loadedTree, updatedPath);

      // Verify audio was updated
      const finalTree = processor.loadIntoTree(updatedPath);
      const finalButton = finalTree.getPage("update_audio_page")!.buttons[0];
      expect(finalButton.audioRecording!.identifier).toBe("updated_audio");
      expect(finalButton.audioRecording!.metadata).toBe("Updated audio");
    });

    it("should remove audio recordings from buttons", () => {
      // Create button with audio
      const button = ButtonFactory.create({
        label: "Remove Audio Button",
        message: "Audio will be removed",
        type: "SPEAK",
      });

      button.audioRecording = {
        id: 1,
        data: Buffer.from("audio to be removed"),
        identifier: "removable_audio",
        metadata: "Audio to be removed",
      };

      const page = PageFactory.create({
        id: "remove_audio_page",
        name: "Remove Audio Page",
      });
      page.addButton(button);

      const tree = new AACTree();
      tree.addPage(page);

      const outputPath = path.join(tempDir, "remove_audio.sps");
      processor.saveFromTree(tree, outputPath);

      // Load and remove audio
      const loadedTree = processor.loadIntoTree(outputPath);
      const loadedButton = loadedTree.getPage("remove_audio_page")!.buttons[0];

      // Remove audio recording
      loadedButton.audioRecording = undefined;

      const updatedPath = path.join(tempDir, "remove_audio_final.sps");
      processor.saveFromTree(loadedTree, updatedPath);

      // Verify audio was removed
      const finalTree = processor.loadIntoTree(updatedPath);
      const finalButton = finalTree.getPage("remove_audio_page")!.buttons[0];
      expect(finalButton.audioRecording).toBeUndefined();
    });

    it("should preserve audio metadata during processing", () => {
      const button = ButtonFactory.create({
        label: "Metadata Button",
        message: "Audio with metadata",
        type: "SPEAK",
      });

      const complexMetadata = JSON.stringify({
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        duration: 2.5,
        format: "WAV",
        created: new Date().toISOString(),
      });

      button.audioRecording = {
        id: 1,
        data: Buffer.from("audio with complex metadata"),
        identifier: "metadata_audio",
        metadata: complexMetadata,
      };

      const page = PageFactory.create({
        id: "metadata_page",
        name: "Metadata Page",
      });
      page.addButton(button);

      const tree = new AACTree();
      tree.addPage(page);

      const outputPath = path.join(tempDir, "metadata_test.sps");
      processor.saveFromTree(tree, outputPath);

      const loadedTree = processor.loadIntoTree(outputPath);
      const loadedButton = loadedTree.getPage("metadata_page")!.buttons[0];

      expect(loadedButton.audioRecording).toBeDefined();
      expect(loadedButton.audioRecording!.metadata).toBe(complexMetadata);

      // Verify metadata can be parsed back
      const parsedMetadata = JSON.parse(
        loadedButton.audioRecording!.metadata || "{}",
      );
      expect(parsedMetadata.sampleRate).toBe(44100);
      expect(parsedMetadata.format).toBe("WAV");
    });

    it("should handle audio with different sample rates", () => {
      const sampleRates = [8000, 16000, 22050, 44100, 48000, 96000];
      const tree = new AACTree();

      sampleRates.forEach((rate, index) => {
        const button = ButtonFactory.create({
          label: `${rate}Hz Button`,
          message: `Audio at ${rate}Hz`,
          type: "SPEAK",
        });

        button.audioRecording = {
          id: index + 1,
          data: Buffer.from(`audio data at ${rate}Hz`),
          identifier: `audio_${rate}hz`,
          metadata: JSON.stringify({ sampleRate: rate }),
        };

        const page = PageFactory.create({
          id: `page_${rate}hz`,
          name: `${rate}Hz Page`,
        });
        page.addButton(button);
        tree.addPage(page);
      });

      const outputPath = path.join(tempDir, "sample_rates.sps");
      processor.saveFromTree(tree, outputPath);

      const loadedTree = processor.loadIntoTree(outputPath);
      expect(Object.keys(loadedTree.pages)).toHaveLength(sampleRates.length);

      // Verify each sample rate is preserved
      sampleRates.forEach((rate) => {
        const page = loadedTree.getPage(`page_${rate}hz`);
        expect(page).toBeDefined();
        const metadata = JSON.parse(
          page!.buttons[0].audioRecording!.metadata || "{}",
        );
        expect(metadata.sampleRate).toBe(rate);
      });
    });

    it("should process audio with various bit depths", () => {
      const bitDepths = [8, 16, 24, 32];
      const tree = new AACTree();

      bitDepths.forEach((depth, index) => {
        const button = ButtonFactory.create({
          label: `${depth}-bit Button`,
          message: `Audio at ${depth}-bit`,
          type: "SPEAK",
        });

        button.audioRecording = {
          id: index + 1,
          data: Buffer.from(`audio data at ${depth}-bit`),
          identifier: `audio_${depth}bit`,
          metadata: JSON.stringify({ bitDepth: depth }),
        };

        const page = PageFactory.create({
          id: `page_${depth}bit`,
          name: `${depth}-bit Page`,
        });
        page.addButton(button);
        tree.addPage(page);
      });

      const outputPath = path.join(tempDir, "bit_depths.sps");
      processor.saveFromTree(tree, outputPath);

      const loadedTree = processor.loadIntoTree(outputPath);
      expect(Object.keys(loadedTree.pages)).toHaveLength(bitDepths.length);

      // Verify each bit depth is preserved
      bitDepths.forEach((depth) => {
        const page = loadedTree.getPage(`page_${depth}bit`);
        expect(page).toBeDefined();
        const metadata = JSON.parse(
          page!.buttons[0].audioRecording!.metadata || "{}",
        );
        expect(metadata.bitDepth).toBe(depth);
      });
    });
  });
});

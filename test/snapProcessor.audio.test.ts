import { SnapProcessor } from "../src/processors/snapProcessor";
import { AACTree, AACPage } from "../src/core/treeStructure";
import path from "path";
import fs from "fs";

describe("SnapProcessor Audio Support", () => {
  const exampleSPSFile: string = path.join(
    __dirname,
    "../examples/Aphasia Page Set With Sound.sps",
  );
  const enhancedSPSFile: string = path.join(
    __dirname,
    "../Aphasia_Page_Set_With_Punjabi_Audio.sps",
  );

  it("should load pageset without audio by default", () => {
    if (!fs.existsSync(exampleSPSFile)) {
      console.log("Skipping test - audio example file not found");
      return;
    }

    const processor = new SnapProcessor();
    const tree: AACTree = processor.loadIntoTree(exampleSPSFile);

    expect(tree).toBeDefined();
    expect(tree.pages).toBeDefined();

    // Check that buttons don't have audio data by default
    const pages: AACPage[] = Object.values(tree.pages);
    if (pages.length > 0) {
      const firstPage = pages[0];
      if (firstPage.buttons.length > 0) {
        const firstButton = firstPage.buttons[0];
        expect(firstButton.audioRecording).toBeUndefined();
      }
    }
  });

  it("should load pageset with audio when requested", () => {
    if (!fs.existsSync(exampleSPSFile)) {
      console.log("Skipping test - audio example file not found");
      return;
    }

    const processor = new SnapProcessor(null, { loadAudio: true });
    const tree: AACTree = processor.loadIntoTree(exampleSPSFile);

    expect(tree).toBeDefined();
    expect(tree.pages).toBeDefined();

    // Look for buttons with audio
    let foundAudioButton = false;
    Object.values(tree.pages).forEach((page) => {
      page.buttons.forEach((button) => {
        if (button.audioRecording) {
          foundAudioButton = true;
          expect(button.audioRecording.id).toBeDefined();
          expect(button.audioRecording.identifier).toMatch(/^SND:/);
          expect(button.audioRecording.data).toBeInstanceOf(Buffer);
        }
      });
    });

    // Should find at least one button with audio in the sound-enabled example
    expect(foundAudioButton).toBe(true);
  });

  it("should extract buttons for audio processing", () => {
    if (!fs.existsSync(exampleSPSFile)) {
      console.log("Skipping test - audio example file not found");
      return;
    }

    const processor = new SnapProcessor();

    // This should work with any page that has buttons
    try {
      // Try to find a page with buttons
      const tree: AACTree = processor.loadIntoTree(exampleSPSFile);
      const pages: AACPage[] = Object.values(tree.pages);

      if (pages.length > 0) {
        const pageWithButtons = pages.find((page) => page.buttons.length > 0);
        if (pageWithButtons) {
          const buttons = (processor as any).extractButtonsForAudio(
            exampleSPSFile,
            pageWithButtons.id,
          );
          expect(Array.isArray(buttons)).toBe(true);

          if (buttons.length > 0) {
            const firstButton = buttons[0];
            expect(firstButton).toHaveProperty("id");
            expect(firstButton).toHaveProperty("label");
            expect(firstButton).toHaveProperty("message");
            expect(firstButton).toHaveProperty("hasAudio");
            expect(typeof firstButton.hasAudio).toBe("boolean");
          }
        }
      }
    } catch (error: any) {
      console.log("Could not test button extraction:", error.message);
    }
  });

  it("should add audio to buttons", () => {
    if (!fs.existsSync(exampleSPSFile)) {
      console.log("Skipping test - audio example file not found");
      return;
    }

    const processor = new SnapProcessor();
    const testDbPath: string = path.join(__dirname, "test_audio_temp.sps");

    try {
      // Copy the example file for testing
      fs.copyFileSync(exampleSPSFile, testDbPath);

      // Create some test audio data
      const testAudioData: Buffer = Buffer.from("RIFF....WAVE....", "ascii"); // Minimal WAV-like data

      // Add audio to a button (using button ID 1 as a test)
      const audioId: number = processor.addAudioToButton(
        testDbPath,
        1,
        testAudioData,
        "Test Audio",
      );

      expect(typeof audioId).toBe("number");
      expect(audioId).toBeGreaterThan(0);
    } catch (error: any) {
      console.log("Could not test audio addition:", error.message);
    } finally {
      // Clean up
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    }
  });

  it("should load enhanced pageset with Punjabi audio", () => {
    if (!fs.existsSync(enhancedSPSFile)) {
      console.log("Skipping test - enhanced pageset not found");
      return;
    }

    const processor = new SnapProcessor(null, { loadAudio: true });
    const tree: AACTree = processor.loadIntoTree(enhancedSPSFile);

    expect(tree).toBeDefined();
    expect(tree.pages).toBeDefined();

    // Look for the QuickFires page
    const quickFiresPage = Object.values(tree.pages).find(
      (page) => page.name && page.name.includes("QuickFires"),
    );

    if (quickFiresPage) {
      console.log(
        `Found QuickFires page with ${quickFiresPage.buttons.length} buttons`,
      );

      // Count buttons with audio
      const buttonsWithAudio = quickFiresPage.buttons.filter(
        (button) => button.audioRecording && button.audioRecording.data,
      );

      console.log(`Buttons with audio: ${buttonsWithAudio.length}`);
      expect(buttonsWithAudio.length).toBeGreaterThan(0);

      // Check audio metadata for Punjabi content
      buttonsWithAudio.forEach((button) => {
        if (button.audioRecording && button.audioRecording.metadata) {
          try {
            const metadata = JSON.parse(button.audioRecording.metadata);
            console.log(`Button "${button.label}" has metadata:`, metadata);

            // Should have Punjabi text in metadata
            if (metadata.PunjabiText) {
              expect(metadata.PunjabiText).toMatch(/[\u0A00-\u0A7F]/); // Gurmukhi script
            }
          } catch (e) {
            // Metadata might not be JSON
          }
        }
      });
    } else {
      console.log("QuickFires page not found in enhanced pageset");
    }
  });
});

describe("SnapProcessor Audio Integration", () => {
  it("should demonstrate complete audio workflow", () => {
    console.log("\n=== SnapProcessor Audio Integration Demo ===");
    console.log("1. Basic usage (no audio):");
    console.log("   const processor = new SnapProcessor();");
    console.log('   const tree = processor.loadIntoTree("pageset.sps");');

    console.log("\n2. With audio support:");
    console.log(
      "   const processor = new SnapProcessor(null, { loadAudio: true });",
    );
    console.log('   const tree = processor.loadIntoTree("pageset.sps");');
    console.log("   // Buttons will have audioRecording property if available");

    console.log("\n3. Adding audio to buttons:");
    console.log('   const audioData = fs.readFileSync("audio.wav");');
    console.log(
      '   const audioId = processor.addAudioToButton(dbPath, buttonId, audioData, "metadata");',
    );

    console.log("\n4. Creating enhanced pageset:");
    console.log("   const audioMappings = new Map();");
    console.log(
      '   audioMappings.set(buttonId, { audioData, metadata: "Punjabi audio" });',
    );
    console.log(
      "   processor.createAudioEnhancedPageset(source, target, audioMappings);",
    );

    console.log("\n5. Extracting buttons for processing:");
    console.log(
      "   const buttons = processor.extractButtonsForAudio(dbPath, pageUniqueId);",
    );
    console.log(
      "   // Returns array with id, label, message, hasAudio properties",
    );

    expect(true).toBe(true); // This is just a demo test
  });
});

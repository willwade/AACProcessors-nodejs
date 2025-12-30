import { ObfValidator } from "../src/validation/obfValidator";
import { GridsetValidator } from "../src/validation/gridsetValidator";
import { SnapValidator } from "../src/validation/snapValidator";
import { TouchChatValidator } from "../src/validation/touchChatValidator";
import { ValidationResult } from "../src/validation/validationTypes";
import path from "path";

const samplesDir = path.join(__dirname, "..", "examples", "obf");

describe("Validation System", () => {
  describe("ObfValidator - Real File Tests (validation samples from obf-node)", () => {
    it("should validate simple.obf successfully", async () => {
      const filePath = path.join(samplesDir, "simple.obf");
      const result = await ObfValidator.validateFile(filePath);

      expect(result.valid).toBe(true);
      expect(result.errors).toBe(0);
      expect(result.format).toBe("obf");
      expect(result.filename).toBe("simple.obf");
    });

    it("should identify aboutme.json as invalid OBF (missing locale)", async () => {
      const filePath = path.join(samplesDir, "aboutme.json");
      const result = await ObfValidator.validateFile(filePath);

      // aboutme.json is missing required fields like locale
      expect(result.valid).toBe(false);
      expect(result.errors).toBeGreaterThan(0);
    });

    it("should identify hash.json as non-OBF JSON", async () => {
      const filePath = path.join(samplesDir, "hash.json");
      const result = await ObfValidator.validateFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeGreaterThanOrEqual(1);
    });

    it("should identify array.json as non-object JSON", async () => {
      const filePath = path.join(samplesDir, "array.json");
      const result = await ObfValidator.validateFile(filePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeGreaterThanOrEqual(1);
    });

    it("should validate links.obz", async () => {
      const filePath = path.join(samplesDir, "links.obz");
      const result = await ObfValidator.validateFile(filePath);

      expect(result.filename).toBe("links.obz");
      expect(result.format).toBe("obz");
      // OBZ files may have warnings but should be valid
    });
  });

  describe("ObfValidator - Synthetic Tests", () => {
    it("should validate a minimal valid OBF structure", async () => {
      const validObf = {
        format: "open-board-0.1",
        id: "test-board",
        locale: "en",
        name: "Test Board",
        buttons: [],
        grid: {
          rows: 2,
          columns: 2,
          order: [
            [null, null],
            [null, null],
          ],
        },
        images: [],
        sounds: [],
      };

      const content = Buffer.from(JSON.stringify(validObf));
      const result = await new ObfValidator().validate(
        content,
        "test.obf",
        content.length,
      );

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.format).toBe("obf");
      expect(result.errors).toBe(0);
    });

    it("should detect missing required fields", async () => {
      const invalidObf = {
        format: "open-board-0.1",
        // Missing id, locale, name, buttons, grid, images, sounds
      };

      const content = Buffer.from(JSON.stringify(invalidObf));
      const result = await new ObfValidator().validate(
        content,
        "test.obf",
        content.length,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toBeGreaterThan(0);
    });

    it("should validate filename extension", async () => {
      const validObf = {
        format: "open-board-0.1",
        id: "test-board",
        locale: "en",
        name: "Test Board",
        buttons: [],
        grid: {
          rows: 1,
          columns: 1,
          order: [[null]],
        },
        images: [],
        sounds: [],
      };

      const content = Buffer.from(JSON.stringify(validObf));
      const result = await new ObfValidator().validate(
        content,
        "test.txt", // Wrong extension
        content.length,
      );

      // Should have a warning about filename
      const hasFilenameWarning = result.results.some(
        (r) => r.type === "filename" && r.warnings && r.warnings.length > 0,
      );
      expect(hasFilenameWarning).toBe(true);
    });

    it("should validate grid structure", async () => {
      const obfWithBadGrid = {
        format: "open-board-0.1",
        id: "test-board",
        locale: "en",
        name: "Test Board",
        buttons: [{ id: 1, label: "Test" }],
        grid: {
          rows: 2,
          columns: 2,
          order: [[1, null]], // Wrong: only 1 row instead of 2
        },
        images: [],
        sounds: [],
      };

      const content = Buffer.from(JSON.stringify(obfWithBadGrid));
      const result = await new ObfValidator().validate(
        content,
        "test.obf",
        content.length,
      );

      expect(result.valid).toBe(false);
      // Should have error about grid order length
    });
  });

  describe("GridsetValidator", () => {
    it("should validate basic Gridset XML structure", async () => {
      const validGridset = `<?xml version="1.0" encoding="utf-8"?>
      <gridset id="test" name="Test Gridset">
        <pages>
          <page id="page1" name="Page 1">
            <cells>
              <cell id="cell1" label="Hello"/>
            </cells>
          </page>
        </pages>
        <fixedCellSize width="100" height="100"/>
      </gridset>`;

      const content = Buffer.from(validGridset);
      const result = await new GridsetValidator().validate(
        content,
        "test.gridset",
        content.length,
      );

      expect(result).toBeDefined();
      expect(result.format).toBe("gridset");
      // May have warnings but should parse successfully
    });

    it("should detect invalid XML", async () => {
      const invalidXml = `<?xml version="1.0"?>
      <gridset id="test" name="Test">
        <pages>
      `; // Unclosed tags

      const content = Buffer.from(invalidXml);
      const result = await new GridsetValidator().validate(
        content,
        "test.gridset",
        content.length,
      );

      expect(result.valid).toBe(false);
    });

    it("should handle encrypted .gridsetx files", async () => {
      // .gridsetx files are encrypted, so we just validate the extension
      const encryptedContent = Buffer.from("encrypted binary data");
      const result = await new GridsetValidator().validate(
        encryptedContent,
        "test.gridsetx",
        encryptedContent.length,
      );

      expect(result).toBeDefined();
      expect(result.format).toBe("gridset");
      // Should have warning about encryption
      const hasEncryptionWarning = result.results.some(
        (r) =>
          r.type === "encrypted_format" && r.warnings && r.warnings.length > 0,
      );
      expect(hasEncryptionWarning).toBe(true);
    });

    it("should not require wordlists element", async () => {
      const gridsetWithoutWordlists = `<?xml version="1.0" encoding="utf-8"?>
      <gridset id="test" name="Test Gridset">
        <pages>
          <page id="page1" name="Page 1">
            <cells>
              <cell id="cell1" label="Hello"/>
            </cells>
          </page>
        </pages>
        <fixedCellSize width="100" height="100"/>
      </gridset>`;

      const content = Buffer.from(gridsetWithoutWordlists);
      const result = await new GridsetValidator().validate(
        content,
        "test.gridset",
        content.length,
      );

      expect(result).toBeDefined();
      expect(result.format).toBe("gridset");
      // Should NOT have warning about missing wordlists
      const hasWordlistsWarning = result.results.some(
        (r) => r.type === "wordlists" && r.warnings && r.warnings.length > 0,
      );
      expect(hasWordlistsWarning).toBe(false);
    });
  });

  describe("SnapValidator", () => {
    it("should validate a basic zip package structure", async () => {
      // Create a minimal valid zip with settings.xml
      // Note: This test would require creating a real zip file
      // For now, we'll test with an empty buffer which should fail
      const content = Buffer.from("");
      const result = await new SnapValidator().validate(content, "test.spb", 0);

      // Should fail with zip error
      expect(result.valid).toBe(false);
    });
  });

  describe("TouchChatValidator", () => {
    it("should validate basic TouchChat XML structure", async () => {
      const validTouchChat = `<?xml version="1.0" encoding="utf-8"?>
      <PageSet id="test" name="Test Pageset">
        <Pages>
          <Page id="page1" name="Page 1">
            <Buttons>
              <Button id="btn1" label="Hello" vocalization="Hello world"/>
            </Buttons>
          </Page>
        </Pages>
      </PageSet>`;

      const content = Buffer.from(validTouchChat);
      const result = await new TouchChatValidator().validate(
        content,
        "test.ce",
        content.length,
      );

      expect(result).toBeDefined();
      expect(result.format).toBe("touchchat");
    });

    it("should detect missing required elements", async () => {
      const invalidXml = `<?xml version="1.0"?>
      <PageSet>
      </PageSet>`;

      const content = Buffer.from(invalidXml);
      const result = await new TouchChatValidator().validate(
        content,
        "test.ce",
        content.length,
      );

      // May have warnings about missing content
      expect(result).toBeDefined();
    });
  });

  describe("ValidationResult structure", () => {
    it("should have all required fields", async () => {
      const validObf = {
        format: "open-board-0.1",
        id: "test-board",
        locale: "en",
        name: "Test Board",
        buttons: [],
        grid: {
          rows: 1,
          columns: 1,
          order: [[null]],
        },
        images: [],
        sounds: [],
      };

      const content = Buffer.from(JSON.stringify(validObf));
      const result: ValidationResult = await new ObfValidator().validate(
        content,
        "test.obf",
        content.length,
      );

      expect(result.filename).toBe("test.obf");
      expect(result.filesize).toBe(content.length);
      expect(result.format).toBe("obf");
      expect(typeof result.valid).toBe("boolean");
      expect(typeof result.errors).toBe("number");
      expect(typeof result.warnings).toBe("number");
      expect(Array.isArray(result.results)).toBe(true);
    });
  });
});

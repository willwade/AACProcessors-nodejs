/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as fs from "fs";
import * as path from "path";
import * as xml2js from "xml2js";
import AdmZip from "adm-zip";
import { BaseValidator } from "./baseValidator";
import { ValidationResult } from "./validationTypes";

/**
 * Validator for Snap files (.spb, .sps)
 * Snap files are zipped packages containing XML configuration
 */
export class SnapValidator extends BaseValidator {
  constructor() {
    super();
  }

  /**
   * Validate a Snap file from disk
   */
  static async validateFile(filePath: string): Promise<ValidationResult> {
    const validator = new SnapValidator();
    const content = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
    return validator.validate(content, path.basename(filePath), stats.size);
  }

  /**
   * Check if content is Snap format
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  static async identifyFormat(
    content: any,
    filename: string,
  ): Promise<boolean> {
    const name = filename.toLowerCase();
    if (name.endsWith(".spb") || name.endsWith(".sps")) {
      return true;
    }

    // Try to parse as ZIP and check for Snap structure
    try {
      const zip = new AdmZip(content);
      const entries = zip.getEntries();
      // Snap packages typically have settings.xml or similar
      return entries.some(
        (e) => e.entryName.includes("settings") || e.entryName.includes(".xml"),
      );
    } catch {
      return false;
    }
  }

  /**
   * Main validation method
   */
  async validate(
    content: Buffer | Uint8Array,
    filename: string,
    filesize: number,
  ): Promise<ValidationResult> {
    this.reset();

    await this.add_check("filename", "file extension", async () => {
      if (!filename.match(/\.(spb|sps)$/)) {
        this.warn("filename should end with .spb or .sps");
      }
    });

    let zip: AdmZip | null = null;
    let validZip = false;

    await this.add_check("zip", "valid zip package", async () => {
      try {
        // Ensure content is a Buffer for AdmZip
        const buffer = Buffer.isBuffer(content)
          ? content
          : Buffer.from(content);
        zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        validZip = entries.length > 0;
      } catch (e: any) {
        this.err(`file is not a valid zip package: ${e.message}`, true);
      }
    });

    if (!validZip || !zip) {
      return this.buildResult(filename, filesize, "snap");
    }

    await this.validateSnapStructure(zip, filename);

    return this.buildResult(filename, filesize, "snap");
  }

  /**
   * Validate Snap package structure
   */
  private async validateSnapStructure(
    zip: AdmZip,
    _filename: string,
  ): Promise<void> {
    // Check for required files
    await this.add_check(
      "required_files",
      "required package files",
      async () => {
        const entries = zip.getEntries();
        const entryNames = entries.map((e) => e.entryName);

        // Look for common Snap files
        const hasSettings = entryNames.some((n) =>
          n.toLowerCase().includes("settings"),
        );
        const hasXml = entryNames.some((n) => n.toLowerCase().endsWith(".xml"));

        if (!hasSettings && !hasXml) {
          this.err(
            "Snap package must contain settings.xml or similar configuration file",
          );
        }

        if (entries.length === 0) {
          this.err("Snap package is empty");
        }
      },
    );

    // Try to parse and validate the main settings file
    const settingsEntry = zip
      .getEntries()
      .find((e) => e.entryName.toLowerCase().includes("settings"));

    if (settingsEntry) {
      await this.validateSettingsFile(zip, settingsEntry);
    }

    // Check for pages
    const pageEntries = zip
      .getEntries()
      .filter((e) => e.entryName.toLowerCase().includes("page"));

    await this.add_check("pages", "pages in package", async () => {
      if (pageEntries.length === 0) {
        this.warn("Snap package should contain at least one page file");
      }
    });

    // Validate a sample of pages
    const samplePages = pageEntries.slice(0, 5); // Limit to first 5 pages
    for (let i = 0; i < samplePages.length; i++) {
      await this.validatePageFile(zip, samplePages[i], i);
    }

    // Check for images
    const imageEntries = zip
      .getEntries()
      .filter((e) =>
        e.entryName.toLowerCase().match(/\.(png|jpg|jpeg|gif|bmp)$/i),
      );

    await this.add_check("images", "image files", async () => {
      if (imageEntries.length === 0) {
        this.warn("Snap package should contain image files for buttons");
      }
    });

    // Check for audio files
    const audioEntries = zip
      .getEntries()
      .filter((e) => e.entryName.toLowerCase().match(/\.(wav|mp3|m4a|ogg)$/i));

    await this.add_check("audio", "audio files", async () => {
      // Audio files are optional, so just warn if missing
      if (audioEntries.length === 0) {
        // This is informational, not a warning
      }
    });

    // Check for unexpected files
    await this.add_check(
      "unexpected_files",
      "unexpected file types",
      async () => {
        const entries = zip.getEntries();
        const unexpectedFiles = entries.filter((e) => {
          const name = e.entryName.toLowerCase();
          // Skip common system files and directories
          if (name.startsWith("__macosx") || name.startsWith(".ds_store")) {
            return false;
          }
          // Allowed file types
          return !name.match(
            /\.(xml|png|jpg|jpeg|gif|bmp|wav|mp3|m4a|ogg|json)$/i,
          );
        });

        if (unexpectedFiles.length > 0) {
          const unexpectedNames = unexpectedFiles
            .map((f) => f.entryName)
            .slice(0, 5);
          this.warn(
            `Package contains unexpected file types: ${unexpectedNames.join(", ")}`,
          );
        }
      },
    );
  }

  /**
   * Validate the main settings file
   */
  private async validateSettingsFile(zip: AdmZip, entry: any): Promise<void> {
    await this.add_check(
      "settings_format",
      "settings file format",
      async () => {
        try {
          const content = zip.readAsText(entry.entryName);
          const parser = new xml2js.Parser();
          const xml = await parser.parseStringPromise(content);

          // Check for expected root element
          if (!xml.settings && !xml.Settings && !xml.page && !xml.Page) {
            this.warn("settings file does not contain expected root element");
          }

          // Check for required settings attributes if present
          const settings = xml.settings || xml.Settings;
          if (settings) {
            const id = settings.$?.id || settings.$?.Id;
            const name = settings.$?.name || settings.$?.Name;

            if (!id && !name) {
              this.warn("settings should have an id or name attribute");
            }
          }
        } catch (e: any) {
          this.err(`Failed to parse settings file: ${e.message}`);
        }
      },
    );
  }

  /**
   * Validate a page file
   */
  private async validatePageFile(
    zip: AdmZip,
    entry: any,
    index: number,
  ): Promise<void> {
    await this.add_check(
      `page[${index}]`,
      `page file ${index}: ${entry.entryName}`,
      async () => {
        try {
          const content = zip.readAsText(entry.entryName);
          const parser = new xml2js.Parser();
          const xml = await parser.parseStringPromise(content);

          const page = xml.page || xml.Page;
          if (!page) {
            this.err(
              `Page file ${entry.entryName} does not contain a page element`,
            );
            return;
          }

          // Check page attributes
          const pageId = page.$?.id || page.$?.Id;
          if (!pageId) {
            this.warn(`Page ${entry.entryName} is missing an id attribute`);
          }

          // Check for cells/buttons
          const cells = page.cells || page.Cells || page.button || page.Button;
          if (!cells || (Array.isArray(cells) && cells.length === 0)) {
            this.warn(`Page ${entry.entryName} has no cells or buttons`);
          }
        } catch (e: any) {
          this.err(
            `Failed to parse page file ${entry.entryName}: ${e.message}`,
          );
        }
      },
    );
  }
}

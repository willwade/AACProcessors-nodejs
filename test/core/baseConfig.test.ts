import AdmZip from "adm-zip";
import { BaseProcessor } from "../../src/core/baseProcessor";
import { BaseValidator } from "../../src/validation/baseValidator";
import { ValidationResult } from "../../src/validation/validationTypes";

class TestProcessor extends BaseProcessor {
  async extractTexts(): Promise<string[]> {
    return [];
  }

  async loadIntoTree(): Promise<any> {
    return {};
  }

  async processTexts(): Promise<Buffer> {
    return Buffer.from([]);
  }

  async saveFromTree(): Promise<void> {
    return;
  }
}

class TestValidator extends BaseValidator {
  async validate(
    _content: any,
    _filename: string,
    _filesize: number,
  ): Promise<ValidationResult> {
    return this.buildResult("file", 0, "test");
  }
}

describe("base defaults", () => {
  it("BaseProcessor provides a default zipAdapter", async () => {
    const processor = new TestProcessor();
    const zip = new AdmZip();
    zip.addFile("hello.txt", Buffer.from("hello", "utf8"));
    const adapter = await (processor as any).options.zipAdapter(zip.toBuffer());

    expect(adapter.listFiles()).toContain("hello.txt");
    const contents = await adapter.readFile("hello.txt");
    expect(Buffer.from(contents).toString("utf8")).toBe("hello");
  });

  it("BaseValidator provides a default zipAdapter", async () => {
    const validator = new TestValidator();
    const zip = new AdmZip();
    zip.addFile("world.txt", Buffer.from("world", "utf8"));
    const adapter = await (validator as any)._options.zipAdapter(
      zip.toBuffer(),
    );

    expect(adapter.listFiles()).toContain("world.txt");
    const contents = await adapter.readFile("world.txt");
    expect(Buffer.from(contents).toString("utf8")).toBe("world");
  });
});

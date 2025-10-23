// CLI integration test for OBF/OBZ
const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");

describe("aac-processors CLI (OBF/OBZ)", () => {
  // Ensure build exists before running CLI tests
  beforeAll(() => {
    const cliPath = path.join(__dirname, "../../dist/cli/index.js");
    if (!fs.existsSync(cliPath)) {
      throw new Error(
        "dist/cli/index.js is missing – run `npm run build` before executing the CLI tests."
      );
    }
  });
  const cliPath = path.join(__dirname, "../../dist/cli/index.js");
  const obfExample = path.join(__dirname, "../../examples/example.obf");
  const obzExample = path.join(__dirname, "../../examples/example.obz");

  it("extracts texts from an obf file", () => {
    const result = execSync(
      `node ${cliPath} extract ${obfExample} --format obf`,
    ).toString();
    // Should contain actual text content from the obf file
    expect(result.length).toBeGreaterThan(10); // Should have some text output
    expect(result.trim()).not.toBe(""); // Should not be empty
  });

  it("extracts texts from an obz file", () => {
    const result = execSync(
      `node ${cliPath} extract ${obzExample} --format obf`,
    ).toString();
    expect(result.length).toBeGreaterThan(10); // Should have some text output
    expect(result.trim()).not.toBe(""); // Should not be empty
  });
});

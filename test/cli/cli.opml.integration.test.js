// CLI integration test for OPML
const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");

describe("aac-processors CLI (OPML)", () => {
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
  const opmlExample = path.join(__dirname, "../../examples/example.opml");

  it("extracts texts from an opml file", () => {
    const result = execSync(
      `node ${cliPath} extract ${opmlExample} --format opml`,
    ).toString();
    // Should contain actual text content from the opml file
    expect(result.length).toBeGreaterThan(10); // Should have some text output
    expect(result.trim()).not.toBe(""); // Should not be empty
  });
});

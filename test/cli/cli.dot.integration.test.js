// CLI integration test for DOT
const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");

describe("aac-processors CLI (DOT)", () => {
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
  const dotExample = path.join(__dirname, "../../examples/example.dot");

  it("extracts texts from a dot file", () => {
    const result = execSync(
      `node ${cliPath} extract ${dotExample} --format dot`,
    ).toString();
    // Should contain actual text content from the dot file
    expect(result.length).toBeGreaterThan(10); // Should have some text output
    expect(result.trim()).not.toBe(""); // Should not be empty
  });
});

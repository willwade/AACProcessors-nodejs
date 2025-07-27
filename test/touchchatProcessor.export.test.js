// Test TouchChatProcessor export/saveFromTree
const fs = require("fs");
const path = require("path");
const TouchChatProcessor = require("../src/processors/touchchatProcessor");
describe("TouchChatProcessor.saveFromTree", () => {
  const tcPath = path.join(__dirname, "../examples/example.touchchat.json");
  const outPath = path.join(__dirname, "out.touchchat.json");
  afterAll(() => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });
  it("exports tree to TouchChat JSON", () => {
    // If no example.touchchat.json, skip
    if (!fs.existsSync(tcPath)) return;
    const tree =
      require("../src/processors/touchchatProcessor").prototype.loadIntoTree.call(
        TouchChatProcessor,
        tcPath,
      );
    TouchChatProcessor.prototype.saveFromTree.call(
      TouchChatProcessor,
      tree,
      outPath,
    );
    const exported = fs.readFileSync(outPath, "utf8");
    expect(exported).toContain("pages");
    expect(exported).toContain("rootId");
  });
});

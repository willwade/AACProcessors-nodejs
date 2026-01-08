// Test DotProcessor export/saveFromTree
const fs = require("fs");
const path = require("path");
const { DotProcessor } = require("../dist/processors/dotProcessor");
describe("DotProcessor.saveFromTree", () => {
  const dotPath = path.join(__dirname, "assets/dot/example.dot");
  const outPath = path.join(__dirname, "out.dot");
  afterAll(() => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });
  it("exports tree to DOT format", async () => {
    const processor = new DotProcessor();
    const tree = await processor.loadIntoTree(dotPath);
    await processor.saveFromTree(tree, outPath);
    const exported = fs.readFileSync(outPath, "utf8");
    expect(exported).toContain('digraph "AACBoard"');
    expect(exported).toContain("[");
    expect(exported).toContain("->");
  });
});

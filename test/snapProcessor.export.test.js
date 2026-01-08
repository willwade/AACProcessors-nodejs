// Test SnapProcessor export/saveFromTree
const fs = require("fs");
const path = require("path");
const { SnapProcessor } = require("../dist/processors/snapProcessor");
describe("SnapProcessor.saveFromTree", () => {
  const snapPath = path.join(__dirname, "assets/snap/example.snap.json");
  const spsPath = path.join(__dirname, "assets/snap/example.sps");
  const outPath = path.join(__dirname, "out.snap.json");
  afterAll(() => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });
  it("exports tree to Snap JSON", async () => {
    // If no example.snap.json, skip
    if (!fs.existsSync(snapPath)) return;
    const processor = new SnapProcessor();
    const tree = await processor.loadIntoTree(snapPath);
    await processor.saveFromTree(tree, outPath);
    const exported = fs.readFileSync(outPath, "utf8");
    expect(exported).toContain("pages");
    expect(exported).toContain("rootId");
  });

  it("loads tree from .sps file and returns pages", async () => {
    if (!fs.existsSync(spsPath)) return;
    const processor = new SnapProcessor();
    const tree = await processor.loadIntoTree(spsPath);
    expect(tree).toBeTruthy();
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });
});

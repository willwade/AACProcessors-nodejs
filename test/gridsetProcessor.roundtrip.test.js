// Round-trip test for GridsetProcessor: load, save, reload, and compare structure
const fs = require("fs");
const path = require("path");
const GridsetProcessor = require("../src/processors/gridsetProcessor");
describe("GridsetProcessor round-trip", () => {
  const gsPath = path.join(__dirname, "../examples/example.gridset.json");
  const outPath = path.join(__dirname, "out.gridset.json");
  afterAll(() => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });
  it("round-trips Gridset JSON without losing pages or navigation", () => {
    if (!fs.existsSync(gsPath)) return;
    const tree1 = GridsetProcessor.prototype.loadIntoTree.call(
      GridsetProcessor,
      gsPath,
    );
    GridsetProcessor.prototype.saveFromTree.call(
      GridsetProcessor,
      tree1,
      outPath,
    );
    const tree2 = GridsetProcessor.prototype.loadIntoTree.call(
      GridsetProcessor,
      outPath,
    );
    expect(Object.keys(tree1.pages).sort()).toEqual(
      Object.keys(tree2.pages).sort(),
    );
    for (const pid in tree1.pages) {
      expect(tree2.pages).toHaveProperty(pid);
      const btnLabels1 = tree1.pages[pid].buttons.map((b) => b.label).sort();
      const btnLabels2 = tree2.pages[pid].buttons.map((b) => b.label).sort();
      expect(btnLabels1).toEqual(btnLabels2);
    }
  });
});

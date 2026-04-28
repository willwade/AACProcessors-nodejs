import fs from "fs";
import path from "path";
import { DotProcessor } from "../src/processors/dotProcessor";
describe("DotProcessor round-trip", () => {
  const dotPath = path.join(__dirname, "assets/dot/example.dot");
  const outPath = path.join(__dirname, "out.dot");
  afterAll(async () => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });
  it("round-trips DOT file without losing pages or navigation", async () => {
    const processor = new DotProcessor();
    const tree1 = await processor.loadIntoTree(dotPath);
    await processor.saveFromTree(tree1, outPath);
    const tree2 = await processor.loadIntoTree(outPath);
    // Compare page IDs and navigation
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

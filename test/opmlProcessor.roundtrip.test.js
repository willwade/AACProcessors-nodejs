// Round-trip test for OpmlProcessor: load, save, reload, and compare structure
const fs = require("fs");
const path = require("path");
const { OpmlProcessor } = require("../dist/processors/opmlProcessor");
const outPath = path.join(__dirname, "out.opml");

// Diagnostic: Try a direct file write
const diagPath = path.join(__dirname, "diagnostic_write.txt");
fs.writeFileSync(diagPath, "diagnostic test");
console.log(
  "Diagnostic file write:",
  diagPath,
  "exists?",
  fs.existsSync(diagPath),
);

describe("OpmlProcessor round-trip", () => {
  const opmlPath = path.join(__dirname, "../examples/example.opml");
  afterAll(() => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });
  it("round-trips OPML file without losing pages", () => {
    const processor = new OpmlProcessor();
    const tree1 = processor.loadIntoTree(opmlPath);
    console.log("TEST: tree1.rootId =", tree1.rootId);
    console.log("TEST: tree1.pages =", Object.keys(tree1.pages));
    processor.saveFromTree(tree1, outPath);
    const tree2 = processor.loadIntoTree(outPath);
    console.log("TEST: tree2.rootId =", tree2.rootId);
    console.log("TEST: tree2.pages =", Object.keys(tree2.pages));
    // Compare set of page names (labels)
    const filterArtificial = (arr) =>
      arr.filter((n) => n !== "Super Root" && n !== "Root").sort();
    const names1 = filterArtificial(
      Object.values(tree1.pages).map((p) => p.name),
    );
    const names2 = filterArtificial(
      Object.values(tree2.pages).map((p) => p.name),
    );
    expect(names2).toEqual(names1);
    // Compare root names
    expect(tree2.getPage(tree2.rootId).name).toEqual(
      tree1.getPage(tree1.rootId).name,
    );
  });
});

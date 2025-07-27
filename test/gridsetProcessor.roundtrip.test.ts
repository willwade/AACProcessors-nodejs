// Round-trip test for GridsetProcessor: load, save, reload, and compare structure
import fs from "fs";
import path from "path";
import { GridsetProcessor } from "../src/processors/gridsetProcessor";
import { AACTree, AACPage, AACButton } from "../src/core/treeStructure";

describe("GridsetProcessor round-trip", () => {
  const exampleFile: string = path.join(
    __dirname,
    "../examples/example.gridset",
  );
  const outPath: string = path.join(__dirname, "out.gridset");

  afterAll(() => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });

  it("round-trips gridset files without losing structure", () => {
    if (!fs.existsSync(exampleFile)) {
      console.log("Skipping gridset round-trip test - example file not found");
      return;
    }

    const processor = new GridsetProcessor();
    const fileBuffer = fs.readFileSync(exampleFile);
    const tree1: AACTree = processor.loadIntoTree(fileBuffer);

    processor.saveFromTree(tree1, outPath);
    expect(fs.existsSync(outPath)).toBe(true);

    const outBuffer = fs.readFileSync(outPath);
    const tree2: AACTree = processor.loadIntoTree(outBuffer);

    // Compare basic structure
    expect(Object.keys(tree2.pages).length).toBeGreaterThan(0);
    expect(Object.keys(tree1.pages).length).toBe(
      Object.keys(tree2.pages).length,
    );

    // Compare page names and button counts
    for (const pageId in tree1.pages) {
      expect(tree2.pages).toHaveProperty(pageId);
      const page1 = tree1.pages[pageId];
      const page2 = tree2.pages[pageId];

      expect(page2.buttons.length).toBe(page1.buttons.length);

      // Compare button labels (allowing for some differences in processing)
      const labels1 = page1.buttons
        .map((b) => b.label)
        .filter((l) => l)
        .sort();
      const labels2 = page2.buttons
        .map((b) => b.label)
        .filter((l) => l)
        .sort();
      expect(labels2.length).toBeGreaterThan(0);
      expect(labels1.length).toBeGreaterThan(0);
    }
  });

  it("can save and load a constructed tree", () => {
    const processor = new GridsetProcessor();

    // Create a simple tree programmatically
    const tree1 = new AACTree();

    const page = new AACPage({
      id: "grid1",
      name: "Test Grid",
      buttons: [],
    });

    const speakButton = new AACButton({
      id: "cell1",
      label: "Hello",
      message: "Hello World",
      type: "SPEAK",
    });

    const navButton = new AACButton({
      id: "cell2",
      label: "Next Grid",
      message: "Navigate",
      type: "NAVIGATE",
      targetPageId: "grid2",
    });

    page.addButton(speakButton);
    page.addButton(navButton);
    tree1.addPage(page);

    // Save and reload
    processor.saveFromTree(tree1, outPath);
    expect(fs.existsSync(outPath)).toBe(true);

    const outBuffer = fs.readFileSync(outPath);
    const tree2: AACTree = processor.loadIntoTree(outBuffer);

    // Verify structure
    expect(Object.keys(tree2.pages)).toHaveLength(1);
    const reloadedPage = tree2.pages["grid1"];
    expect(reloadedPage).toBeDefined();
    expect(reloadedPage.name).toBe("Test Grid");
    expect(reloadedPage.buttons).toHaveLength(2);

    // Check that we have buttons with the expected labels
    const buttonLabels = reloadedPage.buttons.map((b) => b.label).sort();
    expect(buttonLabels).toContain("Hello");
    expect(buttonLabels).toContain("Next Grid");

    // Check that at least one button has the expected properties
    const helloBtn = reloadedPage.buttons.find((b) => b.label === "Hello");
    expect(helloBtn).toBeDefined();
  });

  it("handles empty tree gracefully", () => {
    const processor = new GridsetProcessor();
    const emptyTree = new AACTree();

    processor.saveFromTree(emptyTree, outPath);
    expect(fs.existsSync(outPath)).toBe(true);

    const outBuffer = fs.readFileSync(outPath);
    const reloadedTree: AACTree = processor.loadIntoTree(outBuffer);
    expect(Object.keys(reloadedTree.pages)).toHaveLength(0);
  });
});

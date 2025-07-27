// Round-trip test for ApplePanelsProcessor: load, save, reload, and compare structure
import fs from "fs";
import path from "path";
import { ApplePanelsProcessor } from "../src/processors/applePanelsProcessor";
import { AACTree, AACPage, AACButton } from "../src/core/treeStructure";

describe("ApplePanelsProcessor round-trip", () => {
  const outPath: string = path.join(__dirname, "out.applepanels.plist");

  afterAll(() => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });

  it("can save and load a constructed tree", () => {
    const processor = new ApplePanelsProcessor();

    // Create a simple tree programmatically
    const tree1 = new AACTree();

    // Create first panel
    const page1 = new AACPage({
      id: "panel1",
      name: "Main Panel",
      buttons: [],
    });

    const button1 = new AACButton({
      id: "btn1",
      label: "Hello",
      message: "Hello World",
      type: "SPEAK",
    });

    const button2 = new AACButton({
      id: "btn2",
      label: "Go to Panel 2",
      message: "Navigate",
      type: "NAVIGATE",
      targetPageId: "panel2",
    });

    page1.addButton(button1);
    page1.addButton(button2);
    tree1.addPage(page1);

    // Create second panel
    const page2 = new AACPage({
      id: "panel2",
      name: "Second Panel",
      buttons: [],
    });

    const button3 = new AACButton({
      id: "btn3",
      label: "Back",
      message: "Go back",
      type: "NAVIGATE",
      targetPageId: "panel1",
    });

    page2.addButton(button3);
    tree1.addPage(page2);

    // Save and reload
    processor.saveFromTree(tree1, outPath);
    expect(fs.existsSync(outPath)).toBe(true);

    const tree2: AACTree = processor.loadIntoTree(outPath);

    // Verify structure
    expect(Object.keys(tree2.pages)).toHaveLength(2);

    const reloadedPage1 = tree2.pages["panel1"];
    expect(reloadedPage1).toBeDefined();
    expect(reloadedPage1.name).toBe("Main Panel");
    expect(reloadedPage1.buttons).toHaveLength(2);

    const reloadedPage2 = tree2.pages["panel2"];
    expect(reloadedPage2).toBeDefined();
    expect(reloadedPage2.name).toBe("Second Panel");
    expect(reloadedPage2.buttons).toHaveLength(1);

    // Check navigation
    const navButton = reloadedPage1.buttons.find((b) => b.type === "NAVIGATE");
    expect(navButton).toBeDefined();
    expect(navButton!.targetPageId).toBe("panel2");
  });

  it("handles empty tree gracefully", () => {
    const processor = new ApplePanelsProcessor();
    const emptyTree = new AACTree();

    processor.saveFromTree(emptyTree, outPath);
    expect(fs.existsSync(outPath)).toBe(true);

    const reloadedTree: AACTree = processor.loadIntoTree(outPath);
    expect(Object.keys(reloadedTree.pages)).toHaveLength(0);
  });
});

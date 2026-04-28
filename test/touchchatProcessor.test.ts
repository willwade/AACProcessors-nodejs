// Unit tests for TouchChatProcessor
import { TouchChatProcessor } from "../src/processors/touchchatProcessor";
import { AACTree } from "../src/core/treeStructure";
import path from "path";

describe("TouchChatProcessor", () => {
  const exampleFile: string = path.join(__dirname, "assets/excel/example.ce");

  it("should load a .ce file into a tree", async () => {
    const processor = new TouchChatProcessor();
    const tree: AACTree = await processor.loadIntoTree(exampleFile);
    expect(tree).toBeDefined();
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });

  it("should extract all texts from a .ce file", async () => {
    const processor = new TouchChatProcessor();
    const texts: string[] = await processor.extractTexts(exampleFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
  });
});

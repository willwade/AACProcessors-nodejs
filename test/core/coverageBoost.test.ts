import {
  AACTree,
  AACPage,
  AACButton,
  AACSemanticCategory,
  AACSemanticIntent,
} from "../../src/core/treeStructure";
import { BaseProcessor } from "../../src/core/baseProcessor";

describe("src/core Coverage Boost", () => {
  describe("AACButton constructor legacy mappings", () => {
    it("should map legacy NAVIGATE type", async () => {
      const button = new AACButton({
        id: "btn1",
        type: "NAVIGATE",
        targetPageId: "page2",
      });
      expect(button.semanticAction?.intent).toBe(AACSemanticIntent.NAVIGATE_TO);
      expect(button.type).toBe("NAVIGATE");
    });

    it("should map legacy SPEAK type", async () => {
      const button = new AACButton({
        id: "btn1",
        type: "SPEAK",
        message: "hello",
      });
      expect(button.semanticAction?.intent).toBe(AACSemanticIntent.SPEAK_TEXT);
      expect(button.type).toBe("SPEAK");
    });

    it("should map legacy ACTION type", async () => {
      const button = new AACButton({
        id: "btn1",
        type: "ACTION",
      });
      expect(button.semanticAction?.intent).toBe(
        AACSemanticIntent.PLATFORM_SPECIFIC,
      );
      expect(button.type).toBe("ACTION");
    });

    it("should map legacy action object (NAVIGATE)", async () => {
      const button = new AACButton({
        id: "btn1",
        action: { type: "NAVIGATE", targetPageId: "page2" },
      });
      expect(button.type).toBe("NAVIGATE");
    });

    it("should map legacy action object (SPEAK)", async () => {
      const button = new AACButton({
        id: "btn1",
        action: { type: "SPEAK", message: "test" },
      });
      expect(button.type).toBe("SPEAK");
      expect(button.message).toBe("test");
    });

    it("should map legacy action object (ACTION)", async () => {
      const button = new AACButton({
        id: "btn1",
        action: { type: "ACTION" },
      });
      expect(button.type).toBe("ACTION");
    });
  });

  describe("AACButton getters", () => {
    it("should return SPEAK for SPEAK_IMMEDIATE intent", async () => {
      const button = new AACButton({
        id: "1",
        semanticAction: { intent: AACSemanticIntent.SPEAK_IMMEDIATE },
      });
      expect(button.type).toBe("SPEAK");
    });

    it("should return null for empty SPEAK button action", async () => {
      const button = new AACButton({ id: "1" });
      // In constructor, default type is SPEAK, but message/label are empty
      expect(button.action).toBeNull();
    });

    it("should handle NAVIGATE type from targetPageId fallback", async () => {
      const button = new AACButton({ id: "1", targetPageId: "p2" });
      expect(button.type).toBe("NAVIGATE");
      expect(button.action?.type).toBe("NAVIGATE");
    });

    it("should handle SPEAK type from message fallback", async () => {
      const button = new AACButton({ id: "1", message: "hello" });
      expect(button.type).toBe("SPEAK");
      expect(button.action?.type).toBe("SPEAK");
    });
  });

  describe("AACTree extra properties", () => {
    it("should handle rootId getter/setter", async () => {
      const tree = new AACTree();
      tree.rootId = "root1";
      expect(tree.rootId).toBe("root1");
      expect(tree.metadata.defaultHomePageId).toBe("root1");

      tree.rootId = null;
      expect(tree.rootId).toBeNull();
      expect(tree.metadata.defaultHomePageId).toBeUndefined();
    });
    it("should handle toolbarId and dashboardId", async () => {
      const tree = new AACTree();
      tree.toolbarId = "tb1";
      tree.dashboardId = "db1";
      expect(tree.toolbarId).toBe("tb1");
      expect(tree.dashboardId).toBe("db1");
      expect(tree.metadata.toolbarId).toBe("tb1");
      expect(tree.metadata.dashboardId).toBe("db1");

      tree.toolbarId = null;
      tree.dashboardId = null;
      expect(tree.toolbarId).toBeNull();
      expect(tree.dashboardId).toBeNull();
    });
  });

  describe("AACPage grid constructor", () => {
    it("should create empty grid for columns/rows object", async () => {
      const page = new AACPage({
        id: "p1",
        grid: { columns: 2, rows: 3 },
      });
      expect(page.grid).toHaveLength(3);
      expect(page.grid[0]).toHaveLength(2);
      expect(page.grid[0][0]).toBeNull();
    });

    it("should default to empty grid if no grid provided", async () => {
      const page = new AACPage({ id: "p1" });
      expect(page.grid).toEqual([]);
    });
  });

  describe("BaseProcessor features", () => {
    class MockProcessor extends BaseProcessor {
      async extractTexts() {
        return [];
      }
      async loadIntoTree() {
        return new AACTree();
      }
      async processTexts() {
        return new Uint8Array(0);
      }
      async saveFromTree() {}

      public callShouldFilter(btn: AACButton) {
        return this.shouldFilterButton(btn);
      }
      public callExtractStringsGeneric(p: string) {
        return this.extractStringsWithMetadataGeneric(p);
      }
      public callGenerateOutputPath(p: string) {
        return this.generateTranslatedOutputPath(p);
      }
    }

    it("should filter GO_BACK / GO_HOME navigation buttons", async () => {
      const processor = new MockProcessor({ excludeNavigationButtons: true });
      const backBtn = new AACButton({
        id: "back",
        semanticAction: {
          intent: AACSemanticIntent.GO_BACK,
          category: AACSemanticCategory.NAVIGATION,
        },
      });
      expect(processor.callShouldFilter(backBtn)).toBe(true);
    });

    it("should filter text editing category", async () => {
      const processor = new MockProcessor({ excludeSystemButtons: true });
      const editBtn = new AACButton({
        id: "edit",
        semanticAction: {
          intent: "ANY",
          category: AACSemanticCategory.TEXT_EDITING,
        },
      });
      expect(processor.callShouldFilter(editBtn)).toBe(true);
    });

    it("should filter specific system intents", async () => {
      const processor = new MockProcessor({ excludeSystemButtons: true });
      const deleteBtn = new AACButton({
        id: "del",
        semanticAction: {
          intent: AACSemanticIntent.DELETE_WORD,
          category: AACSemanticCategory.SYSTEM_CONTROL,
        },
      });
      expect(processor.callShouldFilter(deleteBtn)).toBe(true);
    });

    it("should handle output path without extension", async () => {
      const processor = new MockProcessor();
      expect(processor.callGenerateOutputPath("myfile")).toBe(
        "myfile_translated",
      );
    });

    it("should handle custom button filter", async () => {
      const processor = new MockProcessor({
        customButtonFilter: (btn) => btn.label !== "Secret",
      });
      const secretBtn = new AACButton({ id: "1", label: "Secret" });
      const normalBtn = new AACButton({ id: "2", label: "Normal" });
      expect(processor.callShouldFilter(secretBtn)).toBe(true);
      expect(processor.callShouldFilter(normalBtn)).toBe(false);
    });

    it("should handle addToExtractedMap with existing key", async () => {
      const processor = new MockProcessor();
      const extractedMap = new Map<string, any>();
      (processor as any).addToExtractedMap(extractedMap, "test", "Test", {
        table: "b",
        id: 1,
        column: "L",
        casing: "capitalized",
      });
      (processor as any).addToExtractedMap(extractedMap, "test", "Test2", {
        table: "b",
        id: 2,
        column: "L",
        casing: "capitalized",
      });

      const item = extractedMap.get("test");
      expect(item.vocabPlacementMeta.vocabLocations).toHaveLength(2);
    });
  });
});

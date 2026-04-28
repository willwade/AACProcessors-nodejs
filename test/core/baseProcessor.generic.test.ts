import {
  BaseProcessor,
  type ExtractStringsResult,
  type TranslatedString,
  type SourceString,
  type ProcessorOptions,
} from "../../src/core/baseProcessor";
import {
  AACTree,
  AACPage,
  AACButton,
  AACSemanticCategory,
  AACSemanticIntent,
} from "../../src/core/treeStructure";

class DummyProcessor extends BaseProcessor {
  private tree: AACTree;
  public lastTranslations: Map<string, string> | null = null;
  public lastOutputPath: string | null = null;

  constructor(tree: AACTree, options?: ProcessorOptions) {
    super(options);
    this.tree = tree;
  }

  async extractTexts(): Promise<string[]> {
    return [];
  }

  async loadIntoTree(): Promise<AACTree> {
    return this.tree;
  }

  async processTexts(
    _filePathOrBuffer: string,
    translations: Map<string, string>,
    outputPath: string,
  ): Promise<Uint8Array> {
    this.lastTranslations = translations;
    this.lastOutputPath = outputPath;
    return new Uint8Array();
  }

  async saveFromTree(): Promise<void> {
    return;
  }

  public filterButtons(buttons: AACButton[]): AACButton[] {
    return this.filterPageButtons(buttons);
  }

  public extractStringsGeneric(
    filePath: string,
  ): Promise<ExtractStringsResult> {
    return this.extractStringsWithMetadataGeneric(filePath);
  }

  public generateTranslatedGeneric(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[],
  ): Promise<string> {
    return this.generateTranslatedDownloadGeneric(
      filePath,
      translatedStrings,
      sourceStrings,
    );
  }

  public outputPathFor(filePath: string): string {
    return this.generateTranslatedOutputPath(filePath);
  }
}

function createTree(): AACTree {
  const tree = new AACTree();
  const page = new AACPage({ id: "page-1", name: "Home" });
  const yesButton = new AACButton({
    id: "btn-1",
    label: "Yes",
    message: "Yes",
  });
  const noButton = new AACButton({ id: "btn-2", label: "No", message: "Nope" });
  page.buttons.push(yesButton, noButton);
  tree.addPage(page);
  tree.rootId = page.id;
  return tree;
}

describe("BaseProcessor generic helpers", () => {
  it("filters navigation/system buttons by default", () => {
    const tree = createTree();
    const processor = new DummyProcessor(tree);
    const buttons = [
      new AACButton({
        id: "nav",
        label: "Back",
        message: "",
        semanticAction: {
          category: AACSemanticCategory.NAVIGATION,
          intent: AACSemanticIntent.GO_BACK,
        },
      }),
      new AACButton({
        id: "sys",
        label: "Clear",
        message: "",
        semanticAction: {
          category: AACSemanticCategory.TEXT_EDITING,
          intent: AACSemanticIntent.CLEAR_TEXT,
        },
      }),
      new AACButton({ id: "keep", label: "Hello", message: "Hello" }),
    ];

    const filtered = processor.filterButtons(buttons);
    expect(filtered.map((b) => b.id)).toEqual(["keep"]);
  });

  it("preserves all buttons when preserveAllButtons is set", () => {
    const tree = createTree();
    const processor = new DummyProcessor(tree, { preserveAllButtons: true });
    const buttons = [
      new AACButton({
        id: "nav",
        label: "Back",
        message: "",
        semanticAction: {
          category: AACSemanticCategory.NAVIGATION,
          intent: AACSemanticIntent.GO_BACK,
        },
      }),
    ];

    expect(processor.filterButtons(buttons).length).toBe(1);
  });

  it("applies a custom button filter", () => {
    const tree = createTree();
    const processor = new DummyProcessor(tree, {
      customButtonFilter: (button) =>
        !button.label?.toLowerCase().includes("skip"),
    });
    const buttons = [
      new AACButton({ id: "skip", label: "Skip Me", message: "" }),
      new AACButton({ id: "keep", label: "Keep", message: "" }),
    ];

    expect(processor.filterButtons(buttons).map((b) => b.id)).toEqual(["keep"]);
  });

  it("extracts strings with metadata and deduplicates", async () => {
    const tree = createTree();
    const processor = new DummyProcessor(tree);
    const result = await processor.extractStringsGeneric("dummy.path");

    const labels = result.extractedStrings.map((entry) => entry.string).sort();
    expect(labels).toEqual(["Home", "No", "Nope", "Yes"]);

    const yesEntry = result.extractedStrings.find(
      (entry) => entry.string === "Yes",
    );
    expect(yesEntry?.vocabPlacementMeta.vocabLocations.length).toBe(1);
  });

  it("builds translations and output paths for generic downloads", async () => {
    const tree = createTree();
    const processor = new DummyProcessor(tree);
    const sourceStrings: SourceString[] = [
      {
        id: 1,
        sourcestring: "Hello",
        vocabplacementmetadata: { vocabLocations: [] },
      },
    ];
    const translatedStrings: TranslatedString[] = [
      {
        sourcestringid: 1,
        overridestring: "Hola",
        translatedstring: "Bonjour",
      },
    ];

    const outputPath = await processor.generateTranslatedGeneric(
      "/tmp/example.obf",
      translatedStrings,
      sourceStrings,
    );

    expect(outputPath).toBe("/tmp/example_translated.obf");
    expect(processor.lastTranslations?.get("Hello")).toBe("Hola");
  });

  it("generates translated output paths without extensions", () => {
    const tree = createTree();
    const processor = new DummyProcessor(tree);
    expect(processor.outputPathFor("/tmp/example")).toBe(
      "/tmp/example_translated",
    );
  });
});

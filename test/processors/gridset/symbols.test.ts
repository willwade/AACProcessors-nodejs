import {
  analyzeSymbolUsage,
  createSymbolReference,
  extractSymbolReferences,
  getSymbolLibraryDisplayName,
  getSymbolLibraryName,
  getSymbolPath,
  isKnownSymbolLibrary,
  isSymbolReference,
  parseSymbolReference,
  symbolReferenceToFilename,
} from "../../../src/processors/gridset/symbols";

describe("gridset symbols utilities", () => {
  it("parses and formats symbol references", () => {
    const parsed = parseSymbolReference("[Widgit]/food/apple.png");
    expect(parsed.isValid).toBe(true);
    expect(parsed.library).toBe("widgit");
    expect(parsed.path).toBe("/food/apple.png");

    expect(isSymbolReference("[widgit]/food/apple.png")).toBe(true);
    expect(isSymbolReference("plain-text")).toBe(false);

    const created = createSymbolReference("Widgit", "/food/apple.png");
    expect(created).toBe("[widgit]/food/apple.png");

    expect(getSymbolLibraryName(created)).toBe("widgit");
    expect(getSymbolPath(created)).toBe("/food/apple.png");
  });

  it("detects known libraries and display names", () => {
    expect(isKnownSymbolLibrary("[grid3x]")).toBe(true);
    expect(isKnownSymbolLibrary("unknownlib")).toBe(false);

    expect(getSymbolLibraryDisplayName("widgit")).toBe("Widgit Symbols");
    expect(getSymbolLibraryDisplayName("custom")).toBe("Custom");
  });

  it("extracts and analyzes symbol usage from a tree", () => {
    const tree = {
      pages: {
        one: {
          buttons: [
            { image: "[widgit]/food/apple.png" },
            { symbolLibrary: "tawasl", symbolPath: "/animals/cat.png" },
          ],
        },
        two: {
          buttons: [{ image: "[widgit]/food/apple.png" }],
        },
      },
    };

    const refs = extractSymbolReferences(tree);
    expect(refs).toEqual([
      "[tawasl]/animals/cat.png",
      "[widgit]/food/apple.png",
    ]);

    const usage = analyzeSymbolUsage(tree);
    expect(usage.totalSymbols).toBe(2);
    expect(usage.byLibrary.widgit).toBe(1);
    expect(usage.byLibrary.tawasl).toBe(1);
    expect(usage.librariesUsed).toEqual(["tawasl", "widgit"]);
  });

  it("creates embedded filenames for symbol references", () => {
    expect(symbolReferenceToFilename("[widgit]/food/apple.png", 2, 3)).toBe(
      "2-3-0-text-0.png",
    );
    expect(symbolReferenceToFilename("[widgit]/food/apple", 1, 1)).toBe(
      "1-1-0-text-0.png",
    );
  });
});

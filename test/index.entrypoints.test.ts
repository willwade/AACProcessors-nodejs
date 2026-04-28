import * as browserEntry from "../src/index.browser";
import * as nodeEntry from "../src/index.node";
import { DotProcessor } from "../src/processors/dotProcessor";
import { GridsetProcessor } from "../src/processors/gridsetProcessor";
import { SnapProcessor } from "../src/processors/snapProcessor";
import { TouchChatProcessor } from "../src/processors/touchchatProcessor";

describe("entrypoint exports", () => {
  it("browser entry resolves supported processors", () => {
    const dot = browserEntry.getProcessor(".dot");
    const grid = browserEntry.getProcessor(".gridset");
    const snap = browserEntry.getProcessor(".sps");
    const touch = browserEntry.getProcessor(".ce");

    expect(dot).toBeInstanceOf(DotProcessor);
    expect(grid).toBeInstanceOf(GridsetProcessor);
    expect(snap).toBeInstanceOf(SnapProcessor);
    expect(touch).toBeInstanceOf(TouchChatProcessor);

    const extensions = browserEntry.getSupportedExtensions();
    expect(browserEntry.isExtensionSupported(".dot")).toBe(true);
    expect(browserEntry.isExtensionSupported(".ce")).toBe(true);
    expect(extensions).toEqual(
      expect.arrayContaining([
        ".dot",
        ".gridset",
        ".sps",
        ".spb",
        ".ce",
        ".plist",
        ".grd",
      ]),
    );
    expect(() => browserEntry.getProcessor(".unknown")).toThrow();
  });

  it("node entry resolves supported processors", () => {
    const snap = nodeEntry.getProcessor(".sps");
    const touch = nodeEntry.getProcessor(".ce");
    const grid = nodeEntry.getProcessor(".gridsetx");

    expect(snap).toBeInstanceOf(SnapProcessor);
    expect(touch).toBeInstanceOf(TouchChatProcessor);
    expect(grid).toBeInstanceOf(GridsetProcessor);

    const extensions = nodeEntry.getSupportedExtensions();
    expect(nodeEntry.isExtensionSupported(".gridsetx")).toBe(true);
    expect(extensions).toEqual(
      expect.arrayContaining([
        ".gridsetx",
        ".sps",
        ".spb",
        ".ce",
        ".obf",
        ".obz",
      ]),
    );
    expect(() => nodeEntry.getProcessor(".unknown")).toThrow();
  });
});

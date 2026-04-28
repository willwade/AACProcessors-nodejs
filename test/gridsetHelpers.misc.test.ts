import { describe, expect, it } from "@jest/globals";
import {
  createFileMapXml,
  createSettingsXml,
  generateGrid3Guid,
} from "../src/processors/gridset/helpers";

describe("Gridset helper misc utilities", () => {
  it("generates a GUID-like value", async () => {
    const guid = generateGrid3Guid();
    expect(guid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("builds settings XML with overrides", async () => {
    const xml = createSettingsXml("Home", {
      scanEnabled: true,
      hoverTimeoutMs: 1500,
      language: "en-GB",
    });
    expect(xml).toContain("<StartGrid>Home</StartGrid>");
    expect(xml).toContain("<ScanEnabled>true</ScanEnabled>");
    expect(xml).toContain("<HoverTimeoutMs>1500</HoverTimeoutMs>");
    expect(xml).toContain("<Language>en-GB</Language>");
  });

  it("builds file map XML for multiple grids", async () => {
    const xml = createFileMapXml([
      { name: "Main", path: "main.gridset" },
      { name: "Alt", path: "alt.gridset", dynamicFiles: ["dyn1"] },
    ]);
    expect(xml).toContain("main.gridset");
    expect(xml).toContain("alt.gridset");
    expect(xml).toContain("<DynamicFiles>");
  });
});

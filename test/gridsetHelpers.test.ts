import AdmZip from "adm-zip";
import { AACTree, AACPage, AACButton, Gridset } from "../src/index";

describe("Gridset helper APIs", () => {
  it("getPageTokenImageMap returns button.id to resolvedImageEntry map for a page", async () => {
    const tree = new AACTree();
    const page = new AACPage({
      id: "p1",
      name: "Page 1",
      grid: { columns: 2, rows: 2 },
      buttons: [],
    });
    tree.addPage(page);

    page.addButton(
      new AACButton({
        id: "b1",
        label: "A",
        message: "A",
        resolvedImageEntry: "Grids/Home/Images/a.png",
      }),
    );
    page.addButton(
      new AACButton({
        id: "b2",
        label: "B",
        message: "B",
        resolvedImageEntry: "Grids/Home/1-1.jpeg",
      }),
    );

    const map = Gridset.getPageTokenImageMap(tree, "p1");
    expect(map.get("b1")).toBe("Grids/Home/Images/a.png");
    expect(map.get("b2")).toBe("Grids/Home/1-1.jpeg");
    expect(map.size).toBe(2);
  });

  it("getAllowedImageEntries aggregates unique image entries across pages", async () => {
    const tree = new AACTree();
    const p1 = new AACPage({
      id: "p1",
      name: "P1",
      grid: { columns: 1, rows: 1 },
      buttons: [],
    });
    const p2 = new AACPage({
      id: "p2",
      name: "P2",
      grid: { columns: 1, rows: 1 },
      buttons: [],
    });
    tree.addPage(p1);
    tree.addPage(p2);

    p1.addButton(
      new AACButton({
        id: "b1",
        label: "A",
        message: "A",
        resolvedImageEntry: "X/Y/a.png",
      }),
    );
    p1.addButton(
      new AACButton({
        id: "b2",
        label: "B",
        message: "B",
        resolvedImageEntry: "X/Y/a.png",
      }),
    );
    p2.addButton(
      new AACButton({
        id: "b3",
        label: "C",
        message: "C",
        resolvedImageEntry: "X/Z/c.png",
      }),
    );

    const set = Gridset.getAllowedImageEntries(tree);
    expect(set.has("X/Y/a.png")).toBe(true);
    expect(set.has("X/Z/c.png")).toBe(true);
    expect(set.size).toBe(2);
  });

  it("openImage reads a specific entry from a gridset buffer", async () => {
    const zip = new AdmZip();
    zip.addFile("Grids/Home/Images/dog.png", Buffer.from("DOGDATA"));
    const buf = zip.toBuffer();

    const data = await Gridset.openImage(buf, "Grids/Home/Images/dog.png");
    expect(Buffer.from(data || []).toString("utf8")).toBe("DOGDATA");

    const missing = await Gridset.openImage(buf, "Grids/Home/Images/cat.png");
    expect(missing).toBeNull();
  });
});

describe("Grid3 GUID Generation", () => {
  it("generateGrid3Guid generates a valid GUID format", async () => {
    const guid = Gridset.generateGrid3Guid();
    // Check format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const guidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(guid).toMatch(guidRegex);
  });

  it("generateGrid3Guid generates unique GUIDs", async () => {
    const guid1 = Gridset.generateGrid3Guid();
    const guid2 = Gridset.generateGrid3Guid();
    const guid3 = Gridset.generateGrid3Guid();
    expect(guid1).not.toBe(guid2);
    expect(guid2).not.toBe(guid3);
    expect(guid1).not.toBe(guid3);
  });

  it("generateGrid3Guid generates GUIDs with correct version and variant", async () => {
    // Generate multiple GUIDs and check they all have version 4 and variant 1
    for (let i = 0; i < 10; i++) {
      const guid = Gridset.generateGrid3Guid();
      const parts = guid.split("-");
      // Version 4 is in the first character of the 3rd group
      expect(parts[2][0]).toBe("4");
      // Variant 1 is in the first character of the 4th group (should be 8, 9, a, or b)
      expect(["8", "9", "a", "b"]).toContain(parts[3][0].toLowerCase());
    }
  });
});

describe("Grid3 Settings XML Builder", () => {
  it("createSettingsXml creates valid XML with default options", async () => {
    const xml = Gridset.createSettingsXml("Home");
    expect(xml).toContain("<GridSetSettings");
    expect(xml).toContain("<StartGrid>Home</StartGrid>");
    expect(xml).toContain("<ScanEnabled>false</ScanEnabled>");
    expect(xml).toContain("<HoverEnabled>false</HoverEnabled>");
    expect(xml).toContain("<MouseclickEnabled>true</MouseclickEnabled>");
    expect(xml).toContain("<Language>en-US</Language>");
  });

  it("createSettingsXml respects custom options", async () => {
    const xml = Gridset.createSettingsXml("MainMenu", {
      scanEnabled: true,
      scanTimeoutMs: 3000,
      hoverEnabled: true,
      hoverTimeoutMs: 1500,
      mouseclickEnabled: false,
      language: "fr-FR",
    });
    expect(xml).toContain("<StartGrid>MainMenu</StartGrid>");
    expect(xml).toContain("<ScanEnabled>true</ScanEnabled>");
    expect(xml).toContain("<ScanTimeoutMs>3000</ScanTimeoutMs>");
    expect(xml).toContain("<HoverEnabled>true</HoverEnabled>");
    expect(xml).toContain("<HoverTimeoutMs>1500</HoverTimeoutMs>");
    expect(xml).toContain("<MouseclickEnabled>false</MouseclickEnabled>");
    expect(xml).toContain("<Language>fr-FR</Language>");
  });

  it("createSettingsXml includes XML namespace", async () => {
    const xml = Gridset.createSettingsXml("Home");
    expect(xml).toContain(
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    );
  });

  it("createSettingsXml handles partial options", async () => {
    const xml = Gridset.createSettingsXml("Home", {
      scanEnabled: true,
      language: "de-DE",
    });
    expect(xml).toContain("<ScanEnabled>true</ScanEnabled>");
    expect(xml).toContain("<Language>de-DE</Language>");
    // Should still have defaults for unspecified options
    expect(xml).toContain("<HoverEnabled>false</HoverEnabled>");
    expect(xml).toContain("<MouseclickEnabled>true</MouseclickEnabled>");
  });
});

describe("Grid3 FileMap XML Builder", () => {
  it("createFileMapXml creates valid XML with single grid", async () => {
    const xml = Gridset.createFileMapXml([
      { name: "Home", path: "Grids\\Home\\grid.xml" },
    ]);
    expect(xml).toContain("<FileMap");
    expect(xml).toContain("<Entries>");
    expect(xml).toContain("<Entry");
    expect(xml).toContain('StaticFile="Grids\\Home\\grid.xml"');
  });

  it("createFileMapXml creates valid XML with multiple grids", async () => {
    const xml = Gridset.createFileMapXml([
      { name: "Home", path: "Grids\\Home\\grid.xml" },
      { name: "Menu", path: "Grids\\Menu\\grid.xml" },
      { name: "Settings", path: "Grids\\Settings\\grid.xml" },
    ]);
    expect(xml).toContain('StaticFile="Grids\\Home\\grid.xml"');
    expect(xml).toContain('StaticFile="Grids\\Menu\\grid.xml"');
    expect(xml).toContain('StaticFile="Grids\\Settings\\grid.xml"');
  });

  it("createFileMapXml includes dynamic files when provided", async () => {
    const xml = Gridset.createFileMapXml([
      {
        name: "Home",
        path: "Grids\\Home\\grid.xml",
        dynamicFiles: ["dynamic1.xml", "dynamic2.xml"],
      },
    ]);
    expect(xml).toContain("<DynamicFiles>");
    expect(xml).toContain("<File>dynamic1.xml</File>");
    expect(xml).toContain("<File>dynamic2.xml</File>");
  });

  it("createFileMapXml omits DynamicFiles when empty", async () => {
    const xml = Gridset.createFileMapXml([
      { name: "Home", path: "Grids\\Home\\grid.xml", dynamicFiles: [] },
    ]);
    expect(xml).not.toContain("<DynamicFiles>");
  });

  it("createFileMapXml includes XML namespace", async () => {
    const xml = Gridset.createFileMapXml([
      { name: "Home", path: "Grids\\Home\\grid.xml" },
    ]);
    expect(xml).toContain(
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    );
  });

  it("createFileMapXml handles mixed grids with and without dynamic files", async () => {
    const xml = Gridset.createFileMapXml([
      { name: "Home", path: "Grids\\Home\\grid.xml" },
      {
        name: "Menu",
        path: "Grids\\Menu\\grid.xml",
        dynamicFiles: ["menu_dynamic.xml"],
      },
    ]);
    expect(xml).toContain('StaticFile="Grids\\Home\\grid.xml"');
    expect(xml).toContain('StaticFile="Grids\\Menu\\grid.xml"');
    expect(xml).toContain("<File>menu_dynamic.xml</File>");
  });
});

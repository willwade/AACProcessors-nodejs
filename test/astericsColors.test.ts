import {
  normalizeHexColor,
  adjustHexColor,
  getContrastingTextColor,
} from "../src/processors/astericsGridProcessor";

describe("AstericsGrid Color Helpers", () => {
  describe("normalizeHexColor", () => {
    it("should normalize hex formats with # prefix", async () => {
      expect(normalizeHexColor("#abc")).toBe("#aabbcc");
      expect(normalizeHexColor("#aabbcc")).toBe("#aabbcc");
    });

    it("should return null for hex without # prefix (strict)", async () => {
      expect(normalizeHexColor("abc")).toBeNull();
      expect(normalizeHexColor("aabbcc")).toBeNull();
    });

    it("should return null for invalid colors", async () => {
      expect(normalizeHexColor("#zzzzzz")).toBeNull();
      expect(normalizeHexColor("")).toBeNull();
    });
  });

  describe("adjustHexColor", () => {
    it("should lighten a color", async () => {
      // #101010 + 10 -> #1a1a1a (16+10=26 -> 0x1a)
      expect(adjustHexColor("#101010", 10)).toBe("#1a1a1a");
    });

    it("should darken a color", async () => {
      expect(adjustHexColor("#aabbcc", -10)).toBe("#a0b1c2");
    });

    it("should clamp to 0 and 255", async () => {
      expect(adjustHexColor("#000000", -100)).toBe("#000000");
      expect(adjustHexColor("#ffffff", 100)).toBe("#ffffff");
    });
  });

  describe("getContrastingTextColor", () => {
    it("should return white for dark backgrounds", async () => {
      expect(getContrastingTextColor("#000000")).toBe("#FFFFFF");
      expect(getContrastingTextColor("#333333")).toBe("#FFFFFF");
    });

    it("should return black for light backgrounds", async () => {
      expect(getContrastingTextColor("#FFFFFF")).toBe("#000000");
      expect(getContrastingTextColor("#DDDDDD")).toBe("#000000");
    });
  });
});

/**
 * Grid3 Color Utilities
 *
 * Comprehensive color handling for Grid3 format, including:
 * - CSS color name lookup (147 named colors)
 * - Color format conversion (hex, RGB, RGBA, named colors)
 * - Color manipulation (darkening, normalization)
 * - Grid3-specific color formatting (8-digit ARGB hex)
 */

/**
 * CSS color names to RGB values
 * Supports 147 standard CSS color names
 */
const CSS_COLORS: Record<string, [number, number, number]> = {
  aliceblue: [240, 248, 255],
  antiquewhite: [250, 235, 215],
  aqua: [0, 255, 255],
  aquamarine: [127, 255, 212],
  azure: [240, 255, 255],
  beige: [245, 245, 220],
  bisque: [255, 228, 196],
  black: [0, 0, 0],
  blanchedalmond: [255, 235, 205],
  blue: [0, 0, 255],
  blueviolet: [138, 43, 226],
  brown: [165, 42, 42],
  burlywood: [222, 184, 135],
  cadetblue: [95, 158, 160],
  chartreuse: [127, 255, 0],
  chocolate: [210, 105, 30],
  coral: [255, 127, 80],
  cornflowerblue: [100, 149, 237],
  cornsilk: [255, 248, 220],
  crimson: [220, 20, 60],
  cyan: [0, 255, 255],
  darkblue: [0, 0, 139],
  darkcyan: [0, 139, 139],
  darkgoldenrod: [184, 134, 11],
  darkgray: [169, 169, 169],
  darkgreen: [0, 100, 0],
  darkgrey: [169, 169, 169],
  darkkhaki: [189, 183, 107],
  darkmagenta: [139, 0, 139],
  darkolivegreen: [85, 107, 47],
  darkorange: [255, 140, 0],
  darkorchid: [153, 50, 204],
  darkred: [139, 0, 0],
  darksalmon: [233, 150, 122],
  darkseagreen: [143, 188, 143],
  darkslateblue: [72, 61, 139],
  darkslategray: [47, 79, 79],
  darkslategrey: [47, 79, 79],
  darkturquoise: [0, 206, 209],
  darkviolet: [148, 0, 211],
  deeppink: [255, 20, 147],
  deepskyblue: [0, 191, 255],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  dodgerblue: [30, 144, 255],
  firebrick: [178, 34, 34],
  floralwhite: [255, 250, 240],
  forestgreen: [34, 139, 34],
  fuchsia: [255, 0, 255],
  gainsboro: [220, 220, 220],
  ghostwhite: [248, 248, 255],
  gold: [255, 215, 0],
  goldenrod: [218, 165, 32],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  green: [0, 128, 0],
  greenyellow: [173, 255, 47],
  honeydew: [240, 255, 240],
  hotpink: [255, 105, 180],
  indianred: [205, 92, 92],
  indigo: [75, 0, 130],
  ivory: [255, 255, 240],
  khaki: [240, 230, 140],
  lavender: [230, 230, 250],
  lavenderblush: [255, 240, 245],
  lawngreen: [124, 252, 0],
  lemonchiffon: [255, 250, 205],
  lightblue: [173, 216, 230],
  lightcoral: [240, 128, 128],
  lightcyan: [224, 255, 255],
  lightgoldenrodyellow: [250, 250, 210],
  lightgray: [211, 211, 211],
  lightgreen: [144, 238, 144],
  lightgrey: [211, 211, 211],
  lightpink: [255, 182, 193],
  lightsalmon: [255, 160, 122],
  lightseagreen: [32, 178, 170],
  lightskyblue: [135, 206, 250],
  lightslategray: [119, 136, 153],
  lightslategrey: [119, 136, 153],
  lightsteelblue: [176, 196, 222],
  lightyellow: [255, 255, 224],
  lime: [0, 255, 0],
  limegreen: [50, 205, 50],
  linen: [250, 240, 230],
  magenta: [255, 0, 255],
  maroon: [128, 0, 0],
  mediumaquamarine: [102, 205, 170],
  mediumblue: [0, 0, 205],
  mediumorchid: [186, 85, 211],
  mediumpurple: [147, 112, 219],
  mediumseagreen: [60, 179, 113],
  mediumslateblue: [123, 104, 238],
  mediumspringgreen: [0, 250, 154],
  mediumturquoise: [72, 209, 204],
  mediumvioletred: [199, 21, 133],
  midnightblue: [25, 25, 112],
  mintcream: [245, 255, 250],
  mistyrose: [255, 228, 225],
  moccasin: [255, 228, 181],
  navajowhite: [255, 222, 173],
  navy: [0, 0, 128],
  oldlace: [253, 245, 230],
  olive: [128, 128, 0],
  olivedrab: [107, 142, 35],
  orange: [255, 165, 0],
  orangered: [255, 69, 0],
  orchid: [218, 112, 214],
  palegoldenrod: [238, 232, 170],
  palegreen: [152, 251, 152],
  paleturquoise: [175, 238, 238],
  palevioletred: [219, 112, 147],
  papayawhip: [255, 239, 213],
  peachpuff: [255, 218, 185],
  peru: [205, 133, 63],
  pink: [255, 192, 203],
  plum: [221, 160, 221],
  powderblue: [176, 224, 230],
  purple: [128, 0, 128],
  rebeccapurple: [102, 51, 153],
  red: [255, 0, 0],
  rosybrown: [188, 143, 143],
  royalblue: [65, 105, 225],
  saddlebrown: [139, 69, 19],
  salmon: [250, 128, 114],
  sandybrown: [244, 164, 96],
  seagreen: [46, 139, 87],
  seashell: [255, 245, 238],
  sienna: [160, 82, 45],
  silver: [192, 192, 192],
  skyblue: [135, 206, 235],
  slateblue: [106, 90, 205],
  slategray: [112, 128, 144],
  slategrey: [112, 128, 144],
  snow: [255, 250, 250],
  springgreen: [0, 255, 127],
  steelblue: [70, 130, 180],
  tan: [210, 180, 140],
  teal: [0, 128, 128],
  thistle: [216, 191, 216],
  tomato: [255, 99, 71],
  turquoise: [64, 224, 208],
  violet: [238, 130, 238],
  wheat: [245, 222, 179],
  white: [255, 255, 255],
  whitesmoke: [245, 245, 245],
  yellow: [255, 255, 0],
  yellowgreen: [154, 205, 50],
};

/**
 * Get RGB values for a CSS color name
 * @param name - CSS color name (case-insensitive)
 * @returns RGB tuple [r, g, b] or undefined if not found
 */
export function getNamedColor(
  name: string,
): [number, number, number] | undefined {
  const color = CSS_COLORS[name.toLowerCase()];
  return color;
}

/**
 * Convert RGBA values to hex format
 * @param r - Red channel (0-255)
 * @param g - Green channel (0-255)
 * @param b - Blue channel (0-255)
 * @param a - Alpha channel (0-1)
 * @returns Hex color string in format #RRGGBBAA
 */
export function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const red = channelToHex(r);
  const green = channelToHex(g);
  const blue = channelToHex(b);
  const alpha = channelToHex(Math.round(a * 255));
  return `#${red}${green}${blue}${alpha}`;
}

/**
 * Convert a single color channel value to hex
 * @param value - Channel value (0-255)
 * @returns Two-digit hex string
 */
export function channelToHex(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, "0").toUpperCase();
}

/**
 * Clamp RGB channel value to valid range
 * @param value - Channel value
 * @returns Clamped value (0-255)
 */
export function clampColorChannel(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(255, value));
}

/**
 * Clamp alpha value to valid range
 * @param value - Alpha value
 * @returns Clamped value (0-1)
 */
export function clampAlpha(value: number): number {
  if (Number.isNaN(value)) {
    return 1;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * Convert any color format to hex
 * Supports: hex (#RGB, #RRGGBB, #RRGGBBAA), RGB/RGBA, and CSS color names
 * @param value - Color string in any supported format
 * @returns Hex color string (#RRGGBBAA) or undefined if invalid
 */
export function toHexColor(value: string): string | undefined {
  // Try hex format
  const hexMatch = value.match(
    /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  );
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      return `#${hex
        .split("")
        .map((char) => char + char)
        .join("")}`;
    }
    return `#${hex}`;
  }

  // Try RGB/RGBA format
  const rgbMatch = value.match(/^rgba?\((.+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 3 || parts.length === 4) {
      const [r, g, b, a] = parts;
      const red = clampColorChannel(parseFloat(r));
      const green = clampColorChannel(parseFloat(g));
      const blue = clampColorChannel(parseFloat(b));
      const alpha = parts.length === 4 ? clampAlpha(parseFloat(a)) : 1;
      return rgbaToHex(red, green, blue, alpha);
    }
  }

  // Try CSS color name
  const rgb = getNamedColor(value);
  if (rgb) {
    return rgbaToHex(rgb[0], rgb[1], rgb[2], 1);
  }

  return undefined;
}

/**
 * Darken a hex color by a specified amount
 * @param hex - Hex color string
 * @param amount - Amount to darken (0-255)
 * @returns Darkened hex color
 */
export function darkenColor(hex: string, amount: number): string {
  const normalized = ensureAlphaChannel(hex).substring(1); // strip #
  const rgb = normalized.substring(0, 6);
  const alpha = normalized.substring(6) || "FF";
  const r = parseInt(rgb.substring(0, 2), 16);
  const g = parseInt(rgb.substring(2, 4), 16);
  const b = parseInt(rgb.substring(4, 6), 16);
  const clamp = (val: number): number => Math.max(0, Math.min(255, val));
  const newR = clamp(r - amount);
  const newG = clamp(g - amount);
  const newB = clamp(b - amount);
  return `#${channelToHex(newR)}${channelToHex(newG)}${channelToHex(newB)}${alpha.toUpperCase()}`;
}

/**
 * Normalize any color format to Grid3's 8-digit hex format
 * @param input - Color string in any supported format
 * @param fallback - Fallback color if input is invalid (default: white)
 * @returns Normalized color in format #AARRGGBBFF
 */
export function normalizeColor(
  input: string,
  fallback: string = "#FFFFFFFF",
): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return fallback;
  }

  const hex = toHexColor(trimmed);
  if (hex) {
    return ensureAlphaChannel(hex).toUpperCase();
  }

  return fallback;
}

/**
 * Ensure a color has an alpha channel (Grid3 format requires 8-digit ARGB)
 * @param color - Color string (hex format)
 * @returns Color with alpha channel in format #AARRGGBBFF
 */
export function ensureAlphaChannel(color: string | undefined): string {
  if (!color) return "#FFFFFFFF";
  // If already 8 digits (with alpha), return as is
  if (color.match(/^#[0-9A-Fa-f]{8}$/)) return color;
  // If 6 digits (no alpha), add FF for fully opaque
  if (color.match(/^#[0-9A-Fa-f]{6}$/)) return color + "FF";
  // If 3 digits (shorthand), expand to 8
  if (color.match(/^#[0-9A-Fa-f]{3}$/)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}FF`;
  }
  // Invalid or unknown format, return white
  return "#FFFFFFFF";
}

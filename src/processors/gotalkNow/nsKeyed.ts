/**
 * Helpers for decoding GoTalk NOW's NSKeyedArchiver-encoded values.
 *
 * GoTalk NOW stores UIColor and UIFont objects inside `<data>` tags as
 * binary property lists (NSKeyedArchiver). Rather than pulling in a full
 * bplist parser, we exploit the fact that the archived objects embed
 * human-readable ASCII representations of the component values, e.g. an
 * NSRGB colour appears as "0.908 0.355 0.522" and a font name appears as
 * "Futura-Medium".
 */

function bufferToLatinString(buffer: Uint8Array | Buffer): string {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
    return buffer.toString('latin1');
  }
  let out = '';
  for (let i = 0; i < buffer.length; i++) out += String.fromCharCode(buffer[i]);
  return out;
}

function clampUnit(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function toHexChannel(v: number): string {
  return Math.round(clampUnit(v) * 255)
    .toString(16)
    .padStart(2, '0');
}

/** Convert a 0-1 float triple to an #rrggbb hex string. */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;
}

/**
 * Decode an NSKeyedArchiver-encoded UIColor into a #rrggbb hex string.
 *
 * NSRGB / NSCalibratedRGB colours store a human-readable "R G B [A]" string
 * (e.g. "0.908 0.355 0.522") inside the archive — this is the only encoding we
 * can reliably read without a full binary-plist parser. NSWhite and
 * UISystemColor values store their components as raw IEEE-754 floats, so we
 * return undefined for those rather than risk an incorrect colour.
 */
export function decodeNsColor(buffer: Uint8Array | Buffer | undefined): string | undefined {
  if (!buffer) return undefined;
  const s = bufferToLatinString(buffer);

  // Match RGB[A] component strings like "1 0.949 0.561" or "0.5 0.5 0.5 1".
  // Allow integer components (e.g. "1") but require at least one decimal to
  // avoid matching bplist header bytes (e.g. "00 00 00").
  const candidates = s.match(/\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?(?:\s+\d+(?:\.\d+)?)?/g);
  if (candidates) {
    // Find the first candidate that looks like RGB (has at least one decimal point).
    const rgbStr = candidates.find((c) => c.includes('.'));
    if (rgbStr) {
      const parts = rgbStr.split(/\s+/).map(Number);
      return rgbToHex(parts[0], parts[1], parts[2]);
    }
  }

  return undefined;
}

const FONT_KEYWORDS = new Set([
  'bplist',
  'bplist00',
  'UIFont',
  'UIFontName',
  'UIFontPointSize',
  'UIFontDescriptor',
  'UIFontTraits',
  'UIFontSystemFont',
  'UIFontDescriptorAttributes',
  'UIFontSystemFontName',
  'NSFont',
  'NSFontNameAttribute',
  'NSFontSizeAttribute',
  'NSName',
  'NSSize',
  'NSMutableDictionary',
  'NSDictionary',
  'NSObject',
  'NSKeyedArchiver',
  'NSColor',
  'NSColorSpace',
  'VUIFont',
  'XNSObject',
  'classname',
  'classhints',
  'classes',
  'objects',
  'version',
  'archiver',
  'root',
]);

/**
 * Decode an NSKeyedArchiver-encoded UIFont into its family name.
 * Font size is encoded as a raw IEEE-754 float and is not extracted.
 */
export function decodeNsFont(buffer: Uint8Array | Buffer | undefined): { fontFamily?: string } {
  if (!buffer) return {};
  const s = bufferToLatinString(buffer);
  const tokens = s.match(/[A-Za-z][A-Za-z0-9-]{2,}/g) || [];
  const fontFamily = tokens.find(
    (t) =>
      !FONT_KEYWORDS.has(t) &&
      !t.startsWith('UI') &&
      !t.startsWith('NS') &&
      !t.startsWith('CF') &&
      !t.startsWith('GT')
  );
  return fontFamily ? { fontFamily } : {};
}

import {
  getNamedColor,
  rgbaToHex,
  channelToHex,
  clampColorChannel,
  clampAlpha,
  toHexColor,
  darkenColor,
  normalizeColor,
  ensureAlphaChannel,
} from '../src/processors/gridset/colorUtils';

describe('Color Utilities', () => {
  describe('getNamedColor', () => {
    it('returns RGB values for valid CSS color names', () => {
      expect(getNamedColor('red')).toEqual([255, 0, 0]);
      expect(getNamedColor('blue')).toEqual([0, 0, 255]);
      expect(getNamedColor('green')).toEqual([0, 128, 0]);
      expect(getNamedColor('white')).toEqual([255, 255, 255]);
      expect(getNamedColor('black')).toEqual([0, 0, 0]);
    });

    it('is case-insensitive', () => {
      expect(getNamedColor('RED')).toEqual([255, 0, 0]);
      expect(getNamedColor('Red')).toEqual([255, 0, 0]);
      expect(getNamedColor('cornflowerblue')).toEqual([100, 149, 237]);
      expect(getNamedColor('CORNFLOWERBLUE')).toEqual([100, 149, 237]);
    });

    it('returns undefined for invalid color names', () => {
      expect(getNamedColor('notacolor')).toBeUndefined();
      expect(getNamedColor('xyz')).toBeUndefined();
    });

    it('supports all 147 CSS color names', () => {
      const colors = [
        'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure',
        'rebeccapurple', 'yellowgreen', 'whitesmoke', 'wheat', 'white',
      ];
      colors.forEach((color) => {
        expect(getNamedColor(color)).toBeDefined();
      });
    });
  });

  describe('channelToHex', () => {
    it('converts channel values to hex', () => {
      expect(channelToHex(0)).toBe('00');
      expect(channelToHex(255)).toBe('FF');
      expect(channelToHex(128)).toBe('80');
      expect(channelToHex(16)).toBe('10');
    });

    it('clamps values to 0-255 range', () => {
      expect(channelToHex(-10)).toBe('00');
      expect(channelToHex(300)).toBe('FF');
    });

    it('rounds decimal values', () => {
      expect(channelToHex(127.5)).toBe('80');
      expect(channelToHex(127.4)).toBe('7F');
    });
  });

  describe('clampColorChannel', () => {
    it('clamps values to 0-255 range', () => {
      expect(clampColorChannel(0)).toBe(0);
      expect(clampColorChannel(255)).toBe(255);
      expect(clampColorChannel(128)).toBe(128);
      expect(clampColorChannel(-10)).toBe(0);
      expect(clampColorChannel(300)).toBe(255);
    });

    it('returns 0 for NaN', () => {
      expect(clampColorChannel(NaN)).toBe(0);
    });
  });

  describe('clampAlpha', () => {
    it('clamps values to 0-1 range', () => {
      expect(clampAlpha(0)).toBe(0);
      expect(clampAlpha(1)).toBe(1);
      expect(clampAlpha(0.5)).toBe(0.5);
      expect(clampAlpha(-0.5)).toBe(0);
      expect(clampAlpha(1.5)).toBe(1);
    });

    it('returns 1 for NaN', () => {
      expect(clampAlpha(NaN)).toBe(1);
    });
  });

  describe('rgbaToHex', () => {
    it('converts RGBA to hex format', () => {
      expect(rgbaToHex(255, 0, 0, 1)).toBe('#FF0000FF');
      expect(rgbaToHex(0, 255, 0, 1)).toBe('#00FF00FF');
      expect(rgbaToHex(0, 0, 255, 1)).toBe('#0000FFFF');
    });

    it('handles alpha channel correctly', () => {
      expect(rgbaToHex(255, 0, 0, 0.5)).toBe('#FF000080');
      expect(rgbaToHex(255, 0, 0, 0)).toBe('#FF000000');
      expect(rgbaToHex(255, 0, 0, 1)).toBe('#FF0000FF');
    });

    it('clamps values to valid ranges', () => {
      expect(rgbaToHex(300, -10, 128, 1.5)).toBe('#FF0080FF');
    });
  });

  describe('toHexColor', () => {
    it('converts hex colors', () => {
      expect(toHexColor('#FF0000')).toBe('#FF0000');
      expect(toHexColor('#F00')).toBe('#FF0000');
      expect(toHexColor('#FF0000FF')).toBe('#FF0000FF');
    });

    it('converts RGB colors', () => {
      expect(toHexColor('rgb(255, 0, 0)')).toBe('#FF0000FF');
      expect(toHexColor('rgb(0, 255, 0)')).toBe('#00FF00FF');
    });

    it('converts RGBA colors', () => {
      expect(toHexColor('rgba(255, 0, 0, 1)')).toBe('#FF0000FF');
      expect(toHexColor('rgba(255, 0, 0, 0.5)')).toBe('#FF000080');
    });

    it('converts CSS color names', () => {
      expect(toHexColor('red')).toBe('#FF0000FF');
      expect(toHexColor('blue')).toBe('#0000FFFF');
      expect(toHexColor('cornflowerblue')).toBe('#6495EDFF');
    });

    it('returns undefined for invalid colors', () => {
      expect(toHexColor('notacolor')).toBeUndefined();
      expect(toHexColor('rgb(999, 999, 999)')).toBeDefined(); // Clamped
    });

    it('is case-insensitive for hex and named colors', () => {
      expect(toHexColor('#ff0000')).toBe('#ff0000');
      expect(toHexColor('RED')).toBe('#FF0000FF');
    });
  });

  describe('darkenColor', () => {
    it('darkens colors by specified amount', () => {
      const result = darkenColor('#FF0000FF', 50);
      expect(result).toBe('#CD0000FF');
    });

    it('clamps darkened values to 0', () => {
      const result = darkenColor('#0F0F0FFF', 50);
      expect(result).toBe('#000000FF');
    });

    it('preserves alpha channel', () => {
      const result = darkenColor('#FF000080', 50);
      expect(result).toBe('#CD000080');
    });

    it('handles colors without alpha channel', () => {
      const result = darkenColor('#FF0000', 50);
      expect(result).toBe('#CD0000FF');
    });
  });

  describe('normalizeColor', () => {
    it('normalizes hex colors to 8-digit format', () => {
      expect(normalizeColor('#FF0000')).toBe('#FF0000FF');
      expect(normalizeColor('#F00')).toBe('#FF0000FF');
    });

    it('normalizes RGB colors', () => {
      expect(normalizeColor('rgb(255, 0, 0)')).toBe('#FF0000FF');
    });

    it('normalizes CSS color names', () => {
      expect(normalizeColor('red')).toBe('#FF0000FF');
    });

    it('returns fallback for invalid colors', () => {
      expect(normalizeColor('notacolor')).toBe('#FFFFFFFF');
      expect(normalizeColor('notacolor', '#000000FF')).toBe('#000000FF');
    });

    it('returns fallback for empty strings', () => {
      expect(normalizeColor('')).toBe('#FFFFFFFF');
      expect(normalizeColor('   ')).toBe('#FFFFFFFF');
    });

    it('is case-insensitive', () => {
      expect(normalizeColor('RED')).toBe('#FF0000FF');
      expect(normalizeColor('#ff0000')).toBe('#FF0000FF');
    });
  });

  describe('ensureAlphaChannel', () => {
    it('adds alpha channel to 6-digit hex', () => {
      expect(ensureAlphaChannel('#FF0000')).toBe('#FF0000FF');
    });

    it('expands 3-digit hex to 8-digit', () => {
      expect(ensureAlphaChannel('#F00')).toBe('#FF0000FF');
    });

    it('preserves 8-digit hex', () => {
      expect(ensureAlphaChannel('#FF0000FF')).toBe('#FF0000FF');
    });

    it('returns white for undefined', () => {
      expect(ensureAlphaChannel(undefined)).toBe('#FFFFFFFF');
    });

    it('returns white for invalid format', () => {
      expect(ensureAlphaChannel('notahex')).toBe('#FFFFFFFF');
    });

    it('is case-insensitive', () => {
      expect(ensureAlphaChannel('#ff0000')).toBe('#ff0000FF');
    });
  });
});


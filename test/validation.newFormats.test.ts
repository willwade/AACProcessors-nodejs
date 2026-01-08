import path from 'path';
import plist from 'plist';
import ExcelJS from 'exceljs';
import { validateFileOrBuffer, ValidationFailureError } from '../src/validation';
import { OpmlProcessor } from '../src/processors/opmlProcessor';
import { DotProcessor } from '../src/processors/dotProcessor';

describe('Validation - additional formats', () => {
  const asset = (...parts: string[]): string => path.join(__dirname, 'assets', ...parts);

  it('validates Asterics .grd assets', async () => {
    const filePath = asset('asterics', 'example.grd');
    const result = await validateFileOrBuffer(filePath);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('asterics');
  });

  it('validates OPML asset', async () => {
    const filePath = asset('opml', 'example.opml');
    const result = await validateFileOrBuffer(filePath);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('opml');
  });

  it('validates DOT asset', async () => {
    const filePath = asset('dot', 'example.dot');
    const result = await validateFileOrBuffer(filePath);
    expect(result.valid).toBe(true);
    expect(result.format).toBe('dot');
  });

  it('validates Excel workbook buffers', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Page 1');
    sheet.getCell('A1').value = 'Hello';
    sheet.getCell('B2').value = 'World';
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await validateFileOrBuffer(buffer, 'sample.xlsx');
    expect(result.valid).toBe(true);
    expect(result.format).toBe('excel');
  });

  it('fails legacy .xls with structured result', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Sheet 1').getCell('A1').value = 'legacy';
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await validateFileOrBuffer(buffer, 'legacy.xls');
    expect(result.valid).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
    expect(result.results.some((c) => c.error?.includes('.xls'))).toBe(true);
  });

  it('validates Apple Panels plist buffers', async () => {
    const plistContent = plist.build({
      Panels: {
        panel1: {
          ID: 'panel1',
          Name: 'Panel 1',
          PanelObjects: [
            {
              PanelObjectType: 'Button',
              DisplayText: 'Hi',
              Rect: '{{0,0},{100,100}}',
              Actions: [
                {
                  ActionType: 'ActionPressKeyCharSequence',
                  ActionParam: { CharString: 'Hi' },
                },
              ],
            },
          ],
        },
      },
    });
    const buffer = Buffer.from(plistContent, 'utf8');
    const result = await validateFileOrBuffer(buffer, 'panel.plist');
    expect(result.valid).toBe(true);
    expect(result.format).toBe('applepanels');
  });

  it('validates OBFSet bundles', async () => {
    const obfset = [
      { id: 'board1', buttons: [{ id: 'b1', label: 'Hi' }], grid: { rows: 1, columns: 1 } },
      { id: 'board2', buttons: [{ id: 'b2', label: 'There' }], grid: { rows: 1, columns: 1 } },
    ];
    const buffer = Buffer.from(JSON.stringify(obfset));
    const result = await validateFileOrBuffer(buffer, 'bundle.obfset');
    expect(result.valid).toBe(true);
    expect(result.format).toBe('obfset');
  });

  it('exposes ValidationResult on OPML parse failures', async () => {
    const invalid = Buffer.from('<opml><body></body></opml>', 'utf8');
    await expect(new OpmlProcessor().loadIntoTree(invalid)).rejects.toThrow(ValidationFailureError);
  });

  it('exposes ValidationResult on DOT binary content', async () => {
    const invalid = Buffer.from([0, 1, 2, 3]);
    await expect(new DotProcessor().loadIntoTree(invalid)).rejects.toThrow(ValidationFailureError);
  });
});

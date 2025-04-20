// Test GridsetProcessor export/saveFromTree
const fs = require('fs');
const path = require('path');
const GridsetProcessor = require('../src/processors/gridsetProcessor');
describe('GridsetProcessor.saveFromTree', () => {
  const gsPath = path.join(__dirname, '../examples/example.gridset.json');
  const outPath = path.join(__dirname, 'out.gridset.json');
  afterAll(() => { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); });
  it('exports tree to Gridset JSON', () => {
    // If no example.gridset.json, skip
    if (!fs.existsSync(gsPath)) return;
    const tree = require('../src/processors/gridsetProcessor').prototype.loadIntoTree.call(GridsetProcessor, gsPath);
    GridsetProcessor.prototype.saveFromTree.call(GridsetProcessor, tree, outPath);
    const exported = fs.readFileSync(outPath, 'utf8');
    expect(exported).toContain('pages');
    expect(exported).toContain('rootId');
  });
});

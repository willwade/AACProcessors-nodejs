// Test OPMLProcessor export/saveFromTree
const fs = require('fs');
const path = require('path');
const OPMLProcessor = require('../src/processors/opmlProcessor');
describe('OPMLProcessor.saveFromTree', () => {
  const opmlPath = path.join(__dirname, '../examples/example.opml');
  const outPath = path.join(__dirname, 'out.opml');
  afterAll(() => { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); });
  it('exports tree to OPML XML', () => {
    const tree = OPMLProcessor.loadIntoTree(opmlPath);
    OPMLProcessor.saveFromTree(tree, outPath);
    const exported = fs.readFileSync(outPath, 'utf8');
    expect(exported).toContain('<?xml');
    expect(exported).toContain('<opml');
    expect(exported).toContain('<outline');
  });
});

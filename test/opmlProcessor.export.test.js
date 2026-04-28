// Test OPMLProcessor export/saveFromTree
const fs = require('fs');
const path = require('path');
const { OpmlProcessor } = require('../dist/processors/opmlProcessor');
describe('OPMLProcessor.saveFromTree', () => {
  const opmlPath = path.join(__dirname, 'assets/opml/example.opml');
  const outPath = path.join(__dirname, 'out.opml');
  afterAll(() => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });
  it('exports tree to OPML XML', async () => {
    const processor = new OpmlProcessor();
    const tree = await processor.loadIntoTree(opmlPath);
    await processor.saveFromTree(tree, outPath);
    const exported = fs.readFileSync(outPath, 'utf8');
    expect(exported).toContain('<?xml');
    expect(exported).toContain('<opml');
    expect(exported).toContain('<outline');
  });
});

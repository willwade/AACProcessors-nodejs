// Test DotProcessor export/saveFromTree
const fs = require('fs');
const path = require('path');
const DotProcessor = require('../src/processors/dotProcessor');
describe('DotProcessor.saveFromTree', () => {
  const dotPath = path.join(__dirname, '../examples/example.dot');
  const outPath = path.join(__dirname, 'out.dot');
  afterAll(() => { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); });
  it('exports tree to DOT format', () => {
    const tree = DotProcessor.loadIntoTree(dotPath);
    DotProcessor.saveFromTree(tree, outPath);
    const exported = fs.readFileSync(outPath, 'utf8');
    expect(exported).toContain('digraph AACBoard');
    expect(exported).toContain('[');
    expect(exported).toContain('->');
  });
});

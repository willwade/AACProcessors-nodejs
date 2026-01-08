import fs from 'fs';
import path from 'path';
import { OpmlProcessor } from '../src/processors/opmlProcessor';
// import { AACTree } from '../src/core/treeStructure'; // Unused import
const outPath = path.join(__dirname, 'out.opml');


describe('OpmlProcessor round-trip', () => {
  const opmlPath = path.join(__dirname, 'assets/opml/example.opml');
  afterAll(async () => {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  });
  it('round-trips OPML file without losing pages', async () => {
    const processor = new OpmlProcessor();
    const tree1 = await processor.loadIntoTree(opmlPath);
    await processor.saveFromTree(tree1, outPath);
    const tree2 = await processor.loadIntoTree(outPath);
    // Compare set of page names (labels)
    const filterArtificial = (arr: any[]) =>
      arr.filter((n: any) => n !== 'Super Root' && n !== 'Root').sort();
    const names1 = filterArtificial(Object.values(tree1.pages).map((p) => p.name));
    const names2 = filterArtificial(Object.values(tree2.pages).map((p) => p.name));
    expect(names2).toEqual(names1);
    // Compare root names
    if (tree2.rootId && tree1.rootId) {
      expect(tree2.getPage(tree2.rootId)?.name).toEqual(tree1.getPage(tree1.rootId)?.name);
    }
  });
});

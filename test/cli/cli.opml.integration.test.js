// CLI integration test for OPML
const path = require('path');
const { execSync } = require('child_process');

describe('aac-processors CLI (OPML)', () => {
  const cliPath = path.join(__dirname, '../src/cli/index.js');
  const opmlExample = path.join(__dirname, '../examples/example.opml');

  it('extracts texts from an opml file', () => {
    const result = execSync(`node ${cliPath} extract ${opmlExample} --format opml`).toString();
    expect(result).toContain('Extracted texts:');
  });
});

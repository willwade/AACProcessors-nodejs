// CLI integration test for DOT
const path = require('path');
const { execSync } = require('child_process');

describe('aac-processors CLI (DOT)', () => {
  const cliPath = path.join(__dirname, '../src/cli/index.js');
  const dotExample = path.join(__dirname, '../examples/example.dot');

  it('extracts texts from a dot file', () => {
    const result = execSync(`node ${cliPath} extract ${dotExample} --format dot`).toString();
    expect(result).toContain('Extracted texts:');
  });
});

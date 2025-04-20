// CLI integration test for OBF/OBZ
const path = require('path');
const { execSync } = require('child_process');

describe('aac-processors CLI (OBF/OBZ)', () => {
  const cliPath = path.join(__dirname, '../src/cli/index.js');
  const obfExample = path.join(__dirname, 'fixtures', 'example.obf');
  const obzExample = path.join(__dirname, 'fixtures', 'multi-board.obz');

  it('extracts texts from an obf file', () => {
    const result = execSync(`node ${cliPath} extract ${obfExample} --format obf`).toString();
    expect(result).toContain('Extracted texts:');
  });

  it('extracts texts from an obz file', () => {
    const result = execSync(`node ${cliPath} extract ${obzExample} --format obf`).toString();
    expect(result).toContain('Extracted texts:');
  });
});

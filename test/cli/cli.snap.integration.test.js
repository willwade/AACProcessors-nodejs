const { execSync } = require('child_process');
const path = require('path');

describe('aac-processors CLI (Snap)', () => {
  const cliPath = path.join(__dirname, '../../src/cli/index.js');
  const snapExample = path.join(__dirname, '../../examples/example.sps');

  it('extracts texts from a snap file', () => {
    const result = execSync(`node ${cliPath} extract ${snapExample} --format snap`).toString();
    expect(result).toContain('Extracted texts:');
  });

  it('pretty prints analyze for snap', () => {
    const result = execSync(`node ${cliPath} analyze ${snapExample} --format snap --pretty`).toString();
    expect(result).toContain('Page:');
    expect(result).toContain('- Button:');
  });
});

const { execSync } = require('child_process');
const path = require('path');

describe('aac-processors CLI', () => {
  const cliPath = path.join(__dirname, '../../dist/cli/index.js');
  const gridsetExample = path.join(__dirname, '../../examples/example.gridset');
  const touchchatExample = path.join(__dirname, '../../examples/example.ce');

  it('extracts texts from a gridset file', () => {
    const result = execSync(`node ${cliPath} extract ${gridsetExample} --format gridset`).toString();
    expect(result).toContain('Extracted texts:');
  });

  it('extracts texts from a touchchat file', () => {
    const result = execSync(`node ${cliPath} extract ${touchchatExample} --format touchchat`).toString();
    expect(result).toContain('Extracted texts:');
  });

  it('pretty prints analyze for gridset', () => {
    const result = execSync(`node ${cliPath} analyze ${gridsetExample} --format gridset --pretty`).toString();
    expect(result).toContain('Page:');
    expect(result).toContain('- Button:');
  });

  it('pretty prints analyze for touchchat', () => {
    const result = execSync(`node ${cliPath} analyze ${touchchatExample} --format touchchat --pretty`).toString();
    expect(result).toContain('Page:');
    expect(result).toContain('- Button:');
  });
});

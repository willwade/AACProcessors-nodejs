import fs from 'fs';
import path from 'path';

type PatternCheck = { pattern: RegExp; label: string };

describe('Browser bundle output', () => {
  it('should not include Node.js module references', () => {
    const distDir = path.join(__dirname, '..', 'dist', 'browser');
    expect(fs.existsSync(distDir)).toBe(true);

    const patterns: PatternCheck[] = [
      { pattern: /__vite-browser-external/, label: '__vite-browser-external' },
      { pattern: /require\(['"]fs['"]\)/, label: 'require("fs")' },
      { pattern: /from ['"]fs['"]/, label: 'import fs' },
      { pattern: /require\(['"]path['"]\)/, label: 'require("path")' },
      { pattern: /from ['"]path['"]/, label: 'import path' },
    ];

    const targetFiles = [
      path.join(distDir, 'processors/gridset/symbols.js'),
      path.join(distDir, 'processors/gridset/password.js'),
      path.join(distDir, 'validation/gridsetValidator.js'),
    ].filter((filePath) => fs.existsSync(filePath));

    const offenders: string[] = [];
    for (const file of targetFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const { pattern, label } of patterns) {
        if (pattern.test(content)) {
          offenders.push(`${file}: ${label}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

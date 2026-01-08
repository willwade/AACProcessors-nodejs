const { execSync } = require('child_process');
const { existsSync, readdirSync, readFileSync } = require('fs');
const path = require('path');

function run(command, options = {}) {
  execSync(command, { stdio: 'inherit', ...options });
}

function assertNoNodeBuiltins(distDir) {
  const patterns = [
    { pattern: /__vite-browser-external/, label: '__vite-browser-external' },
    { pattern: /require\(['"]fs['"]\)/, label: 'require("fs")' },
    { pattern: /from ['"]fs['"]/, label: 'import fs' },
    { pattern: /require\(['"]path['"]\)/, label: 'require("path")' },
    { pattern: /from ['"]path['"]/, label: 'import path' },
  ];

  const targets = [
    path.join(distDir, 'processors/gridset/symbols.js'),
    path.join(distDir, 'processors/gridset/password.js'),
    path.join(distDir, 'validation/gridsetValidator.js'),
  ].filter((filePath) => existsSync(filePath));

  const offenders = [];
  for (const file of targets) {
    const content = readFileSync(file, 'utf8');
    for (const { pattern, label } of patterns) {
      if (pattern.test(content)) {
        offenders.push(`${file}: ${label}`);
      }
    }
  }

  if (offenders.length) {
    throw new Error(`Browser bundle contains Node references:\n${offenders.join('\n')}`);
  }
}

run('npm run build:browser');
run('npm --prefix examples/vitedemo run build');

const distDir = path.join(__dirname, '..', 'dist', 'browser');
assertNoNodeBuiltins(distDir);

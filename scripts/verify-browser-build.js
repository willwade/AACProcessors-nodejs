const fs = require('fs');
const path = require('path');

const requiredFiles = [
  path.join('dist', 'browser', 'index.browser.js'),
  path.join('dist', 'index.browser.d.ts'),
];

const missing = requiredFiles.filter((file) => !fs.existsSync(file));

if (missing.length > 0) {
  console.error('Browser build verification failed. Missing files:');
  missing.forEach((file) => {
    console.error(`- ${file}`);
  });
  process.exit(1);
}

const empty = requiredFiles.filter((file) => fs.statSync(file).size === 0);
if (empty.length > 0) {
  console.error('Browser build verification failed. Empty files:');
  empty.forEach((file) => {
    console.error(`- ${file}`);
  });
  process.exit(1);
}

console.log('Browser build verification passed.');

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'utilities', 'analytics', 'reference', 'data');
const destDir = path.join(__dirname, '..', 'dist', 'utilities', 'analytics', 'reference', 'data');

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursiveSync(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

copyRecursiveSync(srcDir, destDir);

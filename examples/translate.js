const TouchChatProcessor = require('../src/processors/touchChatProcessor');

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Please provide a TouchChat .ce file path');
    process.exit(1);
  }

  const processor = new TouchChatProcessor();
  const texts = processor.extractTexts(filePath);
  console.log('Found texts:', texts.length);
  
  // Group texts by length to help identify patterns
  const lengthGroups = {};
  texts.forEach(text => {
    const len = text.length;
    if (!lengthGroups[len]) lengthGroups[len] = [];
    lengthGroups[len].push(text);
  });

  console.log('\nTexts grouped by length:');
  Object.entries(lengthGroups)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([len, group]) => {
      if (group.length > 0) {
        console.log(`\nLength ${len} (${group.length} items):`);
        // Show first 5 examples
        console.log(group.slice(0, 5));
      }
    });

  // Show unique texts to identify duplicates
  const unique = new Set(texts);
  console.log('\nUnique texts:', unique.size);
  console.log('Duplicate texts:', texts.length - unique.size);
}

main().catch(console.error);

/**
 * Grid3 Wordlist Demo
 * 
 * This example demonstrates how to:
 * 1. Extract wordlists from an existing Grid3 gridset
 * 2. Create new wordlists from data
 * 3. Update wordlists in a gridset
 * 
 * Run with: npx ts-node examples/wordlist-demo.ts
 */

import fs from 'fs';
import path from 'path';
import {
  createWordlist,
  extractWordlists,
  updateWordlist,
  WordList,
  WordListItem,
} from '../dist/index';

async function main() {
  console.log('=== Grid3 Wordlist Demo ===\n');

  // Path to example gridset
  const gridsetPath = path.join(__dirname, '../examples/example.gridset');

  if (!fs.existsSync(gridsetPath)) {
    console.log(`Example gridset not found at ${gridsetPath}`);
    console.log('Creating a demo gridset with wordlists...\n');
    await createDemoGridset();
    return;
  }

  // 1. EXTRACT WORDLISTS FROM EXISTING GRIDSET
  console.log('1. Extracting wordlists from example.gridset...\n');
  const gridsetBuffer = fs.readFileSync(gridsetPath);
  const wordlists = extractWordlists(gridsetBuffer);

  if (wordlists.size === 0) {
    console.log('No wordlists found in example.gridset');
    console.log('Creating demo gridset with wordlists...\n');
    await createDemoGridset();
    return;
  }

  console.log(`Found ${wordlists.size} grid(s) with wordlists:\n`);
  wordlists.forEach((wordlist, gridName) => {
    console.log(`  Grid: "${gridName}"`);
    console.log(`  Items: ${wordlist.items.length}`);
    wordlist.items.slice(0, 3).forEach((item) => {
      console.log(`    - "${item.text}"${item.image ? ` [${item.image}]` : ''}`);
    });
    if (wordlist.items.length > 3) {
      console.log(`    ... and ${wordlist.items.length - 3} more`);
    }
    console.log();
  });

  // 2. CREATE A NEW WORDLIST
  console.log('2. Creating a new wordlist from data...\n');

  // Simple array of strings
  const simpleWordlist = createWordlist(['hello', 'hi', 'hey', 'greetings']);
  console.log('Simple wordlist (from array):');
  console.log(`  Items: ${simpleWordlist.items.length}`);
  simpleWordlist.items.forEach((item) => {
    console.log(`    - "${item.text}"`);
  });
  console.log();

  // Array with metadata
  const metadataWordlist = createWordlist([
    { text: 'hello', image: '[WIDGIT]greetings/hello.emf', partOfSpeech: 'Interjection' },
    { text: 'goodbye', image: '[WIDGIT]greetings/goodbye.emf', partOfSpeech: 'Interjection' },
    { text: 'thank you', image: '[WIDGIT]social/thankyou.emf', partOfSpeech: 'Phrase' },
  ]);
  console.log('Wordlist with metadata (from objects):');
  metadataWordlist.items.forEach((item) => {
    console.log(`    - "${item.text}"`);
    if (item.image) console.log(`      Image: ${item.image}`);
    if (item.partOfSpeech) console.log(`      POS: ${item.partOfSpeech}`);
  });
  console.log();

  // Dictionary input
  const dictWordlist = createWordlist({
    greeting: 'hello',
    farewell: 'goodbye',
    gratitude: 'thank you',
  });
  console.log('Wordlist from dictionary:');
  dictWordlist.items.forEach((item) => {
    console.log(`    - "${item.text}"`);
  });
  console.log();

  // 3. UPDATE A WORDLIST IN THE GRIDSET
  console.log('3. Updating a wordlist in the gridset...\n');

  // Get the first grid with a wordlist
  const firstGridName = Array.from(wordlists.keys())[0];
  if (firstGridName) {
    console.log(`Updating wordlist in grid: "${firstGridName}"`);

    const newWordlist = createWordlist([
      { text: 'hello', partOfSpeech: 'Interjection' },
      { text: 'hi', partOfSpeech: 'Interjection' },
      { text: 'hey', partOfSpeech: 'Interjection' },
      { text: 'greetings', partOfSpeech: 'Noun' },
    ]);

    try {
      const updatedGridset = updateWordlist(gridsetBuffer, firstGridName, newWordlist);

      // Verify the update
      const verifyWordlists = extractWordlists(updatedGridset);
      const updatedWordlist = verifyWordlists.get(firstGridName);

      console.log(`\nUpdate successful!`);
      console.log(`New wordlist has ${updatedWordlist?.items.length} items:`);
      updatedWordlist?.items.forEach((item) => {
        console.log(`  - "${item.text}" (${item.partOfSpeech})`);
      });

      // Save the updated gridset
      const outputPath = path.join(__dirname, 'wordlist-demo-output.gridset');
      fs.writeFileSync(outputPath, updatedGridset);
      console.log(`\nUpdated gridset saved to: ${outputPath}`);
    } catch (error) {
      console.error('Error updating wordlist:', error);
    }
  }

  console.log('\n=== Demo Complete ===');
}

async function createDemoGridset() {
  console.log('Demo: Creating wordlists from scratch');
  console.log('=====================================\n');

  const greetings = createWordlist([
    { text: 'hello', partOfSpeech: 'Interjection' },
    { text: 'hi', partOfSpeech: 'Interjection' },
    { text: 'hey', partOfSpeech: 'Interjection' },
  ]);

  const farewells = createWordlist([
    { text: 'goodbye', partOfSpeech: 'Interjection' },
    { text: 'bye', partOfSpeech: 'Interjection' },
    { text: 'see you later', partOfSpeech: 'Phrase' },
  ]);

  console.log('Created "Greetings" wordlist:');
  greetings.items.forEach((item) => {
    console.log(`  - "${item.text}" (${item.partOfSpeech})`);
  });

  console.log('\nCreated "Farewells" wordlist:');
  farewells.items.forEach((item) => {
    console.log(`  - "${item.text}" (${item.partOfSpeech})`);
  });

  console.log('\nNote: To use these wordlists in a gridset, use grid-generator');
  console.log('which will create the full gridset structure with these wordlists.');
}

main().catch(console.error);


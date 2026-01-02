const { GridsetProcessor } = require('../../dist/index');

console.log('='.repeat(80));
console.log('LLM INTELLIGENCE: Handling Word Order Changes');
console.log('='.repeat(80));
console.log('');

// Demonstrate how LLM intelligently handles word order
const examples = [
  {
    name: 'Spanish: Subject pronoun dropped',
    english: 'I eat apple',
    spanish: 'Como manzana', // Subject "I" is dropped
    symbols: [
      { text: 'eat', image: '[widgit]/actions/eat.png' },
      { text: 'apple', image: '[widgit]/food/apple.png' }
    ]
  },
  {
    name: 'French: Adjective after noun',
    english: 'red car',
    french: 'voiture rouge', // "car red" - reversed!
    symbols: [
      { text: 'red', image: '[widgit]/colors/red.png' },
      { text: 'car', image: '[widgit]/vehicles/car.png' }
    ]
  },
  {
    name: 'German: Verb-first questions',
    english: 'Do you want',
    german: 'Willst du', // "Want you" - verb first!
    symbols: [
      { text: 'want', image: '[widgit]/actions/want.png' },
      { text: 'you', image: '[widgit]/people/you.png' }
    ]
  },
  {
    name: 'Japanese: SOV word order',
    english: 'I eat apple',
    japanese: '私はリンゴを食べる', // "I apple eat" - SOV!
    symbols: [
      { text: 'I', image: '[widgit]/people/I.png' },
      { text: 'eat', image: '[widgit]/actions/eat.png' },
      { text: 'apple', image: '[widgit]/food/apple.png' }
    ]
  }
];

console.log('HOW POSITIONAL ALIGNMENT FAILS:');
console.log('-'.repeat(80));
console.log('');

examples.forEach((ex, i) => {
  console.log('EXAMPLE ' + (i + 1) + ': ' + ex.name);
  console.log('  English: "' + ex.english + '"');
  const targetLang = ex.name.split(':')[1].split(' ')[1];
  const translated = ex[targetLang.toLowerCase()] || ex.spanish || ex.french || ex.german || ex.japanese;
  console.log('  ' + targetLang + ':   "' + translated + '"');
  console.log('');
  console.log('  Symbols:');
  ex.symbols.forEach(s => console.log('    - "' + s.text + '" → ' + s.image));
  console.log('');
  console.log('  Positional Alignment Result: ❌');
  console.log('    Would attach symbols by position, ignoring word order change!');
  console.log('');
  console.log('  LLM-Based Result: ✅');
  console.log('    LLM understands: "eat" → "' + translated.split(/\s+/).slice(-1)[0] + '" (verb)');
  console.log('                    "apple" → "' + translated.split(/\s+/)[1] + '" (noun)');
  console.log('    Attaches symbols correctly based on MEANING, not position!');
  console.log('');
});

console.log('='.repeat(80));
console.log('LLM PROMPT STRUCTURE');
console.log('='.repeat(80));
console.log('');

const exampleItem = {
  buttonId: 'btn_123',
  textToTranslate: 'I eat apple',
  symbols: [
    { text: 'eat', image: '[widgit]/actions/eat.png' },
    { text: 'apple', image: '[widgit]/food/apple.png' }
  ]
};

console.log('INPUT SENT TO LLM:');
console.log(JSON.stringify(exampleItem, null, 2));
console.log('');

console.log('EXPECTED LLM OUTPUT (Spanish):');
const llmOutput = {
  buttonId: 'btn_123',
  translatedMessage: 'Como manzana', // Smart: knows "I" is dropped
  symbols: [
    { text: 'Como', image: '[widgit]/actions/eat.png' }, // "eat" → "Como"
    { text: 'manzana', image: '[widgit]/food/apple.png' } // "apple" → "manzana"
  ]
};
console.log(JSON.stringify(llmOutput, null, 2));
console.log('');

console.log('WHY THIS WORKS:');
console.log('  ✓ LLM understands Spanish grammar (subject pronouns often dropped)');
console.log('  ✓ LLM maps "eat" to "Como" (the verb, not a noun)');
console.log('  ✓ LLM maps "apple" to "manzana" (the noun, not a verb)');
console.log('  ✓ Symbol attachments based on MEANING, not POSITION!');
console.log('');

console.log('='.repeat(80));
console.log('COMPARISON: Positional vs LLM-Based');
console.log('='.repeat(80));
console.log('');

const testCases = [
  {
    english: 'red car',
    translated: 'voiture rouge', // French: car red
  },
  {
    english: 'I want water',
    translated: 'Quiero agua', // Spanish: I want water
  },
];

testCases.forEach((tc, i) => {
  console.log('TEST ' + (i + 1) + ': "' + tc.english + '"');
  console.log('  Translation: "' + tc.translated + '"');
  console.log('');
  console.log('  Positional Alignment:');
  console.log('    Assumes word positions stay the same');
  console.log('    Result: Symbols may attach to wrong words ❌');
  console.log('');
  console.log('  LLM-Based:');
  console.log('    Understands grammar and vocabulary');
  console.log('    Maps symbols to correct translated words');
  console.log('    Result: Symbols correctly attached ✅');
  console.log('');
});

console.log('='.repeat(80));
console.log('REAL API INTEGRATION EXAMPLE');
console.log('='.repeat(80));
console.log('');

console.log('Using Anthropic Claude API:');
console.log('');
console.log('const anthropic = require(\'@anthropic-ai/sdk\');');
console.log('const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });');
console.log('');
console.log('const response = await client.messages.create({');
console.log('  model: "claude-sonnet-4-20250514",');
console.log('  system: ' + JSON.stringify('You are an AAC gridset translator...') + ',');
console.log('  messages: [{');
console.log('    role: "user",');
console.log('    content: JSON.stringify(itemsToTranslate)');
console.log('  }],');
console.log('  temperature: 0.3');
console.log('});');
console.log('');
console.log('const translations = JSON.parse(response.content[0].text);');
console.log('processor.processLLMTranslations(input, translations, output);');
console.log('');

console.log('='.repeat(80));
console.log('KEY INSIGHTS');
console.log('='.repeat(80));
console.log('');
console.log('1. LIBRARY RESPONSIBILITIES:');
console.log('   ✓ Extract symbol information (which buttons have symbols)');
console.log('   ✓ Format data for LLM (structured JSON)');
console.log('   ✓ Parse LLM response');
console.log('   ✓ Apply translations to gridset');
console.log('');
console.log('2. LLM RESPONSIBILITIES:');
console.log('   ✓ Translate text accurately');
console.log('   ✓ Understand grammar and word order');
console.log('   ✓ Map symbols to correct translated words');
console.log('   ✓ Return structured JSON response');
console.log('');
console.log('3. SEPARATION OF CONCERNS:');
console.log('   • Library = Gridset I/O and structure');
console.log('   • LLM = Intelligence and translation');
console.log('   • Clean API between both');
console.log('');
console.log('4. BENEFITS:');
console.log('   ✓ Library simpler (no complex alignment logic)');
console.log('   ✓ LLM handles edge cases (word order, idioms)');
console.log('   ✓ Better accuracy for complex translations');
console.log('   ✓ Flexible (swap LLM providers easily)');
console.log('   ✓ Can improve LLM prompt without changing library');
console.log('');
console.log('='.repeat(80));
console.log('NEXT STEPS');
console.log('='.repeat(80));
console.log('');
console.log('1. Create API keys for Anthropic/OpenAI');
console.log('2. Run: node scripts/translation/llm-translate-gridset.js');
console.log('3. Inspect: ./tmp/llm-request.json');
console.log('4. Call LLM API with that request');
console.log('5. Parse response and apply translations');
console.log('6. Verify results in Grid 3');
console.log('');
console.log('The library is ready to work with any LLM provider!');
console.log('');
console.log('='.repeat(80));

const { GridsetProcessor } = require('../../dist/index');
const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Gemini 2.0 Flash Translation with Symbol Preservation
 * 
 * This script uses Google's Gemini 2.0 Flash API to translate gridsets
 * while preserving symbol-to-word associations.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY environment variable is required');
  console.error('');
  console.error('Get your free API key from: https://ai.google.dev/');
  console.error('');
  console.error('Then set it before running this script:');
  console.error('  export GEMINI_API_KEY="your-key-here"');
  console.error('  node scripts/translation/gemini-translate-gridset.js "./tmp/Voco Chat.gridset"');
  console.error('');
  process.exit(1);
}

async function callGeminiAPI(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'X-goog-api-key': GEMINI_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.error) {
            reject(new Error(parsed.error.message));
          } else if (parsed.candidates && parsed.candidates[0]) {
            resolve(parsed.candidates[0].content.parts[0].text);
          } else {
            reject(new Error('No valid response from Gemini'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  const inputPath = process.argv[2] || './tmp/Voco Chat.gridset';
  const outputPath = inputPath.replace('.gridset', '-gemini-translated.gridset');
  const targetLanguage = process.argv[3] || 'Spanish';
  const maxItems = parseInt(process.argv[4]) || 20; // Limit for demo

  console.log('='.repeat(80));
  console.log('GEMINI 2.0 FLASH TRANSLATION WITH SYMBOL PRESERVATION');
  console.log('='.repeat(80));
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Target Language: ${targetLanguage}`);
  console.log(`Max Items: ${maxItems}`);
  console.log('');

  const processor = new GridsetProcessor();

  // Step 1: Extract symbol information
  console.log('STEP 1: Extracting symbol information from gridset...');
  const symbolInfo = processor.extractSymbolsForLLM(inputPath);

  // NOTE: This script uses batch processing - sends ALL buttons in a single API call.
  // For large vocabularies (1000+ buttons), consider chunking by page to avoid:
  // - Hitting LLM context window limits
  // - API rate limits
  // - Better error recovery and progress tracking
  //
  // Example chunking approach:
  // - Group buttons by page
  // - Process each page separately
  // - Combine results before applying to gridset
  
  console.log(`  Found ${symbolInfo.length} buttons with symbols`);
  console.log(`  Processing first ${Math.min(maxItems, symbolInfo.length)} items`);
  console.log('');

  // Step 2: Select items to translate
  const itemsToTranslate = symbolInfo.slice(0, maxItems);

  // Step 3: Create prompt for Gemini
  console.log('STEP 2: Creating translation prompt for Gemini...');
  
  const systemPrompt = `You are a translator for AAC (Augmentative and Alternative Communication) gridsets.
Your task is to translate text while preserving symbol-to-word associations.

IMPORTANT: Each item has symbols attached to specific words. When translating:
1. Translate the text to ${targetLanguage}
2. Identify which translated words correspond to the original symbolized words
3. Reattach symbols to the correct translated words

EXAMPLE:
Input: "I want apple" with symbols: [{"text": "apple", "image": "[widgit]/food/apple.png"}]
Output: 
{
  "buttonId": "btn_123",
  "translatedMessage": "Yo quiero manzana",
  "symbols": [{"text": "manzana", "image": "[widgit]/food/apple.png"}]
}

The apple symbol stays with "manzana" (Spanish for apple), not "quiero" (want).

CRITICAL: Return ONLY valid JSON. No markdown, no explanations, just the JSON array.`;

  const itemsJson = JSON.stringify(itemsToTranslate, null, 2);
  const userPrompt = `Translate these ${itemsToTranslate.length} items to ${targetLanguage}:

${itemsJson}

Return your response as a JSON array where each item has:
- buttonId (same as input)
- translatedMessage (your translation)
- symbols (array with text updated to translated words)

Remember: Return ONLY the JSON array, no other text.`;

  console.log(`  Prompt created (${userPrompt.length} characters)`);
  console.log('');

  // Save prompt for inspection
  const promptPath = './tmp/gemini-prompt.json';
  fs.writeFileSync(promptPath, JSON.stringify({ system: systemPrompt, user: userPrompt }, null, 2));
  console.log(`  Prompt saved to: ${promptPath}`);
  console.log('');

  // Step 4: Call Gemini API
  console.log('STEP 3: Calling Gemini 2.0 Flash API...');
  console.log('  This may take a moment...');
  console.log('');

  try {
    const startTime = Date.now();
    const responseText = await callGeminiAPI(systemPrompt + '\n\n' + userPrompt);
    const elapsed = (Date.now() - startTime) / 1000;

    console.log(`  Response received in ${elapsed.toFixed(2)} seconds`);
    console.log(`  Response length: ${responseText.length} characters`);
    console.log('');

    // Clean up response (remove markdown code blocks if present)
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.slice(7);
    }
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();

    // Save raw response
    const responsePath = './tmp/gemini-response.json';
    fs.writeFileSync(responsePath, cleanedResponse);
    console.log(`  Response saved to: ${responsePath}`);
    console.log('');

    // Step 5: Parse JSON response
    console.log('STEP 4: Parsing Gemini response...');
    const translations = JSON.parse(cleanedResponse);
    console.log(`  Parsed ${translations.length} translations`);
    console.log('');

    // Step 6: Show examples
    console.log('STEP 5: Translation examples:');
    console.log('-'.repeat(80));
    
    itemsToTranslate.slice(0, 3).forEach((item, i) => {
      const translation = translations.find(t => t.buttonId === item.buttonId);
      if (!translation) {
        console.log(`\nExample ${i + 1}: NOT FOUND`);
        return;
      }

      console.log(`\nExample ${i + 1}:`);
      console.log(`  Page: ${item.pageName}`);
      console.log(`  Original: "${item.textToTranslate}"`);
      console.log(`  Symbols: ${item.symbols.map(s => `"${s.text}"`).join(', ')}`);
      console.log('');
      console.log(`  Translated: "${translation.translatedMessage}"`);
      if (translation.symbols) {
        console.log(`  Symbols: ${translation.symbols.map(s => `"${s.text}"`).join(', ')}`);
      }
    });
    console.log('');

    // Step 7: Apply translations
    console.log('STEP 6: Applying translations to gridset...');
    processor.processLLMTranslations(inputPath, translations, outputPath);
    console.log('  Translations applied successfully!');
    console.log('');

    // Step 8: Verify
    console.log('STEP 7: Verifying results...');
    const translatedTree = processor.loadIntoTree(outputPath);
    
    let translatedCount = 0;
    let symbolPreservedCount = 0;

    Object.values(translatedTree.pages).forEach(page => {
      page.buttons.forEach(button => {
        const originalItem = symbolInfo.find(s => s.buttonId === button.id);
        if (originalItem && button.message !== originalItem.textToTranslate) {
          translatedCount++;
          if (button.semanticAction?.richText?.symbols?.length > 0) {
            symbolPreservedCount++;
          }
        }
      });
    });

    console.log(`  Translated: ${translatedCount} buttons`);
    console.log(`  Symbols preserved: ${symbolPreservedCount} buttons`);
    console.log('');

    console.log('='.repeat(80));
    console.log('SUCCESS!');
    console.log('='.repeat(80));
    console.log('');
    console.log(`Output saved to: ${outputPath}`);
    console.log('');
    console.log('Files created:');
    console.log(`  ${promptPath} - Prompt sent to Gemini`);
    console.log(`  ${responsePath} - Response from Gemini`);
    console.log(`  ${outputPath} - Translated gridset`);
    console.log('');
    console.log('Next: Open the translated gridset in Grid 3 to verify!');
    console.log('');

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Check your API key is valid');
    console.error('  2. Check you have available API quota');
    console.error('  3. Try reducing --max-items if the prompt is too large');
    console.error('  4. Check the Gemini API status');
    console.error('');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

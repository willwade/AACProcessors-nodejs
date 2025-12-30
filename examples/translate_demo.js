#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const { v2: { Translate } } = require('@google-cloud/translate');
const axios = require('axios');
const SnapProcessor = require('../src/processors/snapProcessor');
const GridsetProcessor = require('../src/processors/gridsetProcessor');
const TouchChatProcessor = require('../src/processors/touchChatProcessor');

// Translation service configurations
const AZURE_TRANSLATOR_KEY = process.env.AZURE_TRANSLATOR_KEY;
const AZURE_TRANSLATOR_REGION = process.env.AZURE_TRANSLATOR_REGION || 'uksouth';
const AZURE_TRANSLATOR_ENDPOINT = 'https://api.cognitive.microsofttranslator.com/translate';

const GOOGLE_TRANSLATE_KEY = process.env.GOOGLE_TRANSLATE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Available processors
const PROCESSORS = [
    GridsetProcessor,
    TouchChatProcessor,
    SnapProcessor
];

// Cache handling
async function loadCache(cacheFile) {
    try {
        const data = await fs.readFile(cacheFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.warn(`Warning: Cache file ${cacheFile} not found or corrupted. Creating new cache.`);
        return {};
    }
}

async function saveCache(cache, cacheFile) {
    await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
}

// Azure Translator
async function azureTranslateBatch(texts, targetLanguage) {
    if (!AZURE_TRANSLATOR_KEY) {
        throw new Error('Azure Translator key not set. Set AZURE_TRANSLATOR_KEY environment variable.');
    }

    const headers = {
        'Ocp-Apim-Subscription-Key': AZURE_TRANSLATOR_KEY,
        'Ocp-Apim-Subscription-Region': AZURE_TRANSLATOR_REGION,
        'Content-Type': 'application/json'
    };

    const params = {
        'api-version': '3.0',
        'from': 'en',
        'to': targetLanguage
    };

    const batchSize = 100;
    const allTranslations = [];

    for (let i = 0; i < texts.length; i += batchSize) {
        const batchTexts = texts.slice(i, i + batchSize);
        const body = batchTexts.map(text => ({ text }));

        try {
            const response = await axios.post(AZURE_TRANSLATOR_ENDPOINT, body, { headers, params });
            const translations = response.data.map(item => item.translations[0].text);
            allTranslations.push(...translations);
        } catch (error) {
            console.error('Azure translation error:', error.message);
            throw error;
        }
    }

    return allTranslations;
}

// Google Translate
async function googleTranslateTexts(texts, targetLanguage) {
    if (!GOOGLE_TRANSLATE_KEY) {
        throw new Error('Google Translate key not set. Set GOOGLE_TRANSLATE_KEY environment variable.');
    }

    try {
        const translate = new Translate({ key: GOOGLE_TRANSLATE_KEY });
        const batchSize = 50;
        const batches = [];
        
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            batches.push(batch);
        }
        
        const allTranslations = [];
        for (const batch of batches) {
            console.log(`Translating batch of ${batch.length} texts...`);
            const [translations] = await translate.translate(batch, targetLanguage);
            allTranslations.push(...(Array.isArray(translations) ? translations : [translations]));
        }
        
        return allTranslations;
    } catch (error) {
        console.error('Google translation error:', error.message);
        throw error;
    }
}

// Similarity calculation
function calculateSimilarity(original, reverseTranslated) {
    // Simple similarity score based on character differences
    const maxLength = Math.max(original.length, reverseTranslated.length);
    let differences = 0;
    
    for (let i = 0; i < maxLength; i++) {
        if (original[i] !== reverseTranslated[i]) differences++;
    }
    
    return 1 - (differences / maxLength);
}

// Translation validation
async function validateTranslation(original, translated, targetLanguage) {
    // Reverse translate back to English
    const reverseTranslated = await googleTranslateTexts([translated], 'en');
    const similarity = calculateSimilarity(original.toLowerCase(), reverseTranslated[0].toLowerCase());
    return similarity;
}

// Main translation function
async function translateTexts(texts, cache, targetLanguage, enableConfidenceCheck = false) {
    const translations = {};
    const uncachedTexts = texts.filter(text => !cache[text]);

    if (uncachedTexts.length > 0) {
        try {
            // Get translations from both services
            const [azureResults, googleResults] = await Promise.all([
                azureTranslateBatch(uncachedTexts, targetLanguage),
                googleTranslateTexts(uncachedTexts, targetLanguage)
            ]);

            for (let i = 0; i < uncachedTexts.length; i++) {
                const text = uncachedTexts[i];
                const azureTranslation = azureResults[i];
                const googleTranslation = googleResults[i];

                if (enableConfidenceCheck) {
                    // Validate translations
                    const [azureConfidence, googleConfidence] = await Promise.all([
                        validateTranslation(text, azureTranslation, targetLanguage),
                        validateTranslation(text, googleTranslation, targetLanguage)
                    ]);

                    translations[text] = azureConfidence > googleConfidence ? 
                        azureTranslation : googleTranslation;
                } else {
                    // Use Azure by default
                    translations[text] = azureTranslation;
                }
            }
        } catch (error) {
            console.error('Translation error:', error.message);
            throw error;
        }
    }

    // Combine cached and new translations
    return texts.map(text => cache[text] || translations[text]);
}

// Get appropriate processor
function getProcessor(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.gridset':
            return new GridsetProcessor();
        case '.ce':
            return new TouchChatProcessor();
        case '.sps':
            return new SnapProcessor();
        default:
            throw new Error(`No processor found for file extension: ${ext}`);
    }
}

// Main file processing function
async function processFile(filePath, startLang, endLang, translationCache, enableConfidenceCheck) {
    console.log(`Processing ${filePath}...`);
    
    const processor = getProcessor(filePath);
    const cache = await loadCache(translationCache);

    try {
        // Read file content
        const fileContent = await fs.readFile(filePath);
        
        // Generate output path
        const ext = path.extname(filePath);
        const basename = path.basename(filePath, ext);
        const outputPath = path.join(path.dirname(filePath), `${basename}-${endLang}${ext}`);
        
        // Extract texts
        const texts = processor.extractTexts(fileContent);
        
        console.log(`Found ${texts.length} texts to translate`);
        
        // Translate texts
        const translations = await translateTexts(texts, cache, endLang, enableConfidenceCheck);
        
        // Update cache with new translations
        texts.forEach((text, i) => {
            if (!cache[text]) {
                cache[text] = translations[i];
            }
        });
        
        await saveCache(cache, translationCache);
        
        // Process translations
        processor.processTexts(filePath, translations, outputPath);
        console.log(`Translated file saved to: ${outputPath}`);
    } catch (error) {
        console.error('Error processing file:', error.message);
        throw error;
    }
}

// CLI setup
program
    .name('translate-aac')
    .description('Translate AAC files between languages')
    .argument('<file>', 'Input AAC file')
    .option('-s, --startlang <lang>', 'Source language', 'en')
    .option('-e, --endlang <lang>', 'Target language', 'fr')
    .option('-c, --cache <file>', 'Translation cache file', 'translation_cache.json')
    .option('--enable-confidence-check', 'Enable translation confidence checking', false)
    .action(async (file, options) => {
        try {
            await processFile(
                file,
                options.startlang,
                options.endlang,
                options.cache,
                options.enableConfidenceCheck
            );
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    });

program.parse();

#!/usr/bin/env node

const fs = require('fs').promises;
const axios = require('axios');

// Translation service configurations
const AZURE_TRANSLATOR_KEY = process.env.AZURE_TRANSLATOR_KEY;
const AZURE_TRANSLATOR_REGION = process.env.AZURE_TRANSLATOR_REGION || 'uksouth';
const AZURE_TRANSLATOR_ENDPOINT = 'https://api.cognitive.microsofttranslator.com/translate';

// Azure Translator function
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

    const batchSize = 50; // Smaller batch size for better reliability
    const allTranslations = [];

    for (let i = 0; i < texts.length; i += batchSize) {
        const batchTexts = texts.slice(i, i + batchSize);
        const body = batchTexts.map(text => ({ text }));

        console.log(`Translating batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)} (${batchTexts.length} items)...`);

        try {
            const response = await axios.post(AZURE_TRANSLATOR_ENDPOINT, body, { headers, params });
            const translations = response.data.map(item => item.translations[0].text);
            allTranslations.push(...translations);
            
            // Add a small delay between batches to be respectful to the API
            if (i + batchSize < texts.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.error('Azure translation error:', error.response?.data || error.message);
            throw error;
        }
    }

    return allTranslations;
}

async function translateVocabularyToPunjabi(inputFile) {
    try {
        // Read the vocabulary file
        const data = await fs.readFile(inputFile, 'utf8');
        const vocabularyData = JSON.parse(data);
        
        console.log(`Translating ${vocabularyData.vocabularyCount} vocabulary items to Punjabi...`);
        console.log(`Source: ${vocabularyData.pageTitle}`);
        
        // Translate to Punjabi (pa = Punjabi language code)
        const translations = await azureTranslateBatch(vocabularyData.vocabulary, 'pa');
        
        // Create the translated data structure
        const translatedData = {
            ...vocabularyData,
            translatedAt: new Date().toISOString(),
            targetLanguage: 'pa',
            targetLanguageName: 'Punjabi',
            translations: vocabularyData.vocabulary.map((original, index) => ({
                original: original,
                punjabi: translations[index]
            }))
        };
        
        // Save the translated data
        const outputFile = 'communication_repairs_vocabulary_punjabi.json';
        await fs.writeFile(outputFile, JSON.stringify(translatedData, null, 2));
        
        console.log(`\nTranslation completed! Results saved to: ${outputFile}`);
        console.log('\nSample translations:');
        translatedData.translations.slice(0, 10).forEach((item, index) => {
            console.log(`${index + 1}. "${item.original}" → "${item.punjabi}"`);
        });
        
        return translatedData;
        
    } catch (error) {
        console.error('Error during translation:', error);
        throw error;
    }
}

// Google Translate fallback (if needed)
async function googleTranslateTexts(texts, targetLanguage) {
    const GOOGLE_TRANSLATE_KEY = process.env.GOOGLE_TRANSLATE_KEY;
    
    if (!GOOGLE_TRANSLATE_KEY) {
        throw new Error('Google Translate key not set. Set GOOGLE_TRANSLATE_KEY environment variable.');
    }

    try {
        const { v2: { Translate } } = require('@google-cloud/translate');
        const translate = new Translate({ key: GOOGLE_TRANSLATE_KEY });
        
        const batchSize = 25;
        const allTranslations = [];
        
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            console.log(`Google Translate batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}...`);
            
            const [translations] = await translate.translate(batch, targetLanguage);
            allTranslations.push(...(Array.isArray(translations) ? translations : [translations]));
            
            // Small delay between batches
            if (i + batchSize < texts.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        return allTranslations;
    } catch (error) {
        console.error('Google translation error:', error.message);
        throw error;
    }
}

// Main function
async function main() {
    const inputFile = process.argv[2] || 'communication_repairs_vocabulary.json';
    
    try {
        await translateVocabularyToPunjabi(inputFile);
    } catch (error) {
        console.error('Translation failed:', error.message);
        
        // Try Google Translate as fallback
        console.log('\nTrying Google Translate as fallback...');
        try {
            const data = await fs.readFile(inputFile, 'utf8');
            const vocabularyData = JSON.parse(data);
            
            const translations = await googleTranslateTexts(vocabularyData.vocabulary, 'pa');
            
            const translatedData = {
                ...vocabularyData,
                translatedAt: new Date().toISOString(),
                targetLanguage: 'pa',
                targetLanguageName: 'Punjabi',
                translationService: 'Google Translate',
                translations: vocabularyData.vocabulary.map((original, index) => ({
                    original: original,
                    punjabi: translations[index]
                }))
            };
            
            const outputFile = 'communication_repairs_vocabulary_punjabi_google.json';
            await fs.writeFile(outputFile, JSON.stringify(translatedData, null, 2));
            console.log(`Fallback translation completed! Results saved to: ${outputFile}`);
            
        } catch (fallbackError) {
            console.error('Both translation services failed:', fallbackError.message);
            process.exit(1);
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { translateVocabularyToPunjabi, azureTranslateBatch, googleTranslateTexts };

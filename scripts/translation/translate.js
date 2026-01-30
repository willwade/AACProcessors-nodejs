const path = require('path');
const axios = require('axios');
const { getProcessor, isExtensionSupported } = require('../../dist/index');

const GOOGLE_TRANSLATE_KEY = process.env.GOOGLE_TRANSLATE_KEY;
const GOOGLE_TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

async function googleTranslateBatch(texts, targetLanguage, sourceLanguage) {
  if (!GOOGLE_TRANSLATE_KEY) {
    throw new Error('Google Translate key not set. Set GOOGLE_TRANSLATE_KEY environment variable.');
  }

  const params = { key: GOOGLE_TRANSLATE_KEY };
  const data = {
    q: texts,
    target: targetLanguage,
    format: 'text',
  };
  if (sourceLanguage) data.source = sourceLanguage;

  const response = await axios.post(GOOGLE_TRANSLATE_ENDPOINT, data, { params });
  const translations = response?.data?.data?.translations;
  if (!Array.isArray(translations)) {
    throw new Error('Unexpected response from Google Translate API.');
  }
  return translations.map((t) => t.translatedText);
}

async function translateTexts(texts, targetLanguage, sourceLanguage) {
  const batchSize = 50;
  const allTranslations = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`Translating batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)...`);
    const translated = await googleTranslateBatch(batch, targetLanguage, sourceLanguage);
    allTranslations.push(...translated);
  }

  return allTranslations;
}

async function main() {
  const filePath = process.argv[2];
  const targetLanguage = process.argv[3] || 'en';
  const sourceLanguage = process.argv[4] || '';

  if (!filePath) {
    console.error('Usage: node scripts/translation/translate.js <file> [targetLang] [sourceLang]');
    process.exit(1);
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!isExtensionSupported(ext)) {
    console.error(`Unsupported file extension: ${ext}`);
    process.exit(1);
  }

  const processor = getProcessor(filePath);
  const texts = await processor.extractTexts(filePath);
  console.log('Found texts:', texts.length);

  const uniqueTexts = Array.from(new Set(texts.filter((t) => typeof t === 'string' && t.length > 0)));
  console.log('Unique texts:', uniqueTexts.length);

  const translations = await translateTexts(uniqueTexts, targetLanguage, sourceLanguage);
  const translationMap = new Map();
  uniqueTexts.forEach((text, i) => {
    translationMap.set(text, translations[i] || text);
  });

  const parsed = path.parse(filePath);
  const outputPath = path.join(parsed.dir, `${parsed.name}-${targetLanguage}${parsed.ext}`);

  await processor.processTexts(filePath, translationMap, outputPath);
  console.log(`Translated file saved to: ${outputPath}`);
}

main().catch(console.error);

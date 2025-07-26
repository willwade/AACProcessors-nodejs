#!/usr/bin/env node

const fs = require('fs').promises;
const { execSync } = require('child_process');

async function runCompleteProcess() {
    console.log('🚀 Running complete vocabulary extraction and translation process...\n');
    
    try {
        // Step 1: Extract vocabulary
        console.log('📖 Step 1: Extracting vocabulary from pageset...');
        execSync('node extract_specific_page.js', { stdio: 'inherit' });
        console.log('✅ Vocabulary extraction completed\n');
        
        // Step 2: Translate to Punjabi
        console.log('🌐 Step 2: Translating vocabulary to Punjabi...');
        execSync('export AZURE_TRANSLATOR_KEY="aa90830b901d4bf68b9ec3c81a320b67" && export AZURE_TRANSLATOR_REGION="uksouth" && node translate_to_punjabi.js', { 
            stdio: 'inherit',
            shell: true 
        });
        console.log('✅ Translation completed\n');
        
        // Step 3: Generate CSV and report
        console.log('📊 Step 3: Generating CSV and report...');
        execSync('node generate_csv.js', { stdio: 'inherit' });
        console.log('✅ CSV and report generation completed\n');
        
        // Step 4: Validate results
        console.log('🔍 Step 4: Validating results...');
        await validateResults();
        
        console.log('🎉 Complete process finished successfully!\n');
        
        // Summary
        console.log('📋 SUMMARY:');
        console.log('- Source: examples/Aphasia Page Set.sps');
        console.log('- Page: "QuickFires - Communication Repairs"');
        console.log('- Vocabulary items extracted: 43');
        console.log('- Translation: English → Punjabi');
        console.log('- Output files:');
        console.log('  • communication_repairs_vocabulary.csv');
        console.log('  • vocabulary_extraction_report.md');
        console.log('  • communication_repairs_vocabulary_punjabi.json');
        
    } catch (error) {
        console.error('❌ Error in process:', error.message);
        process.exit(1);
    }
}

async function validateResults() {
    try {
        // Check if all expected files exist
        const expectedFiles = [
            'communication_repairs_vocabulary.json',
            'communication_repairs_vocabulary_punjabi.json',
            'communication_repairs_vocabulary.csv',
            'vocabulary_extraction_report.md'
        ];
        
        for (const file of expectedFiles) {
            await fs.access(file);
            console.log(`✓ ${file} exists`);
        }
        
        // Validate CSV content
        const csvContent = await fs.readFile('communication_repairs_vocabulary.csv', 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        if (lines.length !== 44) { // 43 vocabulary items + 1 header
            throw new Error(`Expected 44 lines in CSV, found ${lines.length}`);
        }
        
        // Check header
        const header = lines[0];
        if (!header.includes('Original English') || !header.includes('Punjabi Translation')) {
            throw new Error('CSV header is incorrect');
        }
        
        // Check that we have Punjabi text (contains Gurmukhi script)
        const hasGurmukhi = lines.some(line => /[\u0A00-\u0A7F]/.test(line));
        if (!hasGurmukhi) {
            throw new Error('No Punjabi (Gurmukhi) text found in CSV');
        }
        
        console.log('✓ CSV validation passed');
        
        // Validate JSON structure
        const jsonContent = await fs.readFile('communication_repairs_vocabulary_punjabi.json', 'utf8');
        const data = JSON.parse(jsonContent);
        
        if (!data.translations || data.translations.length !== 43) {
            throw new Error('JSON structure validation failed');
        }
        
        if (!data.pageTitle || !data.targetLanguage) {
            throw new Error('Missing required metadata in JSON');
        }
        
        console.log('✓ JSON validation passed');
        
        // Sample a few translations to ensure they look reasonable
        console.log('\n📝 Sample translations:');
        data.translations.slice(0, 5).forEach((item, index) => {
            console.log(`${index + 1}. "${item.original}" → "${item.punjabi}"`);
        });
        
        console.log('✅ All validations passed');
        
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        throw error;
    }
}

// Test individual components
async function testComponents() {
    console.log('🧪 Testing individual components...\n');
    
    try {
        // Test extraction
        const { extractVocabularyFromSpecificPage } = require('./extract_specific_page.js');
        console.log('✓ Extraction module loaded');
        
        // Test translation
        const { translateVocabularyToPunjabi } = require('./translate_to_punjabi.js');
        console.log('✓ Translation module loaded');
        
        // Test CSV generation
        const { generateCSV } = require('./generate_csv.js');
        console.log('✓ CSV generation module loaded');
        
        console.log('✅ All components loaded successfully\n');
        
    } catch (error) {
        console.error('❌ Component test failed:', error.message);
        throw error;
    }
}

async function main() {
    const command = process.argv[2];
    
    if (command === 'test') {
        await testComponents();
    } else if (command === 'validate') {
        await validateResults();
    } else {
        await runCompleteProcess();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { runCompleteProcess, validateResults, testComponents };

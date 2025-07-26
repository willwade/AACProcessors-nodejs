#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function generateCSV(inputFile, outputFile) {
    try {
        // Read the translated vocabulary file
        const data = await fs.readFile(inputFile, 'utf8');
        const vocabularyData = JSON.parse(data);
        
        console.log(`Generating CSV from ${vocabularyData.vocabularyCount} translated vocabulary items...`);
        console.log(`Source page: ${vocabularyData.pageTitle}`);
        console.log(`Target language: ${vocabularyData.targetLanguageName || 'Punjabi'}`);
        
        // Create CSV header
        const csvLines = [];
        csvLines.push('Original English,Punjabi Translation,Page Source,Extracted Date,Translated Date');
        
        // Add each vocabulary item as a CSV row
        vocabularyData.translations.forEach(item => {
            // Escape quotes in CSV by doubling them
            const originalEscaped = item.original.replace(/"/g, '""');
            const punjabiEscaped = item.punjabi.replace(/"/g, '""');
            const pageSource = vocabularyData.pageTitle.replace(/"/g, '""');
            
            // Format dates
            const extractedDate = new Date(vocabularyData.extractedAt).toLocaleDateString();
            const translatedDate = new Date(vocabularyData.translatedAt).toLocaleDateString();
            
            csvLines.push(`"${originalEscaped}","${punjabiEscaped}","${pageSource}","${extractedDate}","${translatedDate}"`);
        });
        
        // Join all lines with newlines
        const csvContent = csvLines.join('\n');
        
        // Write to file
        await fs.writeFile(outputFile, csvContent, 'utf8');
        
        console.log(`\nCSV file generated successfully: ${outputFile}`);
        console.log(`Total rows: ${vocabularyData.vocabularyCount + 1} (including header)`);
        
        // Show first few rows as preview
        console.log('\nPreview of CSV content:');
        csvLines.slice(0, 6).forEach((line, index) => {
            console.log(`${index === 0 ? 'Header' : 'Row ' + index}: ${line}`);
        });
        
        if (csvLines.length > 6) {
            console.log(`... and ${csvLines.length - 6} more rows`);
        }
        
        return outputFile;
        
    } catch (error) {
        console.error('Error generating CSV:', error);
        throw error;
    }
}

async function generateDetailedReport(inputFile, reportFile) {
    try {
        const data = await fs.readFile(inputFile, 'utf8');
        const vocabularyData = JSON.parse(data);
        
        const report = `# Vocabulary Extraction and Translation Report

## Source Information
- **Page Title**: ${vocabularyData.pageTitle}
- **Page Unique ID**: ${vocabularyData.pageUniqueId}
- **Source File**: examples/Aphasia Page Set.sps
- **Extraction Date**: ${new Date(vocabularyData.extractedAt).toLocaleString()}
- **Translation Date**: ${new Date(vocabularyData.translatedAt).toLocaleString()}

## Translation Details
- **Source Language**: English
- **Target Language**: ${vocabularyData.targetLanguageName || 'Punjabi'} (${vocabularyData.targetLanguage})
- **Translation Service**: ${vocabularyData.translationService || 'Azure Translator'}
- **Total Vocabulary Items**: ${vocabularyData.vocabularyCount}

## Vocabulary Items

| # | Original English | Punjabi Translation |
|---|------------------|-------------------|
${vocabularyData.translations.map((item, index) => 
    `| ${index + 1} | ${item.original} | ${item.punjabi} |`
).join('\n')}

## Process Summary

1. **Extraction**: Used direct database queries to extract vocabulary from the "QuickFires - Communication Repairs" page in the Aphasia Page Set
2. **Translation**: Translated all ${vocabularyData.vocabularyCount} vocabulary items from English to Punjabi using Azure Translator API
3. **Output**: Generated CSV file for easy import into other systems

## Files Generated
- \`communication_repairs_vocabulary.json\` - Raw extracted vocabulary
- \`communication_repairs_vocabulary_punjabi.json\` - Translated vocabulary with metadata
- \`communication_repairs_vocabulary.csv\` - CSV format for spreadsheet applications
- \`vocabulary_extraction_report.md\` - This detailed report

---
*Generated on ${new Date().toLocaleString()}*
`;

        await fs.writeFile(reportFile, report, 'utf8');
        console.log(`\nDetailed report generated: ${reportFile}`);
        
    } catch (error) {
        console.error('Error generating report:', error);
        throw error;
    }
}

async function main() {
    const inputFile = process.argv[2] || 'communication_repairs_vocabulary_punjabi.json';
    const outputFile = process.argv[3] || 'communication_repairs_vocabulary.csv';
    const reportFile = 'vocabulary_extraction_report.md';
    
    try {
        // Check if input file exists
        await fs.access(inputFile);
        
        // Generate CSV
        await generateCSV(inputFile, outputFile);
        
        // Generate detailed report
        await generateDetailedReport(inputFile, reportFile);
        
        console.log('\n✅ All files generated successfully!');
        console.log(`📄 CSV File: ${outputFile}`);
        console.log(`📋 Report: ${reportFile}`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Input file not found: ${inputFile}`);
            console.error('Please run the translation script first.');
        } else {
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { generateCSV, generateDetailedReport };

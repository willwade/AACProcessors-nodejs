#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs').promises;

async function extractVocabularyFromSpecificPage(filePath) {
    console.log('Extracting vocabulary from QuickFires - Communication Repairs page...');
    
    let db;
    try {
        db = new Database(filePath, { readonly: true });
        
        // Find the specific page we want
        const targetPageUniqueId = '5b5d408e-c1fb-4428-b9ab-bb88b5b66b04';
        const page = db.prepare("SELECT * FROM Page WHERE UniqueId = ?").get(targetPageUniqueId);
        
        if (!page) {
            throw new Error('Target page not found');
        }
        
        console.log(`Found page: "${page.Title}" (ID: ${page.Id})`);
        
        // Get buttons directly associated with this page
        const query = `
            SELECT DISTINCT b.Label, b.Message 
            FROM Button b
            JOIN ElementReference er ON b.ElementReferenceId = er.Id
            WHERE er.PageId = ?
            AND (b.Label IS NOT NULL AND b.Label != 'null' AND b.Label != '')
        `;
        
        const buttons = db.prepare(query).all(page.Id);
        console.log(`Found ${buttons.length} buttons with labels`);
        
        const vocabulary = new Set();
        
        buttons.forEach(button => {
            if (button.Label && button.Label.trim() && button.Label !== 'null') {
                vocabulary.add(button.Label.trim());
            }
            if (button.Message && button.Message.trim() && button.Message !== 'null' && button.Message !== button.Label) {
                vocabulary.add(button.Message.trim());
            }
        });
        
        // Also check for buttons that might be linked through page layouts
        const layoutQuery = `
            SELECT DISTINCT b.Label, b.Message
            FROM Button b
            JOIN ElementReference er ON b.ElementReferenceId = er.Id
            JOIN ElementPlacement ep ON er.Id = ep.ElementReferenceId
            JOIN PageLayout pl ON ep.PageLayoutId = pl.Id
            WHERE pl.PageId = ?
            AND (b.Label IS NOT NULL AND b.Label != 'null' AND b.Label != '')
        `;
        
        const layoutButtons = db.prepare(layoutQuery).all(page.Id);
        console.log(`Found ${layoutButtons.length} additional buttons through page layouts`);
        
        layoutButtons.forEach(button => {
            if (button.Label && button.Label.trim() && button.Label !== 'null') {
                vocabulary.add(button.Label.trim());
            }
            if (button.Message && button.Message.trim() && button.Message !== 'null' && button.Message !== button.Label) {
                vocabulary.add(button.Message.trim());
            }
        });
        
        const vocabularyArray = Array.from(vocabulary).sort();
        
        console.log(`\nExtracted ${vocabularyArray.length} unique vocabulary items:`);
        vocabularyArray.forEach((item, index) => {
            console.log(`${index + 1}. "${item}"`);
        });
        
        // Save to JSON file
        const outputData = {
            pageTitle: page.Title,
            pageUniqueId: page.UniqueId,
            extractedAt: new Date().toISOString(),
            vocabularyCount: vocabularyArray.length,
            vocabulary: vocabularyArray
        };
        
        await fs.writeFile('communication_repairs_vocabulary.json', JSON.stringify(outputData, null, 2));
        console.log('\nVocabulary saved to communication_repairs_vocabulary.json');
        
        return vocabularyArray;
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        if (db) {
            db.close();
        }
    }
}

// Run the extraction
if (require.main === module) {
    const filePath = process.argv[2] || 'examples/Aphasia Page Set.sps';
    extractVocabularyFromSpecificPage(filePath).catch(console.error);
}

module.exports = { extractVocabularyFromSpecificPage };

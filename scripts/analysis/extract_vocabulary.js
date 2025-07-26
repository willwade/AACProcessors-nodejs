#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');

async function extractVocabularyFromPage(filePath, pageTitle) {
    console.log(`Extracting vocabulary from page: "${pageTitle}"`);
    
    let db;
    try {
        db = new Database(filePath, { readonly: true });
        
        // Find the target page
        const page = db.prepare("SELECT * FROM Page WHERE Title = ?").get(pageTitle);
        if (!page) {
            throw new Error(`Page "${pageTitle}" not found`);
        }
        
        console.log(`Found page: ID=${page.Id}, UniqueId=${page.UniqueId}`);
        
        // Get all buttons associated with this page through ElementReference and ElementPlacement
        // First, get the page layout for this page
        const pageLayouts = db.prepare("SELECT * FROM PageLayout WHERE PageId = ?").all(page.Id);
        console.log(`Found ${pageLayouts.length} page layouts for this page`);
        
        const vocabulary = new Set(); // Use Set to avoid duplicates
        
        // For each page layout, get the element placements
        for (const layout of pageLayouts) {
            const placements = db.prepare("SELECT * FROM ElementPlacement WHERE PageLayoutId = ?").all(layout.Id);
            console.log(`Found ${placements.length} element placements for layout ${layout.Id}`);
            
            // For each placement, get the element reference and then the button
            for (const placement of placements) {
                if (placement.ElementReferenceId) {
                    const elementRef = db.prepare("SELECT * FROM ElementReference WHERE Id = ?").get(placement.ElementReferenceId);
                    if (elementRef && elementRef.PageId === page.Id) {
                        // Get the button associated with this element reference
                        const button = db.prepare("SELECT * FROM Button WHERE ElementReferenceId = ?").get(elementRef.Id);
                        if (button) {
                            // Add label and message to vocabulary if they exist and are not empty
                            if (button.Label && button.Label.trim() && button.Label !== 'null') {
                                vocabulary.add(button.Label.trim());
                            }
                            if (button.Message && button.Message.trim() && button.Message !== 'null' && button.Message !== button.Label) {
                                vocabulary.add(button.Message.trim());
                            }
                        }
                    }
                }
            }
        }
        
        // Also try a direct approach - get buttons that might be directly associated with the page
        const directButtons = db.prepare(`
            SELECT DISTINCT b.* FROM Button b
            JOIN ElementReference er ON b.ElementReferenceId = er.Id
            WHERE er.PageId = ?
        `).all(page.Id);
        
        console.log(`Found ${directButtons.length} buttons directly associated with the page`);
        
        for (const button of directButtons) {
            if (button.Label && button.Label.trim() && button.Label !== 'null') {
                vocabulary.add(button.Label.trim());
            }
            if (button.Message && button.Message.trim() && button.Message !== 'null' && button.Message !== button.Label) {
                vocabulary.add(button.Message.trim());
            }
        }
        
        // Convert Set to Array and sort
        const vocabularyArray = Array.from(vocabulary).sort();
        
        console.log(`\nExtracted ${vocabularyArray.length} unique vocabulary items:`);
        vocabularyArray.forEach((item, index) => {
            console.log(`${index + 1}. "${item}"`);
        });
        
        return vocabularyArray;
        
    } catch (error) {
        console.error('Error extracting vocabulary:', error);
        throw error;
    } finally {
        if (db) {
            db.close();
        }
    }
}

// Alternative approach using SnapProcessor
async function extractUsingSnapProcessor(filePath) {
    console.log('\n=== Using SnapProcessor approach ===');
    
    try {
        const { SnapProcessor } = require('./dist/processors');
        const processor = new SnapProcessor();
        
        // Load the tree structure
        const tree = processor.loadIntoTree(filePath);
        
        // Find the target page in the tree
        const targetPageId = '5b5d408e-c1fb-4428-b9ab-bb88b5b66b04'; // UniqueId from our analysis
        const page = tree.pages[targetPageId];
        
        if (!page) {
            console.log('Target page not found in tree. Available pages:');
            Object.keys(tree.pages).forEach(pageId => {
                const p = tree.pages[pageId];
                console.log(`- ${pageId}: "${p.name}"`);
            });
            return [];
        }
        
        console.log(`Found page: "${page.name}" with ${page.buttons.length} buttons`);
        
        const vocabulary = new Set();
        
        // Extract vocabulary from buttons
        page.buttons.forEach(button => {
            if (button.label && button.label.trim()) {
                vocabulary.add(button.label.trim());
            }
            if (button.message && button.message.trim() && button.message !== button.label) {
                vocabulary.add(button.message.trim());
            }
        });
        
        const vocabularyArray = Array.from(vocabulary).sort();
        console.log(`Extracted ${vocabularyArray.length} vocabulary items using SnapProcessor`);
        
        return vocabularyArray;
        
    } catch (error) {
        console.error('Error using SnapProcessor:', error);
        return [];
    }
}

async function main() {
    const filePath = process.argv[2] || 'examples/Aphasia Page Set.sps';
    const pageTitle = 'QuickFires - Communication Repairs';
    
    try {
        // Try direct database approach first
        const vocabulary1 = await extractVocabularyFromPage(filePath, pageTitle);
        
        // Try SnapProcessor approach
        const vocabulary2 = await extractUsingSnapProcessor(filePath);
        
        // Combine and deduplicate results
        const combinedVocabulary = Array.from(new Set([...vocabulary1, ...vocabulary2])).sort();
        
        console.log(`\n=== Final Combined Results ===`);
        console.log(`Total unique vocabulary items: ${combinedVocabulary.length}`);
        
        // Save to JSON file for further processing
        const outputData = {
            pageTitle: pageTitle,
            extractedAt: new Date().toISOString(),
            vocabularyCount: combinedVocabulary.length,
            vocabulary: combinedVocabulary
        };
        
        await fs.writeFile('extracted_vocabulary.json', JSON.stringify(outputData, null, 2));
        console.log('Vocabulary saved to extracted_vocabulary.json');
        
        return combinedVocabulary;
        
    } catch (error) {
        console.error('Error in main:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { extractVocabularyFromPage, extractUsingSnapProcessor };

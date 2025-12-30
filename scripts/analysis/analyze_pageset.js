#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

async function analyzePageset(filePath) {
    console.log(`Analyzing pageset file: ${filePath}`);
    
    let db;
    try {
        db = new Database(filePath, { readonly: true });
        
        // First, let's see what tables exist
        console.log('\n=== Database Tables ===');
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        tables.forEach(table => {
            console.log(`- ${table.name}`);
        });
        
        // Look at the Page table structure
        console.log('\n=== Page Table Structure ===');
        const pageSchema = db.prepare("PRAGMA table_info(Page)").all();
        pageSchema.forEach(col => {
            console.log(`${col.name}: ${col.type}`);
        });
        
        // Find all pages and their titles
        console.log('\n=== All Pages ===');
        const pages = db.prepare('SELECT Id, UniqueId, Title, PageType FROM Page').all();
        pages.forEach(page => {
            console.log(`ID: ${page.Id}, UniqueId: ${page.UniqueId}, Title: "${page.Title}", Type: ${page.PageType}`);
        });
        
        // Look for the specific page we want
        console.log('\n=== Searching for "Quick Fires - Communication Repairs" page ===');
        const targetPage = db.prepare("SELECT * FROM Page WHERE Title LIKE '%Quick Fires%' OR Title LIKE '%Communication Repairs%'").all();
        if (targetPage.length > 0) {
            console.log('Found target page(s):');
            targetPage.forEach(page => {
                console.log(JSON.stringify(page, null, 2));
            });
        } else {
            console.log('Target page not found. Searching for pages with "Quick" or "Communication":');
            const partialMatches = db.prepare("SELECT * FROM Page WHERE Title LIKE '%Quick%' OR Title LIKE '%Communication%'").all();
            partialMatches.forEach(page => {
                console.log(`- "${page.Title}" (ID: ${page.Id})`);
            });
        }
        
        // Look at Button table structure
        console.log('\n=== Button Table Structure ===');
        const buttonSchema = db.prepare("PRAGMA table_info(Button)").all();
        buttonSchema.forEach(col => {
            console.log(`${col.name}: ${col.type}`);
        });
        
        // Look at ElementReference and ElementPlacement tables
        console.log('\n=== ElementReference Table Structure ===');
        try {
            const elementRefSchema = db.prepare("PRAGMA table_info(ElementReference)").all();
            elementRefSchema.forEach(col => {
                console.log(`${col.name}: ${col.type}`);
            });
        } catch (e) {
            console.log('ElementReference table not found');
        }
        
        console.log('\n=== ElementPlacement Table Structure ===');
        try {
            const elementPlaceSchema = db.prepare("PRAGMA table_info(ElementPlacement)").all();
            elementPlaceSchema.forEach(col => {
                console.log(`${col.name}: ${col.type}`);
            });
        } catch (e) {
            console.log('ElementPlacement table not found');
        }
        
        // Sample some buttons to understand the data structure
        console.log('\n=== Sample Buttons ===');
        const sampleButtons = db.prepare('SELECT * FROM Button LIMIT 10').all();
        sampleButtons.forEach(button => {
            console.log(`Button ID: ${button.Id}, Label: "${button.Label}", Message: "${button.Message}"`);
        });
        
    } catch (error) {
        console.error('Error analyzing database:', error);
    } finally {
        if (db) {
            db.close();
        }
    }
}

// Run the analysis
const filePath = process.argv[2] || 'examples/Aphasia Page Set.sps';
analyzePageset(filePath).catch(console.error);

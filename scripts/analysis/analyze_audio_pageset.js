#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs').promises;

async function analyzeAudioPageset(filePath) {
    console.log(`Analyzing audio-enabled pageset: ${filePath}`);
    
    let db;
    try {
        db = new Database(filePath, { readonly: true });
        
        // First, let's see what tables exist
        console.log('\n=== Database Tables ===');
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        tables.forEach(table => {
            console.log(`- ${table.name}`);
        });
        
        // Look for audio-related tables
        console.log('\n=== Audio-Related Tables ===');
        const audioTables = tables.filter(table => 
            table.name.toLowerCase().includes('audio') || 
            table.name.toLowerCase().includes('recording') ||
            table.name.toLowerCase().includes('sound')
        );
        
        if (audioTables.length === 0) {
            console.log('No obvious audio-related tables found. Checking for MessageRecording...');
            const messageRecordingExists = tables.find(t => t.name === 'MessageRecording');
            if (messageRecordingExists) {
                audioTables.push(messageRecordingExists);
            }
        }
        
        audioTables.forEach(table => {
            console.log(`\n--- ${table.name} Table Structure ---`);
            const schema = db.prepare(`PRAGMA table_info(${table.name})`).all();
            schema.forEach(col => {
                console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
            });
            
            // Show sample data
            console.log(`\n--- Sample ${table.name} Data ---`);
            try {
                const sampleData = db.prepare(`SELECT * FROM ${table.name} LIMIT 5`).all();
                if (sampleData.length > 0) {
                    sampleData.forEach((row, index) => {
                        console.log(`  Row ${index + 1}:`, JSON.stringify(row, null, 4));
                    });
                } else {
                    console.log('  No data found');
                }
            } catch (e) {
                console.log(`  Error reading data: ${e.message}`);
            }
        });
        
        // Check Button table for audio-related fields
        console.log('\n=== Button Table Audio Fields ===');
        const buttonSchema = db.prepare("PRAGMA table_info(Button)").all();
        const audioFields = buttonSchema.filter(col => 
            col.name.toLowerCase().includes('audio') || 
            col.name.toLowerCase().includes('recording') ||
            col.name.toLowerCase().includes('sound')
        );
        
        if (audioFields.length > 0) {
            console.log('Audio-related fields in Button table:');
            audioFields.forEach(field => {
                console.log(`  ${field.name}: ${field.type}`);
            });
            
            // Show buttons with audio recordings
            console.log('\n--- Buttons with Audio Recordings ---');
            const buttonsWithAudio = db.prepare(`
                SELECT Id, Label, Message, MessageRecordingId, UseMessageRecording 
                FROM Button 
                WHERE MessageRecordingId IS NOT NULL AND MessageRecordingId != 0
                LIMIT 10
            `).all();
            
            buttonsWithAudio.forEach(button => {
                console.log(`  Button ID: ${button.Id}, Label: "${button.Label}", Recording ID: ${button.MessageRecordingId}`);
            });
        } else {
            console.log('No audio-related fields found in Button table');
        }
        
        // Look for the specific "What I want isn't here" button
        console.log('\n=== Searching for "What I want isn\'t here" Button ===');
        const targetButton = db.prepare(`
            SELECT * FROM Button 
            WHERE Label LIKE '%What I want%' OR Message LIKE '%What I want%'
        `).all();
        
        if (targetButton.length > 0) {
            console.log('Found target button(s):');
            targetButton.forEach(button => {
                console.log(JSON.stringify(button, null, 2));
                
                // If it has a recording, get the recording details
                if (button.MessageRecordingId) {
                    console.log(`\n--- Recording Details for Button ${button.Id} ---`);
                    try {
                        const recording = db.prepare(`
                            SELECT * FROM MessageRecording WHERE Id = ?
                        `).get(button.MessageRecordingId);
                        
                        if (recording) {
                            console.log(JSON.stringify(recording, null, 2));
                        }
                    } catch (e) {
                        console.log(`Error getting recording: ${e.message}`);
                    }
                }
            });
        } else {
            console.log('Target button not found');
        }
        
        // Check PageSetData for audio files and recording ID 505
        console.log('\n=== PageSetData Audio Files ===');
        try {
            // First check for audio file extensions
            const audioData = db.prepare(`
                SELECT Id, Identifier, LENGTH(Data) as DataSize
                FROM PageSetData
                WHERE Identifier LIKE '%.wav' OR Identifier LIKE '%.mp3' OR Identifier LIKE '%.m4a'
                LIMIT 10
            `).all();

            if (audioData.length > 0) {
                console.log('Audio files found in PageSetData:');
                audioData.forEach(file => {
                    console.log(`  ID: ${file.Id}, File: ${file.Identifier}, Size: ${file.DataSize} bytes`);
                });
            } else {
                console.log('No audio files found by extension in PageSetData');
            }

            // Check for recording ID 505 specifically
            console.log('\n--- Looking for Recording ID 505 ---');
            const recording505 = db.prepare(`
                SELECT Id, Identifier, LENGTH(Data) as DataSize
                FROM PageSetData
                WHERE Id = 505
            `).get();

            if (recording505) {
                console.log('Found recording 505:', JSON.stringify(recording505, null, 2));
            } else {
                console.log('Recording ID 505 not found in PageSetData');
            }

            // Check all PageSetData entries to understand the pattern
            console.log('\n--- Sample PageSetData Entries ---');
            const sampleData = db.prepare(`
                SELECT Id, Identifier, LENGTH(Data) as DataSize
                FROM PageSetData
                ORDER BY Id
                LIMIT 20
            `).all();

            sampleData.forEach(entry => {
                console.log(`  ID: ${entry.Id}, Identifier: "${entry.Identifier}", Size: ${entry.DataSize} bytes`);
            });

        } catch (e) {
            console.log(`Error checking PageSetData: ${e.message}`);
        }
        
    } catch (error) {
        console.error('Error analyzing database:', error);
    } finally {
        if (db) {
            db.close();
        }
    }
}

// Run the analysis
const filePath = process.argv[2] || 'examples/Aphasia Page Set With Sound.sps';
analyzeAudioPageset(filePath).catch(console.error);

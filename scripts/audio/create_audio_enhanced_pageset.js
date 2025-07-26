#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

async function createAudioEnhancedPageset(
    sourcePagesetPath,
    audioDirectory,
    vocabularyFile,
    outputPagesetPath
) {
    console.log('🎵 Creating audio-enhanced pageset...\n');
    
    try {
        // Read the vocabulary data to map audio files to buttons
        const vocabularyData = JSON.parse(await fs.readFile(vocabularyFile, 'utf8'));
        const pageUniqueId = vocabularyData.pageUniqueId;
        
        console.log(`Source pageset: ${sourcePagesetPath}`);
        console.log(`Audio directory: ${audioDirectory}`);
        console.log(`Target page: ${vocabularyData.pageTitle} (${pageUniqueId})`);
        console.log(`Output pageset: ${outputPagesetPath}\n`);
        
        // Copy source to output
        fsSync.copyFileSync(sourcePagesetPath, outputPagesetPath);
        console.log('✅ Copied source pageset to output location');
        
        // Open the database for modification
        const db = new Database(outputPagesetPath, { readonly: false });
        
        try {
            // Get the target page
            const page = db.prepare('SELECT * FROM Page WHERE UniqueId = ?').get(pageUniqueId);
            if (!page) {
                throw new Error(`Page with UniqueId ${pageUniqueId} not found`);
            }
            
            console.log(`📄 Found target page: "${page.Title}" (ID: ${page.Id})`);
            
            // Get all buttons for this page
            const buttons = db.prepare(`
                SELECT 
                    b.Id, b.Label, b.Message, b.MessageRecordingId, b.UseMessageRecording
                FROM Button b
                JOIN ElementReference er ON b.ElementReferenceId = er.Id
                WHERE er.PageId = ?
                ORDER BY b.Id
            `).all(page.Id);
            
            console.log(`🔘 Found ${buttons.length} buttons on the page\n`);
            
            // Create mapping from button text to audio files
            const audioFiles = await fs.readdir(audioDirectory);
            const wavFiles = audioFiles.filter(f => f.endsWith('.wav'));
            
            console.log(`🎵 Found ${wavFiles.length} audio files`);
            
            // Process each vocabulary item and match it to buttons
            let audioAddedCount = 0;
            let audioSkippedCount = 0;
            
            for (let i = 0; i < vocabularyData.translations.length; i++) {
                const translation = vocabularyData.translations[i];
                const expectedAudioFile = `audio_${i + 1}_${translation.original.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
                const audioFilePath = path.join(audioDirectory, expectedAudioFile);
                
                // Check if audio file exists
                if (!fsSync.existsSync(audioFilePath)) {
                    console.log(`⏭️  Skipping "${translation.original}" - no audio file found`);
                    audioSkippedCount++;
                    continue;
                }
                
                // Find matching button(s) by label or message
                const matchingButtons = buttons.filter(btn => 
                    (btn.Label && btn.Label.trim() === translation.original.trim()) ||
                    (btn.Message && btn.Message.trim() === translation.original.trim())
                );
                
                if (matchingButtons.length === 0) {
                    console.log(`⚠️  No button found for "${translation.original}"`);
                    continue;
                }
                
                // Read audio file
                const audioBuffer = await fs.readFile(audioFilePath);
                console.log(`🎤 Processing "${translation.original}" (${audioBuffer.length} bytes)`);
                
                // Generate SHA1 hash for identifier
                const sha1Hash = crypto.createHash('sha1').update(audioBuffer).digest('base64');
                const identifier = `SND:${sha1Hash}`;
                
                // Check if audio with this identifier already exists
                let audioId;
                const existingAudio = db.prepare(`
                    SELECT Id FROM PageSetData WHERE Identifier = ?
                `).get(identifier);

                if (existingAudio) {
                    audioId = existingAudio.Id;
                    console.log(`  🔄 Reusing existing audio data with ID: ${audioId}`);
                } else {
                    // Insert new audio data
                    const insertAudio = db.prepare(`
                        INSERT INTO PageSetData (Identifier, Data) VALUES (?, ?)
                    `);
                    const audioResult = insertAudio.run(identifier, audioBuffer);
                    audioId = audioResult.lastInsertRowid;
                    console.log(`  📀 Inserted new audio data with ID: ${audioId}`);
                }
                
                console.log(`  📀 Inserted audio data with ID: ${audioId}`);
                
                // Update all matching buttons
                for (const button of matchingButtons) {
                    const metadata = JSON.stringify({
                        FileName: `Punjabi_${translation.original.replace(/[^a-zA-Z0-9]/g, '_')}`,
                        OriginalText: translation.original,
                        PunjabiText: translation.punjabi,
                        GeneratedAt: new Date().toISOString()
                    });
                    
                    const updateButton = db.prepare(`
                        UPDATE Button 
                        SET MessageRecordingId = ?, 
                            UseMessageRecording = 1,
                            SerializedMessageSoundMetadata = ?
                        WHERE Id = ?
                    `);
                    
                    updateButton.run(audioId, metadata, button.Id);
                    console.log(`  🔘 Updated button ${button.Id}: "${button.Label}"`);
                    audioAddedCount++;
                }
            }
            
            console.log('\n🎉 Audio integration completed!');
            console.log(`✅ Audio added to ${audioAddedCount} button instances`);
            console.log(`⏭️  Skipped ${audioSkippedCount} items (no audio file)`);
            console.log(`📁 Enhanced pageset: ${outputPagesetPath}`);
            
            // Verify the integration
            console.log('\n🔍 Verification:');
            const buttonsWithAudio = db.prepare(`
                SELECT COUNT(*) as count FROM Button 
                WHERE MessageRecordingId IS NOT NULL AND MessageRecordingId > 0
            `).get();
            
            const audioRecordings = db.prepare(`
                SELECT COUNT(*) as count FROM PageSetData 
                WHERE Identifier LIKE 'SND:%'
            `).get();
            
            console.log(`📊 Total buttons with audio: ${buttonsWithAudio.count}`);
            console.log(`📊 Total audio recordings: ${audioRecordings.count}`);
            
            return {
                success: true,
                audioAdded: audioAddedCount,
                audioSkipped: audioSkippedCount,
                totalButtons: buttonsWithAudio.count,
                totalRecordings: audioRecordings.count,
                outputFile: outputPagesetPath
            };
            
        } finally {
            db.close();
        }
        
    } catch (error) {
        console.error('❌ Error creating audio-enhanced pageset:', error);
        throw error;
    }
}

async function verifyAudioPageset(pagesetPath) {
    console.log(`🔍 Verifying audio-enhanced pageset: ${pagesetPath}\n`);
    
    const db = new Database(pagesetPath, { readonly: true });
    
    try {
        // Check audio recordings
        const audioRecordings = db.prepare(`
            SELECT Id, Identifier, LENGTH(Data) as DataSize
            FROM PageSetData 
            WHERE Identifier LIKE 'SND:%'
            ORDER BY Id
        `).all();
        
        console.log(`📀 Found ${audioRecordings.length} audio recordings:`);
        audioRecordings.forEach(recording => {
            console.log(`  ID: ${recording.Id}, Size: ${recording.DataSize} bytes`);
        });
        
        // Check buttons with audio
        const buttonsWithAudio = db.prepare(`
            SELECT 
                b.Id, b.Label, b.Message, b.MessageRecordingId, 
                b.SerializedMessageSoundMetadata
            FROM Button b
            WHERE b.MessageRecordingId IS NOT NULL AND b.MessageRecordingId > 0
            ORDER BY b.Id
        `).all();
        
        console.log(`\n🔘 Found ${buttonsWithAudio.length} buttons with audio:`);
        buttonsWithAudio.forEach(button => {
            const metadata = button.SerializedMessageSoundMetadata ? 
                JSON.parse(button.SerializedMessageSoundMetadata) : {};
            
            console.log(`  Button ${button.Id}: "${button.Label}"`);
            console.log(`    Recording ID: ${button.MessageRecordingId}`);
            console.log(`    Punjabi: ${metadata.PunjabiText || 'N/A'}`);
        });
        
        return {
            audioRecordings: audioRecordings.length,
            buttonsWithAudio: buttonsWithAudio.length,
            details: { audioRecordings, buttonsWithAudio }
        };
        
    } finally {
        db.close();
    }
}

async function main() {
    const command = process.argv[2];
    
    if (command === 'verify') {
        const pagesetPath = process.argv[3] || 'Aphasia_Page_Set_With_Punjabi_Audio.sps';
        await verifyAudioPageset(pagesetPath);
        return;
    }
    
    // Default: create enhanced pageset
    const sourcePageset = process.argv[2] || 'examples/Aphasia Page Set.sps';
    const audioDirectory = process.argv[3] || 'punjabi_audio_files';
    const vocabularyFile = process.argv[4] || 'communication_repairs_vocabulary_punjabi.json';
    const outputPageset = process.argv[5] || 'Aphasia_Page_Set_With_Punjabi_Audio.sps';
    
    const result = await createAudioEnhancedPageset(
        sourcePageset,
        audioDirectory,
        vocabularyFile,
        outputPageset
    );
    
    if (result.success) {
        console.log('\n🎯 Next steps:');
        console.log(`1. Test the enhanced pageset: node ${process.argv[1]} verify "${outputPageset}"`);
        console.log('2. Import the enhanced pageset into your AAC software');
        console.log('3. Navigate to the "QuickFires - Communication Repairs" page');
        console.log('4. Test the Punjabi audio playback on the buttons');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { createAudioEnhancedPageset, verifyAudioPageset };

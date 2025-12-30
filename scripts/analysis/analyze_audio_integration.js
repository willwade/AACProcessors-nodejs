#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const crypto = require('crypto');

async function analyzeAudioIntegration(filePath) {
    console.log('=== Audio Integration Pattern Analysis ===\n');
    
    let db;
    try {
        db = new Database(filePath, { readonly: true });
        
        // 1. Find all buttons with audio recordings
        console.log('1. BUTTONS WITH AUDIO RECORDINGS');
        console.log('================================');
        const buttonsWithAudio = db.prepare(`
            SELECT 
                b.Id, 
                b.Label, 
                b.Message, 
                b.MessageRecordingId, 
                b.UseMessageRecording,
                b.SerializedMessageSoundMetadata
            FROM Button b 
            WHERE b.MessageRecordingId IS NOT NULL AND b.MessageRecordingId != 0
            ORDER BY b.Id
            LIMIT 10
        `).all();
        
        console.log(`Found ${buttonsWithAudio.length} buttons with audio recordings:\n`);
        
        buttonsWithAudio.forEach(button => {
            console.log(`Button ID: ${button.Id}`);
            console.log(`  Label: "${button.Label}"`);
            console.log(`  Message: "${button.Message}"`);
            console.log(`  Recording ID: ${button.MessageRecordingId}`);
            console.log(`  Use Recording: ${button.UseMessageRecording}`);
            console.log(`  Sound Metadata: ${button.SerializedMessageSoundMetadata}`);
            console.log('');
        });
        
        // 2. Analyze the audio data storage pattern
        console.log('2. AUDIO DATA STORAGE PATTERN');
        console.log('=============================');
        
        const audioRecordings = db.prepare(`
            SELECT Id, Identifier, LENGTH(Data) as DataSize
            FROM PageSetData 
            WHERE Identifier LIKE 'SND:%'
            ORDER BY Id
        `).all();
        
        console.log(`Found ${audioRecordings.length} audio recordings in PageSetData:\n`);
        
        audioRecordings.forEach(recording => {
            console.log(`Recording ID: ${recording.Id}`);
            console.log(`  Identifier: ${recording.Identifier}`);
            console.log(`  Data Size: ${recording.DataSize} bytes`);
            
            // Find which button uses this recording
            const button = db.prepare(`
                SELECT Id, Label, Message FROM Button 
                WHERE MessageRecordingId = ?
            `).get(recording.Id);
            
            if (button) {
                console.log(`  Used by Button: ${button.Id} ("${button.Label}")`);
            }
            console.log('');
        });
        
        // 3. Extract and analyze one audio file
        console.log('3. AUDIO FILE ANALYSIS');
        console.log('======================');
        
        if (audioRecordings.length > 0) {
            const firstRecording = audioRecordings[0];
            console.log(`Analyzing recording ID ${firstRecording.Id}...`);
            
            const audioData = db.prepare(`
                SELECT Data FROM PageSetData WHERE Id = ?
            `).get(firstRecording.Id);
            
            if (audioData && audioData.Data) {
                const buffer = audioData.Data;
                console.log(`Audio data length: ${buffer.length} bytes`);
                
                // Check file signature to determine format
                const signature = buffer.slice(0, 12);
                console.log(`File signature (hex): ${signature.toString('hex')}`);
                
                // Check for common audio formats
                if (signature.slice(0, 4).toString() === 'RIFF' && signature.slice(8, 12).toString() === 'WAVE') {
                    console.log('Format: WAV file detected');
                } else if (signature.slice(0, 3).toString() === 'ID3' || signature.slice(0, 2).toString('hex') === 'fffa' || signature.slice(0, 2).toString('hex') === 'fffb') {
                    console.log('Format: MP3 file detected');
                } else {
                    console.log('Format: Unknown audio format');
                }
                
                // Save a sample for testing
                await fs.writeFile(`sample_audio_${firstRecording.Id}.wav`, buffer);
                console.log(`Sample audio saved as: sample_audio_${firstRecording.Id}.wav`);
            }
        }
        
        // 4. Understand the identifier pattern
        console.log('\n4. IDENTIFIER PATTERN ANALYSIS');
        console.log('==============================');
        
        console.log('Audio identifiers follow the pattern: SND:<hash>');
        console.log('Where <hash> appears to be a base64-encoded hash of the audio data.');
        console.log('');
        
        // Test the hash pattern
        if (audioRecordings.length > 0) {
            const recording = audioRecordings[0];
            const audioData = db.prepare(`SELECT Data FROM PageSetData WHERE Id = ?`).get(recording.Id);
            
            if (audioData && audioData.Data) {
                // Try different hash algorithms
                const sha1Hash = crypto.createHash('sha1').update(audioData.Data).digest('base64');
                const md5Hash = crypto.createHash('md5').update(audioData.Data).digest('base64');
                
                const identifierHash = recording.Identifier.replace('SND:', '');
                
                console.log(`Stored identifier: ${recording.Identifier}`);
                console.log(`SHA1 hash: SND:${sha1Hash}`);
                console.log(`MD5 hash: SND:${md5Hash}`);
                console.log(`Match SHA1: ${identifierHash === sha1Hash}`);
                console.log(`Match MD5: ${identifierHash === md5Hash}`);
            }
        }
        
        // 5. Database schema for audio integration
        console.log('\n5. AUDIO INTEGRATION SCHEMA');
        console.log('===========================');
        console.log('To add audio to a button:');
        console.log('1. Store audio data in PageSetData table with SND:<hash> identifier');
        console.log('2. Set Button.MessageRecordingId to the PageSetData.Id');
        console.log('3. Set Button.UseMessageRecording to 1');
        console.log('4. Optionally set Button.SerializedMessageSoundMetadata with filename info');
        console.log('');
        
        return {
            buttonsWithAudio,
            audioRecordings,
            schema: {
                audioTable: 'PageSetData',
                audioIdentifierPrefix: 'SND:',
                buttonRecordingField: 'MessageRecordingId',
                buttonUseRecordingField: 'UseMessageRecording',
                buttonMetadataField: 'SerializedMessageSoundMetadata'
            }
        };
        
    } catch (error) {
        console.error('Error analyzing audio integration:', error);
        throw error;
    } finally {
        if (db) {
            db.close();
        }
    }
}

// Run the analysis
if (require.main === module) {
    const filePath = process.argv[2] || 'examples/Aphasia Page Set With Sound.sps';
    analyzeAudioIntegration(filePath).catch(console.error);
}

module.exports = { analyzeAudioIntegration };

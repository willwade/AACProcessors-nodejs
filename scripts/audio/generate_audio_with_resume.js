#!/usr/bin/env node

const fs = require('fs').promises;
const axios = require('axios');
const path = require('path');

class AzureTTSService {
    constructor() {
        this.speechKey = process.env.AZURE_TTS_KEY;
        this.speechRegion = process.env.AZURE_TTS_REGION || 'uksouth';
        
        if (!this.speechKey) {
            throw new Error('AZURE_TTS_KEY environment variable not set');
        }
        
        this.tokenUrl = `https://${this.speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
        this.ttsUrl = `https://${this.speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
        this.cachedToken = null;
        this.tokenExpiry = null;
    }

    async getAccessToken() {
        // Check if we have a valid cached token (tokens last 10 minutes)
        if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.cachedToken;
        }

        try {
            const response = await axios.post(this.tokenUrl, null, {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.speechKey,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            this.cachedToken = response.data;
            this.tokenExpiry = Date.now() + (9 * 60 * 1000); // Cache for 9 minutes
            
            return this.cachedToken;
        } catch (error) {
            console.error('Error getting access token:', error.response?.data || error.message);
            throw error;
        }
    }

    async synthesizeSpeech(text, voice = 'pa-IN-OjasNeural', retries = 3) {
        const ssml = `
            <speak version='1.0' xml:lang='pa-IN'>
                <voice xml:lang='pa-IN' name='${voice}'>
                    ${text}
                </voice>
            </speak>
        `;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const accessToken = await this.getAccessToken();
                
                const response = await axios.post(this.ttsUrl, ssml, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/ssml+xml',
                        'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',
                        'User-Agent': 'AACProcessors-TTS'
                    },
                    responseType: 'arraybuffer'
                });

                return Buffer.from(response.data);
                
            } catch (error) {
                if (error.response?.status === 429) {
                    const waitTime = attempt === 1 ? 60 : attempt * 30; // Progressive backoff
                    console.log(`⏳ Rate limit hit, waiting ${waitTime} seconds (attempt ${attempt}/${retries})...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                    
                    // Clear cached token on rate limit
                    this.cachedToken = null;
                    this.tokenExpiry = null;
                    
                    if (attempt < retries) continue;
                }
                
                console.error(`Attempt ${attempt} failed:`, {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    message: error.message
                });
                
                if (attempt === retries) throw error;
            }
        }
    }
}

async function generateAudioWithResume(vocabularyFile, outputDir = 'punjabi_audio_files') {
    console.log('🎵 Generating Punjabi audio with resume capability...\n');
    
    try {
        // Read vocabulary data
        const data = await fs.readFile(vocabularyFile, 'utf8');
        const vocabularyData = JSON.parse(data);
        
        // Create output directory
        await fs.mkdir(outputDir, { recursive: true });
        
        // Check for existing progress
        const progressFile = path.join(outputDir, 'progress.json');
        let progress = { completed: [], failed: [], lastIndex: -1 };
        
        try {
            const progressData = await fs.readFile(progressFile, 'utf8');
            progress = JSON.parse(progressData);
            console.log(`📋 Resuming from index ${progress.lastIndex + 1}`);
            console.log(`✅ Already completed: ${progress.completed.length}`);
            console.log(`❌ Previously failed: ${progress.failed.length}\n`);
        } catch (e) {
            console.log('🆕 Starting fresh audio generation\n');
        }
        
        // Initialize TTS service
        const ttsService = new AzureTTSService();
        
        console.log(`Processing ${vocabularyData.vocabularyCount} vocabulary items...`);
        console.log(`Source: ${vocabularyData.pageTitle}\n`);
        
        // Process items starting from where we left off
        for (let i = progress.lastIndex + 1; i < vocabularyData.translations.length; i++) {
            const item = vocabularyData.translations[i];
            const filename = `audio_${i + 1}_${item.original.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
            const filepath = path.join(outputDir, filename);
            
            // Skip if already completed
            if (progress.completed.some(c => c.index === i)) {
                console.log(`⏭️  Skipping ${i + 1}/${vocabularyData.translations.length}: Already completed`);
                continue;
            }
            
            console.log(`🎤 Generating ${i + 1}/${vocabularyData.translations.length}: "${item.punjabi}"`);
            
            try {
                const audioBuffer = await ttsService.synthesizeSpeech(item.punjabi);
                await fs.writeFile(filepath, audioBuffer);
                
                // Record success
                progress.completed.push({
                    index: i,
                    original: item.original,
                    punjabi: item.punjabi,
                    filename: filename,
                    size: audioBuffer.length,
                    timestamp: new Date().toISOString()
                });
                
                progress.lastIndex = i;
                
                console.log(`✅ Success: ${filename} (${audioBuffer.length} bytes)`);
                
                // Save progress after each successful generation
                await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));
                
                // Conservative delay to avoid rate limits
                console.log('⏳ Waiting 5 seconds...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                
            } catch (error) {
                console.error(`❌ Failed: "${item.punjabi}" - ${error.message}`);
                
                progress.failed.push({
                    index: i,
                    original: item.original,
                    punjabi: item.punjabi,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
                
                progress.lastIndex = i;
                await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));
                
                // If it's a rate limit error, wait longer
                if (error.message.includes('429') || error.message.includes('rate limit')) {
                    console.log('⏳ Rate limit detected, waiting 2 minutes before continuing...');
                    await new Promise(resolve => setTimeout(resolve, 120000));
                }
            }
        }
        
        // Generate final summary
        const summary = {
            pageTitle: vocabularyData.pageTitle,
            pageUniqueId: vocabularyData.pageUniqueId,
            totalItems: vocabularyData.vocabularyCount,
            completed: progress.completed.length,
            failed: progress.failed.length,
            completedItems: progress.completed,
            failedItems: progress.failed,
            generatedAt: new Date().toISOString()
        };
        
        const summaryFile = path.join(outputDir, 'audio_generation_summary.json');
        await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
        
        console.log('\n🎉 Audio generation completed!');
        console.log(`📁 Output directory: ${outputDir}`);
        console.log(`✅ Successful: ${summary.completed}/${summary.totalItems}`);
        console.log(`❌ Failed: ${summary.failed}/${summary.totalItems}`);
        console.log(`📋 Summary: ${summaryFile}`);
        
        if (summary.failed > 0) {
            console.log('\n🔄 To retry failed items, run this script again.');
        }
        
        return summary;
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

async function retryFailed(outputDir = 'punjabi_audio_files') {
    console.log('🔄 Retrying failed audio generations...\n');
    
    const progressFile = path.join(outputDir, 'progress.json');
    
    try {
        const progressData = await fs.readFile(progressFile, 'utf8');
        const progress = JSON.parse(progressData);
        
        if (progress.failed.length === 0) {
            console.log('✅ No failed items to retry!');
            return;
        }
        
        console.log(`Found ${progress.failed.length} failed items to retry`);
        
        const ttsService = new AzureTTSService();
        
        // Try failed items again
        for (const failedItem of progress.failed) {
            const filename = `audio_${failedItem.index + 1}_${failedItem.original.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
            const filepath = path.join(outputDir, filename);
            
            console.log(`🔄 Retrying: "${failedItem.punjabi}"`);
            
            try {
                const audioBuffer = await ttsService.synthesizeSpeech(failedItem.punjabi);
                await fs.writeFile(filepath, audioBuffer);
                
                // Move from failed to completed
                progress.completed.push({
                    index: failedItem.index,
                    original: failedItem.original,
                    punjabi: failedItem.punjabi,
                    filename: filename,
                    size: audioBuffer.length,
                    timestamp: new Date().toISOString()
                });
                
                // Remove from failed
                const failedIndex = progress.failed.findIndex(f => f.index === failedItem.index);
                if (failedIndex > -1) {
                    progress.failed.splice(failedIndex, 1);
                }
                
                console.log(`✅ Success: ${filename}`);
                
                // Save progress
                await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));
                
                // Wait between retries
                await new Promise(resolve => setTimeout(resolve, 5000));
                
            } catch (error) {
                console.error(`❌ Still failed: "${failedItem.punjabi}" - ${error.message}`);
            }
        }
        
        console.log(`\n🎉 Retry completed! Remaining failed: ${progress.failed.length}`);
        
    } catch (error) {
        console.error('❌ Error during retry:', error);
    }
}

async function main() {
    const command = process.argv[2];
    
    if (command === 'retry') {
        await retryFailed();
    } else {
        const inputFile = process.argv[2] || 'communication_repairs_vocabulary_punjabi.json';
        const outputDir = process.argv[3] || 'punjabi_audio_files';
        await generateAudioWithResume(inputFile, outputDir);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { generateAudioWithResume, retryFailed };

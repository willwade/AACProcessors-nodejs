#!/usr/bin/env node

const { SnapProcessor } = require('./dist/processors');
const fs = require('fs');

console.log('🎵 Enhanced SnapProcessor Demo - Audio Support\n');

// Demo 1: Basic usage (backward compatible)
console.log('1. 📖 Basic SnapProcessor (no audio) - Backward Compatible');
console.log('   const processor = new SnapProcessor();');
console.log('   const tree = processor.loadIntoTree("pageset.sps");');
console.log('   // Buttons will NOT have audioRecording property\n');

// Demo 2: Audio-enabled usage
console.log('2. 🎵 Enhanced SnapProcessor (with audio)');
console.log('   const processor = new SnapProcessor(null, { loadAudio: true });');
console.log('   const tree = processor.loadIntoTree("pageset.sps");');
console.log('   // Buttons will have audioRecording property if audio exists\n');

// Demo 3: Audio manipulation methods
console.log('3. 🔧 Audio Manipulation Methods');
console.log('   // Extract buttons for audio processing');
console.log('   const buttons = processor.extractButtonsForAudio(dbPath, pageUniqueId);');
console.log('   // Returns: [{ id, label, message, hasAudio }, ...]');
console.log('');
console.log('   // Add audio to a button');
console.log('   const audioData = fs.readFileSync("audio.wav");');
console.log('   const audioId = processor.addAudioToButton(dbPath, buttonId, audioData, "metadata");');
console.log('');
console.log('   // Create enhanced pageset with multiple audio files');
console.log('   const audioMappings = new Map();');
console.log('   audioMappings.set(buttonId, { audioData, metadata: "Punjabi audio" });');
console.log('   processor.createAudioEnhancedPageset(source, target, audioMappings);\n');

// Demo 4: Real example if files exist
if (fs.existsSync('Aphasia_Page_Set_With_Punjabi_Audio.sps')) {
    console.log('4. 🎯 Real Example - Punjabi Audio Pageset');
    
    try {
        // Suppress debug output by redirecting console.error temporarily
        const originalError = console.error;
        console.error = () => {};
        
        const processor = new SnapProcessor(null, { loadAudio: true });
        const tree = processor.loadIntoTree('Aphasia_Page_Set_With_Punjabi_Audio.sps');
        
        // Restore console.error
        console.error = originalError;
        
        console.log(`   ✅ Loaded ${Object.keys(tree.pages).length} pages`);
        
        // Count audio buttons
        let totalButtons = 0;
        let audioButtons = 0;
        
        Object.values(tree.pages).forEach(page => {
            page.buttons.forEach(button => {
                totalButtons++;
                if (button.audioRecording && button.audioRecording.data) {
                    audioButtons++;
                }
            });
        });
        
        console.log(`   📊 Total buttons: ${totalButtons}`);
        console.log(`   🎵 Buttons with audio: ${audioButtons}`);
        
        // Find QuickFires page
        const quickFiresPage = Object.values(tree.pages).find(page => 
            page.name && page.name.includes('QuickFires')
        );
        
        if (quickFiresPage) {
            const pageAudioButtons = quickFiresPage.buttons.filter(btn => btn.audioRecording);
            console.log(`   🎯 QuickFires page: ${pageAudioButtons.length} buttons with Punjabi audio`);
            
            if (pageAudioButtons.length > 0) {
                const sample = pageAudioButtons[0];
                console.log(`   📝 Sample: "${sample.label}" (${sample.audioRecording.data.length} bytes)`);
                
                if (sample.audioRecording.metadata) {
                    try {
                        const metadata = JSON.parse(sample.audioRecording.metadata);
                        if (metadata.PunjabiText) {
                            console.log(`   🗣️  Punjabi: "${metadata.PunjabiText}"`);
                        }
                    } catch (e) {
                        // Metadata might not be JSON
                    }
                }
            }
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
} else {
    console.log('4. ⏭️  Enhanced pageset not found - run the audio enhancement workflow first');
}

console.log('\n📚 Key Features Added to SnapProcessor:');
console.log('✅ Optional audio loading (backward compatible)');
console.log('✅ Audio data embedded in button objects');
console.log('✅ Methods to add audio to buttons');
console.log('✅ Bulk audio enhancement capabilities');
console.log('✅ Audio metadata support');
console.log('✅ SHA1-based audio identification (same as Snap Core)');

console.log('\n🎉 The AACProcessors library now supports audio!');
console.log('   Import: const { SnapProcessor } = require("aac-processors");');
console.log('   Usage: new SnapProcessor(null, { loadAudio: true });');

console.log('\n📖 Documentation:');
console.log('   - Audio support is opt-in via constructor options');
console.log('   - Audio data stored as Buffer in audioRecording.data');
console.log('   - Audio identifiers follow SND:<SHA1-hash> pattern');
console.log('   - Metadata stored as JSON strings');
console.log('   - Full compatibility with Snap Core First pageset format');

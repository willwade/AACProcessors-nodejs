#!/usr/bin/env node

const fs = require('fs').promises;
const fsSync = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

async function validateCompleteWorkflow() {
    console.log('🔍 Validating Complete Audio Enhancement Workflow\n');
    
    const results = {
        vocabularyExtraction: false,
        translation: false,
        audioGeneration: false,
        pagesetEnhancement: false,
        errors: []
    };
    
    try {
        // 1. Validate vocabulary extraction
        console.log('1. 📖 Validating vocabulary extraction...');
        
        if (fsSync.existsSync('communication_repairs_vocabulary.json')) {
            const vocabData = JSON.parse(await fs.readFile('communication_repairs_vocabulary.json', 'utf8'));
            
            if (vocabData.vocabulary && vocabData.vocabulary.length === 43) {
                console.log('   ✅ Vocabulary extraction successful (43 items)');
                results.vocabularyExtraction = true;
            } else {
                console.log('   ❌ Vocabulary extraction incomplete');
                results.errors.push('Vocabulary file missing or incomplete');
            }
        } else {
            console.log('   ❌ Vocabulary file not found');
            results.errors.push('communication_repairs_vocabulary.json not found');
        }
        
        // 2. Validate translation
        console.log('\n2. 🌐 Validating Punjabi translation...');
        
        if (fsSync.existsSync('communication_repairs_vocabulary_punjabi.json')) {
            const translationData = JSON.parse(await fs.readFile('communication_repairs_vocabulary_punjabi.json', 'utf8'));
            
            if (translationData.translations && translationData.translations.length === 43) {
                // Check for Punjabi text (Gurmukhi script)
                const hasPunjabi = translationData.translations.some(item => 
                    /[\u0A00-\u0A7F]/.test(item.punjabi)
                );
                
                if (hasPunjabi) {
                    console.log('   ✅ Translation successful (43 items with Punjabi text)');
                    results.translation = true;
                } else {
                    console.log('   ❌ Translation missing Punjabi text');
                    results.errors.push('No Punjabi (Gurmukhi) text found in translations');
                }
            } else {
                console.log('   ❌ Translation incomplete');
                results.errors.push('Translation file missing or incomplete');
            }
        } else {
            console.log('   ❌ Translation file not found');
            results.errors.push('communication_repairs_vocabulary_punjabi.json not found');
        }
        
        // 3. Validate audio generation
        console.log('\n3. 🎵 Validating audio generation...');
        
        if (fsSync.existsSync('punjabi_audio_files')) {
            const audioFiles = await fs.readdir('punjabi_audio_files');
            const wavFiles = audioFiles.filter(f => f.endsWith('.wav'));
            
            if (wavFiles.length >= 30) { // Allow for some failures due to rate limits
                console.log(`   ✅ Audio generation successful (${wavFiles.length} WAV files)`);
                results.audioGeneration = true;
                
                // Check file sizes
                let totalSize = 0;
                for (const file of wavFiles) {
                    const stats = await fs.stat(path.join('punjabi_audio_files', file));
                    totalSize += stats.size;
                }
                console.log(`   📊 Total audio size: ${Math.round(totalSize / 1024)} KB`);
                
            } else {
                console.log(`   ⚠️  Audio generation partial (${wavFiles.length} files)`);
                results.errors.push(`Only ${wavFiles.length} audio files generated`);
            }
        } else {
            console.log('   ❌ Audio directory not found');
            results.errors.push('punjabi_audio_files directory not found');
        }
        
        // 4. Validate enhanced pageset
        console.log('\n4. 📱 Validating enhanced pageset...');
        
        if (fsSync.existsSync('Aphasia_Page_Set_With_Punjabi_Audio.sps')) {
            const db = new Database('Aphasia_Page_Set_With_Punjabi_Audio.sps', { readonly: true });
            
            try {
                // Check audio recordings in database
                const audioRecordings = db.prepare(`
                    SELECT COUNT(*) as count FROM PageSetData 
                    WHERE Identifier LIKE 'SND:%'
                `).get();
                
                // Check buttons with audio
                const buttonsWithAudio = db.prepare(`
                    SELECT COUNT(*) as count FROM Button 
                    WHERE MessageRecordingId IS NOT NULL AND MessageRecordingId > 0
                `).get();
                
                if (audioRecordings.count >= 20 && buttonsWithAudio.count >= 20) {
                    console.log(`   ✅ Pageset enhancement successful`);
                    console.log(`   📊 Audio recordings: ${audioRecordings.count}`);
                    console.log(`   📊 Buttons with audio: ${buttonsWithAudio.count}`);
                    results.pagesetEnhancement = true;
                } else {
                    console.log('   ❌ Pageset enhancement incomplete');
                    results.errors.push('Insufficient audio recordings or button updates');
                }
                
            } finally {
                db.close();
            }
        } else {
            console.log('   ❌ Enhanced pageset not found');
            results.errors.push('Aphasia_Page_Set_With_Punjabi_Audio.sps not found');
        }
        
        // 5. Overall validation
        console.log('\n🎯 Overall Validation Results');
        console.log('================================');
        
        const successCount = Object.values(results).filter(v => v === true).length;
        const totalSteps = 4;
        
        console.log(`✅ Successful steps: ${successCount}/${totalSteps}`);
        console.log(`❌ Errors found: ${results.errors.length}`);
        
        if (results.errors.length > 0) {
            console.log('\n🚨 Issues to address:');
            results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
        
        // Success criteria
        const isFullySuccessful = successCount === totalSteps && results.errors.length === 0;
        const isPartiallySuccessful = successCount >= 3;
        
        if (isFullySuccessful) {
            console.log('\n🎉 COMPLETE SUCCESS! All workflow steps validated.');
            console.log('   The enhanced pageset is ready for use.');
        } else if (isPartiallySuccessful) {
            console.log('\n⚠️  PARTIAL SUCCESS! Most steps completed successfully.');
            console.log('   The enhanced pageset should work but may have some limitations.');
        } else {
            console.log('\n❌ WORKFLOW INCOMPLETE! Major issues found.');
            console.log('   Please address the errors before using the enhanced pageset.');
        }
        
        // Usage instructions
        if (isPartiallySuccessful) {
            console.log('\n📋 Next Steps:');
            console.log('1. Import "Aphasia_Page_Set_With_Punjabi_Audio.sps" into your AAC software');
            console.log('2. Navigate to "QuickFires - Communication Repairs" page');
            console.log('3. Test button audio playback');
            console.log('4. Report any issues or missing audio');
        }
        
        return {
            success: isFullySuccessful,
            partial: isPartiallySuccessful,
            results,
            summary: {
                successfulSteps: successCount,
                totalSteps,
                errorCount: results.errors.length
            }
        };
        
    } catch (error) {
        console.error('❌ Validation error:', error);
        results.errors.push(`Validation error: ${error.message}`);
        return { success: false, partial: false, results, error };
    }
}

async function generateValidationReport() {
    console.log('📋 Generating validation report...\n');
    
    const validation = await validateCompleteWorkflow();
    
    const report = `# Audio Enhancement Workflow Validation Report

Generated: ${new Date().toLocaleString()}

## Validation Results

### Step-by-Step Validation
- **Vocabulary Extraction**: ${validation.results.vocabularyExtraction ? '✅ PASS' : '❌ FAIL'}
- **Punjabi Translation**: ${validation.results.translation ? '✅ PASS' : '❌ FAIL'}
- **Audio Generation**: ${validation.results.audioGeneration ? '✅ PASS' : '❌ FAIL'}
- **Pageset Enhancement**: ${validation.results.pagesetEnhancement ? '✅ PASS' : '❌ FAIL'}

### Overall Status
- **Success Rate**: ${validation.summary.successfulSteps}/${validation.summary.totalSteps} steps completed
- **Status**: ${validation.success ? 'COMPLETE SUCCESS' : validation.partial ? 'PARTIAL SUCCESS' : 'INCOMPLETE'}
- **Errors Found**: ${validation.summary.errorCount}

### Issues Identified
${validation.results.errors.length > 0 ? 
    validation.results.errors.map((error, i) => `${i + 1}. ${error}`).join('\n') : 
    'No issues found.'}

### Recommendations
${validation.success ? 
    '✅ The enhanced pageset is ready for production use.' : 
    validation.partial ? 
    '⚠️ The enhanced pageset can be used but may have limitations. Address the issues above for full functionality.' :
    '❌ Complete the workflow steps before using the enhanced pageset.'}

---
*Validation completed by AACProcessors Audio Enhancement System*
`;

    await fs.writeFile('validation_report.md', report);
    console.log('📄 Validation report saved: validation_report.md');
    
    return validation;
}

async function main() {
    const command = process.argv[2];
    
    if (command === 'report') {
        await generateValidationReport();
    } else {
        await validateCompleteWorkflow();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { validateCompleteWorkflow, generateValidationReport };

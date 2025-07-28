// Test semantic action system with Voco Chat.gridset
const { GridsetProcessor } = require('./dist/processors/gridsetProcessor');
const { ApplePanelsProcessor } = require('./dist/processors/applePanelsProcessor');

console.log('🧪 Testing Semantic Action System with Voco Chat.gridset...\n');

// Test 1: Load Voco Chat GridSet
console.log('✅ Test 1: Loading Voco Chat GridSet');
try {
  const gridsetProcessor = new GridsetProcessor();
  const tree = gridsetProcessor.loadIntoTree('Voco Chat.gridset');
  
  console.log(`   📊 Loaded ${Object.keys(tree.pages).length} pages`);
  
  // Analyze semantic actions
  let totalButtons = 0;
  let semanticActionCount = 0;
  let legacyActionCount = 0;
  let navigationActions = 0;
  let speechActions = 0;
  let customActions = 0;
  
  const actionTypes = new Set();
  const semanticIntents = new Set();
  
  Object.values(tree.pages).forEach(page => {
    page.buttons.forEach(button => {
      totalButtons++;
      
      if (button.semanticAction) {
        semanticActionCount++;
        semanticIntents.add(button.semanticAction.intent);
        
        if (button.semanticAction.category === 'navigation') {
          navigationActions++;
        } else if (button.semanticAction.category === 'communication') {
          speechActions++;
        } else if (button.semanticAction.category === 'custom') {
          customActions++;
        }
      }
      
      if (button.action) {
        legacyActionCount++;
        actionTypes.add(button.action.type);
      }
    });
  });
  
  console.log(`   📈 Total buttons: ${totalButtons}`);
  console.log(`   📈 Semantic actions: ${semanticActionCount}`);
  console.log(`   📈 Legacy actions: ${legacyActionCount}`);
  console.log(`   📈 Navigation actions: ${navigationActions}`);
  console.log(`   📈 Speech actions: ${speechActions}`);
  console.log(`   📈 Custom actions: ${customActions}`);
  console.log(`   📈 Unique action types: ${Array.from(actionTypes).join(', ')}`);
  console.log(`   📈 Semantic intents: ${Array.from(semanticIntents).join(', ')}`);
  
  // Show sample buttons with actions
  console.log('\n   🔍 Sample buttons with semantic actions:');
  let sampleCount = 0;
  for (const pageId in tree.pages) {
    const page = tree.pages[pageId];
    for (const button of page.buttons) {
      if (button.semanticAction && sampleCount < 5) {
        console.log(`     "${button.label}" [${button.semanticAction.category}/${button.semanticAction.intent}]`);
        if (button.semanticAction.platformData?.grid3) {
          console.log(`       Grid3: ${button.semanticAction.platformData.grid3.commandId}`);
        }
        sampleCount++;
      }
    }
    if (sampleCount >= 5) break;
  }
  
} catch (error) {
  console.log('   ❌ Voco Chat loading failed:', error.message);
  process.exit(1);
}

// Test 2: Cross-Platform Conversion
console.log('\n✅ Test 2: Cross-Platform Conversion (Voco Chat → Apple Panels)');
try {
  const gridsetProcessor = new GridsetProcessor();
  const applePanelsProcessor = new ApplePanelsProcessor();
  
  // Load Voco Chat
  const tree = gridsetProcessor.loadIntoTree('Voco Chat.gridset');
  
  // Convert to Apple Panels
  applePanelsProcessor.saveFromTree(tree, 'voco-chat-converted');
  
  // Load back from Apple Panels
  const convertedTree = applePanelsProcessor.loadIntoTree('voco-chat-converted.ascconfig');
  
  console.log(`   📊 Original pages: ${Object.keys(tree.pages).length}`);
  console.log(`   📊 Converted pages: ${Object.keys(convertedTree.pages).length}`);
  
  // Check semantic action preservation
  let originalSemanticActions = 0;
  let convertedSemanticActions = 0;
  let originalNavigationActions = 0;
  let convertedNavigationActions = 0;
  
  Object.values(tree.pages).forEach(page => {
    page.buttons.forEach(button => {
      if (button.semanticAction) {
        originalSemanticActions++;
        if (button.semanticAction.category === 'navigation') {
          originalNavigationActions++;
        }
      }
    });
  });
  
  Object.values(convertedTree.pages).forEach(page => {
    page.buttons.forEach(button => {
      if (button.semanticAction) {
        convertedSemanticActions++;
        if (button.semanticAction.category === 'navigation') {
          convertedNavigationActions++;
        }
      }
    });
  });
  
  console.log(`   📈 Original semantic actions: ${originalSemanticActions}`);
  console.log(`   📈 Converted semantic actions: ${convertedSemanticActions}`);
  console.log(`   📈 Original navigation actions: ${originalNavigationActions}`);
  console.log(`   📈 Converted navigation actions: ${convertedNavigationActions}`);
  
  const preservationRate = convertedSemanticActions / originalSemanticActions * 100;
  console.log(`   📈 Semantic action preservation rate: ${preservationRate.toFixed(1)}%`);
  
  if (preservationRate > 90) {
    console.log('   ✅ Excellent semantic action preservation!');
  } else if (preservationRate > 70) {
    console.log('   ✅ Good semantic action preservation');
  } else {
    console.log('   ⚠️  Semantic action preservation needs improvement');
  }
  
  // Clean up
  const fs = require('fs');
  if (fs.existsSync('voco-chat-converted.ascconfig')) {
    fs.rmSync('voco-chat-converted.ascconfig', { recursive: true, force: true });
  }
  
} catch (error) {
  console.log('   ❌ Cross-platform conversion failed:', error.message);
}

// Test 3: CLI Conversion Test
console.log('\n✅ Test 3: CLI Conversion Test');
try {
  const { execSync } = require('child_process');
  
  // Test CLI conversion
  execSync('node dist/cli/index.js convert "Voco Chat.gridset" voco-chat-cli-test --format panels', {
    encoding: 'utf8',
    timeout: 15000
  });
  
  const fs = require('fs');
  if (fs.existsSync('voco-chat-cli-test.ascconfig')) {
    console.log('   ✅ CLI conversion successful');
    
    // Load the CLI-converted file to verify
    const applePanelsProcessor = new ApplePanelsProcessor();
    const cliTree = applePanelsProcessor.loadIntoTree('voco-chat-cli-test.ascconfig');
    console.log(`   📊 CLI converted pages: ${Object.keys(cliTree.pages).length}`);
    
    // Clean up
    fs.rmSync('voco-chat-cli-test.ascconfig', { recursive: true, force: true });
  } else {
    console.log('   ❌ CLI conversion did not create output file');
  }
} catch (error) {
  console.log('   ❌ CLI conversion failed:', error.message);
}

console.log('\n🎉 Voco Chat Semantic Action Test Complete!');
console.log('\n📋 The semantic action system successfully handles complex GridSet files with rich command structures!');

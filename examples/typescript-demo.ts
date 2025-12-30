#!/usr/bin/env ts-node

/**
 * TypeScript Demo - AACProcessors 2.0
 * 
 * This example demonstrates the new TypeScript API and features
 * including translation workflows and cross-format conversion.
 */

import { 
  getProcessor, 
  DotProcessor, 
  ObfProcessor,
  AACTree, 
  AACPage, 
  AACButton 
} from '../src/index';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 AACProcessors 2.0 TypeScript Demo\n');

  // Example 1: Auto-detect processor by file extension
  console.log('📁 Example 1: Auto-detection');
  try {
    const dotFile = path.join(__dirname, 'example.dot');
    if (fs.existsSync(dotFile)) {
      const processor = getProcessor(dotFile);
      console.log(`✅ Detected processor: ${processor.constructor.name}`);
      
      const tree = processor.loadIntoTree(dotFile);
      console.log(`📊 Loaded ${Object.keys(tree.pages).length} pages`);
      
      const texts = processor.extractTexts(dotFile);
      console.log(`📝 Found ${texts.length} text elements`);
    } else {
      console.log('⚠️  example.dot not found, skipping auto-detection demo');
    }
  } catch (error) {
    console.error('❌ Auto-detection error:', error);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 2: Create a communication board programmatically
  console.log('🏗️  Example 2: Programmatic Board Creation');
  
  const tree = new AACTree();
  
  // Create home page
  const homePage = new AACPage({
    id: 'home',
    name: 'Home Page',
    buttons: []
  });
  
  // Add buttons
  const greetingButton = new AACButton({
    id: 'btn_hello',
    label: 'Hello',
    message: 'Hello, how are you today?',
    type: 'SPEAK'
  });
  
  const foodButton = new AACButton({
    id: 'btn_food',
    label: 'Food',
    message: 'I want something to eat',
    type: 'NAVIGATE',
    targetPageId: 'food_page'
  });
  
  const drinkButton = new AACButton({
    id: 'btn_drink',
    label: 'Drink',
    message: 'I want something to drink',
    type: 'SPEAK'
  });
  
  homePage.addButton(greetingButton);
  homePage.addButton(foodButton);
  homePage.addButton(drinkButton);
  tree.addPage(homePage);
  
  // Create food page
  const foodPage = new AACPage({
    id: 'food_page',
    name: 'Food Options',
    buttons: []
  });
  
  const appleButton = new AACButton({
    id: 'btn_apple',
    label: 'Apple',
    message: 'I want an apple',
    type: 'SPEAK'
  });
  
  const backButton = new AACButton({
    id: 'btn_back',
    label: 'Back',
    message: 'Go back to home',
    type: 'NAVIGATE',
    targetPageId: 'home'
  });
  
  foodPage.addButton(appleButton);
  foodPage.addButton(backButton);
  tree.addPage(foodPage);
  
  tree.rootId = 'home';
  
  console.log(`✅ Created communication board with ${Object.keys(tree.pages).length} pages`);
  
  console.log('\n' + '='.repeat(50) + '\n');

  // Example 3: Save to multiple formats
  console.log('💾 Example 3: Cross-Format Conversion');
  
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  
  try {
    // Save as DOT
    const dotProcessor = new DotProcessor();
    const dotPath = path.join(tempDir, 'demo-board.dot');
    dotProcessor.saveFromTree(tree, dotPath);
    console.log(`✅ Saved as DOT: ${dotPath}`);
    
    // Save as OBF
    const obfProcessor = new ObfProcessor();
    const obfPath = path.join(tempDir, 'demo-board.obf');
    obfProcessor.saveFromTree(tree, obfPath);
    console.log(`✅ Saved as OBF: ${obfPath}`);
    
    // Verify round-trip integrity
    const reloadedDotTree = dotProcessor.loadIntoTree(dotPath);
    const reloadedObfTree = obfProcessor.loadIntoTree(obfPath);
    
    console.log(`🔄 DOT round-trip: ${Object.keys(reloadedDotTree.pages).length} pages`);
    console.log(`🔄 OBF round-trip: ${Object.keys(reloadedObfTree.pages).length} pages`);
    
  } catch (error) {
    console.error('❌ Conversion error:', error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');

  // Example 4: Translation workflow
  console.log('🌍 Example 4: Translation Workflow');
  
  try {
    const dotPath = path.join(tempDir, 'demo-board.dot');
    if (fs.existsSync(dotPath)) {
      const processor = new DotProcessor();
      
      // Extract all text
      const originalTexts = processor.extractTexts(dotPath);
      console.log(`📝 Found ${originalTexts.length} translatable texts:`, originalTexts);
      
      // Create Spanish translations
      const translations = new Map([
        ['Hello', 'Hola'],
        ['Food', 'Comida'],
        ['Drink', 'Bebida'],
        ['Apple', 'Manzana'],
        ['Back', 'Atrás'],
        ['Home Page', 'Página Principal'],
        ['Food Options', 'Opciones de Comida'],
        ['Hello, how are you today?', 'Hola, ¿cómo estás hoy?'],
        ['I want something to eat', 'Quiero algo de comer'],
        ['I want something to drink', 'Quiero algo de beber'],
        ['I want an apple', 'Quiero una manzana'],
        ['Go back to home', 'Volver a casa']
      ]);
      
      // Apply translations
      const spanishPath = path.join(tempDir, 'demo-board-spanish.dot');
      const translatedBuffer = processor.processTexts(dotPath, translations, spanishPath);
      
      console.log(`✅ Applied ${translations.size} translations`);
      console.log(`💾 Saved Spanish version: ${spanishPath}`);
      
      // Verify translations
      const spanishTexts = processor.extractTexts(spanishPath);
      console.log(`🔍 Spanish texts:`, spanishTexts.slice(0, 5), '...');
      
    } else {
      console.log('⚠️  DOT file not found for translation demo');
    }
  } catch (error) {
    console.error('❌ Translation error:', error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');

  // Example 5: Error handling
  console.log('🛡️  Example 5: Error Handling');
  
  try {
    const processor = new DotProcessor();
    
    // Try to load a non-existent file
    try {
      processor.loadIntoTree('non-existent-file.dot');
    } catch (error) {
      console.log(`✅ Caught expected error: ${error instanceof Error ? error.message : error}`);
    }
    
    // Try to load invalid content
    try {
      const invalidContent = Buffer.from('This is not a valid DOT file');
      const tree = processor.loadIntoTree(invalidContent);
      console.log(`✅ Gracefully handled invalid content: ${Object.keys(tree.pages).length} pages`);
    } catch (error) {
      console.log(`✅ Handled invalid content error: ${error instanceof Error ? error.message : error}`);
    }
    
  } catch (error) {
    console.error('❌ Error handling demo failed:', error);
  }
  
  console.log('\n🎉 Demo completed successfully!');
  console.log('\n📚 For more examples, see:');
  console.log('   - README.md for API documentation');
  console.log('   - test/ directory for comprehensive usage examples');
  console.log('   - examples/ directory for more demos');
  
  // Cleanup
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('\n🧹 Cleaned up temporary files');
    }
  } catch (error) {
    console.warn('⚠️  Failed to clean up temporary files:', error);
  }
}

// Run the demo
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}

export { main as runDemo };

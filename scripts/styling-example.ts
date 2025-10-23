#!/usr/bin/env ts-node

/**
 * Styling Example - Demonstrates comprehensive styling support in AACProcessors
 * 
 * This example shows how to:
 * 1. Create AAC content with comprehensive styling
 * 2. Save to different formats while preserving styling
 * 3. Load and verify styling information
 * 4. Convert between formats with styling preservation
 */

import { AACTree, AACPage, AACButton } from '../dist/core/treeStructure';
import { SnapProcessor } from '../dist/processors/snapProcessor';
import { TouchChatProcessor } from '../dist/processors/touchchatProcessor';
import { ObfProcessor } from '../dist/processors/obfProcessor';
import { GridsetProcessor } from '../dist/processors/gridsetProcessor';
import fs from 'fs';
import path from 'path';

// Create output directory
const outputDir = path.join(__dirname, '../examples/styled-output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🎨 AAC Styling Example');
console.log('======================\n');

// 1. Create a styled AAC tree
console.log('1. Creating styled AAC content...');

const tree = new AACTree();

// Create a main page with styling
const mainPage = new AACPage({
  id: 'main-page',
  name: 'Main Communication Board',
  grid: [],
  buttons: [],
  parentId: null,
  style: {
    backgroundColor: '#f0f8ff', // Light blue background
    fontFamily: 'Arial',
    fontSize: 16,
    borderColor: '#cccccc',
  },
});

// Create greeting buttons with different styles
const greetingButtons = [
  {
    id: 'hello-btn',
    label: 'Hello',
    message: 'Hello, how are you today?',
    style: {
      backgroundColor: '#4CAF50', // Green
      fontColor: '#ffffff',
      borderColor: '#45a049',
      borderWidth: 2,
      fontSize: 18,
      fontFamily: 'Helvetica',
      fontWeight: 'bold' as const,
      labelOnTop: true,
    },
  },
  {
    id: 'goodbye-btn',
    label: 'Goodbye',
    message: 'Goodbye, see you later!',
    style: {
      backgroundColor: '#f44336', // Red
      fontColor: '#ffffff',
      borderColor: '#d32f2f',
      borderWidth: 2,
      fontSize: 18,
      fontFamily: 'Helvetica',
      fontWeight: 'bold' as const,
      labelOnTop: true,
    },
  },
  {
    id: 'thanks-btn',
    label: 'Thank You',
    message: 'Thank you very much!',
    style: {
      backgroundColor: '#2196F3', // Blue
      fontColor: '#ffffff',
      borderColor: '#1976D2',
      borderWidth: 1,
      fontSize: 16,
      fontFamily: 'Times',
      fontStyle: 'italic' as const,
      textUnderline: true,
    },
  },
];

// Add greeting buttons to the page
greetingButtons.forEach((btnData) => {
  const button = new AACButton({
    id: btnData.id,
    label: btnData.label,
    message: btnData.message,
    type: 'SPEAK',
    action: null,
    style: btnData.style,
  });
  mainPage.addButton(button);
});

// Create a navigation button to a second page
const moreButton = new AACButton({
  id: 'more-btn',
  label: 'More Options',
  message: 'Navigate to more options',
  type: 'NAVIGATE',
  targetPageId: 'more-page',
  action: {
    type: 'NAVIGATE',
    targetPageId: 'more-page',
  },
  style: {
    backgroundColor: '#FF9800', // Orange
    fontColor: '#000000',
    borderColor: '#F57C00',
    borderWidth: 3,
    fontSize: 14,
    fontFamily: 'Georgia',
    fontWeight: 'normal' as const,
    transparent: false,
  },
});

mainPage.addButton(moreButton);
tree.addPage(mainPage);

// Create a second page with different styling
const morePage = new AACPage({
  id: 'more-page',
  name: 'More Options',
  grid: [],
  buttons: [],
  parentId: 'main-page',
  style: {
    backgroundColor: '#fff3e0', // Light orange background
    fontFamily: 'Verdana',
    fontSize: 14,
  },
});

// Add some action buttons with varied styling
const actionButtons = [
  {
    id: 'eat-btn',
    label: 'Eat',
    message: 'I want to eat something',
    style: {
      backgroundColor: '#8BC34A', // Light green
      fontColor: '#2E7D32',
      borderColor: '#689F38',
      borderWidth: 1,
      fontSize: 16,
      fontFamily: 'Arial',
    },
  },
  {
    id: 'drink-btn',
    label: 'Drink',
    message: 'I want something to drink',
    style: {
      backgroundColor: '#03A9F4', // Light blue
      fontColor: '#ffffff',
      borderColor: '#0288D1',
      borderWidth: 1,
      fontSize: 16,
      fontFamily: 'Arial',
    },
  },
];

actionButtons.forEach((btnData) => {
  const button = new AACButton({
    id: btnData.id,
    label: btnData.label,
    message: btnData.message,
    type: 'SPEAK',
    action: null,
    style: btnData.style,
  });
  morePage.addButton(button);
});

// Add back button
const backButton = new AACButton({
  id: 'back-btn',
  label: 'Back',
  message: 'Go back to main page',
  type: 'NAVIGATE',
  targetPageId: 'main-page',
  action: {
    type: 'NAVIGATE',
    targetPageId: 'main-page',
  },
  style: {
    backgroundColor: '#9E9E9E', // Gray
    fontColor: '#ffffff',
    borderColor: '#757575',
    borderWidth: 1,
    fontSize: 14,
    fontFamily: 'Arial',
    fontWeight: 'normal' as const,
  },
});

morePage.addButton(backButton);
tree.addPage(morePage);

console.log(`✅ Created AAC tree with ${Object.keys(tree.pages).length} pages and comprehensive styling\n`);

// 2. Save to different formats
console.log('2. Saving to different formats with styling...');

const processors = [
  { name: 'Snap/SPS', processor: new SnapProcessor(), extension: 'spb' },
  { name: 'TouchChat', processor: new TouchChatProcessor(), extension: 'ce' },
  { name: 'OBF', processor: new ObfProcessor(), extension: 'obf' },
  { name: 'Grid3', processor: new GridsetProcessor(), extension: 'gridset' },
];

const savedFiles: { [key: string]: string } = {};

processors.forEach(({ name, processor, extension }) => {
  try {
    const filePath = path.join(outputDir, `styled-example.${extension}`);
    processor.saveFromTree(tree, filePath);
    savedFiles[name] = filePath;
    console.log(`✅ Saved ${name} format: ${filePath}`);
  } catch (error) {
    console.log(`❌ Failed to save ${name} format: ${error}`);
  }
});

console.log('\n3. Verifying styling preservation...');

// 3. Load back and verify styling
Object.entries(savedFiles).forEach(([formatName, filePath]) => {
  try {
    const processor = processors.find(p => p.name === formatName)?.processor;
    if (!processor) return;

    let loadedTree;
    if (processor instanceof GridsetProcessor) {
      loadedTree = processor.loadIntoTree(fs.readFileSync(filePath));
    } else {
      loadedTree = processor.loadIntoTree(filePath);
    }
    const loadedMainPage = loadedTree.getPage('main-page');
    
    if (loadedMainPage) {
      const helloButton = loadedMainPage.buttons.find(b => b.label === 'Hello');
      
      console.log(`\n📋 ${formatName} styling verification:`);
      console.log(`   Page background: ${loadedMainPage.style?.backgroundColor || 'Not preserved'}`);
      console.log(`   Page font: ${loadedMainPage.style?.fontFamily || 'Not preserved'}`);
      
      if (helloButton?.style) {
        console.log(`   Hello button background: ${helloButton.style.backgroundColor || 'Not preserved'}`);
        console.log(`   Hello button font color: ${helloButton.style.fontColor || 'Not preserved'}`);
        console.log(`   Hello button font weight: ${helloButton.style.fontWeight || 'Not preserved'}`);
        console.log(`   Hello button border width: ${helloButton.style.borderWidth || 'Not preserved'}`);
      } else {
        console.log(`   Hello button styling: Not preserved`);
      }
    }
  } catch (error) {
    console.log(`❌ Failed to verify ${formatName}: ${error}`);
  }
});

console.log('\n4. Cross-format conversion example...');

// 4. Demonstrate cross-format conversion with styling preservation
try {
  // Load from Snap format
  const snapPath = savedFiles['Snap/SPS'];
  if (snapPath && fs.existsSync(snapPath)) {
    const snapProcessor = new SnapProcessor();
    const loadedFromSnap = snapProcessor.loadIntoTree(snapPath);
    
    // Save to TouchChat format
    const touchChatProcessor = new TouchChatProcessor();
    const convertedPath = path.join(outputDir, 'converted-snap-to-touchchat.ce');
    touchChatProcessor.saveFromTree(loadedFromSnap, convertedPath);
    
    // Verify the conversion preserved styling
    const reconvertedTree = touchChatProcessor.loadIntoTree(convertedPath);
    const reconvertedPage = reconvertedTree.getPage('main-page');
    const reconvertedButton = reconvertedPage?.buttons.find(b => b.label === 'Hello');
    
    console.log('✅ Cross-format conversion (Snap → TouchChat):');
    console.log(`   Original background: ${tree.getPage('main-page')?.style?.backgroundColor}`);
    console.log(`   Converted background: ${reconvertedPage?.style?.backgroundColor || 'Not preserved'}`);
    console.log(`   Button styling preserved: ${reconvertedButton?.style ? 'Yes' : 'No'}`);
  }
} catch (error) {
  console.log(`❌ Cross-format conversion failed: ${error}`);
}

console.log('\n🎉 Styling example completed!');
console.log(`📁 Output files saved to: ${outputDir}`);
console.log('\nKey takeaways:');
console.log('• Styling information is preserved across all supported formats');
console.log('• Each format supports different styling capabilities');
console.log('• Cross-format conversion maintains compatible styling properties');
console.log('• The AACStyle interface provides a unified styling model');

const { GridsetProcessor } = require("./dist/processors/gridsetProcessor");
const { AACTree, AACPage, AACButton } = require("./dist/core/treeStructure");

console.log("Testing expanded Grid3 action system...");

// Create a test tree with various action types
const tree = new AACTree();

// Page 1: Main page with navigation and various actions
const page1 = new AACPage({
  id: "main",
  name: "Main Page",
  buttons: [],
  grid: [],
});

// Navigation button
const navButton = new AACButton({
  id: "nav1",
  label: "Go to Settings",
  message: "Navigate to settings",
  type: "NAVIGATE",
  targetPageId: "settings",
  action: {
    type: "NAVIGATE",
    targetPageId: "settings",
  },
});

// Text insertion button
const textButton = new AACButton({
  id: "text1",
  label: "Hello",
  message: "Hello World",
  type: "ACTION",
  action: {
    type: "INSERT_TEXT",
    text: "Hello World!",
  },
});

// Clear button
const clearButton = new AACButton({
  id: "clear1",
  label: "Clear",
  message: "Clear text",
  type: "ACTION",
  action: {
    type: "CLEAR",
  },
});

// Delete word button
const deleteButton = new AACButton({
  id: "delete1",
  label: "Delete Word",
  message: "Delete last word",
  type: "ACTION",
  action: {
    type: "DELETE_WORD",
  },
});

page1.addButton(navButton);
page1.addButton(textButton);
page1.addButton(clearButton);
page1.addButton(deleteButton);

tree.addPage(page1);

// Page 2: Settings page with back button
const page2 = new AACPage({
  id: "settings",
  name: "Settings Page",
  buttons: [],
  grid: [],
});

const backButton = new AACButton({
  id: "back1",
  label: "Back",
  message: "Go back",
  type: "ACTION",
  action: {
    type: "GO_BACK",
  },
});

const speakButton = new AACButton({
  id: "speak1",
  label: "Speak All",
  message: "Speak everything",
  type: "ACTION",
  action: {
    type: "SPEAK",
    unit: "All",
    moveCaret: 0,
  },
});

page2.addButton(backButton);
page2.addButton(speakButton);
tree.addPage(page2);

// Test the processor
const processor = new GridsetProcessor();

console.log("=== Before Save ===");
console.log("Page 1 buttons:");
page1.buttons.forEach((btn) => {
  console.log(`  "${btn.label}" [${btn.type}] - Action:`, btn.action);
});

console.log("Page 2 buttons:");
page2.buttons.forEach((btn) => {
  console.log(`  "${btn.label}" [${btn.type}] - Action:`, btn.action);
});

// Save to GridSet format
processor.saveFromTree(tree, "test-actions.gridset");

// Load back and verify
console.log("\n=== After Load ===");
const reloadedTree = processor.loadIntoTree("test-actions.gridset");

Object.values(reloadedTree.pages).forEach((page, i) => {
  console.log(`Page ${i}: "${page.name}"`);
  page.buttons.forEach((btn) => {
    console.log(`  "${btn.label}" [${btn.type}] - Action:`, btn.action);
  });
});

// Clean up
const fs = require("fs");
if (fs.existsSync("test-actions.gridset")) {
  fs.unlinkSync("test-actions.gridset");
}

console.log("\nTest completed successfully!");

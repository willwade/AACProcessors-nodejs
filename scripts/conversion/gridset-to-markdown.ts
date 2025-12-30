#!/usr/bin/env ts-node

/**
 * Gridset to Markdown Converter Example
 *
 * This example demonstrates how to:
 * 1. Load a gridset file (.gridset or .gridsetx)
 * 2. Navigate through pages in the gridset
 * 3. Convert a page to markdown format
 */

import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import { AACTree, AACPage, AACButton } from '../src/core/treeStructure';
import fs from 'fs';
import path from 'path';

/**
 * Convert a single button to markdown format
 */
function buttonToMarkdown(button: AACButton, includeIndex: boolean = false): string {
  const parts: string[] = [];

  // Button index/position
  if (includeIndex && (button.x !== undefined || button.y !== undefined)) {
    parts.push(`**[${button.x ?? '?'}, ${button.y ?? '?'}]**`);
  }

  // Button label
  const label = button.label || '(unnamed)';
  parts.push(`### ${label}`);

  // Button message/speech
  if (button.message && button.message !== label) {
    parts.push(`**Message:** "${button.message}"`);
  }

  // Button type/action
  if (button.type) {
    parts.push(`**Type:** ${button.type}`);
  }

  // Navigation target
  if (button.type === 'NAVIGATE' && button.targetPageId) {
    parts.push(`**Target:** \`${button.targetPageId}\``);
  }

  // Additional styling info
  const styleParts: string[] = [];
  if (button.style?.backgroundColor) {
    styleParts.push(`bg: ${button.style.backgroundColor}`);
  }
  if (button.style?.fontColor) {
    styleParts.push(`text: ${button.style.fontColor}`);
  }
  if (styleParts.length > 0) {
    parts.push(`**Style:** ${styleParts.join(', ')}`);
  }

  // Symbol library reference
  if (button.symbolLibrary) {
    parts.push(`**Symbol:** \`${button.symbolLibrary}${button.symbolPath ? ':' + button.symbolPath : ''}\``);
  }

  return parts.join('\n') + '\n';
}

/**
 * Convert a page to markdown format
 */
function pageToMarkdown(page: AACPage, tree?: AACTree): string {
  const lines: string[] = [];

  // Page header
  lines.push(`# ${page.name}`);
  lines.push('');
  lines.push(`**Page ID:** \`${page.id}\``);

  // Parent page info
  if (page.parentId && tree) {
    const parent = tree.pages[page.parentId];
    if (parent) {
      lines.push(`**Parent:** [${parent.name}](#${parent.name.toLowerCase().replace(/\s+/g, '-')})`);
    }
  }

  // Grid dimensions
  if (page.grid && page.grid.length > 0) {
    const rows = page.grid.length;
    const cols = Math.max(...page.grid.map(row => row?.length || 0));
    lines.push(`**Grid Size:** ${cols} columns × ${rows} rows`);
  }

  lines.push('');

  // Child pages
  if (tree) {
    const children = Object.values(tree.pages).filter(p => p.parentId === page.id);
    if (children.length > 0) {
      lines.push('## Child Pages');
      lines.push('');
      children.forEach(child => {
        lines.push(`- [${child.name}](#${child.name.toLowerCase().replace(/\s+/g, '-')})`);
      });
      lines.push('');
    }
  }

  // Buttons grid (if available)
  if (page.grid && page.grid.length > 0) {
    lines.push('## Grid Layout');
    lines.push('');
    lines.push('```\n'); // Start code block for visual representation

    for (let y = 0; y < page.grid.length; y++) {
      const row = page.grid[y];
      if (!row) continue;

      const rowLabels: string[] = [];
      for (let x = 0; x < row.length; x++) {
        const button = row[x];
        if (button) {
          const label = (button.label || '(empty)').substring(0, 12).padEnd(12);
          rowLabels.push(label);
        } else {
          rowLabels.push(''.padEnd(12));
        }
      }
      lines.push(rowLabels.join(' │ '));
    }

    lines.push('\n```\n'); // End code block
  }

  // Buttons detail
  lines.push('## Buttons');
  lines.push('');

  if (page.buttons.length === 0) {
    lines.push('*No buttons on this page*\n');
  } else {
    // Group buttons by type for better organization
    const speakButtons = page.buttons.filter(b => b.type === 'SPEAK');
    const navigateButtons = page.buttons.filter(b => b.type === 'NAVIGATE');
    const otherButtons = page.buttons.filter(b => b.type !== 'SPEAK' && b.type !== 'NAVIGATE');

    if (speakButtons.length > 0) {
      lines.push('### Speech Buttons');
      lines.push('');
      speakButtons.forEach(button => {
        lines.push(buttonToMarkdown(button));
      });
    }

    if (navigateButtons.length > 0) {
      lines.push('### Navigation Buttons');
      lines.push('');
      navigateButtons.forEach(button => {
        lines.push(buttonToMarkdown(button));
      });
    }

    if (otherButtons.length > 0) {
      lines.push('### Other Buttons');
      lines.push('');
      otherButtons.forEach(button => {
        lines.push(buttonToMarkdown(button));
      });
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Convert entire tree to markdown with navigation
 */
function treeToMarkdown(tree: AACTree, options: {
  includeAllPages?: boolean;
  maxDepth?: number;
  startPageId?: string;
} = {}): string {
  const { includeAllPages = true, maxDepth = 3, startPageId } = options;
  const lines: string[] = [];

  // Document header
  lines.push('# Gridset Documentation');
  lines.push('');
  lines.push(`This document contains ${Object.keys(tree.pages).length} pages from the gridset.`);
  lines.push('');

  // Table of Contents
  if (includeAllPages) {
    lines.push('## Table of Contents');
    lines.push('');
    addPagesToTOC(lines, tree, startPageId || tree.rootId || '', 0, maxDepth);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Page content
  if (includeAllPages) {
    const visited = new Set<string>();

    const addPage = (pageId: string, depth: number) => {
      if (visited.has(pageId) || depth > maxDepth) return;
      visited.add(pageId);

      const page = tree.pages[pageId];
      if (!page) return;

      lines.push(pageToMarkdown(page, tree));
      lines.push('---');
      lines.push('');

      // Recursively add child pages
      Object.values(tree.pages)
        .filter(p => p.parentId === pageId)
        .forEach(child => addPage(child.id, depth + 1));
    };

    addPage(startPageId || tree.rootId || '', 0);
  }

  return lines.join('\n');
}

/**
 * Helper to add pages to table of contents
 */
function addPagesToTOC(
  lines: string[],
  tree: AACTree,
  pageId: string,
  depth: number,
  maxDepth: number
): void {
  if (depth > maxDepth) return;

  const page = tree.pages[pageId];
  if (!page) return;

  const indent = '  '.repeat(depth);
  const anchor = page.name.toLowerCase().replace(/\s+/g, '-');
  lines.push(`${indent}- [${page.name}](#${anchor})`);

  // Add children
  Object.values(tree.pages)
    .filter(p => p.parentId === pageId)
    .forEach(child => addPagesToTOC(lines, tree, child.id, depth + 1, maxDepth));
}

/**
 * Main demo function
 */
async function main() {
  console.log('📄 Gridset to Markdown Converter\n');

  // Get gridset file path from command line or use example
  const gridsetPath = process.argv[2] || path.join(__dirname, 'example.gridset');

  if (!fs.existsSync(gridsetPath)) {
    console.error(`❌ File not found: ${gridsetPath}`);
    console.log('\nUsage: ts-node gridset-to-markdown.ts <path-to-gridset>');
    process.exit(1);
  }

  console.log(`📁 Loading: ${gridsetPath}`);

  try {
    // Create processor and load the gridset
    const processor = new GridsetProcessor();
    const tree = processor.loadIntoTree(gridsetPath);

    console.log(`✅ Loaded ${Object.keys(tree.pages).length} pages`);
    console.log(`🏠 Root page: ${tree.rootId ? tree.pages[tree.rootId]?.name : 'None'}`);

    // Generate markdown for the entire tree
    console.log('\n📝 Generating markdown...');
    const markdown = treeToMarkdown(tree, {
      includeAllPages: true,
      maxDepth: 3,
      startPageId: tree.rootId || undefined
    });

    // Save to file
    const outputPath = gridsetPath.replace(/\.(gridsetx?)/, '.md');
    fs.writeFileSync(outputPath, markdown, 'utf8');
    console.log(`💾 Saved to: ${outputPath}`);

    // Show preview of root page
    if (tree.rootId && tree.pages[tree.rootId]) {
      console.log('\n--- Preview of Root Page ---\n');
      const rootPagePreview = pageToMarkdown(tree.pages[tree.rootId], tree);
      console.log(rootPagePreview.split('\n').slice(0, 30).join('\n'));
      console.log('...\n');
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
}

export { pageToMarkdown, treeToMarkdown, buttonToMarkdown };

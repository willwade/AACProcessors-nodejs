#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import { AACTree, AACPage, AACButton, AACSemanticCategory, AACSemanticIntent } from '../src/core/treeStructure';

interface Cell {
  text: string;
  row: number;
  col: number;
}

interface Grid {
  name: string;
  filename: string;
  rows: number;
  cols: number;
  cells: Cell[];
  categories: string[];
}

function parseGridFile(filePath: string, filename: string): Grid {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const cells: Cell[] = [];
  const categories: string[] = [];
  let maxRows = 0;
  let maxCols = 0;
  let currentRow = 0;

  // Parse each line as a row of cells
  lines.forEach(line => {
    const trimmedLine = line.trim();

    // Skip empty lines completely (OCR sometimes inserts blank lines)
    if (!trimmedLine) {
      return;
    }

    // Split by tabs to get individual cells, preserve empty cells between tabs
    const cellTexts = line.split('\t');

    cellTexts.forEach((text, colIndex) => {
      const trimmedText = text.trim();

      // Add cell even if empty (to preserve position)
      if (trimmedText !== '...' && trimmedText !== '') {
        cells.push({
          text: trimmedText,
          row: currentRow,
          col: colIndex
        });
      }
      maxCols = Math.max(maxCols, colIndex + 1);
    });

    currentRow += 1;
    maxRows = Math.max(maxRows, currentRow);
  });

  // Identify categories (words that appear in the rightmost columns or are known categories)
  const knownCategories = [
    'Mitteilungen', 'Fragen', 'Leute', 'Verben', 'Eigenschaften', 'Gefühle',
    'Treffen', 'Lob', 'Beschwerde', 'Sprüche', 'Spielen', 'Multimedia',
    'Essen', 'Trinken', 'Farben/Formen', 'Sport', 'Musik', 'Draußen',
    'Fahrzeuge', 'Tiere', 'Pflanzen', 'Wetter', 'Buchstaben', 'Zahlen/Geld',
    'Haus', 'Kleidung', 'Körper', 'Arztbesuch', 'Therapie', 'Tagesplan',
    'Zeit', 'Schule', 'Buch', 'Basteln/Büro', 'Werken', 'Feste/Religion',
    'Freizeit', 'Biografie', 'Berufe', 'Geografie', 'Politik',
    'Dies und das', 'Wortbausteine'
  ];

  cells.forEach(cell => {
    if (knownCategories.includes(cell.text)) {
      categories.push(cell.text);
    }
  });

  // Strip extensions and any parent path prefix (e.g. "Home->Fragen.PNG.txt" -> "Fragen")
  const baseName = filename
    .replace(/\.txt$/i, '')
    .replace(/\.png$/i, '');
  const parts = baseName.split('->');
  const pageName = parts[parts.length - 1] || baseName;

  return {
    name: pageName,
    filename,
    rows: maxRows,
    cols: maxCols,
    cells,
    categories: [...new Set(categories)]
  };
}

function createAACPage(grid: Grid): AACPage {
  const buttons: AACButton[] = [];
  // Build an explicit 2D grid so downstream exporters keep the shape (6×11 etc.)
  const gridLayout: (AACButton | null)[][] = Array.from({ length: grid.rows }, () =>
    Array.from({ length: grid.cols }, () => null)
  );

  grid.cells.forEach(cell => {
    const text = cell.text;
    const isCategory = grid.categories.includes(text);
    const isNavigation = text === 'Home' || text === 'weiter' || text === 'zurück';

    // Ensure position is within bounds
    if (cell.row < grid.rows && cell.col < grid.cols) {
      const button: AACButton = {
        id: `${grid.name.toLowerCase().replace(/[^a-z]/g, '_')}_${cell.row}_${cell.col}`,
        label: text,
        style: {
          backgroundColor: isCategory ? '#4CAF50' : isNavigation ? '#2196F3' : '#FFFFFF',
          fontColor: isCategory || isNavigation ? '#FFFFFF' : '#000000',
          borderColor: '#CCCCCC',
          borderWidth: 1,
        },
        position: {
          row: cell.row,
          col: cell.col,
          width: 1,
          height: 1,
        },
        semanticAction: isCategory ? {
          category: AACSemanticCategory.NAVIGATION,
          intent: AACSemanticIntent.NAVIGATE_TO,
          targetId: text.toLowerCase().replace(/[^a-z]/g, '_'),
          text: text
        } : isNavigation ? {
          category: AACSemanticCategory.NAVIGATION,
          intent: text === 'Home' ? AACSemanticIntent.GO_HOME : AACSemanticIntent.GO_BACK,
        } : {
          category: AACSemanticCategory.COMMUNICATION,
          intent: AACSemanticIntent.SPEAK_IMMEDIATE,
          text: text
        }
      };

      buttons.push(button);
      gridLayout[cell.row][cell.col] = button;
    }
  });

  return {
    id: grid.name.toLowerCase().replace(/[^a-z]/g, '_'),
    name: grid.name,
    grid: gridLayout,
    buttons,
    style: {
      rows: grid.rows,
      cols: grid.cols,
      backgroundColor: '#F5F5F5',
      gap: 2,
    }
  };
}

async function convertTextFilesToGridset() {
  console.log('=== TXT to Gridset Converter ===\n');
  console.log('This script converts tab-separated text files to Grid3 format.\n');

  // Default to the OCR outputs we generate from screenshots
  const baseDir = path.resolve(__dirname, '../examples/text-conversion');
  const txtDir = path.join(baseDir, 'ocr-results');
  if (!fs.existsSync(txtDir)) {
    console.log('Creating txt-files directory...');
    fs.mkdirSync(txtDir, { recursive: true });
    console.log('Please put your tab-separated text files in the txt-files directory.');
    console.log('File format: Home.txt, Home->Fragen.txt, etc.');
    return;
  }

  const files = fs.readdirSync(txtDir).filter(f => f.endsWith('.txt'));

  if (files.length === 0) {
    console.log('No .txt files found in txt-files directory.');
    return;
  }

  console.log(`Found ${files.length} text files:\n`);

  const tree = new AACTree();

  // Process each text file
  for (const file of files) {
    const filePath = path.join(txtDir, file);
    const grid = parseGridFile(filePath, file);
    const page = createAACPage(grid);

    tree.addPage(page);

    console.log(`✓ ${file}`);
    console.log(`  - Page: ${grid.name}`);
    console.log(`  - Grid: ${grid.rows}×${grid.cols}`);
    console.log(`  - Cells: ${grid.cells.length}`);
    console.log(`  - Categories: ${grid.categories.join(', ') || 'none'}`);
    console.log();
  }

  // Set Home as root page if it exists
  const homePage = Object.values(tree.pages).find(p => p.id === 'home');
  if (homePage) {
    tree.rootId = 'home';
    console.log('✓ Set Home as root page\n');
  }

  // Export to Grid3
  const processor = new GridsetProcessor();
  const outputPath = path.join(baseDir, 'converted-from-txt.gridset');

  processor.saveFromTree(tree, outputPath);

  const stats = fs.statSync(outputPath);
  console.log(`🎉 Conversion complete!`);
  console.log(`📦 Output file: converted-from-txt.gridset`);
  console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`📁 Full path: ${outputPath}\n`);

  console.log('You can now import converted-from-txt.gridset into Grid3!');
}

// Also create a function to parse one file for testing
export function parseSingleTextFile(filePath: string): Grid {
  const filename = path.basename(filePath);
  return parseGridFile(filePath, filename);
}

if (require.main === module) {
  convertTextFilesToGridset();
}

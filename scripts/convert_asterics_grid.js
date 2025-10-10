#!/usr/bin/env node

/**
 * Asterics Grid Multi-Format Conversion Script
 *
 * Converts an Asterics Grid file (.grd) to all supported AAC formats:
 * - Grid3/Gridset (.gridset)
 * - Snap/SPS (.spb, .sps)
 * - TouchChat (.ce)
 * - OBF (.obf, .obz)
 * - OPML (.opml)
 * - DOT (.dot)
 * - Apple Panels (.plist)
 * - Excel (.xlsx)
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Import processors from local AACProcessors library
const {
  AstericsGridProcessor,
  GridsetProcessor,
  SnapProcessor,
  TouchChatProcessor,
  ObfProcessor,
  OpmlProcessor,
  DotProcessor,
  ApplePanelsProcessor,
  ExcelProcessor,
} = require('../dist/processors');

// Configuration
const CONFIG = {
  // Source file (Asterics Grid)
  sourceFile: path.join(__dirname, '../../cs_student_cat_2025-10-01_13-58_asterics-grid-full-backup.grd'),

  // Output directory
  outputDir: path.join(__dirname, '../output/conversions'),

  // Base name for output files (without extension)
  outputBaseName: 'cs_student_cat',

  // Formats to convert to
  formats: [
    { name: 'Grid3/Gridset', ext: '.gridset', processor: GridsetProcessor, priority: 1 },
    // { name: 'Snap Scene', ext: '.spb', processor: SnapProcessor, priority: 2 },
    // { name: 'TouchChat', ext: '.ce', processor: TouchChatProcessor, priority: 3 },
    // { name: 'OBF (single)', ext: '.obf', processor: ObfProcessor, priority: 4 },
    // { name: 'OBF (zipped)', ext: '.obz', processor: ObfProcessor, priority: 5 },
    // { name: 'OPML', ext: '.opml', processor: OpmlProcessor, priority: 6 },
    // { name: 'DOT (Graphviz)', ext: '.dot', processor: DotProcessor, priority: 7 },
    // { name: 'Apple Panels', ext: '.plist', processor: ApplePanelsProcessor, priority: 8 },
    // { name: 'Excel', ext: '.xlsx', processor: ExcelProcessor, priority: 9 },
  ],
};

// Results tracking
const results = {
  sourceFile: CONFIG.sourceFile,
  sourceStats: null,
  treeStats: null,
  conversions: [],
  startTime: null,
  endTime: null,
  errors: [],
};

/**
 * Format file size to human-readable string
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get statistics about the AACTree
 */
function getTreeStats(tree) {
  const pageCount = Object.keys(tree.pages).length;
  let totalButtons = 0;
  let navigationButtons = 0;
  let speakButtons = 0;
  const uniqueLabels = new Set();

  for (const pageId in tree.pages) {
    const page = tree.pages[pageId];
    totalButtons += page.buttons.length;

    page.buttons.forEach(button => {
      if (button.label) uniqueLabels.add(button.label);

      // Count button types based on semantic action
      if (button.semanticAction) {
        const intent = button.semanticAction.intent;
        if (intent && (intent.includes('NAVIGATE') || intent.includes('GO_'))) {
          navigationButtons++;
        } else if (intent && intent.includes('SPEAK')) {
          speakButtons++;
        }
      }
    });
  }

  return {
    pageCount,
    totalButtons,
    navigationButtons,
    speakButtons,
    uniqueLabels: uniqueLabels.size,
    avgButtonsPerPage: totalButtons / pageCount,
  };
}

/**
 * Load and analyze the source Asterics Grid file
 */
async function loadSourceFile() {
  console.log('📂 Loading source file...');
  console.log(`   ${CONFIG.sourceFile}`);

  try {
    // Check if file exists
    const stats = await fs.stat(CONFIG.sourceFile);
    results.sourceStats = {
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      modified: stats.mtime,
    };

    console.log(`   ✓ File size: ${results.sourceStats.sizeFormatted}`);
    console.log(`   ✓ Modified: ${results.sourceStats.modified.toLocaleString()}`);

    // Load into AACTree structure
    console.log('\n🔄 Loading into AACTree structure...');
    const processor = new AstericsGridProcessor({ loadAudio: true });
    const tree = processor.loadIntoTree(CONFIG.sourceFile);

    // Get tree statistics
    results.treeStats = getTreeStats(tree);
    console.log(`   ✓ Pages: ${results.treeStats.pageCount}`);
    console.log(`   ✓ Total buttons: ${results.treeStats.totalButtons}`);
    console.log(`   ✓ Navigation buttons: ${results.treeStats.navigationButtons}`);
    console.log(`   ✓ Speak buttons: ${results.treeStats.speakButtons}`);
    console.log(`   ✓ Unique labels: ${results.treeStats.uniqueLabels}`);
    console.log(`   ✓ Avg buttons/page: ${results.treeStats.avgButtonsPerPage.toFixed(1)}`);

    return tree;
  } catch (error) {
    console.error(`   ✗ Failed to load source file: ${error.message}`);
    results.errors.push({
      stage: 'source_load',
      error: error.message,
    });
    throw error;
  }
}

/**
 * Convert AACTree to a specific format
 */
async function convertToFormat(tree, formatConfig) {
  const outputPath = path.join(CONFIG.outputDir, CONFIG.outputBaseName + formatConfig.ext);
  const startTime = Date.now();

  console.log(`\n🔄 Converting to ${formatConfig.name}...`);
  console.log(`   Output: ${outputPath}`);

  const result = {
    format: formatConfig.name,
    extension: formatConfig.ext,
    outputPath: outputPath,
    success: false,
    duration: 0,
    outputSize: null,
    outputSizeFormatted: null,
    error: null,
  };

  try {
    // Create processor instance
    const processor = new formatConfig.processor();

    // Save tree to format
    processor.saveFromTree(tree, outputPath);

    // Check output file
    if (fsSync.existsSync(outputPath)) {
      const stats = await fs.stat(outputPath);
      result.outputSize = stats.size;
      result.outputSizeFormatted = formatFileSize(stats.size);
      result.success = true;

      console.log(`   ✓ Success!`);
      console.log(`   ✓ Output size: ${result.outputSizeFormatted}`);
    } else {
      throw new Error('Output file was not created');
    }
  } catch (error) {
    result.error = error.message;
    console.error(`   ✗ Failed: ${error.message}`);
    results.errors.push({
      stage: 'conversion',
      format: formatConfig.name,
      error: error.message,
    });
  } finally {
    result.duration = Date.now() - startTime;
    console.log(`   ⏱ Duration: ${result.duration}ms`);
  }

  return result;
}

/**
 * Generate conversion report
 */
async function generateReport() {
  console.log('\n📊 Generating conversion report...');

  const reportPath = path.join(CONFIG.outputDir, 'conversion_report.md');

  const successCount = results.conversions.filter(c => c.success).length;
  const failCount = results.conversions.filter(c => !c.success).length;
  const totalDuration = results.endTime - results.startTime;

  const report = `# Asterics Grid Conversion Report

Generated: ${new Date().toLocaleString()}

## Source File

- **Path**: \`${results.sourceFile}\`
- **Size**: ${results.sourceStats.sizeFormatted}
- **Modified**: ${results.sourceStats.modified.toLocaleString()}

## Source Content Statistics

- **Pages**: ${results.treeStats.pageCount}
- **Total Buttons**: ${results.treeStats.totalButtons}
- **Navigation Buttons**: ${results.treeStats.navigationButtons}
- **Speak Buttons**: ${results.treeStats.speakButtons}
- **Unique Labels**: ${results.treeStats.uniqueLabels}
- **Avg Buttons/Page**: ${results.treeStats.avgButtonsPerPage.toFixed(1)}

## Conversion Results

**Summary**: ${successCount} successful, ${failCount} failed out of ${results.conversions.length} formats

| Format | Extension | Status | Output Size | Duration | Output Path |
|--------|-----------|--------|-------------|----------|-------------|
${results.conversions.map(c => {
  const status = c.success ? '✅ Success' : '❌ Failed';
  const size = c.outputSizeFormatted || 'N/A';
  const duration = c.duration ? `${c.duration}ms` : 'N/A';
  const outputFile = c.success ? path.basename(c.outputPath) : 'N/A';
  return `| ${c.format} | \`${c.extension}\` | ${status} | ${size} | ${duration} | \`${outputFile}\` |`;
}).join('\n')}

## Total Processing Time

${(totalDuration / 1000).toFixed(2)} seconds

## Errors

${results.errors.length === 0 ? 'No errors encountered.' : results.errors.map((err, i) => {
  return `### Error ${i + 1}: ${err.stage}${err.format ? ` (${err.format})` : ''}

\`\`\`
${err.error}
\`\`\`
`;
}).join('\n')}

## Notes

### Format Compatibility

- **Grid3/Gridset**: Primary target format for Smartbox Grid 3. Full compatibility.
- **Snap/SPS**: Tobii Dynavox format. Audio support included.
- **TouchChat**: PRC-Saltillo format. Full SQLite database.
- **OBF/OBZ**: Open Board Format. Widely compatible across AAC apps.
- **OPML**: Hierarchical outline format. Good for structure analysis.
- **DOT**: Graphviz format. Excellent for visualization and documentation.
- **Apple Panels**: iOS accessibility format. For Apple devices.
- **Excel**: Analysis and documentation format. Great for vocabulary review.

### Known Limitations

1. **Audio**: Audio recordings are only preserved in formats that support them (Grid3, Snap, Asterics Grid).
2. **Styling**: Visual styling may be partially lost in formats with limited styling support (DOT, OPML).
3. **Grid Layout**: Grid positions may need adjustment in some formats due to different grid size constraints.
4. **Actions**: Complex actions may be simplified to closest equivalent in target format.

### Recommended Usage

- **For Grid 3 users**: Use \`.gridset\` format
- **For Tobii Dynavox users**: Use \`.spb\` format
- **For TouchChat users**: Use \`.ce\` format
- **For cross-platform compatibility**: Use \`.obz\` (OBF zipped) format
- **For documentation/analysis**: Use \`.xlsx\` (Excel) format
- **For visualization**: Use \`.dot\` format with Graphviz

## Files Generated

${results.conversions.filter(c => c.success).map(c => `- \`${path.basename(c.outputPath)}\``).join('\n')}
`;

  await fs.writeFile(reportPath, report, 'utf8');
  console.log(`   ✓ Report saved to: ${reportPath}`);

  return reportPath;
}

/**
 * Main conversion function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Asterics Grid Multi-Format Conversion Tool');
  console.log('═══════════════════════════════════════════════════════════\n');

  results.startTime = Date.now();

  try {
    // Create output directory
    await fs.mkdir(CONFIG.outputDir, { recursive: true });
    console.log(`✓ Output directory: ${CONFIG.outputDir}\n`);

    // Load source file
    const tree = await loadSourceFile();

    // Convert to all formats
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Starting Conversions');
    console.log('═══════════════════════════════════════════════════════════');

    for (const formatConfig of CONFIG.formats) {
      const result = await convertToFormat(tree, formatConfig);
      results.conversions.push(result);
    }

    results.endTime = Date.now();

    // Generate report
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════════');

    const reportPath = await generateReport();

    const successCount = results.conversions.filter(c => c.success).length;
    const failCount = results.conversions.filter(c => !c.success).length;

    console.log(`\n✅ Conversions successful: ${successCount}`);
    console.log(`❌ Conversions failed: ${failCount}`);
    console.log(`⏱  Total time: ${((results.endTime - results.startTime) / 1000).toFixed(2)}s`);
    console.log(`\n📄 Full report: ${reportPath}`);
    console.log(`📁 Output directory: ${CONFIG.outputDir}`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Conversion Complete!');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Exit with error code if any conversions failed
    if (failCount > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Conversion process failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, convertToFormat, loadSourceFile };

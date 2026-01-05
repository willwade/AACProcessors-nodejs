const { getProcessor, Analytics } = require('./dist/index.js');

const filePath = './tmp/vocal-flair-60.obz';

console.log('='.repeat(60));
console.log('Testing Vocal Flair 60 Analytics');
console.log('='.repeat(60));

async function test() {
  try {
    // Load the file
    const processor = getProcessor(filePath);
    const tree = processor.loadIntoTree(filePath);

    console.log('\n📁 File loaded successfully');
    console.log('   Total pages:', Object.keys(tree.pages).length);
    console.log('   Root page ID:', tree.rootId);
    console.log('   Format:', tree.metadata.format);

    // Find the home page
    const homePage = tree.pages[tree.rootId];
    if (homePage) {
      console.log('\n🏠 Home Page:', homePage.name);
      console.log('   Total buttons:', homePage.buttons.length);
      console.log('   Grid size:', homePage.grid.length, 'x', homePage.grid[0]?.length);

      // Calculate metrics with Direct Selection (default)
      console.log('\n' + '='.repeat(60));
      console.log('📊 ANALYSIS: Direct Selection (Touch/Pointing)');
      console.log('='.repeat(60));

      const calculator1 = new Analytics.MetricsCalculator();
      const metricsDirect = calculator1.analyze(tree);

      console.log('\nButton Efforts on Home Page:');
      console.log('-'.repeat(60));

      // Show first 20 buttons with their efforts
      const buttonsWithEffort = homePage.buttons
        .map(btn => ({
          label: btn.label,
          effort: metricsDirect.buttons.find(b => b.id === btn.id)?.effort || 0,
          position: homePage.grid.findIndex(row => row?.some(b => b?.id === btn.id))
        }))
        .filter(btn => btn.effort > 0)
        .slice(0, 20);

      buttonsWithEffort.forEach(btn => {
        const paddedLabel = btn.label.padEnd(15);
        const position = btn.position >= 0 ? `[${btn.position}]` : '[?]';
        console.log(`   ${paddedLabel} ${position} effort: ${btn.effort.toFixed(2)}`);
      });

      console.log('\n📈 Summary Statistics:');
      console.log('   Min effort:', Math.min(...buttonsWithEffort.map(b => b.effort)).toFixed(2));
      console.log('   Max effort:', Math.max(...buttonsWithEffort.map(b => b.effort)).toFixed(2));
      console.log('   Avg effort:', (buttonsWithEffort.reduce((sum, b) => sum + b.effort, 0) / buttonsWithEffort.length).toFixed(2));

      // Calculate with Switch Scanning for comparison
      console.log('\n' + '='.repeat(60));
      console.log('📊 ANALYSIS: Switch Scanning (Row-Column)');
      console.log('='.repeat(60));

      const scanningConfig = {
        type: 'row-column',
        rows: homePage.grid.length,
        columns: homePage.grid[0]?.length || 1,
      };

      const calculator2 = new Analytics.MetricsCalculator();
      const metricsScanning = calculator2.analyze(tree, { scanningConfig });

      console.log('\nButton Efforts on Home Page (Scanning):');
      console.log('-'.repeat(60));

      const buttonsWithScanningEffort = homePage.buttons
        .map(btn => ({
          label: btn.label,
          effort: metricsScanning.buttons.find(b => b.id === btn.id)?.effort || 0,
        }))
        .filter(btn => btn.effort > 0)
        .slice(0, 20);

      buttonsWithScanningEffort.forEach(btn => {
        const paddedLabel = btn.label.padEnd(15);
        console.log(`   ${paddedLabel} effort: ${btn.effort.toFixed(2)}`);
      });

      console.log('\n📈 Summary Statistics (Scanning):');
      console.log('   Min effort:', Math.min(...buttonsWithScanningEffort.map(b => b.effort)).toFixed(2));
      console.log('   Max effort:', Math.max(...buttonsWithScanningEffort.map(b => b.effort)).toFixed(2));
      console.log('   Avg effort:', (buttonsWithScanningEffort.reduce((sum, b) => sum + b.effort, 0) / buttonsWithScanningEffort.length).toFixed(2));

      // Check metadata
      console.log('\n' + '='.repeat(60));
      console.log('📋 METADATA');
      console.log('='.repeat(60));
      console.log('   Format:', tree.metadata.format);
      console.log('   Name:', tree.metadata.name);
      console.log('   Locale:', tree.metadata.locale);
      console.log('   Description:', tree.metadata.description?.substring(0, 80) + '...');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

test();

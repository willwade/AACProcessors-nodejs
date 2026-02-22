# AAC Scanning Metrics Guide

This guide explains how scanning metrics work in AAC systems and how to use them across Grid 3, TD Snap, and TouchChat platforms.

## 🎯 What is Scanning?

Scanning is an access method for AAC systems where items are highlighted sequentially, and the user activates a switch to select the desired item. There are several scanning strategies:

### Linear Scanning
- Items are highlighted one at a time in sequence
- Typically follows a predictable pattern (left-to-right, top-to-bottom)
- All items are in a single scan group

### Block/Group Scanning
- Items are highlighted in groups (blocks)
- User selects a group first, then selects an item within that group
- Reduces the number of switch activations required
- Common configurations: 2x2 blocks, row-column scanning, column-row scanning

---

## 📊 How Scanning Metrics Are Calculated

### Visual Scan Effort

The visual scan effort represents the number of items a user must scan through before reaching their target. The calculation differs based on whether block scanning is enabled.

#### Linear Scanning (blockScanEnabled = false)

When block scanning is disabled, every button is scanned individually:

```
Visual Scan Effort = Number of buttons before the target button
```

For a 3x3 grid with the target at position (2, 1):
```
[1] [2] [3]
[4] [X] [6]
[7] [8] [9]
```
Visual Scan Effort = 4 (user scans buttons 1, 2, 3, 4 before reaching X)

#### Block Scanning (blockScanEnabled = true)

When block scanning is enabled, buttons in the same scan block highlight together:

```
Visual Scan Effort = Number of unique scan blocks before the target button's scan block
```

For a 3x3 grid with row-column scanning:
```
[Block 1] [Block 1] [Block 1]
[Block 2] [Block 2] [Block 2]
[Block 3] [Block 3] [Block 3]
```

If target is in Block 2:
Visual Scan Effort = 1 (only Block 1 is scanned before Block 2)

### Scan Block Configuration

Scan blocks are numbered 1-8 and define which buttons highlight together:

- **scanBlock = 1**: First group to highlight
- **scanBlock = 2**: Second group to highlight
- **scanBlock = 3-8**: Additional groups
- **scanBlock = undefined**: Button not part of any scan group (or linear scanning)

---

## 🔧 Platform-Specific Implementation

### Grid 3 (.gridset files)

**Scanning Model**: Per-button attribute

Grid 3 stores scan block information directly on each button in the XML:

```xml
<button>
  <label>Yes</label>
  <scanBlock>1</scanBlock>
</button>
<button>
  <label>No</label>
  <scanBlock>2</scanBlock>
</button>
```

**Key Features**:
- Scan blocks: 1-8 (hard limit)
- Storage: `@ScanBlock` attribute on cell XML
- Granularity: Button-level
- Easy to extract: Direct attribute read

**Usage**:
```typescript
import { GridsetProcessor, Analytics } from '@willwade/aac-processors';

const processor = new GridsetProcessor();
const tree = await processor.loadIntoTree('my_file.gridset');

// Scan blocks are automatically extracted from @ScanBlock attribute
const result = new Analytics.MetricsCalculator().analyze(tree);

// Check scan block distribution
const scanBlockCounts = {};
Object.values(tree.pages).forEach(page => {
  page.buttons.forEach(btn => {
    if (btn.scanBlock) {
      scanBlockCounts[btn.scanBlock] = (scanBlockCounts[btn.scanBlock] || 0) + 1;
    }
  });
});
console.log('Scan block distribution:', scanBlockCounts);
```

**Example**:
For a Grid 3 file with row-column scanning:
- Row 1 buttons: `scanBlock = 1`
- Row 2 buttons: `scanBlock = 2`
- Row 3 buttons: `scanBlock = 3`

---

### TD Snap (.pageSet / .spb files)

**Scanning Model**: Position-based ScanGroups

TD Snap uses a completely different approach with ScanGroups stored in the SQLite database:

```
Database Structure:
┌─────────────────────────────────────────────────────────────┐
│ ScanGroup Table                                              │
│   Id: 2913                                                   │
│   PageLayoutId: 138                                          │
│   SerializedGridPositions: [{"Column":0,"Row":0},{"Column":1,"Row":0}]│
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Scan blocks: Unlimited (7,233+ groups in some files)
- Storage: SQLite database, `SerializedGridPositions` JSON array
- Granularity: Position-level (group contains positions)
- Configuration: In TD Snap app, saved to database
- Multiple PageLayouts: Each page can have multiple layouts (4x3, 6x7, 8x9, 10x8)

**PageLayout Selection**:

Since TD Snap pages can have multiple layouts, you can specify which layout to use:

```typescript
import { SnapProcessor, Analytics } from '@willwade/aac-processors';

// Option 1: Default - prefer largest layout with scanning enabled
const processor = new SnapProcessor();
const tree = await processor.loadIntoTree('Core First Scanning.sps');

// Option 2: Specify layout preference
const processor = new SnapProcessor(null, {
  pageLayoutPreference: 'scanning'  // Default: largest layout with ScanGroups
  // Other options:
  // 'largest' - largest grid size (10x8, 8x9, etc.)
  // 'smallest' - smallest grid size
  // 68816 - specific PageLayoutId
});

const result = new Analytics.MetricsCalculator().analyze(tree);
```

**How Scan Blocks Are Mapped**:

1. Load ScanGroups from database, grouped by PageLayoutId
2. For each ScanGroup, assign scan block number based on its index:
   - First ScanGroup (index 0) → scanBlock 1
   - Second ScanGroup (index 1) → scanBlock 2
   - etc.
3. For each button, find which ScanGroup contains its (x, y) position
4. Assign the corresponding scanBlock number

**Example**:
```
PageLayoutId 68816 (8x9 layout with scanning):
  ScanGroup 2913 (index 0): positions [(0,0), (0,1), (0,2), (1,5), (1,4), (1,3), (1,2), ...]
    → scanBlock = 1

  ScanGroup 2914 (index 1): positions [(2,0), (3,0), (3,1), (3,2), ...]
    → scanBlock = 2

Buttons at positions in ScanGroup 2913 get scanBlock = 1:
  "I" at (0,0) → scanBlock: 1
  "you" at (0,1) → scanBlock: 1
  "it" at (0,2) → scanBlock: 1
```

**Special Features**:
- **"Not scan top bar"**: Toolbar has separate ScanOrder from main grid
- **"Not scan empty buttons"**: Positions where Visible=0 are skipped
- **Multiple ScanOrders**: Toolbar (ScanOrder 1), Pages (ScanOrder 2), MessageBar (ScanOrder 3)

**Checking Scan Block Distribution**:
```typescript
// After loading, check which layout was selected
const coreWordsPage = tree.getPage('0219f681-1069-4296-be42-790ee828a7b4');
const scanBlockCounts = {};
coreWordsPage.buttons.forEach(btn => {
  const block = btn.scanBlock || 'none';
  scanBlockCounts[block] = (scanBlockCounts[block] || 0) + 1;
});
console.log('Core Words scan blocks:', scanBlockCounts);
// Output: { '1': 12, '2': 12, '3': 12, '4': 9, '5': 6, '6': 9, '7': 12, 'none': 12 }
```

---

### TouchChat (.zip files)

**Scanning Model**: Runtime-only, no file-based configuration

**Key Features**:
- **No scan blocks in files**: TouchChat does NOT store scan block information in the backup file
- **Runtime scanning**: Scanning patterns are applied by the app at runtime
- **Patterns**:
  - **Linear/Sequential**: Scan all buttons in order
  - **Row-Column**: Scan rows first, then items within selected row
  - **Column-Row**: Scan columns first, then items within selected column

**Usage**:
```typescript
import { TouchChatProcessor, Analytics } from '@willwade/aac-processors';

const processor = new TouchChatProcessor();
const tree = await processor.loadIntoTree('TouchChatBackup.zip');

// All buttons have scanBlock = 1 (linear scanning)
// Or scanBlock = undefined (no grouping)
const result = new Analytics.MetricsCalculator().analyze(tree);
```

**Note**: TouchChat scan block extraction always returns `scanBlock = undefined` or `scanBlock = 1` because the scanning configuration is not stored in the file. To analyze TouchChat files with scanning metrics, you would need to:

1. Know the user's runtime scanning pattern (linear, row-column, etc.)
2. Manually assign scan blocks based on button positions
3. Or use linear scanning (all buttons in one group)

**Example**:
```typescript
// Manually configure row-column scanning for a TouchChat page
const page = tree.getPage('page_id');
const grid = page.grid; // 6x6 grid

// Assign row-based scan blocks
for (let row = 0; row < grid.length; row++) {
  for (let col = 0; col < grid[row].length; col++) {
    const button = grid[row][col];
    if (button) {
      button.scanBlock = row + 1; // Row 0 → block 1, Row 1 → block 2, etc.
    }
  }
}
```

---

## 📈 Using Scanning Metrics in Analysis

### Enabling Block Scanning in MetricsCalculator

The `MetricsCalculator` supports block scanning through the scanning configuration:

```typescript
import { Analytics } from '@willwade/aac-processors';

const calculator = new Analytics.MetricsCalculator();

// Analyze with block scanning enabled
const result = calculator.analyze(tree, {
  scanningConfig: {
    blockScanEnabled: true,  // Use scan blocks for effort calculation
    cellScanningOrder: Analytics.CellScanningOrder.RowColumnScan,
  }
});

// Result includes visual scan effort based on scan blocks
console.log('Total visual scan effort:', result.total_visual_scan_effort);
```

### Analyzing Test Sentences

To measure scanning effort for specific phrases:

```typescript
import { SnapProcessor, Analytics } from '@willwade/aac-processors';

const processor = new SnapProcessor(null, {
  pageLayoutPreference: 'scanning'  // Use scanning layout
});
const tree = await processor.loadIntoTree('Core First Scanning.sps');

// Set root page for multi-vocab pagesets
tree.rootId = '0219f681-1069-4296-be42-790ee828a7b4'; // Core Words

const calculator = new Analytics.MetricsCalculator();
const result = calculator.analyze(tree, {
  testSentences: ['I like to be here with you'],
  scanningConfig: {
    blockScanEnabled: true,
  }
});

// Check visual scan effort for each word
result.buttons.forEach(btn => {
  console.log(`${btn.word}: Visual Scan Effort = ${btn.visual_scan_effort}`);
});
```

### Comparing Scanning vs. Direct Selection

```typescript
// Analyze with linear scanning (no blocks)
const linearResult = calculator.analyze(tree, {
  scanningConfig: {
    blockScanEnabled: false,
  }
});

// Analyze with block scanning
const blockResult = calculator.analyze(tree, {
  scanningConfig: {
    blockScanEnabled: true,
  }
});

console.log('Linear scanning effort:', linearResult.total_visual_scan_effort);
console.log('Block scanning effort:', blockResult.total_visual_scan_effort);
console.log('Effort reduction:', linearResult.total_visual_scan_effort - blockResult.total_visual_scan_effort);
```

---

## 🔄 Platform Comparison

| Feature | Grid 3 | TD Snap | TouchChat |
|---------|--------|---------|-----------|
| **Scan Block Storage** | Per-button XML attribute | Position-based database groups | Runtime only |
| **Format** | `@ScanBlock` integer (1-8) | `SerializedGridPositions` JSON | N/A |
| **Granularity** | Button level | Position level | N/A |
| **Block Limit** | 1-8 blocks | Unlimited | N/A |
| **Configuration** | In Grid Builder, saved to file | In TD Snap app, saved to DB | In app, runtime only |
| **Multiple Layouts** | No | Yes (multiple per page) | No |
| **Extraction** | Direct attribute read | Position matching | Not available |
| **Default Setting** | `scanBlock = 1` | Based on ScanGroup index | Linear scanning |

---

## 💡 Best Practices

### 1. Choose the Right PageLayout for TD Snap

For scanning analysis, always use the `scanning` preference:

```typescript
const processor = new SnapProcessor(null, {
  pageLayoutPreference: 'scanning'  // Best for metrics
});
```

This ensures you're using the largest layout with scanning groups configured.

### 2. Verify Scan Block Extraction

After loading a file, verify that scan blocks were extracted correctly:

```typescript
// Grid 3 or TD Snap
Object.values(tree.pages).forEach(page => {
  const buttonsWithBlocks = page.buttons.filter(b => b.scanBlock && b.scanBlock > 1);
  if (buttonsWithBlocks.length > 0) {
    console.log(`Page "${page.name}": ${buttonsWithBlocks.length} buttons with scan blocks`);
  }
});
```

### 3. Handle Multi-Vocab Pagesets

For TD Snap files with multiple vocabularies, set the root page:

```typescript
tree.rootId = '0219f681-1069-4296-be42-790ee828a7b4'; // Core Words
```

This ensures the analyzer uses the correct vocabulary branch.

### 4. Compare Scan Strategies

For research or comparison, analyze the same file with different scanning configurations:

```typescript
const strategies = [
  { blockScanEnabled: false, name: 'Linear' },
  { blockScanEnabled: true, cellScanningOrder: CellScanningOrder.RowColumnScan, name: 'Row-Column' },
  { blockScanEnabled: true, cellScanningOrder: CellScanningOrder.ColumnRowScan, name: 'Column-Row' },
];

strategies.forEach(strategy => {
  const result = calculator.analyze(tree, {
    scanningConfig: strategy
  });
  console.log(`${strategy.name}: ${result.total_visual_scan_effort}`);
});
```

---

## 📚 Additional Resources

- [AAC_METRICS_GUIDE.md](./AAC_METRICS_GUIDE.md) - General metrics guide
- [VOCABULARY_ANALYSIS_GUIDE.md](./VOCABULARY_ANALYSIS_GUIDE.md) - Motor planning and test sentences
- [ALGORITHM_IMPLEMENTATION_NOTES.md](./ALGORITHM_IMPLEMENTATION_NOTES.md) - Technical implementation details

---

## 🎓 Summary

- **Grid 3**: Simple per-button scan block attribute (1-8)
- **TD Snap**: Complex position-based ScanGroups, requires PageLayout selection
- **TouchChat**: No file-based scan blocks, runtime scanning only

For scanning metrics analysis:
1. Use `pageLayoutPreference: 'scanning'` for TD Snap
2. Enable `blockScanEnabled: true` in scanning config
3. Verify scan block extraction after loading
4. Set `rootId` for multi-vocab pagesets

The scanning metrics implementation allows you to accurately measure and compare the effort required for different scanning configurations across all major AAC platforms.

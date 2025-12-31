# AAC Effort Metrics - User Guide

This guide explains the basics of the AAC Effort Algorithm and how to use the TypeScript implementation provided in this repository.

## 🧠 The AAC Effort Algorithm

The AAC Effort Algorithm measures the physical and cognitive "cost" of activating buttons in an AAC (Augmentative and Alternative Communication) system. It combines multiple factors into a single "effort score" for each word or phrase.

### Core Metrics

1.  **Button Size Effort**: Calculated from grid dimensions. Larger grids (smaller buttons) require more effort to discriminate and target.
2.  **Field Size Effort**: Based on the number of visible buttons. More choices increase visual clutter and cognitive load.
3.  **Visual Scan Effort**: The time/effort taken to scan through buttons in a grid (usually left-to-right, top-to-bottom) before reaching the target.
4.  **Distance Effort**: The physical distance between the previous button (or the "home" position) and the current target.
5.  **Prior Effort (Navigation Cost)**: Every time a board changes (folder selection), a "Processing Effort" penalty (default: 1.0) is added, representing the cognitive cost of orienting to a new screen.

### Motor Planning Discounts

The algorithm rewards systems that support motor planning. If a button appears in a predictable location or follows a recognizable pattern, its effort is discounted:

- **Clones**: Exact copies of buttons in the same location across boards.
- **Semantic Locations**: Patterns where types of words (e.g., verbs, colors) always appear in the same grid area.
- **Upstream Matching**: If the button used to _enter_ a board matches the ID of a button _on_ that board, the effort is reduced.

### Switch Scanning Support

For users who use scanning access methods, the implementation supports evaluating scanning effort. Instead of movement distance, the algorithm calculates:
1.  **Scan Steps**: The number of highlight movements (items or groups) to reach the target.
2.  **Selections**: The number of switch activations required.

Supported scanning types include `linear`, `row-column`, `column-row`, and `block-based` scanning across Grid 3, TD Snap, and TouchChat.

> 📖 **Detailed Guide**: For comprehensive information on scanning metrics across different platforms, see [SCANNING_METRICS_GUIDE.md](./SCANNING_METRICS_GUIDE.md).

---

## 💻 How to Use the Code

### 1. Basic Usage (Multi-Format Support)

The `MetricsCalculator` is format-agnostic. You can use any processor to load a pageset into an `AACTree`, then pass that tree to the calculator.

#### Loading an OBFSET
```typescript
import { ObfsetProcessor, Analytics } from '@willwade/aac-processors';

const processor = new ObfsetProcessor();
const tree = processor.loadIntoTree('set.obfset');
const result = new Analytics.MetricsCalculator().analyze(tree);
```

#### Loading Grid 3 (.gridset)
```typescript
import { GridsetProcessor, Analytics } from '@willwade/aac-processors';

const processor = new GridsetProcessor();
const tree = processor.loadIntoTree('my_file.gridset');
const result = new Analytics.MetricsCalculator().analyze(tree);
```

#### Loading Snap (.pageSet / .spb)
```typescript
import { SnapProcessor, Analytics } from '@willwade/aac-processors';

const processor = new SnapProcessor();
const tree = processor.loadIntoTree('SnapBackup.pageSet');
const result = new Analytics.MetricsCalculator().analyze(tree);
```

#### Loading TouchChat (.zip)
```typescript
import { TouchChatProcessor, Analytics } from '@willwade/aac-processors';

const processor = new TouchChatProcessor();
const tree = processor.loadIntoTree('TouchChatBackup.zip');
const result = new Analytics.MetricsCalculator().analyze(tree);
```

### 2. Result Structure

The `analyze` function returns:

- `total_words`: Number of unique vocalizations found.
- `total_buttons`: Total number of button activations analyzed.
- `buttons`: An array of `ButtonMetrics` for each word (taking the minimum effort path found).
- `levels`: An object grouping buttons by their depth (e.g., Level 0 = home screen).

### 3. Requirements

- **Supported Formats**: Any format with a corresponding processor (`.obf`, `.obz`, `.obfset`, `.gridset`, `.pageSet`, `.spb`, `.zip` for TouchChat, etc.).
- **Metadata**: For best accuracy, buttons should include `clone_id` or `semantic_id`. For scanning analysis, pages should have a `scanType` and buttons should have `scanBlocks` assigned.

### 4. Configuring Scanning

You can evaluate scanning efficiency by setting the `scanType` on `AACPage` objects:

```typescript
import { AACScanType } from '@willwade/aac-processors';

// Set scanning behavior for a page
page.scanType = AACScanType.ROW_COLUMN; 

// Or using blocks
page.scanType = AACScanType.BLOCK_ROW_COLUMN;
page.scanBlocksConfig = [
  { id: 1, name: 'Main', order: 1 },
  { id: 2, name: 'Numbers', order: 2 }
];

// Assign buttons to blocks
button.scanBlocks = [2]; 
```

---

## ⚖️ Implementation vs. Original Algorithm

This version is optimized for Node.js and adheres strictly to the **v0.2 Algorithm Specification**.

- **Accuracy**: Achieving ~95%+ parity with original benchmarking tools.
- **Efficiency**: Uses a modified Breadth-First Search (BFS) to find the most efficient user path to any word.
- **Improved Logic**: Resolves "double-discounting" issues present in legacy implementations, favoring a more realistic motor-planning model.

For detailed technical notes on implementation decisions, see [ALGORITHM_IMPLEMENTATION_NOTES.md](./ALGORITHM_IMPLEMENTATION_NOTES.md).

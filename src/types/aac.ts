// Import semantic action types from core
import { AACSemanticAction } from '../core/treeStructure';

/**
 * Scanning selection methods for switch access
 * Determines how the scanning advances through items
 */
export enum ScanningSelectionMethod {
  /** Automatically advance through items at timed intervals (1 Switch) */
  AutoScan = 'AutoScan',
  /** Automatic scanning with overscan (two-stage scanning) */
  AutoScanWithOverscan = 'AutoScanWithOverscan',
  /** Hold switch to advance, release to select */
  HoldToAdvance = 'HoldToAdvance',
  /** Hold to advance with overscan */
  HoldToAdvanceWithOverscan = 'HoldToAdvanceWithOverscan',
  /** Tap switch to advance, tap again to select (Automatic) */
  TapToAdvance = 'TapToAdvance',
  /** Tap switch to advance, another switch to select (2 Switch Step Scan) */
  StepScan2Switch = 'StepScan2Switch',
  /** Tap switch 1 to advance, tap switch 1 again to select (1 Switch Step Scan) */
  StepScan1Switch = 'StepScan1Switch',
}

/**
 * Cell scanning order patterns
 * Determines the sequence in which cells are highlighted
 */
export enum CellScanningOrder {
  /** Simple linear scan across rows (left-to-right, top-to-bottom) */
  SimpleScan = 'SimpleScan',
  /** Simple linear scan down columns (top-to-bottom, left-to-right) */
  SimpleScanColumnsFirst = 'SimpleScanColumnsFirst',
  /** Row-group scanning: highlight rows first, then cells within selected row */
  RowColumnScan = 'RowColumnScan',
  /** Column-group scanning: highlight columns first, then cells within selected column */
  ColumnRowScan = 'ColumnRowScan',
}

/**
 * Scanning configuration for a page or pageset
 * Controls how switch scanning operates
 */
export interface ScanningConfig {
  /** Method for advancing through items */
  selectionMethod?: ScanningSelectionMethod;
  /** Order in which cells are scanned */
  cellScanningOrder?: CellScanningOrder;
  /** Whether block scanning is enabled (group cells by scanBlock number) */
  blockScanEnabled?: boolean;
  /** Whether to include the workspace/message bar in scanning */
  scanWorkspace?: boolean;
  /** Time in milliseconds to highlight each item */
  forwardScanSpeed?: number;
  /** Time in milliseconds to wait before auto-accepting selection */
  dwellTime?: number;
  /** How the selection is accepted */
  acceptScanMethod?: 'Switch' | 'Timeout' | 'Hold';
  /** Whether to factor in error correction effort (e.g., missed hits) */
  errorCorrectionEnabled?: boolean;
  /** Maximum number of loops before the scan times out */
  maxLoops?: number;
  /** Estimated probability of missing a target (0.0 to 1.0) */
  errorRate?: number;
}

export interface AACStyle {
  backgroundColor?: string;
  fontColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textUnderline?: boolean;
  labelOnTop?: boolean;
  transparent?: boolean;
}

export interface AACButton {
  id: string;
  label: string;
  message: string;
  semanticAction?: AACSemanticAction;
  targetPageId?: string;
  style?: AACStyle;
  audioRecording?: {
    id?: number;
    data?: Buffer;
    identifier?: string;
    metadata?: string;
  };
  // Extended properties for advanced platforms
  contentType?: 'Normal' | 'AutoContent' | 'Workspace' | 'LiveCell';
  contentSubType?: string;
  image?: string;
  resolvedImageEntry?: string; // normalized zip path to resolved image, if present
  symbolLibrary?: string;
  symbolPath?: string;
  x?: number;
  y?: number;
  columnSpan?: number;
  rowSpan?: number;
  /**
   * Scan block number (1-8) for block scanning
   * Buttons with the same scanBlock number are highlighted together
   * @deprecated Use scanBlock instead (singular, not array)
   */
  scanBlocks?: number[];
  /**
   * Scan block number (1-8) for block scanning
   * Buttons with the same scanBlock number are highlighted together
   * Reduces scanning effort by grouping buttons
   */
  scanBlock?: number;
  visibility?: 'Visible' | 'Hidden' | 'Disabled' | 'PointerAndTouchOnly' | 'Empty';
  directActivate?: boolean;
  audioDescription?: string;
  parameters?: { [key: string]: any };
  // Metrics support: Motor planning identifiers
  semantic_id?: string; // Unique ID for buttons with same semantic meaning across boards
  clone_id?: string; // Unique ID for buttons with same label+location across boards
}

export interface AACPage {
  id: string;
  name: string;
  grid: Array<Array<AACButton | null>>;
  buttons: AACButton[];
  parentId: string | null;
  style?: AACStyle;
  locale?: string;
  descriptionHtml?: string;
  images?: any[];
  sounds?: any[];
  // Metrics support: Track semantic/clone IDs used on this page
  semantic_ids?: string[];
  clone_ids?: string[];
  // Scanning configuration for this page
  scanningConfig?: ScanningConfig;
  scanBlocksConfig?: any[];
}

export interface AACTree {
  pages: { [key: string]: AACPage };
  addPage(page: AACPage): void;
  getPage(id: string): AACPage | undefined;
}

export interface AACProcessor {
  extractTexts(filePath: string): string[];
  loadIntoTree(filePath: string): AACTree;
}

// Import semantic action types from core
import { AACSemanticAction } from '../core/treeStructure';

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
  scanBlocks?: number[];
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

import {
  AACButton as IAACButton,
  AACPage as IAACPage,
  AACTree as IAACTree,
  AACStyle,
} from '../types/aac';

// Semantic action categories for cross-platform compatibility
export enum AACSemanticCategory {
  COMMUNICATION = 'communication', // Speech, text output
  NAVIGATION = 'navigation', // Page/grid navigation
  TEXT_EDITING = 'text_editing', // Text manipulation
  SYSTEM_CONTROL = 'system_control', // Device/app control
  MEDIA = 'media', // Audio/video playback
  ACCESSIBILITY = 'accessibility', // Switch scanning, etc.
  CUSTOM = 'custom', // Platform-specific extensions
}

// Semantic intents within each category
export enum AACSemanticIntent {
  // Communication
  SPEAK_TEXT = 'SPEAK_TEXT',
  SPEAK_IMMEDIATE = 'SPEAK_IMMEDIATE',
  STOP_SPEECH = 'STOP_SPEECH',
  INSERT_TEXT = 'INSERT_TEXT',

  // Navigation
  NAVIGATE_TO = 'NAVIGATE_TO',
  GO_BACK = 'GO_BACK',
  GO_HOME = 'GO_HOME',

  // Text Editing
  DELETE_WORD = 'DELETE_WORD',
  DELETE_CHARACTER = 'DELETE_CHARACTER',
  CLEAR_TEXT = 'CLEAR_TEXT',
  COPY_TEXT = 'COPY_TEXT',
  PASTE_TEXT = 'PASTE_TEXT',

  // System Control
  SEND_KEYS = 'SEND_KEYS',
  MOUSE_CLICK = 'MOUSE_CLICK',

  // Media
  PLAY_SOUND = 'PLAY_SOUND',
  PLAY_VIDEO = 'PLAY_VIDEO',

  // Accessibility
  SCAN_NEXT = 'SCAN_NEXT',
  SCAN_SELECT = 'SCAN_SELECT',

  // Custom
  PLATFORM_SPECIFIC = 'PLATFORM_SPECIFIC',
}

// New semantic action interface for cross-platform compatibility
export interface AACSemanticAction {
  // Make category optional for backward-compat with older tests constructing minimal actions
  category?: AACSemanticCategory;
  intent: AACSemanticIntent | string;

  // Core parameters that most platforms understand
  text?: string; // Text content
  targetId?: string; // Navigation target
  audioData?: Buffer; // Audio content

  // Rich content for advanced platforms
  richText?: {
    text: string;
    symbols?: Array<{ text: string; image?: string }>;
    grammar?: {
      partOfSpeech?: string;
      person?: string;
      number?: string;
      verbState?: string;
    };
  };

  // Generic parameters bag for compatibility with older tests
  parameters?: { [key: string]: any };

  // Platform-specific extensions
  platformData?: {
    grid3?: {
      commandId: string;
      parameters: { [key: string]: any };
    };
    astericsGrid?: {
      modelName: string;
      properties: { [key: string]: any };
    };
    touchChat?: {
      actionCode: number;
      actionData: string;
    };
    snap?: {
      navigatePageId?: number;
      elementReferenceId?: number;
    };
    applePanels?: {
      actionType: string;
      parameters: { [key: string]: any };
    };
  };

  // Fallback for unknown platforms
  fallback?: {
    type: 'SPEAK' | 'NAVIGATE' | 'ACTION';
    message?: string;
    targetPageId?: string;
  };
}

export class AACButton implements IAACButton {
  id: string;
  label: string;
  message: string;

  // Semantic action system
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

  constructor({
    id,
    label = '',
    message = '',
    targetPageId,
    semanticAction,
    audioRecording,
    style,
    contentType,
    contentSubType,
    image,
    resolvedImageEntry,
    x,
    y,
    columnSpan,
    rowSpan,
    scanBlocks,
    visibility,
    directActivate,
    parameters,
    // Legacy input support
    type,
    action,
  }: {
    id: string;
    label?: string;
    message?: string;
    targetPageId?: string;
    semanticAction?: AACSemanticAction;
    audioRecording?: {
      id?: number;
      data?: Buffer;
      identifier?: string;
      metadata?: string;
    };
    style?: AACStyle;
    contentType?: 'Normal' | 'AutoContent' | 'Workspace' | 'LiveCell';
    contentSubType?: string;
    image?: string;
    resolvedImageEntry?: string;
    x?: number;
    y?: number;
    columnSpan?: number;
    rowSpan?: number;
    scanBlocks?: number[];
    visibility?: 'Visible' | 'Hidden' | 'Disabled' | 'PointerAndTouchOnly' | 'Empty';
    directActivate?: boolean;
    parameters?: { [key: string]: any };
    // Legacy constructor properties for backward compatibility
    type?: 'SPEAK' | 'NAVIGATE' | 'ACTION';
    action?: {
      type: 'SPEAK' | 'NAVIGATE' | 'ACTION';
      targetPageId?: string;
      message?: string;
    } | null;
  }) {
    this.id = id;
    this.label = label;
    this.message = message;
    this.targetPageId = targetPageId;
    this.semanticAction = semanticAction;
    this.audioRecording = audioRecording;
    this.style = style;
    this.contentType = contentType;
    this.contentSubType = contentSubType;
    this.image = image;
    this.resolvedImageEntry = resolvedImageEntry;
    this.x = x;
    this.y = y;
    this.columnSpan = columnSpan;
    this.rowSpan = rowSpan;
    this.scanBlocks = scanBlocks;
    this.visibility = visibility;
    this.directActivate = directActivate;
    this.parameters = parameters;

    // Legacy mapping: if no semanticAction provided, derive from legacy `action` first
    if (!this.semanticAction && action) {
      if (action.type === 'NAVIGATE' && (action.targetPageId || this.targetPageId)) {
        if (!this.targetPageId) this.targetPageId = action.targetPageId;
        this.semanticAction = {
          category: AACSemanticCategory.NAVIGATION,
          intent: AACSemanticIntent.NAVIGATE_TO,
          targetId: this.targetPageId,
          fallback: { type: 'NAVIGATE', targetPageId: this.targetPageId },
        };
      } else if (action.type === 'SPEAK') {
        const text = action.message || this.message || this.label || '';
        if (!this.message) this.message = text;
        this.semanticAction = {
          category: AACSemanticCategory.COMMUNICATION,
          intent: AACSemanticIntent.SPEAK_TEXT,
          text,
          fallback: { type: 'SPEAK', message: text },
        };
      } else {
        this.semanticAction = {
          category: AACSemanticCategory.SYSTEM_CONTROL,
          intent: AACSemanticIntent.PLATFORM_SPECIFIC,
          fallback: { type: 'ACTION' },
        };
      }
    }

    // Legacy mapping: if still no semanticAction and `type` provided
    if (!this.semanticAction && type) {
      if (type === 'NAVIGATE' && this.targetPageId) {
        this.semanticAction = {
          category: AACSemanticCategory.NAVIGATION,
          intent: AACSemanticIntent.NAVIGATE_TO,
          targetId: this.targetPageId,
          fallback: { type: 'NAVIGATE', targetPageId: this.targetPageId },
        };
      } else if (type === 'SPEAK') {
        const text = this.message || this.label || '';
        this.semanticAction = {
          category: AACSemanticCategory.COMMUNICATION,
          intent: AACSemanticIntent.SPEAK_TEXT,
          text,
          fallback: { type: 'SPEAK', message: text },
        };
      } else {
        this.semanticAction = {
          category: AACSemanticCategory.SYSTEM_CONTROL,
          intent: AACSemanticIntent.PLATFORM_SPECIFIC,
          fallback: { type: 'ACTION' },
        };
      }
    }
  }

  // Legacy compatibility properties
  get type(): 'SPEAK' | 'NAVIGATE' | 'ACTION' | undefined {
    if (this.semanticAction) {
      const i = String(this.semanticAction.intent);
      if (i === 'NAVIGATE_TO') return 'NAVIGATE';
      if (i === 'SPEAK_TEXT' || i === 'SPEAK_IMMEDIATE') return 'SPEAK';
      return 'ACTION';
    }
    if (this.targetPageId) return 'NAVIGATE';
    if (this.message) return 'SPEAK';
    return 'SPEAK';
  }

  get action(): {
    type: 'SPEAK' | 'NAVIGATE' | 'ACTION';
    targetPageId?: string;
    message?: string;
  } | null {
    const t = this.type;
    if (!t) return null;
    if (t === 'SPEAK' && !this.message && !this.label && !this.semanticAction) {
      return null;
    }
    return { type: t, targetPageId: this.targetPageId, message: this.message };
  }
}

export class AACPage implements IAACPage {
  id: string;
  name: string;
  grid: Array<Array<AACButton | null>>;
  buttons: AACButton[];
  parentId: string | null;
  style?: AACStyle;

  constructor({
    id,
    name = '',
    grid = [],
    buttons = [],
    parentId = null,
    style,
  }: {
    id: string;
    name?: string;
    grid?: Array<Array<AACButton | null>> | { columns: number; rows: number };
    buttons?: AACButton[];
    parentId?: string | null;
    style?: AACStyle;
  }) {
    this.id = id;
    this.name = name;
    if (Array.isArray(grid)) {
      this.grid = grid;
    } else if (grid && typeof grid === 'object' && 'columns' in grid && 'rows' in grid) {
      const cols = (grid as any).columns as number;
      const rows = (grid as any).rows as number;
      this.grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
    } else {
      this.grid = [];
    }
    this.buttons = buttons;
    this.parentId = parentId;
    this.style = style;
  }

  addButton(button: AACButton): void {
    this.buttons.push(button);
  }
}

export class AACTree implements IAACTree {
  pages: { [key: string]: AACPage };
  private _rootId: string | null;

  public get rootId(): string | null {
    return this._rootId;
  }
  public set rootId(id: string | null) {
    this._rootId = id;
  }

  constructor() {
    this.pages = {};
    this._rootId = null;
  }

  addPage(page: AACPage): void {
    this.pages[page.id] = page;
    if (!this._rootId) this._rootId = page.id;
  }

  getPage(id: string): AACPage | undefined {
    return this.pages[id];
  }

  traverse(callback: (page: AACPage) => void): void {
    const queue: string[] = Object.keys(this.pages);
    const visited = new Set<string>();

    while (queue.length > 0) {
      const id = queue.shift();
      if (!id || visited.has(id)) continue;
      visited.add(id);

      const page = this.pages[id];
      if (page) {
        callback(page);
        // Add child pages to queue
        page.buttons
          .filter((b) => {
            const i = String(b.semanticAction?.intent);
            return i === 'NAVIGATE_TO' || !!b.semanticAction?.targetId || !!b.targetPageId;
          })
          .forEach((b) => {
            const target = b.semanticAction?.targetId || b.targetPageId;
            if (target) queue.push(target);
          });
      }
    }
  }
}

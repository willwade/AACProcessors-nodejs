import {
  AACButton as IAACButton,
  AACPage as IAACPage,
  AACTree as IAACTree,
  AACStyle,
} from "../types/aac";

// Semantic action categories for cross-platform compatibility
export enum AACSemanticCategory {
  COMMUNICATION = "communication",    // Speech, text output
  NAVIGATION = "navigation",         // Page/grid navigation
  TEXT_EDITING = "text_editing",     // Text manipulation
  SYSTEM_CONTROL = "system_control", // Device/app control
  MEDIA = "media",                   // Audio/video playback
  ACCESSIBILITY = "accessibility",   // Switch scanning, etc.
  CUSTOM = "custom"                  // Platform-specific extensions
}

// Semantic intents within each category
export enum AACSemanticIntent {
  // Communication
  SPEAK_TEXT = "speak_text",
  SPEAK_IMMEDIATE = "speak_immediate",
  STOP_SPEECH = "stop_speech",
  INSERT_TEXT = "insert_text",

  // Navigation
  NAVIGATE_TO = "navigate_to",
  GO_BACK = "go_back",
  GO_HOME = "go_home",

  // Text Editing
  DELETE_WORD = "delete_word",
  DELETE_CHARACTER = "delete_character",
  CLEAR_TEXT = "clear_text",
  COPY_TEXT = "copy_text",
  PASTE_TEXT = "paste_text",

  // System Control
  SEND_KEYS = "send_keys",
  MOUSE_CLICK = "mouse_click",

  // Media
  PLAY_SOUND = "play_sound",
  PLAY_VIDEO = "play_video",

  // Accessibility
  SCAN_NEXT = "scan_next",
  SCAN_SELECT = "scan_select",

  // Custom
  PLATFORM_SPECIFIC = "platform_specific"
}

// Legacy action types for backward compatibility
export type AACActionType = "SPEAK" | "NAVIGATE" | "ACTION";

// New semantic action interface for cross-platform compatibility
export interface AACSemanticAction {
  category: AACSemanticCategory;
  intent: AACSemanticIntent;

  // Core parameters that most platforms understand
  text?: string;              // Text content
  targetId?: string;          // Navigation target
  audioData?: Buffer;         // Audio content

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
    type: AACActionType;
    message?: string;
    targetPageId?: string;
  };
}

// Legacy action interface for backward compatibility
export interface AACAction {
  type: AACActionType;
  targetPageId?: string;
  text?: string;
  // Keep minimal legacy properties
  parameters?: { [key: string]: any };
}

export class AACButton implements IAACButton {
  id: string;
  label: string;
  message: string;
  type: AACActionType; // Simplified to legacy types

  // Dual action system for compatibility
  action: AACAction | null;              // Legacy action system
  semanticAction?: AACSemanticAction;    // New semantic action system

  targetPageId?: string;
  style?: AACStyle;
  audioRecording?: {
    id?: number;
    data?: Buffer;
    identifier?: string;
    metadata?: string;
  };

  // Extended properties for advanced platforms
  contentType?: "Normal" | "AutoContent" | "Workspace" | "LiveCell";
  contentSubType?: string;
  image?: string;
  symbolLibrary?: string;
  symbolPath?: string;
  x?: number;
  y?: number;
  columnSpan?: number;
  rowSpan?: number;
  scanBlocks?: number[];
  visibility?: "Visible" | "Hidden" | "Disabled" | "PointerAndTouchOnly" | "Empty";
  directActivate?: boolean;
  audioDescription?: string;
  parameters?: { [key: string]: any };

  constructor({
    id,
    label = "",
    message = "",
    type = "SPEAK",
    targetPageId,
    action = null,
    semanticAction,
    audioRecording,
    style,
    contentType,
    contentSubType,
    image,
    x,
    y,
    columnSpan,
    rowSpan,
    scanBlocks,
    visibility,
    directActivate,
    parameters
  }: {
    id: string;
    label?: string;
    message?: string;
    type?: AACActionType;
    targetPageId?: string;
    action?: AACAction | null;
    semanticAction?: AACSemanticAction;
    audioRecording?: {
      id?: number;
      data?: Buffer;
      identifier?: string;
      metadata?: string;
    };
    style?: AACStyle;
    contentType?: "Normal" | "AutoContent" | "Workspace" | "LiveCell";
    contentSubType?: string;
    image?: string;
    x?: number;
    y?: number;
    columnSpan?: number;
    rowSpan?: number;
    scanBlocks?: number[];
    visibility?: "Visible" | "Hidden" | "Disabled" | "PointerAndTouchOnly" | "Empty";
    directActivate?: boolean;
    parameters?: { [key: string]: any };
  }) {
    this.id = id;
    this.label = label;
    this.message = message;
    this.type = type;
    this.targetPageId = targetPageId;
    this.action = action;
    this.semanticAction = semanticAction;
    this.audioRecording = audioRecording;
    this.style = style;
    this.contentType = contentType;
    this.contentSubType = contentSubType;
    this.image = image;
    this.x = x;
    this.y = y;
    this.columnSpan = columnSpan;
    this.rowSpan = rowSpan;
    this.scanBlocks = scanBlocks;
    this.visibility = visibility;
    this.directActivate = directActivate;
    this.parameters = parameters;
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
    name = "",
    grid = [],
    buttons = [],
    parentId = null,
    style,
  }: {
    id: string;
    name?: string;
    grid?: Array<Array<AACButton | null>>;
    buttons?: AACButton[];
    parentId?: string | null;
    style?: AACStyle;
  }) {
    this.id = id;
    this.name = name;
    this.grid = grid;
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
          .filter((b) => b.type === "NAVIGATE" && b.targetPageId)
          .forEach((b) => {
            if (b.targetPageId) queue.push(b.targetPageId);
          });
      }
    }
  }
}

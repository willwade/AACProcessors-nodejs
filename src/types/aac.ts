// Extended action types to support Grid3 and other AAC formats
export type AACActionType =
  | "SPEAK"
  | "NAVIGATE"
  | "INSERT_TEXT"
  | "DELETE_WORD"
  | "CLEAR"
  | "INSERT_LETTER"
  | "GO_BACK"
  | "SETTINGS"
  | "AUTO_CONTENT";

export interface AACButtonAction {
  type: AACActionType;
  targetPageId?: string;
  text?: string;
  letter?: string;
  unit?: string;
  moveCaret?: number;
  indicatorEnabled?: boolean;
  settingsAction?: string;
  autoContentType?: string;
  parameters?: { [key: string]: any };
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
  type: "SPEAK" | "NAVIGATE" | "ACTION";
  action: AACButtonAction | null;
  targetPageId?: string;
  style?: AACStyle;
  audioRecording?: {
    id?: number;
    data?: Buffer;
    identifier?: string;
    metadata?: string;
  };
}

export interface AACPage {
  id: string;
  name: string;
  grid: Array<Array<AACButton | null>>;
  buttons: AACButton[];
  parentId: string | null;
  style?: AACStyle;
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

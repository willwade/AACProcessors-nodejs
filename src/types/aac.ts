export interface AACButtonAction {
  type: 'SPEAK' | 'NAVIGATE';
  targetPageId?: string;
}

export interface AACButton {
  id: string;
  label: string;
  message: string;
  type: AACButtonAction['type'];
  action: AACButtonAction | null;
  targetPageId?: string;
}

export interface AACPage {
  id: string;
  name: string;
  grid: Array<Array<AACButton | null>>;
  buttons: AACButton[];
  parentId: string | null;
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

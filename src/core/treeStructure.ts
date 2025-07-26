import { AACButton as IAACButton, AACPage as IAACPage, AACTree as IAACTree } from '../types/aac';

export class AACButton implements IAACButton {
  id: string;
  label: string;
  message: string;
  type: 'SPEAK' | 'NAVIGATE';
  action: { type: 'SPEAK' | 'NAVIGATE'; targetPageId?: string } | null;
  targetPageId?: string;
  audioRecording?: {
    id?: number;
    data?: Buffer;
    identifier?: string;
    metadata?: string;
  };

  constructor({
    id,
    label = '',
    message = '',
    type = 'SPEAK',
    targetPageId,
    action = null,
    audioRecording,
  }: {
    id: string;
    label?: string;
    message?: string;
    type?: 'SPEAK' | 'NAVIGATE';
    targetPageId?: string;
    action?: { type: 'SPEAK' | 'NAVIGATE'; targetPageId?: string } | null;
    audioRecording?: {
      id?: number;
      data?: Buffer;
      identifier?: string;
      metadata?: string;
    };
  }) {
    this.id = id;
    this.label = label;
    this.message = message;
    this.type = type;
    this.targetPageId = targetPageId;
    this.action = action;
    this.audioRecording = audioRecording;
  }
}

export class AACPage implements IAACPage {
  id: string;
  name: string;
  grid: Array<Array<AACButton | null>>;
  buttons: AACButton[];
  parentId: string | null;

  constructor({
    id,
    name = '',
    grid = [],
    buttons = [],
    parentId = null,
  }: {
    id: string;
    name?: string;
    grid?: Array<Array<AACButton | null>>;
    buttons?: AACButton[];
    parentId?: string | null;
  }) {
    this.id = id;
    this.name = name;
    this.grid = grid;
    this.buttons = buttons;
    this.parentId = parentId;
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
          .filter((b) => b.type === 'NAVIGATE' && b.targetPageId)
          .forEach((b) => {
            if (b.targetPageId) queue.push(b.targetPageId);
          });
      }
    }
  }
}

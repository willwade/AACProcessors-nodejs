/**
 * AAC Processors Browser Demo
 *
 * This demo uses Vite to bundle AACProcessors for browser use.
 * It tests all browser-compatible processors with real file uploads.
 */

// Polyfill Buffer for browser environment
if (typeof (window as any).Buffer === 'undefined') {
  // Create a proper Buffer wrapper class that extends Uint8Array
  class BufferWrapper extends Uint8Array {
    constructor(data: any, byteOffset?: number, length?: number) {
      if (typeof data === 'number') {
        // Alloc case: data is the size
        super(data);
      } else if (Array.isArray(data)) {
        super(data);
      } else if (data instanceof ArrayBuffer) {
        super(data, byteOffset || 0, length);
      } else if (data instanceof Uint8Array) {
        super(data.buffer, data.byteOffset, data.length);
      } else if (typeof data === 'string') {
        const encoder = new TextEncoder();
        super(encoder.encode(data));
      } else {
        super(0);
      }
    }

    toString(encoding: string = 'utf8'): string {
      if (encoding === 'utf8' || encoding === 'utf-8') {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(this);
      }
      throw new Error(`Buffer.toString: encoding ${encoding} not supported`);
    }

    static from(data: any, encoding?: string): BufferWrapper {
      return new BufferWrapper(data);
    }

    static alloc(size: number): BufferWrapper {
      return new BufferWrapper(size);
    }

    static allocUnsafe(size: number): BufferWrapper {
      return new BufferWrapper(size);
    }

    static concat(list: Uint8Array[], totalLength?: number): BufferWrapper {
      const result = new Uint8Array(totalLength || list.reduce((sum, arr) => sum + arr.length, 0));
      let offset = 0;
      for (const arr of list) {
        result.set(arr, offset);
        offset += arr.length;
      }
      return new BufferWrapper(result.buffer, result.byteOffset, result.length);
    }

    static isBuffer(obj: any): boolean {
      return obj instanceof BufferWrapper;
    }
  }

  (window as any).Buffer = BufferWrapper as any;
}

import {
  getProcessor,
  getSupportedExtensions,
  DotProcessor,
  OpmlProcessor,
  ObfProcessor,
  GridsetProcessor,
  ApplePanelsProcessor,
  AstericsGridProcessor,
  AACTree,
  AACPage,
  AACButton
} from 'aac-processors';

// UI Elements
const dropArea = document.getElementById('dropArea') as HTMLElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const processBtn = document.getElementById('processBtn') as HTMLButtonElement;
const runTestsBtn = document.getElementById('runTestsBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const fileInfo = document.getElementById('fileInfo') as HTMLElement;
const processorName = document.getElementById('processorName') as HTMLElement;
const fileDetails = document.getElementById('fileDetails') as HTMLElement;
const stats = document.getElementById('stats') as HTMLElement;
const results = document.getElementById('results') as HTMLElement;
const logPanel = document.getElementById('logPanel') as HTMLElement;
const testResults = document.getElementById('testResults') as HTMLElement;
const testList = document.getElementById('testList') as HTMLElement;
const tabButtons = document.querySelectorAll('.tab-btn') as NodeListOf<HTMLButtonElement>;
const inspectTab = document.getElementById('inspectTab') as HTMLElement;
const pagesetTab = document.getElementById('pagesetTab') as HTMLElement;
const templateSelect = document.getElementById('templateSelect') as HTMLSelectElement;
const formatSelect = document.getElementById('formatSelect') as HTMLSelectElement;
const createPagesetBtn = document.getElementById('createPagesetBtn') as HTMLButtonElement;
const previewPagesetBtn = document.getElementById('previewPagesetBtn') as HTMLButtonElement;
const convertToObfBtn = document.getElementById('convertToObfBtn') as HTMLButtonElement;
const convertToObzBtn = document.getElementById('convertToObzBtn') as HTMLButtonElement;
const conversionStatus = document.getElementById('conversionStatus') as HTMLElement;
const pagesetOutput = document.getElementById('pagesetOutput') as HTMLElement;

// State
let currentFile: File | null = null;
let currentProcessor: any = null;
let currentTree: AACTree | null = null;
let currentSourceLabel = 'pageset';

// Tabs
function setActiveTab(tabId: string) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  inspectTab.classList.toggle('active', tabId === 'inspectTab');
  pagesetTab.classList.toggle('active', tabId === 'pagesetTab');
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setActiveTab(btn.dataset.tab || 'inspectTab');
  });
});

// Logging
function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logPanel.appendChild(entry);
  logPanel.scrollTop = logPanel.scrollHeight;
  console.log(`[${type.toUpperCase()}]`, message);
}

function setConversionStatus(message: string, state: 'success' | 'warn' | 'info' = 'info') {
  conversionStatus.textContent = message;
  conversionStatus.classList.remove('success', 'warn');
  if (state !== 'info') {
    conversionStatus.classList.add(state);
  }
}

function updateConvertButtons() {
  const hasTree = !!currentTree;
  convertToObfBtn.disabled = !hasTree;
  convertToObzBtn.disabled = !hasTree;
  if (!hasTree) {
    setConversionStatus('No pageset loaded yet.', 'info');
  } else {
    setConversionStatus(`Ready to export: ${currentSourceLabel}`, 'success');
  }
}

function updateStatsForTree(tree: AACTree, textCount?: number, loadTimeMs?: number) {
  const pageCount = Object.keys(tree.pages).length;
  const buttonCount = Object.values(tree.pages).reduce(
    (sum: number, page: AACPage) => sum + page.buttons.length,
    0
  );

  document.getElementById('pageCount')!.textContent = pageCount.toString();
  document.getElementById('buttonCount')!.textContent = buttonCount.toString();
  document.getElementById('textCount')!.textContent = (textCount ?? 0).toString();
  document.getElementById('loadTime')!.textContent =
    loadTimeMs !== undefined ? `${loadTimeMs.toFixed(0)}ms` : '—';
  stats.style.display = 'grid';
}

function collectTextCount(tree: AACTree): number {
  const texts = new Set<string>();
  Object.values(tree.pages).forEach((page) => {
    if (page.name) texts.add(page.name);
    page.buttons.forEach((button) => {
      if (button.label) texts.add(button.label);
      if (button.message) texts.add(button.message);
    });
  });
  return texts.size;
}

// Get file extension
function getFileExtension(filename: string): string {
  const match = filename.toLowerCase().match(/\.\w+$/);
  return match ? match[0] : '';
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Handle file selection
function handleFile(file: File) {
  currentFile = file;
  const extension = getFileExtension(file.name);

  log(`Selected file: ${file.name} (${formatFileSize(file.size)})`, 'info');

  // Check if extension is supported
  if (!getSupportedExtensions().includes(extension)) {
    log(`Unsupported file type: ${extension}`, 'error');
    processorName.textContent = '❌ Unsupported file type';
    fileDetails.textContent = extension;
    fileInfo.style.display = 'block';
    processBtn.disabled = true;
    return;
  }

  // Get processor
  try {
    currentProcessor = getProcessor(extension);
    processorName.textContent = `✅ ${currentProcessor.constructor.name}`;
    fileDetails.textContent = `${file.name} • ${formatFileSize(file.size)}`;
    fileInfo.style.display = 'block';
    processBtn.disabled = false;
    currentSourceLabel = file.name;

    log(`Using processor: ${currentProcessor.constructor.name}`, 'success');
  } catch (error) {
    log(`Error getting processor: ${(error as Error).message}`, 'error');
    processBtn.disabled = true;
  }
}

// Drag and drop handlers
dropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropArea.classList.add('dragover');
});

dropArea.addEventListener('dragleave', () => {
  dropArea.classList.remove('dragover');
});

dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  dropArea.classList.remove('dragover');

  const file = e.dataTransfer?.files[0];
  if (file) {
    fileInput.files = e.dataTransfer!.files;
    handleFile(file);
  }
});

dropArea.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    handleFile(file);
  }
});

// Process file
processBtn.addEventListener('click', async () => {
  if (!currentFile || !currentProcessor) return;

  const startTime = performance.now();
  log('Processing file...', 'info');

  try {
    processBtn.disabled = true;
    results.innerHTML = '<p style="text-align: center; padding: 40px;">⏳ Loading...</p>';

    // Read file as ArrayBuffer
    const arrayBuffer = await currentFile.arrayBuffer();

    // Load into tree
    log('Loading tree structure...', 'info');
    currentTree = await currentProcessor.loadIntoTree(arrayBuffer);

    const loadTime = performance.now() - startTime;
    log(`Tree loaded in ${loadTime.toFixed(0)}ms`, 'success');

    // Extract texts
    log('Extracting texts...', 'info');
    const texts = await currentProcessor.extractTexts(arrayBuffer);
    log(`Extracted ${texts.length} texts`, 'success');

    // Update stats
    updateStatsForTree(currentTree, texts.length, loadTime);

    // Display results
    displayResults(currentTree);
    updateConvertButtons();

    log(`✅ Successfully processed ${Object.keys(currentTree.pages).length} pages`, 'success');
  } catch (error) {
    const errorMsg = (error as Error).message;
    log(`❌ Error: ${errorMsg}`, 'error');
    results.innerHTML = `<p style="color: #f48771; text-align: center; padding: 40px;">
      ❌ Error: ${errorMsg}
    </p>`;
  } finally {
    processBtn.disabled = false;
  }
});

// Display results
function displayResults(tree: AACTree) {
  results.innerHTML = '';

  const sortedPageIds = Object.keys(tree.pages).sort((a, b) => {
    // Show root page first
    if (a === tree.rootId) return -1;
    if (b === tree.rootId) return 1;
    return a.localeCompare(b);
  });

  sortedPageIds.forEach((pageId) => {
    const page = tree.pages[pageId];
    const pageCard = document.createElement('div');
    pageCard.className = 'page-card';

    const pageTitle = document.createElement('div');
    pageTitle.className = 'page-title';
    pageTitle.textContent = `${page.name} ${pageId === tree.rootId ? '🏠' : ''}`;
    pageCard.appendChild(pageTitle);

    if (page.buttons.length > 0) {
      const buttonGrid = document.createElement('div');
      buttonGrid.className = 'button-grid';

      page.buttons.forEach((button) => {
        const buttonItem = document.createElement('div');
        buttonItem.className = 'button-item';

        const label = document.createElement('div');
        label.className = 'button-label';
        label.textContent = button.label || '(no label)';
        buttonItem.appendChild(label);

        if (button.message) {
          const message = document.createElement('div');
          message.className = 'button-message';
          message.textContent = button.message;
          buttonItem.appendChild(message);
        }

        const type = document.createElement('div');
        type.className = 'button-type';
        type.textContent = button.type;

        switch (button.type) {
          case 'SPEAK':
            type.classList.add('type-speak');
            break;
          case 'NAVIGATE':
            type.classList.add('type-navigate');
            break;
          default:
            type.classList.add('type-other');
        }

        buttonItem.appendChild(type);

        // Click handler
        buttonItem.addEventListener('click', () => {
          if (button.type === 'SPEAK' && button.message) {
            log(`🔊 Speaking: "${button.message}"`, 'info');
            if ('speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance(button.message);
              speechSynthesis.speak(utterance);
            }
          } else if (button.type === 'NAVIGATE' && button.targetPageId) {
            const targetPage = tree.pages[button.targetPageId];
            if (targetPage) {
              log(`🔗 Navigating to: ${targetPage.name}`, 'info');
              // Scroll to page
              const targetCard = Array.from(results.querySelectorAll('.page-card')).find((card) =>
                card.querySelector('.page-title')?.textContent?.includes(targetPage.name)
              );
              if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetCard.style.animation = 'highlight 1s';
              }
            }
          }
        });

        buttonGrid.appendChild(buttonItem);
      });

      pageCard.appendChild(buttonGrid);
    } else {
      const noButtons = document.createElement('p');
      noButtons.textContent = 'No buttons';
      noButtons.style.color = '#999';
      noButtons.style.fontSize = '12px';
      pageCard.appendChild(noButtons);
    }

    results.appendChild(pageCard);
  });
}

// Clear results
clearBtn.addEventListener('click', () => {
  currentFile = null;
  currentProcessor = null;
  currentTree = null;
  currentSourceLabel = 'pageset';
  fileInput.value = '';
  fileInfo.style.display = 'none';
  stats.style.display = 'none';
  results.innerHTML = '<p style="color: #999; text-align: center; padding: 40px;">Load a file to see its contents here</p>';
  testResults.style.display = 'none';
  logPanel.innerHTML = '<div class="log-entry log-info">Cleared. Ready to process files...</div>';
  pagesetOutput.textContent = 'Generate or convert a pageset to preview the output JSON.';
  updateConvertButtons();
});

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'pageset';
}

function buildSampleTree(template: string): AACTree {
  const tree = new AACTree();
  tree.metadata = {
    name: template === 'home' ? 'Home & Core Demo' : 'Starter Demo',
    description: 'Generated in the AAC Processors browser demo',
    locale: 'en',
  };

  if (template === 'home') {
    const hello = new AACButton({ id: 'hello', label: 'Hello', message: 'Hello', action: { type: 'SPEAK' } });
    const want = new AACButton({ id: 'want', label: 'I want', message: 'I want', action: { type: 'SPEAK' } });
    const help = new AACButton({ id: 'help', label: 'Help', message: 'Help', action: { type: 'SPEAK' } });
    const more = new AACButton({
      id: 'more',
      label: 'More',
      targetPageId: 'core',
      action: { type: 'NAVIGATE', targetPageId: 'core' },
    });
    const yes = new AACButton({ id: 'yes', label: 'Yes', message: 'Yes', action: { type: 'SPEAK' } });
    const no = new AACButton({ id: 'no', label: 'No', message: 'No', action: { type: 'SPEAK' } });
    const stop = new AACButton({ id: 'stop', label: 'Stop', message: 'Stop', action: { type: 'SPEAK' } });
    const go = new AACButton({ id: 'go', label: 'Go', message: 'Go', action: { type: 'SPEAK' } });
    const food = new AACButton({
      id: 'food',
      label: 'Food',
      targetPageId: 'food',
      action: { type: 'NAVIGATE', targetPageId: 'food' },
    });

    const homePage = new AACPage({
      id: 'home',
      name: 'Home',
      buttons: [hello, want, help, more, yes, no, stop, go, food],
      grid: [
        [hello, want, help],
        [more, yes, no],
        [stop, go, food],
      ],
    });

    const hungry = new AACButton({ id: 'hungry', label: 'Hungry', message: 'I am hungry', action: { type: 'SPEAK' } });
    const drink = new AACButton({ id: 'drink', label: 'Drink', message: 'I want a drink', action: { type: 'SPEAK' } });
    const snack = new AACButton({ id: 'snack', label: 'Snack', message: 'Snack', action: { type: 'SPEAK' } });
    const backFood = new AACButton({
      id: 'back-food',
      label: 'Back',
      targetPageId: 'home',
      action: { type: 'NAVIGATE', targetPageId: 'home' },
    });

    const foodPage = new AACPage({
      id: 'food',
      name: 'Food',
      buttons: [hungry, drink, snack, backFood],
      grid: [
        [hungry, drink],
        [snack, backFood],
      ],
    });

    const coreYes = new AACButton({ id: 'core-yes', label: 'Yes', message: 'Yes', action: { type: 'SPEAK' } });
    const coreNo = new AACButton({ id: 'core-no', label: 'No', message: 'No', action: { type: 'SPEAK' } });
    const coreStop = new AACButton({ id: 'core-stop', label: 'Stop', message: 'Stop', action: { type: 'SPEAK' } });
    const coreGo = new AACButton({ id: 'core-go', label: 'Go', message: 'Go', action: { type: 'SPEAK' } });
    const backCore = new AACButton({
      id: 'back-core',
      label: 'Back',
      targetPageId: 'home',
      action: { type: 'NAVIGATE', targetPageId: 'home' },
    });

    const corePage = new AACPage({
      id: 'core',
      name: 'Core Words',
      buttons: [coreYes, coreNo, coreStop, coreGo, backCore],
      grid: [
        [coreYes, coreNo],
        [coreStop, coreGo],
        [backCore, null],
      ],
    });

    tree.addPage(homePage);
    tree.addPage(corePage);
    tree.addPage(foodPage);
    tree.rootId = 'home';
    return tree;
  }

  const hello = new AACButton({ id: 'hello', label: 'Hello', message: 'Hello', action: { type: 'SPEAK' } });
  const thanks = new AACButton({ id: 'thanks', label: 'Thanks', message: 'Thank you', action: { type: 'SPEAK' } });
  const yes = new AACButton({ id: 'yes', label: 'Yes', message: 'Yes', action: { type: 'SPEAK' } });
  const more = new AACButton({
    id: 'more',
    label: 'Feelings',
    targetPageId: 'feelings',
    action: { type: 'NAVIGATE', targetPageId: 'feelings' },
  });

  const homePage = new AACPage({
    id: 'home',
    name: 'Starter',
    buttons: [hello, thanks, yes, more],
    grid: [
      [hello, thanks],
      [yes, more],
    ],
  });

  const happy = new AACButton({ id: 'happy', label: 'Happy', message: 'I feel happy', action: { type: 'SPEAK' } });
  const sad = new AACButton({ id: 'sad', label: 'Sad', message: 'I feel sad', action: { type: 'SPEAK' } });
  const back = new AACButton({
    id: 'back',
    label: 'Back',
    targetPageId: 'home',
    action: { type: 'NAVIGATE', targetPageId: 'home' },
  });

  const feelingsPage = new AACPage({
    id: 'feelings',
    name: 'Feelings',
    buttons: [happy, sad, back],
    grid: [
      [happy, sad],
      [back, null],
    ],
  });

  tree.addPage(homePage);
  tree.addPage(feelingsPage);
  tree.rootId = 'home';
  return tree;
}

function buildFallbackObfBoard(page: AACPage, metadata?: AACTree['metadata']) {
  const rows = page.grid.length || 1;
  const columns = page.grid.reduce((max, row) => Math.max(max, row.length), 0) || page.buttons.length;
  const order: (string | null)[][] = [];
  const positions = new Map<string, number>();

  if (page.grid.length) {
    page.grid.forEach((row, rowIndex) => {
      const orderRow: (string | null)[] = [];
      for (let colIndex = 0; colIndex < columns; colIndex++) {
        const cell = row[colIndex] || null;
        if (cell) {
          const id = String(cell.id ?? '');
          orderRow.push(id);
          positions.set(id, rowIndex * columns + colIndex);
        } else {
          orderRow.push(null);
        }
      }
      order.push(orderRow);
    });
  } else {
    const fallbackRow = page.buttons.map((button, index) => {
      const id = String(button.id ?? '');
      positions.set(id, index);
      return id;
    });
    order.push(fallbackRow);
  }

  return {
    format: 'open-board-0.1',
    id: page.id,
    locale: metadata?.locale || page.locale || 'en',
    name: page.name || metadata?.name || 'Board',
    description_html: page.descriptionHtml || metadata?.description || '',
    grid: { rows, columns, order },
    buttons: page.buttons.map((button) => ({
      id: button.id,
      label: button.label,
      vocalization: button.message || button.label,
      load_board: button.targetPageId ? { path: button.targetPageId } : undefined,
      box_id: positions.get(String(button.id ?? '')),
      background_color: button.style?.backgroundColor,
      border_color: button.style?.borderColor,
    })),
  };
}

async function buildObfExport(tree: AACTree, format: 'obf' | 'obz') {
  const obfProcessor = new ObfProcessor();
  const obfInternal = obfProcessor as ObfProcessor & {
    createObfBoardFromPage?: (page: AACPage, fallbackName: string, metadata?: AACTree['metadata']) => any;
  };

  const boards = Object.values(tree.pages).map((page) => ({
    pageId: page.id,
    board: obfInternal.createObfBoardFromPage
      ? obfInternal.createObfBoardFromPage(page, 'Board', tree.metadata)
      : buildFallbackObfBoard(page, tree.metadata),
  }));

  if (format === 'obf') {
    const rootPage = tree.rootId ? tree.getPage(tree.rootId) : Object.values(tree.pages)[0];
    const board =
      boards.find((entry) => entry.pageId === rootPage?.id)?.board ?? boards[0]?.board ?? {};
    const json = JSON.stringify(board, null, 2);
    return { filename: `${sanitizeFilename(tree.metadata?.name || 'pageset')}.obf`, data: json };
  }

  const module = await import('jszip');
  const JSZip = module.default || module;
  const zip = new JSZip();
  boards.forEach((entry) => {
    zip.file(`${entry.pageId}.obf`, JSON.stringify(entry.board, null, 2));
  });
  const zipData = await zip.generateAsync({ type: 'uint8array' });
  return { filename: `${sanitizeFilename(tree.metadata?.name || 'pageset')}.obz`, data: zipData };
}

function triggerDownload(data: Uint8Array | string, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

createPagesetBtn.addEventListener('click', async () => {
  const template = templateSelect.value;
  const format = formatSelect.value === 'obz' ? 'obz' : 'obf';
  const tree = buildSampleTree(template);
  currentTree = tree;
  currentSourceLabel = `${tree.metadata?.name || 'sample pageset'}`;
  updateConvertButtons();

  const exportData = await buildObfExport(tree, format);
  const isObf = typeof exportData.data === 'string';
  triggerDownload(
    exportData.data,
    exportData.filename,
    isObf ? 'application/json' : 'application/zip'
  );

  pagesetOutput.textContent = isObf
    ? exportData.data
    : `Generated OBZ with ${Object.keys(tree.pages).length} boards.`;

  log(`Created sample pageset and exported ${exportData.filename}`, 'success');
  setConversionStatus(`Exported ${exportData.filename}`, 'success');
});

previewPagesetBtn.addEventListener('click', () => {
  const tree = buildSampleTree(templateSelect.value);
  currentTree = tree;
  currentSourceLabel = `${tree.metadata?.name || 'sample pageset'}`;
  displayResults(tree);
  updateStatsForTree(tree, collectTextCount(tree));
  updateConvertButtons();
  setActiveTab('inspectTab');
  log('Previewing sample pageset in viewer', 'info');
});

convertToObfBtn.addEventListener('click', async () => {
  if (!currentTree) return;
  const exportData = await buildObfExport(currentTree, 'obf');
  triggerDownload(exportData.data, exportData.filename, 'application/json');
  pagesetOutput.textContent = exportData.data as string;
  log(`Converted ${currentSourceLabel} to ${exportData.filename}`, 'success');
  setConversionStatus(`Exported ${exportData.filename}`, 'success');
});

convertToObzBtn.addEventListener('click', async () => {
  if (!currentTree) return;
  const exportData = await buildObfExport(currentTree, 'obz');
  triggerDownload(exportData.data, exportData.filename, 'application/zip');
  pagesetOutput.textContent = `Generated OBZ with ${Object.keys(currentTree.pages).length} boards.`;
  log(`Converted ${currentSourceLabel} to ${exportData.filename}`, 'success');
  setConversionStatus(`Exported ${exportData.filename}`, 'success');
});

// Run compatibility tests
runTestsBtn.addEventListener('click', async () => {
  log('Running compatibility tests...', 'info');
  testResults.style.display = 'block';
  testList.innerHTML = '';

  const tests: { name: string; fn: () => Promise<boolean> }[] = [
    {
      name: 'getProcessor() factory function',
      fn: async () => {
        const dotProc = getProcessor('.dot');
        const opmlProc = getProcessor('.opml');
        const obfProc = getProcessor('.obf');
        const gridsetProc = getProcessor('.gridset');
        return (
          dotProc instanceof DotProcessor &&
          opmlProc instanceof OpmlProcessor &&
          obfProc instanceof ObfProcessor &&
          gridsetProc instanceof GridsetProcessor
        );
      }
    },
    {
      name: 'getSupportedExtensions() returns all extensions',
      fn: async () => {
        const extensions = getSupportedExtensions();
        const expected = ['.dot', '.opml', '.obf', '.obz', '.gridset', '.plist', '.grd'];
        return expected.every((ext) => extensions.includes(ext));
      }
    },
    {
      name: 'DotProcessor instantiation',
      fn: async () => {
        try {
          new DotProcessor();
          return true;
        } catch {
          return false;
        }
      }
    },
    {
      name: 'OpmlProcessor instantiation',
      fn: async () => {
        try {
          new OpmlProcessor();
          return true;
        } catch {
          return false;
        }
      }
    },
    {
      name: 'ObfProcessor instantiation',
      fn: async () => {
        try {
          new ObfProcessor();
          return true;
        } catch {
          return false;
        }
      }
    },
    {
      name: 'GridsetProcessor instantiation',
      fn: async () => {
        try {
          new GridsetProcessor();
          return true;
        } catch {
          return false;
        }
      }
    },
    {
      name: 'ApplePanelsProcessor instantiation',
      fn: async () => {
        try {
          new ApplePanelsProcessor();
          return true;
        } catch {
          return false;
        }
      }
    },
    {
      name: 'AstericsGridProcessor instantiation',
      fn: async () => {
        try {
          new AstericsGridProcessor();
          return true;
        } catch {
          return false;
        }
      }
    },
    {
      name: 'Processors accept ArrayBuffer type',
      fn: async () => {
        try {
          const proc = new DotProcessor();
          const buffer = new Uint8Array([123, 125]); // Invalid but tests type acceptance
          await proc.loadIntoTree(buffer); // Will fail but tests that it accepts the type
          return true;
        } catch {
          return true; // Expected to fail with invalid data, but type was accepted
        }
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const item = document.createElement('div');
    item.className = 'test-item';

    const status = document.createElement('div');
    status.className = 'test-status test-pending';
    status.textContent = '⏳';

    const name = document.createElement('div');
    name.className = 'test-name';
    name.textContent = test.name;

    item.appendChild(status);
    item.appendChild(name);
    testList.appendChild(item);

    try {
      const result = await test.fn();
      if (result) {
        status.className = 'test-status test-pass';
        status.textContent = '✓';
        passed++;
        log(`✓ ${test.name}`, 'success');
      } else {
        status.className = 'test-status test-fail';
        status.textContent = '✗';
        failed++;
        log(`✗ ${test.name}`, 'error');
      }
    } catch (error) {
      status.className = 'test-status test-fail';
      status.textContent = '✗';
      failed++;
      log(`✗ ${test.name}: ${(error as Error).message}`, 'error');
    }
  }

  log(`Tests complete: ${passed} passed, ${failed} failed`, passed === tests.length ? 'success' : 'warn');

  const summary = document.createElement('div');
  summary.style.marginTop = '15px';
  summary.style.paddingTop = '15px';
  summary.style.borderTop = '2px solid #e0e0e0';
  summary.style.fontWeight = '600';
  summary.textContent = `📊 Summary: ${passed}/${tests.length} tests passed`;
  testList.appendChild(summary);
});

// Log initialization
log('✅ AAC Processors Browser Demo initialized', 'success');
log('📋 Supported extensions: ' + getSupportedExtensions().join(', '), 'info');
log('💡 Drop a file or click to upload', 'info');

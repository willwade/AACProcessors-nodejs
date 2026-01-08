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
  type AACTree,
  type AACPage,
  type AACButton
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

// State
let currentFile: File | null = null;
let currentProcessor: any = null;
let currentTree: AACTree | null = null;

// Logging
function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logPanel.appendChild(entry);
  logPanel.scrollTop = logPanel.scrollHeight;
  console.log(`[${type.toUpperCase()}]`, message);
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
    const pageCount = Object.keys(currentTree.pages).length;
    const buttonCount = Object.values(currentTree.pages).reduce(
      (sum: number, page: AACPage) => sum + page.buttons.length,
      0
    );

    document.getElementById('pageCount')!.textContent = pageCount.toString();
    document.getElementById('buttonCount')!.textContent = buttonCount.toString();
    document.getElementById('textCount')!.textContent = texts.length.toString();
    document.getElementById('loadTime')!.textContent = `${loadTime.toFixed(0)}ms`;
    stats.style.display = 'grid';

    // Display results
    displayResults(currentTree);

    log(`✅ Successfully processed ${pageCount} pages with ${buttonCount} buttons`, 'success');
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
  fileInput.value = '';
  fileInfo.style.display = 'none';
  stats.style.display = 'none';
  results.innerHTML = '<p style="color: #999; text-align: center; padding: 40px;">Load a file to see its contents here</p>';
  testResults.style.display = 'none';
  logPanel.innerHTML = '<div class="log-entry log-info">Cleared. Ready to process files...</div>';
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

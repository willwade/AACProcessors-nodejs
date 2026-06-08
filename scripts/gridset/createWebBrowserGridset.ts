import {
  AACTree,
  AACPage,
  AACButton,
  AACSemanticCategory,
  AACSemanticIntent,
  GridsetProcessor,
} from '../../src/index.node';
import type { GridSetMetadata } from '../../src/types/aac';
import path from 'path';

function ws(
  x: number,
  y: number,
  colSpan: number,
  rowSpan: number,
  subType = 'WebBrowser'
): AACButton {
  return new AACButton({
    id: `ws-${x}-${y}`,
    label: '',
    message: '',
    x,
    y,
    columnSpan: colSpan,
    rowSpan: rowSpan,
    contentType: 'Workspace',
    contentSubType: subType,
    style: { backgroundColor: '#FFFFFFFF' },
  });
}

async function main() {
  const tree = new AACTree();
  tree.metadata = {
    format: 'gridset',
    name: 'Web Browser',
    description: 'Web browser control gridset',
    author: 'AAC Processors',
    locale: 'en-US',
    languages: ['en-US'],
    version: '1.0',
    id: 'test-web-browser',
    appearance: { textAtTop: true, computerControlCellSize: 1 },
  } as GridSetMetadata;

  // ============================================================
  // LAYOUT PATTERN (matches original Web Browser gridset):
  //   10 cols × 7 rows
  //   Row 0-1: LiveCell page title bar (col 1-8) + nav (col 0,9)
  //   Row 1-5: WebBrowser workspace (col 1-8) + scroll/nav (col 9)
  //   Row 5-6: control buttons (col 0-9)
  // ============================================================

  // --- Web Browser (main page) ---
  // Layout: 10x7. Workspace fills col 1-8, rows 2-5. Title bar row 0-1.
  const main = new AACPage({
    id: 'web-browser',
    name: 'Web Browser',
    grid: { columns: 10, rows: 7 },
  });

  // Page title live cell (row 0, cols 1-8)
  main.addButton(
    new AACButton({
      id: 'wb-title',
      label: '',
      message: '',
      x: 1,
      y: 0,
      columnSpan: 8,
      rowSpan: 1,
      contentType: 'LiveCell',
      contentSubType: 'WebBrowser.PageTitle',
      style: { backgroundColor: '#FFFFFF00', borderColor: '#75706BFF', fontColor: '#000000FF' },
    })
  );

  // Grid explorer (col 0, rows 0-1)
  main.addButton(
    new AACButton({
      id: 'wb-explorer',
      label: 'Explorer',
      message: 'Grid explorer',
      x: 0,
      y: 0,
      rowSpan: 2,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.PLATFORM_SPECIFIC,
        platformData: { grid3: { commandId: 'Settings.GridExplorer', parameters: {} } },
      },
    })
  );

  // WebBrowser workspace (col 1-8, rows 1-5)
  main.addButton(ws(1, 1, 8, 5));

  // Jump Back (col 0, rows 2-3)
  main.addButton(
    new AACButton({
      id: 'wb-jumpback',
      label: 'Back',
      message: 'Back',
      x: 0,
      y: 2,
      rowSpan: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_BACK,
      },
    })
  );

  // Navigate to search page
  main.addButton(
    new AACButton({
      id: 'wb-search',
      label: 'Search',
      message: 'Web search',
      x: 0,
      y: 4,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-search',
      },
    })
  );

  // Navigate to URL page
  main.addButton(
    new AACButton({
      id: 'wb-url',
      label: 'URL',
      message: 'Address',
      x: 0,
      y: 5,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-url',
      },
    })
  );

  // Navigate to favourites
  main.addButton(
    new AACButton({
      id: 'wb-favs',
      label: 'Favs',
      message: 'Favourites',
      x: 0,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-favourites',
      },
    })
  );

  // Navigate to links
  main.addButton(
    new AACButton({
      id: 'wb-links',
      label: 'Links',
      message: 'Links',
      x: 1,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-links',
      },
    })
  );

  // Navigate to view page
  main.addButton(
    new AACButton({
      id: 'wb-view',
      label: 'View',
      message: 'View',
      x: 2,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-view',
      },
    })
  );

  // Navigate to keyboard
  main.addButton(
    new AACButton({
      id: 'wb-kb',
      label: 'Keyboard',
      message: 'Keyboard',
      x: 3,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-keyboard',
      },
    })
  );

  // Navigate to navigate page
  main.addButton(
    new AACButton({
      id: 'wb-nav',
      label: 'Navigate',
      message: 'Navigate',
      x: 4,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-navigate',
      },
    })
  );

  // Home
  main.addButton(
    new AACButton({
      id: 'wb-home',
      label: 'Home',
      message: 'Home',
      x: 5,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_HOME,
      },
    })
  );

  // Scroll up (col 9)
  main.addButton(
    new AACButton({
      id: 'wb-scrollup',
      label: 'Up',
      message: 'Scroll up',
      x: 9,
      y: 2,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        parameters: { direction: 'up' },
        platformData: {
          grid3: { commandId: 'WebBrowser.ScrollUp', parameters: { size: 'Medium' } },
        },
      },
    })
  );

  // Scroll down (col 9)
  main.addButton(
    new AACButton({
      id: 'wb-scrolldown',
      label: 'Down',
      message: 'Scroll down',
      x: 9,
      y: 3,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        parameters: { direction: 'down' },
        platformData: {
          grid3: { commandId: 'WebBrowser.ScrollDown', parameters: { size: 'Medium' } },
        },
      },
    })
  );

  // Next element (col 9)
  main.addButton(
    new AACButton({
      id: 'wb-next',
      label: 'Next',
      message: 'Next element',
      x: 9,
      y: 4,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_FOCUS_ELEMENT,
        parameters: { direction: 'next' },
        platformData: { grid3: { commandId: 'WebBrowser.NextElement', parameters: {} } },
      },
    })
  );

  // Activate element (col 9)
  main.addButton(
    new AACButton({
      id: 'wb-activate',
      label: 'Click',
      message: 'Activate',
      x: 9,
      y: 5,
      style: { backgroundColor: '#F39C12FF' },
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_ACTIVATE_ELEMENT,
        platformData: { grid3: { commandId: 'WebBrowser.ActivateElement', parameters: {} } },
      },
    })
  );

  // Zoom in (col 9)
  main.addButton(
    new AACButton({
      id: 'wb-zoomin',
      label: 'Zoom+',
      message: 'Zoom in',
      x: 9,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        parameters: { action: 'zoom' },
        platformData: { grid3: { commandId: 'WebBrowser.ZoomIn', parameters: {} } },
      },
    })
  );

  // Previous element (col 9 row 1 - under title)
  main.addButton(
    new AACButton({
      id: 'wb-prev',
      label: 'Prev',
      message: 'Previous element',
      x: 9,
      y: 1,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_FOCUS_ELEMENT,
        parameters: { direction: 'previous' },
        platformData: { grid3: { commandId: 'WebBrowser.PreviousElement', parameters: {} } },
      },
    })
  );

  // Row 6 right side - spatial navigation, browser nav
  main.addButton(
    new AACButton({
      id: 'wb-webback',
      label: 'Back',
      message: 'Browser back',
      x: 6,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_NAVIGATE,
        platformData: { grid3: { commandId: 'WebBrowser.Back', parameters: {} } },
      },
    })
  );

  main.addButton(
    new AACButton({
      id: 'wb-webfwd',
      label: 'Forward',
      message: 'Browser forward',
      x: 7,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_NAVIGATE,
        platformData: { grid3: { commandId: 'WebBrowser.Forward', parameters: {} } },
      },
    })
  );

  main.addButton(
    new AACButton({
      id: 'wb-reload',
      label: 'Reload',
      message: 'Reload',
      x: 8,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_NAVIGATE,
        platformData: { grid3: { commandId: 'WebBrowser.Reload', parameters: {} } },
      },
    })
  );

  // --- Web Browser View (full-page workspace with minimal controls) ---
  const view = new AACPage({
    id: 'web-view',
    name: 'Web Browser view',
    grid: { columns: 10, rows: 7 },
  });
  view.addButton(ws(1, 1, 8, 6));

  view.addButton(
    new AACButton({
      id: 'wv-back',
      label: 'Back',
      message: 'Back',
      x: 0,
      y: 0,
      rowSpan: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_BACK,
      },
    })
  );

  // Zoom controls (col 0)
  view.addButton(
    new AACButton({
      id: 'wv-zoomin',
      label: 'Zoom+',
      message: 'Zoom in',
      x: 0,
      y: 2,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        parameters: { action: 'zoom' },
        platformData: { grid3: { commandId: 'WebBrowser.ZoomIn', parameters: {} } },
      },
    })
  );

  view.addButton(
    new AACButton({
      id: 'wv-zoomout',
      label: 'Zoom-',
      message: 'Zoom out',
      x: 0,
      y: 3,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        parameters: { action: 'zoom' },
        platformData: { grid3: { commandId: 'WebBrowser.ZoomOut', parameters: {} } },
      },
    })
  );

  // Reading mode
  view.addButton(
    new AACButton({
      id: 'wv-reading',
      label: 'Reading',
      message: 'Reading mode',
      x: 0,
      y: 4,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.TOGGLE_STATE,
        parameters: { target: 'reading' },
        platformData: {
          grid3: { commandId: 'WebBrowser.ReadingMode', parameters: { action: 'Toggle' } },
        },
      },
    })
  );

  // Scroll left/right (bottom)
  view.addButton(
    new AACButton({
      id: 'wv-scrollleft',
      label: 'Left',
      message: 'Scroll left',
      x: 0,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        parameters: { direction: 'left' },
        platformData: { grid3: { commandId: 'WebBrowser.ScrollLeft', parameters: {} } },
      },
    })
  );

  view.addButton(
    new AACButton({
      id: 'wv-scrollright',
      label: 'Right',
      message: 'Scroll right',
      x: 1,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        parameters: { direction: 'right' },
        platformData: { grid3: { commandId: 'WebBrowser.ScrollRight', parameters: {} } },
      },
    })
  );

  // Scroll (col 9)
  view.addButton(
    new AACButton({
      id: 'wv-scrollup',
      label: 'Up',
      message: 'Scroll up',
      x: 9,
      y: 2,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        platformData: {
          grid3: { commandId: 'WebBrowser.ScrollUp', parameters: { size: 'Small' } },
        },
      },
    })
  );

  view.addButton(
    new AACButton({
      id: 'wv-scrolldown',
      label: 'Down',
      message: 'Scroll down',
      x: 9,
      y: 3,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        platformData: {
          grid3: { commandId: 'WebBrowser.ScrollDown', parameters: { size: 'Small' } },
        },
      },
    })
  );

  // Zoom out (col 9)
  view.addButton(
    new AACButton({
      id: 'wv-zoomout2',
      label: 'Zoom-',
      message: 'Zoom out',
      x: 9,
      y: 4,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        platformData: { grid3: { commandId: 'WebBrowser.ZoomOut', parameters: {} } },
      },
    })
  );

  // Activate (col 9)
  view.addButton(
    new AACButton({
      id: 'wv-activate',
      label: 'Click',
      message: 'Activate',
      x: 9,
      y: 5,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_ACTIVATE_ELEMENT,
        platformData: { grid3: { commandId: 'WebBrowser.ActivateElement', parameters: {} } },
      },
    })
  );

  // Prev/Next (col 9)
  view.addButton(
    new AACButton({
      id: 'wv-prev',
      label: 'Prev',
      message: 'Previous',
      x: 9,
      y: 1,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_FOCUS_ELEMENT,
        platformData: { grid3: { commandId: 'WebBrowser.PreviousElement', parameters: {} } },
      },
    })
  );

  // Nav row at bottom
  view.addButton(
    new AACButton({
      id: 'wv-gobrowser',
      label: 'Browser',
      message: 'Browser',
      x: 2,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-browser',
      },
    })
  );

  view.addButton(
    new AACButton({
      id: 'wv-webback',
      label: 'Back',
      message: 'Browser back',
      x: 3,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_NAVIGATE,
        platformData: { grid3: { commandId: 'WebBrowser.Back', parameters: {} } },
      },
    })
  );

  view.addButton(
    new AACButton({
      id: 'wv-webfwd',
      label: 'Fwd',
      message: 'Forward',
      x: 4,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_NAVIGATE,
        platformData: { grid3: { commandId: 'WebBrowser.Forward', parameters: {} } },
      },
    })
  );

  view.addButton(
    new AACButton({
      id: 'wv-reload',
      label: 'Reload',
      message: 'Reload',
      x: 5,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_NAVIGATE,
        platformData: { grid3: { commandId: 'WebBrowser.Reload', parameters: {} } },
      },
    })
  );

  // --- Web Browser Search ---
  // Workspace at top showing browser, search controls below
  const search = new AACPage({
    id: 'web-search',
    name: 'Web Browser - search',
    grid: { columns: 10, rows: 7 },
  });
  search.addButton(ws(1, 1, 8, 4));

  search.addButton(
    new AACButton({
      id: 'ws-home',
      label: 'Home',
      message: 'Home',
      x: 0,
      y: 0,
      rowSpan: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_HOME,
      },
    })
  );

  search.addButton(
    new AACButton({
      id: 'ws-gobrowser',
      label: 'Browser',
      message: 'Browser',
      x: 0,
      y: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-browser',
      },
    })
  );

  search.addButton(
    new AACButton({
      id: 'ws-back',
      label: 'Back',
      message: 'Back',
      x: 0,
      y: 3,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_BACK,
      },
    })
  );

  // Google
  search.addButton(
    new AACButton({
      id: 'ws-google',
      label: 'Google',
      message: 'Google',
      x: 1,
      y: 5,
      style: { backgroundColor: '#3498DBFF' },
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_NAVIGATE,
        text: 'https://www.google.com',
        platformData: {
          grid3: {
            commandId: 'WebBrowser.NavigateUrl',
            parameters: { url: 'https://www.google.com' },
          },
        },
      },
    })
  );

  // Wikipedia
  search.addButton(
    new AACButton({
      id: 'ws-wiki',
      label: 'Wikipedia',
      message: 'Wikipedia',
      x: 2,
      y: 5,
      style: { backgroundColor: '#3498DBFF' },
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_NAVIGATE,
        text: 'https://en.wikipedia.org',
        platformData: {
          grid3: {
            commandId: 'WebBrowser.NavigateUrl',
            parameters: { url: 'https://en.wikipedia.org' },
          },
        },
      },
    })
  );

  // Search field focus + jump to keyboard
  search.addButton(
    new AACButton({
      id: 'ws-typesearch',
      label: 'Type Search',
      message: 'Search',
      x: 3,
      y: 5,
      style: { backgroundColor: '#27AE60FF' },
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-keyboard',
      },
    })
  );

  // Navigate to URL page
  search.addButton(
    new AACButton({
      id: 'ws-urlpage',
      label: 'URL',
      message: 'Enter URL',
      x: 4,
      y: 5,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-url',
      },
    })
  );

  // Activate
  search.addButton(
    new AACButton({
      id: 'ws-activate',
      label: 'Click',
      message: 'Activate',
      x: 5,
      y: 5,
      style: { backgroundColor: '#F39C12FF' },
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_ACTIVATE_ELEMENT,
        platformData: { grid3: { commandId: 'WebBrowser.ActivateElement', parameters: {} } },
      },
    })
  );

  // Scroll controls (col 9)
  search.addButton(
    new AACButton({
      id: 'ws-scrollup',
      label: 'Up',
      message: 'Scroll up',
      x: 9,
      y: 2,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        platformData: {
          grid3: { commandId: 'WebBrowser.ScrollUp', parameters: { size: 'Medium' } },
        },
      },
    })
  );

  search.addButton(
    new AACButton({
      id: 'ws-scrolldown',
      label: 'Down',
      message: 'Scroll down',
      x: 9,
      y: 3,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_SCROLL,
        platformData: {
          grid3: { commandId: 'WebBrowser.ScrollDown', parameters: { size: 'Medium' } },
        },
      },
    })
  );

  // --- Web Browser URL ---
  // Has address bar workspace
  const url = new AACPage({
    id: 'web-url',
    name: 'Web Browser - URL',
    grid: { columns: 10, rows: 7 },
  });
  // Small workspace at top to show current page
  url.addButton(ws(1, 1, 8, 2));
  // Address bar workspace
  url.addButton(
    new AACButton({
      id: 'wu-address',
      label: '',
      message: '',
      x: 1,
      y: 3,
      columnSpan: 8,
      rowSpan: 1,
      contentType: 'Workspace',
      contentSubType: 'WebAddress.AddressBar',
      style: { backgroundColor: '#FAFAFAFF' },
    })
  );

  url.addButton(
    new AACButton({
      id: 'wu-home',
      label: 'Home',
      message: 'Home',
      x: 0,
      y: 0,
      rowSpan: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_HOME,
      },
    })
  );

  url.addButton(
    new AACButton({
      id: 'wu-gobrowser',
      label: 'Browser',
      message: 'Browser',
      x: 0,
      y: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-browser',
      },
    })
  );

  // Go to address
  url.addButton(
    new AACButton({
      id: 'wu-go',
      label: 'Go',
      message: 'Go',
      x: 0,
      y: 3,
      style: { backgroundColor: '#27AE60FF' },
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_NAVIGATE,
        platformData: { grid3: { commandId: 'WebAddress.Go', parameters: {} } },
      },
    })
  );

  // Keyboard for typing URL
  const urlLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:/'.split('');
  const urlRowStart = 4;
  const urlColStart = 0;
  urlLetters.forEach((ch, i) => {
    const col = urlColStart + (i % 10);
    const row = urlRowStart + Math.floor(i / 10);
    if (row >= 7) return;
    const isAction = ch === '.' || ch === ':' || ch === '/';
    url.addButton(
      new AACButton({
        id: `wu-char-${ch.charCodeAt(0)}`,
        label: ch,
        message: ch,
        x: col,
        y: row,
        style: isAction ? { backgroundColor: '#D5DBDBFF' } : undefined,
        semanticAction: {
          category: AACSemanticCategory.TEXT_EDITING,
          intent: AACSemanticIntent.INSERT_TEXT,
          text: ch,
          platformData: { grid3: { commandId: 'Action.Letter', parameters: { letter: ch } } },
        },
      })
    );
  });

  // Space
  url.addButton(
    new AACButton({
      id: 'wu-space',
      label: 'Space',
      message: ' ',
      x: 0,
      y: 6,
      columnSpan: 2,
      semanticAction: {
        category: AACSemanticCategory.TEXT_EDITING,
        intent: AACSemanticIntent.INSERT_TEXT,
        text: ' ',
        platformData: { grid3: { commandId: 'Action.Space', parameters: {} } },
      },
    })
  );

  // Delete
  url.addButton(
    new AACButton({
      id: 'wu-del',
      label: 'Del',
      message: 'Delete',
      x: 2,
      y: 6,
      style: { backgroundColor: '#E74C3CFF' },
      semanticAction: {
        category: AACSemanticCategory.TEXT_EDITING,
        intent: AACSemanticIntent.DELETE_CHARACTER,
        platformData: { grid3: { commandId: 'Action.DeleteLetter', parameters: {} } },
      },
    })
  );

  // Clear
  url.addButton(
    new AACButton({
      id: 'wu-clear',
      label: 'Clear',
      message: 'Clear',
      x: 3,
      y: 6,
      style: { backgroundColor: '#E74C3CFF' },
      semanticAction: {
        category: AACSemanticCategory.TEXT_EDITING,
        intent: AACSemanticIntent.CLEAR_TEXT,
      },
    })
  );

  // Enter
  url.addButton(
    new AACButton({
      id: 'wu-enter',
      label: 'Enter',
      message: 'Enter',
      x: 4,
      y: 6,
      style: { backgroundColor: '#27AE60FF' },
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.SEND_KEYS,
        text: '{ENTER}',
        platformData: {
          grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{ENTER}' } },
        },
      },
    })
  );

  // Back to browser
  url.addButton(
    new AACButton({
      id: 'wu-backbrowser',
      label: 'Browser',
      message: 'Browser',
      x: 5,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-browser',
      },
    })
  );

  // --- Web Browser Keyboard ---
  // Workspace at top (2 rows showing current page), keyboard below
  const kb = new AACPage({
    id: 'web-keyboard',
    name: 'Web Browser - keyboard',
    grid: { columns: 10, rows: 7 },
  });
  kb.addButton(ws(1, 0, 8, 2));

  kb.addButton(
    new AACButton({
      id: 'wk-home',
      label: 'Home',
      message: 'Home',
      x: 0,
      y: 0,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_HOME,
      },
    })
  );

  kb.addButton(
    new AACButton({
      id: 'wk-back',
      label: 'Back',
      message: 'Back',
      x: 0,
      y: 1,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_BACK,
      },
    })
  );

  // QWERTY rows starting at row 2
  const kbRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];
  kbRows.forEach((row, ri) => {
    const offset = ri === 1 ? 1 : ri === 2 ? 2 : 0;
    row.forEach((letter, ci) => {
      kb.addButton(
        new AACButton({
          id: `wk-${letter}`,
          label: letter,
          message: letter,
          x: ci + offset,
          y: ri + 2,
          semanticAction: {
            category: AACSemanticCategory.TEXT_EDITING,
            intent: AACSemanticIntent.INSERT_TEXT,
            text: letter,
            platformData: { grid3: { commandId: 'Action.Letter', parameters: { letter } } },
          },
        })
      );
    });
  });

  // Space bar
  kb.addButton(
    new AACButton({
      id: 'wk-space',
      label: 'Space',
      message: ' ',
      x: 1,
      y: 5,
      columnSpan: 4,
      style: { backgroundColor: '#D5DBDBFF' },
      semanticAction: {
        category: AACSemanticCategory.TEXT_EDITING,
        intent: AACSemanticIntent.INSERT_TEXT,
        text: ' ',
        platformData: { grid3: { commandId: 'Action.Space', parameters: {} } },
      },
    })
  );

  // Delete
  kb.addButton(
    new AACButton({
      id: 'wk-del',
      label: 'Del',
      message: 'Delete',
      x: 5,
      y: 5,
      style: { backgroundColor: '#E74C3CFF' },
      semanticAction: {
        category: AACSemanticCategory.TEXT_EDITING,
        intent: AACSemanticIntent.DELETE_CHARACTER,
        platformData: { grid3: { commandId: 'Action.DeleteLetter', parameters: {} } },
      },
    })
  );

  // Enter
  kb.addButton(
    new AACButton({
      id: 'wk-enter',
      label: 'Enter',
      message: 'Enter',
      x: 6,
      y: 5,
      columnSpan: 2,
      style: { backgroundColor: '#27AE60FF' },
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.SEND_KEYS,
        text: '{ENTER}',
        platformData: {
          grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{ENTER}' } },
        },
      },
    })
  );

  // Back to browser
  kb.addButton(
    new AACButton({
      id: 'wk-gobrowser',
      label: 'Browser',
      message: 'Browser',
      x: 8,
      y: 5,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-browser',
      },
    })
  );

  // Speak
  kb.addButton(
    new AACButton({
      id: 'wk-speak',
      label: 'Speak',
      message: 'Speak',
      x: 9,
      y: 5,
      style: { backgroundColor: '#27AE60FF' },
      semanticAction: {
        category: AACSemanticCategory.COMMUNICATION,
        intent: AACSemanticIntent.SPEAK_TEXT,
      },
    })
  );

  // Row 6: punctuation
  const puncts = ['.', ',', '?', '!', "'", '-', '@', '#'];
  puncts.forEach((p, i) => {
    kb.addButton(
      new AACButton({
        id: `wk-punct-${i}`,
        label: p,
        message: p,
        x: i + 1,
        y: 6,
        semanticAction: {
          category: AACSemanticCategory.TEXT_EDITING,
          intent: AACSemanticIntent.INSERT_TEXT,
          text: p,
          platformData: { grid3: { commandId: 'Action.Punctuation', parameters: { letter: p } } },
        },
      })
    );
  });

  // --- Favourites page (with workspace showing browser behind) ---
  const favs = new AACPage({
    id: 'web-favourites',
    name: 'Web Browser - favourites',
    grid: { columns: 10, rows: 7 },
  });
  favs.addButton(ws(1, 1, 8, 4));

  favs.addButton(
    new AACButton({
      id: 'wf-home',
      label: 'Home',
      message: 'Home',
      x: 0,
      y: 0,
      rowSpan: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_HOME,
      },
    })
  );

  favs.addButton(
    new AACButton({
      id: 'wf-back',
      label: 'Back',
      message: 'Back',
      x: 0,
      y: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_BACK,
      },
    })
  );

  favs.addButton(
    new AACButton({
      id: 'wf-gobrowser',
      label: 'Browser',
      message: 'Browser',
      x: 0,
      y: 3,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-browser',
      },
    })
  );

  const favSites = [
    { label: 'Google', url: 'https://www.google.com', x: 1, y: 5 },
    { label: 'YouTube', url: 'https://www.youtube.com', x: 2, y: 5 },
    { label: 'Wikipedia', url: 'https://www.wikipedia.org', x: 3, y: 5 },
    { label: 'BBC', url: 'https://www.bbc.co.uk/news', x: 4, y: 5 },
    { label: 'GitHub', url: 'https://github.com', x: 5, y: 5 },
    { label: 'Reddit', url: 'https://www.reddit.com', x: 6, y: 5 },
    { label: 'Amazon', url: 'https://www.amazon.com', x: 7, y: 5 },
    { label: 'X/Twitter', url: 'https://x.com', x: 8, y: 5 },
    { label: 'Facebook', url: 'https://www.facebook.com', x: 1, y: 6 },
    { label: 'Netflix', url: 'https://www.netflix.com', x: 2, y: 6 },
  ];

  favSites.forEach((site) => {
    favs.addButton(
      new AACButton({
        id: `wf-${site.label.replace(/[^a-z]/gi, '')}`,
        label: site.label,
        message: site.label,
        x: site.x,
        y: site.y,
        style: { backgroundColor: '#D4E6F1FF' },
        semanticAction: {
          category: AACSemanticCategory.SYSTEM_CONTROL,
          intent: AACSemanticIntent.WEB_NAVIGATE,
          text: site.url,
          platformData: {
            grid3: { commandId: 'WebBrowser.NavigateUrl', parameters: { url: site.url } },
          },
        },
      })
    );
  });

  // --- Links page (AutoContent links + workspace behind) ---
  const links = new AACPage({
    id: 'web-links',
    name: 'Web Browser - links',
    grid: { columns: 10, rows: 7 },
  });
  links.addButton(ws(1, 1, 8, 4));

  // AutoContent for links
  links.addButton(
    new AACButton({
      id: 'wl-autolinks',
      label: '',
      message: '',
      x: 1,
      y: 5,
      columnSpan: 8,
      rowSpan: 2,
      contentType: 'AutoContent',
      contentSubType: 'WebBrowser.Links',
    })
  );

  links.addButton(
    new AACButton({
      id: 'wl-home',
      label: 'Home',
      message: 'Home',
      x: 0,
      y: 0,
      rowSpan: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_HOME,
      },
    })
  );

  links.addButton(
    new AACButton({
      id: 'wl-back',
      label: 'Back',
      message: 'Back',
      x: 0,
      y: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_BACK,
      },
    })
  );

  links.addButton(
    new AACButton({
      id: 'wl-gobrowser',
      label: 'Browser',
      message: 'Browser',
      x: 0,
      y: 3,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.NAVIGATE_TO,
        targetId: 'web-browser',
      },
    })
  );

  // Activate and more links (bottom)
  links.addButton(
    new AACButton({
      id: 'wl-activate',
      label: 'Open',
      message: 'Activate',
      x: 0,
      y: 5,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_ACTIVATE_ELEMENT,
        platformData: { grid3: { commandId: 'WebBrowser.ActivateElement', parameters: {} } },
      },
    })
  );

  links.addButton(
    new AACButton({
      id: 'wl-more',
      label: 'More',
      message: 'More links',
      x: 0,
      y: 6,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_NAVIGATE,
        platformData: { grid3: { commandId: 'WebBrowser.MoreLinks', parameters: {} } },
      },
    })
  );

  // --- Navigate page (browser navigation controls) ---
  const nav = new AACPage({
    id: 'web-navigate',
    name: 'Web Browser - navigate',
    grid: { columns: 10, rows: 7 },
  });
  nav.addButton(ws(1, 1, 8, 6));

  nav.addButton(
    new AACButton({
      id: 'wn-home',
      label: 'Home',
      message: 'Home',
      x: 0,
      y: 0,
      rowSpan: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_HOME,
      },
    })
  );

  nav.addButton(
    new AACButton({
      id: 'wn-back',
      label: 'Back',
      message: 'Back',
      x: 0,
      y: 2,
      semanticAction: {
        category: AACSemanticCategory.NAVIGATION,
        intent: AACSemanticIntent.GO_BACK,
      },
    })
  );

  // Spatial nav (col 9)
  nav.addButton(
    new AACButton({
      id: 'wn-up',
      label: 'Up',
      message: 'Up',
      x: 9,
      y: 1,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_FOCUS_ELEMENT,
        parameters: { direction: 'up' },
        platformData: { grid3: { commandId: 'WebBrowser.SpatialNavigateUp', parameters: {} } },
      },
    })
  );

  nav.addButton(
    new AACButton({
      id: 'wn-left',
      label: 'Left',
      message: 'Left',
      x: 8,
      y: 2,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_FOCUS_ELEMENT,
        parameters: { direction: 'left' },
        platformData: { grid3: { commandId: 'WebBrowser.SpatialNavigateLeft', parameters: {} } },
      },
    })
  );

  nav.addButton(
    new AACButton({
      id: 'wn-right',
      label: 'Right',
      message: 'Right',
      x: 9,
      y: 2,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_FOCUS_ELEMENT,
        parameters: { direction: 'right' },
        platformData: { grid3: { commandId: 'WebBrowser.SpatialNavigateRight', parameters: {} } },
      },
    })
  );

  nav.addButton(
    new AACButton({
      id: 'wn-down',
      label: 'Down',
      message: 'Down',
      x: 9,
      y: 3,
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_FOCUS_ELEMENT,
        parameters: { direction: 'down' },
        platformData: { grid3: { commandId: 'WebBrowser.SpatialNavigateDown', parameters: {} } },
      },
    })
  );

  nav.addButton(
    new AACButton({
      id: 'wn-activate',
      label: 'Click',
      message: 'Activate',
      x: 9,
      y: 4,
      style: { backgroundColor: '#F39C12FF' },
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.WEB_ACTIVATE_ELEMENT,
        platformData: { grid3: { commandId: 'WebBrowser.ActivateElement', parameters: {} } },
      },
    })
  );

  // Assemble
  tree.addPage(main);
  tree.addPage(view);
  tree.addPage(search);
  tree.addPage(url);
  tree.addPage(kb);
  tree.addPage(favs);
  tree.addPage(links);
  tree.addPage(nav);
  tree.rootId = 'web-browser';

  // Save
  const outPath = path.join(__dirname, 'Web Browser.gridset');
  const processor = new GridsetProcessor({ preserveAllButtons: true });
  await processor.saveFromTree(tree, outPath);

  // Verify
  const fs = await import('fs');
  const buffer = fs.readFileSync(outPath);
  const reloaded = await processor.loadIntoTree(buffer);
  console.log(`\n=== Web Browser Gridset ===`);
  console.log(`Created: ${outPath}`);
  console.log(`Pages: ${Object.keys(reloaded.pages).length}`);
  for (const [id, page] of Object.entries(reloaded.pages)) {
    const wsBtns = page.buttons.filter(
      (b) => b.contentType === 'Workspace' || b.contentType === 'LiveCell'
    );
    console.log(
      `\n  "${page.name}" (${id}): ${page.buttons.length} buttons, ${wsBtns.length} workspace/livecell`
    );
    for (const btn of wsBtns) {
      console.log(
        `    WORKSPACE: ${btn.contentType}/${btn.contentSubType} @ (${btn.x},${btn.y}) span=(${btn.columnSpan}x${btn.rowSpan})`
      );
    }
  }
}

main().catch(console.error);

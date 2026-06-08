import {
  AACTree,
  AACPage,
  AACButton,
  AACSemanticCategory,
  AACSemanticIntent,
  GridsetProcessor,
} from '../src/index.node';
import type { GridSetMetadata } from '../src/types/aac';
import path from 'path';

function ccWs(x: number, y: number, colSpan: number, rowSpan: number): AACButton {
  return new AACButton({
    id: `ws-${x}-${y}-${colSpan}x${rowSpan}`,
    label: '',
    message: '',
    x, y,
    columnSpan: colSpan,
    rowSpan: rowSpan,
    contentType: 'Workspace',
    contentSubType: 'ComputerControl',
    style: { backgroundColor: '#FFFFFFFF' },
  });
}

async function main() {
  const tree = new AACTree();
  tree.metadata = {
    format: 'gridset',
    name: 'Computer Control',
    description: 'Computer control gridset',
    author: 'AAC Processors',
    locale: 'en-US',
    languages: ['en-US'],
    version: '1.0',
    id: 'test-computer-control',
    appearance: { textAtTop: true, computerControlCellSize: 1 },
  } as GridSetMetadata;

  // ============================================================
  // LAYOUT PATTERN (matches WhatsApp/Facebook originals):
  //   10 cols × 6 rows
  //   Col 0-7: ComputerControl workspace (spans most of grid)
  //   Col 8-9: Control buttons on the right
  //   Keyboard pages: workspace only 2 rows high at top
  // ============================================================

  // --- Home page (launcher - no workspace, like WhatsApp Start) ---
  const home = new AACPage({ id: 'home', name: 'Home', grid: { columns: 5, rows: 4 } });

  home.addButton(new AACButton({
    id: 'h-keyboard',
    label: 'Keyboard',
    message: 'Keyboard',
    x: 0, y: 0,
    style: { backgroundColor: '#3498DBFF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.NAVIGATE_TO, targetId: 'keyboard' },
  }));

  home.addButton(new AACButton({
    id: 'h-mouse',
    label: 'Mouse',
    message: 'Mouse',
    x: 1, y: 0,
    style: { backgroundColor: '#2ECC71FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.NAVIGATE_TO, targetId: 'mouse' },
  }));

  home.addButton(new AACButton({
    id: 'h-shortcuts',
    label: 'Shortcuts',
    message: 'Shortcuts',
    x: 2, y: 0,
    style: { backgroundColor: '#E67E22FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.NAVIGATE_TO, targetId: 'shortcuts' },
  }));

  home.addButton(new AACButton({
    id: 'h-system',
    label: 'System',
    message: 'System',
    x: 3, y: 0,
    style: { backgroundColor: '#9B59B6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.NAVIGATE_TO, targetId: 'system' },
  }));

  home.addButton(new AACButton({
    id: 'h-media',
    label: 'Media',
    message: 'Media',
    x: 4, y: 0,
    style: { backgroundColor: '#E74C3CFF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.NAVIGATE_TO, targetId: 'media' },
  }));

  home.addButton(new AACButton({
    id: 'h-photos',
    label: 'Photos',
    message: 'Photos',
    x: 0, y: 1,
    style: { backgroundColor: '#1ABC9CFF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.NAVIGATE_TO, targetId: 'photos' },
  }));

  home.addButton(new AACButton({
    id: 'h-web',
    label: 'Web',
    message: 'Web',
    x: 1, y: 1,
    style: { backgroundColor: '#F39C12FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.NAVIGATE_TO, targetId: 'web' },
  }));

  const phrases = ['hello', 'yes', 'no', 'help', 'please', 'thank you', 'more', 'stop'];
  phrases.forEach((phrase, i) => {
    home.addButton(new AACButton({
      id: `h-phrase-${i}`,
      label: phrase,
      message: phrase,
      x: i % 5, y: 2 + Math.floor(i / 5),
      semanticAction: {
        category: AACSemanticCategory.COMMUNICATION,
        intent: AACSemanticIntent.INSERT_TEXT,
        text: phrase,
      },
    }));
  });

  // --- Keyboard page ---
  // Pattern from WhatsApp Keyboard: workspace at top (8 cols × 2 rows), keyboard below, controls on right
  const keyboard = new AACPage({ id: 'keyboard', name: 'Keyboard', grid: { columns: 10, rows: 6 } });

  // Workspace showing computer screen at top (like WhatsApp has WebBrowser at top for chat)
  keyboard.addButton(ccWs(0, 0, 8, 2));

  // Right column: Home, Back
  keyboard.addButton(new AACButton({
    id: 'kb-home',
    label: 'Home',
    message: 'Home',
    x: 8, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_HOME },
  }));

  keyboard.addButton(new AACButton({
    id: 'kb-back',
    label: 'Back',
    message: 'Back',
    x: 9, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_BACK },
  }));

  // Shift toggle
  keyboard.addButton(new AACButton({
    id: 'kb-shift',
    label: 'Shift',
    message: 'Shift',
    x: 8, y: 1,
    style: { backgroundColor: '#F1C40FFF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.TOGGLE_STATE,
      parameters: { target: 'shift' },
      platformData: { grid3: { commandId: 'ComputerControl.Shift', parameters: { action: 'Toggle' } } },
    },
  }));

  // Enter
  keyboard.addButton(new AACButton({
    id: 'kb-enter',
    label: 'Enter',
    message: 'Enter',
    x: 9, y: 1,
    style: { backgroundColor: '#27AE60FF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.SEND_KEYS,
      text: '{ENTER}',
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{ENTER}' } } },
    },
  }));

  // QWERTY rows (rows 2-4)
  const kbRows = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['Z','X','C','V','B','N','M'],
  ];
  kbRows.forEach((row, ri) => {
    const offset = ri === 1 ? 1 : ri === 2 ? 2 : 0;
    row.forEach((letter, ci) => {
      keyboard.addButton(new AACButton({
        id: `kb-${letter}`,
        label: letter,
        message: letter,
        x: ci + offset, y: ri + 2,
        semanticAction: {
          category: AACSemanticCategory.TEXT_EDITING,
          intent: AACSemanticIntent.INSERT_TEXT,
          text: letter,
          platformData: { grid3: { commandId: 'Action.Letter', parameters: { letter } } },
        },
      }));
    });
  });

  // Row 5: Space, Del, Tab, Esc
  keyboard.addButton(new AACButton({
    id: 'kb-space',
    label: 'Space',
    message: ' ',
    x: 0, y: 5, columnSpan: 3,
    style: { backgroundColor: '#D5DBDBFF' },
    semanticAction: {
      category: AACSemanticCategory.TEXT_EDITING,
      intent: AACSemanticIntent.INSERT_TEXT,
      text: ' ',
      platformData: { grid3: { commandId: 'Action.Space', parameters: {} } },
    },
  }));

  keyboard.addButton(new AACButton({
    id: 'kb-del',
    label: 'Del',
    message: 'Delete',
    x: 3, y: 5,
    style: { backgroundColor: '#E74C3CFF' },
    semanticAction: {
      category: AACSemanticCategory.TEXT_EDITING,
      intent: AACSemanticIntent.DELETE_CHARACTER,
      platformData: { grid3: { commandId: 'Action.DeleteLetter', parameters: {} } },
    },
  }));

  keyboard.addButton(new AACButton({
    id: 'kb-tab',
    label: 'Tab',
    message: 'Tab',
    x: 4, y: 5,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.SEND_KEYS,
      text: '{TAB}',
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{TAB}' } } },
    },
  }));

  keyboard.addButton(new AACButton({
    id: 'kb-esc',
    label: 'Esc',
    message: 'Escape',
    x: 5, y: 5,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.SEND_KEYS,
      text: '{ESC}',
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{ESC}' } } },
    },
  }));

  // Arrow keys
  keyboard.addButton(new AACButton({
    id: 'kb-up',
    label: 'Up',
    message: 'Up',
    x: 7, y: 4,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.SEND_KEYS,
      text: '{UP}',
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{UP}' } } },
    },
  }));

  keyboard.addButton(new AACButton({
    id: 'kb-left',
    label: 'Left',
    message: 'Left',
    x: 6, y: 5,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.SEND_KEYS,
      text: '{LEFT}',
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{LEFT}' } } },
    },
  }));

  keyboard.addButton(new AACButton({
    id: 'kb-down',
    label: 'Down',
    message: 'Down',
    x: 7, y: 5,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.SEND_KEYS,
      text: '{DOWN}',
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{DOWN}' } } },
    },
  }));

  keyboard.addButton(new AACButton({
    id: 'kb-right',
    label: 'Right',
    message: 'Right',
    x: 8, y: 5,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.SEND_KEYS,
      text: '{RIGHT}',
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{RIGHT}' } } },
    },
  }));

  // Ctrl shortcuts
  keyboard.addButton(new AACButton({
    id: 'kb-copy',
    label: 'Copy',
    message: 'Copy',
    x: 8, y: 2,
    semanticAction: {
      category: AACSemanticCategory.TEXT_EDITING,
      intent: AACSemanticIntent.COPY_TEXT,
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{LEFTCONTROL}c' } } },
    },
  }));

  keyboard.addButton(new AACButton({
    id: 'kb-paste',
    label: 'Paste',
    message: 'Paste',
    x: 9, y: 2,
    semanticAction: {
      category: AACSemanticCategory.TEXT_EDITING,
      intent: AACSemanticIntent.PASTE_TEXT,
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{LEFTCONTROL}v' } } },
    },
  }));

  keyboard.addButton(new AACButton({
    id: 'kb-undo',
    label: 'Undo',
    message: 'Undo',
    x: 8, y: 3,
    semanticAction: {
      category: AACSemanticCategory.TEXT_EDITING,
      intent: AACSemanticIntent.UNDO,
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{LEFTCONTROL}z' } } },
    },
  }));

  keyboard.addButton(new AACButton({
    id: 'kb-selectall',
    label: 'Sel All',
    message: 'Select All',
    x: 9, y: 3,
    semanticAction: {
      category: AACSemanticCategory.TEXT_EDITING,
      intent: AACSemanticIntent.SELECT_ALL,
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{LEFTCONTROL}a' } } },
    },
  }));

  keyboard.addButton(new AACButton({
    id: 'kb-delword',
    label: 'Del Word',
    message: 'Delete Word',
    x: 9, y: 5,
    style: { backgroundColor: '#E74C3CFF' },
    semanticAction: {
      category: AACSemanticCategory.TEXT_EDITING,
      intent: AACSemanticIntent.DELETE_WORD,
    },
  }));

  // --- Mouse page (workspace showing desktop) ---
  const mouse = new AACPage({ id: 'mouse', name: 'Mouse', grid: { columns: 10, rows: 6 } });
  mouse.addButton(ccWs(0, 0, 8, 6));

  mouse.addButton(new AACButton({
    id: 'ms-home',
    label: 'Home',
    message: 'Home',
    x: 8, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_HOME },
  }));

  mouse.addButton(new AACButton({
    id: 'ms-back',
    label: 'Back',
    message: 'Back',
    x: 9, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_BACK },
  }));

  mouse.addButton(new AACButton({
    id: 'ms-leftclick',
    label: 'Left Click',
    message: 'Click',
    x: 8, y: 1, columnSpan: 2, rowSpan: 2,
    style: { backgroundColor: '#3498DBFF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.MOUSE_CLICK,
      parameters: { clickType: 'left' },
      platformData: { grid3: { commandId: 'ComputerControl.LeftClick', parameters: {} } },
    },
  }));

  mouse.addButton(new AACButton({
    id: 'ms-rightclick',
    label: 'Right Click',
    message: 'Right Click',
    x: 8, y: 3, columnSpan: 2,
    style: { backgroundColor: '#E67E22FF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.MOUSE_CLICK,
      parameters: { clickType: 'right' },
      platformData: { grid3: { commandId: 'ComputerControl.RightClick', parameters: {} } },
    },
  }));

  mouse.addButton(new AACButton({
    id: 'ms-dblclick',
    label: 'Double',
    message: 'Double Click',
    x: 8, y: 4, columnSpan: 2,
    style: { backgroundColor: '#9B59B6FF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.MOUSE_CLICK,
      parameters: { clickType: 'double' },
      platformData: { grid3: { commandId: 'ComputerControl.DoubleClick', parameters: {} } },
    },
  }));

  // Arrow movement (within workspace area)
  const mouseMoves = [
    { label: 'Up', key: '{UP}', x: 4, y: 1 },
    { label: 'Left', key: '{LEFT}', x: 3, y: 2 },
    { label: 'Right', key: '{RIGHT}', x: 5, y: 2 },
    { label: 'Down', key: '{DOWN}', x: 4, y: 3 },
  ];
  mouseMoves.forEach((m, i) => {
    mouse.addButton(new AACButton({
      id: `ms-move-${i}`,
      label: m.label,
      message: `Move ${m.label}`,
      x: m.x, y: m.y,
      style: { backgroundColor: '#D5DBDBCC' },
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.SEND_KEYS,
        text: m.key,
        platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: m.key } } },
      },
    }));
  });

  // Move small / large
  mouse.addButton(new AACButton({
    id: 'ms-movefast',
    label: 'Fast',
    message: 'Move fast',
    x: 8, y: 5,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
      platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: '{UP}{UP}{UP}' } } },
    },
  }));

  mouse.addButton(new AACButton({
    id: 'ms-moveslow',
    label: 'Slow',
    message: 'Move slow',
    x: 9, y: 5,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
      platformData: { grid3: { commandId: 'CommandExecution.Wait', parameters: { waittime: '00:00:00.5000000' } } },
    },
  }));

  // --- Shortcuts page (workspace showing desktop) ---
  const shortcuts = new AACPage({ id: 'shortcuts', name: 'Shortcuts', grid: { columns: 10, rows: 6 } });
  shortcuts.addButton(ccWs(0, 0, 8, 6));

  shortcuts.addButton(new AACButton({
    id: 'sc-home',
    label: 'Home',
    message: 'Home',
    x: 8, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_HOME },
  }));

  shortcuts.addButton(new AACButton({
    id: 'sc-back',
    label: 'Back',
    message: 'Back',
    x: 9, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_BACK },
  }));

  const shortcutKeys = [
    { label: 'Copy', key: '{LEFTCONTROL}c', y: 1 },
    { label: 'Paste', key: '{LEFTCONTROL}v', y: 1 },
    { label: 'Cut', key: '{LEFTCONTROL}x', y: 1 },
    { label: 'Undo', key: '{LEFTCONTROL}z', y: 1 },
    { label: 'Save', key: '{LEFTCONTROL}s', y: 2 },
    { label: 'Select All', key: '{LEFTCONTROL}a', y: 2 },
    { label: 'Find', key: '{LEFTCONTROL}f', y: 2 },
    { label: 'Close', key: '{LEFTALT}{F4}', y: 2 },
    { label: 'Switch App', key: '{LEFTALT}{TAB}', y: 3 },
    { label: 'Desktop', key: '{WIN}d', y: 3 },
    { label: 'File Explr', key: '{WIN}e', y: 3 },
    { label: 'Lock', key: '{LEFTCONTROL}l', y: 3 },
    { label: 'Next Tab', key: '{LEFTCONTROL}{TAB}', y: 4 },
    { label: 'Close Tab', key: '{LEFTCONTROL}w', y: 4 },
    { label: 'Refresh', key: '{F5}', y: 4 },
    { label: 'Delete', key: '{DELETE}', y: 4 },
    { label: 'F2 (Rename)', key: '{F2}', y: 5 },
    { label: 'F11 (Full)', key: '{F11}', y: 5 },
    { label: 'PrtScn', key: '{PRTSC}', y: 5 },
  ];

  shortcutKeys.forEach((sc) => {
    const colStart = 8;
    shortcuts.addButton(new AACButton({
      id: `sc-${sc.label.replace(/\s/g, '')}`,
      label: sc.label,
      message: sc.label,
      x: colStart + (shortcutKeys.filter(s => s.y === sc.y).indexOf(sc) % 2 === 0 ? 0 : 1),
      y: sc.y,
      style: { backgroundColor: '#D4E6F1FF' },
      semanticAction: {
        category: AACSemanticCategory.SYSTEM_CONTROL,
        intent: AACSemanticIntent.SEND_KEYS,
        text: sc.key,
        platformData: { grid3: { commandId: 'ComputerControl.Keyboard', parameters: { keystring: sc.key } } },
      },
    }));
  });

  // --- System page (workspace showing desktop) ---
  const system = new AACPage({ id: 'system', name: 'System', grid: { columns: 10, rows: 6 } });
  system.addButton(ccWs(0, 0, 8, 6));

  system.addButton(new AACButton({
    id: 'sy-home',
    label: 'Home',
    message: 'Home',
    x: 8, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_HOME },
  }));

  system.addButton(new AACButton({
    id: 'sy-back',
    label: 'Back',
    message: 'Back',
    x: 9, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_BACK },
  }));

  // Mute
  system.addButton(new AACButton({
    id: 'sy-mute',
    label: 'Mute',
    message: 'Mute',
    x: 8, y: 1,
    style: { backgroundColor: '#E74C3CFF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.DEVICE_MUTE,
      platformData: { grid3: { commandId: 'ComputerControl.DeviceMute', parameters: { indicatorenabled: '1' } } },
    },
  }));

  system.addButton(new AACButton({
    id: 'sy-volup',
    label: 'Vol +',
    message: 'Volume Up',
    x: 9, y: 1,
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.PLAY_VIDEO,
      parameters: { mediaAction: 'VolumeUp' },
      platformData: { grid3: { commandId: 'Media.VolumeUp', parameters: {} } },
    },
  }));

  system.addButton(new AACButton({
    id: 'sy-voldown',
    label: 'Vol -',
    message: 'Volume Down',
    x: 8, y: 2,
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.PLAY_VIDEO,
      parameters: { mediaAction: 'VolumeDown' },
      platformData: { grid3: { commandId: 'Media.VolumeDown', parameters: {} } },
    },
  }));

  system.addButton(new AACButton({
    id: 'sy-winkey',
    label: 'Windows',
    message: 'Start',
    x: 9, y: 2,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.SEND_KEYS,
      platformData: { grid3: { commandId: 'ComputerControl.WindowsKey', parameters: {} } },
    },
  }));

  system.addButton(new AACButton({
    id: 'sy-lock',
    label: 'Lock',
    message: 'Lock',
    x: 8, y: 3,
    style: { backgroundColor: '#7F8C8DFF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
      platformData: { grid3: { commandId: 'System.Lock', parameters: {} } },
    },
  }));

  system.addButton(new AACButton({
    id: 'sy-sleep',
    label: 'Sleep',
    message: 'Sleep',
    x: 9, y: 3,
    style: { backgroundColor: '#7F8C8DFF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
      platformData: { grid3: { commandId: 'System.Sleep', parameters: {} } },
    },
  }));

  system.addButton(new AACButton({
    id: 'sy-stopspeech',
    label: 'Stop Speech',
    message: 'Stop Speech',
    x: 8, y: 4,
    semanticAction: {
      category: AACSemanticCategory.COMMUNICATION,
      intent: AACSemanticIntent.STOP_SPEECH,
      platformData: { grid3: { commandId: 'Speech.Stop', parameters: {} } },
    },
  }));

  system.addButton(new AACButton({
    id: 'sy-explorer',
    label: 'Explorer',
    message: 'Grid Explorer',
    x: 9, y: 4,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
      platformData: { grid3: { commandId: 'Settings.GridExplorer', parameters: {} } },
    },
  }));

  system.addButton(new AACButton({
    id: 'sy-shutdown',
    label: 'Shut Down',
    message: 'Shut Down',
    x: 8, y: 5, columnSpan: 2,
    style: { backgroundColor: '#922B21FF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
      platformData: { grid3: { commandId: 'System.ShutDown', parameters: {} } },
    },
  }));

  // --- Media page (workspace showing desktop/media player) ---
  const media = new AACPage({ id: 'media', name: 'Media', grid: { columns: 10, rows: 6 } });
  media.addButton(ccWs(0, 0, 8, 6));

  media.addButton(new AACButton({
    id: 'md-home',
    label: 'Home',
    message: 'Home',
    x: 8, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_HOME },
  }));

  media.addButton(new AACButton({
    id: 'md-back',
    label: 'Back',
    message: 'Back',
    x: 9, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_BACK },
  }));

  media.addButton(new AACButton({
    id: 'md-playpause',
    label: 'Play/Pause',
    message: 'Play/Pause',
    x: 8, y: 1, columnSpan: 2, rowSpan: 2,
    style: { backgroundColor: '#27AE60FF' },
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.PLAY_VIDEO,
      parameters: { mediaAction: 'PlayPause' },
      platformData: { grid3: { commandId: 'Media.PlayPause', parameters: {} } },
    },
  }));

  media.addButton(new AACButton({
    id: 'md-stop',
    label: 'Stop',
    message: 'Stop',
    x: 8, y: 3,
    style: { backgroundColor: '#E74C3CFF' },
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.STOP_MEDIA,
      platformData: { grid3: { commandId: 'Media.Stop', parameters: {} } },
    },
  }));

  media.addButton(new AACButton({
    id: 'md-prev',
    label: 'Prev',
    message: 'Previous',
    x: 9, y: 3,
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.PLAY_VIDEO,
      parameters: { mediaAction: 'Previous' },
      platformData: { grid3: { commandId: 'Media.Previous', parameters: {} } },
    },
  }));

  media.addButton(new AACButton({
    id: 'md-next',
    label: 'Next',
    message: 'Next',
    x: 8, y: 4,
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.PLAY_VIDEO,
      parameters: { mediaAction: 'Next' },
      platformData: { grid3: { commandId: 'Media.Next', parameters: {} } },
    },
  }));

  media.addButton(new AACButton({
    id: 'md-volup',
    label: 'Vol +',
    message: 'Volume Up',
    x: 9, y: 4,
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.PLAY_VIDEO,
      parameters: { mediaAction: 'VolumeUp' },
      platformData: { grid3: { commandId: 'Media.VolumeUp', parameters: {} } },
    },
  }));

  media.addButton(new AACButton({
    id: 'md-voldown',
    label: 'Vol -',
    message: 'Volume Down',
    x: 8, y: 5,
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.PLAY_VIDEO,
      parameters: { mediaAction: 'VolumeDown' },
      platformData: { grid3: { commandId: 'Media.VolumeDown', parameters: {} } },
    },
  }));

  media.addButton(new AACButton({
    id: 'md-mute',
    label: 'Mute',
    message: 'Mute',
    x: 9, y: 5,
    style: { backgroundColor: '#E74C3CFF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.DEVICE_MUTE,
      platformData: { grid3: { commandId: 'ComputerControl.DeviceMute', parameters: { indicatorenabled: '1' } } },
    },
  }));

  // --- Photos page (no workspace - uses AutoContent Photos, like originals) ---
  const photos = new AACPage({ id: 'photos', name: 'Photos', grid: { columns: 10, rows: 6 } });

  // AutoContent for photos
  photos.addButton(new AACButton({
    id: 'ph-gallery',
    label: '',
    message: '',
    x: 0, y: 0, columnSpan: 8, rowSpan: 5,
    contentType: 'AutoContent',
    contentSubType: 'Photos',
  }));

  photos.addButton(new AACButton({
    id: 'ph-home',
    label: 'Home',
    message: 'Home',
    x: 8, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_HOME },
  }));

  photos.addButton(new AACButton({
    id: 'ph-back',
    label: 'Back',
    message: 'Back',
    x: 9, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_BACK },
  }));

  photos.addButton(new AACButton({
    id: 'ph-snapshot',
    label: 'Photo',
    message: 'Take Photo',
    x: 8, y: 1, columnSpan: 2,
    style: { backgroundColor: '#E74C3CFF' },
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.TAKE_PHOTO,
      platformData: { grid3: { commandId: 'Photos.Snapshot', parameters: {} } },
    },
  }));

  photos.addButton(new AACButton({
    id: 'ph-changecam',
    label: 'Flip',
    message: 'Change Camera',
    x: 8, y: 2, columnSpan: 2,
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.TOGGLE_STATE,
      parameters: { target: 'camera' },
      platformData: { grid3: { commandId: 'Photos.ChangeCamera', parameters: { indicatorenabled: '1' } } },
    },
  }));

  photos.addButton(new AACButton({
    id: 'ph-more',
    label: 'More',
    message: 'More Photos',
    x: 8, y: 3, columnSpan: 2,
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
      platformData: { grid3: { commandId: 'Photos.MorePhotos', parameters: {} } },
    },
  }));

  photos.addButton(new AACButton({
    id: 'ph-attach',
    label: 'Attach',
    message: 'Attach',
    x: 8, y: 4, columnSpan: 2,
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
      platformData: { grid3: { commandId: 'Photos.StoreAsAttachment', parameters: {} } },
    },
  }));

  photos.addButton(new AACButton({
    id: 'ph-mypics',
    label: 'My Pics',
    message: 'My Pictures',
    x: 8, y: 5, columnSpan: 2,
    semanticAction: {
      category: AACSemanticCategory.MEDIA,
      intent: AACSemanticIntent.PLATFORM_SPECIFIC,
      platformData: { grid3: { commandId: 'Photos.MyPictures', parameters: {} } },
    },
  }));

  // --- Web page (WebBrowser workspace) ---
  const web = new AACPage({ id: 'web', name: 'Web', grid: { columns: 10, rows: 6 } });
  web.addButton(new AACButton({
    id: 'wb-workspace',
    label: '',
    message: '',
    x: 0, y: 0, columnSpan: 8, rowSpan: 6,
    contentType: 'Workspace',
    contentSubType: 'WebBrowser',
    style: { backgroundColor: '#FFFFFFFF' },
  }));

  web.addButton(new AACButton({
    id: 'wb-home',
    label: 'Home',
    message: 'Home',
    x: 8, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_HOME },
  }));

  web.addButton(new AACButton({
    id: 'wb-back',
    label: 'Back',
    message: 'Back',
    x: 9, y: 0,
    style: { backgroundColor: '#95A5A6FF' },
    semanticAction: { category: AACSemanticCategory.NAVIGATION, intent: AACSemanticIntent.GO_BACK },
  }));

  web.addButton(new AACButton({
    id: 'wb-google',
    label: 'Google',
    message: 'Google',
    x: 8, y: 1, columnSpan: 2,
    style: { backgroundColor: '#3498DBFF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.WEB_NAVIGATE,
      text: 'https://www.google.com',
      platformData: { grid3: { commandId: 'WebBrowser.NavigateUrl', parameters: { url: 'https://www.google.com' } } },
    },
  }));

  web.addButton(new AACButton({
    id: 'wb-scrollup',
    label: 'Scroll Up',
    message: 'Scroll Up',
    x: 8, y: 2, columnSpan: 2,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.WEB_SCROLL,
      parameters: { direction: 'up' },
      platformData: { grid3: { commandId: 'WebBrowser.ScrollUp', parameters: { size: 'Medium' } } },
    },
  }));

  web.addButton(new AACButton({
    id: 'wb-scrolldown',
    label: 'Scroll Dn',
    message: 'Scroll Down',
    x: 8, y: 3, columnSpan: 2,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.WEB_SCROLL,
      parameters: { direction: 'down' },
      platformData: { grid3: { commandId: 'WebBrowser.ScrollDown', parameters: { size: 'Medium' } } },
    },
  }));

  web.addButton(new AACButton({
    id: 'wb-nextelem',
    label: 'Next',
    message: 'Next Element',
    x: 8, y: 4,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.WEB_FOCUS_ELEMENT,
      parameters: { direction: 'next' },
      platformData: { grid3: { commandId: 'WebBrowser.NextElement', parameters: {} } },
    },
  }));

  web.addButton(new AACButton({
    id: 'wb-activate',
    label: 'Click',
    message: 'Activate',
    x: 9, y: 4,
    style: { backgroundColor: '#F39C12FF' },
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.WEB_ACTIVATE_ELEMENT,
      platformData: { grid3: { commandId: 'WebBrowser.ActivateElement', parameters: {} } },
    },
  }));

  web.addButton(new AACButton({
    id: 'wb-webback',
    label: 'Back',
    message: 'Browser Back',
    x: 8, y: 5,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.WEB_NAVIGATE,
      platformData: { grid3: { commandId: 'WebBrowser.Back', parameters: {} } },
    },
  }));

  web.addButton(new AACButton({
    id: 'wb-reload',
    label: 'Reload',
    message: 'Reload',
    x: 9, y: 5,
    semanticAction: {
      category: AACSemanticCategory.SYSTEM_CONTROL,
      intent: AACSemanticIntent.WEB_NAVIGATE,
      platformData: { grid3: { commandId: 'WebBrowser.Reload', parameters: {} } },
    },
  }));

  // Assemble
  tree.addPage(home);
  tree.addPage(keyboard);
  tree.addPage(mouse);
  tree.addPage(shortcuts);
  tree.addPage(system);
  tree.addPage(media);
  tree.addPage(photos);
  tree.addPage(web);
  tree.rootId = 'home';

  const outPath = path.join(__dirname, 'Computer Control.gridset');
  const processor = new GridsetProcessor({ preserveAllButtons: true });
  await processor.saveFromTree(tree, outPath);

  const fs = await import('fs');
  const buffer = fs.readFileSync(outPath);
  const reloaded = await processor.loadIntoTree(buffer);
  console.log(`\n=== Computer Control Gridset ===`);
  console.log(`Created: ${outPath}`);
  console.log(`Pages: ${Object.keys(reloaded.pages).length}`);
  for (const [id, page] of Object.entries(reloaded.pages)) {
    const wsBtns = page.buttons.filter(b => b.contentType === 'Workspace' || b.contentType === 'AutoContent');
    console.log(`\n  "${page.name}" (${id}): ${page.buttons.length} buttons, ${wsBtns.length} workspace/auto`);
    for (const btn of wsBtns) {
      console.log(`    CELL: ${btn.contentType}/${btn.contentSubType} @ (${btn.x},${btn.y}) span=(${btn.columnSpan}x${btn.rowSpan})`);
    }
  }
}

main().catch(console.error);

/**
 * Grid 3 Command Definitions and Detection System
 *
 * This module provides comprehensive metadata for all Grid 3 commands,
 * organized by plugin/category. It enables:
 * - Command detection and classification
 * - Parameter extraction
 * - Future extensibility for command execution
 * - Semantic action mapping
 *
 * Grid 3 has 33+ plugins with 200+ commands. This catalog captures
 * the most commonly used and important commands.
 */

/**
 * Command categories in Grid 3
 */
export enum Grid3CommandCategory {
  NAVIGATION = 'navigation',
  COMMUNICATION = 'communication',
  TEXT_EDITING = 'text_editing',
  COMPUTER_CONTROL = 'computer_control',
  WEB_BROWSER = 'web_browser',
  EMAIL = 'email',
  PHONE = 'phone',
  SMS = 'sms',
  SYSTEM = 'system',
  SETTINGS = 'settings',
  SPEECH = 'speech',
  AUTO_CONTENT = 'auto_content',
  ENVIRONMENT_CONTROL = 'environment_control',
  MOUSE = 'mouse',
  WINDOW = 'window',
  MEDIA = 'media',
  PHOTOS = 'photos',
  COMMAND_EXECUTION = 'command_execution',
  CUSTOM = 'custom',
}

/**
 * Parameter definition for commands
 */
export interface CommandParameter {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'grid' | 'color' | 'font';
  required: boolean;
  description?: string;
}

/**
 * Command metadata definition
 */
export interface Grid3CommandDefinition {
  id: string;
  category: Grid3CommandCategory;
  pluginId: string;
  displayName: string;
  description: string;
  parameters?: CommandParameter[];
  platforms?: ('desktop' | 'ios' | 'medicare' | 'medicareBionics')[];
  deprecated?: boolean;
}

/**
 * Registry of all Grid 3 commands
 * Key is command ID (e.g., 'Jump.To', 'Action.InsertText')
 */
export const GRID3_COMMANDS: Record<string, Grid3CommandDefinition> = {
  // ========================================
  // NAVIGATION COMMANDS
  // ========================================
  'Jump.To': {
    id: 'Jump.To',
    category: Grid3CommandCategory.NAVIGATION,
    pluginId: 'navigation',
    displayName: 'Jump To',
    description: 'Navigate to a specific grid',
    parameters: [
      {
        key: 'grid',
        type: 'grid',
        required: true,
        description: 'Target grid name',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Jump.Back': {
    id: 'Jump.Back',
    category: Grid3CommandCategory.NAVIGATION,
    pluginId: 'navigation',
    displayName: 'Jump Back',
    description: 'Navigate to the previous grid',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Jump.Home': {
    id: 'Jump.Home',
    category: Grid3CommandCategory.NAVIGATION,
    pluginId: 'navigation',
    displayName: 'Jump Home',
    description: 'Navigate to the home/start grid',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Jump.Favorite': {
    id: 'Jump.Favorite',
    category: Grid3CommandCategory.NAVIGATION,
    pluginId: 'navigation',
    displayName: 'Jump To Favorite',
    description: 'Navigate to a favorite grid',
    parameters: [
      {
        key: 'favorite',
        type: 'number',
        required: true,
        description: 'Favorite slot number',
      },
    ],
  },
  'Jump.SetBookmark': {
    id: 'Jump.SetBookmark',
    category: Grid3CommandCategory.NAVIGATION,
    pluginId: 'navigation',
    displayName: 'Set Bookmark',
    description: 'Set, clear, or toggle a navigation bookmark',
    parameters: [
      {
        key: 'indicatorenabled',
        type: 'boolean',
        required: false,
        description: 'Show indicator when bookmark is set',
      },
      {
        key: 'action',
        type: 'string',
        required: false,
        description: 'Action to perform: Toggle, Set, Clear',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },

  // ========================================
  // COMMUNICATION COMMANDS
  // ========================================
  'Action.Speak': {
    id: 'Action.Speak',
    category: Grid3CommandCategory.COMMUNICATION,
    pluginId: 'speech',
    displayName: 'Speak',
    description: 'Speak the current message bar contents',
    parameters: [
      {
        key: 'unit',
        type: 'string',
        required: false,
        description: 'Speaking unit (sentence/word/character)',
      },
      {
        key: 'movecaret',
        type: 'boolean',
        required: false,
        description: 'Move caret after speaking',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.InsertText': {
    id: 'Action.InsertText',
    category: Grid3CommandCategory.COMMUNICATION,
    pluginId: 'core',
    displayName: 'Insert Text',
    description: 'Insert text into the message bar',
    parameters: [
      {
        key: 'text',
        type: 'string',
        required: true,
        description: 'Text to insert',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.InsertTextAndSpeak': {
    id: 'Action.InsertTextAndSpeak',
    category: Grid3CommandCategory.COMMUNICATION,
    pluginId: 'core',
    displayName: 'Insert Text and Speak',
    description: 'Insert text and speak immediately',
    parameters: [
      {
        key: 'text',
        type: 'string',
        required: true,
        description: 'Text to insert and speak',
      },
    ],
  },
  'Action.Enter': {
    id: 'Action.Enter',
    category: Grid3CommandCategory.COMMUNICATION,
    pluginId: 'core',
    displayName: 'Enter',
    description: 'Press Enter key',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.Number': {
    id: 'Action.Number',
    category: Grid3CommandCategory.COMMUNICATION,
    pluginId: 'core',
    displayName: 'Insert Number',
    description: 'Insert a number character',
    parameters: [
      {
        key: 'letter',
        type: 'string',
        required: true,
        description: 'Number to insert',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.Punctuation': {
    id: 'Action.Punctuation',
    category: Grid3CommandCategory.COMMUNICATION,
    pluginId: 'core',
    displayName: 'Insert Punctuation',
    description: 'Insert a punctuation character',
    parameters: [
      {
        key: 'letter',
        type: 'string',
        required: true,
        description: 'Punctuation character to insert',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.Copy': {
    id: 'Action.Copy',
    category: Grid3CommandCategory.COMMUNICATION,
    pluginId: 'core',
    displayName: 'Copy',
    description: 'Copy selected text to clipboard',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.Paste': {
    id: 'Action.Paste',
    category: Grid3CommandCategory.COMMUNICATION,
    pluginId: 'core',
    displayName: 'Paste',
    description: 'Paste text from clipboard',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.SelectAll': {
    id: 'Action.SelectAll',
    category: Grid3CommandCategory.COMMUNICATION,
    pluginId: 'core',
    displayName: 'Select All',
    description: 'Select all text in the workspace',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },

  // ========================================
  // TEXT EDITING COMMANDS
  // ========================================
  'Action.DeleteWord': {
    id: 'Action.DeleteWord',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Delete Word',
    description: 'Delete the last word in the message bar',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.DeleteLetter': {
    id: 'Action.DeleteLetter',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Delete Letter',
    description: 'Delete the last character in the message bar',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.Clear': {
    id: 'Action.Clear',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Clear',
    description: 'Clear the message bar',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.Letter': {
    id: 'Action.Letter',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Insert Letter',
    description: 'Insert a single letter',
    parameters: [
      {
        key: 'letter',
        type: 'string',
        required: true,
        description: 'Letter to insert',
      },
    ],
  },
  'Action.Space': {
    id: 'Action.Space',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Space',
    description: 'Insert a space',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.Backspace': {
    id: 'Action.Backspace',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Backspace',
    description: 'Delete character before cursor',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.NextLetter': {
    id: 'Action.NextLetter',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Next Letter',
    description: 'Move cursor to next letter',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.PreviousLetter': {
    id: 'Action.PreviousLetter',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Previous Letter',
    description: 'Move cursor to previous letter',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.NextWord': {
    id: 'Action.NextWord',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Next Word',
    description: 'Move cursor to next word',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.PreviousWord': {
    id: 'Action.PreviousWord',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Previous Word',
    description: 'Move cursor to previous word',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.DocumentStart': {
    id: 'Action.DocumentStart',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Document Start',
    description: 'Jump cursor to the start of the document',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.DocumentEnd': {
    id: 'Action.DocumentEnd',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Document End',
    description: 'Jump cursor to the end of the document',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.UndoWorkspaceEdit': {
    id: 'Action.UndoWorkspaceEdit',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Undo Workspace Edit',
    description: 'Undo the last workspace edit',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.UndoClear': {
    id: 'Action.UndoClear',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Undo Clear',
    description: 'Undo a clear text action',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Action.Print': {
    id: 'Action.Print',
    category: Grid3CommandCategory.TEXT_EDITING,
    pluginId: 'core',
    displayName: 'Print',
    description: 'Print current content',
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },

  // ========================================
  // SPEECH COMMANDS
  // ========================================
  'Speech.ChangePublicVoice': {
    id: 'Speech.ChangePublicVoice',
    category: Grid3CommandCategory.SPEECH,
    pluginId: 'speech',
    displayName: 'Change Voice',
    description: 'Change the public speaking voice',
    parameters: [
      {
        key: 'voice',
        type: 'string',
        required: true,
        description: 'Voice name or ID',
      },
    ],
  },
  'Speech.ChangePublicSpeed': {
    id: 'Speech.ChangePublicSpeed',
    category: Grid3CommandCategory.SPEECH,
    pluginId: 'speech',
    displayName: 'Change Speech Speed',
    description: 'Change the speaking speed',
    parameters: [
      {
        key: 'speed',
        type: 'number',
        required: true,
        description: 'Speed percentage (50-200)',
      },
    ],
  },
  'Speech.ChangePublicPitch': {
    id: 'Speech.ChangePublicPitch',
    category: Grid3CommandCategory.SPEECH,
    pluginId: 'speech',
    displayName: 'Change Speech Pitch',
    description: 'Change the voice pitch',
    parameters: [
      {
        key: 'pitch',
        type: 'number',
        required: true,
        description: 'Pitch value',
      },
    ],
  },
  'Speech.ChangePublicVolume': {
    id: 'Speech.ChangePublicVolume',
    category: Grid3CommandCategory.SPEECH,
    pluginId: 'speech',
    displayName: 'Change Speech Volume',
    description: 'Change the speech volume',
    parameters: [
      {
        key: 'volume',
        type: 'number',
        required: true,
        description: 'Volume percentage (0-100)',
      },
    ],
  },
  'Speech.SpeakNothing': {
    id: 'Action.SpeakNothing',
    category: Grid3CommandCategory.SPEECH,
    pluginId: 'speech',
    displayName: 'Speak Nothing',
    description: 'Speak without inserting text',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Speech.Stop': {
    id: 'Speech.Stop',
    category: Grid3CommandCategory.SPEECH,
    pluginId: 'speech',
    displayName: 'Stop Speech',
    description: 'Stop current speech output',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  SpeechPlaySound: {
    id: 'SpeechPlaySound',
    category: Grid3CommandCategory.SPEECH,
    pluginId: 'speech',
    displayName: 'Play Sound',
    description: 'Play a sound file',
    parameters: [
      {
        key: 'filedata',
        type: 'string',
        required: true,
        description: 'Sound file data or path',
      },
      {
        key: 'wait',
        type: 'boolean',
        required: false,
        description: 'Wait for sound to finish before continuing',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },

  // ========================================
  // COMPUTER CONTROL COMMANDS
  // ========================================
  'ComputerControl.LeftClick': {
    id: 'ComputerControl.LeftClick',
    category: Grid3CommandCategory.COMPUTER_CONTROL,
    pluginId: 'computercontrol',
    displayName: 'Left Click',
    description: 'Perform left mouse click',
    platforms: ['desktop', 'medicareBionics'],
  },
  'ComputerControl.RightClick': {
    id: 'ComputerControl.RightClick',
    category: Grid3CommandCategory.COMPUTER_CONTROL,
    pluginId: 'computercontrol',
    displayName: 'Right Click',
    description: 'Perform right mouse click',
    platforms: ['desktop', 'medicareBionics'],
  },
  'ComputerControl.DoubleClick': {
    id: 'ComputerControl.DoubleClick',
    category: Grid3CommandCategory.COMPUTER_CONTROL,
    pluginId: 'computercontrol',
    displayName: 'Double Click',
    description: 'Perform double mouse click',
    platforms: ['desktop', 'medicareBionics'],
  },
  'ComputerControl.MouseMove': {
    id: 'ComputerControl.MouseMove',
    category: Grid3CommandCategory.COMPUTER_CONTROL,
    pluginId: 'computercontrol',
    displayName: 'Move Mouse',
    description: 'Move mouse pointer',
    parameters: [
      { key: 'x', type: 'number', required: true, description: 'X coordinate' },
      { key: 'y', type: 'number', required: true, description: 'Y coordinate' },
    ],
    platforms: ['desktop', 'medicareBionics'],
  },
  'ComputerControl.SendKeys': {
    id: 'ComputerControl.SendKeys',
    category: Grid3CommandCategory.COMPUTER_CONTROL,
    pluginId: 'computercontrol',
    displayName: 'Send Keys',
    description: 'Send keyboard input',
    parameters: [
      {
        key: 'keys',
        type: 'string',
        required: true,
        description: 'Key sequence to send',
      },
    ],
    platforms: ['desktop', 'medicareBionics'],
  },
  'ComputerControl.WindowsKey': {
    id: 'ComputerControl.WindowsKey',
    category: Grid3CommandCategory.COMPUTER_CONTROL,
    pluginId: 'computercontrol',
    displayName: 'Windows Key',
    description: 'Press Windows key',
    platforms: ['desktop'],
  },
  'ComputerControl.MenuKey': {
    id: 'ComputerControl.MenuKey',
    category: Grid3CommandCategory.COMPUTER_CONTROL,
    pluginId: 'computercontrol',
    displayName: 'Menu Key',
    description: 'Press context menu key',
    platforms: ['desktop'],
  },
  'ComputerControl.Keyboard': {
    id: 'ComputerControl.Keyboard',
    category: Grid3CommandCategory.COMPUTER_CONTROL,
    pluginId: 'computercontrol',
    displayName: 'Send Keyboard Input',
    description: 'Send a sequence of keystrokes to the computer',
    parameters: [
      {
        key: 'keystring',
        type: 'string',
        required: true,
        description: 'Key sequence (e.g. {TAB}{ENTER}, {LEFTCONTROL}a)',
      },
    ],
    platforms: ['desktop', 'medicareBionics'],
  },
  'ComputerControl.Shift': {
    id: 'ComputerControl.Shift',
    category: Grid3CommandCategory.COMPUTER_CONTROL,
    pluginId: 'computercontrol',
    displayName: 'Shift Key',
    description: 'Toggle shift key state',
    parameters: [
      {
        key: 'action',
        type: 'string',
        required: false,
        description: 'Action: Toggle, On, Off',
      },
    ],
    platforms: ['desktop', 'medicareBionics'],
  },
  'ComputerControl.DeviceMute': {
    id: 'ComputerControl.DeviceMute',
    category: Grid3CommandCategory.COMPUTER_CONTROL,
    pluginId: 'computercontrol',
    displayName: 'Device Mute',
    description: 'Mute or unmute device audio',
    parameters: [
      {
        key: 'indicatorenabled',
        type: 'boolean',
        required: false,
        description: 'Show indicator when muted',
      },
    ],
    platforms: ['desktop', 'medicareBionics'],
  },

  // ========================================
  // WEB BROWSER COMMANDS
  // ========================================
  'WebBrowser.Navigate': {
    id: 'WebBrowser.Navigate',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Navigate to URL',
    description: 'Open a URL in the web browser',
    parameters: [
      {
        key: 'url',
        type: 'string',
        required: true,
        description: 'URL to navigate to',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.Back': {
    id: 'WebBrowser.Back',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Browser Back',
    description: 'Go back in browser history',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.Forward': {
    id: 'WebBrowser.Forward',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Browser Forward',
    description: 'Go forward in browser history',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.Refresh': {
    id: 'WebBrowser.Refresh',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Refresh Page',
    description: 'Refresh the current page',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.Home': {
    id: 'WebBrowser.Home',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Browser Home',
    description: 'Navigate to browser home page',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.FavoriteAdd': {
    id: 'WebBrowser.FavoriteAdd',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Add Favorite',
    description: 'Add current page to favorites',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.ZoomIn': {
    id: 'WebBrowser.ZoomIn',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Zoom In',
    description: 'Zoom in the page',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.ZoomOut': {
    id: 'WebBrowser.ZoomOut',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Zoom Out',
    description: 'Zoom out the page',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.NavigateUrl': {
    id: 'WebBrowser.NavigateUrl',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Navigate to URL',
    description: 'Navigate the embedded browser to a specific URL',
    parameters: [
      {
        key: 'url',
        type: 'string',
        required: true,
        description: 'URL to navigate to',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.Reload': {
    id: 'WebBrowser.Reload',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Reload Page',
    description: 'Reload the current web page',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.Stop': {
    id: 'WebBrowser.Stop',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Stop Loading',
    description: 'Stop the current page from loading',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.ScrollUp': {
    id: 'WebBrowser.ScrollUp',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Scroll Up',
    description: 'Scroll the web page up',
    parameters: [
      {
        key: 'size',
        type: 'string',
        required: false,
        description: 'Scroll amount: Small, Medium, Large',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.ScrollDown': {
    id: 'WebBrowser.ScrollDown',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Scroll Down',
    description: 'Scroll the web page down',
    parameters: [
      {
        key: 'size',
        type: 'string',
        required: false,
        description: 'Scroll amount: Small, Medium, Large',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.ScrollLeft': {
    id: 'WebBrowser.ScrollLeft',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Scroll Left',
    description: 'Scroll the web page left',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.ScrollRight': {
    id: 'WebBrowser.ScrollRight',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Scroll Right',
    description: 'Scroll the web page right',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.SpatialNavigateUp': {
    id: 'WebBrowser.SpatialNavigateUp',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Spatial Navigate Up',
    description: 'Move focus to the element above',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.SpatialNavigateDown': {
    id: 'WebBrowser.SpatialNavigateDown',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Spatial Navigate Down',
    description: 'Move focus to the element below',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.SpatialNavigateLeft': {
    id: 'WebBrowser.SpatialNavigateLeft',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Spatial Navigate Left',
    description: 'Move focus to the element to the left',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.SpatialNavigateRight': {
    id: 'WebBrowser.SpatialNavigateRight',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Spatial Navigate Right',
    description: 'Move focus to the element to the right',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.NextElement': {
    id: 'WebBrowser.NextElement',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Next Element',
    description: 'Move focus to the next DOM element',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.PreviousElement': {
    id: 'WebBrowser.PreviousElement',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Previous Element',
    description: 'Move focus to the previous DOM element',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.ActivateElement': {
    id: 'WebBrowser.ActivateElement',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Activate Element',
    description: 'Click or activate the currently focused element',
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.SetZoom': {
    id: 'WebBrowser.SetZoom',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Set Zoom Level',
    description: 'Set a specific zoom level',
    parameters: [
      {
        key: 'option',
        type: 'string',
        required: false,
        description: 'Zoom option: Increase, Decrease, Reset',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.ReadingMode': {
    id: 'WebBrowser.ReadingMode',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Reading Mode',
    description: 'Toggle browser reading/simplified view mode',
    parameters: [
      {
        key: 'action',
        type: 'string',
        required: false,
        description: 'Action: Toggle, On, Off',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.InsertMobileSite': {
    id: 'WebBrowser.InsertMobileSite',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Request Mobile Site',
    description: 'Toggle between mobile and desktop site views',
    parameters: [
      {
        key: 'action',
        type: 'string',
        required: false,
        description: 'Action: Toggle, On, Off',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.ExecuteJavaScript': {
    id: 'WebBrowser.ExecuteJavaScript',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Execute JavaScript',
    description: 'Execute a predefined JavaScript command in the browser',
    parameters: [
      {
        key: 'commandid',
        type: 'string',
        required: true,
        description: 'Predefined JavaScript command ID (e.g. WhatsApp/Home/Focus_Message_Input)',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.SpeakJavascriptFunction': {
    id: 'WebBrowser.SpeakJavascriptFunction',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Speak from JavaScript',
    description: 'Extract text from the page via JavaScript and speak it aloud',
    parameters: [
      {
        key: 'commandid',
        type: 'string',
        required: true,
        description: 'JavaScript command ID for text extraction (e.g. Facebook/General/Read)',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.InsertFavourite': {
    id: 'WebBrowser.InsertFavourite',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Insert Favourite',
    description: 'Insert a favourite/bookmark into an auto-content cell',
    parameters: [
      {
        key: 'location',
        type: 'string',
        required: false,
        description: 'Location: ChooseCell',
      },
      {
        key: 'itemindex',
        type: 'number',
        required: false,
        description: 'Index of the favourite item',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.DeleteFavourite': {
    id: 'WebBrowser.DeleteFavourite',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Delete Favourite',
    description: 'Delete a favourite/bookmark',
    parameters: [
      {
        key: 'action',
        type: 'string',
        required: false,
        description: 'Action: Toggle',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'WebBrowser.MoreLinks': {
    id: 'WebBrowser.MoreLinks',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'More Links',
    description: 'Load more links from the current web page',
    platforms: ['desktop', 'ios'],
  },
  'WebAddress.Go': {
    id: 'WebAddress.Go',
    category: Grid3CommandCategory.WEB_BROWSER,
    pluginId: 'webbrowser',
    displayName: 'Go to Address',
    description: 'Navigate to the URL in the address bar',
    platforms: ['desktop', 'ios'],
  },

  // ========================================
  // EMAIL COMMANDS
  // ========================================
  'Email.SendTo': {
    id: 'Email.SendTo',
    category: Grid3CommandCategory.EMAIL,
    pluginId: 'email',
    displayName: 'Send Email To',
    description: 'Send email to a recipient',
    parameters: [
      {
        key: 'recipient',
        type: 'string',
        required: true,
        description: 'Recipient email address',
      },
      {
        key: 'subject',
        type: 'string',
        required: false,
        description: 'Email subject',
      },
    ],
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },
  'Email.AddRecipient': {
    id: 'Email.AddRecipient',
    category: Grid3CommandCategory.EMAIL,
    pluginId: 'email',
    displayName: 'Add Recipient',
    description: 'Add a recipient to the email',
    parameters: [
      {
        key: 'recipient',
        type: 'string',
        required: true,
        description: 'Recipient email address',
      },
    ],
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },
  'Email.SetSubject': {
    id: 'Email.SetSubject',
    category: Grid3CommandCategory.EMAIL,
    pluginId: 'email',
    displayName: 'Set Subject',
    description: 'Set the email subject',
    parameters: [
      {
        key: 'subject',
        type: 'string',
        required: true,
        description: 'Email subject',
      },
    ],
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },
  'Email.AttachFile': {
    id: 'Email.AttachFile',
    category: Grid3CommandCategory.EMAIL,
    pluginId: 'email',
    displayName: 'Attach File',
    description: 'Attach a file to the email',
    parameters: [
      {
        key: 'filepath',
        type: 'string',
        required: true,
        description: 'Path to file',
      },
    ],
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },

  // ========================================
  // PHONE COMMANDS
  // ========================================
  'Phone.Call': {
    id: 'Phone.Call',
    category: Grid3CommandCategory.PHONE,
    pluginId: 'phone',
    displayName: 'Make Call',
    description: 'Initiate a phone call',
    parameters: [
      {
        key: 'number',
        type: 'string',
        required: true,
        description: 'Phone number to call',
      },
    ],
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },
  'Phone.Answer': {
    id: 'Phone.Answer',
    category: Grid3CommandCategory.PHONE,
    pluginId: 'phone',
    displayName: 'Answer Call',
    description: 'Answer incoming call',
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },
  'Phone.Hangup': {
    id: 'Phone.Hangup',
    category: Grid3CommandCategory.PHONE,
    pluginId: 'phone',
    displayName: 'End Call',
    description: 'End current call',
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },

  // ========================================
  // SMS COMMANDS
  // ========================================
  'Sms.SendTo': {
    id: 'Sms.SendTo',
    category: Grid3CommandCategory.SMS,
    pluginId: 'sms',
    displayName: 'Send SMS To',
    description: 'Send text message to a recipient',
    parameters: [
      {
        key: 'recipient',
        type: 'string',
        required: true,
        description: 'Phone number',
      },
      {
        key: 'message',
        type: 'string',
        required: false,
        description: 'Message text',
      },
    ],
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },
  'Sms.AddRecipient': {
    id: 'Sms.AddRecipient',
    category: Grid3CommandCategory.SMS,
    pluginId: 'sms',
    displayName: 'Add SMS Recipient',
    description: 'Add a recipient to the SMS',
    parameters: [
      {
        key: 'recipient',
        type: 'string',
        required: true,
        description: 'Phone number',
      },
    ],
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },

  // ========================================
  // SYSTEM COMMANDS
  // ========================================
  'System.LogOff': {
    id: 'System.LogOff',
    category: Grid3CommandCategory.SYSTEM,
    pluginId: 'computersession',
    displayName: 'Log Off',
    description: 'Log off from Windows',
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },
  'System.Lock': {
    id: 'System.Lock',
    category: Grid3CommandCategory.SYSTEM,
    pluginId: 'computersession',
    displayName: 'Lock Computer',
    description: 'Lock the computer',
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },
  'System.Sleep': {
    id: 'System.Sleep',
    category: Grid3CommandCategory.SYSTEM,
    pluginId: 'computersession',
    displayName: 'Sleep',
    description: 'Put computer to sleep',
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },
  'System.Restart': {
    id: 'System.Restart',
    category: Grid3CommandCategory.SYSTEM,
    pluginId: 'computersession',
    displayName: 'Restart',
    description: 'Restart the computer',
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },
  'System.ShutDown': {
    id: 'System.ShutDown',
    category: Grid3CommandCategory.SYSTEM,
    pluginId: 'computersession',
    displayName: 'Shut Down',
    description: 'Shut down the computer',
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },

  // ========================================
  // SETTINGS COMMANDS
  // ========================================
  'Settings.RestoreAll': {
    id: 'Settings.RestoreAll',
    category: Grid3CommandCategory.SETTINGS,
    pluginId: 'settings',
    displayName: 'Restore All Settings',
    description: 'Restore all settings to defaults',
    parameters: [
      {
        key: 'indicatorenabled',
        type: 'boolean',
        required: false,
        description: 'Show indicator',
      },
      {
        key: 'action',
        type: 'string',
        required: false,
        description: 'Action to perform',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Settings.GridExplorer': {
    id: 'Settings.GridExplorer',
    category: Grid3CommandCategory.SETTINGS,
    pluginId: 'settings',
    displayName: 'Grid Explorer',
    description: 'Open the grid explorer for browsing grids',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Settings.RequiredFeature': {
    id: 'Settings.RequiredFeature',
    category: Grid3CommandCategory.SETTINGS,
    pluginId: 'settings',
    displayName: 'Required Feature',
    description: 'Enable or require a specific feature (e.g. Dwell)',
    parameters: [
      {
        key: 'feature',
        type: 'string',
        required: true,
        description: 'Feature name (e.g. Dwell)',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Settings.Open': {
    id: 'Settings.Open',
    category: Grid3CommandCategory.SETTINGS,
    pluginId: 'settings',
    displayName: 'Open Settings',
    description: 'Open the settings window',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Scanning.Start': {
    id: 'Scanning.Start',
    category: Grid3CommandCategory.SETTINGS,
    pluginId: 'access',
    displayName: 'Start Scanning',
    description: 'Start scanning access method',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Scanning.Stop': {
    id: 'Scanning.Stop',
    category: Grid3CommandCategory.SETTINGS,
    pluginId: 'access',
    displayName: 'Stop Scanning',
    description: 'Stop scanning access method',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },

  // ========================================
  // AUTO CONTENT COMMANDS
  // ========================================
  'AutoContent.Activate': {
    id: 'AutoContent.Activate',
    category: Grid3CommandCategory.AUTO_CONTENT,
    pluginId: 'autocontent',
    displayName: 'Activate Auto Content',
    description: 'Activate an auto content cell',
    parameters: [
      {
        key: 'autocontenttype',
        type: 'string',
        required: true,
        description: 'Type of auto content',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Prediction.Clear': {
    id: 'Prediction.Clear',
    category: Grid3CommandCategory.AUTO_CONTENT,
    pluginId: 'prediction',
    displayName: 'Clear Prediction',
    description: 'Clear word prediction buffer',
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Prediction.PredictThis': {
    id: 'Prediction.PredictThis',
    category: Grid3CommandCategory.AUTO_CONTENT,
    pluginId: 'prediction',
    displayName: 'Predict This',
    description: 'Provide suggestions based on word list',
    parameters: [
      {
        key: 'wordlist',
        type: 'string', // Actually highly structured, but string type is a placeholder
        required: true,
        description: 'Word list for prediction',
      },
    ],
  },
  'Grammar.Change': {
    id: 'Grammar.Change',
    category: Grid3CommandCategory.AUTO_CONTENT,
    pluginId: 'grammar',
    displayName: 'Change Grammar',
    description: 'Change grammar context',
    parameters: [
      {
        key: 'context',
        type: 'string',
        required: true,
        description: 'Grammar context',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Prediction.AddToWordList': {
    id: 'Prediction.AddToWordList',
    category: Grid3CommandCategory.AUTO_CONTENT,
    pluginId: 'prediction',
    displayName: 'Add to Word List',
    description: 'Add a word or clipboard content to the word list',
    parameters: [
      {
        key: 'location',
        type: 'string',
        required: false,
        description: 'Where to add: EndOfList, etc.',
      },
      {
        key: 'unit',
        type: 'string',
        required: false,
        description: 'Source: Clipboard, CurrentWord',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Prediction.DeleteWord': {
    id: 'Prediction.DeleteWord',
    category: Grid3CommandCategory.AUTO_CONTENT,
    pluginId: 'prediction',
    displayName: 'Delete Word',
    description: 'Delete a word from the prediction list',
    parameters: [
      {
        key: 'action',
        type: 'string',
        required: false,
        description: 'Action: Off',
      },
      {
        key: 'itemindex',
        type: 'number',
        required: false,
        description: 'Index of the word to delete',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'Prediction.MoreWords': {
    id: 'Prediction.MoreWords',
    category: Grid3CommandCategory.AUTO_CONTENT,
    pluginId: 'prediction',
    displayName: 'More Words',
    description: 'Load more prediction words',
    parameters: [
      {
        key: 'pagedirection',
        type: 'string',
        required: false,
        description: 'Direction: Next, Previous',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },

  // ========================================
  // ENVIRONMENT CONTROL COMMANDS
  // ========================================
  'EnvControl.Send': {
    id: 'EnvControl.Send',
    category: Grid3CommandCategory.ENVIRONMENT_CONTROL,
    pluginId: 'environmentcontrol',
    displayName: 'Send Environment Control',
    description: 'Send environment control command',
    parameters: [
      {
        key: 'code',
        type: 'string',
        required: true,
        description: 'IR/EC code to send',
      },
    ],
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },
  'EnvControl.Learn': {
    id: 'EnvControl.Learn',
    category: Grid3CommandCategory.ENVIRONMENT_CONTROL,
    pluginId: 'environmentcontrol',
    displayName: 'Learn Environment Control',
    description: 'Learn environment control code',
    platforms: ['desktop', 'medicare', 'medicareBionics'],
  },

  // ========================================
  // MOUSE COMMANDS
  // ========================================
  'Mouse.LeftClick': {
    id: 'Mouse.LeftClick',
    category: Grid3CommandCategory.MOUSE,
    pluginId: 'computercontrol',
    displayName: 'Mouse Left Click',
    description: 'Left mouse click',
    platforms: ['desktop', 'medicareBionics'],
  },
  'Mouse.RightClick': {
    id: 'Mouse.RightClick',
    category: Grid3CommandCategory.MOUSE,
    pluginId: 'computercontrol',
    displayName: 'Mouse Right Click',
    description: 'Right mouse click',
    platforms: ['desktop', 'medicareBionics'],
  },
  'Mouse.DoubleClick': {
    id: 'Mouse.DoubleClick',
    category: Grid3CommandCategory.MOUSE,
    pluginId: 'computercontrol',
    displayName: 'Mouse Double Click',
    description: 'Double mouse click',
    platforms: ['desktop', 'medicareBionics'],
  },
  'Mouse.Move': {
    id: 'Mouse.Move',
    category: Grid3CommandCategory.MOUSE,
    pluginId: 'computercontrol',
    displayName: 'Move Mouse',
    description: 'Move mouse pointer',
    parameters: [
      { key: 'x', type: 'number', required: true, description: 'X coordinate' },
      { key: 'y', type: 'number', required: true, description: 'Y coordinate' },
    ],
    platforms: ['desktop', 'medicareBionics'],
  },

  // ========================================
  // WINDOW COMMANDS
  // ========================================
  'Window.Minimize': {
    id: 'Window.Minimize',
    category: Grid3CommandCategory.WINDOW,
    pluginId: 'computercontrol',
    displayName: 'Minimize Window',
    description: 'Minimize active window',
    platforms: ['desktop', 'medicareBionics'],
  },
  'Window.Maximize': {
    id: 'Window.Maximize',
    category: Grid3CommandCategory.WINDOW,
    pluginId: 'computercontrol',
    displayName: 'Maximize Window',
    description: 'Maximize active window',
    platforms: ['desktop', 'medicareBionics'],
  },
  'Window.Close': {
    id: 'Window.Close',
    category: Grid3CommandCategory.WINDOW,
    pluginId: 'computercontrol',
    displayName: 'Close Window',
    description: 'Close active window',
    platforms: ['desktop', 'medicareBionics'],
  },
  'Window.Switch': {
    id: 'Window.Switch',
    category: Grid3CommandCategory.WINDOW,
    pluginId: 'computercontrol',
    displayName: 'Switch Window',
    description: 'Switch to next window',
    platforms: ['desktop', 'medicareBionics'],
  },

  // ========================================
  // MEDIA COMMANDS
  // ========================================
  'Media.PlayPause': {
    id: 'Media.PlayPause',
    category: Grid3CommandCategory.MEDIA,
    pluginId: 'musicvideo',
    displayName: 'Play/Pause',
    description: 'Toggle play/pause media',
    platforms: ['desktop', 'ios'],
  },
  'Media.Next': {
    id: 'Media.Next',
    category: Grid3CommandCategory.MEDIA,
    pluginId: 'musicvideo',
    displayName: 'Next Track',
    description: 'Skip to next track',
    platforms: ['desktop', 'ios'],
  },
  'Media.Previous': {
    id: 'Media.Previous',
    category: Grid3CommandCategory.MEDIA,
    pluginId: 'musicvideo',
    displayName: 'Previous Track',
    description: 'Go to previous track',
    platforms: ['desktop', 'ios'],
  },
  'Media.Stop': {
    id: 'Media.Stop',
    category: Grid3CommandCategory.MEDIA,
    pluginId: 'musicvideo',
    displayName: 'Stop',
    description: 'Stop media playback',
    platforms: ['desktop', 'ios'],
  },
  'Media.VolumeUp': {
    id: 'Media.VolumeUp',
    category: Grid3CommandCategory.MEDIA,
    pluginId: 'musicvideo',
    displayName: 'Volume Up',
    description: 'Increase volume',
    platforms: ['desktop', 'ios'],
  },
  'Media.VolumeDown': {
    id: 'Media.VolumeDown',
    category: Grid3CommandCategory.MEDIA,
    pluginId: 'musicvideo',
    displayName: 'Volume Down',
    description: 'Decrease volume',
    platforms: ['desktop', 'ios'],
  },

  // ========================================
  // MUSIC VIDEO COMMANDS
  // ========================================
  'MusicVideo.ListVideos': {
    id: 'MusicVideo.ListVideos',
    category: Grid3CommandCategory.MEDIA,
    pluginId: 'musicvideo',
    displayName: 'List Videos',
    description: 'List available videos in a folder',
    parameters: [
      {
        key: 'playwait',
        type: 'number',
        required: false,
        description: 'Wait time before playing (0 or 1)',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'MusicVideo.MoreMusicVideos': {
    id: 'MusicVideo.MoreMusicVideos',
    category: Grid3CommandCategory.MEDIA,
    pluginId: 'musicvideo',
    displayName: 'More Music Videos',
    description: 'Browse more music/videos by page',
    parameters: [
      {
        key: 'pagedirection',
        type: 'string',
        required: false,
        description: 'Direction: Next, Previous',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'MusicVideo.SetVideoFolder': {
    id: 'MusicVideo.SetVideoFolder',
    category: Grid3CommandCategory.MEDIA,
    pluginId: 'musicvideo',
    displayName: 'Set Video Folder',
    description: 'Set the video folder path',
    parameters: [
      {
        key: 'foldername',
        type: 'string',
        required: true,
        description: 'Folder path (e.g. %PROFILE%\\Videos)',
      },
    ],
    platforms: ['desktop'],
  },
  'MusicVideo.Stop': {
    id: 'MusicVideo.Stop',
    category: Grid3CommandCategory.MEDIA,
    pluginId: 'musicvideo',
    displayName: 'Stop Video',
    description: 'Stop video playback',
    platforms: ['desktop', 'ios'],
  },
  'MusicVideo.StoreAsAttachmentCommandId': {
    id: 'MusicVideo.StoreAsAttachmentCommandId',
    category: Grid3CommandCategory.MEDIA,
    pluginId: 'musicvideo',
    displayName: 'Attach Video',
    description: 'Store the current video as an attachment',
    platforms: ['desktop', 'ios'],
  },

  // ========================================
  // PHOTOS COMMANDS
  // ========================================
  'Photos.Snapshot': {
    id: 'Photos.Snapshot',
    category: Grid3CommandCategory.PHOTOS,
    pluginId: 'photos',
    displayName: 'Take Photo',
    description: 'Take a photo with the camera',
    platforms: ['desktop', 'ios'],
  },
  'Photos.ChangeCamera': {
    id: 'Photos.ChangeCamera',
    category: Grid3CommandCategory.PHOTOS,
    pluginId: 'photos',
    displayName: 'Change Camera',
    description: 'Switch between front and back camera',
    parameters: [
      {
        key: 'indicatorenabled',
        type: 'boolean',
        required: false,
        description: 'Show indicator for active camera',
      },
    ],
    platforms: ['desktop', 'ios'],
  },
  'Photos.MorePhotos': {
    id: 'Photos.MorePhotos',
    category: Grid3CommandCategory.PHOTOS,
    pluginId: 'photos',
    displayName: 'More Photos',
    description: 'Load more photos from the gallery',
    platforms: ['desktop', 'ios'],
  },
  'Photos.MyPictures': {
    id: 'Photos.MyPictures',
    category: Grid3CommandCategory.PHOTOS,
    pluginId: 'photos',
    displayName: 'My Pictures',
    description: 'Open the My Pictures folder',
    platforms: ['desktop'],
  },
  'Photos.SnapshotsFolder': {
    id: 'Photos.SnapshotsFolder',
    category: Grid3CommandCategory.PHOTOS,
    pluginId: 'photos',
    displayName: 'Snapshots Folder',
    description: 'Open the snapshots folder',
    platforms: ['desktop'],
  },
  'Photos.StoreAsAttachment': {
    id: 'Photos.StoreAsAttachment',
    category: Grid3CommandCategory.PHOTOS,
    pluginId: 'photos',
    displayName: 'Attach Photo',
    description: 'Store the current photo as an attachment',
    platforms: ['desktop', 'ios'],
  },

  // ========================================
  // COMMAND EXECUTION COMMANDS
  // ========================================
  'CommandExecution.Wait': {
    id: 'CommandExecution.Wait',
    category: Grid3CommandCategory.COMMAND_EXECUTION,
    pluginId: 'commandexecution',
    displayName: 'Wait',
    description: 'Pause command execution for a specified duration',
    parameters: [
      {
        key: 'waittime',
        type: 'string',
        required: true,
        description: 'Duration (e.g. 00:00:01.5000000)',
      },
      {
        key: 'cancellable',
        type: 'boolean',
        required: false,
        description: 'Whether the wait can be cancelled',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
  'CommandExecution.AutoRepeat': {
    id: 'CommandExecution.AutoRepeat',
    category: Grid3CommandCategory.COMMAND_EXECUTION,
    pluginId: 'commandexecution',
    displayName: 'Auto Repeat',
    description: 'Repeat a set of commands multiple times with a gap',
    parameters: [
      {
        key: 'repeatcount',
        type: 'number',
        required: true,
        description: 'Number of times to repeat',
      },
      {
        key: 'repeatgap',
        type: 'string',
        required: true,
        description: 'Time gap between repeats (e.g. 00:00:00.0100000)',
      },
      {
        key: 'commands',
        type: 'string',
        required: true,
        description: 'Nested command collection to repeat',
      },
    ],
    platforms: ['desktop', 'ios', 'medicare', 'medicareBionics'],
  },
};

/**
 * Get command definition by ID
 */
export function getCommandDefinition(commandId: string): Grid3CommandDefinition | undefined {
  return GRID3_COMMANDS[commandId];
}

/**
 * Check if a command ID is known
 */
export function isKnownCommand(commandId: string): boolean {
  return commandId in GRID3_COMMANDS;
}

/**
 * Get all commands for a specific plugin
 */
export function getCommandsByPlugin(pluginId: string): Grid3CommandDefinition[] {
  return Object.values(GRID3_COMMANDS).filter((cmd) => cmd.pluginId === pluginId);
}

/**
 * Get all commands in a category
 */
export function getCommandsByCategory(category: Grid3CommandCategory): Grid3CommandDefinition[] {
  return Object.values(GRID3_COMMANDS).filter((cmd) => cmd.category === category);
}

/**
 * Get all command IDs
 */
export function getAllCommandIds(): string[] {
  return Object.keys(GRID3_COMMANDS);
}

/**
 * Get all plugin IDs that have commands
 */
export function getAllPluginIds(): string[] {
  const plugins = new Set(Object.values(GRID3_COMMANDS).map((cmd) => cmd.pluginId));
  return Array.from(plugins).sort();
}

/**
 * Extract parameters from a Grid 3 command object
 */
export interface ExtractedParameters {
  [key: string]: string | number | boolean;
}

function textOfStructured(val: any): string | undefined {
  if (!val || typeof val !== 'object') return undefined;

  const parts: string[] = [];
  const processS = (s: any): void => {
    if (!s) return;
    if (s.r !== undefined) {
      const rElements = Array.isArray(s.r) ? s.r : [s.r];
      for (const r of rElements) {
        if (typeof r === 'number') {
          if (r !== 0) parts.push(String(r));
          continue;
        }
        if (typeof r === 'object' && r !== null) {
          if ('#text' in r) parts.push(String(r['#text']));
          else if ('#cdata' in r) parts.push(String(r['#cdata']));
          else parts.push(String(r));
        } else {
          parts.push(String(r));
        }
      }
    }
  };

  if (val.p) {
    const sElements = Array.isArray(val.p.s) ? val.p.s : val.p.s ? [val.p.s] : [];
    sElements.forEach(processS);
  } else if (val.s) {
    const sElements = Array.isArray(val.s) ? val.s : [val.s];
    sElements.forEach(processS);
  } else if (val.r !== undefined) {
    processS(val);
  }

  return parts.length > 0 ? parts.join('').trim() : undefined;
}

function extractParamValue(param: any): string | number | boolean | undefined {
  if (typeof param === 'string') return param;

  if (param.p || param.s || (param.r !== undefined && typeof param.r !== 'string')) {
    const structured = textOfStructured(param);
    if (structured !== undefined) return structured;
  }

  const simple = param['#text'] ?? param.text ?? param.value;
  if (simple !== undefined) return simple as string | number | boolean;

  return textOfStructured(param);
}

export function extractCommandParameters(command: any): ExtractedParameters {
  const parameters: ExtractedParameters = {};
  const params = command.Parameter || command.parameter;

  if (!params) return parameters;

  const paramArray = Array.isArray(params) ? params : [params];

  for (const param of paramArray) {
    const key = param['@_Key'] || param.Key || param.key;
    let value = extractParamValue(param);

    if (key && value !== undefined) {
      // Try to convert to number if it looks numeric
      if (typeof value === 'string' && /^\d+$/.test(value)) {
        value = parseInt(value, 10);
      } else if (typeof value === 'string' && /^\d+\.\d+$/.test(value)) {
        value = parseFloat(value);
      } else if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      }

      parameters[key] = value;
    }
  }

  return parameters;
}

/**
 * Detect and categorize a command from Grid 3
 */
export function detectCommand(commandObj: any): {
  id: string;
  definition?: Grid3CommandDefinition;
  parameters: ExtractedParameters;
  category: Grid3CommandCategory | 'unknown';
  pluginId: string | 'unknown';
} {
  const commandId = String(commandObj['@_ID'] || commandObj.ID || commandObj.id || '');

  if (!commandId) {
    return {
      id: 'unknown',
      parameters: {},
      category: 'unknown' as any,
      pluginId: 'unknown',
    };
  }

  const definition = getCommandDefinition(commandId);
  const parameters = extractCommandParameters(commandObj);

  return {
    id: commandId,
    definition,
    parameters,
    category: definition?.category || ('unknown' as any),
    pluginId: definition?.pluginId || 'unknown',
  };
}

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

export function extractCommandParameters(command: any): ExtractedParameters {
  const parameters: ExtractedParameters = {};
  const params = command.Parameter || command.parameter;

  if (!params) return parameters;

  const paramArray = Array.isArray(params) ? params : [params];

  for (const param of paramArray) {
    const key = param['@_Key'] || param.Key || param.key;
    let value = param['#text'] ?? param.text ?? param.value;

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

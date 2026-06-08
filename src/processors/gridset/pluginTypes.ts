/**
 * Grid 3 Plugin Cell Type Detection
 *
 * Grid 3 uses three special cell types for different plugin functionalities:
 * - Workspace: Full editing workspaces (Email, Chat, WordProcessor, etc.)
 * - LiveCell: Dynamic content displays (Clock, Volume indicators, etc.)
 * - AutoContent: Dynamic word/content suggestions
 *
 * This module provides detection and metadata extraction for these cell types.
 */

/**
 * Cell types in Grid 3
 */
export enum Grid3CellType {
  Regular = 'regular',
  Workspace = 'workspace',
  LiveCell = 'livecell',
  AutoContent = 'autocontent',
}

/**
 * Plugin metadata extracted from Grid 3 cells
 */
export interface Grid3PluginMetadata {
  cellType: Grid3CellType;
  pluginId?: string;
  subType?: string;
  autoContentType?: string;
  liveCellType?: string;
  displayName?: string;
}

/**
 * Known workspace types in Grid 3
 */
export const WORKSPACE_TYPES = {
  CHAT: 'Chat',
  EMAIL: 'Email',
  WORD_PROCESSOR: 'WordProcessor',
  PHONE: 'Phone',
  SMS: 'Sms',
  WEB_BROWSER: 'WebBrowser',
  COMPUTER_CONTROL: 'ComputerControl',
  CALCULATOR: 'Calculator',
  TIMER: 'Timer',
  MUSIC_VIDEO: 'MusicVideo',
  PHOTOS: 'Photos',
  CONTACTS: 'Contacts',
  INTERACTIVE_LEARNING: 'InteractiveLearning',
  MESSAGE_BANKING: 'MessageBanking',
  ENVIRONMENT_CONTROL: 'EnvironmentControl',
  SETTINGS: 'Settings',
} as const;

/**
 * Known live cell types in Grid 3
 */
export const LIVECELL_TYPES = {
  DIGITAL_CLOCK: 'DigitalClock',
  ANALOG_CLOCK: 'AnalogClock',
  DATE_DISPLAY: 'DateDisplay',
  PUBLIC_VOLUME: 'PublicVolume',
  PUBLIC_SPEED: 'PublicSpeed',
  PUBLIC_VOICE: 'PublicVoice',
  MESSAGES: 'Messages',
  BATTERY: 'Battery',
  WIFI_STRENGTH: 'WifiStrength',
  BLUETOOTH_STATUS: 'BluetoothStatus',
  WEB_BROWSER_PAGE_TITLE: 'WebBrowser.PageTitle',
  CAMERA: 'Camera',
} as const;

/**
 * Known auto content types in Grid 3
 */
export const AUTOCONTENT_TYPES = {
  CHANGE_PUBLIC_VOICE: 'ChangePublicVoice',
  CHANGE_PUBLIC_SPEED: 'ChangePublicSpeed',
  EMAIL_CONTACTS: 'EmailContacts',
  EMAIL_RECIPIENTS: 'EmailRecipients',
  PHONE_CONTACTS: 'PhoneContacts',
  SMS_CONTACTS: 'SmsContacts',
  WEB_FAVORITES: 'WebFavorites',
  WEB_HISTORY: 'WebHistory',
  WEB_BROWSER_LINKS: 'WebBrowser.Links',
  WEB_BROWSER_FAVOURITES: 'WebBrowser.Favourites',
  PREDICTION: 'Prediction',
  GRAMMAR: 'Grammar',
  CONTEXTUAL: 'Contextual',
  WORDLIST: 'WordList',
  PHOTOS: 'Photos',
  MUSIC_VIDEO: 'MusicVideo',
  WEB_ADDRESS_ADDRESS_BAR: 'WebAddress.AddressBar',
} as const;

/**
 * Human-readable names for cell types
 */
export function getCellTypeDisplayName(cellType: Grid3CellType): string {
  switch (cellType) {
    case Grid3CellType.Workspace:
      return 'Workspace';
    case Grid3CellType.LiveCell:
      return 'Live Cell';
    case Grid3CellType.AutoContent:
      return 'Auto Content';
    case Grid3CellType.Regular:
      return 'Regular';
    default:
      return 'Unknown';
  }
}

/**
 * Detect plugin cell type from Grid 3 cell content
 *
 * @param content - Grid 3 cell content object
 * @returns Plugin metadata with detected type
 */
export function detectPluginCellType(content: any): Grid3PluginMetadata {
  if (!content) {
    return { cellType: Grid3CellType.Regular };
  }

  const contentType = content.ContentType || content.contenttype;
  const contentSubType = content.ContentSubType || content.contentsubtype;

  // Workspace cells - full editing workspaces
  if (contentType === 'Workspace' || content.Style?.BasedOnStyle === 'Workspace') {
    return {
      cellType: Grid3CellType.Workspace,
      subType: contentSubType || undefined,
      pluginId: inferWorkspacePlugin(String(contentSubType || '')),
      displayName: contentSubType ? `${contentSubType} Workspace` : 'Workspace',
    };
  }

  // LiveCell detection - dynamic content displays
  if (contentType === 'LiveCell' || content.Style?.BasedOnStyle === 'LiveCell') {
    return {
      cellType: Grid3CellType.LiveCell,
      liveCellType: contentSubType || undefined,
      pluginId: inferLiveCellPlugin(String(contentSubType || '')),
      displayName: contentSubType || 'Live Cell',
    };
  }

  // AutoContent detection - dynamic word/content suggestions
  if (contentType === 'AutoContent' || content.Style?.BasedOnStyle === 'AutoContent') {
    const autoContentType = extractAutoContentType(content) || contentSubType;
    return {
      cellType: Grid3CellType.AutoContent,
      autoContentType: autoContentType ? String(autoContentType) : undefined,
      pluginId: inferAutoContentPlugin(autoContentType ? String(autoContentType) : undefined),
      displayName: autoContentType ? String(autoContentType) : 'Auto Content',
    };
  }

  // Regular cell
  return {
    cellType: Grid3CellType.Regular,
  };
}

/**
 * Extract auto content type from AutoContent.Activate command
 */
function extractAutoContentType(content: any): string | undefined {
  const commands = content.Commands?.Command || content.commands?.command;
  if (!commands) return undefined;

  const commandArr = Array.isArray(commands) ? commands : [commands];

  for (const command of commandArr) {
    const commandId = command['@_ID'] || command.ID || command.id;
    if (commandId === 'AutoContent.Activate') {
      const parameters = command.Parameter || command.parameter;
      const paramArr = Array.isArray(parameters) ? parameters : parameters ? [parameters] : [];

      for (const param of paramArr) {
        const key = param['@_Key'] || param.Key || param.key;
        if (key === 'autocontenttype') {
          return String(param['#text'] || param.text || param.value || '');
        }
      }
    }
  }

  return undefined;
}

/**
 * Infer plugin ID from workspace subtype
 */
function inferWorkspacePlugin(subType?: string): string | undefined {
  if (!subType) return undefined;

  const normalized = subType.toLowerCase();

  if (normalized.includes('chat')) return 'Grid3.Chat';
  if (normalized.includes('email') || normalized.includes('mail')) return 'Grid3.Email';
  if (normalized.includes('word') || normalized.includes('doc')) return 'Grid3.WordProcessor';
  if (normalized.includes('phone')) return 'Grid3.Phone';
  if (normalized.includes('sms') || normalized.includes('text')) return 'Grid3.Sms';
  if (normalized.includes('browser') || normalized.includes('web')) return 'Grid3.WebBrowser';
  if (normalized.includes('computer')) return 'Grid3.ComputerControl';
  if (normalized.includes('calc')) return 'Grid3.Calculator';
  if (normalized.includes('timer')) return 'Grid3.Timer';
  if (normalized.includes('music') || normalized.includes('video')) return 'Grid3.MusicVideo';
  if (normalized.includes('photo') || normalized.includes('image')) return 'Grid3.Photos';
  if (normalized.includes('contact')) return 'Grid3.Contacts';
  if (normalized.includes('learning')) return 'Grid3.InteractiveLearning';
  if (normalized.includes('message') && normalized.includes('banking'))
    return 'Grid3.MessageBanking';
  if (normalized.includes('control')) return 'Grid3.EnvironmentControl';
  if (normalized.includes('settings')) return 'Grid3.Settings';

  return `Grid3.${subType}`;
}

/**
 * Infer plugin ID from live cell type
 */
function inferLiveCellPlugin(liveCellType?: string): string | undefined {
  if (!liveCellType) return undefined;

  const normalized = liveCellType.toLowerCase();

  if (normalized.includes('clock')) return 'Grid3.Clock';
  if (normalized.includes('date')) return 'Grid3.Clock';
  if (normalized.includes('volume')) return 'Grid3.Volume';
  if (normalized.includes('speed')) return 'Grid3.Speed';
  if (normalized.includes('voice')) return 'Grid3.Speech';
  if (normalized.includes('message')) return 'Grid3.Chat';
  if (normalized.includes('battery')) return 'Grid3.Battery';
  if (normalized.includes('wifi')) return 'Grid3.Wifi';
  if (normalized.includes('bluetooth')) return 'Grid3.Bluetooth';
  if (normalized.includes('pagetitle') || normalized.includes('page title'))
    return 'Grid3.WebBrowser';
  if (normalized.includes('camera')) return 'Grid3.Photos';

  return `Grid3.${liveCellType}`;
}

/**
 * Infer plugin ID from auto content type
 */
function inferAutoContentPlugin(autoContentType?: string): string | undefined {
  if (!autoContentType) return undefined;

  const normalized = autoContentType.toLowerCase();

  if (normalized.includes('voice') || normalized.includes('speed')) return 'Grid3.Speech';
  if (normalized.includes('email') || normalized.includes('mail')) return 'Grid3.Email';
  if (normalized.includes('phone')) return 'Grid3.Phone';
  if (normalized.includes('sms') || normalized.includes('text')) return 'Grid3.Sms';
  if (
    normalized.includes('web') ||
    normalized.includes('favorite') ||
    normalized.includes('favourite') ||
    normalized.includes('history') ||
    normalized.includes('links') ||
    normalized.includes('address')
  ) {
    return 'Grid3.WebBrowser';
  }
  if (normalized.includes('prediction')) return 'Grid3.Prediction';
  if (normalized.includes('grammar')) return 'Grid3.Grammar';
  if (normalized.includes('context')) return 'Grid3.AutoContent';
  if (normalized.includes('photo') || normalized.includes('image')) return 'Grid3.Photos';
  if (normalized.includes('music') || normalized.includes('video')) return 'Grid3.MusicVideo';

  return undefined;
}

/**
 * Check if a cell is a workspace cell
 */
export function isWorkspaceCell(metadata: Grid3PluginMetadata): boolean {
  return metadata.cellType === Grid3CellType.Workspace;
}

/**
 * Check if a cell is a live cell
 */
export function isLiveCell(metadata: Grid3PluginMetadata): boolean {
  return metadata.cellType === Grid3CellType.LiveCell;
}

/**
 * Check if a cell is an auto content cell
 */
export function isAutoContentCell(metadata: Grid3PluginMetadata): boolean {
  return metadata.cellType === Grid3CellType.AutoContent;
}

/**
 * Check if a cell is a regular (non-plugin) cell
 */
export function isRegularCell(metadata: Grid3PluginMetadata): boolean {
  return metadata.cellType === Grid3CellType.Regular;
}

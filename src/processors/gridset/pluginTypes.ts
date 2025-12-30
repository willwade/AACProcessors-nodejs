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
  PREDICTION: 'Prediction',
  GRAMMAR: 'Grammar',
  CONTEXTUAL: 'Contextual',
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

  const contentType = content.ContentType || content.contenttype || content.ContentType;
  const contentSubType = content.ContentSubType || content.contentsubtype || content.ContentSubType;

  // Workspace cells - full editing workspaces
  if (contentType === 'Workspace') {
    return {
      cellType: Grid3CellType.Workspace,
      subType: contentSubType || undefined,
      pluginId: inferWorkspacePlugin(String(contentSubType || '')),
      displayName: contentSubType ? `${contentSubType} Workspace` : 'Workspace',
    };
  }

  // LiveCell detection - dynamic content displays
  if (contentType === 'LiveCell') {
    return {
      cellType: Grid3CellType.LiveCell,
      liveCellType: contentSubType || undefined,
      pluginId: inferLiveCellPlugin(String(contentSubType || '')),
      displayName: contentSubType || 'Live Cell',
    };
  }

  // AutoContent detection - dynamic word/content suggestions
  if (contentType === 'AutoContent') {
    const autoContentType = extractAutoContentType(content);
    return {
      cellType: Grid3CellType.AutoContent,
      autoContentType: autoContentType || undefined,
      pluginId: inferAutoContentPlugin(autoContentType),
      displayName: autoContentType || 'Auto Content',
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

  if (normalized.includes('chat')) return 'chat';
  if (normalized.includes('email') || normalized.includes('mail')) return 'email';
  if (normalized.includes('word') || normalized.includes('processor')) return 'wordprocessor';
  if (normalized.includes('phone')) return 'phone';
  if (normalized.includes('sms') || normalized.includes('text')) return 'sms';
  if (normalized.includes('web') || normalized.includes('browser')) return 'webbrowser';
  if (normalized.includes('computer') || normalized.includes('control')) return 'computercontrol';
  if (normalized.includes('calculator') || normalized.includes('calc')) return 'calculator';
  if (normalized.includes('timer') || normalized.includes('stopwatch')) return 'timer';
  if (normalized.includes('music') || normalized.includes('video')) return 'musicvideo';
  if (normalized.includes('photo') || normalized.includes('image')) return 'photos';
  if (normalized.includes('contact')) return 'contacts';
  if (normalized.includes('learning')) return 'interactivelearning';
  if (normalized.includes('message') && normalized.includes('bank')) return 'messagebanking';
  if (normalized.includes('env') || normalized.includes('ir')) return 'environmentcontrol';
  if (normalized.includes('setting')) return 'settings';

  return undefined;
}

/**
 * Infer plugin ID from live cell type
 */
function inferLiveCellPlugin(liveCellType?: string): string | undefined {
  if (!liveCellType) return undefined;

  const normalized = liveCellType.toLowerCase();

  if (normalized.includes('clock') || normalized.includes('time') || normalized.includes('date')) {
    return 'clock';
  }
  if (normalized.includes('volume')) return 'speech';
  if (normalized.includes('speed')) return 'speech';
  if (normalized.includes('voice')) return 'speech';
  if (normalized.includes('message')) return 'chat';
  if (normalized.includes('battery')) return 'settings';
  if (normalized.includes('wifi') || normalized.includes('network')) return 'settings';
  if (normalized.includes('bluetooth')) return 'settings';

  return undefined;
}

/**
 * Infer plugin ID from auto content type
 */
function inferAutoContentPlugin(autoContentType?: string): string | undefined {
  if (!autoContentType) return undefined;

  const normalized = autoContentType.toLowerCase();

  if (normalized.includes('voice') || normalized.includes('speed')) return 'speech';
  if (normalized.includes('email') || normalized.includes('mail')) return 'email';
  if (normalized.includes('phone')) return 'phone';
  if (normalized.includes('sms') || normalized.includes('text')) return 'sms';
  if (
    normalized.includes('web') ||
    normalized.includes('favorite') ||
    normalized.includes('history')
  ) {
    return 'webbrowser';
  }
  if (normalized.includes('prediction')) return 'prediction';
  if (normalized.includes('grammar')) return 'grammar';
  if (normalized.includes('context')) return 'autocontent';

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

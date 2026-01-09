import { dotNetTicksToDate } from '../../utils/dotnetTicks';
import {
  findGrid3Users,
  Grid3UserPath,
  readAllGrid3History as readAllGrid3HistoryImpl,
  readGrid3History as readGrid3HistoryImpl,
  readGrid3HistoryForUser as readGrid3HistoryForUserImpl,
} from '../../processors/gridset/helpers';
import {
  findSnapUsers,
  readSnapUsage as readSnapUsageImpl,
  readSnapUsageForUser as readSnapUsageForUserImpl,
  SnapUserInfo,
} from '../../processors/snap/helpers';
import { AACSemanticCategory, AACSemanticIntent } from '../../core/treeStructure';

export type HistorySource = 'Grid' | 'Snap' | 'OBL' | string;

export interface HistoryOccurrence {
  timestamp: Date;
  latitude?: number | null;
  longitude?: number | null;
  modeling?: boolean;
  accessMethod?: number | null;
  pageId?: string | null;
  // OBL-aligned fields
  buttonId?: string | null;
  boardId?: string | null;
  spoken?: boolean;
  vocalization?: string;
  imageUrl?: string;
  actions?: any[]; // For OBL actions
  type?: 'button' | 'action' | 'utterance' | 'note' | 'other';
  // Semantic semantic alignment
  intent?: AACSemanticIntent | string;
  category?: AACSemanticCategory;
}

export interface HistoryPlatformExtras {
  label?: string;
  message?: string;
  buttonId?: string;
  contentXml?: string;
  [key: string]: any;
}

export interface HistoryEntry {
  id: string;
  source: HistorySource;
  content: string;
  occurrences: HistoryOccurrence[];
  raw?: unknown;
  platform?: HistoryPlatformExtras;
}

export { dotNetTicksToDate };

export interface BatonExportMetadata {
  timestamp: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface BatonExportSentence {
  uuid: string;
  anonymousUUID: string;
  content: string;
  metadata: BatonExportMetadata[];
  source: HistorySource;
}

export interface BatonExport {
  version: string;
  exportDate: string;
  encryption: string;
  sentenceCount: number;
  sentences: BatonExportSentence[];
}

const generateUuid = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // RFC4122-ish fallback for Node without crypto.randomUUID
  const hex = '0123456789abcdef';
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const toHex = (b: number): string => hex[(b >> 4) & 0x0f] + hex[b & 0x0f];
  return (
    toHex(bytes[0]) +
    toHex(bytes[1]) +
    toHex(bytes[2]) +
    toHex(bytes[3]) +
    '-' +
    toHex(bytes[4]) +
    toHex(bytes[5]) +
    '-' +
    toHex(bytes[6]) +
    toHex(bytes[7]) +
    '-' +
    toHex(bytes[8]) +
    toHex(bytes[9]) +
    '-' +
    toHex(bytes[10]) +
    toHex(bytes[11]) +
    toHex(bytes[12]) +
    toHex(bytes[13]) +
    toHex(bytes[14]) +
    toHex(bytes[15])
  );
};

export function exportHistoryToBaton(
  entries: HistoryEntry[],
  options?: {
    version?: string;
    exportDate?: string | Date;
    encryption?: string;
    anonymousUUID?: string;
  }
): BatonExport {
  const exportDate =
    options?.exportDate instanceof Date
      ? options.exportDate.toISOString()
      : options?.exportDate || new Date().toISOString();
  const anonymousUUID = options?.anonymousUUID || generateUuid();
  const sentences = entries.map((entry) => ({
    uuid: generateUuid(),
    anonymousUUID,
    content: entry.content,
    metadata: entry.occurrences.map((occ) => ({
      timestamp: occ.timestamp.toISOString(),
      latitude: occ.latitude ?? null,
      longitude: occ.longitude ?? null,
    })),
    source: entry.source,
  }));

  return {
    version: options?.version || '1.0',
    exportDate,
    encryption: options?.encryption || 'none',
    sentenceCount: sentences.length,
    sentences,
  };
}

/**
 * Read Grid 3 phrase history from a history.sqlite database and tag entries with their source.
 */
export function readGrid3History(historyDbPath: string): HistoryEntry[] {
  return readGrid3HistoryImpl(historyDbPath).map((e) => ({
    ...e,
    source: 'Grid',
  }));
}

/**
 * Read Grid 3 history for a specific user/language combination.
 */
export function readGrid3HistoryForUser(userName: string, langCode?: string): HistoryEntry[] {
  return readGrid3HistoryForUserImpl(userName, langCode).map((e) => ({
    ...e,
    source: 'Grid',
  }));
}

/**
 * Read every available Grid 3 history database on the machine.
 */
export function readAllGrid3History(): HistoryEntry[] {
  return readAllGrid3HistoryImpl().map((e) => ({ ...e, source: 'Grid' }));
}

/**
 * Read Snap button usage from a pageset database and tag entries with source.
 */
export function readSnapUsage(pagesetPath: string): HistoryEntry[] {
  return readSnapUsageImpl(pagesetPath).map((e) => ({ ...e, source: 'Snap' }));
}

/**
 * Read Snap usage for a specific user across all discovered pagesets.
 */
export function readSnapUsageForUser(
  userId?: string,
  packageNamePattern = 'TobiiDynavox'
): HistoryEntry[] {
  return readSnapUsageForUserImpl(userId, packageNamePattern).map((e) => ({
    ...e,
    source: 'Snap',
  }));
}

export function listSnapUsers(): SnapUserInfo[] {
  return findSnapUsers();
}

/**
 * List Grid 3 users on the current machine.
 */
export function listGrid3Users(): Grid3UserPath[] {
  return findGrid3Users();
}

/**
 * Convenience helper to gather all available history across Grid 3 and Snap.
 * Returns an empty array if no history files are present.
 */
export function collectUnifiedHistory(): HistoryEntry[] {
  const gridHistory = readAllGrid3History();
  const snapHistory = findSnapUsers().flatMap((u) => readSnapUsageForUser(u.userId));
  return [...gridHistory, ...snapHistory];
}

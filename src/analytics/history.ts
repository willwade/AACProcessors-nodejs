import { dotNetTicksToDate } from '../utils/dotnetTicks';
import {
  findGrid3Users,
  Grid3UserPath,
  readAllGrid3History as readAllGrid3HistoryImpl,
  readGrid3History as readGrid3HistoryImpl,
  readGrid3HistoryForUser as readGrid3HistoryForUserImpl,
} from '../processors/gridset/helpers';
import {
  findSnapUsers,
  readSnapUsage as readSnapUsageImpl,
  readSnapUsageForUser as readSnapUsageForUserImpl,
  SnapUserInfo,
} from '../processors/snap/helpers';

export type HistorySource = 'Grid' | 'Snap';

export interface HistoryOccurrence {
  timestamp: Date;
  latitude?: number | null;
  longitude?: number | null;
  modeling?: boolean;
  accessMethod?: number | null;
  pageId?: string | null;
}

export interface HistoryPlatformExtras {
  label?: string;
  message?: string;
  buttonId?: string;
  contentXml?: string;
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

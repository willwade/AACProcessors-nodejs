import { dotNetTicksToDate } from "../../utils/dotnetTicks";
import {
  findGrid3Users,
  Grid3UserPath,
  readAllGrid3History as readAllGrid3HistoryImpl,
  readGrid3History as readGrid3HistoryImpl,
  readGrid3HistoryForUser as readGrid3HistoryForUserImpl,
} from "../../processors/gridset/helpers";
import {
  findSnapUsers,
  readSnapUsage as readSnapUsageImpl,
  readSnapUsageForUser as readSnapUsageForUserImpl,
  SnapUserInfo,
} from "../../processors/snap/helpers";
import {
  AACSemanticCategory,
  AACSemanticIntent,
} from "../../core/treeStructure";

export type HistorySource = "Grid" | "Snap" | "OBL" | string;

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
  type?: "button" | "action" | "utterance" | "note" | "other";
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
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // RFC4122-ish fallback for Node without crypto.randomUUID
  const hex = "0123456789abcdef";
  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const toHex = (b: number): string => hex[(b >> 4) & 0x0f] + hex[b & 0x0f];
  return (
    toHex(bytes[0]) +
    toHex(bytes[1]) +
    toHex(bytes[2]) +
    toHex(bytes[3]) +
    "-" +
    toHex(bytes[4]) +
    toHex(bytes[5]) +
    "-" +
    toHex(bytes[6]) +
    toHex(bytes[7]) +
    "-" +
    toHex(bytes[8]) +
    toHex(bytes[9]) +
    "-" +
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
  },
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
    version: options?.version || "1.0",
    exportDate,
    encryption: options?.encryption || "none",
    sentenceCount: sentences.length,
    sentences,
  };
}

/**
 * Read Grid 3 phrase history from a history.sqlite database and tag entries with their source.
 */
export async function readGrid3History(
  historyDbPath: string,
): Promise<HistoryEntry[]> {
  const history = await readGrid3HistoryImpl(historyDbPath);
  return history.map((e) => ({
    ...e,
    source: "Grid",
  }));
}

/**
 * Read Grid 3 history for a specific user/language combination.
 */
export async function readGrid3HistoryForUser(
  userName: string,
  langCode?: string,
): Promise<HistoryEntry[]> {
  const history = await readGrid3HistoryForUserImpl(userName, langCode);
  return history.map((e) => ({
    ...e,
    source: "Grid",
  }));
}

/**
 * Read every available Grid 3 history database on the machine.
 */
export async function readAllGrid3History(): Promise<HistoryEntry[]> {
  const history = await readAllGrid3HistoryImpl();
  return history.map((e) => ({ ...e, source: "Grid" }));
}

/**
 * Read Snap button usage from a pageset database and tag entries with source.
 */
export async function readSnapUsage(
  pagesetPath: string,
): Promise<HistoryEntry[]> {
  const usage = await readSnapUsageImpl(pagesetPath);
  return usage.map((e) => ({ ...e, source: "Snap" }));
}

/**
 * Read Snap usage for a specific user across all discovered pagesets.
 */
export async function readSnapUsageForUser(
  userId?: string,
  packageNamePattern = "TobiiDynavox",
): Promise<HistoryEntry[]> {
  const usage = await readSnapUsageForUserImpl(userId, packageNamePattern);
  return usage.map((e) => ({
    ...e,
    source: "Snap",
  }));
}

export async function listSnapUsers(): Promise<SnapUserInfo[]> {
  return await findSnapUsers();
}

/**
 * List Grid 3 users on the current machine.
 */
export async function listGrid3Users(): Promise<Grid3UserPath[]> {
  return await findGrid3Users();
}

/**
 * Convenience helper to gather all available history across Grid 3 and Snap.
 * Returns an empty array if no history files are present.
 */
export async function collectUnifiedHistory(): Promise<HistoryEntry[]> {
  const gridHistory = await readAllGrid3History();
  const users = await findSnapUsers();
  const snapHistory = await Promise.all(
    users.map(async (u) => await readSnapUsageForUser(u.userId)),
  );
  return [...gridHistory, ...snapHistory.flat()];
}

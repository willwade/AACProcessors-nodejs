import { inflate } from 'pako';

export type NuVoiceRecordType =
  | 'v'
  | 'd'
  | 'm'
  | 'x'
  | 'X'
  | 'P'
  | 'H'
  | 'A'
  | 'n'
  | 'N'
  | 'S'
  | 'E'
  | 'G'
  | 'a'
  | 'C'
  | 'D'
  | 'U'
  | 'V'
  | 'p'
  | 'k'
  | 'q';

export interface NuVoiceBinaryRecordBase {
  type: NuVoiceRecordType;
  rawLine: string;
  bodyBytes: Uint8Array;
  checksum: number;
  checksumValid: boolean;
}

export type NuVoiceTextEncoding = 'latin1' | 'utf16le' | 'utf16be';

export interface NuVoiceTextSegment {
  text: string;
  hasNullTerminator: boolean;
  suffixBytes: Uint8Array;
  prefixBytes: Uint8Array;
  encoding: NuVoiceTextEncoding;
  lengthPrefixed?: boolean;
}

export interface NuVoiceHeaderRecord {
  type: 'v';
  rawLine: string;
  version?: string;
  variant?: string;
  product?: string;
}

export interface NuVoiceDictionaryRecord extends NuVoiceBinaryRecordBase {
  type: 'd';
  word: string;
  pronunciation: string;
  trailingBytes: Uint8Array;
}

export interface NuVoiceMemoryRecord extends NuVoiceBinaryRecordBase {
  type: 'm';
  addressHex: string;
  sequence: number;
  payloadBytes: Uint8Array;
  textSegment: NuVoiceTextSegment | null;
  parsedButton?: NuVoiceButtonData;
}

export interface NuVoiceLayoutRecord extends NuVoiceBinaryRecordBase {
  type: 'x';
  addressHex: string;
  payloadBytes: Uint8Array;
  textSegment: NuVoiceTextSegment | null;
}

export interface NuVoicePointerRecord extends NuVoiceBinaryRecordBase {
  type: 'X';
}

// Additional record types found in fuller MTI files (based on NuVoice Maps analysis)
export interface NuVoicePageTLVEntry {
  controlId: number;
  payload: Uint8Array;
  text?: string;
}

export interface NuVoicePageCommand {
  opcode: number;
  payload: Uint8Array;
  text?: string;
}

export interface NuVoicePageRecord extends NuVoiceBinaryRecordBase {
  type: 'P';
  asciiText?: string;
  key?: string;
  value?: string;
  binarySubtype?: number;
  metrics?: number[];
  tlvEntries?: NuVoicePageTLVEntry[];
  commands?: NuVoicePageCommand[];
}

export interface NuVoiceHeaderRecord2 extends NuVoiceBinaryRecordBase {
  type: 'H'; // Additional header information
}

export interface NuVoiceActionRecord extends NuVoiceBinaryRecordBase {
  type: 'A'; // Action/button definitions
}

export interface NuVoiceNavigationRecord extends NuVoiceBinaryRecordBase {
  type: 'n'; // Navigation elements
}

export interface NuVoiceNodeRecord extends NuVoiceBinaryRecordBase {
  type: 'N'; // Structural nodes
}

export interface NuVoiceSymbolRecord extends NuVoiceBinaryRecordBase {
  type: 'S'; // Symbol/string data
}

export interface NuVoiceElementRecord extends NuVoiceBinaryRecordBase {
  type: 'E'; // UI elements
}

export interface NuVoiceGridRecord extends NuVoiceBinaryRecordBase {
  type: 'G'; // Grid layouts
  gridId?: string;
  rows?: number;
  columns?: number;
}

export interface NuVoiceAudioRecord extends NuVoiceBinaryRecordBase {
  type: 'a'; // Audio data
}

export interface NuVoiceCellRecord extends NuVoiceBinaryRecordBase {
  type: 'C';
  asciiText?: string;
  key?: string;
  value?: string;
  colorValue?: number;
}

export interface NuVoiceDataRecord extends NuVoiceBinaryRecordBase {
  type: 'D'; // Data records
}

export interface NuVoiceUIRecord extends NuVoiceBinaryRecordBase {
  type: 'U'; // User interface elements
}

export interface NuVoiceVoiceRecord extends NuVoiceBinaryRecordBase {
  type: 'V'; // Voice data
}

export interface NuVoicePositionRecord extends NuVoiceBinaryRecordBase {
  type: 'p'; // Position data
}

export interface NuVoiceKeyRecord extends NuVoiceBinaryRecordBase {
  type: 'k'; // Key definitions
}

export interface NuVoiceQueryRecord extends NuVoiceBinaryRecordBase {
  type: 'q'; // Query data
}

export type NuVoiceRecord =
  | NuVoiceHeaderRecord
  | NuVoiceDictionaryRecord
  | NuVoiceMemoryRecord
  | NuVoiceLayoutRecord
  | NuVoicePointerRecord
  | NuVoicePageRecord
  | NuVoiceCellRecord
  | NuVoiceActionRecord
  | NuVoiceGridRecord
  | NuVoiceBinaryRecordBase; // For unknown types

export interface NuVoiceDocument {
  lineEnding: '\n' | '\r\n';
  trailingNewline: boolean;
  records: NuVoiceRecord[];
}

export interface NuVoiceTextEntry {
  source: string;
  table: 'dictionary' | 'memory' | 'layout' | 'other';
  column: 'WORD' | 'PRONUNCIATION' | 'TEXT';
  id: string;
}

function assertHex(input: string, context: string): void {
  if (input.length % 2 !== 0 || !/^[0-9A-Fa-f]*$/.test(input)) {
    throw new Error(`Invalid hex in ${context}`);
  }
}

export function hexToBytes(hex: string): Uint8Array {
  assertHex(hex, 'NuVoice record');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0').toUpperCase()).join('');
}

export function bytesToLatin1(bytes: Uint8Array): string {
  let output = '';
  for (const value of bytes) {
    output += String.fromCharCode(value);
  }
  return output;
}

export function latin1ToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const codePoint = text.charCodeAt(i);
    if (codePoint > 0xff) {
      throw new Error(`NuVoice MTI only supports Latin-1 text; found code point ${codePoint}`);
    }
    bytes[i] = codePoint;
  }
  return bytes;
}

export function computeNuVoiceChecksum(bodyBytes: Uint8Array): number {
  const sum = bodyBytes.reduce((total, value) => total + value, 0);
  return ~sum & 0xff;
}

function isPrintableAscii(bytes: Uint8Array): boolean {
  return bytes.every(
    (value) => value === 0x0a || value === 0x0d || (value >= 0x20 && value <= 0x7e)
  );
}

function decodeUtf16Bytes(bytes: Uint8Array, encoding: 'utf16le' | 'utf16be'): string {
  if (typeof TextDecoder !== 'undefined') {
    try {
      return new TextDecoder(encoding).decode(bytes);
    } catch {
      // Fallback to manual decoding
    }
  }
  let result = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const codePoint =
      encoding === 'utf16le' ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1];
    result += String.fromCharCode(codePoint);
  }
  return result;
}

function encodeUtf16Bytes(text: string, encoding: 'utf16le' | 'utf16be'): Uint8Array {
  const bytes = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i += 1) {
    const codePoint = text.charCodeAt(i);
    if (encoding === 'utf16le') {
      bytes[i * 2] = codePoint & 0xff;
      bytes[i * 2 + 1] = codePoint >> 8;
    } else {
      bytes[i * 2] = codePoint >> 8;
      bytes[i * 2 + 1] = codePoint & 0xff;
    }
  }
  return bytes;
}

interface Utf16DetectionResult {
  encoding: 'utf16le' | 'utf16be';
  textStart: number;
}

function detectUtf16Segment(payloadBytes: Uint8Array): Utf16DetectionResult | null {
  if (payloadBytes.length < 2) {
    return null;
  }

  const searchLimit = Math.min(payloadBytes.length - 1, 128);
  for (let offset = 0; offset < searchLimit; offset += 1) {
    const next = payloadBytes[offset + 1];
    if (next === undefined) {
      break;
    }
    if (payloadBytes[offset] === 0xff && next === 0xfe) {
      const textStart = offset + 2;
      return { encoding: 'utf16le', textStart };
    }
    if (payloadBytes[offset] === 0xfe && next === 0xff) {
      const textStart = offset + 2;
      return { encoding: 'utf16be', textStart };
    }
  }

  const maxStart = Math.min(payloadBytes.length - 4, 32);
  for (let start = 0; start <= maxStart; start += 1) {
    const remainingPairs = Math.floor((payloadBytes.length - start) / 2);
    const samplePairs = Math.min(16, remainingPairs);
    if (samplePairs <= 0) {
      continue;
    }
    let leScore = 0;
    let beScore = 0;
    for (let i = 0; i < samplePairs; i += 1) {
      const first = payloadBytes[start + i * 2];
      const second = payloadBytes[start + i * 2 + 1];
      if (first === 0 && second === 0) {
        break;
      }
      if (first >= 0x20 && first <= 0x7e && second === 0) {
        leScore += 1;
      }
      if (first === 0 && second >= 0x20 && second <= 0x7e) {
        beScore += 1;
      }
    }

    if (leScore >= Math.max(3, beScore * 2)) {
      return { encoding: 'utf16le', textStart: start };
    }
    if (beScore >= Math.max(3, leScore * 2)) {
      return { encoding: 'utf16be', textStart: start };
    }
  }

  return null;
}

function parseUtf16TextSegment(payloadBytes: Uint8Array): NuVoiceTextSegment | null {
  const detection = detectUtf16Segment(payloadBytes);
  if (!detection) {
    return null;
  }

  const { encoding, textStart } = detection;
  if (payloadBytes.length - textStart < 2) {
    return null;
  }

  let textEnd = payloadBytes.length;
  for (let i = textStart; i + 1 < payloadBytes.length; i += 2) {
    if (payloadBytes[i] === 0 && payloadBytes[i + 1] === 0) {
      textEnd = i;
      break;
    }
  }

  if (textEnd <= textStart) {
    return null;
  }

  let textBytes = payloadBytes.slice(textStart, textEnd);
  if (textBytes.length % 2 === 1) {
    textBytes = textBytes.slice(0, textBytes.length - 1);
  }
  if (textBytes.length === 0) {
    return null;
  }

  const text = decodeUtf16Bytes(textBytes, encoding);
  if (text.trim().length === 0) {
    return null;
  }

  const hasNullTerminator = textEnd < payloadBytes.length;
  const suffixStart = hasNullTerminator ? Math.min(textEnd + 2, payloadBytes.length) : textEnd;
  const prefixBytes = textStart > 0 ? payloadBytes.slice(0, textStart) : new Uint8Array();

  return {
    text,
    hasNullTerminator,
    suffixBytes: payloadBytes.slice(suffixStart),
    prefixBytes,
    encoding,
  };
}

function parseLatin1TextSegment(payloadBytes: Uint8Array): NuVoiceTextSegment | null {
  if (payloadBytes.length === 0) {
    return null;
  }

  const nullIndex = payloadBytes.indexOf(0);
  const textEnd = nullIndex >= 0 ? nullIndex : payloadBytes.length;
  const textBytes = payloadBytes.slice(0, textEnd);
  if (textBytes.length === 0 || !isPrintableAscii(textBytes)) {
    return null;
  }

  const text = bytesToLatin1(textBytes);
  if (text.trim().length === 0) {
    return null;
  }

  const suffixStart = nullIndex >= 0 ? nullIndex + 1 : textEnd;
  return {
    text,
    hasNullTerminator: nullIndex >= 0,
    suffixBytes: payloadBytes.slice(suffixStart),
    prefixBytes: new Uint8Array(),
    encoding: 'latin1',
  };
}

function extractPrintableAsciiSequences(payloadBytes: Uint8Array): string[] {
  const sequences: string[] = [];
  let start = -1;
  for (let i = 0; i < payloadBytes.length; i += 1) {
    const value = payloadBytes[i];
    if (value >= 0x20 && value <= 0x7e) {
      if (start === -1) {
        start = i;
      }
    } else if (start !== -1) {
      const slice = payloadBytes.slice(start, i);
      if (slice.length >= 2) {
        sequences.push(bytesToLatin1(slice));
      }
      start = -1;
    }
  }
  if (start !== -1) {
    const slice = payloadBytes.slice(start);
    if (slice.length >= 2) {
      sequences.push(bytesToLatin1(slice));
    }
  }
  return sequences;
}

function deriveMemoryTextSegmentFromAscii(payloadBytes: Uint8Array): NuVoiceTextSegment | null {
  const sequences = extractPrintableAsciiSequences(payloadBytes)
    .map((text) => text.trim())
    .filter((text) => text.length >= 2);
  if (sequences.length === 0) {
    return null;
  }

  const containsLower = (text: string): boolean => /[a-z]/.test(text);
  const containsSpace = (text: string): boolean => text.includes(' ');
  const containsLetter = (text: string): boolean => /[A-Za-z]/.test(text);

  const candidate =
    sequences.find((text) => containsLower(text) || containsSpace(text)) ??
    sequences.find((text) => containsLetter(text) && !text.includes('_')) ??
    sequences.find((text) => containsLetter(text)) ??
    sequences[0];

  if (!candidate) {
    return null;
  }

  return {
    text: candidate,
    hasNullTerminator: false,
    prefixBytes: new Uint8Array(),
    suffixBytes: new Uint8Array(),
    encoding: 'latin1',
  };
}

function parseLengthPrefixedTextSegment(payloadBytes: Uint8Array): NuVoiceTextSegment | null {
  if (payloadBytes.length < 2) {
    return null;
  }
  for (let offset = 0; offset < payloadBytes.length - 1; offset += 1) {
    const length = payloadBytes[offset];
    if (length === 0) {
      continue;
    }
    const start = offset + 1;
    const end = start + length;
    if (end > payloadBytes.length) {
      continue;
    }
    const textBytes = payloadBytes.slice(start, end);
    if (!isPrintableAscii(textBytes)) {
      continue;
    }
    const text = bytesToLatin1(textBytes);
    if (text.trim().length === 0) {
      continue;
    }
    return {
      text,
      hasNullTerminator: false,
      prefixBytes: payloadBytes.slice(0, start),
      suffixBytes: payloadBytes.slice(end),
      encoding: 'latin1',
      lengthPrefixed: true,
    };
  }
  return null;
}

export function parseTextSegment(payloadBytes: Uint8Array): NuVoiceTextSegment | null {
  return (
    parseLatin1TextSegment(payloadBytes) ??
    parseLengthPrefixedTextSegment(payloadBytes) ??
    parseUtf16TextSegment(payloadBytes)
  );
}

function parseHeaderRecord(line: string): NuVoiceHeaderRecord {
  const match = /^v(\d+)\s+(\S+)\s+(.+)$/.exec(line);
  return {
    type: 'v',
    rawLine: line,
    version: match?.[1],
    variant: match?.[2],
    product: match?.[3],
  };
}

function parseBinaryRecord(line: string): NuVoiceBinaryRecordBase {
  if (line.length < 4) {
    throw new Error(`Invalid NuVoice record line: ${line}`);
  }

  const bodyHex = line.slice(1, -2);
  const checksumHex = line.slice(-2);
  assertHex(bodyHex, 'NuVoice record body');
  assertHex(checksumHex, 'NuVoice record checksum');

  const bodyBytes = hexToBytes(bodyHex);
  const checksum = parseInt(checksumHex, 16);

  return {
    type: line[0] as NuVoiceRecordType,
    rawLine: line,
    bodyBytes,
    checksum,
    checksumValid: computeNuVoiceChecksum(bodyBytes) === checksum,
  };
}

function parseDictionaryRecord(line: string): NuVoiceDictionaryRecord {
  const base = parseBinaryRecord(line);
  if (base.bodyBytes.length < 2) {
    throw new Error(`Invalid NuVoice dictionary record: ${line}`);
  }

  const wordLength = base.bodyBytes[0];
  const wordStart = 1;
  const wordEnd = wordStart + wordLength;
  const pronunciationLengthIndex = wordEnd;
  if (pronunciationLengthIndex >= base.bodyBytes.length) {
    throw new Error(`Invalid NuVoice dictionary record length: ${line}`);
  }

  const pronunciationLength = base.bodyBytes[pronunciationLengthIndex];
  const pronunciationStart = pronunciationLengthIndex + 1;
  const pronunciationEnd = pronunciationStart + pronunciationLength;

  if (pronunciationEnd > base.bodyBytes.length) {
    throw new Error(`Invalid NuVoice pronunciation length: ${line}`);
  }

  return {
    ...base,
    type: 'd',
    word: bytesToLatin1(base.bodyBytes.slice(wordStart, wordEnd)),
    pronunciation: bytesToLatin1(base.bodyBytes.slice(pronunciationStart, pronunciationEnd)),
    trailingBytes: base.bodyBytes.slice(pronunciationEnd),
  };
}

function parseMemoryRecord(line: string): NuVoiceMemoryRecord {
  const base = parseBinaryRecord(line);
  const MIN_MEMORY_LENGTH = 10;
  if (base.bodyBytes.length < MIN_MEMORY_LENGTH) {
    console.warn(`Skipping truncated NuVoice memory record: ${line}`);
    throw new Error(`Invalid NuVoice memory record: ${line}`);
  }

  const fullBytes = new Uint8Array(base.bodyBytes.length + 1);
  fullBytes[0] = 0x6d;
  fullBytes.set(base.bodyBytes, 1);

  const pageBytes = fullBytes.slice(4, 6);
  const sequence = fullBytes[6];
  const payloadBytes = base.bodyBytes.slice(6);
  const parsedButton = parseNuVoiceButtonPayload(fullBytes);
  return {
    ...base,
    type: 'm',
    addressHex: bytesToHex(pageBytes),
    sequence,
    payloadBytes,
    textSegment: parsedButton?.name
      ? {
          text: parsedButton.name,
          hasNullTerminator: false,
          prefixBytes: new Uint8Array(),
          suffixBytes: new Uint8Array(),
          encoding: 'latin1',
        }
      : (parseTextSegment(payloadBytes) ?? deriveMemoryTextSegmentFromAscii(payloadBytes)),
    parsedButton,
  };
}

function textFromRecordBody(type: string, bodyBytes: Uint8Array): string | undefined {
  if (bodyBytes.length === 0 || !isPrintableAscii(bodyBytes)) {
    return undefined;
  }
  return `${type}${bytesToLatin1(bodyBytes)}`;
}

function parseNuVoiceButtonPayload(fullBytes: Uint8Array): NuVoiceButtonData | undefined {
  if (fullBytes.length < 14 || fullBytes[0] !== 0x6d) {
    return undefined;
  }
  const formatMarker = fullBytes[9];
  if (formatMarker >= 1 && formatMarker <= 49) {
    return parseNuVoiceFormat1(fullBytes, formatMarker);
  }
  if (formatMarker === 0) {
    return parseNuVoiceFormat2(fullBytes);
  }
  if ([0x87, 0xaf, 0xcc, 0xff].includes(formatMarker)) {
    return parseNuVoiceFormat5(fullBytes);
  }
  return undefined;
}

function parseNuVoiceFormat1(fullBytes: Uint8Array, nameLength: number): NuVoiceButtonData {
  let cursor = 10;
  const end = Math.min(cursor + nameLength, fullBytes.length);
  const name = bytesToLatin1(fullBytes.slice(cursor, end)).trim();
  cursor = end;
  if (cursor < fullBytes.length && fullBytes[cursor] === 0) {
    cursor += 1;
  }
  let icon: string | undefined;
  if (cursor < fullBytes.length) {
    const iconLength = fullBytes[cursor];
    cursor += 1;
    if (iconLength > 0 && cursor + iconLength <= fullBytes.length) {
      icon = bytesToLatin1(fullBytes.slice(cursor, cursor + iconLength)).trim();
      cursor += iconLength;
    }
  }
  const { speech, navigationType, navigationTarget, functions, randomChoiceTarget } =
    parseNuVoiceFunctions(fullBytes.slice(cursor));
  return {
    name: sanitizeNuVoiceLabel(name),
    icon,
    speech,
    navigationType,
    navigationTarget,
    randomChoiceTarget,
    functions,
  };
}

function parseNuVoiceFormat2(fullBytes: Uint8Array): NuVoiceButtonData {
  let cursor = 10;
  while (cursor < fullBytes.length && fullBytes[cursor] === 0) {
    cursor += 1;
  }
  let end = cursor;
  while (end + 1 < fullBytes.length) {
    if (fullBytes[end] === 0x0d && fullBytes[end + 1] === 0x0a) {
      break;
    }
    end += 1;
  }
  const text = bytesToLatin1(fullBytes.slice(cursor, end)).split('\u0000').join('').trim();
  return {
    name: sanitizeNuVoiceLabel(text),
    speech: sanitizeNuVoiceSpeech(text),
    functions: [],
  };
}

function parseNuVoiceFormat5(fullBytes: Uint8Array): NuVoiceButtonData | undefined {
  if (fullBytes.length < 14) {
    return undefined;
  }
  const nameLength = fullBytes[13];
  let cursor = 14;
  const name = bytesToLatin1(fullBytes.slice(cursor, cursor + nameLength)).trim();
  cursor += nameLength;
  if (cursor < fullBytes.length && fullBytes[cursor] === 0) {
    cursor += 1;
  }
  let icon: string | undefined;
  if (cursor < fullBytes.length) {
    const iconLength = fullBytes[cursor] ?? 0;
    cursor += 1;
    icon = bytesToLatin1(fullBytes.slice(cursor, cursor + iconLength)).trim();
    cursor += iconLength;
  }
  const { speech, navigationType, navigationTarget, functions, randomChoiceTarget } =
    parseNuVoiceFunctions(fullBytes.slice(cursor));
  return {
    name: sanitizeNuVoiceLabel(name),
    icon,
    speech,
    navigationType,
    navigationTarget,
    randomChoiceTarget,
    functions,
  };
}

function parseNuVoiceFunctions(payload: Uint8Array): {
  speech?: string;
  navigationType?: 'PERMANENT' | 'TEMPORARY' | 'HOME' | 'BACK';
  navigationTarget?: string;
  randomChoiceTarget?: string;
  functions: NuVoiceButtonFunction[];
} {
  const functions: NuVoiceButtonFunction[] = [];
  let speech: string | undefined;
  let navigationType: 'PERMANENT' | 'TEMPORARY' | 'HOME' | 'BACK' | undefined;
  let navigationTarget: string | undefined;
  let randomChoiceTarget: string | undefined;
  let cursor = 0;
  while (cursor + 1 < payload.length) {
    if (payload[cursor] === 0xa4 && cursor + 1 < payload.length) {
      const code = payload[cursor + 1];
      cursor += 2;
      if (code === 0x3a) {
        const end = findMarkerEnd(payload, cursor);
        speech = bytesToLatin1(payload.slice(cursor, end)).trim();
        cursor = end;
      } else if (code === 0x06) {
        const { text, next } = extractParentheticalText(payload, cursor);
        randomChoiceTarget = text;
        cursor = next;
      } else if (code === 0x8b) {
        navigationType = 'HOME';
        navigationTarget = '0400';
      } else if (code === 0x85) {
        navigationType = 'BACK';
      } else if (code === 0x8c || code === 0x8d) {
        const { text, next } = extractParentheticalText(payload, cursor);
        navigationType = code === 0x8c ? 'PERMANENT' : 'TEMPORARY';
        navigationTarget = text;
        cursor = next;
      } else {
        functions.push({ type: `0xA4:${code.toString(16)}` });
      }
    } else if (
      payload[cursor] === 0xff &&
      cursor + 3 < payload.length &&
      payload[cursor + 2] === 0x80
    ) {
      const code = payload[cursor + 3];
      cursor += 4;
      if (code === 0x85) {
        navigationType = 'BACK';
      } else if (code === 0x8c || code === 0x8d) {
        const { text, next } = extractParentheticalText(payload, cursor);
        navigationType = code === 0x8c ? 'PERMANENT' : 'TEMPORARY';
        navigationTarget = text;
        cursor = next;
      }
    } else {
      cursor += 1;
    }
  }
  return {
    speech: sanitizeNuVoiceSpeech(speech),
    navigationType,
    navigationTarget,
    randomChoiceTarget,
    functions,
  };
}

function findMarkerEnd(payload: Uint8Array, start: number): number {
  let cursor = start;
  while (cursor < payload.length) {
    if (payload[cursor] === 0xa4 || (payload[cursor] === 0x0d && payload[cursor + 1] === 0x0a)) {
      break;
    }
    cursor += 1;
  }
  return cursor;
}

function extractParentheticalText(
  payload: Uint8Array,
  start: number
): { text?: string; next: number } {
  const openIndex = payload.indexOf('('.charCodeAt(0), start);
  const closeIndex = payload.indexOf(')'.charCodeAt(0), openIndex + 1);
  if (openIndex >= 0 && closeIndex > openIndex) {
    return {
      text: bytesToLatin1(payload.slice(openIndex + 1, closeIndex)).trim(),
      next: closeIndex + 1,
    };
  }
  return { next: start };
}

function sanitizeNuVoiceLabel(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  let text = value
    .split('\u0000')
    .join('')
    .replace(/«[^»]+»/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/[#$%_/<>+]+$/g, '').trim();
  return text || undefined;
}

function sanitizeNuVoiceSpeech(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  let text = value.split('\u0000').join(' ');
  text = text.split('«WAIT-ANY-KEY»').join('[PAUSE]');
  text = text.split('«PROMPT-MARKER»').join('');
  text = text.split('\x1c').join('[PAUSE]');
  text = text.replace(/«[^»]+»/g, '');
  text = text
    .split('')
    .filter((ch) => ch >= ' ')
    .join('');
  text = text.replace(/\s+/g, ' ').trim();
  return text || undefined;
}

function parsePageMetrics(bytes: Uint8Array): number[] {
  const values: number[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset + 1 < bytes.length; offset += 2) {
    values.push(view.getInt16(offset, false));
  }
  return values;
}

function parsePageTLVEntries(bytes: Uint8Array): NuVoicePageTLVEntry[] {
  const entries: NuVoicePageTLVEntry[] = [];
  let offset = 0;
  while (offset + 1 < bytes.length) {
    const controlId = bytes[offset];
    const length = bytes[offset + 1];
    offset += 2;
    if (length <= 0 || offset + length > bytes.length) {
      break;
    }
    const payload = bytes.slice(offset, offset + length);
    entries.push({
      controlId,
      payload,
      text: isPrintableAscii(payload) ? bytesToLatin1(payload) : undefined,
    });
    offset += length;
  }
  return entries;
}

function parsePageCommands(bytes: Uint8Array): NuVoicePageCommand[] {
  const commands: NuVoicePageCommand[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (bytes[offset] === 0xff && offset + 2 < bytes.length) {
      const opcode = bytes[offset + 1];
      const length = bytes[offset + 2];
      const start = offset + 3;
      const end = Math.min(start + length, bytes.length);
      const payload = bytes.slice(start, end);
      const asciiPayload: number[] = [];
      for (const value of payload) {
        if (value === 0xfe || value === 0x00) break;
        if (value >= 0x20 && value <= 0x7e) {
          asciiPayload.push(value);
        } else {
          asciiPayload.length = 0;
          break;
        }
      }
      commands.push({
        opcode,
        payload,
        text: asciiPayload.length > 0 ? bytesToLatin1(new Uint8Array(asciiPayload)) : undefined,
      });
      offset = end;
    } else {
      offset += 1;
    }
  }
  return commands;
}

function parsePageRecord(line: string): NuVoicePageRecord {
  let base: NuVoiceBinaryRecordBase | null = null;
  try {
    base = parseBinaryRecord(line);
  } catch {
    // Ignore parse errors for short ASCII-style records
  }

  const record: NuVoicePageRecord =
    base !== null
      ? { ...base, type: 'P' }
      : {
          type: 'P',
          rawLine: line,
          bodyBytes: new Uint8Array(),
          checksum: 0,
          checksumValid: false,
        };

  if (!base) {
    const asciiPayload = line.slice(1);
    if (asciiPayload.length > 0) {
      record.asciiText = `P${asciiPayload}`;
      const equalsIndex = asciiPayload.indexOf('=');
      if (equalsIndex >= 0) {
        record.key = asciiPayload.slice(0, equalsIndex);
        record.value = asciiPayload.slice(equalsIndex + 1);
      }
    }
    return record;
  }

  const asciiText = textFromRecordBody('P', base.bodyBytes);
  if (asciiText) {
    record.asciiText = asciiText;
    const equalsIndex = asciiText.indexOf('=');
    if (equalsIndex >= 0) {
      record.key = asciiText.slice(0, equalsIndex);
      record.value = asciiText.slice(equalsIndex + 1);
    }
    return record;
  }

  if (base.bodyBytes.length === 0) {
    return record;
  }

  const subtype = base.bodyBytes[0];
  record.binarySubtype = subtype;
  const payload = base.bodyBytes.slice(1);
  if (subtype === 0x00) {
    record.metrics = parsePageMetrics(payload);
  } else if (subtype === 0x01) {
    record.tlvEntries = parsePageTLVEntries(payload);
  } else if (subtype === 0x02) {
    record.commands = parsePageCommands(payload);
  }

  return record;
}

function parseCellRecord(line: string): NuVoiceCellRecord {
  let base: NuVoiceBinaryRecordBase | null = null;
  try {
    base = parseBinaryRecord(line);
  } catch {
    // Short ASCII-style record
  }

  const record: NuVoiceCellRecord =
    base !== null
      ? { ...base, type: 'C' }
      : {
          type: 'C',
          rawLine: line,
          bodyBytes: new Uint8Array(),
          checksum: 0,
          checksumValid: false,
        };

  if (!base) {
    const asciiPayload = line.slice(1);
    if (asciiPayload.length > 0) {
      record.asciiText = `C${asciiPayload}`;
      const equalsIndex = asciiPayload.indexOf('=');
      if (equalsIndex >= 0) {
        record.key = asciiPayload.slice(0, equalsIndex);
        record.value = asciiPayload.slice(equalsIndex + 1);
        if (record.key.toLowerCase().includes('color')) {
          const numeric = Number(record.value);
          if (!Number.isNaN(numeric)) {
            record.colorValue = numeric;
          }
        }
      }
    }
    return record;
  }

  const asciiText = textFromRecordBody('C', base.bodyBytes);
  if (asciiText) {
    record.asciiText = asciiText;
    const equalsIndex = asciiText.indexOf('=');
    if (equalsIndex >= 0) {
      record.key = asciiText.slice(0, equalsIndex);
      record.value = asciiText.slice(equalsIndex + 1);
      if (record.key.toLowerCase().includes('color')) {
        const numeric = Number(record.value);
        if (!Number.isNaN(numeric)) {
          record.colorValue = numeric;
        }
      }
    }
  }

  return record;
}

function parseLayoutRecord(line: string): NuVoiceLayoutRecord {
  const base = parseBinaryRecord(line);
  if (base.bodyBytes.length < 3) {
    throw new Error(`Invalid NuVoice layout record: ${line}`);
  }

  return {
    ...base,
    type: 'x',
    addressHex: bytesToHex(base.bodyBytes.slice(0, 3)),
    payloadBytes: base.bodyBytes.slice(3),
    textSegment: parseTextSegment(base.bodyBytes.slice(3)),
  };
}

function parsePointerRecord(line: string): NuVoicePointerRecord {
  const base = parseBinaryRecord(line);
  return {
    ...base,
    type: 'X',
  };
}

function parseGenericRecord(line: string, type: NuVoiceRecordType): NuVoiceBinaryRecordBase {
  try {
    return parseBinaryRecord(line);
  } catch (error) {
    // If parsing fails, create a minimal record
    return {
      type,
      rawLine: line,
      bodyBytes: new Uint8Array(),
      checksum: 0,
      checksumValid: false,
    };
  }
}

export function parseNuVoiceDocument(content: string): NuVoiceDocument {
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const trailingNewline = /\r?\n$/.test(content);
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);

  const records: NuVoiceRecord[] = [];
  for (const line of lines) {
    if (line.length === 0) continue;

    try {
      switch (line[0]) {
        case 'v':
          records.push(parseHeaderRecord(line));
          break;
        case 'd':
          records.push(parseDictionaryRecord(line));
          break;
        case 'm':
          records.push(parseMemoryRecord(line));
          break;
        case 'x':
          records.push(parseLayoutRecord(line));
          break;
        case 'X':
          records.push(parsePointerRecord(line));
          break;
        case 'P':
          records.push(parsePageRecord(line));
          break;
        case 'C':
          records.push(parseCellRecord(line));
          break;
        case 'H':
        case 'A':
        case 'n':
        case 'N':
        case 'S':
        case 'E':
        case 'G':
        case 'a':
        case 'D':
        case 'U':
        case 'V':
        case 'p':
        case 'k':
        case 'q':
          records.push(parseGenericRecord(line, line[0] as NuVoiceRecordType));
          break;
        default:
          // Skip completely unknown characters
          break;
      }
    } catch (error) {
      console.warn(
        `Error parsing NuVoice record: ${(error as Error).message}, line: ${line.slice(0, 50)}...`
      );
    }
  }

  return {
    lineEnding,
    trailingNewline,
    records,
  };
}

function serializeDictionaryRecord(record: NuVoiceDictionaryRecord): string {
  const wordBytes = latin1ToBytes(record.word);
  const pronunciationBytes = latin1ToBytes(record.pronunciation);
  if (wordBytes.length > 0xff || pronunciationBytes.length > 0xff) {
    throw new Error('NuVoice dictionary fields cannot exceed 255 bytes');
  }

  const bodyBytes = new Uint8Array(
    1 + wordBytes.length + 1 + pronunciationBytes.length + record.trailingBytes.length
  );
  bodyBytes[0] = wordBytes.length;
  bodyBytes.set(wordBytes, 1);
  bodyBytes[1 + wordBytes.length] = pronunciationBytes.length;
  bodyBytes.set(pronunciationBytes, 1 + wordBytes.length + 1);
  bodyBytes.set(record.trailingBytes, 1 + wordBytes.length + 1 + pronunciationBytes.length);

  const checksum = computeNuVoiceChecksum(bodyBytes);
  return `d${bytesToHex(bodyBytes)}${checksum.toString(16).padStart(2, '0').toUpperCase()}`;
}

function serializeMemoryRecord(record: NuVoiceMemoryRecord): string {
  if (record.payloadBytes.length > 0xff) {
    throw new Error('NuVoice memory record payload cannot exceed 255 bytes');
  }

  const addressBytes = hexToBytes(record.addressHex);
  if (addressBytes.length !== 5) {
    throw new Error(`Invalid NuVoice memory address: ${record.addressHex}`);
  }

  const bodyBytes = new Uint8Array(6 + record.payloadBytes.length);
  bodyBytes.set(addressBytes, 0);
  bodyBytes[5] = record.payloadBytes.length;
  bodyBytes.set(record.payloadBytes, 6);

  const checksum = computeNuVoiceChecksum(bodyBytes);
  return `m${bytesToHex(bodyBytes)}${checksum.toString(16).padStart(2, '0').toUpperCase()}`;
}

function serializeLayoutRecord(record: NuVoiceLayoutRecord): string {
  const addressBytes = hexToBytes(record.addressHex);
  if (addressBytes.length !== 3) {
    throw new Error(`Invalid NuVoice layout address: ${record.addressHex}`);
  }

  const bodyBytes = new Uint8Array(3 + record.payloadBytes.length);
  bodyBytes.set(addressBytes, 0);
  bodyBytes.set(record.payloadBytes, 3);

  const checksum = computeNuVoiceChecksum(bodyBytes);
  return `x${bytesToHex(bodyBytes)}${checksum.toString(16).padStart(2, '0').toUpperCase()}`;
}

function serializePointerRecord(record: NuVoicePointerRecord): string {
  const checksum = computeNuVoiceChecksum(record.bodyBytes);
  return `X${bytesToHex(record.bodyBytes)}${checksum.toString(16).padStart(2, '0').toUpperCase()}`;
}

export function serializeNuVoiceDocument(document: NuVoiceDocument): string {
  const lines = document.records.map((record) => {
    switch (record.type) {
      case 'v':
        return record.rawLine;
      case 'd':
        return serializeDictionaryRecord(record as NuVoiceDictionaryRecord);
      case 'm':
        return serializeMemoryRecord(record as NuVoiceMemoryRecord);
      case 'x':
        return serializeLayoutRecord(record as NuVoiceLayoutRecord);
      case 'X':
        return serializePointerRecord(record as NuVoicePointerRecord);
      default:
        // For unknown record types, return the raw line as-is
        return record.rawLine;
    }
  });

  const serialized = lines.join(document.lineEnding);
  return document.trailingNewline ? `${serialized}${document.lineEnding}` : serialized;
}

export function setNuVoiceMemoryText(record: NuVoiceMemoryRecord, nextText: string): void {
  const segment = record.textSegment;
  if (!segment) {
    return;
  }

  const encoding = segment.encoding ?? 'latin1';
  const prefixBytes = segment.prefixBytes ?? new Uint8Array();
  const textBytes =
    encoding === 'latin1' ? latin1ToBytes(nextText) : encodeUtf16Bytes(nextText, encoding);
  const payloadParts: Uint8Array[] = [];
  let updatedPrefix = prefixBytes;
  if (prefixBytes.length > 0) {
    const prefixCopy = prefixBytes.slice();
    if (segment.lengthPrefixed && prefixCopy.length >= 1) {
      prefixCopy[prefixCopy.length - 1] = textBytes.length;
    }
    payloadParts.push(prefixCopy);
    updatedPrefix = prefixCopy;
  }
  payloadParts.push(textBytes);
  if (segment.hasNullTerminator) {
    payloadParts.push(encoding === 'latin1' ? Uint8Array.from([0]) : Uint8Array.from([0, 0]));
  }
  if (segment.suffixBytes.length > 0) {
    payloadParts.push(segment.suffixBytes);
  }

  const payloadLength = payloadParts.reduce((total, bytes) => total + bytes.length, 0);
  const payloadBytes = new Uint8Array(payloadLength);
  let offset = 0;
  for (const part of payloadParts) {
    payloadBytes.set(part, offset);
    offset += part.length;
  }

  record.payloadBytes = payloadBytes;
  payloadBytes.length;
  record.textSegment = {
    text: nextText,
    hasNullTerminator: segment.hasNullTerminator,
    suffixBytes: segment.suffixBytes,
    prefixBytes: updatedPrefix,
    encoding,
    lengthPrefixed: segment.lengthPrefixed,
  };
}

export function setNuVoiceLayoutText(record: NuVoiceLayoutRecord, nextText: string): void {
  const segment = record.textSegment;
  if (!segment) {
    return;
  }

  const encoding = segment.encoding ?? 'latin1';
  const prefixBytes = segment.prefixBytes ?? new Uint8Array();
  const textBytes =
    encoding === 'latin1' ? latin1ToBytes(nextText) : encodeUtf16Bytes(nextText, encoding);
  const payloadParts: Uint8Array[] = [];
  if (prefixBytes.length > 0) {
    payloadParts.push(prefixBytes);
  }
  payloadParts.push(textBytes);
  if (segment.hasNullTerminator) {
    payloadParts.push(encoding === 'latin1' ? Uint8Array.from([0]) : Uint8Array.from([0, 0]));
  }
  if (segment.suffixBytes.length > 0) {
    payloadParts.push(segment.suffixBytes);
  }

  const payloadLength = payloadParts.reduce((total, bytes) => total + bytes.length, 0);
  const payloadBytes = new Uint8Array(payloadLength);
  let offset = 0;
  for (const part of payloadParts) {
    payloadBytes.set(part, offset);
    offset += part.length;
  }

  record.payloadBytes = payloadBytes;
  record.textSegment = {
    text: nextText,
    hasNullTerminator: segment.hasNullTerminator,
    suffixBytes: segment.suffixBytes,
    prefixBytes,
    encoding,
  };
}

export function listNuVoiceTextEntries(document: NuVoiceDocument): NuVoiceTextEntry[] {
  const entries: NuVoiceTextEntry[] = [];
  let dictionaryIndex = 0;

  for (const record of document.records) {
    if (record.type === 'd') {
      const dictRecord = record as NuVoiceDictionaryRecord;
      entries.push({
        source: dictRecord.word,
        table: 'dictionary',
        column: 'WORD',
        id: `dictionary:${dictionaryIndex}:word`,
      });
      if (dictRecord.pronunciation.length > 0) {
        entries.push({
          source: dictRecord.pronunciation,
          table: 'dictionary',
          column: 'PRONUNCIATION',
          id: `dictionary:${dictionaryIndex}:pronunciation`,
        });
      }
      dictionaryIndex += 1;
    } else if (record.type === 'm') {
      const memRecord = record as NuVoiceMemoryRecord;
      if (memRecord.textSegment) {
        entries.push({
          source: memRecord.textSegment.text,
          table: 'memory',
          column: 'TEXT',
          id: `memory:${memRecord.addressHex}`,
        });
      }
    } else if (record.type === 'x') {
      const layoutRecord = record as NuVoiceLayoutRecord;
      if (layoutRecord.textSegment) {
        entries.push({
          source: layoutRecord.textSegment.text,
          table: 'layout',
          column: 'TEXT',
          id: `layout:${layoutRecord.addressHex}`,
        });
      }
    } else if ('bodyBytes' in record) {
      // Try to extract text from other binary records
      const textSegment = parseTextSegment(record.bodyBytes);
      if (textSegment) {
        entries.push({
          source: textSegment.text,
          table: 'other',
          column: 'TEXT',
          id: `${record.type}:${record.rawLine.slice(1, 9)}`, // Use first 8 chars of body as ID
        });
      }
    }
  }

  return entries;
}

function bytesToLatin1String(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('latin1').decode(bytes);
  }
  let result = '';
  for (const value of bytes) {
    result += String.fromCharCode(value);
  }
  return result;
}

function looksLikeTextualRecords(payload: Uint8Array): boolean {
  const sampleLength = Math.min(payload.length, 64);
  for (let i = 0; i < sampleLength; i += 1) {
    const value = payload[i];
    if (value === 0x0d || value === 0x0a) {
      continue;
    }
    if (value < 0x20 || value > 0x7e) {
      return false;
    }
  }
  return sampleLength > 0;
}

function looksCompressedBinary(payload: Uint8Array): boolean {
  if (payload.length < 6) {
    return false;
  }
  const zlibIndex = payload[4] === 0x0d && payload[5] === 0x0a ? 6 : 4;
  return payload[zlibIndex] === 0x78;
}

function splitBinaryLines(data: Uint8Array): Uint8Array[] {
  const lines: Uint8Array[] = [];
  let lineStart = 0;
  for (let i = 0; i < data.length - 1; i += 1) {
    if (data[i] === 0x0d && data[i + 1] === 0x0a) {
      lines.push(data.slice(lineStart, i));
      lineStart = i + 2;
      i += 1;
    }
  }
  if (lineStart < data.length) {
    lines.push(data.slice(lineStart));
  }
  return lines;
}

function convertBinaryLineToHexString(line: Uint8Array): string {
  if (line.length === 0) {
    return '';
  }
  const typeChar = String.fromCharCode(line[0]);
  if (line.length === 1) {
    return typeChar;
  }
  const checksum = line[line.length - 1];
  const bodyBytes = line.slice(1, -1);
  return `${typeChar}${bytesToHex(bodyBytes)}${checksum.toString(16).padStart(2, '0').toUpperCase()}`;
}

function convertBinaryPayloadToText(payload: Uint8Array): string {
  return splitBinaryLines(payload)
    .map((line) => convertBinaryLineToHexString(line))
    .filter((line) => line.length > 0)
    .join('\n');
}

function convertCompressedPayloadToText(payload: Uint8Array): string {
  if (payload.length < 4) {
    throw new Error('Invalid compressed NuVoice payload');
  }
  let offset = 0;
  const dataView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const declaredLength = dataView.getUint32(0, true);
  offset += 4;
  if (payload[offset] === 0x0d && payload[offset + 1] === 0x0a) {
    offset += 2;
  }
  const compressed = payload.slice(offset);
  const inflated = inflate(compressed);
  if (declaredLength && inflated.length !== declaredLength) {
    // Non-fatal mismatch, but keep the inflated data for parsing.
  }
  return convertBinaryPayloadToText(inflated);
}

function stripAsciiHeader(data: Uint8Array): Uint8Array {
  if (data.length === 0) {
    return data;
  }
  const newlineIndex = data.indexOf(0x0a);
  if (newlineIndex === -1) {
    return data;
  }
  const header = bytesToLatin1String(data.slice(0, newlineIndex)).trim();
  if (/^v\d+/i.test(header) || header.startsWith('unity')) {
    let payloadStart = newlineIndex + 1;
    if (payloadStart < data.length && data[payloadStart] === 0x0d) {
      payloadStart += 1;
    }
    return data.slice(payloadStart);
  }
  return data;
}

function tryInflatePayload(payload: Uint8Array): Uint8Array | null {
  let index = payload.indexOf(0x78); // zlib header
  while (index >= 0) {
    try {
      return inflate(payload.slice(index));
    } catch (error) {
      index = payload.indexOf(0x78, index + 1);
    }
  }
  return null;
}

export function normalizeNuVoiceContent(data: Uint8Array): string {
  if (data.length === 0) {
    return '';
  }

  const payload = stripAsciiHeader(data);
  if (payload.length === 0) {
    return '';
  }

  if (looksLikeTextualRecords(payload)) {
    return bytesToLatin1String(payload);
  }

  if (looksCompressedBinary(payload)) {
    return convertCompressedPayloadToText(payload);
  }

  const inflated = tryInflatePayload(payload);
  if (inflated) {
    return convertBinaryPayloadToText(inflated);
  }

  return convertBinaryPayloadToText(payload);
}
export interface NuVoiceButtonFunction {
  type: string;
  payload?: string;
}

export interface NuVoiceButtonData {
  name?: string;
  speech?: string;
  icon?: string;
  navigationType?: 'PERMANENT' | 'TEMPORARY' | 'HOME' | 'BACK' | null;
  navigationTarget?: string | null;
  randomChoiceTarget?: string | null;
  functions: NuVoiceButtonFunction[];
}

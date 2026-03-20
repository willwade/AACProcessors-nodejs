export type NuVoiceRecordType = 'v' | 'd' | 'm' | 'x' | 'X';

export interface NuVoiceHeaderRecord {
  type: 'v';
  rawLine: string;
  version?: string;
  variant?: string;
  product?: string;
}

interface NuVoiceBinaryRecordBase {
  type: 'd' | 'm' | 'x' | 'X';
  rawLine: string;
  bodyBytes: Uint8Array;
  checksum: number;
  checksumValid: boolean;
}

export interface NuVoiceDictionaryRecord extends NuVoiceBinaryRecordBase {
  type: 'd';
  word: string;
  pronunciation: string;
  trailingBytes: Uint8Array;
}

export interface NuVoiceTextSegment {
  text: string;
  hasNullTerminator: boolean;
  suffixBytes: Uint8Array;
}

export interface NuVoiceMemoryRecord extends NuVoiceBinaryRecordBase {
  type: 'm';
  addressHex: string;
  declaredLength: number;
  payloadBytes: Uint8Array;
  textSegment: NuVoiceTextSegment | null;
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

export type NuVoiceRecord =
  | NuVoiceHeaderRecord
  | NuVoiceDictionaryRecord
  | NuVoiceMemoryRecord
  | NuVoiceLayoutRecord
  | NuVoicePointerRecord;

export interface NuVoiceDocument {
  lineEnding: '\n' | '\r\n';
  trailingNewline: boolean;
  records: NuVoiceRecord[];
}

export interface NuVoiceTextEntry {
  source: string;
  table: 'dictionary' | 'memory' | 'layout';
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
  return (~sum) & 0xff;
}

function isPrintableAscii(bytes: Uint8Array): boolean {
  return bytes.every((value) => value >= 0x20 && value <= 0x7e);
}

function parseTextSegment(payloadBytes: Uint8Array): NuVoiceTextSegment | null {
  if (payloadBytes.length === 0) {
    return null;
  }

  const nullIndex = payloadBytes.indexOf(0);
  const textBytes = nullIndex >= 0 ? payloadBytes.slice(0, nullIndex) : payloadBytes;
  if (textBytes.length === 0 || !isPrintableAscii(textBytes)) {
    return null;
  }

  const text = bytesToLatin1(textBytes);
  if (text.trim().length === 0) {
    return null;
  }

  return {
    text,
    hasNullTerminator: nullIndex >= 0,
    suffixBytes: nullIndex >= 0 ? payloadBytes.slice(nullIndex + 1) : new Uint8Array(),
  };
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
    type: line[0] as 'd' | 'm' | 'x' | 'X',
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
  if (base.bodyBytes.length < 6) {
    throw new Error(`Invalid NuVoice memory record: ${line}`);
  }

  return {
    ...base,
    type: 'm',
    addressHex: bytesToHex(base.bodyBytes.slice(0, 5)),
    declaredLength: base.bodyBytes[5],
    payloadBytes: base.bodyBytes.slice(6),
    textSegment: parseTextSegment(base.bodyBytes.slice(6)),
  };
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

export function parseNuVoiceDocument(content: string): NuVoiceDocument {
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const trailingNewline = /\r?\n$/.test(content);
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);

  const records = lines.map((line) => {
    switch (line[0]) {
      case 'v':
        return parseHeaderRecord(line);
      case 'd':
        return parseDictionaryRecord(line);
      case 'm':
        return parseMemoryRecord(line);
      case 'x':
        return parseLayoutRecord(line);
      case 'X':
        return parsePointerRecord(line);
      default:
        throw new Error(`Unsupported NuVoice record type: ${line[0]}`);
    }
  });

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
        return serializeDictionaryRecord(record);
      case 'm':
        return serializeMemoryRecord(record);
      case 'x':
        return serializeLayoutRecord(record);
      case 'X':
        return serializePointerRecord(record);
      default:
        throw new Error('Unsupported NuVoice record during serialization');
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

  const textBytes = latin1ToBytes(nextText);
  const payloadParts = [textBytes];
  if (segment.hasNullTerminator) {
    payloadParts.push(Uint8Array.from([0]));
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
  record.declaredLength = payloadBytes.length;
  record.textSegment = {
    text: nextText,
    hasNullTerminator: segment.hasNullTerminator,
    suffixBytes: segment.suffixBytes,
  };
}

export function setNuVoiceLayoutText(record: NuVoiceLayoutRecord, nextText: string): void {
  const segment = record.textSegment;
  if (!segment) {
    return;
  }

  const textBytes = latin1ToBytes(nextText);
  const payloadParts = [textBytes];
  if (segment.hasNullTerminator) {
    payloadParts.push(Uint8Array.from([0]));
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
  };
}

export function listNuVoiceTextEntries(document: NuVoiceDocument): NuVoiceTextEntry[] {
  const entries: NuVoiceTextEntry[] = [];
  let dictionaryIndex = 0;

  for (const record of document.records) {
    if (record.type === 'd') {
      entries.push({
        source: record.word,
        table: 'dictionary',
        column: 'WORD',
        id: `dictionary:${dictionaryIndex}:word`,
      });
      if (record.pronunciation.length > 0) {
        entries.push({
          source: record.pronunciation,
          table: 'dictionary',
          column: 'PRONUNCIATION',
          id: `dictionary:${dictionaryIndex}:pronunciation`,
        });
      }
      dictionaryIndex += 1;
    } else if (record.type === 'm' && record.textSegment) {
      entries.push({
        source: record.textSegment.text,
        table: 'memory',
        column: 'TEXT',
        id: `memory:${record.addressHex}`,
      });
    } else if (record.type === 'x' && record.textSegment) {
      entries.push({
        source: record.textSegment.text,
        table: 'layout',
        column: 'TEXT',
        id: `layout:${record.addressHex}`,
      });
    }
  }

  return entries;
}

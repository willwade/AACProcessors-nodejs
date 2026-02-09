export type ProcessorInput = string | Buffer | ArrayBuffer | Uint8Array;

export type BinaryOutput = Buffer | Uint8Array;

export interface FileAdapter {
  readBinaryFromInput: (input: ProcessorInput) => Uint8Array;
  readTextFromInput: (input: ProcessorInput, encoding?: BufferEncoding) => string;
  writeBinaryToPath: (outputPath: string, data: BinaryOutput) => void;
  writeTextToPath: (outputPath: string, text: string) => void;
  pathExists: (path: string) => boolean;
  isDirectory: (path: string) => boolean;
  getFileSize: (path: string) => number;
  mkDir: (path: string, options?: { recursive?: boolean }) => void;
  listDir: (path: string) => string[];
  removePath: (path: string, options?: { recursive?: boolean; force?: boolean }) => void;
  mkTempDir: (prefix: string) => string;
}

let cachedFs: typeof import('fs') | null = null;
let cachedPath: typeof import('path') | null = null;
let cachedOs: typeof import('os') | null = null;
let cachedRequire: NodeRequire | null | undefined = undefined;

type NodeRequire = (id: string) => any;

export function getNodeRequire(): NodeRequire {
  if (cachedRequire === undefined) {
    if (typeof require === 'function') {
      cachedRequire = require;
    } else if (typeof globalThis !== 'undefined') {
      const maybeRequire = (globalThis as { require?: unknown }).require;
      cachedRequire = typeof maybeRequire === 'function' ? (maybeRequire as NodeRequire) : null;
    } else {
      cachedRequire = null;
    }
  }
  if (!cachedRequire) {
    throw new Error('File system access is not available in this environment.');
  }
  return cachedRequire;
}

function getFs(): typeof import('fs') {
  if (!cachedFs) {
    try {
      const nodeRequire = getNodeRequire();
      const fsModule = 'fs';
      cachedFs = nodeRequire(fsModule);
    } catch {
      throw new Error('File system access is not available in this environment.');
    }
  }
  if (!cachedFs) {
    throw new Error('File system access is not available in this environment.');
  }
  return cachedFs;
}

export function getPath(): typeof import('path') {
  if (!cachedPath) {
    try {
      const nodeRequire = getNodeRequire();
      const pathModule = 'path';
      cachedPath = nodeRequire(pathModule);
    } catch {
      throw new Error('Path utilities are not available in this environment.');
    }
  }
  if (!cachedPath) {
    throw new Error('Path utilities are not available in this environment.');
  }
  return cachedPath;
}

export function getOs(): typeof import('os') {
  if (!cachedOs) {
    try {
      const nodeRequire = getNodeRequire();
      const osModule = 'os';
      cachedOs = nodeRequire(osModule);
    } catch {
      throw new Error('OS utilities are not available in this environment.');
    }
  }
  if (!cachedOs) {
    throw new Error('OS utilities are not available in this environment.');
  }
  return cachedOs;
}

export function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.node;
}

export function getBasename(filePath: string): string {
  const trimmed = filePath.replace(/[/\\]+$/, '') || filePath;
  const parts = trimmed.split(/[/\\]/);
  return parts[parts.length - 1] || trimmed;
}

export function toUint8Array(input: Uint8Array | ArrayBuffer | Buffer): Uint8Array {
  if (input instanceof Uint8Array) {
    return input;
  }
  return new Uint8Array(input);
}

export function toArrayBuffer(input: Uint8Array | ArrayBuffer | Buffer): ArrayBuffer {
  if (input instanceof ArrayBuffer) {
    return input;
  }
  const view = input instanceof Uint8Array ? input : new Uint8Array(input);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

export function decodeText(input: Uint8Array): string {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
    return input.toString('utf8');
  }
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(input);
}

export function encodeBase64(input: Uint8Array): string {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
    return input.toString('base64');
  }
  // Browser fallback using btoa
  let binary = '';
  const len = input.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(input[i]);
  }
  return btoa(binary);
}

export function encodeText(text: string): BinaryOutput {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(text, 'utf8');
  }
  return new TextEncoder().encode(text);
}

function readBinaryFromInput(input: ProcessorInput): Uint8Array {
  if (typeof input === 'string') {
    const fs = getFs();
    return fs.readFileSync(input);
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  return input;
}

function readTextFromInput(input: ProcessorInput, encoding: BufferEncoding = 'utf8'): string {
  if (typeof input === 'string') {
    const fs = getFs();
    return fs.readFileSync(input, encoding);
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
    return input.toString(encoding);
  }
  if (input instanceof ArrayBuffer) {
    return decodeText(new Uint8Array(input));
  }
  return decodeText(input);
}

function writeBinaryToPath(outputPath: string, data: BinaryOutput): void {
  const fs = getFs();
  fs.writeFileSync(outputPath, data);
}

function writeTextToPath(outputPath: string, text: string): void {
  const fs = getFs();
  fs.writeFileSync(outputPath, text, 'utf8');
}

function pathExists(path: string): boolean {
  const fs = getFs();
  return fs.existsSync(path);
}

function isDirectory(path: string): boolean {
  const fs = getFs();
  return fs.statSync(path).isDirectory();
}

function getFileSize(path: string): number {
  const fs = getFs();
  return fs.statSync(path).size;
}

function mkDir(path: string, options?: { recursive?: boolean }): void {
  const fs = getFs();
  fs.mkdirSync(path, options);
}

function listDir(path: string): string[] {
  const fs = getFs();
  return fs.readdirSync(path);
}

function removePath(path: string, options?: { recursive?: boolean; force?: boolean }): void {
  const fs = getFs();
  fs.rmSync(path, options);
}

function mkTempDir(prefix: string): string {
  const fs = getFs();
  return fs.mkdtempSync(prefix);
}

export const defaultFileAdapter: FileAdapter = {
  readBinaryFromInput,
  readTextFromInput,
  writeBinaryToPath,
  writeTextToPath,
  pathExists,
  isDirectory,
  getFileSize,
  mkDir,
  listDir,
  removePath,
  mkTempDir,
};

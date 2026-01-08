export type ProcessorInput = string | Buffer | ArrayBuffer | Uint8Array;

export type BinaryOutput = Buffer | Uint8Array;

let cachedFs: typeof import('fs') | null = null;
let cachedPath: typeof import('path') | null = null;

export function getFs(): typeof import('fs') {
  if (!cachedFs) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      cachedFs = require('fs');
    } catch {
      throw new Error('File system access is not available in this environment.');
    }
  }
  return cachedFs!;
}

export function getPath(): typeof import('path') {
  if (!cachedPath) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      cachedPath = require('path');
    } catch {
      throw new Error('Path utilities are not available in this environment.');
    }
  }
  return cachedPath!;
}

export function getBasename(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
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

export function readBinaryFromInput(input: ProcessorInput): Uint8Array {
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

export function readTextFromInput(
  input: ProcessorInput,
  encoding: BufferEncoding = 'utf8'
): string {
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

export function writeBinaryToPath(outputPath: string, data: BinaryOutput): void {
  const fs = getFs();
  fs.writeFileSync(outputPath, data);
}

export function writeTextToPath(outputPath: string, text: string): void {
  const fs = getFs();
  fs.writeFileSync(outputPath, text, 'utf8');
}

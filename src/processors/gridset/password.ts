import path from 'path';
import { ProcessorOptions } from '../../core/baseProcessor';
import { ProcessorInput } from '../../utils/io';

/**
 * Resolve the password to use for Grid3 archives.
 * Preference order:
 * 1. Explicit processor option
 * 2. GRIDSET_PASSWORD env var
 */
export function resolveGridsetPassword(
  options?: ProcessorOptions,
  source?: ProcessorInput
): string | undefined {
  if (options?.gridsetPassword) return options.gridsetPassword;
  if (process.env.GRIDSET_PASSWORD) return process.env.GRIDSET_PASSWORD;

  if (typeof source === 'string') {
    const ext = path.extname(source).toLowerCase();
    if (ext === '.gridsetx') return process.env.GRIDSET_PASSWORD;
  }

  return undefined;
}

export function resolveGridsetPasswordFromEnv(): string | undefined {
  return process.env.GRIDSET_PASSWORD;
}

/**
 * Get zip entries as an array from JSZip instance.
 * JSZip doesn't have password protection at the entry level like AdmZip.
 * Password protection for .gridsetx is handled at the archive level in crypto.ts.
 *
 * @param zip - JSZip instance
 * @param password - Optional password (kept for API compatibility, not used with JSZip)
 * @returns Array of entry objects with name and data
 */
export async function getZipEntriesWithPassword(
  zip: any,
  password?: string
): Promise<Array<{ name: string; entryName: string; dir: boolean; getData: () => Promise<Buffer> }>> {
  const entries: Array<{
    name: string;
    entryName: string;
    dir: boolean;
    getData: () => Promise<Buffer>;
  }> = [];

  // Note: JSZip doesn't support zip-level password protection like AdmZip
  // Password protection for .gridsetx files is handled at the encrypted archive level
  // in crypto.ts before the zip is loaded
  if (password) {
    console.warn('JSZip does not support zip-level password protection. For .gridsetx encrypted files, password is handled at the archive level.');
  }

  zip.forEach((relativePath: string, file: any) => {
    entries.push({
      name: relativePath,
      entryName: relativePath,
      dir: file.dir || false,
      getData: async () => {
        // Use 'arraybuffer' in browser, 'nodebuffer' in Node.js
        const isBrowser = typeof (globalThis as any).window !== 'undefined';
        const type = isBrowser ? 'arraybuffer' : 'nodebuffer';
        const data = await file.async(type);
        // Convert ArrayBuffer to Buffer-like object in browser
        if (isBrowser && data instanceof ArrayBuffer) {
          // Create Uint8Array from ArrayBuffer, which is compatible with our Buffer polyfill
          const uint8Array = new Uint8Array(data);
          return uint8Array as any;
        }
        return data;
      },
    });
  });

  return entries;
}

/**
 * Crypto utilities for Gridsetx (encrypted Grid3 files)
 * This module is only needed for .gridsetx files and uses Node-only crypto/zlib
 */

/**
 * Decrypt and inflate a Grid3 encrypted payload (DesktopContentEncrypter).
 * Uses AES-256-CBC with key/IV derived from the password padded with spaces
 * and then Deflate decompression.
 *
 * @param buffer - Encrypted buffer
 * @param password - Password (defaults to 'Chocolate')
 * @returns Decrypted and inflated buffer
 */
export function decryptGridsetEntry(buffer: Buffer, password?: string): Buffer {
  // Dynamic require to avoid breaking in browser environments
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-return
  const crypto = require('crypto');
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-return
  const zlib = require('zlib');

  const pwd = (password || 'Chocolate').padEnd(32, ' ');
  const key = Buffer.from(pwd.slice(0, 32), 'utf8');
  const iv = Buffer.from(pwd.slice(0, 16), 'utf8');

  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(buffer), decipher.final()]);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return zlib.inflateSync(decrypted);
    } catch {
      // If data isn't deflated, return raw decrypted bytes
      return decrypted;
    }
  } catch {
    return buffer;
  }
}

/**
 * Check if crypto operations are available in the current environment
 */
export function isCryptoAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('crypto');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('zlib');
    return true;
  } catch {
    return false;
  }
}

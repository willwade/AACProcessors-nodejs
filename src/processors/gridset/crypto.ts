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
  const nodeRequire =
    typeof require === "function"
      ? require
      : (undefined as undefined | ((id: string) => any));
  if (!nodeRequire) {
    throw new Error("Crypto utilities are not available in this environment.");
  }
  // Dynamic require to avoid breaking in browser environments
  const cryptoModule = "crypto";
  const zlibModule = "zlib";
  const crypto = nodeRequire(cryptoModule);
  const zlib = nodeRequire(zlibModule);

  const pwd = (password || "Chocolate").padEnd(32, " ");
  const key = Buffer.from(pwd.slice(0, 32), "utf8");
  const iv = Buffer.from(pwd.slice(0, 16), "utf8");

  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([
      decipher.update(buffer),
      decipher.final(),
    ]);
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
    const nodeRequire =
      typeof require === "function"
        ? require
        : (undefined as undefined | ((id: string) => any));
    if (!nodeRequire) return false;
    const cryptoModule = "crypto";
    const zlibModule = "zlib";
    nodeRequire(cryptoModule);
    nodeRequire(zlibModule);
    return true;
  } catch {
    return false;
  }
}

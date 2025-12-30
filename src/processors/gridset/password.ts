import path from "path";
import { ProcessorOptions } from "../../core/baseProcessor";
import AdmZip from "adm-zip";

/**
 * Resolve the password to use for Grid3 archives.
 * Preference order:
 * 1. Explicit processor option
 * 2. GRIDSET_PASSWORD env var
 */
export function resolveGridsetPassword(
  options?: ProcessorOptions,
  source?: string | Buffer,
): string | undefined {
  if (options?.gridsetPassword) return options.gridsetPassword;
  if (process.env.GRIDSET_PASSWORD) return process.env.GRIDSET_PASSWORD;

  if (typeof source === "string") {
    const ext = path.extname(source).toLowerCase();
    if (ext === ".gridsetx") return process.env.GRIDSET_PASSWORD;
  }

  return undefined;
}

export function resolveGridsetPasswordFromEnv(): string | undefined {
  return process.env.GRIDSET_PASSWORD;
}

// Wrapper to set the password before reading entries (typed getEntries lacks the optional arg)
export function getZipEntriesWithPassword(
  zip: AdmZip,
  password?: string,
): AdmZip.IZipEntry[] {
  if (password) {
    return (
      zip as unknown as { getEntries: (pw?: string) => AdmZip.IZipEntry[] }
    ).getEntries(password);
  }
  return zip.getEntries();
}

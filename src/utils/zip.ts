import { isNodeRuntime, readBinaryFromInput, getNodeRequire } from './io';

export interface ZipAdapter {
  listFiles(): string[];
  readFile(name: string): Promise<Uint8Array>;
}

export async function getZipAdapter(
  input: string | Uint8Array | ArrayBuffer | Buffer
): Promise<{ zip: ZipAdapter }> {
  if (typeof input === 'string') {
    if (!isNodeRuntime()) {
      throw new Error('Zip file paths are not supported in browser environments.');
    }
    const AdmZip = getNodeRequire()('adm-zip') as typeof import('adm-zip');
    const admZip = new AdmZip(input);
    return {
      zip: {
        listFiles: (): string[] => admZip.getEntries().map((entry) => entry.entryName),
        readFile: (name: string): Promise<Uint8Array> => {
          const entry = admZip.getEntry(name);
          if (!entry) {
            throw new Error(`Zip entry not found: ${name}`);
          }
          return Promise.resolve(entry.getData());
        },
      },
    };
  }

  const data = readBinaryFromInput(input);

  if (isNodeRuntime()) {
    const AdmZip = getNodeRequire()('adm-zip') as typeof import('adm-zip');
    const admZip = new AdmZip(Buffer.from(data));
    return {
      zip: {
        listFiles: (): string[] => admZip.getEntries().map((entry) => entry.entryName),
        readFile: (name: string): Promise<Uint8Array> => {
          const entry = admZip.getEntry(name);
          if (!entry) {
            throw new Error(`Zip entry not found: ${name}`);
          }
          return Promise.resolve(entry.getData());
        },
      },
    };
  }

  const module = await import('jszip');
  const init = module.default || module;
  const zip = await init.loadAsync(data);
  return {
    zip: {
      listFiles: (): string[] => Object.keys(zip.files),
      readFile: async (name: string): Promise<Uint8Array> => {
        const file = zip.file(name);
        if (!file) {
          throw new Error(`Zip entry not found: ${name}`);
        }
        return file.async('uint8array');
      },
    },
  };
}

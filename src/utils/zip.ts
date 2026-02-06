import { isNodeRuntime, readBinaryFromInput, getNodeRequire } from './io';

export interface ZipAdapter {
  listFiles(): string[];
  readFile(name: string): Promise<Uint8Array>;
  writeFiles(files: ZipFile[]): Promise<Uint8Array>;
}

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

export async function getZipAdapter(
  input: string | Uint8Array | ArrayBuffer | Buffer
): Promise<ZipAdapter> {
  if (isNodeRuntime()) {
    const AdmZip = getNodeRequire()('adm-zip') as typeof import('adm-zip');
    const adapter = {
      writeFiles: (files: ZipFile[]): Promise<Uint8Array> => {
        const zipWriter = new AdmZip();
        files.forEach((file) => {
          zipWriter.addFile(file.name, Buffer.from(file.data));
        });
        return Promise.resolve(zipWriter.toBuffer());
      },
    };

    if (typeof input === 'string') {
      const admZip = new AdmZip(input);
      return {
        ...adapter,
        listFiles: (): string[] => admZip.getEntries().map((entry) => entry.entryName),
        readFile: (name: string): Promise<Uint8Array> => {
          const entry = admZip.getEntry(name);
          if (!entry) {
            throw new Error(`Zip entry not found: ${name}`);
          }
          return Promise.resolve(entry.getData());
        },
      };
    }

    const data = readBinaryFromInput(input);
    const admZip = new AdmZip(Buffer.from(data));
    return {
      ...adapter,
      listFiles: (): string[] => admZip.getEntries().map((entry) => entry.entryName),
      readFile: (name: string): Promise<Uint8Array> => {
        const entry = admZip.getEntry(name);
        if (!entry) {
          throw new Error(`Zip entry not found: ${name}`);
        }
        return Promise.resolve(entry.getData());
      },
    };
  }

  if (typeof input === 'string') {
    throw new Error('Zip file paths are not supported in browser environments.');
  }
  const data = readBinaryFromInput(input);
  const module = await import('jszip');
  const JSZip = module.default || module;
  const zip = await JSZip.loadAsync(data);
  return {
    listFiles: (): string[] => Object.keys(zip.files),
    readFile: async (name: string): Promise<Uint8Array> => {
      const file = zip.file(name);
      if (!file) {
        throw new Error(`Zip entry not found: ${name}`);
      }
      return file.async('uint8array');
    },
    writeFiles: async (files: ZipFile[]): Promise<Uint8Array> => {
      const zipWriter = new JSZip();
      files.forEach((file) => {
        zipWriter.file(file.name, file.data);
      });
      return await zip.generateAsync({ type: 'uint8array' });
    },
  };
}

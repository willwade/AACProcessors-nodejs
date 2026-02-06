import { isNodeRuntime, readBinaryFromInput, getNodeRequire, ProcessorInput } from './io';

export interface ZipAdapter {
  listFiles(): string[];
  readFile(name: string): Promise<Uint8Array>;
  writeFiles(files: ZipFile[]): Promise<Uint8Array>;
}

export interface ZipFile {
  name: string;
  data: string | Uint8Array;
}

export async function getZipAdapter(input?: ProcessorInput): Promise<ZipAdapter> {
  if (isNodeRuntime()) {
    const AdmZip = getNodeRequire()('adm-zip') as typeof import('adm-zip');
    const zip =
      input === undefined ? new AdmZip(input) :
      typeof input === 'string' ? new AdmZip(input) :
      new AdmZip(Buffer.from(readBinaryFromInput(input)));
    return {
      listFiles: (): string[] => {
        return zip.getEntries()
          .filter((entry) => !entry.isDirectory)
          .map((entry) => entry.entryName)
      },
      readFile: (name: string): Promise<Uint8Array> => {
        const entry = zip.getEntry(name);
        if (!entry) throw new Error(`Zip entry not found: ${name}`);
        return Promise.resolve(entry.getData());
      },
      writeFiles: (files: ZipFile[]): Promise<Uint8Array> => {
        files.forEach((file) => {
          zip.addFile(file.name, Buffer.from(file.data));
        });
        return Promise.resolve(zip.toBuffer());
      },
    };
  }

  const module = await import('jszip');
  const JSZip = module.default || module;
  if (input !== undefined && typeof input === 'string')
    throw new Error('Zip file paths are not supported in browser environments.');

  const zip = input ? await JSZip.loadAsync(readBinaryFromInput(input)) : new JSZip();
  return {
    listFiles: (): string[] => {
      return Object.entries(zip.files)
        .filter(([name, entry]) => !entry.dir)
        .map(([name, entry]) => name)
    },
    readFile: async (name: string): Promise<Uint8Array> => {
      const file = zip.file(name);
      if (!file) throw new Error(`Zip entry not found: ${name}`);
      return file.async('uint8array');
    },
    writeFiles: async (files: ZipFile[]): Promise<Uint8Array> => {
      files.forEach((file) => {
        zip.file(file.name, file.data);
      });
      return await zip.generateAsync({ type: 'uint8array' });
    },
  };
}

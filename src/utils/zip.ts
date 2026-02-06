import { isNodeRuntime, readBinaryFromInput, getNodeRequire, ProcessorInput } from './io';

export interface ZipReader {
  listFiles(): string[];
  readFile(name: string): Promise<Uint8Array>;
}

export interface ZipWriter {
  writeFiles(files: ZipFile[]): Promise<Uint8Array>;
}

export interface ZipFile {
  name: string;
  data: string | Uint8Array;
}

export async function getZipReader(input: ProcessorInput): Promise<ZipReader> {
  if (isNodeRuntime()) {
    const AdmZip = getNodeRequire()('adm-zip') as typeof import('adm-zip');
    const admZip =
      typeof input === 'string'
        ? new AdmZip(input)
        : new AdmZip(Buffer.from(readBinaryFromInput(input)));
    return {
      listFiles: (): string[] => admZip.getEntries().map((entry) => entry.entryName),
      readFile: (name: string): Promise<Uint8Array> => {
        const entry = admZip.getEntry(name);
        if (!entry) throw new Error(`Zip entry not found: ${name}`);
        return Promise.resolve(entry.getData());
      },
    };
  }

  const module = await import('jszip');
  const JSZip = module.default || module;
  if (typeof input === 'string')
    throw new Error('Zip file paths are not supported in browser environments.');

  const data = readBinaryFromInput(input);
  const zip = await JSZip.loadAsync(data);
  return {
    listFiles: (): string[] => Object.keys(zip.files),
    readFile: async (name: string): Promise<Uint8Array> => {
      const file = zip.file(name);
      if (!file) throw new Error(`Zip entry not found: ${name}`);
      return file.async('uint8array');
    },
  };
}

export async function getZipWriter(): Promise<ZipWriter> {
  if (isNodeRuntime()) {
    const AdmZip = getNodeRequire()('adm-zip') as typeof import('adm-zip');
    return {
      writeFiles: (files: ZipFile[]): Promise<Uint8Array> => {
        const zipWriter = new AdmZip();
        files.forEach((file) => {
          zipWriter.addFile(file.name, Buffer.from(file.data));
        });
        return Promise.resolve(zipWriter.toBuffer());
      },
    };
  }

  const module = await import('jszip');
  const JSZip = module.default || module;
  return {
    writeFiles: async (files: ZipFile[]): Promise<Uint8Array> => {
      const zipWriter = new JSZip();
      files.forEach((file) => {
        zipWriter.file(file.name, file.data);
      });
      return await zipWriter.generateAsync({ type: 'uint8array' });
    },
  };
}

import { isNodeRuntime, readBinaryFromInput, getNodeRequire } from './io';

export interface ZipAdapter {
  listFiles(): string[];
  readFile(name: string): Promise<Uint8Array>;
}

export type ZipBackend = 'auto' | 'admzip' | 'jszip' | 'yauzl';

export interface OpenZipOptions {
  backend?: ZipBackend;
}

function resolveBackend(backend: ZipBackend | undefined): ZipBackend {
  if (backend && backend !== 'auto') return backend;
  return isNodeRuntime() ? 'admzip' : 'jszip';
}

function createAdmZipAdapter(admZip: import('adm-zip')): ZipAdapter {
  return {
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

async function createJsZipAdapter(data: Uint8Array): Promise<ZipAdapter> {
  const module = await import('jszip');
  const init = module.default || module;
  const zip = await init.loadAsync(data);
  return {
    listFiles: (): string[] => Object.keys(zip.files),
    readFile: async (name: string): Promise<Uint8Array> => {
      const file = zip.file(name);
      if (!file) {
        throw new Error(`Zip entry not found: ${name}`);
      }
      return file.async('uint8array');
    },
  };
}

function createYauzlAdapterFromBuffer(data: Uint8Array): Promise<ZipAdapter> {
  return new Promise((resolve, reject) => {
    const yauzl = getNodeRequire()('yauzl') as typeof import('yauzl');
    yauzl.fromBuffer(Buffer.from(data), { lazyEntries: true }, (error, zipfile) => {
      if (error || !zipfile) {
        reject(error || new Error('Failed to open zip buffer.'));
        return;
      }
      const entries = new Map<string, import('yauzl').Entry>();
      zipfile.on('entry', (entry) => {
        entries.set(String(entry.fileName), entry);
        zipfile.readEntry();
      });
      zipfile.once('end', () => {
        resolve({
          listFiles: (): string[] => Array.from(entries.keys()),
          readFile: (name: string): Promise<Uint8Array> =>
            new Promise((resolveRead, rejectRead) => {
              const entry = entries.get(name);
              if (!entry) {
                rejectRead(new Error(`Zip entry not found: ${name}`));
                return;
              }
              zipfile.openReadStream(entry, (streamError, stream) => {
                if (streamError || !stream) {
                  rejectRead(streamError || new Error('Failed to open zip stream.'));
                  return;
                }
                const chunks: Buffer[] = [];
                stream.on('data', (chunk) => chunks.push(Buffer.from(chunk as Uint8Array)));
                stream.on('end', () => resolveRead(Buffer.concat(chunks)));
                stream.on('error', rejectRead);
              });
            }),
        });
      });
      zipfile.readEntry();
    });
  });
}

function createYauzlAdapterFromPath(filePath: string): Promise<ZipAdapter> {
  return new Promise((resolve, reject) => {
    const yauzl = getNodeRequire()('yauzl') as typeof import('yauzl');
    yauzl.open(filePath, { lazyEntries: true }, (error, zipfile) => {
      if (error || !zipfile) {
        reject(error || new Error('Failed to open zip file.'));
        return;
      }
      const entries = new Map<string, import('yauzl').Entry>();
      zipfile.on('entry', (entry) => {
        entries.set(String(entry.fileName), entry);
        zipfile.readEntry();
      });
      zipfile.once('end', () => {
        resolve({
          listFiles: (): string[] => Array.from(entries.keys()),
          readFile: (name: string): Promise<Uint8Array> =>
            new Promise((resolveRead, rejectRead) => {
              const entry = entries.get(name);
              if (!entry) {
                rejectRead(new Error(`Zip entry not found: ${name}`));
                return;
              }
              zipfile.openReadStream(entry, (streamError, stream) => {
                if (streamError || !stream) {
                  rejectRead(streamError || new Error('Failed to open zip stream.'));
                  return;
                }
                const chunks: Buffer[] = [];
                stream.on('data', (chunk) => chunks.push(Buffer.from(chunk as Uint8Array)));
                stream.on('end', () => resolveRead(Buffer.concat(chunks)));
                stream.on('error', rejectRead);
              });
            }),
        });
      });
      zipfile.readEntry();
    });
  });
}

export async function openZipFromInput(
  input: string | Uint8Array | ArrayBuffer | Buffer,
  options: OpenZipOptions = {}
): Promise<{ zip: ZipAdapter }> {
  const backend = resolveBackend(options.backend);

  if (backend === 'admzip') {
    if (typeof input === 'string') {
      if (!isNodeRuntime()) {
        throw new Error('Zip file paths are not supported in browser environments.');
      }
      const AdmZip = getNodeRequire()('adm-zip') as typeof import('adm-zip');
      return { zip: createAdmZipAdapter(new AdmZip(input)) };
    }
    const data = readBinaryFromInput(input);
    const AdmZip = getNodeRequire()('adm-zip') as typeof import('adm-zip');
    return { zip: createAdmZipAdapter(new AdmZip(Buffer.from(data))) };
  }

  if (backend === 'yauzl') {
    if (!isNodeRuntime()) {
      throw new Error('Yauzl is only available in Node.js environments.');
    }
    if (typeof input === 'string') {
      return { zip: await createYauzlAdapterFromPath(input) };
    }
    const data = readBinaryFromInput(input);
    return { zip: await createYauzlAdapterFromBuffer(data) };
  }

  const data = readBinaryFromInput(input);
  return { zip: await createJsZipAdapter(data) };
}

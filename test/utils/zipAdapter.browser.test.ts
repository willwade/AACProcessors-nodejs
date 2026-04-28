import JSZip from 'jszip';

async function getBrowserZipAdapter() {
  jest.resetModules();
  jest.doMock('../../src/utils/io', () => {
    const actual = jest.requireActual('../../src/utils/io');
    return {
      ...actual,
      isNodeRuntime: () => false,
    };
  });

  const module = await import('../../src/utils/zip');
  return module.getZipAdapter;
}

describe('zip adapter (browser)', () => {
  it('does not include directories in listFiles', async () => {
    const zip = new JSZip();
    zip.folder('dir');
    zip.file('dir/nested.txt', 'nested');
    const buffer = await zip.generateAsync({ type: 'uint8array' });

    const getZipAdapter = await getBrowserZipAdapter();
    const adapter = await getZipAdapter(buffer);
    const entries = adapter.listFiles();

    expect(entries).toContain('dir/nested.txt');
    expect(entries).not.toContain('dir/');
  });
});

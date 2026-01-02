import { describe, expect, it, jest } from '@jest/globals';

describe('History analytics wrappers (mocked)', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('wraps platform helpers and unifies histories', () => {
    jest.isolateModules(() => {
      jest.doMock('../src/processors/gridset/helpers', () => ({
        readGrid3History: jest.fn(() => [
          {
            id: 'g1',
            content: 'grid single',
            occurrences: [{ timestamp: new Date() }],
          },
        ]),
        readGrid3HistoryForUser: jest.fn(() => [
          {
            id: 'g-user',
            content: 'grid user',
            occurrences: [{ timestamp: new Date() }],
          },
        ]),
        readAllGrid3History: jest.fn(() => [
          {
            id: 'g-all',
            content: 'grid all',
            occurrences: [{ timestamp: new Date() }],
          },
        ]),
        findGrid3Users: jest.fn(() => [
          {
            userName: 'alice',
            langCode: 'en',
            basePath: 'p',
            historyDbPath: 'p/db',
          },
        ]),
      }));

      jest.doMock('../src/processors/snap/helpers', () => ({
        readSnapUsage: jest.fn(() => [
          {
            id: 's1',
            content: 'snap single',
            occurrences: [{ timestamp: new Date() }],
            platform: { buttonId: 'b1' },
          },
        ]),
        readSnapUsageForUser: jest.fn(() => [
          {
            id: 's-user',
            content: 'snap user',
            occurrences: [{ timestamp: new Date() }],
          },
        ]),
        findSnapUsers: jest.fn(() => [{ userId: 'u1', userPath: 'p', vocabPaths: [] }]),
      }));

      // Import after mocks are in place
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const history = require('../src/utilities/analytics/history'); // eslint-disable-line @typescript-eslint/no-var-requires

      const gridUserEntries = history.readGrid3HistoryForUser('alice');
      expect(gridUserEntries[0].source).toBe('Grid');
      expect(gridUserEntries[0].content).toBe('grid user');

      const gridAllEntries = history.readAllGrid3History();
      expect(gridAllEntries[0].source).toBe('Grid');

      const snapEntries = history.readSnapUsageForUser('u1');
      expect(snapEntries[0].source).toBe('Snap');

      expect(history.listGrid3Users()).toHaveLength(1);
      expect(history.listSnapUsers()).toHaveLength(1);

      const unified = history.collectUnifiedHistory();
      expect(unified.map((e: any) => e.source).sort()).toEqual(['Grid', 'Snap']);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  getCommonDocumentsPath,
  findGrid3UserPaths,
  findGrid3HistoryDatabases,
  findGrid3Vocabularies,
  findGrid3UserHistory,
} from '../src/processors/gridset/helpers';
import {
  findSnapPackages as findSnapPackagesFromSnap,
  findSnapPackagePath as findSnapPackagePathFromSnap,
  findSnapUsers,
  findSnapUserVocabularies,
  findSnapUserHistory,
} from '../src/processors/snap/helpers';
import { defaultFileAdapter } from '../src/utils/io';

// Mock modules
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Grid3 Path Discovery', () => {
  const originalPlatform = process.platform;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Mock Windows platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
  });

  afterEach(async () => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  describe('getCommonDocumentsPath', () => {
    it('should return path from registry on Windows', async () => {
      const expectedPath = 'C:\\Users\\Public\\Documents';
      mockExecSync.mockReturnValue(`Common Documents    REG_SZ    ${expectedPath}\r\n` as any);

      const result = getCommonDocumentsPath();

      expect(result).toBe(expectedPath);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('REG.EXE QUERY'),
        expect.objectContaining({ encoding: 'utf-8', windowsHide: true })
      );
    });

    it('should return default path if registry access fails', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Registry access failed');
      });

      const result = getCommonDocumentsPath();

      expect(result).toBe('C:\\Users\\Public\\Documents');
    });

    it('should return empty string on non-Windows platforms', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      const result = getCommonDocumentsPath();

      expect(result).toBe('');
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('findGrid3UserPaths', () => {
    it('should find Grid3 user paths with history databases', async () => {
      const mockCommonDocs = 'C:\\Users\\Public\\Documents';
      mockExecSync.mockReturnValue(`Common Documents    REG_SZ    ${mockCommonDocs}\r\n` as any);

      const grid3BasePath = path.win32.join(mockCommonDocs, 'Smartbox', 'Grid 3', 'Users');

      const result = await findGrid3UserPaths({
        ...defaultFileAdapter,
        listDir: async (pathStr) => {
          if (pathStr === grid3BasePath) return ['TestUser'];
          if (pathStr.includes('TestUser')) return ['en-gb'];
          return [];
        },
        isDirectory: async (pathStr) => {
          return pathStr.endsWith('TestUser') || pathStr.endsWith('en-gb');
        },
        pathExists: async (pathStr) => {
          if (pathStr === grid3BasePath) return true;
          if (pathStr.includes('history.sqlite')) return true;
          return false;
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userName: 'TestUser',
        langCode: 'en-gb',
        basePath: expect.stringContaining('TestUser\\en-gb'),
        historyDbPath: expect.stringContaining('history.sqlite'),
      });
    });

    it('should return empty array if Grid3 directory does not exist', async () => {
      mockExecSync.mockReturnValue(
        'Common Documents    REG_SZ    C:\\Users\\Public\\Documents\r\n' as any
      );
      mockFs.existsSync.mockReturnValue(false);

      const result = findGrid3UserPaths();

      expect(result).toEqual([]);
    });

    it('should return empty array on non-Windows platforms', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });

      const result = findGrid3UserPaths();

      expect(result).toEqual([]);
      expect(mockFs.existsSync).not.toHaveBeenCalled();
    });
  });

  describe('findGrid3HistoryDatabases', () => {
    it('should return array of history database paths', async () => {
      const mockCommonDocs = 'C:\\Users\\Public\\Documents';
      mockExecSync.mockReturnValue(`Common Documents    REG_SZ    ${mockCommonDocs}\r\n` as any);

      const grid3BasePath = path.win32.join(mockCommonDocs, 'Smartbox', 'Grid 3', 'Users');

      const result = await findGrid3HistoryDatabases({
        ...defaultFileAdapter,
        pathExists: async () => true,
        listDir: async (pathStr) => {
          if (pathStr === grid3BasePath) return ['User1'];
          return ['en-us'];
        },
        isDirectory: async (pathStr) => {
          return pathStr.endsWith('User1') || pathStr.endsWith('en-us');
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('history.sqlite');
    });
  });

  describe('findGrid3Vocabularies', () => {
    it('should list gridset files per user', async () => {
      const mockCommonDocs = 'C:\\Users\\Public\\Documents';
      const grid3BasePath = path.win32.join(mockCommonDocs, 'Smartbox', 'Grid 3', 'Users');
      const gridSetsDir = path.win32.join(grid3BasePath, 'User1', 'Grid Sets');

      mockExecSync.mockReturnValue(`Common Documents    REG_SZ    ${mockCommonDocs}\r\n` as any);

      const result = await findGrid3Vocabularies(undefined, {
        ...defaultFileAdapter,
        pathExists: async (pathStr) =>
          pathStr === grid3BasePath || pathStr === gridSetsDir || pathStr.endsWith('Test.gridset'),
        listDir: async (pathStr) => {
          if (pathStr === grid3BasePath) return ['User1'];
          if (pathStr === gridSetsDir) return ['Test.gridset'];
          return [];
        },
        isDirectory: async (pathStr) =>
          pathStr === grid3BasePath || pathStr === gridSetsDir || pathStr.endsWith('User1'),
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userName: 'User1',
        gridsetPath: path.win32.join(gridSetsDir, 'Test.gridset'),
      });
    });
  });

  describe('findGrid3UserHistory', () => {
    it('should return history path for specific user', async () => {
      const mockCommonDocs = 'C:\\Users\\Public\\Documents';
      mockExecSync.mockReturnValue(`Common Documents    REG_SZ    ${mockCommonDocs}\r\n` as any);

      const grid3BasePath = path.win32.join(mockCommonDocs, 'Smartbox', 'Grid 3', 'Users');

      const result = await findGrid3UserHistory('User1', 'en-gb', {
        ...defaultFileAdapter,
        pathExists: async (pathStr) => {
          if (pathStr === grid3BasePath) return true;
          if (pathStr.includes('history.sqlite')) return true;
          return false;
        },
        listDir: async (pathStr) => {
          if (pathStr === grid3BasePath) return ['User1'];
          if (pathStr.includes('User1')) return ['en-gb'];
          return [];
        },
        isDirectory: async (pathStr) => pathStr.endsWith('User1') || pathStr.endsWith('en-gb'),
      });

      expect(result).toContain('history.sqlite');
    });
  });
});

describe('Snap Path Discovery', () => {
  const originalPlatform = process.platform;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Mock Windows platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
    // Mock environment
    process.env = {
      ...originalEnv,
      LOCALAPPDATA: 'C:\\Users\\TestUser\\AppData\\Local',
    };
  });

  afterEach(async () => {
    // Restore original platform and environment
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    process.env = originalEnv;
  });

  describe('findSnapPackages', () => {
    it('should find Snap packages matching pattern', async () => {
      const result = await findSnapPackagesFromSnap(undefined, {
        ...defaultFileAdapter,
        pathExists: async () => true,
        listDir: async () => [
          'TobiiDynavox.Snap_abc123',
          'TobiiDynavox.Communicator_def456',
          'Microsoft.WindowsStore_xyz789',
        ],
        isDirectory: async () => true,
      });

      expect(result).toHaveLength(2);
      expect(result[0].packageName).toBe('TobiiDynavox.Snap_abc123');
      expect(result[0].packagePath).toContain('TobiiDynavox.Snap_abc123');
      expect(result[1].packageName).toBe('TobiiDynavox.Communicator_def456');
    });

    it('should filter by custom pattern', async () => {
      const result = await findSnapPackagesFromSnap('CustomApp', {
        ...defaultFileAdapter,
        pathExists: async () => true,
        listDir: async () => ['TobiiDynavox.Snap_abc123', 'CustomApp.Package_xyz'],
        isDirectory: async () => true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].packageName).toBe('CustomApp.Package_xyz');
    });

    it('should return empty array if Packages directory does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = findSnapPackagesFromSnap();

      expect(result).toEqual([]);
    });

    it('should return empty array if LOCALAPPDATA is not set', async () => {
      delete process.env.LOCALAPPDATA;

      const result = findSnapPackagesFromSnap();

      expect(result).toEqual([]);
      expect(mockFs.existsSync).not.toHaveBeenCalled();
    });

    it('should return empty array on non-Windows platforms', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      const result = findSnapPackagesFromSnap();

      expect(result).toEqual([]);
      expect(mockFs.existsSync).not.toHaveBeenCalled();
    });
  });

  describe('findSnapPackagePath', () => {
    it('should return first matching package path', async () => {
      const result = await findSnapPackagePathFromSnap(undefined, {
        ...defaultFileAdapter,
        pathExists: async () => true,
        listDir: async () => ['TobiiDynavox.Snap_abc123'],
        isDirectory: async () => true,
      });

      expect(result).toContain('TobiiDynavox.Snap_abc123');
    });

    it('should return null if no packages found', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([] as any);

      const result = findSnapPackagePathFromSnap();

      expect(result).toBeNull();
    });
  });

  describe('findSnapUsers', () => {
    it('should list Snap users and vocab files', async () => {
      const localAppData = process.env.LOCALAPPDATA ?? '';
      const packagesPath = path.join(localAppData, 'Packages');
      const packagePath = path.join(packagesPath, 'TobiiDynavox.Snap_abc123');
      const usersRoot = path.join(packagePath, 'LocalState', 'Users');
      const userPath = path.join(usersRoot, 'user1');
      const vocabPath = path.join(userPath, 'board.sps');

      const users = await findSnapUsers('TobiiDynavox', {
        ...defaultFileAdapter,
        pathExists: async (pathStr) =>
          pathStr === packagesPath || pathStr === usersRoot || pathStr === userPath,
        listDir: async (pathStr) => {
          if (pathStr === packagesPath) return ['TobiiDynavox.Snap_abc123'];
          if (pathStr === usersRoot) return ['user1', 'SwiftKeyStaticModels'];
          if (pathStr === userPath) return ['board.sps', 'notes.txt'];
          return [];
        },
        isDirectory: async (pathStr) =>
          pathStr.endsWith('TobiiDynavox.Snap_abc123') ||
          pathStr.endsWith('user1') ||
          pathStr.endsWith('SwiftKeyStaticModels'),
      });

      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({ userId: 'user1' });
      expect(users[0].vocabPaths).toContain(vocabPath);
    });
  });

  describe('findSnapUserVocabularies', () => {
    it('should return vocab paths for a specific user', async () => {
      const localAppData = process.env.LOCALAPPDATA ?? '';
      const packagesPath = path.join(localAppData, 'Packages');
      const packagePath = path.join(packagesPath, 'TobiiDynavox.Snap_abc123');
      const usersRoot = path.join(packagePath, 'LocalState', 'Users');
      const userPath = path.join(usersRoot, 'user1');
      const vocabPath = path.join(userPath, 'board.sps');

      const result = await findSnapUserVocabularies('user1', 'TobiiDynavox', {
        ...defaultFileAdapter,
        pathExists: async (pathStr) =>
          pathStr === packagesPath || pathStr === usersRoot || pathStr === userPath,
        listDir: async (pathStr) => {
          if (pathStr === packagesPath) return ['TobiiDynavox.Snap_abc123'];
          if (pathStr === usersRoot) return ['user1'];
          if (pathStr === userPath) return ['board.sps'];
          return [];
        },
        isDirectory: async (pathStr) =>
          pathStr.endsWith('TobiiDynavox.Snap_abc123') || pathStr.endsWith('user1'),
      });

      expect(result).toContain(vocabPath);
    });
  });

  describe('findSnapUserHistory', () => {
    it('should find history-like files for a user', async () => {
      const localAppData = process.env.LOCALAPPDATA ?? '';
      const packagesPath = path.join(localAppData, 'Packages');
      const packagePath = path.join(packagesPath, 'TobiiDynavox.Snap_abc123');
      const usersRoot = path.join(packagePath, 'LocalState', 'Users');
      const userPath = path.join(usersRoot, 'user1');
      const historyPath = path.join(userPath, 'history.db');

      const result = await findSnapUserHistory('user1', 'TobiiDynavox', {
        ...defaultFileAdapter,
        pathExists: async (pathStr) =>
          pathStr === packagesPath || pathStr === usersRoot || pathStr === userPath,
        listDir: async (pathStr) => {
          if (pathStr === packagesPath) return ['TobiiDynavox.Snap_abc123'];
          if (pathStr === usersRoot) return ['user1'];
          if (pathStr === userPath) return ['history.db'];
          return [];
        },
        isDirectory: async (pathStr) =>
          pathStr.endsWith('TobiiDynavox.Snap_abc123') || pathStr.endsWith('user1'),
      });

      expect(result).toContain(historyPath);
    });
  });
});

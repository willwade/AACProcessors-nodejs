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

// Mock modules
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Grid3 Path Discovery', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Windows platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  describe('getCommonDocumentsPath', () => {
    it('should return path from registry on Windows', () => {
      const expectedPath = 'C:\\Users\\Public\\Documents';
      mockExecSync.mockReturnValue(`Common Documents    REG_SZ    ${expectedPath}\r\n` as any);

      const result = getCommonDocumentsPath();

      expect(result).toBe(expectedPath);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('REG.EXE QUERY'),
        expect.objectContaining({ encoding: 'utf-8', windowsHide: true })
      );
    });

    it('should return default path if registry access fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Registry access failed');
      });

      const result = getCommonDocumentsPath();

      expect(result).toBe('C:\\Users\\Public\\Documents');
    });

    it('should return empty string on non-Windows platforms', () => {
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
    it('should find Grid3 user paths with history databases', () => {
      const mockCommonDocs = 'C:\\Users\\Public\\Documents';
      mockExecSync.mockReturnValue(`Common Documents    REG_SZ    ${mockCommonDocs}\r\n` as any);

      const grid3BasePath = path.win32.join(mockCommonDocs, 'Smartbox', 'Grid 3', 'Users');

      // Mock directory structure
      mockFs.existsSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        if (pathStr === grid3BasePath) return true;
        if (pathStr.includes('history.sqlite')) return true;
        return false;
      });

      mockFs.readdirSync.mockImplementation((p: any, _options?: any) => {
        const pathStr = String(p);
        if (pathStr === grid3BasePath) {
          return [{ name: 'TestUser', isDirectory: () => true }] as any;
        }
        if (pathStr.includes('TestUser')) {
          return [{ name: 'en-gb', isDirectory: () => true }] as any;
        }
        return [] as any;
      });

      const result = findGrid3UserPaths();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userName: 'TestUser',
        langCode: 'en-gb',
        basePath: expect.stringContaining('TestUser\\en-gb'),
        historyDbPath: expect.stringContaining('history.sqlite'),
      });
    });

    it('should return empty array if Grid3 directory does not exist', () => {
      mockExecSync.mockReturnValue(
        'Common Documents    REG_SZ    C:\\Users\\Public\\Documents\r\n' as any
      );
      mockFs.existsSync.mockReturnValue(false);

      const result = findGrid3UserPaths();

      expect(result).toEqual([]);
    });

    it('should return empty array on non-Windows platforms', () => {
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
    it('should return array of history database paths', () => {
      const mockCommonDocs = 'C:\\Users\\Public\\Documents';
      mockExecSync.mockReturnValue(`Common Documents    REG_SZ    ${mockCommonDocs}\r\n` as any);

      const grid3BasePath = path.win32.join(mockCommonDocs, 'Smartbox', 'Grid 3', 'Users');

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        if (pathStr === grid3BasePath) {
          return [{ name: 'User1', isDirectory: () => true }] as any;
        }
        return [{ name: 'en-us', isDirectory: () => true }] as any;
      });

      const result = findGrid3HistoryDatabases();

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('history.sqlite');
    });
  });

  describe('findGrid3Vocabularies', () => {
    it('should list gridset files per user', () => {
      const mockCommonDocs = 'C:\\Users\\Public\\Documents';
      const grid3BasePath = path.win32.join(mockCommonDocs, 'Smartbox', 'Grid 3', 'Users');
      const gridSetsDir = path.join(grid3BasePath, 'User1', 'Grid Sets');

      mockExecSync.mockReturnValue(`Common Documents    REG_SZ    ${mockCommonDocs}\r\n` as any);
      mockFs.existsSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        return pathStr === grid3BasePath || pathStr === gridSetsDir;
      });
      mockFs.readdirSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        if (pathStr === grid3BasePath) {
          return [{ name: 'User1', isDirectory: () => true }] as any;
        }
        if (pathStr === gridSetsDir) {
          return [{ name: 'Test.gridset', isDirectory: () => false, isFile: () => true }] as any;
        }
        return [] as any;
      });

      const result = findGrid3Vocabularies();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userName: 'User1',
        gridsetPath: path.join(gridSetsDir, 'Test.gridset'),
      });
    });
  });

  describe('findGrid3UserHistory', () => {
    it('should return history path for specific user', () => {
      const mockCommonDocs = 'C:\\Users\\Public\\Documents';
      mockExecSync.mockReturnValue(`Common Documents    REG_SZ    ${mockCommonDocs}\r\n` as any);

      const grid3BasePath = path.join(mockCommonDocs, 'Smartbox', 'Grid 3', 'Users');

      mockFs.existsSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        if (pathStr === grid3BasePath) return true;
        if (pathStr.includes('history.sqlite')) return true;
        return false;
      });

      mockFs.readdirSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        if (pathStr === grid3BasePath) {
          return [{ name: 'User1', isDirectory: () => true }] as any;
        }
        if (pathStr.includes('User1')) {
          return [{ name: 'en-gb', isDirectory: () => true }] as any;
        }
        return [] as any;
      });

      const result = findGrid3UserHistory('User1', 'en-gb');

      expect(result).toContain('history.sqlite');
    });
  });
});

describe('Snap Path Discovery', () => {
  const originalPlatform = process.platform;
  const originalEnv = process.env;

  beforeEach(() => {
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

  afterEach(() => {
    // Restore original platform and environment
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    process.env = originalEnv;
  });

  describe('findSnapPackages', () => {
    it('should find Snap packages matching pattern', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: 'TobiiDynavox.Snap_abc123', isDirectory: () => true },
        { name: 'TobiiDynavox.Communicator_def456', isDirectory: () => true },
        { name: 'Microsoft.WindowsStore_xyz789', isDirectory: () => true },
      ] as any);

      const result = findSnapPackagesFromSnap();

      expect(result).toHaveLength(2);
      expect(result[0].packageName).toBe('TobiiDynavox.Snap_abc123');
      expect(result[0].packagePath).toContain('TobiiDynavox.Snap_abc123');
      expect(result[1].packageName).toBe('TobiiDynavox.Communicator_def456');
    });

    it('should filter by custom pattern', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: 'TobiiDynavox.Snap_abc123', isDirectory: () => true },
        { name: 'CustomApp.Package_xyz', isDirectory: () => true },
      ] as any);

      const result = findSnapPackagesFromSnap('CustomApp');

      expect(result).toHaveLength(1);
      expect(result[0].packageName).toBe('CustomApp.Package_xyz');
    });

    it('should return empty array if Packages directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = findSnapPackagesFromSnap();

      expect(result).toEqual([]);
    });

    it('should return empty array if LOCALAPPDATA is not set', () => {
      delete process.env.LOCALAPPDATA;

      const result = findSnapPackagesFromSnap();

      expect(result).toEqual([]);
      expect(mockFs.existsSync).not.toHaveBeenCalled();
    });

    it('should return empty array on non-Windows platforms', () => {
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
    it('should return first matching package path', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: 'TobiiDynavox.Snap_abc123', isDirectory: () => true },
      ] as any);

      const result = findSnapPackagePathFromSnap();

      expect(result).toContain('TobiiDynavox.Snap_abc123');
    });

    it('should return null if no packages found', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([] as any);

      const result = findSnapPackagePathFromSnap();

      expect(result).toBeNull();
    });
  });

  describe('findSnapUsers', () => {
    it('should list Snap users and vocab files', () => {
      const localAppData = process.env.LOCALAPPDATA ?? '';
      const packagesPath = path.join(localAppData, 'Packages');
      const packagePath = path.join(packagesPath, 'TobiiDynavox.Snap_abc123');
      const usersRoot = path.join(packagePath, 'LocalState', 'Users');
      const userPath = path.join(usersRoot, 'user1');
      const vocabPath = path.join(userPath, 'board.sps');

      mockFs.existsSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        return pathStr === packagesPath || pathStr === usersRoot || pathStr === userPath;
      });

      mockFs.readdirSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        if (pathStr === packagesPath) {
          return [{ name: 'TobiiDynavox.Snap_abc123', isDirectory: () => true }] as any;
        }
        if (pathStr === usersRoot) {
          return [
            { name: 'user1', isDirectory: () => true },
            { name: 'SwiftKeyStaticModels', isDirectory: () => true },
          ] as any;
        }
        if (pathStr === userPath) {
          return [
            { name: 'board.sps', isDirectory: () => false },
            { name: 'notes.txt', isDirectory: () => false },
          ] as any;
        }
        return [] as any;
      });

      const users = findSnapUsers();

      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({ userId: 'user1' });
      expect(users[0].vocabPaths).toContain(vocabPath);
    });
  });

  describe('findSnapUserVocabularies', () => {
    it('should return vocab paths for a specific user', () => {
      const localAppData = process.env.LOCALAPPDATA ?? '';
      const packagesPath = path.join(localAppData, 'Packages');
      const packagePath = path.join(packagesPath, 'TobiiDynavox.Snap_abc123');
      const usersRoot = path.join(packagePath, 'LocalState', 'Users');
      const userPath = path.join(usersRoot, 'user1');
      const vocabPath = path.join(userPath, 'board.sps');

      mockFs.existsSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        return pathStr === packagesPath || pathStr === usersRoot || pathStr === userPath;
      });

      mockFs.readdirSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        if (pathStr === packagesPath) {
          return [{ name: 'TobiiDynavox.Snap_abc123', isDirectory: () => true }] as any;
        }
        if (pathStr === usersRoot) {
          return [{ name: 'user1', isDirectory: () => true }] as any;
        }
        if (pathStr === userPath) {
          return [{ name: 'board.sps', isDirectory: () => false }] as any;
        }
        return [] as any;
      });

      const result = findSnapUserVocabularies('user1');

      expect(result).toContain(vocabPath);
    });
  });

  describe('findSnapUserHistory', () => {
    it('should find history-like files for a user', () => {
      const localAppData = process.env.LOCALAPPDATA ?? '';
      const packagesPath = path.join(localAppData, 'Packages');
      const packagePath = path.join(packagesPath, 'TobiiDynavox.Snap_abc123');
      const usersRoot = path.join(packagePath, 'LocalState', 'Users');
      const userPath = path.join(usersRoot, 'user1');
      const historyPath = path.join(userPath, 'history.db');

      mockFs.existsSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        return pathStr === packagesPath || pathStr === usersRoot || pathStr === userPath;
      });

      mockFs.readdirSync.mockImplementation((p: any) => {
        const pathStr = String(p);
        if (pathStr === packagesPath) {
          return [{ name: 'TobiiDynavox.Snap_abc123', isDirectory: () => true }] as any;
        }
        if (pathStr === usersRoot) {
          return [{ name: 'user1', isDirectory: () => true }] as any;
        }
        if (pathStr === userPath) {
          return [{ name: 'history.db', isDirectory: () => false }] as any;
        }
        return [] as any;
      });

      const result = findSnapUserHistory('user1');

      expect(result).toContain(historyPath);
    });
  });
});

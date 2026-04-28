import type { SqlJsConfig, SqlJsStatic, InitSqlJsStatic } from 'sql.js';
import { defaultFileAdapter, FileAdapter, getNodeRequire, isNodeRuntime } from './io';

export interface SqliteStatementAdapter {
  all(...params: unknown[]): any[];
  get(...params: unknown[]): any;
  run(...params: unknown[]): any;
}

export interface SqliteDatabaseAdapter {
  prepare(sql: string): SqliteStatementAdapter;
  exec(sql: string): void;
  close(): void;
}

export interface SqliteOpenOptions {
  readonly?: boolean;
  fileAdapter?: FileAdapter;
}

export interface SqliteOpenResult {
  db: SqliteDatabaseAdapter;
  cleanup?: () => Promise<void>;
}

let sqlJsConfig: SqlJsConfig | null = null;
let sqlJsPromise: Promise<SqlJsStatic> | null = null;

export function configureSqlJs(config: SqlJsConfig): void {
  sqlJsConfig = { ...(sqlJsConfig ?? {}), ...config };
}

async function getSqlJsBrowser(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    const isBrowser = typeof globalThis !== 'undefined' && (globalThis as any).window !== undefined;
    if (!isBrowser) throw new Error('Must be run in a browser');
    const window = (globalThis as any).window;
    if (!('initSqlJs' in window)) throw new Error('Need to add sql-wasm.js script element to DOM');
    const initSqlJs = window.initSqlJs as InitSqlJsStatic;
    sqlJsPromise = initSqlJs(sqlJsConfig ?? {});
  }
  return sqlJsPromise;
}

function createSqlJsAdapter(db: {
  prepare: (sql: string) => any;
  exec: (sql: string) => void;
  close: () => void;
}): SqliteDatabaseAdapter {
  return {
    prepare(sql: string): SqliteStatementAdapter {
      return {
        all(...params: unknown[]): any[] {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          const rows: any[] = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject() as Record<string, unknown>);
          }
          stmt.free();
          return rows;
        },
        get(...params: unknown[]): any {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          const row = stmt.step() ? stmt.getAsObject() : undefined;
          stmt.free();
          return row;
        },
        run(...params: unknown[]): any {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          stmt.step();
          stmt.free();
          return undefined;
        },
      };
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    close(): void {
      db.close();
    },
  };
}

function getBetterSqlite3(): typeof import('better-sqlite3') {
  try {
    const nodeRequire = getNodeRequire();
    return nodeRequire('better-sqlite3') as typeof import('better-sqlite3');
  } catch {
    throw new Error('better-sqlite3 is not available in this environment.');
  }
}

export function requireBetterSqlite3(): typeof import('better-sqlite3') {
  return getBetterSqlite3();
}

export async function openSqliteDatabase(
  input: string | Uint8Array | ArrayBuffer | Buffer,
  options: SqliteOpenOptions = {}
): Promise<SqliteOpenResult> {
  const { readBinaryFromInput, mkTempDir, writeBinaryToPath, removePath, join } =
    options.fileAdapter ?? defaultFileAdapter;
  if (typeof input === 'string') {
    if (!isNodeRuntime()) {
      throw new Error('SQLite file paths are not supported in browser environments.');
    }
    const Database = getBetterSqlite3();
    const db = new Database(input, {
      readonly: options.readonly ?? true,
    }) as SqliteDatabaseAdapter;
    return { db };
  }

  const data = await readBinaryFromInput(input);

  if (!isNodeRuntime()) {
    const SQL = await getSqlJsBrowser();
    const db = new SQL.Database(data);
    return { db: createSqlJsAdapter(db) };
  }

  const tempDir = await mkTempDir('aac-sqlite-');
  const dbPath = join(tempDir, 'input.sqlite');
  await writeBinaryToPath(dbPath, data);

  const Database = getBetterSqlite3();
  const db = new Database(dbPath, {
    readonly: options.readonly ?? true,
  }) as SqliteDatabaseAdapter;
  const cleanup = async (): Promise<void> => {
    try {
      db.close();
    } finally {
      try {
        await removePath(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean up temporary SQLite files:', error);
      }
    }
  };

  return { db, cleanup };
}

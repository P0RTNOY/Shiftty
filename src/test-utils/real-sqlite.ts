// @ts-nocheck
import { execFileSync } from 'child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export function createRealSqliteDb() {
  const dir = mkdtempSync(join(tmpdir(), 'mock-sqlite-'));
  const dbPath = join(dir, 'db.sqlite');
  const transactionBackupPath = join(dir, 'transaction-backup.sqlite');
  let transactionDepth = 0;
  
  function runSql(sql: string, params: any[] = []) {
    let finalSql = sql;
    if (params && params.length > 0) {
      let i = 0;
      finalSql = finalSql.replace(/\?/g, () => {
        const val = params[i++];
        if (val === null) return 'NULL';
        if (typeof val === 'number') return val.toString();
        return "'" + val.toString().replace(/'/g, "''") + "'";
      });
    }
    
    let out = '';
    try {
      out = execFileSync('sqlite3', ['-cmd', 'PRAGMA foreign_keys=ON;', '-batch', '-json', dbPath], { input: finalSql, encoding: 'utf8' }).trim();
    } catch (e: any) {
      console.error('SQL ERROR:', e.message, '\\nSQL:', finalSql);
      throw e;
    }
    if (!out) return [];
    try {
      return JSON.parse(out);
    } catch {
      return [];
    }
  }

  const obj: any = {
    execAsync: async (sql: string) => {
      runSql(sql);
    },
    runAsync: async (sql: string, ...args: any[]) => {
      const params = Array.isArray(args[0]) ? args[0] : args;
      runSql(sql, params);
      return { changes: 1, lastInsertRowId: 1 };
    },
    getAllAsync: async (sql: string, ...args: any[]) => {
      const params = Array.isArray(args[0]) ? args[0] : args;
      return runSql(sql, params);
    },
    getFirstAsync: async (sql: string, ...args: any[]) => {
      const params = Array.isArray(args[0]) ? args[0] : args;
      const res = runSql(sql, params);
      return res && res.length > 0 ? res[0] : null;
    },
    withTransactionAsync: async (callback: () => Promise<void>) => {
      if (transactionDepth > 0) {
        await callback();
        return;
      }
      transactionDepth += 1;
      if (existsSync(dbPath)) copyFileSync(dbPath, transactionBackupPath);
      try {
        await callback();
        if (existsSync(transactionBackupPath)) unlinkSync(transactionBackupPath);
      } catch (error) {
        if (existsSync(transactionBackupPath)) {
          copyFileSync(transactionBackupPath, dbPath);
          unlinkSync(transactionBackupPath);
        }
        throw error;
      } finally {
        transactionDepth -= 1;
      }
    },
    closeAsync: async () => {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  return obj;
}

const { execFileSync } = require('child_process');
const { mkdtempSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const instances = [];

process.on('exit', () => {
  instances.forEach((dir) => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (_error) {}
  });
});

module.exports = {
  openDatabaseAsync: async (dbName) => {
    const dir = mkdtempSync(join(tmpdir(), 'mock-sqlite-'));
    instances.push(dir);
    const dbPath = join(dir, 'db.sqlite');

    function runSql(sql, params = []) {
      let finalSql = sql;
      if (params && params.length > 0) {
        // Very basic substitution for testing
        let i = 0;
        finalSql = finalSql.replace(/\?/g, () => {
          const val = params[i++];
          if (val === null) return 'NULL';
          if (typeof val === 'number') return val.toString();
          return "'" + val.toString().replace(/'/g, "''") + "'";
        });
      }
      
      const out = execFileSync('sqlite3', ['-batch', '-json', dbPath], { input: finalSql, encoding: 'utf8' }).trim();
      if (!out) return [];
      try {
        return JSON.parse(out);
      } catch (_error) {
        // sqlite3 returns text for PRAGMAs or non-json output sometimes, but -json flag should wrap results.
        return [];
      }
    }

    return {
      execAsync: async (sql) => {
        runSql(sql);
      },
      runAsync: async (sql, params = []) => {
        runSql(sql, params);
        return { changes: 1, lastInsertRowId: 1 };
      },
      getAllAsync: async (sql, params = []) => {
        return runSql(sql, params);
      },
      getFirstAsync: async (sql, params = []) => {
        const res = runSql(sql, params);
        return res && res.length > 0 ? res[0] : null;
      },
      withTransactionAsync: async (callback) => {
        runSql('BEGIN TRANSACTION;');
        try {
          await callback();
          runSql('COMMIT;');
        } catch (e) {
          runSql('ROLLBACK;');
          throw e;
        }
      },
      closeAsync: async () => {
        // no-op
      }
    };
  }
};

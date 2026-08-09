const { execFileSync } = require('child_process');
const { mkdtempSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const fs = require('fs');

const dir = mkdtempSync(join(tmpdir(), 'mock-sqlite-'));
const dbPath = join(dir, 'db.sqlite');

const migrations = fs.readdirSync('src/data/database/migrations')
  .filter(f => f.endsWith('.ts'))
  .sort();

let schema = '';
for (const file of migrations) {
  const content = fs.readFileSync(join('src/data/database/migrations', file), 'utf8');
  const sqlMatch = content.match(/db\.execAsync\(\s*`([\s\S]*?)`\s*\)/);
  if (sqlMatch) {
    schema += sqlMatch[1] + '\n';
  }
}

execFileSync('sqlite3', [dbPath, schema]);

const fksW = execFileSync('sqlite3', ['-json', dbPath, 'PRAGMA foreign_key_list(workplaces);']).toString();
const fksS = execFileSync('sqlite3', ['-json', dbPath, 'PRAGMA foreign_key_list(salary_profiles);']).toString();
const fksR = execFileSync('sqlite3', ['-json', dbPath, 'PRAGMA foreign_key_list(roles);']).toString();

console.log('--- FK workplaces ---');
console.log(fksW || '[]');
console.log('--- FK salary_profiles ---');
console.log(fksS || '[]');
console.log('--- FK roles ---');
console.log(fksR || '[]');

rmSync(dir, { recursive: true, force: true });

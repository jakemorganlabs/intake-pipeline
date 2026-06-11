import { pool } from './index.js';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

async function runMigrations() {
  const migrationDir = resolve('migrations');
  const files = readdirSync(migrationDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const path = resolve(migrationDir, file);
    const sql = readFileSync(path, 'utf-8');
    console.log(`Applying ${file}...`);
    try {
      await pool.query(sql);
      console.log(`  OK`);
    } catch (err) {
      console.error(`  FAILED: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  console.log(`\nAll migrations applied.`);
  await pool.end();
}

runMigrations();

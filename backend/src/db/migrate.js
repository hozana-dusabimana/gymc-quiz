import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

function listMigrations() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function applied(client) {
  const { rows } = await client.query('SELECT name FROM schema_migrations ORDER BY name');
  return new Set(rows.map((r) => r.name));
}

async function up() {
  const client = new pg.Client({ connectionString: env.databaseUrl });
  await client.connect();
  try {
    await ensureTable(client);
    const done = await applied(client);
    const pending = listMigrations().filter((m) => !done.has(m));
    if (pending.length === 0) {
      console.log('[migrate] up to date');
      return;
    }
    for (const name of pending) {
      const sql = readFileSync(path.join(migrationsDir, name), 'utf8');
      console.log(`[migrate] applying ${name}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] FAILED ${name}:`, err.message);
        throw err;
      }
    }
    console.log(`[migrate] applied ${pending.length} migration(s)`);
  } finally {
    await client.end();
  }
}

async function status() {
  const client = new pg.Client({ connectionString: env.databaseUrl });
  await client.connect();
  try {
    await ensureTable(client);
    const done = await applied(client);
    for (const name of listMigrations()) {
      console.log(`${done.has(name) ? '  [x]' : '  [ ]'} ${name}`);
    }
  } finally {
    await client.end();
  }
}

async function reset() {
  if (env.isProd) throw new Error('refusing to reset database in production');
  const client = new pg.Client({ connectionString: env.databaseUrl });
  await client.connect();
  try {
    console.log('[migrate] dropping public schema');
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  } finally {
    await client.end();
  }
  await up();
}

const cmd = process.argv[2] || 'up';
const runners = { up, status, reset };
if (!runners[cmd]) {
  console.error(`unknown command: ${cmd} (use: up | status | reset)`);
  process.exit(1);
}
runners[cmd]().catch((err) => {
  console.error(err);
  process.exit(1);
});

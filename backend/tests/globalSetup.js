import { execFileSync } from 'node:child_process';
import pg from 'pg';

/** Reset + migrate the test database once before the whole suite. */
export default async function () {
  process.env.NODE_ENV = 'test';
  // Loads the root .env (dotenv) and resolves TEST_DATABASE_URL.
  const { env } = await import('../src/config/env.js');
  const url = env.databaseUrl;
  if (!url) throw new Error('TEST_DATABASE_URL is required to run tests');

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();

  execFileSync(process.execPath, ['src/db/migrate.js', 'up'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });
}

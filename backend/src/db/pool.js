import pg from 'pg';
import { env } from '../config/env.js';

// pgvector returns `vector` columns as strings like "[0.1,0.2,...]".
// Keep them as-is; helpers in lib/embeddings.js parse/serialize.

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: env.isTest ? 4 : 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[db] unexpected idle client error', err);
});

/**
 * Run a parameterized query. Never interpolate user input into SQL text.
 * @param {string} text
 * @param {any[]} [params]
 */
export function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run `fn` inside a transaction. Rolls back on any thrown error.
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}

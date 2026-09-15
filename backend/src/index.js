import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { runStartupRecovery } from './startup.js';

const app = createApp();

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[gymc] API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  setTimeout(runStartupRecovery, 2000);
});

async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n[gymc] ${signal} received, shutting down`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

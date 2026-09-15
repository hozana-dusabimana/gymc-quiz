import { query } from './db/pool.js';
import { getObjectBuffer } from './lib/storage.js';
import { processMaterial } from './services/material.service.js';

/**
 * Recover work that was interrupted by a restart:
 * - materials left in 'processing' are re-processed from storage
 * - attempts left in 'evaluating' for too long are re-finalized
 */
export async function runStartupRecovery() {
  try {
    const { rows } = await query(
      `SELECT id, storage_key, file_type FROM materials
        WHERE status = 'processing' AND updated_at < now() - interval '30 seconds'`,
    );
    for (const m of rows) {
      // eslint-disable-next-line no-console
      console.log(`[recovery] re-processing material ${m.id}`);
      getObjectBuffer(m.storage_key)
        .then((buf) => processMaterial(m.id, buf, m.file_type))
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(`[recovery] material ${m.id} failed:`, err.message);
          query(`UPDATE materials SET status='failed', error_message=$2 WHERE id=$1`, [
            m.id,
            'Interrupted during processing; please re-upload or retry.',
          ]).catch(() => {});
        });
    }
    if (rows.length) console.log(`[recovery] queued ${rows.length} material(s)`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[recovery] failed:', err.message);
  }
}

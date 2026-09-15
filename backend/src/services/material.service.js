import crypto from 'node:crypto';
import { query } from '../db/pool.js';
import { env } from '../config/env.js';
import { uploadObject, deleteObject, objectUrl, ensureBucket } from '../lib/storage.js';
import { extractText } from '../lib/extractText.js';
import { chunkPages } from '../lib/chunk.js';
import { embedMany } from '../lib/embeddings.js';
import { chat, aiConfigured } from '../lib/ai.js';

const EXT_TO_TYPE = { pdf: 'pdf', docx: 'docx', pptx: 'pptx', txt: 'txt', md: 'md' };

export function detectFileType(filename, mimetype) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (EXT_TO_TYPE[ext]) return EXT_TO_TYPE[ext];
  if (mimetype?.includes('pdf')) return 'pdf';
  if (mimetype?.includes('word')) return 'docx';
  if (mimetype?.includes('presentation')) return 'pptx';
  return null;
}

/**
 * Store the uploaded file in R2 and create the material row (status=processing),
 * then kick off async processing. Returns the created row.
 */
export async function createMaterial({ courseId, uploadedBy, file, title }) {
  const fileType = detectFileType(file.originalname, file.mimetype);
  if (!fileType || !env.uploads.allowedTypes.includes(fileType)) {
    const err = new Error('Unsupported file type. Allowed: ' + env.uploads.allowedTypes.join(', '));
    err.status = 422;
    throw err;
  }
  if (file.size > env.uploads.maxBytes) {
    const err = new Error('File exceeds the maximum allowed size');
    err.status = 413;
    throw err;
  }

  await ensureBucket();
  const key = `courses/${courseId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${sanitize(
    file.originalname,
  )}`;
  const { url } = await uploadObject({ key, body: file.buffer, contentType: file.mimetype });

  const { rows } = await query(
    `INSERT INTO materials (course_id, uploaded_by, title, filename, file_type, file_size, storage_key, storage_url, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'processing') RETURNING *`,
    [
      courseId,
      uploadedBy,
      title?.trim() || stripExt(file.originalname),
      file.originalname,
      fileType,
      file.size,
      key,
      url,
    ],
  );
  const material = rows[0];

  // Fire and forget; processing errors are captured on the row.
  processMaterial(material.id, file.buffer, fileType).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`[material ${material.id}] processing crashed`, err);
  });

  return material;
}

export async function processMaterial(materialId, buffer, fileType) {
  try {
    const { pages, pageCount } = await extractText(buffer, fileType);
    const chunks = chunkPages(pages);

    if (chunks.length === 0) {
      await query(
        `UPDATE materials SET status='ready', page_count=$2, chunk_count=0,
           summary='No extractable text was found in this document.' WHERE id=$1`,
        [materialId, pageCount],
      );
      return;
    }

    const vectors = await embedMany(chunks.map((c) => c.content));
    const mat = await query('SELECT course_id FROM materials WHERE id = $1', [materialId]);
    const courseId = mat.rows[0]?.course_id;

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      await query(
        `INSERT INTO material_chunks (material_id, course_id, chunk_index, content, page_number, token_estimate, embedding)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (material_id, chunk_index) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
        [materialId, courseId, c.chunkIndex, c.content, c.pageNumber, c.tokenEstimate, JSON.stringify(vectors[i])],
      );
    }

    const summary = await summarise(chunks.slice(0, 6).map((c) => c.content).join('\n\n'));

    await query(
      `UPDATE materials SET status='ready', page_count=$2, chunk_count=$3, summary=$4, error_message=NULL WHERE id=$1`,
      [materialId, pageCount, chunks.length, summary],
    );
  } catch (err) {
    await query(`UPDATE materials SET status='failed', error_message=$2 WHERE id=$1`, [
      materialId,
      String(err.message || err).slice(0, 500),
    ]);
    throw err;
  }
}

async function summarise(text) {
  if (!text.trim()) return '';
  if (!aiConfigured()) return text.slice(0, 240).replace(/\s+/g, ' ') + '…';
  try {
    const out = await chat({
      system: 'You write concise 1-2 sentence academic summaries of lecture material. No preamble.',
      user: `Summarise the key topics covered in this excerpt in 1-2 sentences:\n\n${text.slice(0, 6000)}`,
      temperature: 0.3,
      maxTokens: 160,
    });
    return out.trim().slice(0, 500);
  } catch {
    return text.slice(0, 240).replace(/\s+/g, ' ') + '…';
  }
}

export async function deleteMaterial(materialId) {
  const { rows } = await query('SELECT storage_key FROM materials WHERE id = $1', [materialId]);
  if (rows[0]?.storage_key) {
    await deleteObject(rows[0].storage_key).catch(() => {});
  }
  await query('DELETE FROM materials WHERE id = $1', [materialId]);
}

export async function refreshedDownloadUrl(material) {
  if (!material.storage_key) return material.storage_url;
  return objectUrl(material.storage_key, 3600);
}

function sanitize(name) {
  return name.replace(/[^\w.-]+/g, '_').slice(-80);
}
function stripExt(name) {
  return name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

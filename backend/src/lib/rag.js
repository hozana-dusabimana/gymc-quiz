import { query } from '../db/pool.js';
import { embed, cosineSimilarity } from './embeddings.js';

/**
 * Retrieve the most relevant material chunks for a course given a free-text
 * query. Cosine similarity is computed in-process over the course's embedded
 * chunks (MVP scale). Returns chunks ordered by score desc.
 *
 * @param {string} courseId
 * @param {string} queryText
 * @param {{ topK?:number, minScore?:number }} [opts]
 */
export async function retrieveChunks(courseId, queryText, opts = {}) {
  const topK = opts.topK ?? 4;
  const minScore = opts.minScore ?? 0.15;
  if (!queryText || !queryText.trim()) return [];

  const { rows } = await query(
    `SELECT c.id, c.material_id, c.content, c.page_number, c.embedding,
            m.title AS material_title, m.filename
       FROM material_chunks c
       JOIN materials m ON m.id = c.material_id
      WHERE c.course_id = $1 AND c.embedding IS NOT NULL AND m.status = 'ready'`,
    [courseId],
  );
  if (rows.length === 0) return [];

  const qVec = await embed(queryText);

  const scored = rows
    .map((r) => {
      const vec = Array.isArray(r.embedding) ? r.embedding : safeParse(r.embedding);
      return {
        chunkId: r.id,
        materialId: r.material_id,
        materialTitle: r.material_title,
        filename: r.filename,
        page: r.page_number,
        content: r.content,
        score: vec ? cosineSimilarity(qVec, vec) : 0,
      };
    })
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/** Build a compact, numbered context block for the LLM prompt. */
export function formatContext(chunks) {
  if (!chunks.length) return '';
  return chunks
    .map(
      (c, i) =>
        `[[${i + 1}]] source: "${c.materialTitle}" (${c.filename}), page ${c.page ?? 'n/a'}\n${c.content.slice(0, 900)}`,
    )
    .join('\n\n---\n\n');
}

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

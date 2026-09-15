import crypto from 'node:crypto';
import path from 'node:path';
import { env } from '../config/env.js';

/**
 * Local sentence embeddings via transformers.js (all-MiniLM-L6-v2, 384-d).
 * Falls back to a deterministic hashing embedding if the model can't be
 * loaded (offline CI, etc.) so RAG never hard-fails — retrieval quality
 * degrades gracefully rather than the request 500-ing.
 */

let extractorPromise = null;
// EMBEDDINGS_FALLBACK=true forces the deterministic hashing embedding (CI / offline).
let useFallback = process.env.EMBEDDINGS_FALLBACK === 'true';

async function getExtractor() {
  if (useFallback) return null;
  if (extractorPromise) return extractorPromise;

  extractorPromise = (async () => {
    try {
      const { pipeline, env: tenv } = await import('@xenova/transformers');
      tenv.cacheDir = path.join(env.repoRoot, 'backend/.models');
      tenv.allowRemoteModels = true;
      const extractor = await pipeline('feature-extraction', env.embedding.model);
      return extractor;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[embeddings] model unavailable, using hashing fallback:', err.message);
      useFallback = true;
      return null;
    }
  })();

  return extractorPromise;
}

/** @param {string} text @returns {Promise<number[]>} unit-normalised vector */
export async function embed(text) {
  const [v] = await embedMany([text]);
  return v;
}

/** @param {string[]} texts @returns {Promise<number[][]>} */
export async function embedMany(texts) {
  const clean = texts.map((t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 4000));
  const extractor = await getExtractor();

  if (!extractor) return clean.map(hashingEmbedding);

  const out = [];
  for (const t of clean) {
    const res = await extractor(t || ' ', { pooling: 'mean', normalize: true });
    out.push(Array.from(res.data));
  }
  return out;
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Deterministic fallback: hashed token buckets, L2-normalised. */
function hashingEmbedding(text) {
  const dim = env.embedding.dim;
  const vec = new Array(dim).fill(0);
  const tokens = (text.toLowerCase().match(/[a-z0-9]+/g) || []).slice(0, 800);
  for (const tok of tokens) {
    const h = crypto.createHash('md5').update(tok).digest();
    const idx = h.readUInt32BE(0) % dim;
    const sign = h[4] & 1 ? 1 : -1;
    vec[idx] += sign;
  }
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

export function isFallbackActive() {
  return useFallback;
}

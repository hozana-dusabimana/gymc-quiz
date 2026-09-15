import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/** Mint an access token for a user. */
export function signAccessToken(user) {
  const claims = { sub: user.id, role: user.role, email: user.email, name: user.name };
  return jwt.sign(claims, env.jwt.secret, { expiresIn: env.jwt.accessTtl });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

/** Opaque refresh token (random) — only its SHA-256 hash is stored. */
export function generateRefreshToken() {
  const raw = crypto.randomBytes(48).toString('base64url');
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Short-lived token that authorises download of a single local storage object. */
export function signFileToken(key, expiresIn = '1h') {
  return jwt.sign({ k: key, t: 'file' }, env.jwt.secret, { expiresIn });
}
export function verifyFileToken(token) {
  const p = jwt.verify(token, env.jwt.secret);
  if (p.t !== 'file' || !p.k) throw new Error('not a file token');
  return p.k;
}

export function refreshTokenExpiry() {
  const ttl = env.jwt.refreshTtl;
  const days = /^(\d+)d$/.exec(ttl)?.[1];
  const ms = days ? Number(days) * 86_400_000 : 30 * 86_400_000;
  return new Date(Date.now() + ms);
}

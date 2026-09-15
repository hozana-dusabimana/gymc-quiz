import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/pool.js';
import { env } from '../config/env.js';
import { errors } from '../utils/response.js';
import { sendMail, otpEmail } from '../lib/email.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
} from '../lib/jwt.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isEmail(value) {
  return EMAIL_RE.test(String(value || '').trim());
}

/** `jane.doe@example.com` -> `ja•••••••@example.com` — safe to show before the code screen. */
export function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return email || '';
  const head = local.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}

export async function findUserByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [
    normaliseEmail(email),
  ]);
  return rows[0] || null;
}

/**
 * Resolve a login identifier to a user. It can be an email or a choir member
 * number (`GYMC/001`, or just `GYMC001`). Returns null when nothing matches.
 */
export async function findUserByIdentifier(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  if (isEmail(raw)) return findUserByEmail(raw);
  const compact = raw.replace(/\s+/g, '');
  const { rows } = await query(
    `SELECT * FROM users
       WHERE lower(member_number) = lower($1)
          OR replace(lower(member_number), ' ', '') = lower($2)
          OR lower(member_number) LIKE lower($2) || '/%'
       ORDER BY last_login_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
    [raw, compact],
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    role: u.role,
    email: u.email,
    name: u.name,
    phone: u.phone || null,
    prefix: u.prefix || null,
    avatarUrl: u.avatar_url || null,
    memberNumber: u.member_number || null,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at || null,
  };
}

/** Register a self-serve account, then issue a login OTP. */
export async function register({ name, email, role, phone }) {
  email = normaliseEmail(email);
  if (!EMAIL_RE.test(email)) throw errors.validation('A valid email is required');
  if (!['member', 'leader'].includes(role)) throw errors.validation('role must be member or leader');
  if (!name || name.trim().length < 2) throw errors.validation('name is required');

  const existing = await findUserByEmail(email);
  if (existing) {
    if (existing.last_login_at) throw errors.conflict('An account with that email already exists — sign in instead');
    if (existing.role !== role) {
      await query('UPDATE users SET role = $2, name = $3, phone = COALESCE($4, phone) WHERE id = $1', [
        existing.id,
        role,
        name.trim(),
        phone || null,
      ]);
    }
  } else {
    await query(
      `INSERT INTO users (role, email, name, phone) VALUES ($1, $2, $3, $4)`,
      [role, email, name.trim(), phone || null],
    );
  }

  const otp = await issueOtp(email, 'login');
  return { email, otpSent: true, ...otp };
}

/**
 * Issue (or re-issue) a login OTP for an existing account, identified by email
 * or choir member number. The code always goes to the account's registered
 * email; the response only ever exposes a masked hint.
 */
export async function requestLoginOtp(identifier) {
  const raw = String(identifier || '').trim();
  if (raw.length < 3) throw errors.validation('Enter your member number or email');
  const user = await findUserByIdentifier(raw);
  // Do not reveal whether the account exists; still rate-limited upstream.
  if (!user || !user.is_active) return { otpSent: true };
  const otp = await issueOtp(normaliseEmail(user.email), 'login', user.name);
  return { otpSent: true, sentTo: maskEmail(user.email), ...otp };
}

async function issueOtp(email, purpose, name) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + env.otp.ttlMinutes * 60_000);

  await query(
    `INSERT INTO auth_otps (email, code_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)`,
    [email, codeHash, purpose, expiresAt],
  );

  const mail = otpEmail({ code, name, purpose });
  await sendMail({ to: email, ...mail });

  if (env.otp.debugLog) {
    // eslint-disable-next-line no-console
    console.log(`[otp] ${email} -> ${code} (${purpose})`);
  }
  // Expose the code in the response only outside production, OR when a
  // deployment explicitly opts in via OTP_EXPOSE_DEV_CODE (used for a one-off
  // post-deploy smoke test, then turned back off).
  return !env.isProd || env.otp.exposeDevCode ? { devCode: code } : {};
}

/**
 * Verify an OTP and start a session. `identifier` (or the legacy `email`) may be
 * an email or a choir member number — it is resolved to the account whose
 * registered email received the code. Returns { user, accessToken, refreshToken }.
 */
export async function verifyOtp({ email, identifier, code, userAgent }) {
  if (!/^\d{6}$/.test(String(code || ''))) throw errors.validation('Enter the 6-digit code');

  const user = await findUserByIdentifier(identifier || email);
  if (!user || !user.is_active) throw errors.unauthorized('Account not found or disabled');
  const otpEmailAddr = normaliseEmail(user.email);

  const { rows } = await query(
    `SELECT * FROM auth_otps
       WHERE lower(email) = lower($1) AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    [otpEmailAddr],
  );
  const otp = rows[0];
  if (!otp) throw errors.badRequest('No pending code — request a new one');
  if (new Date(otp.expires_at) < new Date()) throw errors.badRequest('That code has expired — request a new one');
  if (otp.attempts >= env.otp.maxAttempts) {
    throw errors.tooMany('Too many incorrect attempts — request a new code');
  }

  const match = await bcrypt.compare(String(code), otp.code_hash);
  if (!match) {
    await query('UPDATE auth_otps SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
    throw errors.badRequest('Incorrect code');
  }

  const fresh = (await findUserById(user.id)) || user;
  return startSession(fresh, userAgent, async (client) => {
    await client.query('UPDATE auth_otps SET consumed_at = now() WHERE id = $1', [otp.id]);
  });
}

/**
 * Create a login session for a user: mark last_login_at, mint a refresh token,
 * and return { user, accessToken, refreshToken, refreshExpiresAt }.
 * `extra(client)` runs inside the same transaction (e.g. consume an OTP).
 */
async function startSession(user, userAgent, extra) {
  const tx = await withTransaction(async (client) => {
    if (extra) await extra(client);
    await client.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    const { raw, hash } = generateRefreshToken();
    const expiresAt = refreshTokenExpiry();
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, hash, userAgent || null, expiresAt],
    );
    return { refreshToken: raw, refreshExpiresAt: expiresAt };
  });
  return {
    user: publicUser(user),
    accessToken: signAccessToken(user),
    ...tx,
  };
}

/** Rotate a refresh token. Returns { user, accessToken, refreshToken }. */
export async function refreshSession({ refreshToken, userAgent }) {
  if (!refreshToken) throw errors.unauthorized('Missing refresh token');
  const tokenHash = hashToken(refreshToken);
  const { rows } = await query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  const record = rows[0];
  if (!record || record.revoked_at || new Date(record.expires_at) < new Date()) {
    throw errors.unauthorized('Session expired — sign in again');
  }
  const user = await findUserById(record.user_id);
  if (!user || !user.is_active) throw errors.unauthorized('Account not found or disabled');

  const rotated = await withTransaction(async (client) => {
    await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [record.id]);
    const { raw, hash } = generateRefreshToken();
    const expiresAt = refreshTokenExpiry();
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, hash, userAgent || null, expiresAt],
    );
    return { refreshToken: raw, refreshExpiresAt: expiresAt };
  });

  return {
    user: publicUser(user),
    accessToken: signAccessToken(user),
    ...rotated,
  };
}

export async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return;
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [
    hashToken(refreshToken),
  ]);
}

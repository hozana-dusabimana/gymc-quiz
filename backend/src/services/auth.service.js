import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/pool.js';
import { errors } from '../utils/response.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
} from '../lib/jwt.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A pre-computed bcrypt hash of a value nobody will ever type, compared
// against on a not-found lookup so a login attempt takes the same shape of
// work whether or not the account exists.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q0X.q8UExx.qJb.z8t0F5x0EZ3n3e';

export function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isEmail(value) {
  return EMAIL_RE.test(String(value || '').trim());
}

export async function findUserByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [
    normaliseEmail(email),
  ]);
  return rows[0] || null;
}

export async function findUserByPhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  const { rows } = await query('SELECT * FROM users WHERE phone = $1', [raw]);
  return rows[0] || null;
}

/** Resolve a login identifier (email or phone number) to a user. */
export async function findUserByIdentifier(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  return isEmail(raw) ? findUserByEmail(raw) : findUserByPhone(raw);
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

/** Register a self-serve account with name, email, phone and password, and log them straight in. */
export async function register({ name, email, phone, password, role, userAgent }) {
  email = normaliseEmail(email);
  phone = String(phone || '').trim();
  if (!EMAIL_RE.test(email)) throw errors.validation('A valid email is required');
  if (!phone) throw errors.validation('A phone number is required');
  if (!['member', 'leader'].includes(role)) throw errors.validation('role must be member or leader');
  if (!name || name.trim().length < 2) throw errors.validation('name is required');
  if (!password || String(password).length < 6) {
    throw errors.validation('Password must be at least 6 characters');
  }

  if (await findUserByEmail(email)) {
    throw errors.conflict('An account with that email already exists — sign in instead');
  }
  if (await findUserByPhone(phone)) {
    throw errors.conflict('An account with that phone number already exists — sign in instead');
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const { rows } = await query(
    `INSERT INTO users (role, email, name, phone, password_hash, is_active)
     VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
    [role, email, name.trim(), phone, passwordHash],
  );
  return startSession(rows[0], userAgent);
}

/** Sign in with an email or phone number plus password. */
export async function login({ identifier, password, userAgent }) {
  const raw = String(identifier || '').trim();
  if (!raw) throw errors.validation('Enter your email or phone number');
  if (!password) throw errors.validation('Enter your password');

  const user = await findUserByIdentifier(raw);
  if (!user || !user.is_active || !user.password_hash) {
    await bcrypt.compare(String(password), DUMMY_HASH);
    throw errors.unauthorized('Incorrect email/phone or password');
  }

  const match = await bcrypt.compare(String(password), user.password_hash);
  if (!match) throw errors.unauthorized('Incorrect email/phone or password');

  return startSession(user, userAgent);
}

/**
 * Create a login session for a user: mark last_login_at, mint a refresh token,
 * and return { user, accessToken, refreshToken, refreshExpiresAt }.
 */
async function startSession(user, userAgent) {
  const tx = await withTransaction(async (client) => {
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

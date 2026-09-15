import { verifyAccessToken } from '../lib/jwt.js';
import { errors } from '../utils/response.js';
import { query } from '../db/pool.js';

/**
 * Require a valid access token. Attaches
 * `req.user` = { id, role, email, name }.
 *
 * The role is always resolved server-side, never trusted from the token — it
 * is read straight from the `users.role` column (one global role per user:
 * choir leader or choir member).
 */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw errors.unauthorized('Missing bearer token');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw errors.unauthorized('Invalid or expired token');
    }

    const { rows } = await query(
      'SELECT id, role, email, name, is_active FROM users WHERE id = $1',
      [payload.sub],
    );
    const user = rows[0];
    if (!user || !user.is_active) throw errors.unauthorized('Account not found or disabled');

    req.user = { id: user.id, role: user.role, email: user.email, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
}

/** Restrict a route to one or more roles. Use after requireAuth. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(errors.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(errors.forbidden(`This action requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}

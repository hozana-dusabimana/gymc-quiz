import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const disabled = env.isTest || process.env.DISABLE_RATE_LIMIT === 'true';

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disabled,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down.' },
    });
  },
};

/** Generous global limiter for the whole API. */
export const apiLimiter = rateLimit({ ...base, windowMs: 60_000, max: 300 });

/** Tight limiter for auth endpoints (OTP request / verify). Per-OTP attempt
 *  caps are the primary brute-force defence; this bounds request volume. */
export const authLimiter = rateLimit({ ...base, windowMs: 10 * 60_000, max: 40 });

/** Limiter for expensive AI endpoints. */
export const aiLimiter = rateLimit({ ...base, windowMs: 60_000, max: 30 });

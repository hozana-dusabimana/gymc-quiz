import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import * as S from '../services/serialize.js';

const router = Router();
router.use(requireAuth);

// GET /api/notifications
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id],
    );
    const unread = rows.filter((r) => !r.read).length;
    ok(res, { notifications: rows.map(S.notification), unreadCount: unread });
  }),
);

// POST /api/notifications/read-all
router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [req.user.id]);
    ok(res, { ok: true });
  }),
);

// POST /api/notifications/:id/read
router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    ok(res, { ok: true });
  }),
);

export default router;

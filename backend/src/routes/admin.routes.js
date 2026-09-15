import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createUserByAdmin, listStaffUsers } from '../services/auth.service.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/users — every leader/admin account
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    ok(res, { users: await listStaffUsers() });
  }),
);

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().min(6).max(40),
  password: z.string().min(6).max(200),
  role: z.enum(['leader', 'admin']),
});

// POST /api/admin/users — create a leader or admin account
router.post(
  '/users',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const user = await createUserByAdmin(req.body);
    ok(res, { user }, 201);
  }),
);

export default router;

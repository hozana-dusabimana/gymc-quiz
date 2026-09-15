import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, errors } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { getCourseOr404, getOwnedCourse, canViewCourse } from '../services/access.js';
import { createMaterial, deleteMaterial, processMaterial, refreshedDownloadUrl } from '../services/material.service.js';
import { generateQuestionsFromMaterial } from '../services/question.service.js';
import { getObjectBuffer } from '../lib/storage.js';
import * as S from '../services/serialize.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploads.maxBytes },
});

const withCounts = `m.*, (SELECT count(*) FROM questions q WHERE q.material_id = m.id) AS questions_generated`;

// GET /api/materials?courseId=...
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const courseId = req.query.courseId;
    if (!courseId) throw errors.badRequest('courseId query parameter is required');
    const course = await getCourseOr404(courseId);
    if (!(await canViewCourse(course, req.user))) throw errors.forbidden();
    const { rows } = await query(
      `SELECT ${withCounts} FROM materials m WHERE m.course_id = $1 ORDER BY m.created_at DESC`,
      [courseId],
    );
    ok(res, { materials: rows.map(S.material) });
  }),
);

// GET /api/materials/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(`SELECT ${withCounts} FROM materials m WHERE m.id = $1`, [req.params.id]);
    const material = rows[0];
    if (!material) throw errors.notFound('Material not found');
    const course = await getCourseOr404(material.course_id);
    if (!(await canViewCourse(course, req.user))) throw errors.forbidden();
    ok(res, { material: S.material(material) });
  }),
);

// GET /api/materials/:id/download  -> fresh signed URL
router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM materials m WHERE m.id = $1', [req.params.id]);
    const material = rows[0];
    if (!material) throw errors.notFound('Material not found');
    const course = await getCourseOr404(material.course_id);
    if (!(await canViewCourse(course, req.user))) throw errors.forbidden();
    ok(res, { url: await refreshedDownloadUrl(material), filename: material.filename });
  }),
);

// POST /api/materials  (leader, multipart: file, courseId, title?)
router.post(
  '/',
  requireRole('leader'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw errors.badRequest('No file uploaded (field name: file)');
    const courseId = req.body.courseId;
    if (!courseId) throw errors.badRequest('courseId is required');
    await getOwnedCourse(courseId, req.user.id);
    const material = await createMaterial({
      courseId,
      uploadedBy: req.user.id,
      file: req.file,
      title: req.body.title,
    });
    ok(res, { material: S.material(material) }, 201);
  }),
);

// POST /api/materials/:id/reprocess  (leader owner)
router.post(
  '/:id/reprocess',
  requireRole('leader'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
    const material = rows[0];
    if (!material) throw errors.notFound('Material not found');
    await getOwnedCourse(material.course_id, req.user.id);
    await query("UPDATE materials SET status='processing', error_message=NULL WHERE id=$1", [material.id]);
    const buffer = await getObjectBuffer(material.storage_key);
    processMaterial(material.id, buffer, material.file_type).catch(() => {});
    ok(res, { material: S.material({ ...material, status: 'processing' }) });
  }),
);

// POST /api/materials/:id/generate-questions  (leader owner)
router.post(
  '/:id/generate-questions',
  requireRole('leader'),
  aiLimiter,
  validate(
    z.object({
      count: z.coerce.number().int().min(1).max(10).default(5),
      difficulty: z.enum(['Easy', 'Medium', 'Hard', 'mixed']).default('mixed'),
      types: z.array(z.enum(['multiple_choice', 'true_false', 'short_answer'])).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
    const material = rows[0];
    if (!material) throw errors.notFound('Material not found');
    await getOwnedCourse(material.course_id, req.user.id);
    if (material.status !== 'ready') throw errors.badRequest('Material is still processing');

    const created = await generateQuestionsFromMaterial({
      material,
      createdBy: req.user.id,
      count: req.body.count,
      difficulty: req.body.difficulty,
      types: req.body.types,
    });
    ok(res, { questions: created }, 201);
  }),
);

// DELETE /api/materials/:id  (leader owner)
router.delete(
  '/:id',
  requireRole('leader'),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
    const material = rows[0];
    if (!material) throw errors.notFound('Material not found');
    await getOwnedCourse(material.course_id, req.user.id);
    await deleteMaterial(material.id);
    ok(res, { deleted: true });
  }),
);

export default router;

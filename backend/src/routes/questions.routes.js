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
import { getOwnedCourse } from '../services/access.js';
import {
  QUESTION_SELECT,
  createQuestion,
  updateQuestion,
  serializeQuestion,
  getQuestionFull,
} from '../services/question.service.js';
import { detectImportType, extractQuestionDrafts } from '../services/questionImport.service.js';
import * as S from '../services/serialize.js';

const router = Router();
router.use(requireAuth, requireRole('leader'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploads.maxBytes },
});

const baseSchema = z.object({
  courseId: z.string().uuid(),
  type: z.enum(['multiple_choice', 'true_false', 'short_answer']),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
  questionText: z.string().min(5).max(4000),
  options: z.array(z.string().max(600)).max(8).optional(),
  correctAnswer: z.string().max(2000).default(''),
  markingGuidance: z.string().max(2000).optional().default(''),
  explanation: z.string().max(4000).optional().default(''),
  marks: z.coerce.number().int().min(1).max(20).default(1),
  materialId: z.string().uuid().nullable().optional(),
  materialPage: z.coerce.number().int().positive().nullable().optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
});

async function assertOwnsQuestion(questionId, leaderId) {
  const full = await getQuestionFull(questionId);
  if (!full) throw errors.notFound('Question not found');
  await getOwnedCourse(full.row.course_id, leaderId);
  return full;
}

// GET /api/questions?courseId=&type=&difficulty=&search=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { courseId, type, difficulty, search, materialId } = req.query;
    const where = ['c.leader_id = $1'];
    const params = [req.user.id];
    if (courseId) {
      params.push(courseId);
      where.push(`q.course_id = $${params.length}`);
    }
    if (type) {
      params.push(type);
      where.push(`q.type = $${params.length}`);
    }
    if (difficulty) {
      params.push(difficulty);
      where.push(`q.difficulty = $${params.length}`);
    }
    if (materialId) {
      params.push(materialId);
      where.push(`q.material_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(q.question_text ILIKE $${params.length} OR q.explanation ILIKE $${params.length})`);
    }
    const { rows } = await query(
      `${QUESTION_SELECT} WHERE ${where.join(' AND ')} ORDER BY q.created_at DESC LIMIT 500`,
      params,
    );
    const withOptions = await Promise.all(
      rows.map(async (r) => {
        const opts = await query(
          'SELECT * FROM question_options WHERE question_id = $1 ORDER BY position',
          [r.id],
        );
        return S.question(r, opts.rows);
      }),
    );
    ok(res, { questions: withOptions });
  }),
);

const importDraftSchema = z.object({
  type: z.enum(['multiple_choice', 'true_false', 'short_answer']),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
  questionText: z.string().min(5).max(4000),
  options: z.array(z.string().max(600)).max(8).optional(),
  correctAnswer: z.string().max(2000).default(''),
  markingGuidance: z.string().max(2000).optional().default(''),
  explanation: z.string().max(4000).optional().default(''),
  marks: z.coerce.number().int().min(1).max(20).default(1),
});

// POST /api/questions/import/parse
// multipart (field: file) OR JSON { text }. Reads the document with the AI and
// returns unsaved question drafts for the leader to review.
router.post(
  '/import/parse',
  aiLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const hint = (req.body?.hint || '').toString().slice(0, 400);
    const text = (req.body?.text || '').toString();

    if (!req.file && !text.trim()) {
      throw errors.badRequest('Attach a file (field: file) or provide text to import.');
    }

    const result = req.file
      ? await extractQuestionDrafts({
          buffer: req.file.buffer,
          fileType: detectImportType(req.file.originalname, req.file.mimetype),
          filename: req.file.originalname,
          hint,
        })
      : await extractQuestionDrafts({ text, hint });

    ok(res, result);
  }),
);

// POST /api/questions/import/commit  — persist the reviewed drafts
router.post(
  '/import/commit',
  validate(
    z.object({
      courseId: z.string().uuid(),
      materialId: z.string().uuid().nullable().optional(),
      drafts: z.array(importDraftSchema).min(1).max(200),
    }),
  ),
  asyncHandler(async (req, res) => {
    await getOwnedCourse(req.body.courseId, req.user.id);
    const created = [];
    const skipped = [];
    for (let i = 0; i < req.body.drafts.length; i++) {
      const d = req.body.drafts[i];
      try {
        const id = await createQuestion({
          courseId: req.body.courseId,
          createdBy: req.user.id,
          aiGenerated: true,
          body: {
            ...d,
            materialId: req.body.materialId || null,
            tags: ['Imported'],
          },
        });
        created.push(await serializeQuestion(id));
      } catch (err) {
        skipped.push({ index: i, questionText: d.questionText, reason: err.message || 'Invalid question' });
      }
    }
    ok(res, { created, skipped, importedCount: created.length }, 201);
  }),
);

// GET /api/questions/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertOwnsQuestion(req.params.id, req.user.id);
    ok(res, { question: await serializeQuestion(req.params.id) });
  }),
);

// POST /api/questions
router.post(
  '/',
  validate(baseSchema),
  asyncHandler(async (req, res) => {
    await getOwnedCourse(req.body.courseId, req.user.id);
    const id = await createQuestion({ courseId: req.body.courseId, createdBy: req.user.id, body: req.body });
    ok(res, { question: await serializeQuestion(id) }, 201);
  }),
);

// PATCH /api/questions/:id
router.patch(
  '/:id',
  validate(baseSchema.partial()),
  asyncHandler(async (req, res) => {
    await assertOwnsQuestion(req.params.id, req.user.id);
    ok(res, { question: await updateQuestion(req.params.id, req.body) });
  }),
);

// DELETE /api/questions/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const full = await assertOwnsQuestion(req.params.id, req.user.id);
    const used = await query('SELECT count(*)::int AS n FROM quiz_questions WHERE question_id = $1', [
      full.row.id,
    ]);
    if (used.rows[0].n > 0) {
      throw errors.conflict('This question is used in a quiz — remove it from the quiz first');
    }
    await query('DELETE FROM questions WHERE id = $1', [full.row.id]);
    ok(res, { deleted: true });
  }),
);

export default router;

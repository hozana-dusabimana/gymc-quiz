import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, errors } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { query } from '../db/pool.js';
import { getOwnedCourse } from '../services/access.js';
import {
  startAttempt,
  getAttemptForMember,
  getAttemptRow,
  saveAnswers,
  submitAttempt,
  getEvaluations,
} from '../services/attempt.service.js';
import { getQuizRow } from '../services/quiz.service.js';
import * as S from '../services/serialize.js';

const router = Router();
router.use(requireAuth);

// GET /api/attempts/mine  (member history)
router.get(
  '/mine',
  requireRole('member'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT a.*, z.title AS quiz_title, c.code AS course_code
         FROM quiz_attempts a
         JOIN quizzes z ON z.id = a.quiz_id
         JOIN courses c ON c.id = z.course_id
        WHERE a.member_id = $1
        ORDER BY a.started_at DESC`,
      [req.user.id],
    );
    ok(res, { attempts: rows.map((r) => S.attempt(r)) });
  }),
);

// GET /api/attempts?quizId=  (leader, own quiz) — submissions table
router.get(
  '/',
  requireRole('leader'),
  asyncHandler(async (req, res) => {
    const quizId = req.query.quizId;
    if (!quizId) throw errors.badRequest('quizId query parameter is required');
    const quiz = await getQuizRow(quizId);
    if (!quiz) throw errors.notFound('Quiz not found');
    await getOwnedCourse(quiz.course_id, req.user.id);
    const { rows } = await query(
      `SELECT a.*, z.title AS quiz_title, c.code AS course_code,
              u.name AS member_name, u.email AS member_email, u.member_number
         FROM quiz_attempts a
         JOIN quizzes z ON z.id = a.quiz_id
         JOIN courses c ON c.id = z.course_id
         JOIN users u ON u.id = a.member_id
        WHERE a.quiz_id = $1
        ORDER BY a.submitted_at DESC NULLS LAST, a.started_at DESC`,
      [quizId],
    );
    ok(res, { attempts: rows.map((r) => S.attempt(r)) });
  }),
);

// POST /api/attempts  { quizId }  (member)
router.post(
  '/',
  requireRole('member'),
  validate(z.object({ quizId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    const view = await startAttempt({ quizId: req.body.quizId, member: req.user });
    ok(res, view, 201);
  }),
);

// GET /api/attempts/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = await getAttemptRow(req.params.id);
    if (!row) throw errors.notFound('Attempt not found');
    if (req.user.role === 'member') {
      return ok(res, await getAttemptForMember(req.params.id, req.user.id));
    }
    await getOwnedCourse(row.course_id, req.user.id);
    ok(res, {
      attempt: S.attempt(row),
      quiz: S.quiz(await getQuizRow(row.quiz_id)),
      evaluations: await getEvaluations(row.id),
    });
  }),
);

// PUT /api/attempts/:id/answers  { answers: [...] }  (member)
router.put(
  '/:id/answers',
  requireRole('member'),
  validate(
    z.object({
      answers: z
        .array(
          z.object({
            questionId: z.string().uuid(),
            answerText: z.string().max(8000).optional(),
            optionId: z.string().uuid().optional(),
            optionContent: z.string().max(600).optional(),
          }),
        )
        .max(200),
    }),
  ),
  asyncHandler(async (req, res) => {
    ok(res, await saveAnswers({ attemptId: req.params.id, memberId: req.user.id, answers: req.body.answers }));
  }),
);

// POST /api/attempts/:id/submit  (member)
router.post(
  '/:id/submit',
  requireRole('member'),
  aiLimiter,
  validate(z.object({ timeSpentSeconds: z.coerce.number().int().min(0).max(86_400).optional() }).default({})),
  asyncHandler(async (req, res) => {
    const view = await submitAttempt({
      attemptId: req.params.id,
      memberId: req.user.id,
      timeSpentSeconds: req.body.timeSpentSeconds,
    });
    ok(res, view);
  }),
);

export default router;

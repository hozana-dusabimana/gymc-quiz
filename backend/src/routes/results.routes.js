import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, errors } from '../utils/response.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { getOwnedCourse } from '../services/access.js';
import { getAttemptForMember, getAttemptRow, getEvaluations } from '../services/attempt.service.js';
import { getQuizRow } from '../services/quiz.service.js';
import * as S from '../services/serialize.js';

const router = Router();
router.use(requireAuth);

// GET /api/results/mine  — completed attempts for the member dashboard / history
router.get(
  '/mine',
  requireRole('member'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT a.*, z.title AS quiz_title, z.passing_score, c.code AS course_code, c.title AS course_title
         FROM quiz_attempts a
         JOIN quizzes z ON z.id = a.quiz_id
         JOIN courses c ON c.id = z.course_id
        WHERE a.member_id = $1 AND a.status = 'completed'
        ORDER BY a.completed_at DESC`,
      [req.user.id],
    );
    ok(res, {
      results: rows.map((r) => ({
        ...S.attempt(r),
        passingScore: Number(r.passing_score),
        courseTitle: r.course_title,
        passed: r.percentage != null ? Number(r.percentage) >= Number(r.passing_score) : null,
      })),
    });
  }),
);

// GET /api/results/:attemptId — full diagnostic review
router.get(
  '/:attemptId',
  asyncHandler(async (req, res) => {
    const row = await getAttemptRow(req.params.attemptId);
    if (!row) throw errors.notFound('Result not found');

    if (req.user.role === 'member') {
      const view = await getAttemptForMember(req.params.attemptId, req.user.id);
      if (view.attempt.status !== 'completed') throw errors.badRequest('This attempt is not yet graded');
      return ok(res, view);
    }

    await getOwnedCourse(row.course_id, req.user.id);
    ok(res, {
      attempt: S.attempt(row),
      quiz: S.quiz(await getQuizRow(row.quiz_id)),
      evaluations: await getEvaluations(row.id),
    });
  }),
);

export default router;

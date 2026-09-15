import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, errors } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { getCourseOr404, getOwnedCourse, assertEnrolled } from '../services/access.js';
import {
  QUIZ_SELECT,
  getQuizRow,
  getQuizQuestions,
  setQuizQuestions,
  redactQuestion,
  quizWindowState,
} from '../services/quiz.service.js';
import { notifyCourseMembers } from '../services/notification.service.js';
import * as S from '../services/serialize.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional().default(''),
  durationMinutes: z.coerce.number().int().min(1).max(600).default(30),
  passingScore: z.coerce.number().int().min(0).max(100).default(50),
  opensAt: z.string().datetime().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  randomizeOrder: z.boolean().default(false),
  showInstantFeedback: z.boolean().default(false),
  attemptsAllowed: z.coerce.number().int().min(1).max(99).default(1),
  questionIds: z.array(z.string().uuid()).max(100).optional().default([]),
});

// GET /api/quizzes?courseId=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const courseId = req.query.courseId;

    if (req.user.role === 'leader') {
      const params = [req.user.id];
      let sql = `${QUIZ_SELECT} WHERE c.leader_id = $1`;
      if (courseId) {
        params.push(courseId);
        sql += ` AND z.course_id = $${params.length}`;
      }
      sql += ' ORDER BY z.created_at DESC';
      const { rows } = await query(sql, params);
      return ok(res, { quizzes: rows.map((r) => S.quiz(r)) });
    }

    // member: published quizzes for enrolled courses
    const params = [req.user.id];
    let sql = `${QUIZ_SELECT}
       JOIN enrollments e ON e.course_id = z.course_id AND e.member_id = $1
      WHERE z.status IN ('published','closed')`;
    if (courseId) {
      params.push(courseId);
      sql += ` AND z.course_id = $${params.length}`;
    }
    sql += ' ORDER BY z.deadline NULLS LAST, z.created_at DESC';
    const { rows } = await query(sql, params);

    const quizzes = [];
    for (const r of rows) {
      const attempts = await query(
        `SELECT * FROM quiz_attempts WHERE quiz_id = $1 AND member_id = $2 ORDER BY attempt_number DESC`,
        [r.id, req.user.id],
      );
      const completed = attempts.rows.filter((a) => a.status === 'completed');
      const inProgress = attempts.rows.find((a) => a.status === 'in_progress');
      const state = quizWindowState(r);
      quizzes.push(
        S.quiz(r, {
          myAttempts: attempts.rows.length,
          attemptsRemaining: Math.max(0, r.attempts_allowed - attempts.rows.length),
          lastAttempt: attempts.rows[0]
            ? S.attempt(attempts.rows[0])
            : null,
          availability: {
            open: state.open && (inProgress || r.attempts_allowed - attempts.rows.length > 0),
            reason: !state.open
              ? state.reason
              : r.attempts_allowed - attempts.rows.length <= 0 && !inProgress
                ? 'No attempts remaining'
                : null,
            hasInProgress: Boolean(inProgress),
            completedCount: completed.length,
          },
        }),
      );
    }
    ok(res, { quizzes });
  }),
);

// POST /api/quizzes (leader)
router.post(
  '/',
  requireRole('leader'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    await getOwnedCourse(b.courseId, req.user.id);
    const { rows } = await query(
      `INSERT INTO quizzes
        (course_id, created_by, title, description, duration_minutes, passing_score, opens_at, deadline,
         randomize_order, show_instant_feedback, attempts_allowed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        b.courseId, req.user.id, b.title, b.description, b.durationMinutes, b.passingScore,
        b.opensAt || null, b.deadline || null, b.randomizeOrder, b.showInstantFeedback, b.attemptsAllowed,
      ],
    );
    const id = rows[0].id;
    if (b.questionIds.length) {
      await setQuizQuestions(id, b.questionIds.map((questionId) => ({ questionId })));
    }
    const quiz = await getQuizRow(id);
    ok(res, { quiz: S.quiz(quiz), questions: await getQuizQuestions(id) }, 201);
  }),
);

// GET /api/quizzes/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const quiz = await getQuizRow(req.params.id);
    if (!quiz) throw errors.notFound('Quiz not found');
    const course = await getCourseOr404(quiz.course_id);

    if (req.user.role === 'leader') {
      if (course.leader_id !== req.user.id) throw errors.forbidden();
      return ok(res, { quiz: S.quiz(quiz), questions: await getQuizQuestions(quiz.id) });
    }

    await assertEnrolled(quiz.course_id, req.user.id);
    if (!['published', 'closed'].includes(quiz.status)) throw errors.forbidden('Quiz not available');
    const state = quizWindowState(quiz);
    const questions = await getQuizQuestions(quiz.id);
    ok(res, {
      quiz: S.quiz(quiz),
      questions: questions.map(redactQuestion),
      availability: state,
    });
  }),
);

const updateSchema = createSchema.partial().omit({ courseId: true, questionIds: true });

// PATCH /api/quizzes/:id (owner)
router.patch(
  '/:id',
  requireRole('leader'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const quiz = await getQuizRow(req.params.id);
    if (!quiz) throw errors.notFound('Quiz not found');
    await getOwnedCourse(quiz.course_id, req.user.id);

    const map = {
      title: 'title', description: 'description', durationMinutes: 'duration_minutes',
      passingScore: 'passing_score', opensAt: 'opens_at', deadline: 'deadline',
      randomizeOrder: 'randomize_order', showInstantFeedback: 'show_instant_feedback',
      attemptsAllowed: 'attempts_allowed',
    };
    const sets = [];
    const vals = [];
    for (const [k, col] of Object.entries(map)) {
      if (req.body[k] !== undefined) {
        vals.push(req.body[k]);
        sets.push(`${col} = $${vals.length}`);
      }
    }
    if (!sets.length) throw errors.badRequest('No fields to update');
    vals.push(quiz.id);
    await query(`UPDATE quizzes SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    ok(res, { quiz: S.quiz(await getQuizRow(quiz.id)) });
  }),
);

// PUT /api/quizzes/:id/questions (owner)
router.put(
  '/:id/questions',
  requireRole('leader'),
  validate(
    z.object({
      questions: z
        .array(
          z.object({
            questionId: z.string().uuid(),
            marksOverride: z.coerce.number().int().min(1).max(20).nullable().optional(),
          }),
        )
        .max(100),
    }),
  ),
  asyncHandler(async (req, res) => {
    const quiz = await getQuizRow(req.params.id);
    if (!quiz) throw errors.notFound('Quiz not found');
    await getOwnedCourse(quiz.course_id, req.user.id);
    await setQuizQuestions(quiz.id, req.body.questions);
    ok(res, { quiz: S.quiz(await getQuizRow(quiz.id)), questions: await getQuizQuestions(quiz.id) });
  }),
);

// POST /api/quizzes/:id/publish (owner)
router.post(
  '/:id/publish',
  requireRole('leader'),
  asyncHandler(async (req, res) => {
    const quiz = await getQuizRow(req.params.id);
    if (!quiz) throw errors.notFound('Quiz not found');
    await getOwnedCourse(quiz.course_id, req.user.id);
    if (Number(quiz.question_count) === 0) throw errors.badRequest('Add at least one question before publishing');
    await query(
      "UPDATE quizzes SET status='published', published_at = COALESCE(published_at, now()) WHERE id = $1",
      [quiz.id],
    );
    await notifyCourseMembers(quiz.course_id, {
      title: `New quiz: ${quiz.title}`,
      message: `${quiz.course_code} — ${quiz.title} is now open${quiz.deadline ? `. Due ${new Date(quiz.deadline).toLocaleString()}` : ''}.`,
      type: 'quiz',
      linkTarget: `/member/quizzes/${quiz.id}`,
    });
    ok(res, { quiz: S.quiz(await getQuizRow(quiz.id)) });
  }),
);

// POST /api/quizzes/:id/close (owner)
router.post(
  '/:id/close',
  requireRole('leader'),
  asyncHandler(async (req, res) => {
    const quiz = await getQuizRow(req.params.id);
    if (!quiz) throw errors.notFound('Quiz not found');
    await getOwnedCourse(quiz.course_id, req.user.id);
    await query("UPDATE quizzes SET status='closed' WHERE id = $1", [quiz.id]);
    ok(res, { quiz: S.quiz(await getQuizRow(quiz.id)) });
  }),
);

// DELETE /api/quizzes/:id (owner)
router.delete(
  '/:id',
  requireRole('leader'),
  asyncHandler(async (req, res) => {
    const quiz = await getQuizRow(req.params.id);
    if (!quiz) throw errors.notFound('Quiz not found');
    await getOwnedCourse(quiz.course_id, req.user.id);
    const done = await query(
      "SELECT count(*)::int n FROM quiz_attempts WHERE quiz_id = $1 AND status IN ('completed','submitted','evaluating')",
      [quiz.id],
    );
    if (done.rows[0].n > 0) throw errors.conflict('Members have already attempted this quiz — close it instead');
    await query('DELETE FROM quizzes WHERE id = $1', [quiz.id]);
    ok(res, { deleted: true });
  }),
);

export default router;

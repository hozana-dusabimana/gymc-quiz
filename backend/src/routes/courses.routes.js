import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, errors } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { getCourseOr404, getOwnedCourse, canViewCourse } from '../services/access.js';
import * as S from '../services/serialize.js';

const router = Router();
router.use(requireAuth);

const COURSE_COUNTS = `
  (SELECT count(*) FROM enrollments e WHERE e.course_id = c.id)                      AS member_count,
  (SELECT count(*) FROM materials m WHERE m.course_id = c.id)                        AS materials_count,
  (SELECT count(*) FROM questions q WHERE q.course_id = c.id)                        AS questions_count,
  (SELECT count(*) FROM quizzes z WHERE z.course_id = c.id AND z.status = 'published') AS active_quizzes_count,
  (SELECT round(avg(a.percentage)::numeric, 1) FROM quiz_attempts a
     JOIN quizzes z ON z.id = a.quiz_id
    WHERE z.course_id = c.id AND a.status = 'completed')                             AS average_score`;

// GET /api/courses
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'leader') {
      const { rows } = await query(
        `SELECT c.*, u.name AS instructor_name, u.avatar_url AS instructor_avatar, ${COURSE_COUNTS}
           FROM courses c JOIN users u ON u.id = c.leader_id
          WHERE c.leader_id = $1
          ORDER BY c.created_at DESC`,
        [req.user.id],
      );
      return ok(res, { courses: rows.map((r) => S.course(r)) });
    }
    const { rows } = await query(
      `SELECT c.*, u.name AS instructor_name, u.avatar_url AS instructor_avatar, ${COURSE_COUNTS}
         FROM courses c
         JOIN enrollments e ON e.course_id = c.id AND e.member_id = $1
         JOIN users u ON u.id = c.leader_id
        ORDER BY c.created_at DESC`,
      [req.user.id],
    );
    ok(res, { courses: rows.map((r) => S.course(r, { enrolled: true })) });
  }),
);

const createSchema = z.object({
  code: z.string().min(2).max(30),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional().default(''),
  department: z.string().max(120).optional().default(''),
  term: z.string().max(60).optional().default(''),
  schedule: z.string().max(200).optional().default(''),
  room: z.string().max(120).optional().default(''),
  color: z.string().max(80).optional(),
});

// POST /api/courses  (leader)
router.post(
  '/',
  requireRole('leader'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;

    const dup = await query(
      'SELECT 1 FROM courses WHERE leader_id = $1 AND lower(code) = lower($2)',
      [req.user.id, b.code],
    );
    if (dup.rows[0]) throw errors.conflict('You already have a course with that code');

    const { rows } = await query(
      `INSERT INTO courses (code, title, description, department, term, schedule, room, color, leader_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8,'from-blue-600 to-indigo-700'), $9)
       RETURNING *`,
      [b.code, b.title, b.description, b.department, b.term, b.schedule, b.room, b.color || null, req.user.id],
    );
    ok(res, { course: S.course(rows[0], { instructorName: req.user.name }) }, 201);
  }),
);

// GET /api/courses/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const course = await getCourseOr404(req.params.id);
    if (!(await canViewCourse(course, req.user))) throw errors.forbidden();
    const { rows } = await query(
      `SELECT c.*, u.name AS instructor_name, u.avatar_url AS instructor_avatar, ${COURSE_COUNTS}
         FROM courses c JOIN users u ON u.id = c.leader_id WHERE c.id = $1`,
      [course.id],
    );
    ok(res, { course: S.course(rows[0]) });
  }),
);

const updateSchema = createSchema.partial();

// PATCH /api/courses/:id  (owner)
router.patch(
  '/:id',
  requireRole('leader'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    await getOwnedCourse(req.params.id, req.user.id);
    const fields = [];
    const values = [];
    for (const [k, v] of Object.entries(req.body)) {
      fields.push(`${k} = $${fields.length + 1}`);
      values.push(v);
    }
    if (!fields.length) throw errors.badRequest('No fields to update');
    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE courses SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    ok(res, { course: S.course(rows[0]) });
  }),
);

// DELETE /api/courses/:id  (owner)
router.delete(
  '/:id',
  requireRole('leader'),
  asyncHandler(async (req, res) => {
    await getOwnedCourse(req.params.id, req.user.id);
    await query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    ok(res, { deleted: true });
  }),
);

// GET /api/courses/:id/members  (owner)
router.get(
  '/:id/members',
  requireRole('leader'),
  asyncHandler(async (req, res) => {
    await getOwnedCourse(req.params.id, req.user.id);
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.member_number, u.phone, e.created_at AS enrolled_at,
              (SELECT round(avg(a.percentage)::numeric,1) FROM quiz_attempts a
                 JOIN quizzes z ON z.id = a.quiz_id
                WHERE z.course_id = $1 AND a.member_id = u.id AND a.status='completed') AS average_score,
              (SELECT count(*) FROM quiz_attempts a
                 JOIN quizzes z ON z.id = a.quiz_id
                WHERE z.course_id = $1 AND a.member_id = u.id AND a.status='completed') AS attempts_count
         FROM enrollments e JOIN users u ON u.id = e.member_id
        WHERE e.course_id = $1
        ORDER BY u.name`,
      [req.params.id],
    );
    ok(res, {
      members: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        memberNumber: r.member_number,
        phone: r.phone,
        enrolledAt: r.enrolled_at,
        averageScore: r.average_score != null ? Number(r.average_score) : null,
        attemptsCount: Number(r.attempts_count),
      })),
    });
  }),
);

// POST /api/courses/:id/enroll  (owner) { email }
router.post(
  '/:id/enroll',
  requireRole('leader'),
  validate(z.object({ email: z.string().email() })),
  asyncHandler(async (req, res) => {
    await getOwnedCourse(req.params.id, req.user.id);
    const { rows } = await query(
      "SELECT id, role FROM users WHERE lower(email) = lower($1)",
      [req.body.email],
    );
    const member = rows[0];
    if (!member) throw errors.notFound('No user with that email — they must register first');
    if (member.role !== 'member') throw errors.badRequest('That account is not a member');
    await query(
      `INSERT INTO enrollments (course_id, member_id, source) VALUES ($1, $2, 'manual')
       ON CONFLICT (course_id, member_id) DO NOTHING`,
      [req.params.id, member.id],
    );
    ok(res, { enrolled: true }, 201);
  }),
);

// DELETE /api/courses/:id/members/:memberId  (owner)
router.delete(
  '/:id/members/:memberId',
  requireRole('leader'),
  asyncHandler(async (req, res) => {
    await getOwnedCourse(req.params.id, req.user.id);
    await query('DELETE FROM enrollments WHERE course_id = $1 AND member_id = $2', [
      req.params.id,
      req.params.memberId,
    ]);
    ok(res, { removed: true });
  }),
);

// GET /api/courses/:id/analytics  (owner)
router.get(
  '/:id/analytics',
  requireRole('leader'),
  asyncHandler(async (req, res) => {
    await getOwnedCourse(req.params.id, req.user.id);
    const { rows: q } = await query(
      `SELECT z.id, z.title, z.status,
              count(a.*) FILTER (WHERE a.status='completed') AS submissions,
              round(avg(a.percentage) FILTER (WHERE a.status='completed')::numeric,1) AS avg_pct
         FROM quizzes z LEFT JOIN quiz_attempts a ON a.quiz_id = z.id
        WHERE z.course_id = $1
        GROUP BY z.id ORDER BY z.created_at DESC`,
      [req.params.id],
    );
    const { rows: dist } = await query(
      `SELECT
         count(*) FILTER (WHERE percentage >= 90) AS a_band,
         count(*) FILTER (WHERE percentage >= 75 AND percentage < 90) AS b_band,
         count(*) FILTER (WHERE percentage >= 60 AND percentage < 75) AS c_band,
         count(*) FILTER (WHERE percentage < 60) AS d_band,
         round(avg(percentage)::numeric,1) AS avg_pct,
         max(percentage) AS max_pct, min(percentage) AS min_pct, count(*) AS total
       FROM quiz_attempts a JOIN quizzes z ON z.id = a.quiz_id
      WHERE z.course_id = $1 AND a.status = 'completed'`,
      [req.params.id],
    );
    ok(res, {
      quizzes: q.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        submissions: Number(r.submissions),
        averageScore: r.avg_pct != null ? Number(r.avg_pct) : null,
      })),
      distribution: {
        a: Number(dist[0].a_band),
        b: Number(dist[0].b_band),
        c: Number(dist[0].c_band),
        d: Number(dist[0].d_band),
        total: Number(dist[0].total),
        averageScore: dist[0].avg_pct != null ? Number(dist[0].avg_pct) : null,
        highest: dist[0].max_pct != null ? Number(dist[0].max_pct) : null,
        lowest: dist[0].min_pct != null ? Number(dist[0].min_pct) : null,
      },
    });
  }),
);

export default router;

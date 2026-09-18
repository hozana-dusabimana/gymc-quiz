import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, errors } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { publicUser, findUserById, updateUser } from '../services/auth.service.js';
import {
  performanceIndex,
  streakLabel,
  computeStreak,
  cohortPercentile,
  attemptTrend,
} from '../services/metrics.service.js';

const router = Router();
router.use(requireAuth);

// GET /api/users/me
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = publicUser(await findUserById(req.user.id));
    ok(res, { user: { ...user, role: req.user.role } });
  }),
);

const profileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  prefix: z.string().max(20).nullable().optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});

// PATCH /api/users/me
router.patch(
  '/me',
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const map = { name: 'name', phone: 'phone', prefix: 'prefix', avatarUrl: 'avatar_url' };
    const sets = [];
    const vals = [];
    for (const [k, col] of Object.entries(map)) {
      if (req.body[k] !== undefined) {
        vals.push(req.body[k]);
        sets.push(`${col} = $${vals.length}`);
      }
    }
    if (sets.length) {
      vals.push(req.user.id);
      await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    }
    const user = publicUser(await findUserById(req.user.id));
    ok(res, { user: { ...user, role: req.user.role } });
  }),
);

// GET /api/users/me/stats — dashboard metric cards
router.get(
  '/me/stats',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'member') {
      const { rows } = await query(
        `SELECT
           (SELECT count(*) FROM enrollments WHERE member_id = $1) AS courses,
           (SELECT count(*) FROM quiz_attempts WHERE member_id = $1 AND status='completed') AS quizzes_taken,
           (SELECT round(avg(percentage)::numeric,1) FROM quiz_attempts WHERE member_id = $1 AND status='completed') AS avg_score,
           (SELECT count(*) FROM quiz_attempts a JOIN quizzes z ON z.id=a.quiz_id
             JOIN enrollments e ON e.course_id=z.course_id AND e.member_id=$1
            WHERE z.status='published') AS available_quizzes,
           (SELECT count(DISTINCT z.id) FROM quizzes z
             JOIN enrollments e ON e.course_id=z.course_id AND e.member_id=$1
            WHERE z.status='published') AS assigned_quizzes,
           (SELECT count(DISTINCT a.quiz_id) FROM quiz_attempts a
            WHERE a.member_id=$1 AND a.status='completed') AS quizzes_completed_distinct,
           (SELECT mode() WITHIN GROUP (ORDER BY NULLIF(c.department,''))
              FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.member_id=$1) AS department,
           (SELECT mode() WITHIN GROUP (ORDER BY NULLIF(c.term,''))
              FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.member_id=$1) AS term,
           (SELECT round(avg(z.passing_score)::numeric,0) FROM quizzes z
             JOIN enrollments e ON e.course_id=z.course_id AND e.member_id=$1
            WHERE z.status IN ('published','closed')) AS mean_passing`,
        [req.user.id],
      );
      const s = rows[0];
      const avg = s.avg_score != null ? Number(s.avg_score) : null;
      const assigned = Number(s.assigned_quizzes);
      const [streakDays, cohort, avgTrend, countTrend] = await Promise.all([
        computeStreak(req.user.id),
        cohortPercentile(req.user.id),
        attemptTrend({ agg: 'avg', where: 'WHERE a.member_id = $1 AND a.status = $2', params: [req.user.id, 'completed'] }),
        attemptTrend({ agg: 'count', where: 'WHERE a.member_id = $1 AND a.status = $2', params: [req.user.id, 'completed'] }),
      ]);
      const meanPassing = s.mean_passing != null ? Number(s.mean_passing) : 50;
      return ok(res, {
        stats: {
          courses: Number(s.courses),
          quizzesTaken: Number(s.quizzes_taken),
          averageScore: avg,
          availableQuizzes: Number(s.available_quizzes),
          completionRate:
            assigned > 0 ? Math.round((Number(s.quizzes_completed_distinct) / assigned) * 100) : null,
          performanceIndex: performanceIndex(avg),
          cohortPercentile: cohort,
          streakDays,
          streakLabel: streakLabel(streakDays),
          department: s.department || null,
          term: s.term || null,
          standing: avg == null ? 'New' : avg >= meanPassing ? 'Good standing' : 'Needs attention',
          trends: { averageScore: avgTrend, quizzesTaken: countTrend },
        },
      });
    }
    const { rows } = await query(
      `SELECT
         (SELECT count(*) FROM courses WHERE leader_id = $1) AS courses,
         (SELECT count(*) FROM quizzes z JOIN courses c ON c.id=z.course_id
           WHERE c.leader_id=$1 AND z.status='published') AS active_quizzes,
         (SELECT count(*) FROM quizzes z JOIN courses c ON c.id=z.course_id
           WHERE c.leader_id=$1 AND z.status='published' AND z.deadline IS NOT NULL
             AND z.deadline BETWEEN now() AND now() + interval '48 hours') AS closing_soon,
         (SELECT count(DISTINCT e.member_id) FROM enrollments e JOIN courses c ON c.id=e.course_id
           WHERE c.leader_id=$1) AS members,
         (SELECT count(*) FROM enrollments e JOIN courses c ON c.id=e.course_id
           WHERE c.leader_id=$1 AND e.created_at >= now() - interval '7 days') AS joined_week,
         (SELECT round(avg(a.percentage)::numeric,1) FROM quiz_attempts a
           JOIN quizzes z ON z.id=a.quiz_id JOIN courses c ON c.id=z.course_id
          WHERE c.leader_id=$1 AND a.status='completed') AS avg_score,
         (SELECT mode() WITHIN GROUP (ORDER BY NULLIF(c.department,''))
            FROM courses c WHERE c.leader_id=$1) AS department`,
      [req.user.id],
    );
    const s = rows[0];
    const avgTrend = await attemptTrend({
      agg: 'avg',
      where:
        'JOIN quizzes z ON z.id = a.quiz_id JOIN courses c ON c.id = z.course_id WHERE c.leader_id = $1 AND a.status = $2',
      params: [req.user.id, 'completed'],
    });
    ok(res, {
      stats: {
        courses: Number(s.courses),
        activeQuizzes: Number(s.active_quizzes),
        quizzesClosingSoon: Number(s.closing_soon),
        members: Number(s.members),
        membersJoinedThisWeek: Number(s.joined_week),
        averageScore: s.avg_score != null ? Number(s.avg_score) : null,
        department: s.department || null,
        trends: { averageScore: avgTrend },
      },
    });
  }),
);

// GET /api/users/members — every account, with enrolment/attempt stats
// (leader/admin). A leader only sees choir members; an admin sees everyone,
// including other leaders and admins, since they alone may change roles.
router.get(
  '/members',
  requireRole('leader', 'admin'),
  asyncHandler(async (req, res) => {
    const scope = req.user.role === 'admin' ? '' : "WHERE u.role = 'member'";
    const { rows } = await query(
      `SELECT u.*,
              (SELECT count(*) FROM enrollments e WHERE e.member_id = u.id) AS courses_count,
              (SELECT count(*) FROM quiz_attempts a WHERE a.member_id = u.id AND a.status = 'completed') AS quizzes_taken,
              (SELECT round(avg(a.percentage)::numeric, 1) FROM quiz_attempts a
                WHERE a.member_id = u.id AND a.status = 'completed') AS avg_score
         FROM users u
         ${scope}
        ORDER BY u.created_at DESC`,
    );
    ok(res, {
      members: rows.map((r) => ({
        ...publicUser(r),
        coursesCount: Number(r.courses_count),
        quizzesTaken: Number(r.quizzes_taken),
        averageScore: r.avg_score != null ? Number(r.avg_score) : null,
      })),
    });
  }),
);

// GET /api/users/members/:id — full detail for one account (leader/admin).
// A leader is limited to members; an admin can open anyone.
router.get(
  '/members/:id',
  requireRole('leader', 'admin'),
  asyncHandler(async (req, res) => {
    const target = await findUserById(req.params.id);
    if (!target) throw errors.notFound('Member not found');
    if (target.role !== 'member' && req.user.role !== 'admin') throw errors.notFound('Member not found');
    const { rows } = await query(
      `SELECT c.id, c.code, c.title, e.created_at AS enrolled_at,
              (SELECT round(avg(a.percentage)::numeric, 1) FROM quiz_attempts a
                 JOIN quizzes z ON z.id = a.quiz_id
                WHERE z.course_id = c.id AND a.member_id = $1 AND a.status = 'completed') AS avg_score
         FROM enrollments e JOIN courses c ON c.id = e.course_id
        WHERE e.member_id = $1
        ORDER BY e.created_at DESC`,
      [req.params.id],
    );
    ok(res, {
      member: publicUser(target),
      courses: rows.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        enrolledAt: r.enrolled_at,
        averageScore: r.avg_score != null ? Number(r.avg_score) : null,
      })),
    });
  }),
);

const memberUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().max(160).optional(),
  phone: z.string().min(6).max(40).optional(),
  memberNumber: z.string().max(60).nullable().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['member', 'leader', 'admin']).optional(),
});

// PATCH /api/users/members/:id — edit or deactivate/reactivate an account
// (leader/admin). A leader is limited to editing members, and can never
// change a role. An admin can reach anyone, including other admins, but
// can't touch their own status/role here (use /api/admin/users for that).
router.patch(
  '/members/:id',
  requireRole('leader', 'admin'),
  validate(memberUpdateSchema),
  asyncHandler(async (req, res) => {
    if (req.body.role !== undefined && req.user.role !== 'admin') {
      throw errors.forbidden('Only an admin can change a member’s role');
    }
    if (req.params.id === req.user.id) {
      if (req.body.isActive === false) throw errors.validation('You cannot deactivate your own account');
      if (req.body.role !== undefined && req.body.role !== req.user.role) {
        throw errors.validation('You cannot change your own role');
      }
    }
    const target = await findUserById(req.params.id);
    if (!target) throw errors.notFound('Member not found');
    if (target.role !== 'member' && req.user.role !== 'admin') throw errors.notFound('Member not found');
    const allow = ['name', 'email', 'phone', 'memberNumber', 'isActive'];
    if (req.body.role !== undefined) allow.push('role');
    const user = await updateUser(req.params.id, req.body, allow);
    ok(res, { user });
  }),
);

export default router;

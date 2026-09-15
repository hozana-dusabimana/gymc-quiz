import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, errors } from '../utils/response.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { getOwnedCourse } from '../services/access.js';
import { getQuizRow } from '../services/quiz.service.js';

const router = Router();
router.use(requireAuth, requireRole('leader'));

// GET /api/analytics/overview — aggregate performance across all the leader's quizzes
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const leaderId = req.user.id;

    const { rows: quizRows } = await query(
      `SELECT z.id, z.title, z.status, z.passing_score, c.code AS course_code, c.title AS course_title,
              (SELECT count(*) FROM quiz_attempts a WHERE a.quiz_id = z.id AND a.status = 'completed') AS submissions,
              (SELECT round(avg(a.percentage)::numeric, 1) FROM quiz_attempts a
                WHERE a.quiz_id = z.id AND a.status = 'completed') AS avg_pct
         FROM quizzes z JOIN courses c ON c.id = z.course_id
        WHERE c.leader_id = $1
        ORDER BY z.created_at DESC`,
      [leaderId],
    );

    const { rows: dist } = await query(
      `SELECT
         count(*) FILTER (WHERE a.percentage >= 90)                        AS a_band,
         count(*) FILTER (WHERE a.percentage >= 75 AND a.percentage < 90)  AS b_band,
         count(*) FILTER (WHERE a.percentage >= 60 AND a.percentage < 75)  AS c_band,
         count(*) FILTER (WHERE a.percentage < 60)                         AS d_band,
         count(*)                                                          AS total,
         round(avg(a.percentage)::numeric, 1)                              AS avg_pct,
         count(*) FILTER (WHERE a.percentage < z.passing_score)            AS below_cutoff
       FROM quiz_attempts a
       JOIN quizzes z ON z.id = a.quiz_id
       JOIN courses c ON c.id = z.course_id
      WHERE c.leader_id = $1 AND a.status = 'completed'`,
      [leaderId],
    );
    const d = dist[0];

    // hardest questions across the leader's quizzes (lowest accuracy)
    const { rows: hard } = await query(
      `SELECT q.id, q.question_text, q.type, c.code AS course_code,
              count(sa.*) AS answered,
              round(100.0 * count(sa.*) FILTER (WHERE sa.is_correct) / NULLIF(count(sa.*), 0), 0) AS accuracy
         FROM member_answers sa
         JOIN quiz_attempts a ON a.id = sa.attempt_id AND a.status = 'completed'
         JOIN questions q ON q.id = sa.question_id
         JOIN courses c ON c.id = q.course_id
        WHERE c.leader_id = $1
        GROUP BY q.id, c.code
       HAVING count(sa.*) >= 1
        ORDER BY accuracy ASC NULLS LAST, answered DESC
        LIMIT 5`,
      [leaderId],
    );

    // Recent Submissions — latest graded attempts across the leader's courses.
    const { rows: recent } = await query(
      `SELECT a.id, a.score, a.max_score, a.percentage, a.completed_at,
              z.title AS quiz_title, c.code AS course_code,
              u.name AS member_name, u.avatar_url AS member_avatar
         FROM quiz_attempts a
         JOIN quizzes z ON z.id = a.quiz_id
         JOIN courses c ON c.id = z.course_id
         JOIN users u ON u.id = a.member_id
        WHERE c.leader_id = $1 AND a.status = 'completed'
        ORDER BY a.completed_at DESC NULLS LAST
        LIMIT 8`,
      [leaderId],
    );

    // Syllabus Insight — newest material + how many AI questions came from it.
    const { rows: insight } = await query(
      `SELECT m.id, m.title, m.created_at AS uploaded_at, c.code AS course_code,
              (SELECT count(*) FROM questions q
                WHERE q.material_id = m.id AND q.ai_generated = true) AS ai_question_count
         FROM materials m
         JOIN courses c ON c.id = m.course_id
        WHERE c.leader_id = $1 AND m.status = 'ready'
        ORDER BY m.created_at DESC
        LIMIT 1`,
      [leaderId],
    );
    const ins = insight[0];

    ok(res, {
      recentSubmissions: recent.map((r) => ({
        id: r.id,
        memberName: r.member_name,
        memberAvatar: r.member_avatar || null,
        quizTitle: r.quiz_title,
        courseCode: r.course_code,
        score: r.score != null ? Number(r.score) : null,
        maxScore: r.max_score != null ? Number(r.max_score) : null,
        percentage: r.percentage != null ? Number(r.percentage) : null,
        completedAt: r.completed_at,
      })),
      syllabusInsight:
        ins && Number(ins.ai_question_count) > 0
          ? {
              materialId: ins.id,
              materialTitle: ins.title,
              courseCode: ins.course_code,
              uploadedAt: ins.uploaded_at,
              aiQuestionCount: Number(ins.ai_question_count),
            }
          : null,
      quizzes: quizRows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        courseCode: r.course_code,
        courseTitle: r.course_title,
        passingScore: Number(r.passing_score),
        submissions: Number(r.submissions),
        averageScore: r.avg_pct != null ? Number(r.avg_pct) : null,
      })),
      distribution: {
        a: Number(d.a_band),
        b: Number(d.b_band),
        c: Number(d.c_band),
        d: Number(d.d_band),
        total: Number(d.total),
        averageScore: d.avg_pct != null ? Number(d.avg_pct) : null,
        belowCutoff: Number(d.below_cutoff),
      },
      hardestQuestions: hard.map((r) => ({
        id: r.id,
        questionText: r.question_text,
        type: r.type,
        courseCode: r.course_code,
        answered: Number(r.answered),
        accuracy: r.accuracy != null ? Number(r.accuracy) : null,
      })),
    });
  }),
);

// GET /api/analytics/report — full dataset for the printable performance report
router.get(
  '/report',
  asyncHandler(async (req, res) => {
    const leaderId = req.user.id;

    const { rows: whoRows } = await query('SELECT name, email, prefix FROM users WHERE id = $1', [
      leaderId,
    ]);
    const who = whoRows[0] || {};

    const { rows: sum } = await query(
      `SELECT
         count(*)                                                          AS total,
         count(DISTINCT a.member_id)                                      AS members,
         count(*) FILTER (WHERE a.percentage >= 90)                        AS a_band,
         count(*) FILTER (WHERE a.percentage >= 75 AND a.percentage < 90)  AS b_band,
         count(*) FILTER (WHERE a.percentage >= 60 AND a.percentage < 75)  AS c_band,
         count(*) FILTER (WHERE a.percentage < 60)                         AS d_band,
         round(avg(a.percentage)::numeric, 1)                              AS avg_pct,
         max(a.percentage)                                                 AS high_pct,
         min(a.percentage)                                                 AS low_pct,
         count(*) FILTER (WHERE a.percentage >= z.passing_score)           AS passed,
         round((avg(a.time_spent_seconds) / 60.0)::numeric, 1)            AS avg_minutes
       FROM quiz_attempts a
       JOIN quizzes z ON z.id = a.quiz_id
       JOIN courses c ON c.id = z.course_id
      WHERE c.leader_id = $1 AND a.status = 'completed'`,
      [leaderId],
    );
    const s = sum[0];

    const { rows: courses } = await query(
      `SELECT c.code, c.title, c.department,
              (SELECT count(*) FROM quizzes z WHERE z.course_id = c.id)                          AS quizzes,
              (SELECT count(*) FROM quizzes z WHERE z.course_id = c.id AND z.status = 'published') AS published,
              (SELECT count(*) FROM enrollments e WHERE e.course_id = c.id)                       AS enrolled,
              (SELECT count(*) FROM quiz_attempts a JOIN quizzes z ON z.id = a.quiz_id
                WHERE z.course_id = c.id AND a.status = 'completed')                              AS submissions,
              (SELECT round(avg(a.percentage)::numeric, 1) FROM quiz_attempts a JOIN quizzes z ON z.id = a.quiz_id
                WHERE z.course_id = c.id AND a.status = 'completed')                              AS avg_pct,
              (SELECT count(*) FROM quiz_attempts a JOIN quizzes z ON z.id = a.quiz_id
                WHERE z.course_id = c.id AND a.status = 'completed' AND a.percentage >= z.passing_score) AS passed
         FROM courses c
        WHERE c.leader_id = $1
        ORDER BY c.code`,
      [leaderId],
    );

    const { rows: quizzes } = await query(
      `SELECT z.id, z.title, z.status, z.passing_score, z.deadline, z.created_at,
              c.code AS course_code,
              (SELECT count(*) FROM quiz_questions qq WHERE qq.quiz_id = z.id) AS question_count,
              count(a.*) FILTER (WHERE a.status = 'completed')                           AS submissions,
              round(avg(a.percentage) FILTER (WHERE a.status = 'completed')::numeric, 1) AS avg_pct,
              max(a.percentage) FILTER (WHERE a.status = 'completed')                    AS high_pct,
              min(a.percentage) FILTER (WHERE a.status = 'completed')                    AS low_pct,
              count(*) FILTER (WHERE a.status = 'completed' AND a.percentage >= z.passing_score) AS passed
         FROM quizzes z
         JOIN courses c ON c.id = z.course_id
         LEFT JOIN quiz_attempts a ON a.quiz_id = z.id
        WHERE c.leader_id = $1
        GROUP BY z.id, c.code
        ORDER BY c.code, z.created_at DESC`,
      [leaderId],
    );

    // Every member with at least one graded submission across the leader's
    // courses — not just the top of the class.
    const { rows: performers } = await query(
      `SELECT u.name, u.member_number,
              count(a.*)                             AS attempts,
              round(avg(a.percentage)::numeric, 1)   AS avg_pct
         FROM quiz_attempts a
         JOIN quizzes z ON z.id = a.quiz_id
         JOIN courses c ON c.id = z.course_id
         JOIN users u ON u.id = a.member_id
        WHERE c.leader_id = $1 AND a.status = 'completed'
        GROUP BY u.id
       HAVING count(a.*) >= 1
        ORDER BY avg_pct DESC, attempts DESC`,
      [leaderId],
    );

    const total = Number(s.total);
    const passRate = total ? Math.round((Number(s.passed) / total) * 100) : null;

    // Already ordered by average desc, attempts desc — rank ties together.
    const memberAverages = performers.map((r) => ({
      name: r.name,
      memberNumber: r.member_number || null,
      attempts: Number(r.attempts),
      averageScore: r.avg_pct != null ? Number(r.avg_pct) : null,
      rank: null,
    }));
    memberAverages.forEach((row, i) => {
      row.rank =
        i > 0 && memberAverages[i - 1].averageScore === row.averageScore
          ? memberAverages[i - 1].rank
          : i + 1;
    });

    ok(res, {
      institution: {
        name: 'Gisozi Youth Mass Choir',
        system: 'Gisozi Youth Mass Choir Quiz',
      },
      generatedAt: new Date().toISOString(),
      generatedBy: {
        name: [who.prefix, who.name].filter(Boolean).join(' ') || who.name || 'Leader',
        email: who.email || req.user.email,
      },
      departments: [...new Set(courses.map((c) => c.department).filter(Boolean))],
      summary: {
        courses: courses.length,
        assessments: quizzes.length,
        submissions: total,
        members: Number(s.members),
        averageScore: s.avg_pct != null ? Number(s.avg_pct) : null,
        highestScore: s.high_pct != null ? Number(s.high_pct) : null,
        lowestScore: s.low_pct != null ? Number(s.low_pct) : null,
        passRate,
        belowCutoff: total - Number(s.passed),
        averageMinutes: s.avg_minutes != null ? Number(s.avg_minutes) : null,
      },
      distribution: {
        a: Number(s.a_band),
        b: Number(s.b_band),
        c: Number(s.c_band),
        d: Number(s.d_band),
        total,
      },
      courses: courses.map((c) => {
        const subs = Number(c.submissions);
        return {
          code: c.code,
          title: c.title,
          department: c.department || null,
          quizzes: Number(c.quizzes),
          published: Number(c.published),
          enrolled: Number(c.enrolled),
          submissions: subs,
          averageScore: c.avg_pct != null ? Number(c.avg_pct) : null,
          passRate: subs ? Math.round((Number(c.passed) / subs) * 100) : null,
        };
      }),
      assessments: quizzes.map((q) => {
        const subs = Number(q.submissions);
        return {
          title: q.title,
          courseCode: q.course_code,
          status: q.status,
          questionCount: Number(q.question_count),
          passingScore: Number(q.passing_score),
          deadline: q.deadline,
          submissions: subs,
          averageScore: q.avg_pct != null ? Number(q.avg_pct) : null,
          highest: q.high_pct != null ? Number(q.high_pct) : null,
          lowest: q.low_pct != null ? Number(q.low_pct) : null,
          passRate: subs ? Math.round((Number(q.passed) / subs) * 100) : null,
        };
      }),
      memberAverages,
    });
  }),
);

// GET /api/analytics/quiz/:quizId/report — printable class marks sheet for one quiz
router.get(
  '/quiz/:quizId/report',
  asyncHandler(async (req, res) => {
    const leaderId = req.user.id;

    const quiz = await getQuizRow(req.params.quizId);
    if (!quiz) throw errors.notFound('Quiz not found');
    await getOwnedCourse(quiz.course_id, leaderId);

    const { rows: whoRows } = await query('SELECT name, email, prefix FROM users WHERE id = $1', [
      leaderId,
    ]);
    const who = whoRows[0] || {};

    // Every enrolled member, with their best attempt at this quiz (completed first,
    // then highest percentage, then most recent).
    const { rows: roster } = await query(
      `SELECT u.name, u.member_number, u.email,
              a.score, a.max_score, a.percentage, a.status,
              a.submitted_at, a.completed_at, a.time_spent_seconds, a.attempt_number
         FROM enrollments e
         JOIN users u ON u.id = e.member_id
         LEFT JOIN LATERAL (
           SELECT qa.* FROM quiz_attempts qa
            WHERE qa.quiz_id = $1 AND qa.member_id = u.id
            ORDER BY (qa.status = 'completed') DESC, qa.percentage DESC NULLS LAST, qa.started_at DESC
            LIMIT 1
         ) a ON true
        WHERE e.course_id = $2
        ORDER BY u.name`,
      [quiz.id, quiz.course_id],
    );

    const passingScore = Number(quiz.passing_score);
    const totalMarks = Number(quiz.total_marks) || null;

    const members = roster.map((r) => {
      const completed = r.status === 'completed';
      const percentage = r.percentage != null ? Number(r.percentage) : null;
      return {
        name: r.name,
        memberNumber: r.member_number || null,
        email: r.email,
        status: completed ? 'completed' : r.status ? 'in_progress' : 'not_attempted',
        score: r.score != null ? Number(r.score) : null,
        maxScore: r.max_score != null ? Number(r.max_score) : totalMarks,
        percentage: completed ? percentage : null,
        passed: completed && percentage != null ? percentage >= passingScore : null,
        attemptNumber: r.attempt_number != null ? Number(r.attempt_number) : null,
        submittedAt: r.submitted_at || r.completed_at || null,
        timeSpentMinutes:
          r.time_spent_seconds != null ? Math.round(Number(r.time_spent_seconds) / 60) : null,
        rank: null,
      };
    });

    // Rank the graded members by percentage (ties share a rank).
    const graded = members
      .filter((s) => s.status === 'completed' && s.percentage != null)
      .sort((a, b) => b.percentage - a.percentage);
    graded.forEach((s, i) => {
      s.rank = i > 0 && graded[i - 1].percentage === s.percentage ? graded[i - 1].rank : i + 1;
    });

    const scores = graded.map((s) => s.percentage);
    const submitted = scores.length;
    const sum = scores.reduce((a, b) => a + b, 0);
    const sortedScores = [...scores].sort((a, b) => a - b);
    const round1 = (n) => Math.round(n * 10) / 10;
    const median = submitted
      ? submitted % 2
        ? sortedScores[(submitted - 1) / 2]
        : round1((sortedScores[submitted / 2 - 1] + sortedScores[submitted / 2]) / 2)
      : null;
    const passCount = graded.filter((s) => s.passed).length;

    const band = (lo, hi) => scores.filter((p) => p >= lo && p < hi).length;

    ok(res, {
      institution: {
        name: 'Gisozi Youth Mass Choir',
        system: 'Gisozi Youth Mass Choir Quiz',
      },
      generatedAt: new Date().toISOString(),
      generatedBy: {
        name: [who.prefix, who.name].filter(Boolean).join(' ') || who.name || 'Leader',
        email: who.email || req.user.email,
      },
      quiz: {
        title: quiz.title,
        description: quiz.description || null,
        courseCode: quiz.course_code,
        courseTitle: quiz.course_title,
        status: quiz.status,
        questionCount: Number(quiz.question_count),
        totalMarks,
        passingScore,
        durationMinutes: Number(quiz.duration_minutes),
        opensAt: quiz.opens_at,
        deadline: quiz.deadline,
        publishedAt: quiz.published_at,
      },
      summary: {
        enrolled: members.length,
        submitted,
        notAttempted: members.filter((s) => s.status === 'not_attempted').length,
        inProgress: members.filter((s) => s.status === 'in_progress').length,
        averageScore: submitted ? round1(sum / submitted) : null,
        medianScore: median,
        highestScore: submitted ? Math.max(...scores) : null,
        lowestScore: submitted ? Math.min(...scores) : null,
        passed: passCount,
        failed: submitted - passCount,
        passRate: submitted ? Math.round((passCount / submitted) * 100) : null,
      },
      distribution: {
        a: band(90, 101),
        b: band(75, 90),
        c: band(60, 75),
        d: band(0, 60),
        total: submitted,
      },
      members,
    });
  }),
);

export default router;

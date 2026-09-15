import { query } from '../db/pool.js';

/**
 * Dashboard metric helpers. Everything here is derived from existing rows
 * (quiz_attempts / enrollments) — no snapshot tables, no scheduled jobs.
 * Trend deltas compare the trailing 30 days with the previous 30 days and return
 * `null` when either window is empty, so the UI can just omit the chip.
 */

/** Cumulative average percentage -> a 0.0–4.0 "performance index" (GPA-style scale). */
export function performanceIndex(avgPct) {
  if (avgPct == null) return null;
  const p = Number(avgPct);
  if (p >= 90) return 4.0;
  if (p >= 85) return 3.7;
  if (p >= 80) return 3.3;
  if (p >= 75) return 3.0;
  if (p >= 70) return 2.7;
  if (p >= 65) return 2.3;
  if (p >= 60) return 2.0;
  if (p >= 55) return 1.7;
  if (p >= 50) return 1.3;
  if (p >= 45) return 1.0;
  if (p > 0) return 0.7;
  return 0.0;
}

export function streakLabel(days) {
  if (days >= 14) return 'Master learner';
  if (days >= 7) return 'Committed';
  if (days >= 3) return 'Consistent';
  if (days >= 1) return 'Getting started';
  return 'No active streak';
}

/** Consecutive days (ending today or yesterday) with >= 1 completed attempt. */
export async function computeStreak(memberId) {
  const { rows } = await query(
    `SELECT DISTINCT (completed_at AT TIME ZONE 'UTC')::date AS d
       FROM quiz_attempts
      WHERE member_id = $1 AND status = 'completed' AND completed_at IS NOT NULL
      ORDER BY d DESC
      LIMIT 400`,
    [memberId],
  );
  if (rows.length === 0) return 0;
  const days = rows.map((r) => new Date(r.d));
  const oneDay = 86_400_000;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const gap = Math.round((today - days[0]) / oneDay);
  if (gap > 1) return 0; // streak already broken
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (Math.round((days[i - 1] - days[i]) / oneDay) === 1) streak++;
    else break;
  }
  return streak;
}

/** Percentile of this member's cumulative average among members sharing a course. */
export async function cohortPercentile(memberId) {
  const { rows } = await query(
    `WITH cohort AS (
       SELECT DISTINCT e2.member_id
         FROM enrollments e1
         JOIN enrollments e2 ON e2.course_id = e1.course_id
        WHERE e1.member_id = $1
     ),
     scores AS (
       SELECT c.member_id, avg(a.percentage) AS avg_pct
         FROM cohort c
         LEFT JOIN quiz_attempts a
           ON a.member_id = c.member_id AND a.status = 'completed'
        GROUP BY c.member_id
       HAVING avg(a.percentage) IS NOT NULL
     ),
     ranked AS (
       SELECT member_id, percent_rank() OVER (ORDER BY avg_pct) AS pr,
              count(*) OVER () AS n
         FROM scores
     )
     SELECT pr, n FROM ranked WHERE member_id = $1`,
    [memberId],
  );
  if (!rows[0] || Number(rows[0].n) < 3) return null;
  // percent_rank: 0 = lowest, 1 = highest. "Top X%" = (1 - pr) * 100, min 1.
  const topPct = Math.max(1, Math.round((1 - Number(rows[0].pr)) * 100));
  return topPct;
}

/**
 * Trailing-window trend for an aggregate over quiz_attempts.
 * `agg` is 'avg' (percentage points) or 'count' (attempts).
 * Returns current-window value minus previous-window value, or null.
 */
export async function attemptTrend({ column = 'a.percentage', agg = 'avg', where, params }) {
  const cur = `WHERE a.completed_at >= now() - interval '30 days'`;
  const prev = `WHERE a.completed_at >= now() - interval '60 days' AND a.completed_at < now() - interval '30 days'`;
  const expr = (filter) =>
    agg === 'avg'
      ? `round((avg(${column}) FILTER (${filter}))::numeric, 1)`
      : `(count(*) FILTER (${filter}))::numeric`;
  const { rows } = await query(
    `SELECT ${expr(cur)} AS cur, ${expr(prev)} AS prev
       FROM quiz_attempts a
       ${where}`,
    params,
  );
  const r = rows[0] || {};
  if (r.cur == null || r.prev == null) return null;
  return Math.round((Number(r.cur) - Number(r.prev)) * 10) / 10;
}

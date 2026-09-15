import { query } from '../db/pool.js';

export async function notify(userId, { title, message = '', type = 'system', linkTarget = null }) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, title, message, type, link_target)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, title, message, type, linkTarget],
  );
  return rows[0];
}

export async function notifyCourseMembers(courseId, payload) {
  const { rows } = await query('SELECT member_id FROM enrollments WHERE course_id = $1', [courseId]);
  await Promise.all(rows.map((r) => notify(r.member_id, payload)));
  return rows.length;
}

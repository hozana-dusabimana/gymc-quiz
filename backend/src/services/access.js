import { query } from '../db/pool.js';
import { errors } from '../utils/response.js';

/** Fetch a course row or throw 404. */
export async function getCourseOr404(courseId) {
  const { rows } = await query('SELECT * FROM courses WHERE id = $1', [courseId]);
  if (!rows[0]) throw errors.notFound('Course not found');
  return rows[0];
}

/** Course must exist and be owned by this leader. */
export async function getOwnedCourse(courseId, leaderId) {
  const course = await getCourseOr404(courseId);
  if (course.leader_id !== leaderId) {
    throw errors.forbidden('You do not own this course');
  }
  return course;
}

/** Member must be enrolled in the course. */
export async function assertEnrolled(courseId, memberId) {
  const { rows } = await query(
    'SELECT 1 FROM enrollments WHERE course_id = $1 AND member_id = $2',
    [courseId, memberId],
  );
  if (!rows[0]) throw errors.forbidden('You are not enrolled in this course');
}

/** Returns true if the user (leader owner or enrolled member) may view the course. */
export async function canViewCourse(course, user) {
  if (user.role === 'leader') return course.leader_id === user.id;
  const { rows } = await query(
    'SELECT 1 FROM enrollments WHERE course_id = $1 AND member_id = $2',
    [course.id, user.id],
  );
  return Boolean(rows[0]);
}

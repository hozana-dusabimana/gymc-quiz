import { query, withTransaction } from '../db/pool.js';
import { errors } from '../utils/response.js';
import * as S from './serialize.js';

export const QUIZ_SELECT = `
  SELECT z.*, c.code AS course_code, c.title AS course_title,
    (SELECT count(*) FROM quiz_questions qq WHERE qq.quiz_id = z.id) AS question_count,
    (SELECT COALESCE(sum(COALESCE(qq.marks_override, q.marks)),0)
       FROM quiz_questions qq JOIN questions q ON q.id = qq.question_id
      WHERE qq.quiz_id = z.id) AS total_marks,
    (SELECT count(*) FROM quiz_attempts a WHERE a.quiz_id = z.id AND a.status = 'completed') AS submissions_count,
    (SELECT round(avg(a.percentage)::numeric,1) FROM quiz_attempts a
      WHERE a.quiz_id = z.id AND a.status = 'completed') AS average_score
  FROM quizzes z JOIN courses c ON c.id = z.course_id`;

export async function getQuizRow(id) {
  const { rows } = await query(`${QUIZ_SELECT} WHERE z.id = $1`, [id]);
  return rows[0] || null;
}

export async function getQuizQuestions(quizId) {
  const { rows } = await query(
    `SELECT qq.position, qq.marks_override, q.*, c.code AS course_code
       FROM quiz_questions qq
       JOIN questions q ON q.id = qq.question_id
       JOIN courses c ON c.id = q.course_id
      WHERE qq.quiz_id = $1
      ORDER BY qq.position`,
    [quizId],
  );
  const out = [];
  for (const r of rows) {
    const opts = await query(
      'SELECT * FROM question_options WHERE question_id = $1 ORDER BY position',
      [r.id],
    );
    const q = S.question(r, opts.rows);
    q.marks = r.marks_override != null ? Number(r.marks_override) : q.marks;
    q.position = r.position;
    out.push(q);
  }
  return out;
}

/** Strip answer keys for in-progress member delivery. */
export function redactQuestion(q) {
  return {
    id: q.id,
    type: q.type,
    difficulty: q.difficulty,
    questionText: q.questionText,
    options: q.options,
    marks: q.marks,
    materialRef: undefined,
  };
}

export async function setQuizQuestions(quizId, items) {
  // items: [{ questionId, marksOverride? }] in desired order
  return withTransaction(async (client) => {
    const { rows: quizRows } = await client.query('SELECT course_id FROM quizzes WHERE id = $1', [quizId]);
    const courseId = quizRows[0].course_id;
    const ids = items.map((i) => i.questionId);
    if (ids.length) {
      const check = await client.query(
        `SELECT id FROM questions WHERE id = ANY($1::uuid[]) AND course_id = $2`,
        [ids, courseId],
      );
      if (check.rows.length !== ids.length) {
        throw errors.badRequest('All questions must belong to this quiz\'s course');
      }
    }
    await client.query('DELETE FROM quiz_questions WHERE quiz_id = $1', [quizId]);
    for (let i = 0; i < items.length; i++) {
      await client.query(
        'INSERT INTO quiz_questions (quiz_id, question_id, position, marks_override) VALUES ($1,$2,$3,$4)',
        [quizId, items[i].questionId, i, items[i].marksOverride ?? null],
      );
    }
  });
}

/** Availability check for a member. Returns { open, reason }. */
export function quizWindowState(quiz, now = new Date()) {
  if (quiz.status !== 'published') return { open: false, reason: 'This quiz is not currently open' };
  if (quiz.opens_at && new Date(quiz.opens_at) > now) {
    return { open: false, reason: `Opens ${new Date(quiz.opens_at).toLocaleString()}` };
  }
  if (quiz.deadline && new Date(quiz.deadline) < now) {
    return { open: false, reason: 'The deadline for this quiz has passed' };
  }
  return { open: true, reason: null };
}

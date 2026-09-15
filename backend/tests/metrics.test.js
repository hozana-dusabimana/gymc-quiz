import { describe, it, expect, beforeAll } from 'vitest';
import { request, auth, signup } from './helpers.js';

/** Minimal build: course + one MCQ + published quiz, member takes it. */
async function seedCompletedAttempt() {
  const lect = await signup('leader', 'Dr Metrics');
  const stud = await signup('member', 'Metric Stu');

  const course = await request
    .post('/api/courses')
    .set(auth(lect.token))
    .send({ code: `MET${Date.now() % 100000}`, title: 'Metrics 101', department: 'CS', term: 'Fall 2026' });
  const courseId = course.body.data.course.id;

  await request.post(`/api/courses/${courseId}/enroll`).set(auth(lect.token)).send({ email: stud.email });

  const q = await request.post('/api/questions').set(auth(lect.token)).send({
    courseId,
    type: 'multiple_choice',
    questionText: 'Pick A',
    options: ['A', 'B'],
    correctAnswer: 'A',
    marks: 1,
  });
  const quiz = await request.post('/api/quizzes').set(auth(lect.token)).send({
    courseId,
    title: 'Metrics Quiz',
    durationMinutes: 10,
    passingScore: 50,
    questionIds: [q.body.data.question.id],
  });
  await request.post(`/api/quizzes/${quiz.body.data.quiz.id}/publish`).set(auth(lect.token));

  const start = await request.post('/api/attempts').set(auth(stud.token)).send({ quizId: quiz.body.data.quiz.id });
  const attemptId = start.body.data.attempt.id;
  await request
    .put(`/api/attempts/${attemptId}/answers`)
    .set(auth(stud.token))
    .send({ answers: [{ questionId: q.body.data.question.id, answerText: 'A' }] });
  await request.post(`/api/attempts/${attemptId}/submit`).set(auth(stud.token)).send({ timeSpentSeconds: 30 });

  return { lect, stud, quizId: quiz.body.data.quiz.id };
}

describe('dashboard metrics', () => {
  let lect;
  let stud;
  let quizId;
  beforeAll(async () => {
    ({ lect, stud, quizId } = await seedCompletedAttempt());
  });

  it('member stats expose the reworked dashboard fields', async () => {
    const res = await request.get('/api/users/me/stats').set(auth(stud.token));
    expect(res.status).toBe(200);
    const s = res.body.data.stats;
    expect(s.quizzesTaken).toBeGreaterThanOrEqual(1);
    expect(s.streakDays).toBeGreaterThanOrEqual(1);
    expect(typeof s.streakLabel).toBe('string');
    expect(s.performanceIndex).toBeGreaterThanOrEqual(0);
    expect(s.performanceIndex).toBeLessThanOrEqual(4);
    expect(s.department).toBe('CS');
    expect(s.term).toBe('Fall 2026');
    expect(['Good standing', 'Needs attention', 'New']).toContain(s.standing);
    expect(s).toHaveProperty('completionRate');
    expect(s.trends).toHaveProperty('averageScore');
  });

  it('leader stats expose closing-soon counters', async () => {
    const res = await request.get('/api/users/me/stats').set(auth(lect.token));
    expect(res.status).toBe(200);
    const s = res.body.data.stats;
    expect(s).toHaveProperty('quizzesClosingSoon');
    expect(s).toHaveProperty('membersJoinedThisWeek');
    expect(s.membersJoinedThisWeek).toBeGreaterThanOrEqual(1);
  });

  it('analytics overview includes recent submissions', async () => {
    const res = await request.get('/api/analytics/overview').set(auth(lect.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.recentSubmissions)).toBe(true);
    expect(res.body.data.recentSubmissions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.recentSubmissions[0]).toHaveProperty('percentage');
    expect(res.body.data).toHaveProperty('syllabusInsight');
  });

  it('per-quiz marks sheet lists every enrolled member with their result', async () => {
    const res = await request.get(`/api/analytics/quiz/${quizId}/report`).set(auth(lect.token));
    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r.quiz.courseCode).toBeTruthy();
    expect(r.summary.enrolled).toBeGreaterThanOrEqual(1);
    expect(r.summary.submitted).toBeGreaterThanOrEqual(1);
    expect(r.summary.passRate).toBe(100);
    expect(Array.isArray(r.members)).toBe(true);
    const me = r.members.find((s) => s.email === stud.email);
    expect(me).toBeTruthy();
    expect(me.status).toBe('completed');
    expect(me.passed).toBe(true);
    expect(me.rank).toBe(1);
    expect(r.distribution.a + r.distribution.b + r.distribution.c + r.distribution.d).toBe(
      r.summary.submitted,
    );
  });

  it('per-quiz marks sheet is owner-only', async () => {
    const other = await signup('leader', 'Dr Nosy');
    const res = await request.get(`/api/analytics/quiz/${quizId}/report`).set(auth(other.token));
    expect(res.status).toBe(403);
  });

  it('per-quiz marks sheet 404s for an unknown quiz', async () => {
    const res = await request
      .get('/api/analytics/quiz/00000000-0000-0000-0000-000000000000/report')
      .set(auth(lect.token));
    expect(res.status).toBe(404);
  });

  it('printable report lists every graded member, not just the top 10', async () => {
    const owner = await signup('leader', 'Dr Everyone');
    const course = await request
      .post('/api/courses')
      .set(auth(owner.token))
      .send({ code: `ALL${Date.now() % 100000}`, title: 'Everyone 101', department: 'CS', term: 'Fall 2026' });
    const courseId = course.body.data.course.id;

    const q = await request.post('/api/questions').set(auth(owner.token)).send({
      courseId, type: 'multiple_choice', questionText: 'Pick A', options: ['A', 'B'], correctAnswer: 'A', marks: 1,
    });
    const quiz = await request.post('/api/quizzes').set(auth(owner.token)).send({
      courseId, title: 'Everyone Quiz', durationMinutes: 10, passingScore: 50, questionIds: [q.body.data.question.id],
    });
    await request.post(`/api/quizzes/${quiz.body.data.quiz.id}/publish`).set(auth(owner.token));

    const N = 12; // more than the old LIMIT 10
    for (let i = 0; i < N; i++) {
      const s = await signup('member', `Everyone Stu ${i}`);
      await request.post(`/api/courses/${courseId}/enroll`).set(auth(owner.token)).send({ email: s.email });
      const start = await request.post('/api/attempts').set(auth(s.token)).send({ quizId: quiz.body.data.quiz.id });
      const attemptId = start.body.data.attempt.id;
      await request
        .put(`/api/attempts/${attemptId}/answers`)
        .set(auth(s.token))
        .send({ answers: [{ questionId: q.body.data.question.id, answerText: 'A' }] });
      await request.post(`/api/attempts/${attemptId}/submit`).set(auth(s.token)).send({ timeSpentSeconds: 20 });
    }

    const res = await request.get('/api/analytics/report').set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.data.memberAverages).toHaveLength(N);
    expect(res.body.data.memberAverages.every((r) => r.rank != null)).toBe(true);
    expect(res.body.data.memberAverages[0].rank).toBe(1);
  }, 60_000);
});

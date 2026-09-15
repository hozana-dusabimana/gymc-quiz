import { describe, it, expect, beforeAll } from 'vitest';
import { request, signup, auth } from './helpers.js';

describe('end-to-end quiz flow', () => {
  let lect;
  let stud;
  let other;
  let courseId;
  let mcqId;
  let saId;
  let quizId;

  beforeAll(async () => {
    lect = await signup('leader', 'Dr Flow');
    stud = await signup('member', 'Stu Flow');
    other = await signup('member', 'Other Stu');
  });

  it('leader creates a course; member is not enrolled yet', async () => {
    const res = await request
      .post('/api/courses')
      .set(auth(lect.token))
      .send({ code: 'FLOW101', title: 'Flow Course', department: 'CS', term: 'F26' });
    expect(res.status).toBe(201);
    courseId = res.body.data.course.id;

    const memberList = await request.get('/api/courses').set(auth(stud.token));
    expect(memberList.body.data.courses.find((c) => c.id === courseId)).toBeUndefined();
  });

  it('member cannot create a course (RBAC)', async () => {
    const res = await request.post('/api/courses').set(auth(stud.token)).send({ code: 'X', title: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('leader enrolls the member', async () => {
    const res = await request
      .post(`/api/courses/${courseId}/enroll`)
      .set(auth(lect.token))
      .send({ email: stud.email });
    expect(res.status).toBe(201);
    const list = await request.get('/api/courses').set(auth(stud.token));
    expect(list.body.data.courses.some((c) => c.id === courseId)).toBe(true);
  });

  it('leader creates an MCQ and a short-answer question', async () => {
    const mcq = await request.post('/api/questions').set(auth(lect.token)).send({
      courseId,
      type: 'multiple_choice',
      questionText: 'Which keyword de-duplicates SQL result rows?',
      options: ['DISTINCT', 'UNIQUE', 'GROUP', 'ONLY'],
      correctAnswer: 'DISTINCT',
      marks: 2,
      explanation: 'DISTINCT removes duplicate rows.',
    });
    expect(mcq.status).toBe(201);
    mcqId = mcq.body.data.question.id;

    const sa = await request.post('/api/questions').set(auth(lect.token)).send({
      courseId,
      type: 'short_answer',
      questionText: 'What does a database index trade for faster reads?',
      correctAnswer: 'extra storage space and slower writes (inserts/updates/deletes)',
      markingGuidance: 'storage overhead + write cost',
      marks: 4,
    });
    expect(sa.status).toBe(201);
    saId = sa.body.data.question.id;
  });

  it('rejects an MCQ whose correctAnswer is not an option', async () => {
    const res = await request.post('/api/questions').set(auth(lect.token)).send({
      courseId,
      type: 'multiple_choice',
      questionText: 'bad',
      options: ['a', 'b'],
      correctAnswer: 'c',
      marks: 1,
    });
    expect(res.status).toBe(422);
  });

  it('creates and publishes a quiz; total marks are computed server-side', async () => {
    const quiz = await request.post('/api/quizzes').set(auth(lect.token)).send({
      courseId,
      title: 'Flow Quiz',
      durationMinutes: 20,
      passingScore: 50,
      questionIds: [mcqId, saId],
    });
    expect(quiz.status).toBe(201);
    expect(quiz.body.data.quiz.totalMarks).toBe(6);
    quizId = quiz.body.data.quiz.id;

    const notReady = await request.post(`/api/quizzes/${quizId}/publish`).set(auth(lect.token));
    expect(notReady.status).toBe(200);
    expect(notReady.body.data.quiz.status).toBe('published');
  });

  it('hides the answer key from members', async () => {
    const res = await request.get(`/api/quizzes/${quizId}`).set(auth(stud.token));
    expect(res.status).toBe(200);
    for (const q of res.body.data.questions) {
      expect(q.correctAnswer).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
  });

  it('non-enrolled member cannot view or start the quiz', async () => {
    const view = await request.get(`/api/quizzes/${quizId}`).set(auth(other.token));
    expect(view.status).toBe(403);
    const start = await request.post('/api/attempts').set(auth(other.token)).send({ quizId });
    expect(start.status).toBe(403);
  });

  it('member takes the quiz and is graded', async () => {
    const start = await request.post('/api/attempts').set(auth(stud.token)).send({ quizId });
    expect(start.status).toBe(201);
    const attemptId = start.body.data.attempt.id;
    expect(start.body.data.secondsRemaining).toBeGreaterThan(0);
    expect(start.body.data.secondsRemaining).toBeLessThanOrEqual(20 * 60);

    await request
      .put(`/api/attempts/${attemptId}/answers`)
      .set(auth(stud.token))
      .send({
        answers: [
          { questionId: mcqId, answerText: 'DISTINCT' },
          { questionId: saId, answerText: 'It uses more storage and makes writes slower.' },
        ],
      });

    const submit = await request
      .post(`/api/attempts/${attemptId}/submit`)
      .set(auth(stud.token))
      .send({ timeSpentSeconds: 60 });
    expect(submit.status).toBe(200);
    const a = submit.body.data.attempt;
    expect(a.status).toBe('completed');
    expect(a.score).toBeGreaterThanOrEqual(2); // MCQ correct
    expect(a.score).toBeLessThanOrEqual(a.maxScore);
    expect(a.maxScore).toBe(6);

    const evals = submit.body.data.evaluations;
    expect(evals.length).toBe(2);
    for (const e of evals) {
      expect(e.score).toBeGreaterThanOrEqual(0);
      expect(e.score).toBeLessThanOrEqual(e.maxScore);
    }
  });

  it('enforces the attempt limit', async () => {
    const again = await request.post('/api/attempts').set(auth(stud.token)).send({ quizId });
    // default attemptsAllowed = 1 -> either 400 (used up) after completion
    expect([400]).toContain(again.status);
  });

  it('keeps results private to their owner', async () => {
    const mine = await request.get('/api/results/mine').set(auth(stud.token));
    expect(mine.body.data.results.length).toBeGreaterThanOrEqual(1);
    const attemptId = mine.body.data.results[0].id;
    const peek = await request.get(`/api/attempts/${attemptId}`).set(auth(other.token));
    expect(peek.status).toBe(403);
    const leaderView = await request.get(`/api/attempts?quizId=${quizId}`).set(auth(lect.token));
    expect(leaderView.body.data.attempts.length).toBeGreaterThanOrEqual(1);
  });

  it('leader cannot touch another leader\'s course', async () => {
    const lect2 = await signup('leader', 'Rival');
    const res = await request
      .patch(`/api/courses/${courseId}`)
      .set(auth(lect2.token))
      .send({ title: 'hijacked' });
    expect(res.status).toBe(403);
  });
});

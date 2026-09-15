import { describe, it, expect, beforeAll } from 'vitest';
import { request, signup, auth } from './helpers.js';

// Questions may be saved WITHOUT an answer key — the AI (or, when AI is off, a
// "pending leader review" placeholder) grades them at correction time.
describe('keyless questions (AI-graded at correction time)', () => {
  let lect;
  let stud;
  let courseId;
  let mcqNoKey;
  let tfNoKey;
  let saNoKey;
  let quizId;

  beforeAll(async () => {
    lect = await signup('leader', 'Dr NoKey');
    stud = await signup('member', 'Stu NoKey');
    const course = await request
      .post('/api/courses')
      .set(auth(lect.token))
      .send({ code: 'KEY101', title: 'Keyless Course', department: 'CS', term: 'F26' });
    courseId = course.body.data.course.id;
    await request.post(`/api/courses/${courseId}/enroll`).set(auth(lect.token)).send({ email: stud.email });
  });

  it('accepts an MCQ with no correctAnswer', async () => {
    const res = await request.post('/api/questions').set(auth(lect.token)).send({
      courseId,
      type: 'multiple_choice',
      questionText: 'Which SQL clause filters grouped rows?',
      options: ['WHERE', 'HAVING', 'LIMIT', 'ORDER BY'],
      marks: 2,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.question.correctAnswer).toBe('');
    expect(res.body.data.question.optionRows.every((o) => o.isCorrect === false)).toBe(true);
    mcqNoKey = res.body.data.question.id;
  });

  it('still rejects an MCQ whose (given) key is not an option', async () => {
    const res = await request.post('/api/questions').set(auth(lect.token)).send({
      courseId,
      type: 'multiple_choice',
      questionText: 'bad key',
      options: ['a', 'b'],
      correctAnswer: 'zzz',
      marks: 1,
    });
    expect(res.status).toBe(422);
  });

  it('accepts a true/false with no key (does not silently default to False)', async () => {
    const res = await request.post('/api/questions').set(auth(lect.token)).send({
      courseId,
      type: 'true_false',
      questionText: 'Normalisation always improves query performance.',
      marks: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.question.correctAnswer).toBe('');
    tfNoKey = res.body.data.question.id;
  });

  it('accepts a short-answer with no model answer', async () => {
    const res = await request.post('/api/questions').set(auth(lect.token)).send({
      courseId,
      type: 'short_answer',
      questionText: 'Explain what a covering index is.',
      marks: 4,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.question.correctAnswer).toBe('');
    saNoKey = res.body.data.question.id;
  });

  it('a quiz of only keyless questions publishes and grades end-to-end', async () => {
    const quiz = await request.post('/api/quizzes').set(auth(lect.token)).send({
      courseId,
      title: 'Keyless Quiz',
      durationMinutes: 20,
      questionIds: [mcqNoKey, tfNoKey, saNoKey],
    });
    expect(quiz.status).toBe(201);
    expect(quiz.body.data.quiz.totalMarks).toBe(7);
    quizId = quiz.body.data.quiz.id;

    const pub = await request.post(`/api/quizzes/${quizId}/publish`).set(auth(lect.token));
    expect(pub.status).toBe(200);

    const start = await request.post('/api/attempts').set(auth(stud.token)).send({ quizId });
    expect(start.status).toBe(201);
    const attemptId = start.body.data.attempt.id;

    await request
      .put(`/api/attempts/${attemptId}/answers`)
      .set(auth(stud.token))
      .send({
        answers: [
          { questionId: mcqNoKey, answerText: 'HAVING' },
          { questionId: tfNoKey, answerText: 'False' },
          { questionId: saNoKey, answerText: 'An index that contains every column a query needs.' },
        ],
      });

    const submit = await request
      .post(`/api/attempts/${attemptId}/submit`)
      .set(auth(stud.token))
      .send({ timeSpentSeconds: 30 });
    expect(submit.status).toBe(200);
    const a = submit.body.data.attempt;
    expect(a.status).toBe('completed');
    expect(a.maxScore).toBe(7);

    // every keyless question is routed through the AI/evaluator path
    const evals = submit.body.data.evaluations;
    expect(evals.length).toBe(3);
    for (const e of evals) {
      expect(e.gradedBy).toBe('ai');
      expect(e.score).toBeGreaterThanOrEqual(0);
      expect(e.score).toBeLessThanOrEqual(e.maxScore);
    }
  });
});

import { query, withTransaction } from '../db/pool.js';
import { errors } from '../utils/response.js';
import { getQuizRow, getQuizQuestions, quizWindowState } from './quiz.service.js';
import { evaluateShortAnswer, findOnlineReferences } from '../lib/evaluator.js';
import { chat, aiConfigured } from '../lib/ai.js';
import { notify } from './notification.service.js';
import * as S from './serialize.js';

const GRACE_MS = 20_000;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Start (or resume) an attempt for a member. */
export async function startAttempt({ quizId, member }) {
  const quiz = await getQuizRow(quizId);
  if (!quiz) throw errors.notFound('Quiz not found');

  const enrolled = await query(
    'SELECT 1 FROM enrollments WHERE course_id = $1 AND member_id = $2',
    [quiz.course_id, member.id],
  );
  if (!enrolled.rows[0]) throw errors.forbidden('You are not enrolled in this course');

  const state = quizWindowState(quiz);
  const existing = await query(
    `SELECT * FROM quiz_attempts WHERE quiz_id = $1 AND member_id = $2 ORDER BY attempt_number DESC`,
    [quizId, member.id],
  );
  const inProgress = existing.rows.find((a) => a.status === 'in_progress');
  if (inProgress) {
    // resume — but auto-submit if the window already elapsed
    if (new Date(inProgress.must_submit_by).getTime() + GRACE_MS < Date.now()) {
      await finalizeAttempt(inProgress.id, { auto: true });
      return getAttemptForMember(inProgress.id, member.id);
    }
    return getAttemptForMember(inProgress.id, member.id);
  }

  if (!state.open) throw errors.badRequest(state.reason || 'This quiz is not open');
  if (existing.rows.length >= quiz.attempts_allowed) {
    throw errors.badRequest('You have used all your attempts for this quiz');
  }

  const questions = await getQuizQuestions(quizId);
  if (questions.length === 0) throw errors.badRequest('This quiz has no questions');

  const order = (quiz.randomize_order ? shuffle(questions) : questions).map((q) => q.id);
  const durationMs = quiz.duration_minutes * 60_000;
  let mustSubmitBy = new Date(Date.now() + durationMs);
  if (quiz.deadline && new Date(quiz.deadline) < mustSubmitBy) mustSubmitBy = new Date(quiz.deadline);

  const attemptNumber = existing.rows.length + 1;
  const { rows } = await query(
    `INSERT INTO quiz_attempts (quiz_id, member_id, attempt_number, question_order, must_submit_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [quizId, member.id, attemptNumber, JSON.stringify(order), mustSubmitBy],
  );
  return getAttemptForMember(rows[0].id, member.id);
}

export async function getAttemptRow(id) {
  const { rows } = await query(
    `SELECT a.*, z.title AS quiz_title, z.show_instant_feedback, z.passing_score, z.course_id,
            c.code AS course_code, u.name AS member_name, u.email AS member_email, u.member_number
       FROM quiz_attempts a
       JOIN quizzes z ON z.id = a.quiz_id
       JOIN courses c ON c.id = z.course_id
       JOIN users u ON u.id = a.member_id
      WHERE a.id = $1`,
    [id],
  );
  return rows[0] || null;
}

/** Attempt view for the owning member (auto-submits if the window elapsed). */
export async function getAttemptForMember(id, memberId) {
  let row = await getAttemptRow(id);
  if (!row) throw errors.notFound('Attempt not found');
  if (row.member_id !== memberId) throw errors.forbidden();

  if (row.status === 'in_progress' && new Date(row.must_submit_by).getTime() + GRACE_MS < Date.now()) {
    await finalizeAttempt(id, { auto: true });
    row = await getAttemptRow(id);
  }

  const quiz = await getQuizRow(row.quiz_id);
  const allQuestions = await getQuizQuestions(row.quiz_id);
  const byId = new Map(allQuestions.map((q) => [q.id, q]));
  const ordered = (row.question_order || []).map((qid) => byId.get(qid)).filter(Boolean);

  const answers = await query('SELECT * FROM member_answers WHERE attempt_id = $1', [id]);
  const answerMap = new Map(answers.rows.map((a) => [a.question_id, a]));

  const reveal = row.status === 'completed';
  const questions = ordered.map((q) => {
    const saved = answerMap.get(q.id);
    const base = {
      id: q.id,
      type: q.type,
      difficulty: q.difficulty,
      questionText: q.questionText,
      options: q.options,
      marks: q.marks,
      yourAnswer: saved
        ? saved.answer_text ||
          q.optionRows?.find((o) => o.id === saved.selected_option_id)?.content ||
          ''
        : '',
    };
    if (reveal) {
      base.correctAnswer = q.correctAnswer;
      base.explanation = q.explanation;
      base.materialRef = q.materialRef;
      base.isCorrect = saved?.is_correct ?? null;
      base.score = saved?.score != null ? Number(saved.score) : null;
      base.maxScore = saved?.max_score != null ? Number(saved.max_score) : q.marks;
    }
    return base;
  });

  const result = {
    attempt: S.attempt(row),
    quiz: S.quiz(quiz),
    questions,
    secondsRemaining:
      row.status === 'in_progress'
        ? Math.max(0, Math.round((new Date(row.must_submit_by).getTime() - Date.now()) / 1000))
        : 0,
  };

  if (reveal) {
    result.evaluations = await getEvaluations(id);
  }
  return result;
}

export async function saveAnswers({ attemptId, memberId, answers }) {
  const row = await getAttemptRow(attemptId);
  if (!row) throw errors.notFound('Attempt not found');
  if (row.member_id !== memberId) throw errors.forbidden();
  if (row.status !== 'in_progress') throw errors.badRequest('This attempt is no longer open');
  if (new Date(row.must_submit_by).getTime() + GRACE_MS < Date.now()) {
    await finalizeAttempt(attemptId, { auto: true });
    throw errors.badRequest('Time is up — your attempt was submitted automatically');
  }

  const quizQuestions = await getQuizQuestions(row.quiz_id);
  const byId = new Map(quizQuestions.map((q) => [q.id, q]));

  await withTransaction(async (client) => {
    for (const ans of answers) {
      const q = byId.get(ans.questionId);
      if (!q) continue;
      let optionId = null;
      let text = (ans.answerText || '').slice(0, 8000);
      if (q.type !== 'short_answer') {
        const chosen = q.optionRows?.find(
          (o) => o.id === ans.optionId || o.content === (ans.answerText || ans.optionContent),
        );
        optionId = chosen?.id || null;
        text = chosen?.content || '';
      }
      await client.query(
        `INSERT INTO member_answers (attempt_id, question_id, answer_text, selected_option_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (attempt_id, question_id)
         DO UPDATE SET answer_text = EXCLUDED.answer_text, selected_option_id = EXCLUDED.selected_option_id, updated_at = now()`,
        [attemptId, ans.questionId, text, optionId],
      );
    }
  });

  return { saved: true };
}

/** Member-initiated submit. */
export async function submitAttempt({ attemptId, memberId, timeSpentSeconds }) {
  const row = await getAttemptRow(attemptId);
  if (!row) throw errors.notFound('Attempt not found');
  if (row.member_id !== memberId) throw errors.forbidden();
  if (row.status === 'completed') return getAttemptForMember(attemptId, memberId);
  if (!['in_progress', 'submitted', 'evaluating'].includes(row.status)) {
    throw errors.badRequest('This attempt cannot be submitted');
  }
  await finalizeAttempt(attemptId, { auto: false, timeSpentSeconds });
  return getAttemptForMember(attemptId, memberId);
}

/**
 * Grade an attempt end-to-end inside a guarded critical section.
 * Deterministic grading for objective questions; AI for short answers.
 */
export async function finalizeAttempt(attemptId, { auto = false, timeSpentSeconds } = {}) {
  // Claim the attempt so concurrent submits don't double-grade.
  const claim = await query(
    `UPDATE quiz_attempts SET status = 'evaluating',
        submitted_at = COALESCE(submitted_at, now()),
        time_spent_seconds = COALESCE($2, time_spent_seconds,
          GREATEST(1, EXTRACT(EPOCH FROM (now() - started_at))::int))
      WHERE id = $1 AND status IN ('in_progress','submitted')
      RETURNING *`,
    [attemptId, timeSpentSeconds ?? null],
  );
  if (!claim.rows[0]) return; // already being graded / done

  const row = await getAttemptRow(attemptId);
  const quiz = await getQuizRow(row.quiz_id);
  const questions = await getQuizQuestions(row.quiz_id);
  const answers = await query('SELECT * FROM member_answers WHERE attempt_id = $1', [attemptId]);
  const answerByQ = new Map(answers.rows.map((a) => [a.question_id, a]));

  let total = 0;
  let maxTotal = 0;
  const shortAnswerJobs = [];
  const answerIdByQ = new Map(); // question_id -> member_answers.id
  const missed = []; // { q, answerId } — wrong answers that ended up with no material ref
  const hasMaterialRef = new Set(); // answerId

  for (const q of questions) {
    maxTotal += q.marks;
    const saved = answerByQ.get(q.id);

    // Ensure a row exists even if the member never touched the question.
    let answerId = saved?.id;
    if (!answerId) {
      const ins = await query(
        `INSERT INTO member_answers (attempt_id, question_id, answer_text) VALUES ($1,$2,'')
         ON CONFLICT (attempt_id, question_id) DO UPDATE SET updated_at = now() RETURNING id`,
        [attemptId, q.id],
      );
      answerId = ins.rows[0].id;
    }
    answerIdByQ.set(q.id, answerId);

    // Short-answer, or any question the leader left without an answer key,
    // is graded by the AI evaluator against the question + course material.
    const hasKey = String(q.correctAnswer || '').trim() !== '';
    if (q.type === 'short_answer' || !hasKey) {
      shortAnswerJobs.push({
        q,
        answerId,
        answerText:
          saved?.selected_option_id
            ? q.optionRows.find((o) => o.id === saved.selected_option_id)?.content ||
              saved?.answer_text || ''
            : saved?.answer_text || '',
        keyless: !hasKey && q.type !== 'short_answer',
      });
      continue;
    }

    // deterministic objective grading
    const given =
      saved?.selected_option_id
        ? q.optionRows.find((o) => o.id === saved.selected_option_id)?.content || ''
        : saved?.answer_text || '';
    const isCorrect =
      given.trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase() && given.trim() !== '';
    const score = isCorrect ? q.marks : 0;
    total += score;
    await query(
      `UPDATE member_answers SET is_correct=$2, score=$3, max_score=$4, graded_by='auto', updated_at=now()
       WHERE id=$1`,
      [answerId, isCorrect, score, q.marks],
    );
    // A question-authored material link is a material reference for objective Qs.
    if (!isCorrect) {
      if (q.materialId) {
        hasMaterialRef.add(answerId);
        await query('DELETE FROM answer_references WHERE member_answer_id = $1', [answerId]);
        await query(
          `INSERT INTO answer_references (member_answer_id, kind, material_id, title, page_number, snippet)
           VALUES ($1,'material',$2,$3,$4,$5)`,
          [
            answerId,
            q.materialId,
            q.materialRef?.name || 'Course material',
            q.materialRef?.page || q.materialPage || null,
            q.materialRef?.snippet || '',
          ],
        );
      }
      missed.push({ q, answerId });
    }
  }

  // AI evaluation of short-answer + keyless questions (sequential to bound cost / rate)
  for (const job of shortAnswerJobs) {
    const { q, answerId, answerText, keyless } = job;
    let evaluation;
    try {
      if (aiConfigured()) {
        evaluation = await evaluateShortAnswer({
          courseId: row.course_id,
          questionText: q.questionText,
          questionType: q.type,
          options: keyless ? q.options : undefined,
          expectedAnswer: q.correctAnswer,
          markingGuidance: q.markingGuidance,
          maxScore: q.marks,
          memberAnswer: answerText,
        });
      } else {
        evaluation = fallbackShortAnswer(q, answerText);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[grade ${attemptId}] short-answer eval failed for ${q.id}:`, err.message);
      evaluation = fallbackShortAnswer(q, answerText, err.message);
    }

    total += evaluation.score;
    const isCorrect = evaluation.score >= q.marks * 0.6;
    await query(
      `UPDATE member_answers SET is_correct=$2, score=$3, max_score=$4, graded_by='ai', updated_at=now()
       WHERE id=$1`,
      [answerId, isCorrect, evaluation.score, q.marks],
    );
    await query(
      `INSERT INTO ai_evaluations (member_answer_id, attempt_id, question_id, score, max_score, evaluation, feedback, correct_answer, model, raw_response)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (member_answer_id) DO UPDATE SET
         score=EXCLUDED.score, max_score=EXCLUDED.max_score, evaluation=EXCLUDED.evaluation,
         feedback=EXCLUDED.feedback, correct_answer=EXCLUDED.correct_answer, model=EXCLUDED.model, raw_response=EXCLUDED.raw_response`,
      [
        answerId, attemptId, q.id, evaluation.score, q.marks,
        evaluation.evaluation, evaluation.feedback, evaluation.correctAnswer,
        evaluation.model, JSON.stringify(evaluation.raw ?? {}),
      ],
    );
    await query('DELETE FROM answer_references WHERE member_answer_id = $1', [answerId]);
    for (const ref of evaluation.references || []) {
      await query(
        `INSERT INTO answer_references (member_answer_id, kind, material_id, title, page_number, snippet)
         VALUES ($1,'material',$2,$3,$4,$5)`,
        [answerId, ref.materialId || null, ref.title, ref.page || null, ref.snippet || ''],
      );
    }
    if ((evaluation.references || []).length) hasMaterialRef.add(answerId);
    if (!isCorrect) missed.push({ q, answerId });
  }

  // --- Supplementary online references (one batched web search) ---
  // Only for missed questions that ended up with no leader-material reference.
  const needOnline = missed.filter((m) => !hasMaterialRef.has(m.answerId));
  if (aiConfigured() && needOnline.length) {
    try {
      const byQ = await findOnlineReferences(
        needOnline.map((m) => ({
          questionId: m.q.id,
          questionText: m.q.questionText,
          courseTitle: quiz.course_title || quiz.title,
        })),
      );
      for (const m of needOnline) {
        for (const ref of byQ[m.q.id] || []) {
          await query(
            `INSERT INTO answer_references (member_answer_id, kind, title, url)
             VALUES ($1,'online',$2,$3)`,
            [m.answerId, ref.title, ref.url],
          );
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[grade ${attemptId}] online references failed:`, err.message);
    }
  }

  const percentage = maxTotal > 0 ? Math.round((total / maxTotal) * 1000) / 10 : 0;
  const aiSummary = await buildDiagnosticSummary({ attemptId, quiz, percentage }).catch(() => null);

  await query(
    `UPDATE quiz_attempts
        SET status='completed', score=$2, max_score=$3, percentage=$4, completed_at=now(), ai_summary=$5
      WHERE id=$1`,
    [attemptId, total, maxTotal, percentage, aiSummary],
  );

  await notify(row.member_id, {
    title: `Result ready: ${row.quiz_title}`,
    message: `You scored ${percentage}% (${round(total)}/${round(maxTotal)}) on ${row.quiz_title}${auto ? ' — auto-submitted when time expired' : ''}.`,
    type: 'grade',
    linkTarget: `/member/results/${attemptId}`,
  });
}

function fallbackShortAnswer(q, answerText, errMsg) {
  const given = (answerText || '').trim().toLowerCase();
  const expected = String(q.correctAnswer || '').trim().toLowerCase();

  // No answer key and no AI to fall back on — leave it for the leader.
  if (!expected) {
    return {
      score: 0,
      maxScore: q.marks,
      evaluation: 'This question has no answer key and automated grading was unavailable — it needs a leader review.',
      feedback: 'Awaiting leader review.',
      correctAnswer: '',
      references: [],
      model: 'pending-review',
      raw: { fallback: true, pendingReview: true, error: errMsg || null },
    };
  }

  let score = 0;
  if (given) {
    if (given === expected) score = q.marks;
    else if (expected.length > 3 && given.includes(expected)) score = Math.round(q.marks * 0.7 * 2) / 2;
  }
  return {
    score,
    maxScore: q.marks,
    evaluation: errMsg
      ? 'Automated evaluation was unavailable; graded by keyword match.'
      : 'Graded by keyword match (AI evaluation disabled).',
    feedback: score >= q.marks ? 'Correct.' : `Expected answer: ${q.correctAnswer}`,
    correctAnswer: q.correctAnswer,
    references: [],
    model: 'fallback',
    raw: { fallback: true, error: errMsg || null },
  };
}

async function buildDiagnosticSummary({ attemptId, quiz, percentage }) {
  if (!aiConfigured()) return null;
  const { rows } = await query(
    `SELECT q.question_text, sa.is_correct, sa.score, sa.max_score, q.type
       FROM member_answers sa JOIN questions q ON q.id = sa.question_id
      WHERE sa.attempt_id = $1`,
    [attemptId],
  );
  const wrong = rows.filter((r) => r.is_correct === false);
  if (wrong.length === 0) {
    return `Strong performance across all questions (${percentage}%). Keep it up.`;
  }
  try {
    const out = await chat({
      system: 'You write a 1-2 sentence study recommendation for a member based on which quiz questions they missed. Be specific and encouraging. No preamble.',
      user: `Quiz: ${quiz.title}. Score: ${percentage}%.
Missed questions:\n${wrong.map((w) => `- ${w.question_text}`).join('\n')}\n\nWrite the recommendation.`,
      temperature: 0.4,
      maxTokens: 160,
    });
    return out.trim().slice(0, 600);
  } catch {
    return `Focus your revision on the ${wrong.length} question(s) you missed.`;
  }
}

export async function getEvaluations(attemptId) {
  const { rows } = await query(
    `SELECT sa.question_id, sa.is_correct, sa.score, sa.max_score, sa.answer_text, sa.graded_by,
            q.question_text, q.type, q.correct_answer, q.explanation, q.marks,
            e.evaluation, e.feedback, e.correct_answer AS ai_correct_answer, e.model,
            qq.position
       FROM member_answers sa
       JOIN quiz_attempts a ON a.id = sa.attempt_id
       JOIN questions q ON q.id = sa.question_id
       LEFT JOIN quiz_questions qq ON qq.quiz_id = a.quiz_id AND qq.question_id = sa.question_id
       LEFT JOIN ai_evaluations e ON e.member_answer_id = sa.id
      WHERE sa.attempt_id = $1
      ORDER BY qq.position NULLS LAST, sa.updated_at`,
    [attemptId],
  );
  const out = [];
  for (const r of rows) {
    const refs = await query(
      `SELECT ar.kind, ar.title, ar.page_number, ar.snippet, ar.url, ar.material_id
         FROM answer_references ar
         JOIN member_answers sa ON sa.id = ar.member_answer_id
        WHERE sa.attempt_id = $1 AND sa.question_id = $2`,
      [attemptId, r.question_id],
    );
    out.push({
      questionId: r.question_id,
      type: r.type,
      questionText: r.question_text,
      yourAnswer: r.answer_text || '',
      isCorrect: r.is_correct,
      score: r.score != null ? Number(r.score) : 0,
      maxScore: r.max_score != null ? Number(r.max_score) : Number(r.marks),
      gradedBy: r.graded_by,
      explanation: r.explanation || '',
      correctAnswer: r.ai_correct_answer || r.correct_answer || '',
      aiEvaluation: r.evaluation || null,
      aiFeedback: r.feedback || null,
      references: refs.rows.map((x) => ({
        kind: x.kind,
        title: x.title,
        page: x.page_number,
        snippet: x.snippet,
        url: x.url,
        materialId: x.material_id,
      })),
    });
  }
  return out;
}

const round = (n) => Math.round(Number(n) * 10) / 10;

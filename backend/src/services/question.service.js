import { query, withTransaction } from '../db/pool.js';
import { errors } from '../utils/response.js';
import { chatJson } from '../lib/ai.js';
import { retrieveChunks } from '../lib/rag.js';
import * as S from './serialize.js';

const QUESTION_SELECT = `
  SELECT q.*, c.code AS course_code,
         m.filename AS material_filename, m.title AS material_title, m.summary AS material_summary,
         (SELECT count(*) FROM quiz_questions qq WHERE qq.question_id = q.id) AS quizzes_used_count
    FROM questions q
    JOIN courses c ON c.id = q.course_id
    LEFT JOIN materials m ON m.id = q.material_id`;

export async function getQuestionFull(id) {
  const { rows } = await query(`${QUESTION_SELECT} WHERE q.id = $1`, [id]);
  if (!rows[0]) return null;
  const opts = await query(
    'SELECT * FROM question_options WHERE question_id = $1 ORDER BY position',
    [id],
  );
  return { row: rows[0], options: opts.rows };
}

export async function serializeQuestion(id) {
  const full = await getQuestionFull(id);
  return full ? S.question(full.row, full.options) : null;
}

/**
 * Validate + normalise an incoming question payload for a given type.
 * Returns { correctAnswer, options: [{content, isCorrect}] }.
 *
 * The answer key is OPTIONAL for every type. When it is left blank the question
 * is graded by the AI evaluator at correction time (against the question text
 * and the leader's course material) instead of by a deterministic match.
 */
export function normaliseQuestionInput(type, body) {
  if (type === 'multiple_choice') {
    const options = (body.options || []).map((o) => String(o).trim()).filter(Boolean);
    if (options.length < 2) throw errors.validation('Multiple choice needs at least 2 options');
    const correct = String(body.correctAnswer || '').trim();
    // A key is optional, but if one is given it must be one of the options.
    if (correct && !options.includes(correct)) {
      throw errors.validation('correctAnswer must match one of the options');
    }
    return {
      correctAnswer: correct,
      options: options.map((content) => ({ content, isCorrect: Boolean(correct) && content === correct })),
    };
  }
  if (type === 'true_false') {
    const raw = String(body.correctAnswer ?? '').trim();
    // Blank -> no key -> AI-graded. Only 'true'/'false' set a key.
    const correct = raw === '' ? '' : /^true$/i.test(raw) ? 'True' : 'False';
    return {
      correctAnswer: correct,
      options: [
        { content: 'True', isCorrect: correct === 'True' },
        { content: 'False', isCorrect: correct === 'False' },
      ],
    };
  }
  // short_answer — a model answer helps the AI but is not required.
  const model = String(body.correctAnswer || '').trim();
  return { correctAnswer: model, options: [] };
}

export async function createQuestion({ courseId, createdBy, body, aiGenerated = false }) {
  const { correctAnswer, options } = normaliseQuestionInput(body.type, body);
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO questions
        (course_id, created_by, type, difficulty, question_text, correct_answer, marking_guidance, marks, explanation, material_id, material_page, tags, ai_generated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [
        courseId,
        createdBy,
        body.type,
        body.difficulty || 'Medium',
        body.questionText.trim(),
        correctAnswer,
        body.markingGuidance || '',
        body.marks || 1,
        body.explanation || '',
        body.materialId || null,
        body.materialPage || null,
        body.tags || [],
        aiGenerated,
      ],
    );
    const id = rows[0].id;
    for (let i = 0; i < options.length; i++) {
      await client.query(
        'INSERT INTO question_options (question_id, position, content, is_correct) VALUES ($1,$2,$3,$4)',
        [id, i, options[i].content, options[i].isCorrect],
      );
    }
    return id;
  });
}

export async function updateQuestion(id, body) {
  const current = await getQuestionFull(id);
  if (!current) throw errors.notFound('Question not found');
  const type = body.type || current.row.type;
  const merged = {
    type,
    correctAnswer: body.correctAnswer ?? current.row.correct_answer,
    options: body.options ?? current.options.map((o) => o.content),
  };
  const { correctAnswer, options } = normaliseQuestionInput(type, merged);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE questions SET
         type=$2, difficulty=COALESCE($3,difficulty), question_text=COALESCE($4,question_text),
         correct_answer=$5, marking_guidance=COALESCE($6,marking_guidance), marks=COALESCE($7,marks),
         explanation=COALESCE($8,explanation), material_id=$9, material_page=$10, tags=COALESCE($11,tags)
       WHERE id=$1`,
      [
        id,
        type,
        body.difficulty ?? null,
        body.questionText ?? null,
        correctAnswer,
        body.markingGuidance ?? null,
        body.marks ?? null,
        body.explanation ?? null,
        body.materialId === undefined ? current.row.material_id : body.materialId,
        body.materialPage === undefined ? current.row.material_page : body.materialPage,
        body.tags ?? null,
      ],
    );
    await client.query('DELETE FROM question_options WHERE question_id = $1', [id]);
    for (let i = 0; i < options.length; i++) {
      await client.query(
        'INSERT INTO question_options (question_id, position, content, is_correct) VALUES ($1,$2,$3,$4)',
        [id, i, options[i].content, options[i].isCorrect],
      );
    }
  });
  return serializeQuestion(id);
}

/** AI: draft questions grounded in a material's chunks, then persist them. */
export async function generateQuestionsFromMaterial({ material, createdBy, count, difficulty, types }) {
  const chunks = await retrieveChunks(material.course_id, material.title + ' ' + material.summary, {
    topK: 8,
    minScore: 0,
  });
  const source = (chunks.length ? chunks : [])
    .map((c, i) => `[[${i + 1}]] (page ${c.page ?? 'n/a'})\n${c.content}`)
    .join('\n\n');

  if (!source) throw errors.badRequest('This material has no indexed content to generate from');

  const allowedTypes = types?.length ? types : ['multiple_choice', 'true_false', 'short_answer'];
  const payload = await chatJson({
    system:
      'You are a university leader writing rigorous assessment questions strictly grounded in the provided course material. Never invent facts not supported by the material. Respond with JSON only.',
    user: `From the COURSE MATERIAL below, write ${count} exam questions.
Allowed types: ${allowedTypes.join(', ')}. Difficulty: ${difficulty}.
Each question must be answerable from the material and cite the [[n]] block it came from.

COURSE MATERIAL:
${source.slice(0, 9000)}

Return JSON:
{
  "questions": [
    {
      "type": "multiple_choice | true_false | short_answer",
      "difficulty": "Easy | Medium | Hard",
      "questionText": "...",
      "options": ["...","...","...","..."],        // MCQ only, exactly 4
      "correctAnswer": "exact option text | True | False | model answer",
      "markingGuidance": "for short_answer: what earns marks",
      "explanation": "why the answer is correct, grounded in the material",
      "marks": 1-5,
      "sourceBlock": <n>
    }
  ]
}`,
    temperature: 0.4,
    maxTokens: 2200,
  });

  const drafts = Array.isArray(payload.questions) ? payload.questions : [];
  const created = [];
  for (const d of drafts.slice(0, count)) {
    if (!d?.questionText || !allowedTypes.includes(d.type)) continue;
    const block = Number(d.sourceBlock);
    const chunk = Number.isInteger(block) && chunks[block - 1] ? chunks[block - 1] : chunks[0];
    try {
      const id = await createQuestion({
        courseId: material.course_id,
        createdBy,
        aiGenerated: true,
        body: {
          type: d.type,
          difficulty: ['Easy', 'Medium', 'Hard'].includes(d.difficulty) ? d.difficulty : 'Medium',
          questionText: String(d.questionText).trim(),
          options: d.type === 'multiple_choice' ? d.options : undefined,
          correctAnswer: String(d.correctAnswer || '').trim(),
          markingGuidance: d.markingGuidance || '',
          explanation: d.explanation || '',
          marks: clampMarks(d.marks),
          materialId: material.id,
          materialPage: chunk?.page || null,
          tags: ['AI Generated'],
        },
      });
      created.push(await serializeQuestion(id));
    } catch {
      /* skip malformed draft */
    }
  }
  if (!created.length) throw errors.upstream('The AI did not return any usable questions — try again');
  return created;
}

function clampMarks(m) {
  const n = Number(m);
  if (!Number.isFinite(n)) return 2;
  return Math.max(1, Math.min(10, Math.round(n)));
}

export { QUESTION_SELECT };

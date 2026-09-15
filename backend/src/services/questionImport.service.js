import { extractText } from '../lib/extractText.js';
import { chatJson, aiConfigured } from '../lib/ai.js';
import { errors } from '../utils/response.js';

/**
 * Import pipeline: take a document a leader uploaded in *any* readable format,
 * have the AI pull every distinct question out of it, then hand the normalised
 * drafts back to the leader for review before anything is written to the bank.
 *
 * Nothing here persists — see question.service.createQuestion for the commit step.
 */

const TYPES = ['multiple_choice', 'true_false', 'short_answer'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

// extension -> extractText fileType. Anything not listed is attempted as UTF-8 text.
const EXT_TO_TYPE = {
  pdf: 'pdf',
  docx: 'docx',
  doc: 'docx',
  pptx: 'pptx',
  txt: 'txt',
  md: 'md',
  markdown: 'md',
  csv: 'csv',
  tsv: 'tsv',
  json: 'json',
  html: 'html',
  htm: 'html',
  rtf: 'rtf',
};

export function detectImportType(filename = '', mimetype = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (EXT_TO_TYPE[ext]) return EXT_TO_TYPE[ext];
  if (mimetype.includes('pdf')) return 'pdf';
  if (mimetype.includes('word') || mimetype.includes('officedocument.wordprocessing')) return 'docx';
  if (mimetype.includes('presentation')) return 'pptx';
  if (mimetype.includes('csv')) return 'csv';
  if (mimetype.includes('json')) return 'json';
  if (mimetype.includes('html')) return 'html';
  if (mimetype.startsWith('text/')) return 'txt';
  return 'txt'; // last resort — read it as text and let the AI cope
}

const MAX_WINDOWS = 14;

/**
 * Break a long document into overlapping windows so no question is lost.
 * Returns { windows, truncated } — truncated is true when the source was longer
 * than the window budget and the tail was dropped.
 */
function windowText(text, { size = 6000, overlap = 600 } = {}) {
  const clean = String(text || '').trim();
  if (!clean) return { windows: [], truncated: false };
  if (clean.length <= size) return { windows: [clean], truncated: false };
  const windows = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    // prefer to break on a paragraph / line boundary
    if (end < clean.length) {
      const nl = clean.lastIndexOf('\n', end);
      if (nl > start + size * 0.5) end = nl;
    }
    windows.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = end - overlap;
  }
  const truncated = windows.length > MAX_WINDOWS;
  return { windows: windows.slice(0, MAX_WINDOWS), truncated };
}

const SYSTEM_PROMPT =
  'You extract exam questions from a document a university leader uploaded. ' +
  'The document may be a question paper, a Word file, a slide deck, a spreadsheet export, ' +
  'a past paper, or rough leader notes. Identify EVERY distinct question. ' +
  'Do not invent questions and do not merge two questions into one. ' +
  'Classify each as multiple_choice, true_false, or short_answer. ' +
  'Copy option text and any marked/underlined/bold answer key exactly as written. ' +
  'If no answer key is present in the source, leave correctAnswer empty. ' +
  'Respond with JSON only.';

function userPrompt(source, hint) {
  return `Extract all exam questions from the SOURCE below.${hint ? `\nContext from the leader: ${hint}` : ''}

Rules:
- multiple_choice: put every choice in "options" (2-8), keep wording verbatim. "correctAnswer" must be the exact text of the right option, or "" if the source does not mark one.
- true_false: "correctAnswer" is "True", "False", or "" if not given.
- short_answer / essay / fill-in-the-blank: use "short_answer". Put any model answer in "correctAnswer" (or "") and any mark scheme in "markingGuidance".
- "marks": use the marks shown in the source if any (e.g. "(5 marks)"), else estimate 1-5.
- Keep the original numbering out of "questionText".

SOURCE:
${source}

Return JSON:
{
  "questions": [
    {
      "type": "multiple_choice | true_false | short_answer",
      "difficulty": "Easy | Medium | Hard",
      "questionText": "...",
      "options": ["...","..."],
      "correctAnswer": "",
      "markingGuidance": "",
      "explanation": "",
      "marks": 1,
      "answerKeyFound": true
    }
  ]
}`;
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function clampMarks(m) {
  const n = Math.round(Number(m));
  return Number.isFinite(n) ? Math.max(1, Math.min(20, n)) : 1;
}

/**
 * Validate/normalise one raw AI draft the same way the create endpoint would,
 * but without throwing — issues are reported so the leader can fix them in the
 * review UI.
 * @returns {{draft:object, issues:string[], status:'ready'|'needs_review'}}
 */
export function normaliseDraft(raw, index) {
  const issues = [];
  const type = TYPES.includes(raw?.type) ? raw.type : 'short_answer';
  if (!TYPES.includes(raw?.type)) issues.push('Question type was unclear — defaulted to short answer.');

  const questionText = String(raw?.questionText || '').trim();
  if (questionText.length < 5) issues.push('Question text is missing or too short.');

  let options = Array.isArray(raw?.options)
    ? raw.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 8)
    : [];
  let correctAnswer = String(raw?.correctAnswer ?? '').trim();

  if (type === 'multiple_choice') {
    // de-duplicate options
    options = [...new Set(options)];
    if (options.length < 2) {
      issues.push('Multiple-choice question has fewer than 2 options — add options or change the type.');
    }
    if (correctAnswer && !options.includes(correctAnswer)) {
      // try a loose match
      const hit = options.find((o) => normKey(o) === normKey(correctAnswer));
      if (hit) correctAnswer = hit;
      else {
        issues.push('The answer key did not match any option — it was cleared (the AI will grade this).');
        correctAnswer = '';
      }
    }
  } else if (type === 'true_false') {
    options = [];
    if (correctAnswer) {
      correctAnswer = /^t(rue)?$/i.test(correctAnswer)
        ? 'True'
        : /^f(alse)?$/i.test(correctAnswer)
          ? 'False'
          : '';
      if (!correctAnswer) issues.push('True/False answer key was not "True" or "False" — cleared.');
    }
  } else {
    options = [];
  }

  const difficulty = DIFFICULTIES.includes(raw?.difficulty) ? raw.difficulty : 'Medium';

  const draft = {
    tempId: `d${index}`,
    type,
    difficulty,
    questionText,
    options,
    correctAnswer,
    markingGuidance: String(raw?.markingGuidance || '').trim().slice(0, 2000),
    explanation: String(raw?.explanation || '').trim().slice(0, 4000),
    marks: clampMarks(raw?.marks),
    hasAnswerKey: Boolean(correctAnswer),
    include: questionText.length >= 5,
  };

  const status = issues.length === 0 ? 'ready' : 'needs_review';
  return { draft, issues, status };
}

/**
 * Read a document buffer (or raw text) and return reviewed-but-unsaved question drafts.
 * @param {{buffer?:Buffer, fileType?:string, text?:string, filename?:string, hint?:string}} input
 */
export async function extractQuestionDrafts({ buffer, fileType, text, filename, hint }) {
  if (!aiConfigured()) {
    throw errors.unavailable('AI is not configured on this server — question import is unavailable.');
  }

  let source = '';
  let pageCount = 1;
  if (text && text.trim()) {
    source = text.trim();
  } else if (buffer) {
    try {
      const extracted = await extractText(buffer, fileType);
      source = extracted.pages.map((p) => p.text).join('\n\n').trim();
      pageCount = extracted.pageCount || 1;
    } catch (err) {
      throw errors.badRequest(
        `Could not read this file (${fileType}). ${String(err.message || err).slice(0, 160)}`,
      );
    }
  }

  if (source.length < 20) {
    throw errors.badRequest('No readable text was found in this document.');
  }

  const { windows, truncated } = windowText(source);
  const seen = new Map();
  const collected = [];
  let aiCalls = 0;

  for (const win of windows) {
    let payload;
    try {
      payload = await chatJson({
        system: SYSTEM_PROMPT,
        user: userPrompt(win, hint),
        temperature: 0.15,
        maxTokens: 4000,
      });
      aiCalls++;
    } catch {
      continue; // one bad window shouldn't sink the whole import
    }
    const list = Array.isArray(payload?.questions) ? payload.questions : [];
    for (const q of list) {
      const key = normKey(q?.questionText);
      if (!key || seen.has(key)) continue;
      seen.set(key, true);
      collected.push(q);
      if (collected.length >= 120) break;
    }
    if (collected.length >= 120) break;
  }

  if (aiCalls === 0) {
    throw errors.upstream('The AI could not process this document — try again in a moment.');
  }

  const results = collected.map((raw, i) => normaliseDraft(raw, i));
  const drafts = results.map((r) => ({ ...r.draft, issues: r.issues, status: r.status }));

  return {
    drafts,
    meta: {
      filename: filename || null,
      characters: source.length,
      windows: windows.length,
      pageCount,
      truncated,
    },
    stats: {
      found: drafts.length,
      ready: drafts.filter((d) => d.status === 'ready').length,
      needsReview: drafts.filter((d) => d.status === 'needs_review').length,
      withAnswerKey: drafts.filter((d) => d.hasAnswerKey).length,
    },
  };
}

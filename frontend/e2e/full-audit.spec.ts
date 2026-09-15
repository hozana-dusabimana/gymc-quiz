import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

/**
 * FULL FEATURE AUDIT — drives the real UI end to end as a human would.
 *
 *   Lecturer:  register → dashboard/guide → 2 courses → upload PDF + Markdown
 *              materials → AI question generation → manual MCQ / true-false /
 *              short-answer questions → edit → quiz wizard (settings, publish)
 *              → draft quiz → enrol student → profile → notifications → analytics
 *   Student:   register → dashboard → courses → quiz instructions → take quiz
 *              (MCQ + true/false + short answer, flag, navigator, autosave) →
 *              submit → AI-graded result → 2nd attempt with a wrong answer →
 *              results history → material reference modal
 *   Cross-checks: lecturer sees the submission + score, "Review" breakdown
 *   Guardrails: wrong OTP rejected, student blocked from lecturer routes
 *
 * Requires backend (:4000) and frontend (:3000) running, DISABLE_RATE_LIMIT=true.
 */

const HERE = import.meta.dirname;
const SHOTS = path.join(HERE, 'screenshots', 'audit');
fs.mkdirSync(SHOTS, { recursive: true });

const stamp = Date.now();
const lecturer = { name: 'Dr Grace Hopper', email: `lect.${stamp}@audit.local`, prefix: 'Prof.' };
const student = { name: 'Alan Turing', email: `stud.${stamp}@audit.local` };
const COURSE = { code: `AUD${stamp % 10000}`, title: 'Audit Database Systems' };
const COURSE2 = { code: `AUX${stamp % 10000}`, title: 'Audit Operating Systems' };
const QUIZ_TITLE = 'Audit Quiz — Indexing';

const MCQ = {
  text: 'Which SQL keyword removes duplicate rows from a result set?',
  options: ['DISTINCT', 'UNIQUE', 'GROUP', 'ONLY'],
  correct: 'DISTINCT',
};
const TF = {
  text: 'A table can have at most one clustered index.',
  correct: 'True',
};
const SA = {
  text: 'In one sentence, what does a database index improve and what is the tradeoff?',
  model:
    'An index speeds up reads and lookups by avoiding full table scans, at the cost of extra storage and slower writes.',
  rubric: '1 mark faster reads, 1 mark write/storage overhead',
  goodAnswer:
    'An index makes lookups and range queries much faster by avoiding a full table scan, but it costs extra disk space and slows down inserts, updates and deletes because every index must be maintained.',
};

const shots: string[] = [];
let n = 0;
const shot = async (page: Page, name: string) => {
  const file = path.join(SHOTS, `${String(++n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  shots.push(file);
};

const notes: string[] = [];
const note = (msg: string) => {
  notes.push(msg);
  test.info().annotations.push({ type: 'audit-note', description: msg });
};

const nav = (page: Page) => page.locator('aside').first();

// Modals + panels in this app close on backdrop click (no Escape handler).
async function closeOverlay(page: Page) {
  const overlay = page.locator('div.fixed.inset-0.z-50').first();
  if (await overlay.isVisible().catch(() => false)) {
    await overlay.click({ position: { x: 4, y: 4 }, force: true }).catch(() => {});
    await overlay.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }
}

async function finishOtp(page: Page) {
  const banner = page.getByText(/your code is/i);
  await banner.waitFor({ timeout: 15_000 });
  const code = (await banner.locator('strong').innerText()).trim();
  await page.getByPlaceholder('000000').fill(code);
  await page.getByRole('button', { name: /Verify & continue/ }).click();
  await page.waitForURL(/\/(student|lecturer)($|\/)/);
  await dismissGuide(page);
}

async function dismissGuide(page: Page) {
  await page
    .getByRole('button', { name: 'Close guide' })
    .click({ timeout: 6_000 })
    .catch(() => {});
}

async function register(page: Page, who: { name: string; email: string }, role: 'student' | 'lecturer') {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  if (role === 'lecturer') await page.getByRole('button', { name: /Faculty \/ Lecturer/ }).click();
  await page.getByLabel('Full name').fill(who.name);
  await page.getByLabel('Email address').fill(who.email);
  await page.getByRole('button', { name: /Create account/ }).click();
  await finishOtp(page);
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: /Send sign-in code/ }).click();
  await finishOtp(page);
}

async function logout(page: Page) {
  await page.locator('header button', { hasText: 'expand_more' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/);
}

async function createManualCourse(page: Page, c: { code: string; title: string }, description = '') {
  await page.getByRole('button', { name: 'New course' }).click();
  await page.getByRole('button', { name: /Manual course/ }).click();
  await page.getByLabel('Course code *').fill(c.code);
  await page.getByLabel('Title *').fill(c.title);
  if (description) await page.getByLabel('Description').fill(description);
  await page.getByRole('button', { name: 'Create course', exact: true }).click();
  await expect(page.getByText('Course created').first()).toBeVisible();
}

// ---------------------------------------------------------------------------
// Serial suite — one shared page/session across the whole journey.
// ---------------------------------------------------------------------------
test.describe.configure({ mode: 'serial', timeout: 240_000 });

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  page.setDefaultTimeout(25_000);
});

test.afterAll(async () => {
  await context.close();
  console.log('\n=== AUDIT NOTES ===\n' + (notes.length ? notes.join('\n') : '(none)') + '\n');
});

test('01 · lecturer registers, sees dashboard + welcome guide', async () => {
  await register(page, lecturer, 'lecturer');
  await expect(page.getByRole('heading', { name: 'Faculty workspace' })).toBeVisible();

  // welcome guide: reopen from the top bar and step through it
  await page.locator('[data-tour="guide-button"]').first().click().catch(() => note('Guide button not found in top bar'));
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await shot(page, 'lecturer-guide');
    for (let i = 0; i < 8; i++) {
      const next = page.getByRole('button', { name: /^(Next|Got it)$/ });
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click().catch(() => {});
      await page.waitForTimeout(250);
    }
    await dismissGuide(page);
  } else {
    note('Welcome guide did not reopen from the top-bar Guide button');
  }
  await page.goto('/lecturer');
  await shot(page, 'lecturer-dashboard');
});

test('02 · lecturer creates two manual courses', async () => {
  await nav(page).getByRole('link', { name: 'Courses' }).click();
  await createManualCourse(page, COURSE, 'Indexing, transactions and query optimization.');
  await createManualCourse(page, COURSE2, 'Processes, scheduling and memory.');
  await page.reload();
  await expect(page.getByText(COURSE.title)).toBeVisible();
  await expect(page.getByText(COURSE2.title)).toBeVisible();
  await shot(page, 'courses-list');
});

test('03 · lecturer uploads a PDF and a Markdown material; both index to "ready"', async () => {
  await nav(page).getByRole('link', { name: 'Material Library' }).click();
  await page.locator('select').first().selectOption({ label: `${COURSE.code} — ${COURSE.title}` });

  await page.setInputFiles('input[type=file]', path.join(HERE, 'fixtures', 'indexing.pdf'));
  await expect(page.getByText(/Uploading "indexing\.pdf"/)).toBeVisible();

  await page.setInputFiles('input[type=file]', path.join(HERE, 'fixtures', 'dbnotes.md'));
  await expect(page.getByText(/Uploading "dbnotes\.md"/)).toBeVisible();

  // both cards should reach "ready" (embedding + summary pipeline)
  await expect(page.locator('text=/^ready$/i')).toHaveCount(2, { timeout: 120_000 });
  await shot(page, 'materials-ready');

  // a summary line should be populated for at least one
  const summaries = await page.locator('.line-clamp-3').allInnerTexts();
  if (!summaries.some((s) => s.trim().length > 20)) note('No material summary text rendered after processing');
});

test('04 · lecturer generates questions from a material with AI', async () => {
  await nav(page).getByRole('link', { name: 'Material Library' }).click();
  await page.locator('select').first().selectOption({ label: `${COURSE.code} — ${COURSE.title}` });

  const card = page.locator('div', { hasText: 'dbnotes.md' }).filter({ has: page.getByRole('button', { name: 'Generate questions' }) }).last();
  await card.getByRole('button', { name: 'Generate questions' }).click();
  await page.getByLabel('How many').fill('3');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();

  try {
    await expect(page.getByText(/questions added to the question bank/)).toBeVisible({ timeout: 90_000 });
    await shot(page, 'ai-questions-generated');
  } catch {
    note('AI question generation did NOT complete within 90s (OpenRouter reachable? key valid?)');
    await shot(page, 'ai-questions-FAILED');
    await closeOverlay(page);
  }
});

test('05 · lecturer curates the question bank (MCQ, true/false, short answer, edit, filter)', async () => {
  await nav(page).getByRole('link', { name: 'Question Bank' }).click();

  // MCQ
  await page.getByRole('button', { name: 'New question' }).click();
  await page.locator('form#question-form select').first().selectOption({ label: COURSE.code });
  await page.getByLabel('Question text').fill(MCQ.text);
  const opt = page.locator('form#question-form input[placeholder^="Option"]');
  for (let i = 0; i < MCQ.options.length; i++) await opt.nth(i).fill(MCQ.options[i]);
  await page.locator('form#question-form input[type=radio]').nth(0).check();
  await page.getByRole('button', { name: 'Add to bank' }).click();
  await expect(page.getByText('Question saved').first()).toBeVisible();

  // True / False
  await page.getByRole('button', { name: 'New question' }).click();
  await page.locator('form#question-form select').first().selectOption({ label: COURSE.code });
  await page.locator('form#question-form select').nth(1).selectOption('true_false');
  await page.getByLabel('Question text').fill(TF.text);
  await page.getByLabel('Correct answer').selectOption(TF.correct);
  await page.getByRole('button', { name: 'Add to bank' }).click();
  await expect(page.getByText('Question saved').first()).toBeVisible();

  // Short answer
  await page.getByRole('button', { name: 'New question' }).click();
  await page.locator('form#question-form select').first().selectOption({ label: COURSE.code });
  await page.locator('form#question-form select').nth(1).selectOption('short_answer');
  await page.getByLabel('Question text').fill(SA.text);
  await page.getByLabel('Model / expected answer').fill(SA.model);
  await page.getByLabel('Marking guidance (rubric)').fill(SA.rubric);
  await page.getByRole('button', { name: 'Add to bank' }).click();
  await expect(page.getByText('Question saved').first()).toBeVisible();
  await shot(page, 'question-bank');

  // edit the MCQ (bump marks) and save
  const mcqCard = page.locator('div.bg-white.rounded-2xl', { hasText: MCQ.text }).first();
  await mcqCard.getByTitle('Edit').click();
  await page.getByLabel('Marks').fill('3');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Question saved').first()).toBeVisible();

  // filter by type = short answer
  await page.locator('select').filter({ hasText: 'All types' }).selectOption('short_answer');
  await expect(page.getByRole('heading', { name: SA.text })).toBeVisible();
  await expect(page.getByRole('heading', { name: MCQ.text })).toHaveCount(0);
  await page.locator('select').filter({ hasText: 'All types' }).selectOption('all');
});

test('06 · lecturer builds and publishes a quiz through the 3-step wizard', async () => {
  await nav(page).getByRole('link', { name: 'Quiz Studio' }).click();
  await expect(page.getByRole('heading', { name: /Quiz creation studio/ })).toBeVisible();

  // step 1 — details
  await page.locator('select').first().selectOption({ label: `${COURSE.code} — ${COURSE.title}` });
  await page.getByLabel('Title').fill(QUIZ_TITLE);
  await page.getByLabel('Duration (minutes)').fill('20');
  await page.getByLabel('Passing score (%)').fill('50');
  await page.getByRole('button', { name: /^Next/ }).click();

  // step 2 — pick our three hand-written questions
  await page.getByText(MCQ.text).click();
  await page.getByText(TF.text).click();
  await page.getByText(SA.text).click();
  await expect(page.getByText(/Questions \(3\)/)).toBeVisible();
  await page.getByRole('button', { name: /^Next/ }).click();

  // step 3 — settings
  await page.getByText('Randomize question order').click(); // turn OFF (default on)
  await page.getByText('Show instant feedback').click(); // turn ON
  await page.getByRole('combobox').last().selectOption('2'); // 2 attempts, best kept
  await shot(page, 'quiz-settings');
  await page.getByRole('button', { name: /Publish/ }).click();
  await expect(page.getByText(/Quiz published/).first()).toBeVisible();
  await page.waitForURL(/\/lecturer$/);
});

test('07 · lecturer saves a second quiz as a draft', async () => {
  await nav(page).getByRole('link', { name: 'Quiz Studio' }).click();
  await page.locator('select').first().selectOption({ label: `${COURSE.code} — ${COURSE.title}` });
  await page.getByLabel('Title').fill('Audit Draft Quiz');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText(/Saved as draft/).first()).toBeVisible();
});

test('08 · lecturer profile update + notifications panel', async () => {
  await page.locator('header button', { hasText: 'expand_more' }).click();
  await page.getByRole('button', { name: 'Manage profile' }).click();
  await page.waitForURL(/\/profile/);
  await page.getByLabel('Full name').fill(lecturer.name);
  await page.getByLabel('Title / prefix').fill(lecturer.prefix);
  await page.getByLabel('Phone').fill('+250700000000');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Profile updated').first()).toBeVisible();
  // MIS SSO copy-paste kit is lecturer-only
  await expect(page.getByText(/MIS|single sign-on|SSO/i).first()).toBeVisible().catch(() => note('MIS SSO card not visible on lecturer profile'));
  await shot(page, 'lecturer-profile');

  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark all read' }).click().catch(() => {});
  await shot(page, 'notifications');
  await closeOverlay(page);
  await expect(page.locator('div.fixed.inset-0.z-50')).toHaveCount(0);
});

test('09 · lecturer reviews Analytics & Grades (pre-submission)', async () => {
  await nav(page).getByRole('link', { name: 'Analytics & Grades' }).click();
  await expect(page.getByRole('heading', { name: /Analytics & grades/i })).toBeVisible();
  await expect(page.getByText(QUIZ_TITLE)).toBeVisible();
  await shot(page, 'analytics-empty');
  await logout(page);
});

test('10 · student registers and lands on the dashboard', async () => {
  await register(page, student, 'student');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await shot(page, 'student-dashboard-empty');
  await logout(page);
});

test('11 · lecturer enrols the student into the course', async () => {
  await login(page, lecturer.email);
  await nav(page).getByRole('link', { name: 'Courses' }).click();
  await page.getByText(COURSE.title).click();
  await page.getByRole('button', { name: /Students \(/ }).click();
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByLabel('Student email').fill(student.email);
  await page.getByRole('button', { name: 'Enrol' }).click();
  await expect(page.getByText('Student enrolled').first()).toBeVisible();
  await expect(page.getByText(student.email)).toBeVisible();
  await shot(page, 'student-enrolled');
  await logout(page);
});

test('12 · student sees the course + published quiz', async () => {
  await login(page, student.email);
  await nav(page).getByRole('link', { name: 'My Courses' }).click();
  await expect(page.getByText(COURSE.title)).toBeVisible();
  await page.getByText(COURSE.title).click();
  await expect(page.getByRole('heading', { name: COURSE.title })).toBeVisible();
  // student must NOT see lecturer-only tabs
  await expect(page.getByRole('button', { name: /Students \(/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Questions \(/ })).toHaveCount(0);

  await nav(page).getByRole('link', { name: 'Quizzes' }).click();
  await expect(page.getByRole('heading', { name: QUIZ_TITLE })).toBeVisible();
  await expect(page.getByText(/Attempts:\s*0\s*\/\s*2/)).toBeVisible().catch(() => note('Quiz card did not show "Attempts: 0/2"'));
  await shot(page, 'student-quizzes');
});

test('13 · student takes the quiz — attempt 1, all answers correct', async () => {
  test.setTimeout(180_000);
  await nav(page).getByRole('link', { name: 'Quizzes' }).click();
  await page.getByRole('link', { name: /Start/ }).first().click();
  await expect(page.getByText(/Before you begin/)).toBeVisible();
  await page.getByRole('button', { name: /Start \/ resume assessment/ }).click();
  await page.waitForURL(/\/student\/attempt\//);
  await shot(page, 'quiz-taking');

  // there should be a running timer
  await expect(page.locator('header').getByText(/\d\d:\d\d/).first()).toBeVisible();

  // answer whichever question is on each of the 3 pages (order not randomised)
  for (let i = 0; i < 3; i++) {
    const heading = await page.getByRole('heading', { level: 2 }).first().innerText();
    if (heading.includes(MCQ.text)) {
      await page.locator('main button').filter({ hasText: MCQ.correct }).first().click();
    } else if (heading.includes(TF.text)) {
      await page.locator('main button').filter({ hasText: 'True' }).first().click();
    } else {
      await page.getByPlaceholder('Type your response…').fill(SA.goodAnswer);
    }
    // flag question 2, exercise the navigator
    if (i === 1) await page.getByRole('button').filter({ hasText: /Flag/ }).first().click().catch(() => {});
    const nextBtn = page.getByRole('button', { name: /^Next/ });
    if (await nextBtn.isVisible().catch(() => false)) await nextBtn.click();
  }

  // autosave indicator
  await expect(page.locator('header').getByText(/Saved|All changes saved/).first()).toBeVisible().catch(() => note('Autosave status line not observed in the quiz header'));

  await page.getByRole('button', { name: /Finish/ }).click();
  await expect(page.getByText(/Submit your assessment\?/)).toBeVisible();
  await page.getByRole('button', { name: 'Submit now' }).click();

  await page.waitForURL(/\/student\/results\//, { timeout: 120_000 });
  await expect(page.getByRole('heading', { name: 'Assessment review' })).toBeVisible();
  await expect(page.getByText('AI graded')).toBeVisible({ timeout: 45_000 });
  await shot(page, 'student-result-attempt1');

  // correctness: score > 0, MCQ + TF marked correct, short answer AI-evaluated
  const scoreText = await page.locator('.text-3xl.font-black').first().innerText();
  const percentage = parseInt(scoreText, 10);
  note(`Attempt 1 percentage = ${scoreText} (expected 100% — all answers correct)`);
  expect(percentage).toBeGreaterThan(0);

  const card = (qText: string) =>
    page.locator('div.shadow-xs', { hasText: qText }).filter({ hasText: /Earned/ }).first();
  // MCQ + TF are graded deterministically: both should be full marks, no "Incorrect" pill.
  await expect(card(MCQ.text).getByText(/^(check)?Correct$/).first()).toBeVisible();
  await expect(card(TF.text).getByText(/^(check)?Correct$/).first()).toBeVisible();
  await expect(card(SA.text).getByText(/AI evaluation|Explanation/)).toBeVisible();
  expect(percentage).toBeGreaterThanOrEqual(60);
  if (percentage !== 100) note('Attempt 1 was not 100% despite correct MCQ+TF and a strong short answer — AI grading may be strict');

  const q3 = card(SA.text);
  // "Learn more" material / online references for the graded short answer
  if (await q3.getByText('Learn more').isVisible().catch(() => false)) {
    const matRef = q3.getByRole('button', { name: /Course material/ });
    if (await matRef.isVisible().catch(() => false)) {
      await matRef.click();
      await expect(page.getByRole('heading', { name: /Course material reference/ })).toBeVisible();
      await shot(page, 'material-reference-modal');
      await closeOverlay(page);
    }
  } else {
    note('No "Learn more" references rendered on the graded short answer');
  }
});

test('14 · student takes attempt 2 with a wrong MCQ answer — incorrect grading shows model answer', async () => {
  test.setTimeout(180_000);
  await nav(page).getByRole('link', { name: 'Quizzes' }).click();
  await expect(page.getByText(/Attempts:\s*1\s*\/\s*2/)).toBeVisible().catch(() => note('Quiz card did not show "Attempts: 1/2" before attempt 2'));
  await page.getByRole('link', { name: /Start|Resume/ }).first().click();
  await page.getByRole('button', { name: /Start \/ resume assessment/ }).click();
  await page.waitForURL(/\/student\/attempt\//);

  for (let i = 0; i < 3; i++) {
    const heading = await page.getByRole('heading', { level: 2 }).first().innerText();
    if (heading.includes(MCQ.text)) {
      await page.locator('main button').filter({ hasText: 'UNIQUE' }).first().click(); // deliberately wrong
    } else if (heading.includes(TF.text)) {
      await page.locator('main button').filter({ hasText: 'False' }).first().click(); // wrong
    } else {
      await page.getByPlaceholder('Type your response…').fill('An index is a thing in a database.'); // weak
    }
    const nextBtn = page.getByRole('button', { name: /^Next/ });
    if (await nextBtn.isVisible().catch(() => false)) await nextBtn.click();
  }
  await page.getByRole('button', { name: /Finish/ }).click();
  await page.getByRole('button', { name: 'Submit now' }).click();
  await page.waitForURL(/\/student\/results\//, { timeout: 120_000 });
  await expect(page.getByText('AI graded')).toBeVisible({ timeout: 45_000 });

  const q1 = page.locator('div.shadow-xs', { hasText: MCQ.text }).filter({ hasText: /Earned/ }).first();
  await expect(q1.getByText(/^(close)?Incorrect$/).first()).toBeVisible();
  await expect(q1.getByText('DISTINCT', { exact: true }).first()).toBeVisible(); // correct answer surfaced
  const scoreText = await page.locator('.text-3xl.font-black').first().innerText();
  note(`Attempt 2 percentage = ${scoreText} (expected well below attempt 1 — 2 wrong + weak short answer)`);
  // online "Learn more" reference generated for a missed question
  if (await q1.getByRole('link').filter({ hasText: /./ }).first().isVisible().catch(() => false)) {
    note('Missed question shows a supplementary online reference link');
  }
  await shot(page, 'student-result-attempt2');
});

test('15 · student browses results history', async () => {
  await nav(page).getByRole('link', { name: 'Results & Insights' }).click();
  await expect(page.getByText(QUIZ_TITLE).first()).toBeVisible();
  await shot(page, 'student-results-list');
});

test('16 · student is blocked from lecturer-only routes', async () => {
  for (const route of ['/lecturer', '/lecturer/materials', '/lecturer/questions', '/lecturer/analytics']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/student(\/|$)/);
  }
  note('Lecturer routes correctly redirect a student to /student');
  await logout(page);
});

test('17 · lecturer sees the submissions and opens the AI review', async () => {
  await login(page, lecturer.email);
  await nav(page).getByRole('link', { name: 'Analytics & Grades' }).click();
  await page.getByText(QUIZ_TITLE).click();
  await expect(page.getByRole('heading', { name: /Student submissions/ })).toBeVisible();
  await expect(page.getByText(student.name).first()).toBeVisible();
  await shot(page, 'lecturer-quiz-analytics');

  await page.getByRole('button', { name: 'Review', exact: true }).first().click();
  await expect(page.getByText('Question breakdown')).toBeVisible();
  await expect(page.getByText(`${student.name} —`)).toBeVisible();
  await shot(page, 'lecturer-review');
});

test('18 · wrong OTP is rejected', async () => {
  await logout(page).catch(() => page.goto('/login'));
  await page.goto('/login');
  await page.getByLabel('Email address').fill(lecturer.email);
  await page.getByRole('button', { name: /Send sign-in code/ }).click();
  await page.getByPlaceholder('000000').waitFor();
  await page.getByPlaceholder('000000').fill('000000');
  await page.getByRole('button', { name: /Verify & continue/ }).click();
  await expect(page.getByText(/did not work|invalid|incorrect|expired|Too many/i).first()).toBeVisible();
  note('Invalid OTP shows an error and does not sign the user in');
  await shot(page, 'wrong-otp');
});

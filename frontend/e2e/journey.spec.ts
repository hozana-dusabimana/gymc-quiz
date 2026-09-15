import { test, expect, Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Full end-to-end journey through the real UI:
 * leader builds a course + material + questions + quiz, member takes it,
 * both sides review the AI-graded result.
 *
 * Requires the backend (:4000) and frontend dev server (:3000) already running.
 */

const HERE = import.meta.dirname;
const SHOTS = path.join(HERE, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

const stamp = Date.now();
const leader = { name: 'Dr Ada Lovelace', email: `leader.${stamp}@e2e.local` };
const member = { name: 'Charles Babbage', email: `member.${stamp}@e2e.local` };
const COURSE_CODE = `E2E${stamp % 10000}`;
const COURSE_TITLE = 'E2E Database Systems';

const nav = (page: Page) => page.locator('aside').first();

async function register(page: Page, who: { name: string; email: string }, role: 'member' | 'leader') {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  if (role === 'leader') {
    await page.getByRole('button', { name: /Faculty \/ Leader/ }).click();
  }
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

async function finishOtp(page: Page) {
  const banner = page.getByText(/your code is/i);
  await banner.waitFor();
  const code = (await banner.locator('strong').innerText()).trim();
  await page.getByPlaceholder('000000').fill(code);
  await page.getByRole('button', { name: /Verify & continue/ }).click();
  await page.waitForURL(/\/(member|leader)($|\/)/);
  await dismissGuide(page);
}

// The first-login "Getting started" guide opens automatically over the dashboard.
async function dismissGuide(page: Page) {
  await page
    .getByRole('button', { name: 'Close guide' })
    .click({ timeout: 5_000 })
    .catch(() => {});
}

async function logout(page: Page) {
  await page.locator('header button', { hasText: 'expand_more' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/);
}

test('leader builds a quiz, member takes it, both review the result', async ({ page }) => {
  page.setDefaultTimeout(20_000);

  // ---------- LEADER: register + create course ----------
  await register(page, leader, 'leader');
  await expect(page.getByRole('heading', { name: 'Faculty workspace' })).toBeVisible();
  await shot(page, '01-leader-dashboard');

  await nav(page).getByRole('link', { name: 'Courses' }).click();
  await page.getByRole('button', { name: 'New course' }).click();
  await page.getByRole('button', { name: /Manual course/ }).click();
  await page.getByLabel('Course code *').fill(COURSE_CODE);
  await page.getByLabel('Title *').fill(COURSE_TITLE);
  await page.getByLabel('Description').fill('Indexing, transactions and query optimization.');
  await page.getByRole('button', { name: 'Create course', exact: true }).click();
  await expect(page.getByText('Course created').first()).toBeVisible();
  await shot(page, '02-course-created');

  // ---------- LEADER: upload a material ----------
  await nav(page).getByRole('link', { name: 'Material Library' }).click();
  await page.locator('select').first().selectOption({ label: `${COURSE_CODE} — ${COURSE_TITLE}` });
  await page.setInputFiles('input[type=file]', path.join(HERE, 'fixtures', 'indexing.pdf'));
  await expect(page.getByText(/Uploading "indexing.pdf"/)).toBeVisible();
  await expect(page.locator('text=/^ready$/i').first()).toBeVisible({ timeout: 90_000 });
  await shot(page, '03-material-ready');

  // ---------- LEADER: create questions ----------
  await nav(page).getByRole('link', { name: 'Question Bank' }).click();
  await page.getByRole('button', { name: 'New question' }).click();
  await page.getByLabel('Question text').fill('Which SQL keyword removes duplicate rows from a result set?');
  const opt = page.locator('form#question-form input[placeholder^="Option"]');
  await opt.nth(0).fill('DISTINCT');
  await opt.nth(1).fill('UNIQUE');
  await opt.nth(2).fill('GROUP');
  await opt.nth(3).fill('ONLY');
  await page.locator('form#question-form input[type=radio]').nth(0).check();
  await page.getByRole('button', { name: 'Add to bank' }).click();
  await expect(page.getByText('Question saved').first()).toBeVisible();

  await page.getByRole('button', { name: 'New question' }).click();
  await page.locator('form#question-form select').nth(1).selectOption('short_answer');
  await page.getByLabel('Question text').fill('In one sentence, what does a database index improve and what is the tradeoff?');
  await page
    .getByLabel('Model / expected answer')
    .fill('An index speeds up reads and lookups by avoiding full table scans, at the cost of extra storage and slower writes.');
  await page.getByLabel('Marking guidance (rubric)').fill('1 mark faster reads, 1 mark write/storage overhead');
  await page.getByRole('button', { name: 'Add to bank' }).click();
  await expect(page.getByText('Question saved').first()).toBeVisible();
  await shot(page, '04-question-bank');

  // ---------- LEADER: build + publish quiz ----------
  await nav(page).getByRole('link', { name: 'Quiz Studio' }).click();
  await page.getByLabel('Title').fill('E2E Quiz 1');
  await page.getByLabel('Duration (minutes)').fill('15');
  await page.getByRole('button', { name: /^Next/ }).click();
  await page.getByText('Which SQL keyword removes duplicate rows').click();
  await page.getByText('In one sentence, what does a database index improve').click();
  await page.getByRole('button', { name: /^Next/ }).click();
  // keep question order deterministic for this test
  await page.getByText('Randomize question order').click();
  await shot(page, '05-quiz-settings');
  await page.getByRole('button', { name: /Publish/ }).click();
  await expect(page.getByText('Quiz published').first()).toBeVisible();

  await logout(page);

  // ---------- MEMBER: register ----------
  await register(page, member, 'member');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await shot(page, '06-member-dashboard-empty');
  await logout(page);

  // ---------- LEADER: enrol member ----------
  await login(page, leader.email);
  await nav(page).getByRole('link', { name: 'Courses' }).click();
  await page.getByText(COURSE_TITLE).click();
  await page.getByRole('button', { name: /Members \(/ }).click();
  await page.getByRole('button', { name: 'Add member' }).click();
  await page.getByLabel('Member email').fill(member.email);
  await page.getByRole('button', { name: 'Enrol' }).click();
  await expect(page.getByText('Member enrolled').first()).toBeVisible();
  await shot(page, '07-member-enrolled');
  await logout(page);

  // ---------- MEMBER: take the quiz ----------
  await login(page, member.email);
  await nav(page).getByRole('link', { name: 'Quizzes' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Quiz 1' })).toBeVisible();
  await page.getByRole('link', { name: /Start/ }).first().click();
  await page.getByRole('button', { name: /Start \/ resume assessment/ }).click();
  await page.waitForURL(/\/member\/attempt\//);
  await shot(page, '08-quiz-taking');

  await page.getByRole('button', { name: 'DISTINCT' }).click();
  await page.getByRole('button', { name: /^Next/ }).click();
  await page
    .getByPlaceholder('Type your response…')
    .fill(
      'An index makes lookups and queries much faster by avoiding a full table scan, but it costs extra disk space and slows inserts and updates because the index must be maintained.',
    );
  await page.getByRole('button', { name: /Finish/ }).click();
  await page.getByRole('button', { name: 'Submit now' }).click();

  await page.waitForURL(/\/member\/results\//, { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Assessment review' })).toBeVisible();
  await expect(page.getByText('AI graded')).toBeVisible({ timeout: 30_000 });
  await shot(page, '09-member-result');
  const scoreText = await page.locator('.text-3xl.font-black').first().innerText();
  expect(parseInt(scoreText, 10)).toBeGreaterThan(0);

  await logout(page);

  // ---------- LEADER: review the member's attempt ----------
  await login(page, leader.email);
  await page.getByRole('button', { name: 'Analytics' }).first().click();
  await expect(page.getByText(member.name)).toBeVisible();
  await shot(page, '10-leader-analytics');
  await page.getByRole('button', { name: 'Review', exact: true }).first().click();
  await expect(page.getByText('Question breakdown')).toBeVisible();
  await shot(page, '11-leader-review');
});

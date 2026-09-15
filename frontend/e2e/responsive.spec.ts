import { test, expect, Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const HERE = import.meta.dirname;
const SHOTS = path.join(HERE, 'screenshots', 'responsive');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function noHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
  expect(overflow, `horizontal overflow on ${label}`).toBeLessThanOrEqual(2);
}

async function loginExisting(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: /Send sign-in code/ }).click();
  const banner = page.getByText(/your code is/i);
  await banner.waitFor();
  const code = (await banner.locator('strong').innerText()).trim();
  await page.getByPlaceholder('000000').fill(code);
  await page.getByRole('button', { name: /Verify & continue/ }).click();
  await page.waitForURL(/\/(student|lecturer)/);
  await dismissGuide(page);
}

// The first-login "Getting started" guide opens automatically over the dashboard.
async function dismissGuide(page: Page) {
  await page
    .getByRole('button', { name: 'Close guide' })
    .click({ timeout: 5_000 })
    .catch(() => {});
}

const stamp = Date.now();

test('responsive — auth + student journey at every breakpoint', async ({ browser }) => {
  // seed a lecturer + student + published quiz through the API layer of the UI once
  const setup = await browser.newPage();
  const lecturerEmail = `r.lect.${stamp}@e2e.local`;
  const studentEmail = `r.stud.${stamp}@e2e.local`;

  await setup.goto('/login');
  await setup.getByRole('button', { name: 'Register', exact: true }).click();
  await setup.getByRole('button', { name: /Faculty \/ Lecturer/ }).click();
  await setup.getByLabel('Full name').fill('Responsive Lecturer');
  await setup.getByLabel('Email address').fill(lecturerEmail);
  await setup.getByRole('button', { name: /Create account/ }).click();
  {
    const b = setup.getByText(/your code is/i);
    await b.waitFor();
    await setup.getByPlaceholder('000000').fill((await b.locator('strong').innerText()).trim());
    await setup.getByRole('button', { name: /Verify & continue/ }).click();
    await setup.waitForURL(/\/lecturer/);
    await dismissGuide(setup);
  }
  await setup.locator('aside').getByRole('link', { name: 'Courses' }).click();
  await setup.getByRole('button', { name: 'New course' }).click();
  await setup.getByRole('button', { name: /Manual course/ }).click();
  await setup.getByLabel('Course code *').fill(`RSP${stamp % 1000}`);
  await setup.getByLabel('Title *').fill('Responsive Course');
  await setup.getByRole('button', { name: 'Create course', exact: true }).click();
  await expect(setup.getByText('Course created').first()).toBeVisible();

  await setup.locator('aside').getByRole('link', { name: 'Question Bank' }).click();
  await setup.getByRole('button', { name: 'New question' }).click();
  await setup.getByLabel('Question text').fill('True or False: an index speeds up reads but slows writes.');
  await setup.locator('form#question-form select').nth(1).selectOption('true_false');
  await setup.getByRole('button', { name: 'Add to bank' }).click();
  await expect(setup.getByText('Question saved').first()).toBeVisible();

  await setup.locator('aside').getByRole('link', { name: 'Quiz Studio' }).click();
  await setup.getByLabel('Title').fill('Responsive Quiz');
  await setup.getByRole('button', { name: /^Next/ }).click();
  await setup.getByText('True or False: an index speeds up reads').click();
  await setup.getByRole('button', { name: /^Next/ }).click();
  await setup.getByLabel('Attempts allowed').selectOption('99'); // unlimited — reused across viewports
  await setup.getByRole('button', { name: /Publish/ }).click();
  await expect(setup.getByText('Quiz published').first()).toBeVisible();

  // enrol student (needs the student to exist first)
  const s2 = await browser.newPage();
  await s2.goto('/login');
  await s2.getByRole('button', { name: 'Register', exact: true }).click();
  await s2.getByLabel('Full name').fill('Responsive Student');
  await s2.getByLabel('Email address').fill(studentEmail);
  await s2.getByRole('button', { name: /Create account/ }).click();
  {
    const b = s2.getByText(/your code is/i);
    await b.waitFor();
    await s2.getByPlaceholder('000000').fill((await b.locator('strong').innerText()).trim());
    await s2.getByRole('button', { name: /Verify & continue/ }).click();
    await s2.waitForURL(/\/student/);
    await dismissGuide(s2);
  }
  await s2.close();

  await setup.locator('aside').getByRole('link', { name: 'Courses' }).click();
  await setup.getByText('Responsive Course').click();
  await setup.getByRole('button', { name: /Students \(/ }).click();
  await setup.getByRole('button', { name: 'Add student' }).click();
  await setup.getByLabel('Student email').fill(studentEmail);
  await setup.getByRole('button', { name: 'Enrol' }).click();
  await expect(setup.getByText('Student enrolled').first()).toBeVisible();
  await setup.close();

  // ---- now walk key screens at each viewport ----
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await page.goto('/login');
    await noHorizontalOverflow(page, `login @ ${vp.name}`);
    await page.screenshot({ path: path.join(SHOTS, `login-${vp.name}.png`), fullPage: true });

    await loginExisting(page, studentEmail);
    await noHorizontalOverflow(page, `student dashboard @ ${vp.name}`);
    await page.screenshot({ path: path.join(SHOTS, `dashboard-${vp.name}.png`), fullPage: true });

    await (vp.width < 768
      ? page.locator('header').getByRole('button', { name: 'Open menu' }).click().then(() =>
          page.locator('aside').getByRole('link', { name: 'Quizzes' }).click(),
        )
      : page.locator('aside').getByRole('link', { name: 'Quizzes' }).click());
    await expect(page.getByRole('heading', { name: 'Responsive Quiz' })).toBeVisible();
    await noHorizontalOverflow(page, `quizzes @ ${vp.name}`);

    await page.getByRole('link', { name: /Start/ }).first().click();
    await page.getByRole('button', { name: /Start \/ resume assessment/ }).click();
    await page.waitForURL(/\/student\/attempt\//);
    await expect(page.getByRole('heading', { name: 'Responsive Quiz' })).toBeVisible();
    await noHorizontalOverflow(page, `quiz taking @ ${vp.name}`);
    await page.screenshot({ path: path.join(SHOTS, `quiz-taking-${vp.name}.png`), fullPage: true });

    await page.getByRole('button', { name: 'True', exact: false }).and(page.locator('button.border-2')).click();
    await page.getByRole('button', { name: /Finish/ }).click();
    await page.getByRole('button', { name: 'Submit now' }).click();
    await page.waitForURL(/\/student\/results\//, { timeout: 60_000 });
    await noHorizontalOverflow(page, `result @ ${vp.name}`);
    await page.screenshot({ path: path.join(SHOTS, `result-${vp.name}.png`), fullPage: true });

    await page.close();
  }
});

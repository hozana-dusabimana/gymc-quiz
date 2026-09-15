import { test, expect, Page } from '@playwright/test';

/**
 * "Jump to Screen" top-bar navigator.
 *
 *   - appears in the upbar once signed in
 *   - opens a searchable menu of the screens the current role can reach
 *   - typing filters; Enter / click navigates; Escape closes
 *   - marks the screen you are currently on
 *
 * Runs against whatever E2E_BASE_URL points at (localhost:3000 by default,
 * https://uas.isiri.rw for the live check). Needs the OTP dev-code echo on.
 */

async function finishOtp(page: Page) {
  const banner = page.getByText(/your code is/i);
  await banner.waitFor({ timeout: 15_000 });
  const code = (await banner.locator('strong').innerText()).trim();
  await page.getByPlaceholder('000000').fill(code);
  await page.getByRole('button', { name: /Verify & continue/ }).click();
  await page.waitForURL(/\/(member|leader)($|\/)/);
  await page.getByRole('button', { name: 'Close guide' }).click({ timeout: 6_000 }).catch(() => {});
}

async function register(page: Page, name: string, email: string, role: 'member' | 'leader') {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  if (role === 'leader') await page.getByRole('button', { name: /Faculty \/ Leader/ }).click();
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: /Create account/ }).click();
  await finishOtp(page);
}

const jump = (page: Page) => page.getByRole('button', { name: /Jump to Screen/ });
const menu = (page: Page) => page.getByRole('menu');

test.describe.configure({ mode: 'serial' });

test('leader — jump menu lists leader screens and navigates', async ({ page }) => {
  const stamp = Date.now();
  await register(page, 'Jump Leader', `jump.lect.${stamp}@audit.local`, 'leader');

  await expect(jump(page)).toBeVisible();
  await jump(page).click();
  await expect(menu(page)).toBeVisible();

  // full leader screen set
  for (const label of [
    'Dashboard',
    'Classes',
    'Courses',
    'Material Library',
    'Question Bank',
    'Quiz Studio',
    'Analytics & Grades',
    'Manage profile',
  ]) {
    await expect(menu(page).getByRole('menuitem', { name: new RegExp(label) })).toBeVisible();
  }
  // no member-only screens leak in
  await expect(menu(page).getByRole('menuitem', { name: /Results & Insights/ })).toHaveCount(0);

  // current screen is flagged
  await expect(menu(page).getByRole('menuitem', { name: /Dashboard/ })).toContainText('Here');

  // search + keyboard
  await page.getByPlaceholder('Search screens…').fill('bank');
  await expect(menu(page).getByRole('menuitem')).toHaveCount(1);
  await page.getByPlaceholder('Search screens…').press('Enter');
  await expect(page).toHaveURL(/\/leader\/questions$/);
  await expect(menu(page)).toHaveCount(0);

  // reopen, click-navigate, and Escape
  await jump(page).click();
  await menu(page).getByRole('menuitem', { name: /Analytics & Grades/ }).click();
  await expect(page).toHaveURL(/\/leader\/analytics$/);

  await jump(page).click();
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
});

test('member — jump menu is scoped to member screens', async ({ page }) => {
  const stamp = Date.now();
  await register(page, 'Jump Member', `jump.stud.${stamp}@audit.local`, 'member');

  await jump(page).click();
  for (const label of ['Dashboard', 'Quizzes', 'Results & Insights', 'My Courses', 'Manage profile']) {
    await expect(menu(page).getByRole('menuitem', { name: new RegExp(label) })).toBeVisible();
  }
  await expect(menu(page).getByRole('menuitem', { name: /Question Bank/ })).toHaveCount(0);

  await menu(page).getByRole('menuitem', { name: /Results & Insights/ }).click();
  await expect(page).toHaveURL(/\/member\/results$/);
});

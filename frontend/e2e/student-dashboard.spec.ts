/**
 * Student dashboard — real login against the LIVE backend.
 *
 * Students consume teacher-provisioned data (they can't create classes), so this
 * test asserts the dashboard's real rendering invariants, opens a module, and
 * verifies the full chat workspace (sessions controls, module/teacher info,
 * settings, textbook) plus a live chat round-trip.
 *
 * Requires (CI: GitHub secrets / local: frontend/.env.local or .env):
 *   E2E_STUDENT_EMAIL, E2E_STUDENT_PASSWORD
 *   a reachable backend, and the account enrolled in a class with a module.
 */
import { test, expect } from '@playwright/test';
import { login } from './support/login';

const EMAIL = process.env.E2E_STUDENT_EMAIL;
const PASSWORD = process.env.E2E_STUDENT_PASSWORD;

test.describe('Student dashboard', () => {
  test.skip(!EMAIL || !PASSWORD, 'Set E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD to run');

  test('renders classes with correct lock state and opens the chat workspace', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, 'student', EMAIL!, PASSWORD!);

    // Header / shell rendered for the signed-in student.
    await expect(page.getByText('Student Dashboard')).toBeVisible();
    await expect(page.getByRole('heading', { name: /your learning workspace/i })).toBeVisible();

    // Wait for the class list to finish loading by waiting for real content (a
    // module button or an empty-state message) rather than the loading text.
    await page
      .getByRole('button', { name: /open module|locked/i })
      .or(page.getByText(/has not activated any modules|not enrolled in any classes/i))
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 });

    const openButtons = page.getByRole('button', { name: /open module/i });
    const lockedButtons = page.getByRole('button', { name: 'Locked', exact: true });
    const openCount = await openButtons.count();
    const lockedCount = await lockedButtons.count();

    if (openCount + lockedCount === 0) {
      test.skip(true, 'Student account has no visible modules — enroll it in a class with a module');
    }

    // Core invariant: unlocked modules have an ENABLED "Open Module"; locked
    // modules have a DISABLED "Locked" button.
    for (let i = 0; i < openCount; i++) {
      await expect(openButtons.nth(i)).toBeEnabled();
    }
    for (let i = 0; i < lockedCount; i++) {
      await expect(lockedButtons.nth(i)).toBeDisabled();
    }
    if (lockedCount > 0) {
      await expect(page.getByText('Locked by teacher').first()).toBeVisible();
    }

    // Existing data: "Fake Class" exposes a visible-but-LOCKED "Playwright" module.
    await expect(page.getByText('Playwright', { exact: true })).toBeVisible();
    const playwrightRow = page
      .locator('div')
      .filter({ has: page.getByText('Playwright', { exact: true }) })
      .filter({ has: page.getByRole('button', { name: 'Locked', exact: true }) })
      .last();
    await expect(playwrightRow.getByRole('button', { name: 'Locked', exact: true })).toBeDisabled();
    await expect(playwrightRow.getByText('Locked by teacher')).toBeVisible();

    if (openCount === 0) {
      test.skip(true, 'No unlocked module to open');
    }

    // --- Open the module → chat workspace ------------------------------------
    await openButtons.first().click();
    await page.waitForURL('**/student/module/**', { timeout: 30_000 });

    // Chat input + session controls exist.
    await expect(page.getByPlaceholder('Ask a math question...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear All' })).toBeVisible();

    // Header controls: settings + textbook toggle.
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
    const textbook = page.getByRole('button', { name: 'Textbook' });
    await expect(textbook).toBeVisible();

    // Module + teacher info shown in the sidebar (with real values, not fallbacks).
    await expect(page.getByText('Module', { exact: true })).toBeVisible();
    await expect(page.getByText('Teacher', { exact: true })).toBeVisible();
    await expect(page.getByText('No module selected')).toHaveCount(0);

    // Textbook PDF panel opens (toggle flips to "Hide textbook").
    await textbook.click();
    await expect(textbook).toHaveAttribute('title', /hide textbook/i);
    await textbook.click(); // close it again

    // --- Live chat round-trip (in a fresh session) ---------------------------
    await page.getByRole('button', { name: 'New Session' }).click();
    const input = page.getByPlaceholder('Ask a math question...');
    const chatResponse = page.waitForResponse(
      (r) => r.url().includes('/chat') && r.request().method() === 'POST',
      { timeout: 60_000 }
    );
    await input.fill('What is 2 plus 2?');
    await input.press('Enter');

    // .last(): the prompt is echoed into the transcript (and prior runs may have history).
    await expect(page.getByText('What is 2 plus 2?').last()).toBeVisible();
    const response = await chatResponse;
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).answer).toBeTruthy();
  });
});
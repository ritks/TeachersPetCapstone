/**
 * Teacher dashboard — real login against the LIVE backend.
 *
 * Exercises Analytics + a full Class Management lifecycle: create a class, manage
 * its roster and groups (create + delete each), create a module, and delete the
 * class. A reliable API-based afterEach teardown removes any leftover "E2E ..."
 * classes/modules using the teacher's own captured token — so nothing orphans,
 * even if a UI step fails partway (deleting a class does NOT cascade modules).
 *
 * Requires (CI: GitHub secrets / local: frontend/.env.local or .env):
 *   E2E_TEACHER_EMAIL, E2E_TEACHER_PASSWORD  — a real teacher account
 *   E2E_STUDENT_EMAIL                         — a real student to add to the roster
 *   a reachable backend.
 */
import { test, expect, request as pwRequest } from '@playwright/test';
import { login } from './support/login';

const T_EMAIL = process.env.E2E_TEACHER_EMAIL;
const T_PASSWORD = process.env.E2E_TEACHER_PASSWORD;
const S_EMAIL = process.env.E2E_STUDENT_EMAIL;

const className = `E2E Class ${Date.now()}`;

test.describe('Teacher dashboard', () => {
  test.skip(!T_EMAIL || !T_PASSWORD, 'Set E2E_TEACHER_EMAIL / E2E_TEACHER_PASSWORD to run');

  // Captured from the app's own API calls and reused for API teardown.
  let token = '';
  let apiBase = '';

  test.beforeEach(async ({ page }) => {
    token = '';
    apiBase = '';
    page.on('dialog', (dialog) => dialog.accept()); // delete confirmations
    page.on('request', (req) => {
      const auth = req.headers()['authorization'];
      if (auth?.startsWith('Bearer ') && !token) token = auth.slice(7);
      const m = req.url().match(/^(https?:\/\/[^/]+)\/(classes|modules|me|class-modules|prompts)\b/);
      if (m && !apiBase) apiBase = m[1];
    });
  });

  test.afterEach(async () => {
    // Reliable teardown: delete leftover E2E classes + modules via the API.
    if (!token || !apiBase) return;
    const api = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    try {
      const modules = await (await api.get(`${apiBase}/modules`)).json().catch(() => []);
      for (const m of modules) {
        if (typeof m?.name === 'string' && m.name.startsWith('E2E ')) {
          await api.delete(`${apiBase}/modules/${m.id}`).catch(() => {});
        }
      }
      const classes = await (await api.get(`${apiBase}/classes`)).json().catch(() => []);
      for (const c of classes) {
        if (typeof c?.name === 'string' && c.name.startsWith('E2E ')) {
          await api.delete(`${apiBase}/classes/${c.id}`).catch(() => {});
        }
      }
    } finally {
      await api.dispose();
    }
  });

  test('analytics, then a full class lifecycle (roster, groups, module, delete)', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, 'teacher', T_EMAIL!, T_PASSWORD!);

    // --- ANALYTICS view ------------------------------------------------------
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await expect(page.getByText('Analytics Workspace')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Student Conversation Insights' })).toBeVisible();
    await expect(page.getByText('AI Summary', { exact: true })).toBeVisible();
    await expect(page.getByText('Classroom Trend Snapshot')).toBeVisible();
    await expect(page.getByRole('button', { name: /generate summary|refresh summary/i })).toBeVisible();

    // --- CLASS MANAGEMENT ----------------------------------------------------
    await page.getByRole('button', { name: 'Class Management' }).click();
    await expect(page.getByRole('button', { name: '+ Create New Class' })).toBeVisible({ timeout: 30_000 });

    // Existing data: an archived class named "Archive" (hidden until we show all).
    await page.locator('select').first().selectOption('all');
    const archivedClassCard = page
      .locator('div')
      .filter({ hasText: 'Restore to reopen this class.' })
      .filter({ hasText: 'Archive' })
      .last();
    await expect(archivedClassCard.getByRole('button', { name: 'Restore' })).toBeVisible({ timeout: 10_000 });

    // Existing data: an archived "Archive Module" within "Fake Class".
    await page.getByText('Fake Class', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Modules', exact: true }).click();
    await expect(page.getByText('Archive Module', { exact: true })).toBeVisible({ timeout: 15_000 });
    const archivedModuleCard = page
      .locator('div')
      .filter({ has: page.getByText('Archive Module', { exact: true }) })
      .filter({ has: page.getByRole('button', { name: 'Restore' }) })
      .last();
    await expect(archivedModuleCard.getByRole('button', { name: 'Restore' })).toBeVisible();
    await page.getByRole('button', { name: '← Back To All Courses' }).click();

    // --- Create a class ------------------------------------------------------
    await page.getByRole('button', { name: '+ Create New Class' }).click();
    await page.getByPlaceholder('Class name (e.g. Algebra 1)').fill(className);
    await page.getByRole('button', { name: 'Create Class' }).click();

    // Persisted to the live backend (not the localStorage offline fallback).
    await expect(page.getByText(className, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/saved locally \(API unavailable\)/i)).toHaveCount(0);

    // --- OPEN class detail ---------------------------------------------------
    await page.getByText(className, { exact: true }).click();
    await expect(page.getByText('Class Roster')).toBeVisible();

    // --- ROSTER: add a real student, then remove (create + delete) -----------
    if (S_EMAIL) {
      await page.getByPlaceholder('student@email.com').fill(S_EMAIL);
      await page.getByRole('button', { name: 'Add Student' }).click();
      await expect(page.getByText(S_EMAIL, { exact: true })).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: 'Remove', exact: true }).first().click();
      await expect(page.getByText(S_EMAIL, { exact: true })).toHaveCount(0, { timeout: 15_000 });
    }

    // --- GROUPS: create a group, then delete (create + delete) ---------------
    await page.getByRole('button', { name: 'Groups', exact: true }).click();
    await expect(page.getByText('Student Groups')).toBeVisible();

    const groupName = `E2E Group ${Date.now()}`;
    await page.getByPlaceholder('Group name (e.g. Period 1, Intervention)').fill(groupName);
    await page.getByRole('button', { name: 'Create Group' }).click();
    await expect(page.getByText(groupName, { exact: true })).toBeVisible({ timeout: 15_000 });

    const groupRow = page
      .locator('div')
      .filter({ has: page.getByText(groupName, { exact: true }) })
      .filter({ has: page.getByRole('button', { name: 'Rename' }) })
      .last();
    await groupRow.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(groupName, { exact: true })).toHaveCount(0, { timeout: 15_000 });

    // --- MODULES: create a module (removed in API teardown) ------------------
    await page.getByRole('button', { name: 'Modules', exact: true }).click();
    await expect(page.getByPlaceholder('Search modules...')).toBeVisible();

    await page.getByRole('button', { name: '+ New Module' }).click();
    const moduleName = `E2E Module ${Date.now()}`;
    await page.getByPlaceholder('Module name').fill(moduleName);
    await page.getByRole('button', { name: 'Create Module' }).click();
    await expect(page.getByText(moduleName, { exact: true })).toBeVisible({ timeout: 20_000 });
    // NOTE: the created module is removed by the API teardown below. The app's
    // own "Delete module" button currently fails ("Could not delete module"),
    // and delete_class does not cascade standalone modules.

    // --- DELETE class (Delete in the detail header; confirm auto-accepted) ----
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
    await expect(page.getByText(className, { exact: true })).toHaveCount(0, { timeout: 20_000 });
  });
});
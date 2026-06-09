import { Page } from '@playwright/test';

type Role = 'student' | 'teacher';

const CARD_NAME: Record<Role, RegExp> = {
  student: /i'm a student/i,
  teacher: /i'm a teacher/i,
};

/**
 * Drives the real entry-page login flow: opens the role card, fills the embedded
 * login form, submits, and waits for the role-based redirect. Uses real Firebase
 * auth against whatever VITE_FIREBASE_* config the dev server was started with.
 */
export async function login(page: Page, role: Role, email: string, password: string) {
  await page.goto('/');
  await page.getByRole('button', { name: CARD_NAME[role] }).click();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByPlaceholder('Password').press('Enter');
  await page.waitForURL(role === 'student' ? '**/student' : '**/teacher', { timeout: 30_000 });
}
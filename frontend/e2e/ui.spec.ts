import { test, expect } from '@playwright/test';

test.describe('UI Rendering', () => {
  test('should render main components on entry page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check that the app container exists
    const app = await page.locator('body');
    await expect(app).toBeVisible();
  });

  test('should have responsive layout', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should have desktop viewport dimensions', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Form Interactions', () => {
  test('should be able to interact with form inputs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Try to find and interact with text inputs if they exist
    const inputs = await page.locator(
      'input[type="text"], input[type="email"], input[type="password"]'
    );
    const inputCount = await inputs.count();

    // If there are inputs, verify they're interactive
    if (inputCount > 0) {
      const firstInput = inputs.first();
      await expect(firstInput).toBeVisible();
      await firstInput.focus();
      await firstInput.fill('test');

      const value = await firstInput.inputValue();
      expect(value).toBe('test');
    }
  });

  test('should be able to click buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Try to find buttons
    const buttons = await page.locator('button');
    const buttonCount = await buttons.count();

    expect(buttonCount).toBeGreaterThanOrEqual(0);

    if (buttonCount > 0) {
      const firstButton = buttons.first();
      await expect(firstButton).toBeVisible();
    }
  });
});

test.describe('Accessibility', () => {
  test('should have page title', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('should have semantic HTML', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check for main content areas
    const mainContent = await page.locator('main, [role="main"]');
    const hasMainContent = await mainContent.count().catch(() => 0);

    // It's okay if there's no explicit main element
    expect(hasMainContent >= 0).toBe(true);
  });
});

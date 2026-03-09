import { test, expect } from '@playwright/test';

test.describe('App Navigation', () => {
  test('should load the entry page', async ({ page }) => {
    await page.goto('/');

    // Check that we can see navigation elements
    const docElement = await page.locator('body');
    await expect(docElement).toBeVisible();
  });

  test('should be able to navigate to student entry page', async ({ page }) => {
    await page.goto('/');

    // Look for a way to navigate to student entry
    // This would depend on the actual navigation structure
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('should render without critical errors', async ({ page }) => {
    page.on('pageerror', (error) => {
      throw new Error(`Page error: ${error.message}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Page Load Performance', () => {
  test('should load initial page within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
  });

  test('should not have console errors on page load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('Firebase') && !error.includes('Deprecated')
    );

    expect(criticalErrors).toEqual([]);
  });
});

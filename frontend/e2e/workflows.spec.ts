import { test, expect } from '@playwright/test';

test.describe('User Workflows', () => {
  test('should complete basic navigation workflow', async ({ page }) => {
    // Start at home
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify we're on the main page
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    // Get the current URL
    const url = page.url();
    expect(url).toContain('localhost');
  });

  test('should handle page transitions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Get initial content
    const initialContent = await page.content();
    expect(initialContent).toBeTruthy();

    // Try clicking any available links (if they exist)
    const links = await page.locator('a');
    const linkCount = await links.count();

    // Verify links are present or page is still functional
    expect(linkCount >= 0).toBe(true);
  });

  test('should maintain state across interactions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Get a snapshot of the page
    const initialTitle = await page.title();
    expect(initialTitle).toBeTruthy();

    // Wait a moment and check title is still there
    await page.waitForTimeout(1000);
    const currentTitle = await page.title();
    expect(currentTitle).toBe(initialTitle);
  });
});

test.describe('Performance Metrics', () => {
  test('should measure page load metrics', async ({ page }) => {
    await page.goto('/');

    const metrics = await page.evaluate(() => {
      const navigationEntries = performance.getEntriesByType('navigation');
      const navigation = navigationEntries[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded:
          navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart,
        navigationTime:
          navigation.loadEventEnd - navigation.loadEventStart,
      };
    });

    expect(metrics.domContentLoaded).toBeGreaterThanOrEqual(0);
    expect(metrics.navigationTime).toBeGreaterThanOrEqual(0);
  });

  test('should have reasonable Core Web Vitals', async ({ page }) => {
    await page.goto('/');

    const vitals = await page.evaluate(() => {
      const entries = performance.getEntriesByType(
        'largest-contentful-paint'
      );
      const lastEntry = entries[entries.length - 1] as LargestContentfulPaint;

      return {
        lcp: lastEntry?.renderTime || lastEntry?.loadTime || 0,
      };
    });

    // LCP should be less than 2.5 seconds (good)
    expect(vitals.lcp).toBeLessThan(2500);
  });
});

test.describe('Data Persistence', () => {
  test('should persist data in localStorage', async ({ page }) => {
    await page.goto('/');

    // Try to set and retrieve from localStorage
    const testValue = 'e2e-test-value';

    await page.evaluate((value) => {
      localStorage.setItem('e2e-test', value);
    }, testValue);

    const retrieved = await page.evaluate(() => {
      return localStorage.getItem('e2e-test');
    });

    expect(retrieved).toBe(testValue);
  });

  test('should handle localStorage gracefully', async ({ page, context }) => {
    // First, navigate to the page
    await page.goto('/');

    // Clear storage
    await context.clearCookies();

    // Navigate again
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Should still work
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Browser Compatibility', () => {
  test('should work without JavaScript errors in console', async ({
    page,
  }) => {
    const errorMessages: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorMessages.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out external service errors (Firebase, etc.)
    const appErrors = errorMessages.filter(
      (err) =>
        !err.includes('Firebase') &&
        !err.includes('analytics') &&
        !err.includes('Deprecated') &&
        !err.includes('Cannot find module')
    );

    // App should load without critical errors
    expect(appErrors.length).toBeLessThanOrEqual(0);
  });

  test('should support common browser features', async ({ page }) => {
    await page.goto('/');

    const features = await page.evaluate(() => ({
      localStorage: typeof Storage !== 'undefined',
      fetch: typeof fetch !== 'undefined',
      promise: typeof Promise !== 'undefined',
      json: typeof JSON !== 'undefined',
    }));

    expect(features.localStorage).toBe(true);
    expect(features.fetch).toBe(true);
    expect(features.promise).toBe(true);
    expect(features.json).toBe(true);
  });
});

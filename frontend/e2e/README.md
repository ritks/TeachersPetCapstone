# Frontend E2E Tests with Playwright (TypeScript)

This directory contains end-to-end tests for the TeachersPet frontend application using Playwright and TypeScript.

## Setup

### Prerequisites
- Node.js 20.x or higher
- The frontend dev server running on `http://localhost:5173`

### Installation

```bash
cd frontend
npm install --legacy-peer-deps  # Install dependencies
npm run test:e2e                 # Run E2E tests
```

## Available Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/navigation.spec.ts

# Run tests with a specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
```

## Test Structure

The E2E tests are organized into the following TypeScript files:

### `navigation.spec.ts`
Tests for basic page navigation and loading:
- Page loads correctly
- Navigation elements render
- No critical JavaScript errors
- Page load performance (< 5 seconds)
- Console error handling

### `ui.spec.ts`
Tests for UI rendering and interactions:
- Component rendering
- Responsive layout (mobile and desktop)
- Form input interactions
- Button clicks
- Accessibility features

### `api-integration.spec.ts`
Tests for API interactions and network requests:
- Network request handling
- Offline graceful degradation
- Sensitive data protection
- Error handling for failed requests
- Script error resilience

### `workflows.spec.ts`
Tests for user workflows and cross-browser compatibility:
- Complete user workflows
- Page transitions
- State persistence
- Performance metrics (Core Web Vitals)
- LocalStorage functionality
- Browser feature support

## Configuration

The Playwright configuration is defined in `playwright.config.js` with:
- **Test directory**: `./src/__tests__/e2e`
- **Test files**: `**/*.spec.ts` (TypeScript)
- **Base URL**: `http://localhost:5173`
- **Browsers**: Chromium and Firefox
- **Auto web server**: Starts dev server automatically if not running
- **Parallel execution**: Enabled for faster testing
- **Retries**: 2 retries on CI, 0 on local

TypeScript configuration is defined in `tsconfig.e2e.json` with:
- Strict mode enabled for better type safety
- Full ESNext support
- DOM library types included

## Writing New Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');

    // Interact with page with full type safety
    const element = page.locator('selector');
    await expect(element).toBeVisible();
  });
});
```

## Best Practices

1. **Use locators correctly**:
   - Prefer semantic locators: `page.getByRole('button', { name: 'Submit' })`
   - Fallback to CSS/XPath if needed: `page.locator('button.submit')`

2. **Wait for elements**:
   - Use automatic waiting: `await element.click()`
   - Use explicit waits when needed: `await page.waitForSelector('.loading')`

3. **Handle async operations**:
   - Always await async operations
   - Use `page.waitForLoadState()` for network waits
   - TypeScript will help catch missing awaits

4. **Keep tests isolated**:
   - Each test should be independent
   - Don't rely on test execution order
   - Clean up state between tests

5. **Make tests reliable**:
   - Avoid hard timeouts
   - Use appropriate assertions
   - Handle multiple possible states
   - TypeScript types help ensure correct assertion usage

## Debugging

### View test execution
```bash
npm run test:e2e:ui
```

### Debug specific test
```bash
npx playwright test --debug src/__tests__/e2e/navigation.spec.ts
```

### View test report
After running tests, open:
```bash
npx playwright show-report
```

## CI/CD Integration

Tests run automatically in CI pipeline with:
- 2 retries on failure
- Single worker (sequential execution)
- All browsers tested
- HTML reports generated

## Common Issues

### Tests timeout
- Increase timeout in `playwright.config.js`
- Check if dev server is running
- Verify no heavy operations blocking

### Web server not starting
- Ensure `npm run dev` works locally
- Check port 5173 is available
- Verify all dependencies installed

### Flaky tests
- Add explicit waits for dynamic content
- Use `waitForLoadState('networkidle')`
- Increase timeout for slow operations

## TypeScript Benefits

- **Type Safety**: Full type checking for page selectors and assertions
- **IntelliSense**: Better IDE autocomplete and suggestions
- **Fewer Runtime Errors**: Catch mistakes at compile time
- **Better Documentation**: Types serve as inline documentation
- **Refactoring**: Safer refactoring with compiler support

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright with TypeScript](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Locator Guide](https://playwright.dev/docs/locators)


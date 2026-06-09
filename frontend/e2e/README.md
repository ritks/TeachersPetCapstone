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

The E2E suite is two detailed, behavior-level tests that perform **real Firebase
logins** and talk to the **live backend**. They self-skip when credentials are
absent (so forks/PRs without secrets pass).

### `student-dashboard.spec.ts`
Real student login → dashboard. Asserts the dashboard's real rendering invariants:
- Header + "Your Learning Workspace" render for the signed-in student
- Every unlocked module exposes an **enabled** "Open Module" button; every locked
  one a **disabled** "Locked" button
- Opens an unlocked module and verifies a real chat round-trip (live `POST /chat`
  returns a non-empty answer)

Skips gracefully if the account has no visible modules (it must be pre-enrolled
in a class with a module, since students can't create data).

### `teacher-dashboard.spec.ts`
Real teacher login → full **create-then-delete** lifecycle (self-cleaning):
- Creates a uniquely-named class and asserts it persisted to the live backend
  (not the offline localStorage fallback)
- Opens the class; adds a real student to the roster, then removes them
- Creates a group, then deletes it
- Verifies the Roster / Groups / Modules tabs render
- Deletes the class, and an `afterEach` hook best-effort deletes it even if an
  assertion fails mid-test — so no orphan data is left behind

## Running the tests

These tests need credentials for **dedicated, disposable** test accounts.

**Locally:** create `frontend/.env.local` (gitignored) — no `VITE_` prefix, so the
values stay in the Node test process and are never bundled into the browser:
```
E2E_STUDENT_EMAIL=teststudent@example.com
E2E_STUDENT_PASSWORD=...
E2E_TEACHER_EMAIL=testteacher@example.com
E2E_TEACHER_PASSWORD=...
```
Ensure the backend is reachable (the app calls `http://localhost:8000` unless
`VITE_API_BASE_URL` is set), then run `npm run test:e2e`.

**In CI:** the tests run against the **deployed production app** (no local build
or dev server). The job needs only these **GitHub Actions secrets**:
`E2E_BASE_URL` (the deployed app URL, e.g. `https://your-app.vercel.app`),
`E2E_STUDENT_EMAIL`, `E2E_STUDENT_PASSWORD`, `E2E_TEACHER_EMAIL`,
`E2E_TEACHER_PASSWORD`. No `VITE_FIREBASE_*` config is needed — the deployed app
already has it. Setting `E2E_BASE_URL` makes Playwright skip the local dev server
and target that URL.

> ⚠️ Because CI targets the **deployed** app, it validates whatever is currently
> live — not a PR's unmerged frontend changes. And it hits the **live backend**:
> the teacher test creates and deletes real data, and the student chat step
> consumes LLM quota. The create-then-delete design + `afterEach` cleanup keep
> the backend tidy.

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


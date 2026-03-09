# Teacher's Pet — Frontend

React 19 + Vite frontend for the Teacher's Pet math tutoring app.

## Setup

```sh
npm install
npm run dev
```

Requires the backend running on http://localhost:8000 and a `frontend/.env` file with Firebase credentials. See the root [README](../README.md) for full setup instructions.

## Key Files

```
src/
├── firebase.js                  # Firebase app, auth, Firestore exports
├── main.jsx                     # Entry point — wraps app in AuthProvider
├── App.jsx                      # All routing and page logic
├── __tests__/
│   └── setup.js                 # Test environment setup and mocks
├── contexts/
│   └── AuthContext.jsx          # useAuth() hook (login, register, Google, logout)
└── components/
    ├── EntryPage.jsx             # Landing page (Student / Teacher / Guest)
    ├── EntryPage.test.jsx        # EntryPage tests (collocated)
    ├── TeacherLoginPage.jsx      # Email+password and Google OAuth
    ├── TeacherLoginPage.test.jsx # TeacherLoginPage tests
    ├── StudentEntryPage.jsx      # Course code entry
    ├── StudentEntryPage.test.jsx # StudentEntryPage tests
    ├── AnalyticsDashboard.jsx    # Teacher view of student chat logs
    └── AnalyticsDashboard.test.jsx # AnalyticsDashboard tests
```

## Environment Variables

Create `frontend/.env`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Testing

### Quick Start

Tests use **Vitest** for unit testing and **React Testing Library** for component testing.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with UI dashboard
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Test Structure

Tests use a **collocated pattern** where each component has a corresponding `.test.jsx` file in the same directory:

```
src/components/
├── AnalyticsDashboard.jsx
├── AnalyticsDashboard.test.jsx     ← Tests live next to components
├── EntryPage.jsx
├── EntryPage.test.jsx
├── StudentEntryPage.jsx
├── StudentEntryPage.test.jsx
├── TeacherLoginPage.jsx
└── TeacherLoginPage.test.jsx
```

### Key Concepts

**Test Setup** (`src/__tests__/setup.js`):
- Runs before each test suite
- Cleans up after each test to prevent memory leaks
- Mocks Firebase to avoid real authentication/database calls
- Mocks `window.matchMedia` for responsive component tests

**Mocking Firebase**:
We mock Firebase in tests to avoid real authentication calls, database queries, and API costs during testing. Firebase is globally mocked in `setup.js`, and you can override per-test if needed:

```javascript
vi.mock('../firebase', () => ({
  default: { auth: { currentUser: null } }
}))
```

**Component Testing with React Testing Library**:
Focus on **user interactions**, not implementation details:

```javascript
import { render, screen, fireEvent } from '@testing-library/react'

describe('MyComponent', () => {
  it('should handle user interactions', () => {
    render(<MyComponent />)
    const button = screen.getByRole('button', { name: /click me/i })
    fireEvent.click(button)
    expect(screen.getByText('Clicked!')).toBeInTheDocument()
  })
})
```

### Coverage

Generate coverage reports:

```bash
npm run test:coverage
```

Opens HTML report in `coverage/`. Target: **70%+ coverage**.

### Debugging

**Using Vitest UI**:
```bash
npm run test:ui
```
Opens interactive dashboard with pass/fail status, coverage, and stack traces.

**VS Code Integration**:
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Vitest Debug",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal"
}
```

### Best Practices

✅ **DO:**
- Test user interactions (clicks, typing, form submissions)
- Use semantic queries (`getByRole`, `getByLabelText`, `getByText`)
- Mock external APIs (Firebase, HTTP calls)
- Keep tests focused on one behavior each
- Use descriptive test names

❌ **DON'T:**
- Query by implementation details (`getByTestId` unless necessary)
- Test library internals or 3rd-party code
- Make real API calls during tests
- Test hard-coded values
- Create overly complex test setups

### Common Issues

**"Cannot find module 'firebase'"**
Firebase is mocked globally in `setup.js`. If tests still fail, ensure the mock is imported before component imports.

**"window.matchMedia is not a function"**
This is mocked in `setup.js`. Ensure `setupFiles` is configured in `vitest.config.js`.

**AuthContext errors**
Mock `useAuth()` in tests:
```javascript
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false })
}))
```

### Testing Phases

- ✅ **Phase 1-7**: Complete testing infrastructure and CI/CD pipeline
  - Backend: 83 unit + integration tests with 84%+ coverage
  - Frontend: 5 component unit tests
  - Frontend E2E: 52 Playwright tests across all user workflows
  - CI/CD: GitHub Actions with Python/Node matrices

For detailed testing documentation, see [Testing](../README.md#testing) in the main README.

### Resources

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://testing-library.com/docs/best-practices)

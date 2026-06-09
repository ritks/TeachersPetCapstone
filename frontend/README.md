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
├── firebase.js                  # Firebase app + auth (authentication only — no Firestore)
├── main.jsx                     # Entry — BrowserRouter, AuthProvider, StudentProvider, ThemeProvider
├── App.jsx                      # Routing (/teacher, /student, /student/module/:id) + chat workspace
├── contexts/
│   ├── AuthContext.jsx          # useAuth() — login, register, Google, logout
│   ├── StudentContext.jsx       # Authenticated student state + localStorage
│   └── ThemeContext.jsx         # Light/dark theme (persisted + server-synced)
├── lib/
│   ├── api.js / apiAuth.js      # Backend base URL + authenticated fetch helper
│   ├── speech.js                # Text-to-speech for tutor replies
│   └── textSize.js              # Chat font-size preference
└── components/
    ├── EntryPage.jsx            # Landing page (Student / Teacher panels)
    ├── TeacherLoginPage.jsx / StudentLoginPage.jsx
    ├── AnalyticsDashboard.jsx   # Teacher chat-log analytics
    ├── chat/ChatPanel.jsx       # Tutor chat UI (streaming, TTS, citations)
    ├── teacher/                 # TeacherDashboard, DocumentPanel, TeacherSidebar
    ├── student/                 # StudentDashboard, PdfViewerPanel, StudentSidebar
    └── common/ + ui/            # SettingsMenu, LogoMark, primitives
```

Tests are **colocated** (`*.test.{js,jsx}` next to source). E2E tests live in
`e2e/` — see [e2e/README.md](e2e/README.md).

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
# Run all checks locally (mirrors CI pipeline)
npm run pr-check

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
src/
├── lib/api.test.js                 ← Tests live next to source
├── lib/apiAuth.test.js
├── lib/speech.test.js
├── lib/textSize.test.js
├── contexts/AuthContext.test.jsx
├── contexts/StudentContext.test.jsx
├── contexts/ThemeContext.test.jsx
├── components/EntryPage.test.jsx
├── components/chat/ChatPanel.test.jsx
└── components/student/StudentDashboard.test.jsx
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

### Coverage and Debugging

Generate coverage reports:

```bash
npm run test:coverage
```
Opens HTML report in `coverage/`.

**Using Vitest UI**:
```bash
npm run test:ui
```
Opens interactive dashboard with pass/fail status, coverage, and stack traces.

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

For detailed testing documentation, see [Testing](../README.md#testing) in the main README.

### Resources

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://testing-library.com/docs/best-practices)

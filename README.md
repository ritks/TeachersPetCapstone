# Teacher's Pet

An AI-powered math tutoring assistant for K–8 students. Teachers manage modules and course codes; students join via a 6-character code and chat with a Gemini-powered tutor scoped to their class material.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, SQLite |
| AI | Google Gemini 2.5 Flash Lite (tutor), GitHub Models — Llama + GPT-4.1-mini (safety validator) |
| Auth & Database | Firebase Authentication + Firestore |
| Document RAG | PyMuPDF, ChromaDB, Gemini Embeddings |

---

## Project Structure

```
TeachersPetCapstone/
├── backend/
│   ├── main.py                  # FastAPI server
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # GEMINI_API_KEY, GITHUB_TOKEN (git-ignored)
│   ├── database/
│   │   ├── db.py                # SQLAlchemy engine + session
│   │   └── models.py            # Module, Document ORM models
│   └── rag/
│       ├── chunker.py           # Text chunking
│       ├── embeddings.py        # Gemini embedding service
│       ├── vector_store.py      # ChromaDB wrapper
│       ├── retriever.py         # RAG context builder
│       ├── document_processor.py# PDF/text ingestion pipeline
│       └── validator.py         # 2-model safety validator (GitHub Models)
├── frontend/
│   ├── src/
│   │   ├── firebase.js          # Firebase app init (auth, db, googleProvider)
│   │   ├── main.jsx             # React entry point, wraps app in AuthProvider
│   │   ├── App.jsx              # Routing, all page/component logic
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx  # Firebase auth context + useAuth() hook
│   │   └── components/
│   │       ├── EntryPage.jsx        # Landing — Student / Teacher / Guest
│   │       ├── TeacherLoginPage.jsx # Email+password & Google OAuth login
│   │       ├── StudentEntryPage.jsx # Course code entry & Firestore validation
│   │       └── AnalyticsDashboard.jsx # Teacher chat log viewer
│   ├── .env                     # VITE_FIREBASE_* keys (git-ignored)
│   └── package.json
└── README.md
```

---

## Prerequisites

- Python 3.9+
- Node.js 18+ and npm
- A Firebase project (free)
- A Google Gemini API key — https://aistudio.google.com/app/apikeys
- A GitHub Personal Access Token with the **Models** permission — https://github.com/settings/tokens

---

## Firebase Setup

### 1. Create a Firebase project

1. Go to https://console.firebase.google.com and create a new project.
2. Register a **Web App** inside the project (Project Settings → Your apps → Add app).
3. Copy the `firebaseConfig` object — you'll need it for the frontend `.env`.

### 2. Enable Authentication

In the Firebase Console → **Authentication** → **Sign-in method**, enable:
- **Email/Password**
- **Google**

### 3. Create Firestore Database

In the Firebase Console → **Firestore Database** → **Create database** → start in **test mode**.

Then go to the **Rules** tab and replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /courseCodes/{code} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /prompts/{promptId} {
      allow create: if true;
      allow read: if request.auth != null;
    }
  }
}
```

Click **Publish**.

### 4. Firestore Data Model

```
users/{uid}
  email: string
  displayName: string
  createdAt: Timestamp

courseCodes/{code}          6-char alphanumeric, teacher-generated
  moduleId: string
  moduleName: string
  teacherUid: string
  createdAt: Timestamp

prompts/{autoId}            written from frontend after each student AI response
  courseCode: string
  moduleId: string
  moduleName: string
  teacherUid: string
  sessionId: string
  prompt: string
  response: string
  timestamp: Timestamp
```

---

## Environment Variables

### `frontend/.env`

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### `backend/.env`

```
GEMINI_API_KEY=...
GITHUB_TOKEN=...
```

Both files are git-ignored.

---

## Backend Setup

```sh
# from project root
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

cd backend
pip install -r requirements.txt
python main.py
```

The server starts on http://localhost:8000. The SQLite database is created automatically at `backend/data/teachers_pet.db` on first run.

### Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Stateful chat with optional `module_id` for RAG context |
| GET | `/modules?teacher_uid=` | List modules, optionally filtered by teacher |
| POST | `/modules` | Create a module (accepts `teacher_uid`) |
| POST | `/modules/{id}/documents` | Upload a PDF or text file |
| POST | `/modules/{id}/documents/{doc_id}/process` | Chunk, embed, and index a document |

---

## Frontend Setup

```sh
cd frontend
npm install
npm run dev
```

The app is available at http://localhost:5173.

---

## Running the Full App

Open two terminals from the project root:

**Terminal 1 — backend:**
```sh
source .venv/bin/activate
python backend/main.py
```

**Terminal 2 — frontend:**
```sh
cd frontend
npm run dev
```

Open http://localhost:5173.

---

## User Flows

### Guest
Click **Just Chat** on the landing page → general-purpose math chat with no module context. No account required.

### Student
1. Click **I'm a Student** → enter the 6-character course code provided by your teacher.
2. The code is validated against Firestore `courseCodes/`. If valid, the linked module is auto-selected and the session is remembered in `localStorage`.
3. Every prompt and response is logged to Firestore `prompts/` for teacher review.
4. To leave or switch classes, click **Leave** in the header.

### Teacher
1. Click **I'm a Teacher** → sign in with email/password or Google OAuth.
2. Your account is saved to Firestore `users/{uid}` on first login.
3. Create modules in the sidebar — each module is scoped to your account via `teacher_uid`.
4. Upload PDF or text documents to a module; they are chunked, embedded, and indexed for RAG.
5. Click **+ Generate Code** on any module to create a shareable 6-character course code stored in Firestore. Use the copy button to share it with students.
6. Click **Dashboard** in the header to access:
   - **Overview** — stat cards and feature shortcuts
   - **Analytics** — full log of student prompts and tutor responses, filterable by module

---

## Testing

The project includes comprehensive testing at multiple levels:

| Type | Framework | Location | Command |
|------|-----------|----------|---------|
| **Backend Unit** | pytest | `backend/tests/unit/` | `pytest backend/tests/` |
| **Backend Integration** | pytest | `backend/tests/integration/` | `pytest backend/tests/ -v` |
| **Frontend Unit** | Vitest | `frontend/src/__tests__/` | `npm run test` |
| **Frontend E2E** | Playwright | `frontend/e2e/` | `npm run test:e2e` |
| **CI/CD** | GitHub Actions | `.github/workflows/` | Auto-triggered on push/PR |

### Backend Tests

**Run all tests:**
```bash
cd backend
pytest tests/ -v              # Verbose output
pytest tests/ --cov=.         # With coverage report
pytest tests/unit/test_chunker.py -v  # Specific test file
```

**Coverage:** 83 tests passing (66 unit + 17 integration)
- RAG/validators: 98%+ coverage
- Database models: 100% coverage
- API endpoints: Full integration test coverage
- **Duration:** ~1.5 seconds

### Frontend Tests

**Unit tests (Vitest):**
```bash
cd frontend
npm run test              # Watch mode
npm run test -- --run    # Single run
npm run test:coverage    # With coverage report
```

**E2E tests (Playwright):**
```bash
npm run test:e2e         # Run tests
npm run test:e2e:ui      # Interactive UI mode
npm run test:e2e:debug   # Debug mode
```

**Coverage:**
- Unit tests: 5 tests covering entry page, navigation, and auth flows
- E2E tests: 52 tests spanning:
  - Navigation and page loading
  - UI rendering and interactions
  - API integration and error handling
  - User workflows and performance metrics
  - Data persistence and browser compatibility

**Duration:** ~15 seconds (unit) + ~40 seconds (E2E)

### GitHub Actions CI/CD

Automated testing on every push and PR:

- **`.github/workflows/ci.yml`** – Main orchestrator
- **`.github/workflows/backend-tests.yml`** – Python 3.10 & 3.11 matrix, PostgreSQL service
- **`.github/workflows/frontend-tests.yml`** – Node 20.x & 22.x matrix, unit + E2E

All tests must pass before merging to `main` or `develop`.

### Test Structure

```
backend/tests/
├── conftest.py                 # Shared fixtures and setup
├── unit/
│   ├── test_chunker.py        # Text chunking logic
│   ├── test_embeddings.py     # Embedding service
│   ├── test_models.py         # SQLAlchemy ORM
│   ├── test_validator.py      # Safety validation
│   └── test_vector_store.py   # Vector database
└── integration/
    └── test_modules_api.py    # API endpoints, workflows

frontend/
├── src/__tests__/
│   ├── setup.js               # Test environment config
│   └── *.test.jsx             # Component unit tests
├── e2e/
│   ├── navigation.spec.ts     # Page loading and navigation
│   ├── ui.spec.ts             # UI interactions
│   ├── api-integration.spec.ts # API calls and error handling
│   └── workflows.spec.ts      # Complete user workflows
└── playwright.config.js       # E2E configuration
```

### Best Practices

**Backend:**
- Use fixtures for setup/teardown
- Mock external services (Google APIs, GitHub)
- Test edge cases and error scenarios
- Keep tests isolated and independent

**Frontend:**
- Test user behavior, not implementation details
- Mock Firebase for authentication tests
- Test responsive design (mobile + desktop)
- Verify accessibility (ARIA attributes, semantic HTML)

### Debugging Tests

**Backend:**
```bash
pytest tests/unit/test_chunker.py -vv -s  # Verbose + show print statements
pytest tests/ --pdb                        # Drop into debugger on failure
```

**Frontend Unit:**
```bash
npm run test                    # Watch mode for development
npm run test:ui                # Interactive dashboard
```

**Frontend E2E:**
```bash
npm run test:e2e:ui            # Web UI for interactive testing
npm run test:e2e:debug         # Debug mode with step-through
npx playwright show-report     # View test report
```

### Coverage Requirements

- **Backend:** >80% overall coverage (critical paths 100%)
- **Frontend:** >70% for unit tests, E2E coverage for critical workflows
- Reports available via Codecov (CI) and locally (`coverage/` directory)

---

## Safety & Validation

Every response from Gemini is validated by two independent GitHub-hosted models (`meta-llama-3.1-8b-instruct` and `gpt-4.1-mini`) before being returned to the student. If the majority of validators flag a response as unsafe, it is blocked and the student is asked to rephrase.

This is configured in `backend/rag/validator.py` and requires a valid `GITHUB_TOKEN` in `backend/.env`.

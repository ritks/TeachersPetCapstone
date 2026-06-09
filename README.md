# Teacher's Pet

An AI-powered math tutoring assistant for K–8 students. Teachers manage modules and student access; authenticated students chat with a Gemini-powered tutor scoped to their class material.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy |
| Database | PostgreSQL (production) / SQLite (local dev) |
| AI | Google Gemini (tutor + dual safety validators) |
| Auth | Firebase Authentication (Google + email/password) |
| Document RAG | PyMuPDF, ChromaDB, Gemini Embeddings |
| Session cache | Redis (production) / in-memory fallback |
| Hosting | Vercel (frontend) · Railway (backend + Postgres) |

> **Note:** Firebase is used for **authentication only**. All application data
> (users, classes, modules, rosters, chat history, analytics) is stored in the
> SQL database via SQLAlchemy — the project no longer uses Firestore.

---

## Project Structure

```
TeachersPetCapstone/
├── backend/
│   ├── main.py                   # FastAPI app: chat, sessions, modules, documents, analytics
│   ├── client.py                 # CLI client for poking the backend
│   ├── requirements.txt          # Python dependencies
│   ├── Procfile / runtime.txt    # Railway deployment config
│   ├── .env                      # secrets (git-ignored) — see Environment Variables
│   ├── database/
│   │   ├── db.py                 # SQLAlchemy engine + session (Postgres / SQLite)
│   │   ├── models.py             # Module, Document, ChatSession, ChatMessage
│   │   └── app_models.py         # User, class, roster, group & access tables
│   ├── routes/
│   │   └── postgres_data.py      # Class-management API (classes, rosters, groups, access, dashboard)
│   ├── rag/
│   │   ├── chunker.py            # Text chunking
│   │   ├── embeddings.py         # Gemini embedding service
│   │   ├── vector_store.py       # ChromaDB wrapper
│   │   ├── retriever.py          # RAG context builder
│   │   ├── document_processor.py # PDF/text ingestion pipeline
│   │   └── validator.py          # Gemini-based safety validator
│   └── tests/                    # pytest unit + integration suites (see backend/tests/README.md)
├── frontend/
│   ├── src/
│   │   ├── firebase.js           # Firebase app init (auth + googleProvider)
│   │   ├── main.jsx              # Entry — BrowserRouter, AuthProvider, StudentProvider, ThemeProvider
│   │   ├── App.jsx               # Routing (/teacher, /student, /student/module/:id) + chat workspace
│   │   ├── contexts/             # AuthContext, StudentContext, ThemeContext
│   │   ├── lib/                  # api, apiAuth, speech, textSize helpers
│   │   └── components/
│   │       ├── EntryPage.jsx                 # Landing — Student / Teacher panels
│   │       ├── TeacherLoginPage / StudentLoginPage.jsx
│   │       ├── AnalyticsDashboard.jsx        # Teacher chat-log analytics
│   │       ├── chat/ChatPanel.jsx            # Tutor chat UI (streaming, TTS, citations)
│   │       ├── teacher/                      # TeacherDashboard, DocumentPanel, TeacherSidebar
│   │       ├── student/                      # StudentDashboard, PdfViewerPanel, StudentSidebar
│   │       ├── common/ & ui/                 # SettingsMenu, LogoMark, primitives
│   ├── e2e/                      # Playwright dashboard tests (see frontend/e2e/README.md)
│   ├── vercel.json               # Vercel SPA rewrites
│   ├── .env                      # VITE_FIREBASE_* + VITE_API_BASE_URL (git-ignored)
│   └── package.json
├── .github/workflows/            # CI pipeline (see .github/workflows/README.md)
├── Model Testing/                # Offline model-evaluation suite
└── README.md
```

---

## Prerequisites

- Python 3.9+
- Node.js 18+ and npm
- A Firebase project (free)
- A Google Gemini API key — https://aistudio.google.com/app/apikeys

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

That's all Firebase is used for. No Firestore setup is needed — all application
data is stored in the SQL database (see [Data Model](#data-model) below).

---

## Data Model

All data lives in the SQL database via SQLAlchemy (Postgres in production,
SQLite locally). Tables are created automatically on first run.

**Tutoring core** ([backend/database/models.py](backend/database/models.py)):
- `modules`, `documents` — module catalog and uploaded source files
- `chat_sessions`, `chat_messages` — student tutor conversations

**Users, classes & access** ([backend/database/app_models.py](backend/database/app_models.py)):
- `user_profiles` — Firebase uid → role (student/teacher), display name, theme
- `teacher_classes`, `class_modules`, `class_students`, `class_groups`
- `module_access`, `module_group_access` — per-student / per-group visibility + unlock state
- `prompt_logs` — student prompt + tutor response, for teacher analytics

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

# Optional — backend base URL. Defaults to http://localhost:8000 if unset.
VITE_API_BASE_URL=http://localhost:8000
```

### `backend/.env`

```
GEMINI_API_KEY=...                  # required (server raises ValueError if missing)

# Optional
DATABASE_URL=postgresql://...       # defaults to local SQLite if unset
REDIS_URL=redis://...               # session cache; falls back to in-memory
ALLOWED_ORIGINS=http://localhost:5173   # comma-separated CORS origins
PRIMARY_CHAT_MODEL=gemini-3.1-flash-lite-preview
FALLBACK_CHAT_MODEL=gemini-2.5-flash-lite

# Firebase Admin (needed to verify authenticated requests) — set ONE of:
FIREBASE_SERVICE_ACCOUNT_JSON={...}                       # inline service-account JSON (used in production)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json   # local file path (see "Firebase Admin" below)
```

See `frontend/.env.example` and `backend/.env.example` for templates. Both
`.env` files are git-ignored.

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

The server starts on http://localhost:8000. With no `DATABASE_URL` set, a local
SQLite database is created automatically at `backend/data/teachers_pet.db` on
first run.

### API Overview

The API is grouped by area. Most endpoints require a Firebase ID token sent as
`Authorization: Bearer <token>`.

| Area | Endpoints (representative) |
|------|----------------------------|
| **Chat & sessions** | `POST /chat` (RAG-scoped tutor), `POST /ask` (stateless), `GET /sessions`, `GET/PATCH/DELETE /session/{id}`, `DELETE /sessions` |
| **Modules & documents** | `GET/POST /modules`, `GET/PUT/DELETE /modules/{id}`, `POST /modules/{id}/documents[/text]`, `GET /modules/{id}/documents`, `DELETE /modules/{id}/documents/{doc_id}` |
| **Classes & roster** | `GET/POST /classes`, `PUT/DELETE /classes/{id}`, `GET/POST /classes/{id}/students`, `GET/POST /classes/{id}/groups`, `POST /class-modules` |
| **Access control** | `GET/POST /module-access`, `GET/POST /module-group-access`, `GET /student/dashboard` |
| **Accounts & analytics** | `GET/PUT /me`, `POST /students/lookup`, `GET/POST /prompts`, `POST /analytics/summary`, `GET /rag/status` |

Chat, session, and account endpoints live in [backend/main.py](backend/main.py);
class-management endpoints live in [backend/routes/postgres_data.py](backend/routes/postgres_data.py).

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

## Deployment

The app is deployed at **https://teachers-pet-capstone.vercel.app**.

| Component | Host | Config |
|-----------|------|--------|
| Frontend | Vercel | `frontend/vercel.json` (SPA rewrites). Set `VITE_FIREBASE_*` and `VITE_API_BASE_URL` (the backend URL) as Vercel environment variables. |
| Backend | Railway | `backend/Procfile` (`uvicorn main:app`) + `backend/runtime.txt` (Python 3.11). Provision a Postgres plugin and set `DATABASE_URL`, `GEMINI_API_KEY`, and (optionally) `REDIS_URL`, `ALLOWED_ORIGINS`, and `GOOGLE_APPLICATION_CREDENTIALS`. |

The backend reads `DATABASE_URL` for Postgres; the database schema is created
automatically on startup.

---

## User Flows

### Student
1. Click **I'm a Student** → sign in with email/password or Google.
2. Your enrolled classes and the modules a teacher has unlocked for you load on the dashboard.
3. Click **Open Module** on an unlocked module to start chatting at `/student/module/:id`.

### Teacher
1. Click **I'm a Teacher** → sign in with email/password or Google OAuth.
2. Your profile (role, name) is created in `user_profiles` on first login.
3. In **Class Management**, create classes, add students to the roster, and organize them into groups.
4. Create modules and upload PDF/text documents; they are chunked, embedded, and indexed for RAG.
5. Control per-student / per-group module visibility and unlock state, and review the
   **Analytics** tab — a filterable log of student prompts and tutor responses.

---

## Testing

### Firebase Admin Key for Local Backend

The backend needs a Firebase Admin service account key so it can verify authenticated users.

1. In the [Firebase Console](https://console.firebase.google.com/), open your project.
2. **Project settings** (gear icon) → **Service accounts** tab.
3. Under **Firebase Admin SDK**, click **Generate new private key** and download the JSON file.
4. Provide it to the backend via **one** of:
   - **`FIREBASE_SERVICE_ACCOUNT_JSON`** — the file's contents as a single-line JSON
     string. Preferred for hosted environments (this is what production/Railway uses).
   - **`GOOGLE_APPLICATION_CREDENTIALS`** — an absolute path to the JSON file (stored
     outside the repo so it's never committed). Convenient for local dev.
5. Restart the backend.

If neither is set, authenticated requests like `/chat` and `/sessions` return **401 Unauthorized**.

The project is tested at multiple levels:

| Type | Framework | Location | Command |
|------|-----------|----------|---------|
| **Backend unit** | pytest | `backend/tests/unit/` | `cd backend && pytest tests/unit` |
| **Backend integration** | pytest | `backend/tests/integration/` | `cd backend && pytest tests/integration` |
| **Frontend unit/component** | Vitest | colocated `src/**/*.test.{js,jsx}` | `cd frontend && npm test` |
| **Frontend E2E** | Playwright | `frontend/e2e/` | `cd frontend && npm run test:e2e` |
| **CI** | GitHub Actions | `.github/workflows/` | Auto-triggered on push/PR to `main` |

### Backend tests

```bash
cd backend
pytest tests/ -v                          # all tests
pytest tests/ --cov=. --cov-report=html   # with coverage
pytest tests/unit/test_retriever.py -v    # a single file
```

Tests run on an isolated **SQLite** database by default; CI runs the same suite
on **Postgres** via `TEST_DATABASE_URL`. They deliberately ignore `DATABASE_URL`,
so the suite can never touch a real database. Coverage is enforced at **≥80%**
(`--cov-fail-under=80`). See [backend/tests/README.md](backend/tests/README.md).

### Frontend unit/component tests

```bash
cd frontend
npm test                 # watch mode (Vitest)
npm test -- --run        # single run
npm run test:coverage    # coverage (enforced thresholds)
npm run test:ui          # interactive Vitest UI
```

Tests are **colocated** next to source (e.g. `src/lib/api.test.js`,
`src/contexts/AuthContext.test.jsx`). Firebase and `fetch` are mocked.

### Frontend E2E tests (Playwright)

Two detailed, behavior-level specs that perform a **real Firebase login** and
drive the live app — [student-dashboard.spec.ts](frontend/e2e/student-dashboard.spec.ts)
and [teacher-dashboard.spec.ts](frontend/e2e/teacher-dashboard.spec.ts):

```bash
cd frontend
npm run test:e2e         # against the local dev server (auto-started)
npm run test:e2e-ui      # interactive UI mode
npm run test:e2e-debug   # step-through debug

# or against the deployed app instead of a local server:
E2E_BASE_URL=https://teachers-pet-capstone.vercel.app npm run test:e2e
```

The specs **self-skip** unless test-account credentials are provided, and the
teacher spec cleans up the data it creates. Credentials and CI secrets are
documented in [frontend/e2e/README.md](frontend/e2e/README.md).

### Continuous integration

Every push/PR to `main` runs [.github/workflows/ci.yml](.github/workflows/ci.yml), which fans out to:

- **backend-tests.yml** — Python 3.11, Postgres 15 service (`TEST_DATABASE_URL`), pytest + coverage floor
- **frontend-tests.yml** — Node 20: ESLint (blocking) → build → Vitest (coverage thresholds), plus Playwright E2E against the deployed app (using repository secrets)

All checks must pass before merging. See [.github/workflows/README.md](.github/workflows/README.md).

### Test Structure

```
backend/tests/
├── conftest.py                    # Shared fixtures (TestClient, db_session, sample data)
├── unit/
│   ├── test_chunker.py            # Text chunking
│   ├── test_embeddings.py         # Embedding service
│   ├── test_models.py             # SQLAlchemy ORM
│   ├── test_validator.py          # Safety validation
│   ├── test_vector_store.py       # ChromaDB wrapper
│   ├── test_retriever.py          # RAG context builder
│   ├── test_document_processor.py # Ingestion pipeline
│   └── test_prompt_analytics.py   # Prompt logging/analytics
└── integration/
    ├── test_modules_api.py        # Module CRUD + document upload
    ├── test_chat_api.py           # Chat, sessions, citations, safety
    ├── test_dashboard_api.py      # Student dashboard + module-access authz
    └── test_student_lookup_api.py # Roster student lookup

frontend/
├── src/                           # *.test.{js,jsx} colocated with source
│   ├── __tests__/setup.js         # Vitest env (jsdom, Firebase + matchMedia mocks)
│   ├── lib/{api,apiAuth,speech,textSize}.test.js
│   ├── contexts/{AuthContext,StudentContext,ThemeContext}.test.jsx
│   └── components/{EntryPage, chat/ChatPanel, student/StudentDashboard}.test.jsx
├── e2e/
│   ├── student-dashboard.spec.ts  # Student login → dashboard → chat
│   ├── teacher-dashboard.spec.ts  # Teacher login → analytics + class lifecycle
│   └── support/login.ts           # Shared login helper
└── playwright.config.js
```

### Debugging Tests

**Backend:**
```bash
pytest tests/unit/test_chunker.py -vv -s   # verbose + print statements
pytest tests/ --pdb                         # debugger on failure
```

**Frontend:**
```bash
npm run test:ui                # interactive Vitest dashboard
npm run test:e2e-ui            # Playwright UI mode
npm run test:e2e-debug         # Playwright step-through debug
npx playwright show-report     # open the last E2E report
```

### Coverage

Coverage floors are **enforced in CI** (the build fails if they regress):
- **Backend:** ≥80% overall (`--cov-fail-under=80`)
- **Frontend:** Vitest thresholds — lines/statements 24%, branches 66%, functions 54%
- Reports available via Codecov (CI) and locally (`coverage/` directory)

---

## Safety & Validation

Every response from Gemini is validated by **two** Gemini safety-validation calls before being returned to the student. Each call uses a different safety prompt (content-harm and child-welfare). **Both** must vote `safe`; if either flags unsafe or errors, the response is blocked and the student is asked to rephrase.

This is configured in `backend/rag/validator.py` and uses the same `GEMINI_API_KEY` configured in `backend/.env`.

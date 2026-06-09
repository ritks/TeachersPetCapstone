# CI/CD Pipeline

This directory contains GitHub Actions workflow configurations for continuous integration and deployment of the TeachersPet project.

## Architecture Overview

The CI/CD pipeline uses a **centralized orchestration model**:

```
Push/PR to main
       ↓
   ci.yml (orchestrator)
       ↓
   status-check
       ↓
   ┌───────────────────┐
   ↓                   ↓
backend-tests.yml  frontend-tests.yml
   ↓                   ↓
   └───────────────────┘
            ↓
     integration-check
```

- **ci.yml** is the only workflow triggered by git events
- **backend-tests.yml** and **frontend-tests.yml** are reusable workflows called via `workflow_call`
- Tests run in parallel, then integration-check verifies completion
- Single Python 3.11 and Node 20.x version (no matrix testing)

## Workflows

### 1. `ci.yml` (Main CI Pipeline)
The primary workflow that orchestrates all tests and checks.

**Triggers:**
- Push to `main` branch
- Pull requests to `main` branch

**Jobs:**
- **status-check**: Validates repository structure and required files
- **backend-tests**: Runs backend Python tests (via workflow_call)
- **frontend-tests**: Runs frontend unit and E2E tests (via workflow_call)
- **integration-check**: Final verification after all tests complete

**Workflow:**
1. status-check validates project structure
2. backend-tests and frontend-tests run in parallel
3. integration-check runs only if both suites succeed (enforced by `needs:`), confirming all checks passed

### 2. `backend-tests.yml`
Comprehensive backend testing workflow for Python code.

**Triggers:**
- Called by ci.yml via `workflow_call` (does not run independently)

**Configuration:**
- Python 3.11
- PostgreSQL 15 service for database tests
- Working directory: `./backend`

**Steps:**
1. Checkout code
2. Set up Python 3.11 with cached pip dependencies
3. Install project dependencies and pytest packages
4. Run pytest with coverage reporting (XML + HTML) and an enforced floor (`--cov-fail-under=80`)
5. Upload coverage to Codecov
6. Archive test results (.pytest_cache)

**Environment Variables:**
- `TEST_DATABASE_URL`: Postgres connection string for the service container. Tests
  read **only** this (never `DATABASE_URL`), so they can never touch a real database.
- `GEMINI_API_KEY`: Mock API key for CI testing

**Artifacts:**
- `pytest-results`: Test cache and results (30 days retention)
- Coverage reports sent to Codecov

### 3. `frontend-tests.yml`
Frontend testing workflow for JavaScript/React code.

**Triggers:**
- Called by ci.yml via `workflow_call` (does not run independently)

**Configuration:**
- Node.js 20.x
- Working directory: `./frontend`

**Jobs:**

#### Unit Tests
Runs Vitest tests with coverage reporting.

**Steps:**
1. Checkout code
2. Set up Node.js 20 with cached npm dependencies
3. Install dependencies with `--legacy-peer-deps`
4. Run ESLint (blocking — fails CI on lint errors)
5. Build verification (`npm run build` — fails CI if production bundle fails)
6. Run Vitest with coverage
7. Upload coverage to Codecov
8. Archive coverage results

**Artifacts:**
- `coverage-frontend`: Coverage reports (30 days retention)

#### E2E Tests
Runs the Playwright dashboard specs in Chromium against the **deployed app**
(`E2E_BASE_URL`) using a **real Firebase login** — no local build or dev server.

**Steps:**
1. Checkout code
2. Set up Node.js 20 with cached npm dependencies
3. Install dependencies
4. Install Playwright browsers and system dependencies
5. Run Playwright tests (120s timeout) against `E2E_BASE_URL`
6. Upload Playwright HTML report
7. Archive test results

**Environment Variables (from repository secrets):**
- `CI=true`
- `E2E_BASE_URL` — the deployed app URL the tests run against
- `E2E_STUDENT_EMAIL`, `E2E_STUDENT_PASSWORD` — test student account
- `E2E_TEACHER_EMAIL`, `E2E_TEACHER_PASSWORD` — test teacher account

The specs **self-skip** if these secrets are absent (e.g. on forks), so CI stays
green for contributors without access. See [../../frontend/e2e/README.md](../../frontend/e2e/README.md).

**Artifacts:**
- `playwright-report`: HTML test report (30 days retention)
- `e2e-test-results`: Test results and traces (30 days retention)

## GitHub Actions Features

### Workflow Orchestration
- **ci.yml** acts as the orchestrator
- **backend-tests.yml** and **frontend-tests.yml** are reusable workflows
- Tests run only once per push (no duplicate triggers)

### Caching
- **pip** cache for Python dependencies (speeds up backend tests)
- **npm** cache for Node.js dependencies (speeds up frontend tests)
- Significantly reduces workflow execution time

### Artifacts
Artifacts are retained for 30 days:
- `pytest-results`: Backend test cache
- `coverage-frontend`: Frontend coverage reports
- `playwright-report`: E2E test HTML reports
- `e2e-test-results`: E2E test results and traces

### Concurrency

`ci.yml` defines a `concurrency` group (`cancel-in-progress: true`), so pushing
new commits to a branch/PR cancels the superseded run instead of piling up.

### Environment Variables

**Backend:**
- `TEST_DATABASE_URL`: Postgres connection for the service container (tests ignore `DATABASE_URL`)
- `GEMINI_API_KEY`: Mock API key (`mock-gemini-api-key-for-ci-testing`)

**Frontend E2E (repository secrets):**
- `CI=true`: enables single-worker mode for Playwright
- `E2E_BASE_URL`: the deployed app the tests run against
- `E2E_STUDENT_*` / `E2E_TEACHER_*`: test-account credentials (specs self-skip if absent)

### Test Configuration
- **Backend**: pytest on Postgres (SQLite locally)
- **Frontend Unit**: Vitest
- **Frontend E2E**: Chromium via Playwright, real login against the deployed app

## Security

### Permissions
- Read-only access to repository content; no deployment permissions configured
- Forks/PRs without the E2E secrets skip the E2E specs automatically
- **Note:** the E2E specs run against the live deployed app and create/delete real
  data (cleaned up by the teacher spec) — see the e2e README

### Dependencies
- Using pinned GitHub Actions versions (@v4 for most actions)
- Official actions from GitHub, Codecov, and Playwright
- `python-multipart` required for FastAPI file upload endpoints

## Coverage Reports

### Codecov Integration
Test coverage is automatically uploaded to Codecov:
- Backend coverage: Python code coverage
- Frontend coverage: JavaScript/React coverage
- Reports available on pull requests

### Local Coverage
Generate coverage reports locally:

**Backend:**
```bash
cd backend
pytest --cov=. --cov-report=html tests/
# Open htmlcov/index.html
```

**Frontend:**
```bash
cd frontend
npm run test:coverage
# Coverage in coverage/ directory
```

## Debugging CI Failures

### Re-run workflow
1. Go to Actions tab in GitHub
2. Select failing workflow run
3. Click "Re-run jobs"

### View logs
- Click on specific job to see detailed logs
- Each step shows its output
- Failed step is clearly marked

### Local reproduction
To reproduce CI environment locally:

**Backend:**
```bash
cd backend
export GEMINI_API_KEY=mock-gemini-api-key-for-ci-testing
# Optional: run against Postgres like CI (otherwise uses local SQLite)
# export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teacherspet_test
python -m pytest tests/ -v --cov=. --cov-report=xml --cov-report=html --cov-fail-under=80
```

**Frontend (unit/build — mirrors CI):**
```bash
cd frontend
npm ci --legacy-peer-deps
npm run lint && npm run build && npm test -- --run --coverage
```

> The E2E specs need test-account credentials and run against the deployed app —
> see [../../frontend/e2e/README.md](../../frontend/e2e/README.md) to run them locally.

Or run steps individually:
```bash
npm run lint                   # ESLint
npm run build                  # Production build verification
npm run test -- --run          # Vitest unit tests
npm run test:e2e               # Playwright E2E tests
```

## Customization

### Adding new workflows
1. Create `.github/workflows/new-workflow.yml`
2. Define triggers and jobs
3. Test in a feature branch
4. Merge to main to apply changes

### Modifying test commands
Update the `run:` sections in respective workflows:
- **Backend** (backend-tests.yml): Modify pytest command flags
- **Frontend Unit** (frontend-tests.yml, unit-tests job): Modify Vitest command
- **Frontend E2E** (frontend-tests.yml, e2e-tests job): Modify Playwright command

### Changing triggers
Modify the `on:` section in ci.yml:
```yaml
on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]
```

**Note:** backend-tests.yml and frontend-tests.yml only trigger via `workflow_call` from ci.yml.

### Changing Python or Node versions
Update version numbers in workflow files:
- **Backend**: Edit `python-version: '3.11'` in backend-tests.yml
- **Frontend**: Edit `node-version: '20.x'` in frontend-tests.yml (appears twice: unit and E2E jobs)

### Adding approval requirements
Configure GitHub branch protection rules:
1. Go to Settings > Branches
2. Add branch protection rule for `main`
3. Require status checks to pass
4. Require code review

## Monitoring

### Workflow Status
View status in GitHub Actions tab:
- **Green checkmark**: All tests passed
- **Red X**: At least one test failed
- **Yellow dot**: Workflow running
- **Gray circle**: Skipped (no changes triggering workflow)

### Workflow Execution
- **ci.yml** runs on every push/PR to main
- Orchestrates backend-tests.yml and frontend-tests.yml
- Both test suites run in parallel after status-check
- integration-check runs after both complete

### Artifacts
Download artifacts from the Actions tab:
- Coverage reports
- Test results
- Playwright HTML reports
- Available for 30 days after workflow run

## Troubleshooting

### Workflow not triggering
- Check push is to `main` branch
- Verify workflow YAML syntax is valid (use `yamllint`)
- Check GitHub Actions is enabled for the repository
- For reusable workflows (backend/frontend-tests.yml), ensure ci.yml is calling them

### Dependency conflicts
- Use `--legacy-peer-deps` for npm (already configured)
- Pin versions in requirements.txt and package.json
- Check for python-multipart in backend requirements

### Timeout issues
- E2E runs with a 120-second per-test timeout (live login + backend can be slow)
- Adjust if needed: `npm run test:e2e -- --timeout=180000`
- Check for hanging processes or network issues
- Review test logs for slow operations

### E2E tests failing
- Confirm the `E2E_*` repository secrets exist (the specs skip without them)
- Verify the deployed app at `E2E_BASE_URL` is up and the test accounts are valid
- Verify Playwright browsers are installed: `npx playwright install --with-deps`
- Reproduce locally: `E2E_BASE_URL=<url> npm run test:e2e` (see the e2e README)

### Database connection errors (Backend)
- CI runs tests on a PostgreSQL 15 service container via `TEST_DATABASE_URL`
- Locally the suite uses a temp SQLite database (set `TEST_DATABASE_URL` to use Postgres)
- Tests never read `DATABASE_URL`, so a local `.env` cannot affect them

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Caching strategies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Artifact management](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts)

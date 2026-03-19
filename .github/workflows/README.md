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
3. integration-check downloads artifacts and confirms success

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
4. Run linter (pylint) - non-blocking
5. Run pytest with coverage reporting (XML + HTML)
6. Upload coverage to Codecov
7. Archive test results (.pytest_cache)

**Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `GEMINI_API_KEY`: Mock API key for CI testing
- `GITHUB_TOKEN`: Mock token for CI testing

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
4. Run ESLint (non-blocking)
5. Run Vitest with coverage
6. Upload coverage to Codecov
7. Archive coverage results

**Artifacts:**
- `coverage-frontend`: Coverage reports (30 days retention)

#### E2E Tests
Runs Playwright end-to-end tests in Chromium.

**Steps:**
1. Checkout code
2. Set up Node.js 20 with cached npm dependencies
3. Install dependencies
4. Install Playwright browsers and system dependencies
5. Run Playwright tests with 30-second timeout
6. Upload Playwright HTML report
7. Archive test results

**Environment Variables (Mock Firebase):**
- `CI=true`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

**Note:** E2E tests run with `continue-on-error: true` due to mock Firebase credentials.

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

### Environment Variables

**Backend:**
- `DATABASE_URL`: PostgreSQL connection (service container)
- `GEMINI_API_KEY`: Mock API key (`mock-gemini-api-key-for-ci-testing`)
- `GITHUB_TOKEN`: Mock token (`mock-github-token-for-ci-testing`)

**Frontend E2E:**
- `CI=true`: Enables single-worker mode for Playwright
- Mock Firebase configuration (all `VITE_FIREBASE_*` keys with test values)

### Test Configuration
- **Backend**: 83 tests with pytest and PostgreSQL
- **Frontend Unit**: 5 tests with Vitest
- **Frontend E2E**: 26 Chromium tests with Playwright
- **Total**: 114 tests

## Security

### Permissions
- Read-only access to repository content
- No deployment permissions configured
- Safe for untrusted contributors

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
# Set mock environment variables
export GEMINI_API_KEY=mock-gemini-api-key-for-ci-testing
export GITHUB_TOKEN=mock-github-token-for-ci-testing
# Run tests with coverage
python -m pytest tests/ -v --cov=. --cov-report=xml --cov-report=html
```

**Frontend Unit Tests:**
```bash
cd frontend
npm install --legacy-peer-deps
npm run test -- --run --coverage
```

**Frontend E2E Tests:**
```bash
cd frontend
# Set mock Firebase environment variables
export VITE_FIREBASE_API_KEY=mock-api-key-for-ci
export VITE_FIREBASE_AUTH_DOMAIN=mock-project.firebaseapp.com
export VITE_FIREBASE_PROJECT_ID=mock-project
export VITE_FIREBASE_STORAGE_BUCKET=mock-project.appspot.com
export VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
export VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
# Run E2E tests
npm run test:e2e -- --timeout=30000
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
- Default E2E timeout is 30 seconds (configured in workflow)
- Increase timeout if needed: `npm run test:e2e -- --timeout=60000`
- Check for hanging processes or network issues
- Review test logs for slow operations

### E2E tests failing
- E2E tests run with `continue-on-error: true` due to mock Firebase
- Check mock environment variables are set correctly
- Verify Playwright browsers are installed: `npx playwright install --with-deps`
- Run locally with same mock env vars to reproduce

### PostgreSQL connection errors (Backend)
- CI uses PostgreSQL 15 service container
- Local tests fall back to SQLite if PostgreSQL unavailable
- Check `DATABASE_URL` environment variable in CI logs

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Caching strategies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Artifact management](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts)

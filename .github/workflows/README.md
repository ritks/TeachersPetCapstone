# CI/CD Pipeline

This directory contains GitHub Actions workflow configurations for continuous integration and deployment of the TeachersPet project.

## Workflows

### 1. `ci.yml` (Main CI Pipeline)
The primary workflow that orchestrates all tests and checks.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Daily schedule at 2 AM UTC

**Jobs:**
- **status-check**: Validates repository structure and required files
- **backend-tests**: Runs backend Python tests (via remote workflow call)
- **frontend-tests**: Runs frontend unit and E2E tests (via remote workflow call)
- **integration-check**: Final verification that all tests passed

### 2. `backend-tests.yml`
Comprehensive backend testing workflow for Python code.

**Triggers:**
- Push to `main` or `develop` with changes in `backend/` directory
- Pull requests with changes in `backend/` directory

**Strategy:**
- Tests on Python 3.10 and 3.11
- PostgreSQL service for database tests
- Parallel matrix execution

**Steps:**
1. Checkout code
2. Set up Python with cached pip dependencies
3. Install project dependencies
4. Run linter (pylint) - non-blocking
5. Run pytest with coverage reporting
6. Upload coverage to Codecov
7. Archive test results

**Artifacts:**
- `pytest-results-{python-version}`: Test cache and results
- Coverage reports sent to Codecov

### 3. `frontend-tests.yml`
Frontend testing workflow for JavaScript/React code.

**Triggers:**
- Push to `main` or `develop` with changes in `frontend/` directory
- Pull requests with changes in `frontend/` directory

**Jobs:**

#### Unit Tests
- **Strategy**: Tests on Node 20.x and 22.x
- **Steps**:
  1. Checkout code
  2. Set up Node.js with cached npm dependencies
  3. Install dependencies (with legacy peer deps)
  4. Run ESLint (non-blocking)
  5. Run Vitest with coverage
  6. Upload coverage to Codecov
  7. Archive coverage results

#### E2E Tests
- **Strategy**: Tests on Node 20.x (after unit tests)
- **Steps**:
  1. Checkout code
  2. Set up Node.js with cached npm dependencies
  3. Install dependencies
  4. Install Playwright browsers
  5. Run Playwright tests with 30-second timeout
  6. Upload Playwright-generated HTML report
  7. Archive test results

## GitHub Actions Features

### Caching
- **pip** cache for Python dependencies
- **npm** cache for Node.js dependencies
- Significantly speeds up workflow execution

### Artifacts
Artifacts are retained for 30 days:
- Backend pytest results
- Frontend coverage reports
- Playwright test reports and results

### Secrets & Environment Variables
Currently set in CI environment:
- `CI=true` for E2E tests (enables single worker mode)

### Concurrency
- Matrix strategy for parallel testing
- Different Python/Node versions tested simultaneously
- Separate unit and E2E test jobs for frontend

## Security

### Permissions
- Read-only access to repository content
- No deployment permissions configured
- Safe for untrusted contributors

### Dependencies
- Using pinned GitHub Actions versions (@v3, @v4)
- Official actions from GitHub and codecov
- Regular dependency updates via Dependabot

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
python -m pytest tests/ -v
```

**Frontend:**
```bash
cd frontend
npm install --legacy-peer-deps
npm run test -- --run
npm run test:e2e
```

## Customization

### Adding new workflows
1. Create `.github/workflows/new-workflow.yml`
2. Define triggers and jobs
3. Test in a feature branch
4. Merge to apply changes

### Modifying test commands
Update the `run:` sections in respective workflows:
- Backend: `pytest` command with flags
- Frontend: `npm run` commands

### Changing triggers
Modify the `on:` section:
```yaml
on:
  push:
    branches: [main, develop, staging]
  pull_request:
    branches: [main, develop]
```

### Adding approval requirements
Configure GitHub branch protection rules:
1. Go to Settings > Branches
2. Add branch protection rule for `main`
3. Require status checks to pass
4. Require code review

## Monitoring

### Workflow Status
- Green checkmark: All tests passed
- Red X: At least one test failed
- Yellow dot: Workflow running
- Skipped: Trigger conditions not met

### Badge
Add CI status badge to README:
```markdown
![CI Status](https://github.com/hamzah/TeachersPetCapstone/workflows/CI/badge.svg)
```

### Notifications
Configure GitHub notifications:
1. Watch the repository
2. Get notified of workflow runs
3. Check email for failure notifications

## Troubleshooting

### Workflow not triggering
- Check branch is `main` or `develop`
- Verify path filters match changed files
- Check workflow syntax with `yamllint`

### Dependency conflicts
- Use `--legacy-peer-deps` for npm (already configured)
- Pin versions in requirements files
- Use matrix strategies for multiple versions

### Timeout issues
- Increase timeout in workflow (currently 30s for E2E)
- Check for hanging processes
- Verify network connectivity in tests

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Caching strategies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Artifact management](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts)

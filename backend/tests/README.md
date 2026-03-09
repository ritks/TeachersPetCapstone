# Backend Tests

This directory contains automated tests for the Teacher's Pet backend.

## Structure

```
tests/
├── conftest.py              # Pytest configuration & shared fixtures
├── unit/                    # Unit tests for individual modules
│   ├── test_embeddings.py
│   ├── test_validator.py
│   └── test_models.py       # Database model tests
└── integration/             # Integration tests for API endpoints
    └── test_modules_api.py  # Module CRUD & document upload tests
```

## Running Tests

### Run all tests with coverage

```bash
cd backend
pytest -v --cov=. --cov-report=html
```

### Run specific test file

```bash
pytest tests/integration/test_modules_api.py -v
```

### Run specific test class or function

```bash
# Run single test class
pytest tests/integration/test_modules_api.py::TestModuleCRUD -v

# Run single test function
pytest tests/integration/test_modules_api.py::TestModuleCRUD::test_create_chapter_modules -v
```

### Run tests with debug output

```bash
pytest -v -s  # -s shows print statements
```

## Test Fixtures

All fixtures are defined in `conftest.py` and are automatically available to all tests:

### `client` — FastAPI TestClient
Provides HTTP client for making requests to the API.

```python
def test_create_module(client):
    resp = client.post("/modules", json={"name": "Chapter 1", ...})
    assert resp.status_code == 200
```

### `db_session` — Database Session
Direct database access for manual operations.

```python
def test_model_constraint(db_session):
    module = db_session.query(Module).first()
    assert module is not None
```

### `sample_chapters` — Test Data
Pre-defined chapter data for module tests.

```python
def test_with_chapters(client, sample_chapters):
    for chapter in sample_chapters:
        client.post("/modules", json=chapter)
```

### `sample_text` — Document Content
Sample educational text for document upload tests.

```python
def test_text_upload(client, sample_text):
    client.post("/modules/123/documents/text", json={"text": sample_text, ...})
```

## Test Environment

All tests automatically:
- **Isolate database**: Use a temp SQLite database (never touches real data)
- **Mock google.genai**: Avoid cryptography dependency issues
- **Mock ChromaDB**: Store vectors in temp directory
- **Clean up**: Remove temp files after tests finish

No setup required — fixtures handle everything!

## Writing New Tests

### Structure

```python
class TestFeatureName:
    """Group related tests in a class."""
    
    def test_specific_behavior(self, client, sample_chapters):
        """
        Test: What you're testing
        Verify: What should happen
        """
        # Arrange
        chapter = sample_chapters[0]
        
        # Act
        resp = client.post("/modules", json=chapter)
        
        # Assert
        assert resp.status_code == 200
```

## Test Files Overview

### Integration Tests (`integration/`)

**test_modules_api.py** (10 tests, 100% coverage)
- Module CRUD operations (create, read, update, delete)
- Document upload and listing
- Multi-step workflows
- Error handling (404, validation errors)

### Unit Tests (`unit/`)

**test_embeddings.py** (17 tests, 100% coverage)
- Single text embedding via Gemini API
- Batch embedding with configurable batch size
- Error handling and large text support
- Mocked google.genai to avoid external API calls

**test_validator.py** (15 tests, 98% coverage)
- Response validation using GitHub-hosted models
- Authentication token management
- Custom validator configuration
- Error handling (timeouts, malformed responses, HTTP errors)

**test_chunker.py** (21 tests, 76% coverage)
- Text splitting respecting chapter/section boundaries
- Content preservation across chunks
- Metadata tracking for chunk lineage
- Edge cases (empty text, small text, multiple headers)

**test_models.py** (20 tests, 100% coverage)
- Module model (creation, defaults, relationships)
- Document model (status tracking, error messages)
- Cascade deletion (module → documents)
- UUID generation, timestamps, nullable fields

**test_vector_store.py** (13 tests, 100% coverage)
- ChromaDB operations (add chunks, query, delete)
- Filtering by module/document ID
- Chunk counting and batch operations
- Mocked chromadb to isolate tests

## Writing New Tests

### Structure

```python
class TestFeatureName:
    """Group related tests in a class."""
    
    def test_specific_behavior(self, client, sample_chapters):
        """
        Test: What you're testing
        Verify: What should happen
        """
        # Arrange
        chapter = sample_chapters[0]
        
        # Act
        resp = client.post("/modules", json=chapter)
        
        # Assert
        assert resp.status_code == 200
```

### Best Practices

1. **Descriptive names**: Use `test_<feature>_<scenario>` (e.g., `test_create_module_with_valid_data`)
2. **Docstrings**: Explain test intent with Test/Verify comments
3. **Arrange-Act-Assert**: Organize tests in three phases
4. **One assertion per test**: Or logically related assertions
5. **Use fixtures**: Don't create setup code in tests

## Coverage Goals

- **Backend**: ≥70% overall, ≥80% for critical paths (RAG, validators)
- **Unit tests**: Cover individual functions, edge cases
- **Integration tests**: Cover complete workflows, error scenarios

### Current Coverage (Phase 1 + Phase 2)

| Module | Coverage | Status |
|--------|----------|--------|
| `database/models.py` | 100% | ✅ All DB model behaviors tested |
| `rag/embeddings.py` | 100% | ✅ Single/batch embedding, error handling |
| `rag/validator.py` | 98% | ✅ Response validation, token management |
| `rag/vector_store.py` | 100% | ✅ Chunk operations, filtering, deletion |
| `rag/chunker.py` | 76% | ✅ Text splitting, boundary detection |
| `main.py` (API) | 59% | 🟡 Integration tests only; Phase improvements coming |
| **Overall** | **84%** | ✅ Above 70% target |

**Phase 1** (10 integration tests): API endpoints CRUD & document handling
**Phase 2** (73 unit tests): RAG pipeline, validators, models, vector store

Check detailed coverage:
```bash
cd backend
pytest --cov=. --cov-report=html
open htmlcov/index.html
```

## Debugging Tests

### Run with verbose output and print statements

```bash
pytest -v -s tests/integration/test_modules_api.py
```

### Run with pdb on failure

```bash
pytest --pdb tests/integration/test_modules_api.py
```

### Run single test with detailed info

```bash
pytest -vv -s tests/integration/test_modules_api.py::TestModuleCRUD::test_create_chapter_modules
```

## CI/CD Integration

Tests are automated in GitHub Actions. See `.github/workflows/test.yml` for configuration.

Before pushing:
```bash
pytest tests/ -v
```

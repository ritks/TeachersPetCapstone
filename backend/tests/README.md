# Backend Tests

This directory contains automated tests for the Teacher's Pet backend.

## Structure

```
tests/
├── conftest.py                    # Pytest configuration & shared fixtures
├── unit/                          # Unit tests for individual modules
│   ├── test_chunker.py            # Text chunking
│   ├── test_embeddings.py         # Embedding service
│   ├── test_validator.py          # Safety validation
│   ├── test_vector_store.py       # ChromaDB wrapper
│   ├── test_retriever.py          # RAG context builder
│   ├── test_document_processor.py # PDF/text ingestion pipeline
│   ├── test_models.py             # SQLAlchemy ORM models
│   └── test_prompt_analytics.py   # Prompt logging / analytics
└── integration/                   # Integration tests for API endpoints
    ├── test_modules_api.py        # Module CRUD & document upload
    ├── test_chat_api.py           # Chat, sessions, citations, safety blocking
    ├── test_dashboard_api.py      # Student dashboard + module-access authz
    └── test_student_lookup_api.py # Roster student lookup
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
- **Isolate the database**: a fresh, temp **SQLite** database per test by default.
  When `TEST_DATABASE_URL` is set (e.g. the Postgres service in CI), the suite
  uses that engine instead. The fixtures **deliberately ignore `DATABASE_URL`**,
  so a developer's `.env` (which may point at the real production database) can
  never be touched by tests.
- **Mock google.genai**: avoid network calls and cryptography dependency issues
- **Mock ChromaDB**: store vectors in a temp directory
- **Clean up**: remove temp files after tests finish

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

**test_modules_api.py**
- Module CRUD operations (create, read, update, delete)
- Document upload and listing
- Multi-step workflows
- Error handling (404, validation errors)

**test_chat_api.py**
- `/chat` session creation, history persistence, RAG citation enrichment
- Safety-validator blocking of unsafe responses
- `/sessions`, `/session/{id}` get/rename/delete; stateless `/ask`

**test_dashboard_api.py**
- `/student/dashboard` visible / locked / hidden modules, email-based enrollment
- `/module-access` cross-teacher authorization (403)

**test_student_lookup_api.py**
- `/students/lookup` for roster management (existing / missing / non-student, teacher-only)

### Unit Tests (`unit/`)

**test_embeddings.py** (100% coverage)
- Single text embedding via Gemini API
- Batch embedding with configurable batch size
- Error handling and large text support
- Mocked google.genai to avoid external API calls

**test_validator.py**
- Dual-profile safety validation via Gemini
- Unsafe-vote rejection logic and generation-error handling
- Custom validator configuration

**test_chunker.py** (76% coverage)
- Text splitting respecting chapter/section boundaries
- Content preservation across chunks
- Metadata tracking for chunk lineage
- Edge cases (empty text, small text, multiple headers)

**test_models.py** (100% coverage)
- Module model (creation, defaults, relationships)
- Document model (status tracking, error messages)
- Cascade deletion (module → documents)
- UUID generation, timestamps, nullable fields

**test_vector_store.py**
- ChromaDB operations (add chunks, query, delete)
- Filtering by module/document ID
- Chunk counting and batch operations

**test_retriever.py**
- Embedding search → chunk assembly, module filtering, top-k
- Citation building (snippet truncation, chapter/section), module-scope vs generic prompts

**test_document_processor.py**
- Text/PDF ingestion → chunk metadata, embed + store calls
- `save_upload`, `delete_document`, page mapping (faked PyMuPDF)

**test_prompt_analytics.py**
- Prompt-context resolution and prompt-log listing for owned modules

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

## Coverage

Overall coverage is **~82%** and is **enforced in CI** at **≥80%** via
`--cov-fail-under=80` — the build fails if it regresses. RAG modules,
validators, and ORM models are the best covered; `main.py` and
`routes/postgres_data.py` are covered by the integration suites.

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

## CI Integration

Tests run automatically in GitHub Actions via
[`.github/workflows/backend-tests.yml`](../../.github/workflows/backend-tests.yml)
(orchestrated by `ci.yml`), on Python 3.11 against a Postgres 15 service
(`TEST_DATABASE_URL`).

Before pushing:
```bash
pytest tests/ -v
```

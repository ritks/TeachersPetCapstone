"""
Pytest configuration and shared fixtures for backend tests.

This module provides:
- Isolated SQLite database per test function (temp directory)
- Mocked google.genai to work around cryptography dependency issues
- FastAPI TestClient
- Database initialization
"""

import os
import shutil
import tempfile
import types
import pytest
import sys
from pathlib import Path

# Mock google.genai BEFORE importing any backend modules
# This must happen at module import time, not in fixtures!
_fake_genai = types.ModuleType("google.genai")


class _FakeClient:
    def __init__(self, **kw):
        pass


class _FakeSafetySetting:
    def __init__(self, **kw):
        pass


class _FakeContent:
    def __init__(self, **kw):
        pass


class _FakePart:
    def __init__(self, **kw):
        pass


class _FakeGenerateContentConfig:
    def __init__(self, **kw):
        pass


_fake_genai.Client = _FakeClient

_fake_types = types.ModuleType("google.genai.types")
_fake_types.SafetySetting = _FakeSafetySetting
_fake_types.Content = _FakeContent
_fake_types.Part = _FakePart
_fake_types.GenerateContentConfig = _FakeGenerateContentConfig

# Inject mocks into sys.modules before any backend imports
sys.modules["google.genai"] = _fake_genai
sys.modules["google.genai.types"] = _fake_types

# Ensure google.genai is accessible via attribute
try:
    import google
    google.genai = _fake_genai  # type: ignore
except ImportError:
    pass

# Set dummy API key
os.environ["GEMINI_API_KEY"] = "test-key-not-used"


# ──────────────────────────────────────────────────────────────────────────
# Per-function test fixtures
# ──────────────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _setup_test_database(tmp_path):
    """
    Set up isolated temp database for each test.
    Runs before each test, automatically (autouse=True).
    
    Args:
        tmp_path: Pytest's built-in temp directory fixture
    """
    # Create subdirectories
    test_data_dir = tmp_path / "data"
    test_data_dir.mkdir()
    
    # ──────────────────────────────────────────────────────────────────────────
    # Patch database to use per-test temp directory
    # ──────────────────────────────────────────────────────────────────────────
    
    import database.db as db_mod
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    db_mod.DATABASE_DIR = str(test_data_dir)
    db_mod.DATABASE_URL = f"sqlite:///{test_data_dir / 'test.db'}"
    db_mod.engine = create_engine(
        db_mod.DATABASE_URL, connect_args={"check_same_thread": False}
    )
    db_mod.SessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=db_mod.engine
    )
    
    # ──────────────────────────────────────────────────────────────────────────
    # Patch ChromaDB to use per-test temp directory
    # ──────────────────────────────────────────────────────────────────────────
    
    import rag.vector_store as vs_mod
    vs_mod.CHROMA_DIR = str(test_data_dir / "chroma")
    
    # ──────────────────────────────────────────────────────────────────────────
    # Initialize database tables for this test
    # ──────────────────────────────────────────────────────────────────────────
    
    from database.db import init_db
    init_db()
    
    yield  # Test runs here
    
    # Cleanup happens automatically via tmp_path


# ──────────────────────────────────────────────────────────────────────────
# FastAPI TestClient fixture
# ──────────────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    """
    Fixture providing FastAPI TestClient for making requests to the app.
    
    The setup ensures:
    - Mocked google.genai is in place
    - Isolated temp database is ready
    - Tables are created
    
    Yields:
        FastAPI TestClient connected to the app
    """
    from fastapi.testclient import TestClient
    from main import app
    
    return TestClient(app)


# ──────────────────────────────────────────────────────────────────────────
# Database session fixture
# ──────────────────────────────────────────────────────────────────────────

@pytest.fixture
def db_session():
    """
    Fixture providing a database session for direct database access in tests.
    
    Yields:
        SQLAlchemy session for manual data operations
    """
    from database.db import SessionLocal
    
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ──────────────────────────────────────────────────────────────────────────
# Test data fixtures
# ──────────────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_chapters():
    """
    Fixture providing sample chapter data for module tests.
    
    Returns:
        List of chapter dictionaries with metadata
    """
    return [
        {
            "name": "Chapter 1: Numbers and Operations",
            "description": (
                "Covers whole numbers, place value, and basic arithmetic "
                "operations including addition, subtraction, multiplication, "
                "and division."
            ),
            "grade_level": 6,
            "topics": [
                "Place Value",
                "Addition and Subtraction",
                "Multiplication and Division",
                "Order of Operations",
            ],
        },
        {
            "name": "Chapter 2: Fractions and Decimals",
            "description": (
                "Introduction to fractions, equivalent fractions, decimal "
                "notation, and converting between fractions and decimals."
            ),
            "grade_level": 6,
            "topics": [
                "Understanding Fractions",
                "Equivalent Fractions",
                "Adding and Subtracting Fractions",
                "Decimals",
                "Fraction-Decimal Conversion",
            ],
        },
        {
            "name": "Chapter 3: Ratios and Proportions",
            "description": (
                "Understanding ratios, rates, unit rates, and solving "
                "proportion problems with real-world applications."
            ),
            "grade_level": 7,
            "topics": [
                "Ratios",
                "Rates and Unit Rates",
                "Proportions",
                "Percent Problems",
                "Scale Drawings",
            ],
        },
    ]


@pytest.fixture
def sample_text():
    """
    Fixture providing sample text for document upload tests.
    
    Returns:
        Sample educational text content
    """
    return (
        "Chapter 1: Numbers and Operations\n\n"
        "Section 1.1: Place Value\n"
        "Our number system is based on groups of ten. Each digit in a number "
        "has a value based on its position, or place, in the number.\n\n"
        "Section 1.2: Addition and Subtraction\n"
        "Addition combines two or more numbers into a single sum. "
        "Subtraction finds the difference between two numbers.\n"
    )

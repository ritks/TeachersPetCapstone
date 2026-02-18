"""Tests for adding modules for the first 3 chapters of a math textbook.

Verifies module CRUD via the FastAPI endpoints.
Uses an isolated temp database so real data is never touched.
"""

import os
import sys
import tempfile
import shutil
import types

# ── Isolate data directory ───────────────────────────────────────────────
_test_data_dir = tempfile.mkdtemp(prefix="teacherspet_test_")

# ── Stub out google.genai (which has a broken cryptography dep in this env) ──
# We only stub genai & genai.types; the rest of the google namespace (e.g.
# google.protobuf used by chromadb) is left intact.
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

# Only inject the genai sub-modules; do NOT replace the top-level google package
sys.modules["google.genai"] = _fake_genai
sys.modules["google.genai.types"] = _fake_types

# Ensure the google namespace can still find genai via attribute access
import google as _real_google  # noqa: E402

_real_google.genai = _fake_genai

# Set dummy API key
os.environ["GEMINI_API_KEY"] = "test-key-not-used"

# ── Patch database paths to use temp dir ─────────────────────────────────
import database.db as _db_mod

_db_mod.DATABASE_DIR = _test_data_dir
_db_mod.DATABASE_URL = f"sqlite:///{os.path.join(_test_data_dir, 'test.db')}"
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_db_mod.engine = create_engine(
    _db_mod.DATABASE_URL, connect_args={"check_same_thread": False}
)
_db_mod.SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=_db_mod.engine
)

import rag.vector_store as _vs_mod

_vs_mod.CHROMA_DIR = os.path.join(_test_data_dir, "chroma")

# ── Now import the app ───────────────────────────────────────────────────
from main import app  # noqa: E402
from database.db import init_db

# Create tables in the temp database (TestClient doesn't fire startup events)
init_db()

from fastapi.testclient import TestClient

client = TestClient(app)

# ── Chapter definitions ──────────────────────────────────────────────────

CHAPTERS = [
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


# ── Tests ─────────────────────────────────────────────────────────────────


def test_create_chapter_modules():
    """Create a module for each of the first 3 chapters."""
    created_ids = []
    for chapter in CHAPTERS:
        resp = client.post("/modules", json=chapter)
        assert resp.status_code == 200, (
            f"Failed to create {chapter['name']}: {resp.text}"
        )
        data = resp.json()
        assert data["name"] == chapter["name"]
        assert data["description"] == chapter["description"]
        assert data["grade_level"] == chapter["grade_level"]
        assert data["topics"] == chapter["topics"]
        assert data["document_count"] == 0
        assert data["chunk_count"] == 0
        assert data["id"]  # UUID was generated
        created_ids.append(data["id"])
        print(f"  Created: {data['name']} (id={data['id']})")

    assert len(set(created_ids)) == 3, "Module IDs should be unique"
    return created_ids


def test_list_modules_returns_all_three():
    """After creating 3 modules, listing should return all of them."""
    resp = client.get("/modules")
    assert resp.status_code == 200
    modules = resp.json()
    names = [m["name"] for m in modules]
    for chapter in CHAPTERS:
        assert chapter["name"] in names, f"Missing module: {chapter['name']}"
    print(f"  Listed {len(modules)} modules — all 3 chapters present")


def test_get_individual_modules(module_ids: list[str]):
    """Retrieve each module by ID and verify its data."""
    for i, module_id in enumerate(module_ids):
        resp = client.get(f"/modules/{module_id}")
        assert resp.status_code == 200, f"Failed to get module {module_id}"
        data = resp.json()
        assert data["name"] == CHAPTERS[i]["name"]
        assert data["id"] == module_id
        print(f"  Verified: {data['name']}")


def test_update_module(module_id: str):
    """Test updating a module's description."""
    new_desc = "Updated description for testing purposes."
    resp = client.put(
        f"/modules/{module_id}",
        json={"description": new_desc},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == new_desc
    assert data["name"] == CHAPTERS[0]["name"]
    assert data["grade_level"] == CHAPTERS[0]["grade_level"]
    print(f"  Updated description for {data['name']}")


def test_module_not_found():
    """Requesting a non-existent module returns 404."""
    resp = client.get("/modules/non-existent-id")
    assert resp.status_code == 404
    print("  404 correctly returned for non-existent module")


def test_delete_module(module_id: str, module_name: str):
    """Delete a module and verify it's gone."""
    resp = client.delete(f"/modules/{module_id}")
    assert resp.status_code == 200
    assert "deleted" in resp.json()["message"].lower()

    resp = client.get(f"/modules/{module_id}")
    assert resp.status_code == 404
    print(f"  Deleted and confirmed removal: {module_name}")


def test_upload_text_to_module(module_id: str):
    """Upload sample text content to a module."""
    sample_text = (
        "Chapter 1: Numbers and Operations\n\n"
        "Section 1.1: Place Value\n"
        "Our number system is based on groups of ten. Each digit in a number "
        "has a value based on its position, or place, in the number.\n\n"
        "Section 1.2: Addition and Subtraction\n"
        "Addition combines two or more numbers into a single sum. "
        "Subtraction finds the difference between two numbers.\n"
    )
    resp = client.post(
        f"/modules/{module_id}/documents/text",
        json={"text": sample_text, "filename": "chapter1_notes.txt"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["original_filename"] == "chapter1_notes.txt"
    assert data["status"] == "uploaded"
    assert data["module_id"] == module_id
    print(
        f"  Uploaded text document: {data['original_filename']} "
        f"(doc_id={data['id']})"
    )
    return data["id"]


def test_list_documents(module_id: str, expected_count: int = 1):
    """List documents for a module and verify count."""
    resp = client.get(f"/modules/{module_id}/documents")
    assert resp.status_code == 200
    docs = resp.json()
    assert len(docs) == expected_count, (
        f"Expected {expected_count} docs, got {len(docs)}"
    )
    print(f"  Module has {len(docs)} document(s)")


# ── Runner ────────────────────────────────────────────────────────────────


def main():
    print("=" * 60)
    print("Testing Module Creation for First 3 Textbook Chapters")
    print("=" * 60)

    print("\n1. Creating modules for chapters 1-3...")
    module_ids = test_create_chapter_modules()

    print("\n2. Listing all modules...")
    test_list_modules_returns_all_three()

    print("\n3. Retrieving individual modules by ID...")
    test_get_individual_modules(module_ids)

    print("\n4. Updating a module...")
    test_update_module(module_ids[0])

    print("\n5. Testing 404 for non-existent module...")
    test_module_not_found()

    print("\n6. Uploading sample text to Chapter 1 module...")
    doc_id = test_upload_text_to_module(module_ids[0])

    print("\n7. Listing documents for Chapter 1 module...")
    test_list_documents(module_ids[0], expected_count=1)

    print("\n8. Deleting Chapter 3 module (cleanup test)...")
    test_delete_module(module_ids[2], CHAPTERS[2]["name"])

    print("\n9. Verifying remaining modules...")
    resp = client.get("/modules")
    remaining = resp.json()
    remaining_names = [m["name"] for m in remaining]
    assert CHAPTERS[2]["name"] not in remaining_names, (
        "Deleted module should not appear"
    )
    print(f"  {len(remaining)} modules remain (Chapter 3 removed)")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    finally:
        shutil.rmtree(_test_data_dir, ignore_errors=True)

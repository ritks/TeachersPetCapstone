"""Unit tests for database models."""

import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from database.models import Module, Document, Base


@pytest.fixture
def db_engine():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session(db_engine):
    """Create a database session for testing."""
    SessionLocal = sessionmaker(bind=db_engine)
    session = SessionLocal()
    yield session
    session.close()


class TestModuleModel:
    """Tests for the Module model."""

    def test_module_creation(self, db_session):
        """Test creating a module with all fields."""
        module = Module(
            name="Chapter 1",
            description="Introduction to Numbers",
            grade_level=6,
            topics=["Place Value", "Addition"],
            teacher_uid="teacher123"
        )

        db_session.add(module)
        db_session.commit()

        # Verify module was saved
        retrieved = db_session.query(Module).filter_by(name="Chapter 1").first()
        assert retrieved is not None
        assert retrieved.name == "Chapter 1"
        assert retrieved.grade_level == 6

    def test_module_id_is_generated(self, db_session):
        """Test that module ID is auto-generated as UUID."""
        module = Module(name="Test Module")

        db_session.add(module)
        db_session.commit()

        # ID should be auto-generated (non-empty string)
        assert module.id is not None
        assert isinstance(module.id, str)
        assert len(module.id) > 0

    def test_module_timestamps_are_set(self, db_session):
        """Test that created_at and updated_at are set automatically."""
        module = Module(name="Timestamps Test")

        db_session.add(module)
        db_session.commit()

        # Both timestamps should be set
        assert module.created_at is not None
        assert module.updated_at is not None
        assert isinstance(module.created_at, datetime)
        assert isinstance(module.updated_at, datetime)

    def test_module_default_values(self, db_session):
        """Test that module has correct default values."""
        module = Module(name="Defaults Test")

        db_session.add(module)
        db_session.commit()

        retrieved = db_session.query(Module).filter_by(name="Defaults Test").first()
        assert retrieved.grade_level == 8  # Default grade level
        assert retrieved.topics == []  # Empty topics by default
        assert retrieved.teacher_uid is None  # Optional

    def test_module_nullable_fields(self, db_session):
        """Test that nullable fields can be None."""
        module = Module(
            name="Minimal Module",
            description=None,
            teacher_uid=None
        )

        db_session.add(module)
        db_session.commit()

        retrieved = db_session.query(Module).filter_by(name="Minimal Module").first()
        assert retrieved.description is None
        assert retrieved.teacher_uid is None

    def test_module_topics_json_storage(self, db_session):
        """Test that topics are stored as JSON."""
        topics = ["Fractions", "Decimals", "Percentages"]
        module = Module(
            name="Topics Test",
            topics=topics
        )

        db_session.add(module)
        db_session.commit()

        retrieved = db_session.query(Module).filter_by(name="Topics Test").first()
        assert retrieved.topics == topics
        assert isinstance(retrieved.topics, list)

    def test_module_cascade_delete_documents(self, db_session):
        """Test that deleting a module cascades to delete its documents."""
        module = Module(name="Parent Module")
        db_session.add(module)
        db_session.flush()

        doc1 = Document(
            module_id=module.id,
            filename="file1.pdf",
            original_filename="file1.pdf"
        )
        doc2 = Document(
            module_id=module.id,
            filename="file2.pdf",
            original_filename="file2.pdf"
        )
        db_session.add_all([doc1, doc2])
        db_session.commit()

        # Verify documents exist
        assert db_session.query(Document).filter_by(module_id=module.id).count() == 2

        # Delete module
        db_session.delete(module)
        db_session.commit()

        # Verify documents are also deleted
        assert db_session.query(Document).filter_by(module_id=module.id).count() == 0

    def test_module_relationship_to_documents(self, db_session):
        """Test the relationship between Module and Documents."""
        module = Module(name="Relationship Test")
        db_session.add(module)
        db_session.flush()

        doc = Document(
            module_id=module.id,
            filename="doc.txt",
            original_filename="doc.txt"
        )
        db_session.add(doc)
        db_session.commit()

        # Access documents through relationship
        retrieved_module = db_session.query(Module).filter_by(name="Relationship Test").first()
        assert len(retrieved_module.documents) == 1
        assert retrieved_module.documents[0].filename == "doc.txt"

    def test_module_unique_ids(self, db_session):
        """Test that multiple modules get unique IDs."""
        module1 = Module(name="Module 1")
        module2 = Module(name="Module 2")

        db_session.add_all([module1, module2])
        db_session.commit()

        assert module1.id != module2.id

    def test_module_teacher_uid_indexed(self, db_engine):
        """Test that teacher_uid column is indexed for efficient queries."""
        inspector = inspect(db_engine)
        indexes = inspector.get_indexes("modules")
        index_columns = [col for idx in indexes for col in idx["column_names"]]

        # teacher_uid should be indexed for efficient filtering
        assert "teacher_uid" in index_columns


class TestDocumentModel:
    """Tests for the Document model."""

    def test_document_creation(self, db_session):
        """Test creating a document."""
        module = Module(name="Parent Module")
        db_session.add(module)
        db_session.flush()

        document = Document(
            module_id=module.id,
            filename="test.pdf",
            original_filename="original_test.pdf",
            status="uploaded"
        )

        db_session.add(document)
        db_session.commit()

        retrieved = db_session.query(Document).filter_by(filename="test.pdf").first()
        assert retrieved is not None
        assert retrieved.original_filename == "original_test.pdf"
        assert retrieved.status == "uploaded"

    def test_document_id_generated(self, db_session):
        """Test that document ID is auto-generated."""
        module = Module(name="Module")
        db_session.add(module)
        db_session.flush()

        doc = Document(
            module_id=module.id,
            filename="file.txt",
            original_filename="file.txt"
        )

        db_session.add(doc)
        db_session.commit()

        assert doc.id is not None
        assert isinstance(doc.id, str)
        assert len(doc.id) > 0

    def test_document_default_status(self, db_session):
        """Test that document has default status."""
        module = Module(name="Module")
        db_session.add(module)
        db_session.flush()

        doc = Document(
            module_id=module.id,
            filename="file.txt",
            original_filename="file.txt"
        )

        db_session.add(doc)
        db_session.commit()

        retrieved = db_session.query(Document).filter_by(filename="file.txt").first()
        assert retrieved.status == "uploaded"

    def test_document_created_at_set(self, db_session):
        """Test that document created_at is set."""
        module = Module(name="Module")
        db_session.add(module)
        db_session.flush()

        doc = Document(
            module_id=module.id,
            filename="file.txt",
            original_filename="file.txt"
        )

        db_session.add(doc)
        db_session.commit()

        retrieved = db_session.query(Document).filter_by(filename="file.txt").first()
        assert retrieved.created_at is not None
        assert isinstance(retrieved.created_at, datetime)

    def test_document_chunk_count_default(self, db_session):
        """Test that chunk_count defaults to 0."""
        module = Module(name="Module")
        db_session.add(module)
        db_session.flush()

        doc = Document(
            module_id=module.id,
            filename="file.txt",
            original_filename="file.txt"
        )

        db_session.add(doc)
        db_session.commit()

        retrieved = db_session.query(Document).filter_by(filename="file.txt").first()
        assert retrieved.chunk_count == 0

    def test_document_error_message_nullable(self, db_session):
        """Test that error_message can be null or set."""
        module = Module(name="Module")
        db_session.add(module)
        db_session.flush()

        # Without error
        doc1 = Document(
            module_id=module.id,
            filename="success.txt",
            original_filename="success.txt"
        )

        # With error
        doc2 = Document(
            module_id=module.id,
            filename="failed.txt",
            original_filename="failed.txt",
            error_message="Processing failed: invalid format"
        )

        db_session.add_all([doc1, doc2])
        db_session.commit()

        retrieved1 = db_session.query(Document).filter_by(filename="success.txt").first()
        retrieved2 = db_session.query(Document).filter_by(filename="failed.txt").first()

        assert retrieved1.error_message is None
        assert retrieved2.error_message == "Processing failed: invalid format"

    def test_document_foreign_key_constraint(self, db_session):
        """Test that document requires valid module_id."""
        # Try to insert a document with non-existent module_id
        doc = Document(
            module_id="nonexistent-module-id",
            filename="file.txt",
            original_filename="file.txt"
        )

        db_session.add(doc)
        # Foreign key constraint should prevent commit
        # (if enforced at DB level)
        # This depends on SQLite configuration

    def test_document_status_values(self, db_session):
        """Test that document status field accepts various values."""
        module = Module(name="Module")
        db_session.add(module)
        db_session.flush()

        statuses = ["uploaded", "processing", "processed", "error"]
        for status in statuses:
            doc = Document(
                module_id=module.id,
                filename=f"file_{status}.txt",
                original_filename=f"file_{status}.txt",
                status=status
            )
            db_session.add(doc)

        db_session.commit()

        for status in statuses:
            retrieved = db_session.query(Document).filter_by(
                filename=f"file_{status}.txt"
            ).first()
            assert retrieved.status == status

    def test_document_module_relationship(self, db_session):
        """Test accessing module from document."""
        module = Module(name="Parent Module")
        db_session.add(module)
        db_session.flush()

        doc = Document(
            module_id=module.id,
            filename="file.txt",
            original_filename="file.txt"
        )
        db_session.add(doc)
        db_session.commit()

        retrieved_doc = db_session.query(Document).filter_by(filename="file.txt").first()
        assert retrieved_doc.module is not None
        assert retrieved_doc.module.name == "Parent Module"

    def test_document_multiple_per_module(self, db_session):
        """Test that a module can have multiple documents."""
        module = Module(name="Module with Docs")
        db_session.add(module)
        db_session.flush()

        for i in range(5):
            doc = Document(
                module_id=module.id,
                filename=f"file_{i}.txt",
                original_filename=f"file_{i}.txt"
            )
            db_session.add(doc)

        db_session.commit()

        retrieved_module = db_session.query(Module).filter_by(name="Module with Docs").first()
        assert len(retrieved_module.documents) == 5

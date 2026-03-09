"""Unit tests for vector store functionality."""

import pytest
from unittest.mock import Mock, MagicMock, patch
import tempfile
import os

from rag.vector_store import VectorStore


@pytest.fixture
def temp_chroma_dir():
    """Create a temporary directory for Chroma data."""
    tmpdir = tempfile.mkdtemp(prefix="test_chroma_")
    yield tmpdir
    # Cleanup
    import shutil
    shutil.rmtree(tmpdir, ignore_errors=True)


class TestVectorStore:
    """Tests for the VectorStore ChromaDB wrapper."""

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_init_creates_persist_dir(self, mock_makedirs, mock_chromadb, temp_chroma_dir):
        """Test that VectorStore creates persist directory."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir=temp_chroma_dir)

        # Verify makedirs was called
        mock_makedirs.assert_called()
        # Verify chromadb client was created
        mock_chromadb.assert_called_once()

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_init_uses_default_chroma_dir(self, mock_makedirs, mock_chromadb):
        """Test that VectorStore uses CHROMA_DIR when not provided."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore()

        # Should call chromadb
        assert mock_chromadb.called

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_init_creates_collection(self, mock_makedirs, mock_chromadb):
        """Test that VectorStore creates the textbook_chunks collection."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir="/tmp/test_chroma")

        mock_client.get_or_create_collection.assert_called_once_with(
            name="textbook_chunks",
            metadata={"hnsw:space": "cosine"}
        )
        assert store.collection is mock_collection

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_add_chunks(self, mock_makedirs, mock_chromadb):
        """Test adding chunks to the vector store."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir="/tmp/test")

        ids = ["chunk1", "chunk2"]
        documents = ["Text of chunk 1", "Text of chunk 2"]
        embeddings = [[0.1, 0.2], [0.3, 0.4]]
        metadatas = [
            {"module_id": "mod1"},
            {"module_id": "mod1"}
        ]

        store.add_chunks(ids, documents, embeddings, metadatas)

        mock_collection.add.assert_called_once_with(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_add_chunks_large_batch(self, mock_makedirs, mock_chromadb):
        """Test adding a large batch of chunks."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir="/tmp/test")

        ids = [f"chunk_{i}" for i in range(100)]
        documents = [f"Content {i}" for i in range(100)]
        embeddings = [[0.1 * i] * 100 for i in range(100)]
        metadatas = [{"module_id": "mod1"} for _ in range(100)]

        store.add_chunks(ids, documents, embeddings, metadatas)

        call_args = mock_collection.add.call_args
        assert len(call_args[1]["ids"]) == 100

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_query_without_module_filter(self, mock_makedirs, mock_chromadb):
        """Test querying the vector store without module filter."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_collection.query.return_value = {
            "ids": [["chunk1", "chunk2"]],
            "documents": [["Text 1", "Text 2"]],
            "distances": [[0.1, 0.2]],
            "metadatas": [[{"module_id": "mod1"}, {"module_id": "mod1"}]]
        }
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir="/tmp/test")
        result = store.query([0.5] * 100, n_results=5)

        call_kwargs = mock_collection.query.call_args[1]
        assert call_kwargs["n_results"] == 5
        assert call_kwargs["where"] is None

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_query_with_module_filter(self, mock_makedirs, mock_chromadb):
        """Test querying with module_id filter."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_collection.query.return_value = {
            "ids": [["chunk1"]],
            "documents": [["Text"]],
            "distances": [[0.1]],
            "metadatas": [[{"module_id": "target_mod"}]]
        }
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir="/tmp/test")
        result = store.query([0.5] * 100, module_id="target_mod", n_results=3)

        call_kwargs = mock_collection.query.call_args[1]
        assert call_kwargs["where"] == {"module_id": "target_mod"}

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_query_result_structure(self, mock_makedirs, mock_chromadb):
        """Test that query returns expected result structure."""
        mock_client = Mock()
        mock_collection = Mock()
        expected_result = {
            "ids": [["chunk1", "chunk2"]],
            "documents": [["Text 1", "Text 2"]],
            "distances": [[0.1, 0.2]],
            "metadatas": [[{"key": "val1"}, {"key": "val2"}]]
        }
        mock_collection.query.return_value = expected_result
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir="/tmp/test")
        result = store.query([0.5] * 100)

        assert "ids" in result
        assert "documents" in result
        assert "distances" in result

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_delete_by_document(self, mock_makedirs, mock_chromadb):
        """Test deleting chunks by document_id."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir="/tmp/test")
        store.delete_by_document("doc123")

        mock_collection.delete.assert_called_with(where={"document_id": "doc123"})

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_delete_by_module(self, mock_makedirs, mock_chromadb):
        """Test deleting chunks by module_id."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir="/tmp/test")
        store.delete_by_module("mod456")

        mock_collection.delete.assert_called_with(where={"module_id": "mod456"})

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_get_chunk_count_all(self, mock_makedirs, mock_chromadb):
        """Test getting total chunk count."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_collection.count.return_value = 42
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir="/tmp/test")
        count = store.get_chunk_count()

        assert count == 42

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_get_chunk_count_by_module(self, mock_makedirs, mock_chromadb):
        """Test getting chunk count for a specific module."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_collection.get.return_value = {"ids": ["c1", "c2", "c3"]}
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir="/tmp/test")
        count = store.get_chunk_count(module_id="mod123")

        assert count == 3

    @patch("rag.vector_store.chromadb.PersistentClient")
    @patch("rag.vector_store.os.makedirs")
    def test_get_chunk_count_empty_module(self, mock_makedirs, mock_chromadb):
        """Test getting chunk count for module with no chunks."""
        mock_client = Mock()
        mock_collection = Mock()
        mock_collection.get.return_value = {"ids": []}
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_chromadb.return_value = mock_client

        store = VectorStore(persist_dir="/tmp/test")
        count = store.get_chunk_count(module_id="empty_mod")

        assert count == 0

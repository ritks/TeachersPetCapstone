"""
Unit tests for the DocumentProcessor ingestion pipeline.

The processor chunks text/PDF content, embeds it, and writes it to the vector
store. The embedding service and vector store are faked; a real TextChunker is
used so chunking behavior is exercised end to end.
"""

import sys
import types

import pytest

from rag.document_processor import DocumentProcessor


class FakeEmbeddingService:
    def __init__(self):
        self.batches = []

    def embed_batch(self, texts):
        self.batches.append(texts)
        return [[0.0, 0.1, 0.2] for _ in texts]


class FakeVectorStore:
    def __init__(self):
        self.added = None
        self.deleted = None

    def add_chunks(self, ids, documents, embeddings, metadatas):
        self.added = {
            "ids": ids,
            "documents": documents,
            "embeddings": embeddings,
            "metadatas": metadatas,
        }

    def delete_by_document(self, document_id):
        self.deleted = document_id


@pytest.fixture
def processor():
    return DocumentProcessor(FakeEmbeddingService(), FakeVectorStore())


class TestProcessText:
    def test_process_text_creates_and_stores_chunks(self, processor):
        text = "Fractions are parts of a whole. " * 50

        count = processor.process_text(text, module_id="mod-1", document_id="doc-1")

        assert count > 0
        added = processor.vector_store.added
        assert added is not None
        assert len(added["ids"]) == count
        assert added["ids"][0] == "doc-1_chunk_0"
        assert processor.embedding_service.batches  # embeddings were requested

    def test_process_text_no_chunks_returns_zero_and_skips_store(self):
        # Exercises the `if not chunks: return 0` guard by feeding a chunker
        # that yields nothing, so the vector store is never touched.
        class EmptyChunker:
            def chunk_text(self, text):
                return []

        dp = DocumentProcessor(
            FakeEmbeddingService(), FakeVectorStore(), chunker=EmptyChunker()
        )

        count = dp.process_text("anything", module_id="mod-1", document_id="doc-1")

        assert count == 0
        assert dp.vector_store.added is None

    def test_process_chunks_metadata_fields(self, processor):
        processor.process_text("Some content to chunk.", "mod-7", "doc-9")

        meta = processor.vector_store.added["metadatas"][0]
        assert meta["module_id"] == "mod-7"
        assert meta["document_id"] == "doc-9"
        assert "chunk_index" in meta
        assert "chapter" in meta
        assert "section" in meta
        assert "page_start" in meta
        assert "page_end" in meta


class TestSaveUpload:
    def test_save_upload_writes_file_with_uuid_name(self, processor, tmp_path, monkeypatch):
        monkeypatch.setattr("rag.document_processor.UPLOAD_DIR", str(tmp_path))

        file_path, saved_filename = processor.save_upload(b"hello bytes", "notes.pdf")

        assert saved_filename.endswith(".pdf")
        assert saved_filename != "notes.pdf"  # randomized name
        with open(file_path, "rb") as f:
            assert f.read() == b"hello bytes"


class TestDeleteDocument:
    def test_delete_document_delegates_to_vector_store(self, processor):
        processor.delete_document("doc-42")
        assert processor.vector_store.deleted == "doc-42"


class TestProcessPdf:
    def test_process_pdf_maps_pages_and_stores(self, processor, monkeypatch):
        # Inject a fake `fitz` (PyMuPDF) so no real PDF/library is needed.
        class FakePage:
            def __init__(self, number, text):
                self.number = number
                self._text = text

            def get_text(self):
                return self._text

        class FakeDoc:
            def __init__(self, pages):
                self._pages = pages

            def __iter__(self):
                return iter(self._pages)

            def close(self):
                pass

        fake_fitz = types.ModuleType("fitz")
        fake_fitz.open = lambda path: FakeDoc(
            [
                FakePage(0, "Fractions are parts of a whole. " * 20),
                FakePage(1, "Decimals extend fractions. " * 20),
            ]
        )
        monkeypatch.setitem(sys.modules, "fitz", fake_fitz)

        count = processor.process_pdf("ignored.pdf", module_id="mod-1", document_id="doc-pdf")

        assert count > 0
        meta = processor.vector_store.added["metadatas"][0]
        assert meta["page_start"] >= 1
        assert meta["page_end"] >= meta["page_start"]
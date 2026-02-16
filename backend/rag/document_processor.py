import os
import uuid
from typing import Optional

from .chunker import TextChunker
from .embeddings import EmbeddingService
from .vector_store import VectorStore

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "uploads")


class DocumentProcessor:
    """End-to-end pipeline: file → text extraction → chunking → embedding → vector store."""

    def __init__(
        self,
        embedding_service: EmbeddingService,
        vector_store: VectorStore,
        chunker: Optional[TextChunker] = None,
    ):
        self.embedding_service = embedding_service
        self.vector_store = vector_store
        self.chunker = chunker or TextChunker()
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    def process_pdf(self, file_path: str, module_id: str, document_id: str) -> int:
        """Extract text from a PDF, chunk it, embed it, and store in the vector DB.
        Returns the number of chunks created.
        """
        import fitz  # PyMuPDF

        doc = fitz.open(file_path)
        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n\n"
        doc.close()

        return self._process_text(full_text, module_id, document_id)

    def process_text(self, text: str, module_id: str, document_id: str) -> int:
        """Chunk raw text, embed it, and store in the vector DB.
        Returns the number of chunks created.
        """
        return self._process_text(text, module_id, document_id)

    def delete_document(self, document_id: str):
        self.vector_store.delete_by_document(document_id)

    @staticmethod
    def save_upload(file_content: bytes, original_filename: str) -> tuple[str, str]:
        """Persist an uploaded file to disk. Returns (file_path, saved_filename)."""
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        ext = os.path.splitext(original_filename)[1]
        saved_filename = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(UPLOAD_DIR, saved_filename)
        with open(file_path, "wb") as f:
            f.write(file_content)
        return file_path, saved_filename

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _process_text(self, text: str, module_id: str, document_id: str) -> int:
        chunks = self.chunker.chunk_text(text)
        if not chunks:
            return 0

        texts = [c.content for c in chunks]
        embeddings = self.embedding_service.embed_batch(texts)

        ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "module_id": module_id,
                "document_id": document_id,
                "chunk_index": c.chunk_index,
                "chapter": c.chapter or "",
                "section": c.section or "",
            }
            for c in chunks
        ]

        self.vector_store.add_chunks(
            ids=ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        return len(chunks)

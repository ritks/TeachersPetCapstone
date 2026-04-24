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
        page_boundaries: list[tuple[int, int]] = []  # (page_number_1indexed, start_offset)
        for page in doc:
            page_boundaries.append((page.number + 1, len(full_text)))
            full_text += page.get_text() + "\n\n"
        total_pages = len(page_boundaries)
        doc.close()

        chunks = self.chunker.chunk_text(full_text)
        if not chunks:
            return 0

        # Map each chunk back to its page range
        def _find_page(char_pos: int) -> int:
            for i in range(len(page_boundaries) - 1, -1, -1):
                if char_pos >= page_boundaries[i][1]:
                    return page_boundaries[i][0]
            return 1

        search_pos = 0
        for chunk in chunks:
            anchor = chunk.content[:100].strip()
            idx = full_text.find(anchor, search_pos)
            if idx == -1:
                idx = full_text.find(anchor)
            if idx != -1:
                chunk.metadata["page_start"] = _find_page(idx)
                chunk.metadata["page_end"] = _find_page(idx + len(chunk.content))
                search_pos = idx
            else:
                chunk.metadata["page_start"] = 1
                chunk.metadata["page_end"] = total_pages

        return self._process_chunks(chunks, full_text, module_id, document_id)

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
        return self._process_chunks(chunks, text, module_id, document_id)

    def _process_chunks(
        self,
        chunks: list,
        full_text: str,
        module_id: str,
        document_id: str,
    ) -> int:
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
                "page_start": c.metadata.get("page_start", 0),
                "page_end": c.metadata.get("page_end", 0),
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

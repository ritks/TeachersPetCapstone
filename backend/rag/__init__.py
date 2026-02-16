# Lazy re-exports — heavy dependencies (google-genai, chromadb) are only
# imported when the names are actually accessed, keeping lightweight
# imports (e.g. ``from rag.chunker import TextChunker``) fast.

from .chunker import TextChunker, TextChunk

__all__ = [
    "TextChunker",
    "TextChunk",
    "EmbeddingService",
    "VectorStore",
    "Retriever",
    "DocumentProcessor",
]


def __getattr__(name: str):
    if name == "EmbeddingService":
        from .embeddings import EmbeddingService
        return EmbeddingService
    if name == "VectorStore":
        from .vector_store import VectorStore
        return VectorStore
    if name == "Retriever":
        from .retriever import Retriever
        return Retriever
    if name == "DocumentProcessor":
        from .document_processor import DocumentProcessor
        return DocumentProcessor
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

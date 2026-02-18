import chromadb
import os
from typing import Optional

CHROMA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "chroma")


class VectorStore:
    """ChromaDB-backed vector store for textbook chunks."""

    def __init__(self, persist_dir: Optional[str] = None):
        persist_dir = persist_dir or CHROMA_DIR
        os.makedirs(persist_dir, exist_ok=True)
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name="textbook_chunks",
            metadata={"hnsw:space": "cosine"},
        )

    def add_chunks(
        self,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ):
        self.collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    def query(
        self,
        query_embedding: list[float],
        module_id: Optional[str] = None,
        n_results: int = 5,
    ) -> dict:
        where_filter = {"module_id": module_id} if module_id else None
        return self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )

    def delete_by_document(self, document_id: str):
        self.collection.delete(where={"document_id": document_id})

    def delete_by_module(self, module_id: str):
        self.collection.delete(where={"module_id": module_id})

    def get_chunk_count(self, module_id: Optional[str] = None) -> int:
        if module_id:
            results = self.collection.get(where={"module_id": module_id})
            return len(results["ids"])
        return self.collection.count()

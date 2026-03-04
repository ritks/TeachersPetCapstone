from typing import Optional

from .embeddings import EmbeddingService
from .vector_store import VectorStore


class Retriever:
    """Combines embedding search with module-scoped filtering and prompt building."""

    def __init__(
        self,
        embedding_service: EmbeddingService,
        vector_store: VectorStore,
        top_k: int = 5,
    ):
        self.embedding_service = embedding_service
        self.vector_store = vector_store
        self.top_k = top_k

    def retrieve(
        self,
        query: str,
        module_id: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> list[dict]:
        k = top_k or self.top_k
        query_embedding = self.embedding_service.embed_text(query)
        results = self.vector_store.query(
            query_embedding=query_embedding,
            module_id=module_id,
            n_results=k,
        )

        chunks: list[dict] = []
        if results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                chunks.append(
                    {
                        "content": doc,
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "distance": results["distances"][0][i] if results["distances"] else None,
                    }
                )
        return chunks

    def build_context(
        self,
        query: str,
        module_id: Optional[str] = None,
        module_name: Optional[str] = None,
        module_description: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> str:
        chunks = self.retrieve(query, module_id=module_id, top_k=top_k)

        if not chunks:
            if module_name:
                return self._module_scope_prompt(module_name, module_description, "")
            return ""

        parts: list[str] = []
        for i, chunk in enumerate(chunks, 1):
            meta = chunk["metadata"]
            source = ""
            if meta.get("chapter"):
                source += f" ({meta['chapter']}"
                if meta.get("section"):
                    source += f", {meta['section']}"
                source += ")"
            parts.append(f"[Reference {i}{source}]\n{chunk['content']}")

        references = "\n\n".join(parts)

        if module_name:
            return self._module_scope_prompt(module_name, module_description, references)

        return (
            "Use the following textbook reference material to inform your responses:\n"
            "---\n"
            f"{references}\n"
            "---\n"
            "Reference the textbook material when relevant, but explain concepts in your own words."
        )

    @staticmethod
    def _module_scope_prompt(
        module_name: str,
        module_description: Optional[str],
        references: str,
    ) -> str:
        desc = f" — {module_description}" if module_description else ""

        prompt = (
            f'You are currently teaching the module: "{module_name}"{desc}.\n\n'
            "SCOPE & FOCUS RULES:\n"
            "- You are always a *math* tutor first. Stay within mathematics that is reasonable for K-8 students.\n"
            f"- Prioritize connecting your explanations to {module_name} when possible (use its vocabulary, ideas, and textbook context).\n"
            "- If a student asks a non-math question, gently say you are a math tutor and redirect back to math.\n"
            "- If a question is math but not exactly from this module, you may still answer it clearly and helpfully, "
            "and, when appropriate, relate it back to the current module.\n"
        )

        if references:
            prompt += (
                "\nUse the following textbook reference material to inform your responses:\n"
                "---\n"
                f"{references}\n"
                "---\n"
                "Reference the textbook material when relevant, but explain concepts in your own words step-by-step.\n"
            )

        return prompt

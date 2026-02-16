from google import genai
import os
from typing import Optional


class EmbeddingService:
    """Thin wrapper around the Gemini text-embedding API."""

    MODEL = "text-embedding-004"

    def __init__(self, client: Optional[genai.Client] = None):
        if client:
            self.client = client
        else:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY not set")
            self.client = genai.Client(api_key=api_key)

    def embed_text(self, text: str) -> list[float]:
        result = self.client.models.embed_content(
            model=self.MODEL,
            contents=text,
        )
        return result.embeddings[0].values

    def embed_batch(self, texts: list[str], batch_size: int = 100) -> list[list[float]]:
        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            result = self.client.models.embed_content(
                model=self.MODEL,
                contents=batch,
            )
            all_embeddings.extend([e.values for e in result.embeddings])
        return all_embeddings

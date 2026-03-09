"""Unit tests for RAG embeddings service."""

import pytest
from unittest.mock import Mock, MagicMock, patch

from rag.embeddings import EmbeddingService


class TestEmbeddingService:
    """Tests for the EmbeddingService wrapper around Gemini API."""

    def test_init_with_provided_client(self):
        """Test initialization with an injected client."""
        mock_client = Mock()
        service = EmbeddingService(client=mock_client)
        assert service.client is mock_client

    def test_init_with_api_key_from_env(self):
        """Test initialization reads GEMINI_API_KEY from environment."""
        with patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}):
            with patch("rag.embeddings.genai.Client") as mock_genai_client:
                service = EmbeddingService()
                mock_genai_client.assert_called_once_with(api_key="test-key")

    def test_init_missing_api_key_raises_error(self):
        """Test initialization fails with missing GEMINI_API_KEY."""
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(ValueError, match="GEMINI_API_KEY not set"):
                EmbeddingService()

    def test_embed_text_single_text(self):
        """Test embedding a single text string."""
        mock_client = Mock()
        mock_embedding = Mock()
        mock_embedding.values = [0.1, 0.2, 0.3, 0.4, 0.5]

        mock_response = Mock()
        mock_response.embeddings = [mock_embedding]
        mock_client.models.embed_content.return_value = mock_response

        service = EmbeddingService(client=mock_client)
        result = service.embed_text("Hello world")

        assert result == [0.1, 0.2, 0.3, 0.4, 0.5]
        mock_client.models.embed_content.assert_called_once_with(
            model="gemini-embedding-001",
            contents="Hello world",
        )

    def test_embed_text_returns_correct_model(self):
        """Test that embed_text uses the correct model."""
        mock_client = Mock()
        mock_embedding = Mock()
        mock_embedding.values = [0.5] * 768  # Standard embedding dimension
        mock_response = Mock()
        mock_response.embeddings = [mock_embedding]
        mock_client.models.embed_content.return_value = mock_response

        service = EmbeddingService(client=mock_client)
        service.embed_text("test")

        # Verify correct model was called
        call_kwargs = mock_client.models.embed_content.call_args[1]
        assert call_kwargs["model"] == "gemini-embedding-001"

    def test_embed_batch_single_batch(self):
        """Test embedding multiple texts in a single batch."""
        mock_client = Mock()
        mock_embeddings = [
            Mock(values=[0.1, 0.2, 0.3]),
            Mock(values=[0.4, 0.5, 0.6]),
            Mock(values=[0.7, 0.8, 0.9]),
        ]
        mock_response = Mock()
        mock_response.embeddings = mock_embeddings
        mock_client.models.embed_content.return_value = mock_response

        service = EmbeddingService(client=mock_client)
        texts = ["text1", "text2", "text3"]
        results = service.embed_batch(texts, batch_size=100)

        assert len(results) == 3
        assert results[0] == [0.1, 0.2, 0.3]
        assert results[1] == [0.4, 0.5, 0.6]
        assert results[2] == [0.7, 0.8, 0.9]

    def test_embed_batch_multiple_batches(self):
        """Test embedding with batch size resulting in multiple API calls."""
        mock_client = Mock()

        # Setup two different responses for two batches
        batch1_embeddings = [
            Mock(values=[0.1, 0.2]),
            Mock(values=[0.3, 0.4]),
        ]
        batch2_embeddings = [
            Mock(values=[0.5, 0.6]),
        ]

        responses = [
            Mock(embeddings=batch1_embeddings),
            Mock(embeddings=batch2_embeddings),
        ]
        mock_client.models.embed_content.side_effect = responses

        service = EmbeddingService(client=mock_client)
        texts = ["text1", "text2", "text3"]
        results = service.embed_batch(texts, batch_size=2)

        assert len(results) == 3
        assert results[0] == [0.1, 0.2]
        assert results[1] == [0.3, 0.4]
        assert results[2] == [0.5, 0.6]

        # Verify two API calls were made
        assert mock_client.models.embed_content.call_count == 2

    def test_embed_batch_empty_list(self):
        """Test embedding an empty list of texts."""
        mock_client = Mock()
        service = EmbeddingService(client=mock_client)
        results = service.embed_batch([])

        assert results == []
        mock_client.models.embed_content.assert_not_called()

    def test_embed_batch_respects_batch_size(self):
        """Test that batch_size parameter correctly splits texts."""
        mock_client = Mock()

        # Mock responses for 3 calls with batch_size=2
        responses = [
            Mock(embeddings=[Mock(values=[0.1] * 100) for _ in range(2)]),
            Mock(embeddings=[Mock(values=[0.2] * 100) for _ in range(2)]),
            Mock(embeddings=[Mock(values=[0.3] * 100) for _ in range(1)]),
        ]
        mock_client.models.embed_content.side_effect = responses

        service = EmbeddingService(client=mock_client)
        texts = ["text"] * 5
        results = service.embed_batch(texts, batch_size=2)

        # Verify 3 batches were created (2 + 2 + 1)
        assert mock_client.models.embed_content.call_count == 3
        assert len(results) == 5

    def test_embed_batch_large_texts(self):
        """Test embedding with long text strings."""
        mock_client = Mock()
        long_text = "word " * 10000  # ~50KB text

        mock_embedding = Mock(values=[0.5] * 768)
        mock_response = Mock(embeddings=[mock_embedding])
        mock_client.models.embed_content.return_value = mock_response

        service = EmbeddingService(client=mock_client)
        result = service.embed_batch([long_text])

        assert len(result) == 1
        mock_client.models.embed_content.assert_called_once()

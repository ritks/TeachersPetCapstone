"""Unit tests for Gemini-based response validation."""

from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from rag.validator import ResponseValidator


class TestResponseValidator:
    def test_init_with_provided_client(self):
        client = Mock()
        validator = ResponseValidator(client=client)
        assert validator.client is client

    @patch("rag.validator.genai.Client")
    def test_init_with_env_api_key(self, mock_client_cls):
        with patch.dict("os.environ", {"GEMINI_API_KEY": "env-key"}):
            validator = ResponseValidator()
        mock_client_cls.assert_called_once_with(api_key="env-key")
        assert validator.client is mock_client_cls.return_value

    def test_init_missing_key_raises_error(self):
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(ValueError, match="GEMINI_API_KEY"):
                ResponseValidator()

    @patch("rag.validator.genai.Client")
    def test_default_validators_are_gemini(self, _mock_client_cls):
        assert ResponseValidator.DEFAULT_VALIDATORS == ["gemini-2.5-flash-lite"]

    def test_validate_success_safe(self):
        mock_client = Mock()
        mock_client.models.generate_content.return_value = SimpleNamespace(text="safe")

        validator = ResponseValidator(client=mock_client)
        result = validator.validate(question="What is 2+2?", response="Let's solve it.")

        assert result["is_safe"] is True
        assert list(result["safety_votes"].values()) == ["safe"]
        assert result["errors"] == []

    def test_validate_custom_models(self):
        mock_client = Mock()
        mock_client.models.generate_content.return_value = SimpleNamespace(text="safe")
        validator = ResponseValidator(client=mock_client)

        validator.validate(
            question="Test?",
            response="Response",
            validators=["gemini-2.5-flash-lite", "gemini-2.5-flash"],
        )
        assert mock_client.models.generate_content.call_count == 2

    def test_validate_handles_generation_error(self):
        mock_client = Mock()
        mock_client.models.generate_content.side_effect = RuntimeError("network issue")

        validator = ResponseValidator(client=mock_client)
        result = validator.validate(question="Q", response="R")

        assert result["is_safe"] is False
        assert result["errors"]
        assert list(result["safety_votes"].values()) == ["error"]

    def test_validate_parses_unsafe(self):
        mock_client = Mock()
        mock_client.models.generate_content.return_value = SimpleNamespace(text="UNSAFE")

        validator = ResponseValidator(client=mock_client)
        result = validator.validate(question="Q", response="R")
        assert result["is_safe"] is False
        assert list(result["safety_votes"].values()) == ["unsafe"]

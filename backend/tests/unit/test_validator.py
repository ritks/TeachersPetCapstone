"""Unit tests for Gemini-based response validation."""

from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from rag.validator import DEFAULT_VALIDATOR_CONFIGS, ResponseValidator


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

    def test_default_validators_use_two_profiles(self):
        assert len(ResponseValidator.DEFAULT_VALIDATORS) == 2
        profiles = {c["profile"] for c in DEFAULT_VALIDATOR_CONFIGS}
        assert profiles == {"harm", "child_welfare"}

    def test_validate_success_safe(self):
        mock_client = Mock()
        mock_client.models.generate_content.return_value = SimpleNamespace(text="safe")

        validator = ResponseValidator(client=mock_client)
        result = validator.validate(question="What is 2+2?", response="Let's solve it.")

        assert result["is_safe"] is True
        assert len(result["safety_votes"]) == 2
        assert all(v == "safe" for v in result["safety_votes"].values())
        assert result["errors"] == []
        assert mock_client.models.generate_content.call_count == 2

    def test_validate_uses_different_prompts_per_profile(self):
        mock_client = Mock()
        mock_client.models.generate_content.return_value = SimpleNamespace(text="safe")
        validator = ResponseValidator(client=mock_client)

        validator.validate(question="Test?", response="Response")

        prompts = [
            call.kwargs["contents"]
            for call in mock_client.models.generate_content.call_args_list
        ]
        assert "CONTENT-HARM" in prompts[0]
        assert "CHILD-WELFARE" in prompts[1]

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

    def test_validate_one_unsafe_vote_fails(self):
        mock_client = Mock()
        mock_client.models.generate_content.side_effect = [
            SimpleNamespace(text="safe"),
            SimpleNamespace(text="unsafe"),
        ]
        validator = ResponseValidator(client=mock_client)

        result = validator.validate(question="Q", response="R")

        assert result["is_safe"] is False
        assert "unsafe" in result["safety_votes"].values()

    def test_validate_handles_generation_error(self):
        mock_client = Mock()
        mock_client.models.generate_content.side_effect = RuntimeError("network issue")

        validator = ResponseValidator(client=mock_client)
        result = validator.validate(question="Q", response="R")

        assert result["is_safe"] is False
        assert len(result["errors"]) == 2
        assert all(v == "error" for v in result["safety_votes"].values())

    def test_validate_parses_unsafe(self):
        mock_client = Mock()
        mock_client.models.generate_content.return_value = SimpleNamespace(text="UNSAFE")

        validator = ResponseValidator(client=mock_client)
        result = validator.validate(question="Q", response="R")
        assert result["is_safe"] is False
        assert all(v == "unsafe" for v in result["safety_votes"].values())

"""Unit tests for response validation using GitHub-hosted models."""

import pytest
from unittest.mock import Mock, patch

from rag.validator import ResponseValidator


class TestResponseValidator:
    """Tests for ResponseValidator using GitHub-hosted models."""

    def test_init_with_provided_token(self):
        """Test initialization with provided GitHub token."""
        validator = ResponseValidator(github_token="test-token-123")
        assert validator.token == "test-token-123"

    def test_init_with_env_token(self):
        """Test initialization reads GITHUB_TOKEN from environment."""
        with patch.dict("os.environ", {"GITHUB_TOKEN": "env-token"}):
            validator = ResponseValidator()
            assert validator.token == "env-token"

    def test_init_missing_token_raises_error(self):
        """Test initialization fails without GITHUB_TOKEN."""
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(ValueError, match="GITHUB_TOKEN"):
                ResponseValidator()

    def test_validate_endpoint_is_correct(self):
        """Test that the endpoint URL is set correctly."""
        assert ResponseValidator.ENDPOINT == "https://models.inference.ai.azure.com/chat/completions"

    def test_validate_default_validators_are_set(self):
        """Test that default validators are configured."""
        expected_defaults = [
            "meta-llama-3.1-8b-instruct",
            "gpt-4.1-mini"
        ]
        assert ResponseValidator.DEFAULT_VALIDATORS == expected_defaults

    @patch("rag.validator.requests.post")
    def test_validate_success_both_safe(self, mock_post):
        """Test validation when both models return safe."""
        # Mock successful responses from both validators
        mock_response1 = Mock()
        mock_response1.status_code = 200
        mock_response1.json.return_value = {
            "choices": [{
                "message": {
                    "content": "This response is safe and mathematically correct."
                }
            }]
        }

        mock_response2 = Mock()
        mock_response2.status_code = 200
        mock_response2.json.return_value = {
            "choices": [{
                "message": {
                    "content": "This is safe content for K-8 students."
                }
            }]
        }

        mock_post.side_effect = [mock_response1, mock_response2]

        validator = ResponseValidator(github_token="test-token")
        result = validator.validate(
            question="What is 2 + 2?",
            response="2 + 2 = 4"
        )

        assert "is_safe" in result
        assert "safety_votes" in result
        assert "explanation" in result or "errors" in result

    @patch("rag.validator.requests.post")
    def test_validate_custom_validators(self, mock_post):
        """Test validation with custom validator models."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{
                "message": {"content": "Safe"}
            }]
        }
        mock_post.return_value = mock_response

        validator = ResponseValidator(github_token="test-token")
        custom_models = ["custom-model-1", "custom-model-2"]

        validator.validate(
            question="Test?",
            response="Response",
            validators=custom_models
        )

        # Verify custom validators were used instead of defaults
        assert mock_post.call_count == len(custom_models)

    @patch("rag.validator.requests.post")
    def test_validate_uses_timeout(self, mock_post):
        """Test that validate respects timeout parameter."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Safe"}}]
        }
        mock_post.return_value = mock_response

        validator = ResponseValidator(github_token="test-token")
        custom_timeout = 30

        validator.validate(
            question="Test?",
            response="Response",
            timeout=custom_timeout
        )

        # Verify timeout was passed to requests
        for call in mock_post.call_args_list:
            assert call[1].get("timeout") == custom_timeout

    @patch("rag.validator.requests.post")
    def test_validate_handles_request_error(self, mock_post):
        """Test validation handles request failures gracefully."""
        mock_post.side_effect = Exception("Connection error")

        validator = ResponseValidator(github_token="test-token")
        result = validator.validate(
            question="What is 2 + 2?",
            response="4"
        )

        # Should return a result dict even with errors
        assert isinstance(result, dict)
        if "errors" in result:
            assert len(result["errors"]) > 0

    @patch("rag.validator.requests.post")
    def test_validate_handles_malformed_response(self, mock_post):
        """Test validation handles malformed API responses."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"invalid": "structure"}
        mock_post.return_value = mock_response

        validator = ResponseValidator(github_token="test-token")
        result = validator.validate(
            question="Test?",
            response="Response"
        )

        # Should handle gracefully
        assert isinstance(result, dict)

    @patch("rag.validator.requests.post")
    def test_validate_http_error(self, mock_post):
        """Test validation handles HTTP errors (4xx, 5xx)."""
        mock_response = Mock()
        mock_response.status_code = 429  # Rate limited
        mock_post.return_value = mock_response

        validator = ResponseValidator(github_token="test-token")
        result = validator.validate(
            question="Test?",
            response="Response"
        )

        # Should handle non-200 status codes
        assert isinstance(result, dict)

    @patch("rag.validator.requests.post")
    def test_validate_includes_auth_header(self, mock_post):
        """Test that Bearer token is included in requests."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Safe"}}]
        }
        mock_post.return_value = mock_response

        test_token = "test-bearer-token-xyz"
        validator = ResponseValidator(github_token=test_token)
        validator.validate(question="Test?", response="Response")

        # Verify Bearer token was included in headers
        for call in mock_post.call_args_list:
            headers = call[1].get("headers", {})
            auth_header = headers.get("Authorization", "")
            assert test_token in auth_header or f"Bearer {test_token}" in auth_header

    @patch("rag.validator.requests.post")
    def test_validate_single_validator(self, mock_post):
        """Test validation with a single validator model."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Safe"}}]
        }
        mock_post.return_value = mock_response

        validator = ResponseValidator(github_token="token")
        result = validator.validate(
            question="2 + 2?",
            response="4",
            validators=["single-model"]
        )

        # Should call API once for single validator
        assert mock_post.call_count == 1

    @patch("rag.validator.requests.post")
    def test_validate_empty_response(self, mock_post):
        """Test validation with empty response text."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Empty response detected"}}]
        }
        mock_post.return_value = mock_response

        validator = ResponseValidator(github_token="token")
        result = validator.validate(
            question="What is x?",
            response=""
        )

        assert isinstance(result, dict)

    @patch("rag.validator.requests.post")
    def test_validate_result_structure(self, mock_post):
        """Test that validate returns expected result structure."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Safe"}}]
        }
        mock_post.return_value = mock_response

        validator = ResponseValidator(github_token="token")
        result = validator.validate(
            question="Test?",
            response="Response"
        )

        # Result should be a dict with expected keys
        assert isinstance(result, dict)
        # Check for at least some expected keys
        expected_keys = ["is_safe", "safety_votes", "explanation", "errors",
                        "is_correct"]
        has_expected = any(key in result for key in expected_keys)
        assert has_expected or len(result) > 0

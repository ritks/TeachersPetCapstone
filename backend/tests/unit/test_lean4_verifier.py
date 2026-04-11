"""Unit tests for Lean4 formal verification."""

from types import SimpleNamespace
from unittest.mock import Mock, patch, MagicMock

import pytest

from rag.lean4_verifier import Lean4Verifier


class TestShouldVerify:
    """Tests for the complexity heuristic."""

    def test_simple_arithmetic_skipped(self):
        assert Lean4Verifier.should_verify("What is 2+3?", "5") is False

    def test_single_operation_skipped(self):
        assert Lean4Verifier.should_verify("What is 10-4?", "6") is False

    def test_fraction_triggers(self):
        assert Lean4Verifier.should_verify(
            "What is 2/3 + 1/4?", "We need a common denominator"
        ) is True

    def test_algebra_triggers(self):
        assert Lean4Verifier.should_verify(
            "Solve for x: 2x + 5 = 11", "Let's isolate x"
        ) is True

    def test_equation_keyword_triggers(self):
        assert Lean4Verifier.should_verify(
            "Solve this equation", "The equation is..."
        ) is True

    def test_word_problem_triggers(self):
        assert Lean4Verifier.should_verify(
            "How many apples does Sarah have if she started with 10 and gave away 3?",
            "Let's work through this step by step"
        ) is True

    def test_prove_keyword_triggers(self):
        assert Lean4Verifier.should_verify(
            "Prove that the sum of two even numbers is even", "..."
        ) is True

    def test_area_triggers(self):
        assert Lean4Verifier.should_verify(
            "What is the area of a rectangle with length 5 and width 3?",
            "Area = length * width"
        ) is True

    def test_multi_step_arithmetic_triggers(self):
        assert Lean4Verifier.should_verify(
            "What is 2 + 3 + 4?", "Let me add these up"
        ) is True


class TestTranslateToLean4:
    """Tests for LLM → Lean4 translation."""

    def test_returns_clean_code(self):
        mock_client = Mock()
        mock_client.models.generate_content.return_value = SimpleNamespace(
            text="theorem add_comm : 1 + 1 = 2 := by native_decide"
        )
        verifier = Lean4Verifier(client=mock_client)
        code = verifier.translate_to_lean4("What is 1+1?", "1+1 equals 2")
        assert "theorem" in code
        assert "native_decide" in code

    def test_strips_markdown_fences(self):
        mock_client = Mock()
        mock_client.models.generate_content.return_value = SimpleNamespace(
            text="```lean4\ntheorem t : True := trivial\n```"
        )
        verifier = Lean4Verifier(client=mock_client)
        code = verifier.translate_to_lean4("q", "a")
        assert "```" not in code
        assert "theorem" in code

    def test_no_claim_response(self):
        mock_client = Mock()
        mock_client.models.generate_content.return_value = SimpleNamespace(
            text="-- NO_CLAIM"
        )
        verifier = Lean4Verifier(client=mock_client)
        code = verifier.translate_to_lean4(
            "What do you think about fractions?",
            "Great question! What do you already know about fractions?"
        )
        assert "NO_CLAIM" in code


class TestRunLean4:
    """Tests for the Lean4 subprocess execution."""

    @patch("rag.lean4_verifier.subprocess.run")
    def test_successful_verification(self, mock_run):
        mock_run.return_value = Mock(returncode=0, stdout="", stderr="")
        verifier = Lean4Verifier(client=Mock())
        result = verifier.run_lean4("theorem t : 1 + 1 = 2 := by native_decide")
        assert result["success"] is True

    @patch("rag.lean4_verifier.subprocess.run")
    def test_failed_verification(self, mock_run):
        mock_run.return_value = Mock(
            returncode=1, stdout="", stderr="error: type mismatch"
        )
        verifier = Lean4Verifier(client=Mock())
        result = verifier.run_lean4("theorem t : 1 + 1 = 3 := by native_decide")
        assert result["success"] is False
        assert "error" in result["output"]

    @patch("rag.lean4_verifier.subprocess.run")
    def test_timeout_handling(self, mock_run):
        import subprocess
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="lean", timeout=30)
        verifier = Lean4Verifier(client=Mock())
        result = verifier.run_lean4("some code")
        assert result["success"] is False
        assert "timed out" in result["output"]

    @patch("rag.lean4_verifier.subprocess.run")
    def test_binary_not_found(self, mock_run):
        mock_run.side_effect = FileNotFoundError()
        verifier = Lean4Verifier(client=Mock())
        result = verifier.run_lean4("some code")
        assert result["success"] is False
        assert "not found" in result["output"]


class TestVerifyAndRefine:
    """Tests for the full verification loop."""

    def test_verified_on_first_try(self):
        mock_client = Mock()
        # translate call
        mock_client.models.generate_content.return_value = SimpleNamespace(
            text="theorem t : 1 + 1 = 2 := by native_decide"
        )
        verifier = Lean4Verifier(client=mock_client)

        with patch.object(verifier, "run_lean4", return_value={"success": True, "output": ""}):
            result = verifier.verify_and_refine(
                question="What is 1+1?",
                answer="1+1 equals 2",
                contents=[],
                system_prompt="You are a tutor",
            )

        assert result["verified"] is True
        assert result["reason"] == "lean4_verified"
        assert len(result["iterations"]) == 1

    def test_no_claim_skips_verification(self):
        mock_client = Mock()
        mock_client.models.generate_content.return_value = SimpleNamespace(
            text="-- NO_CLAIM"
        )
        verifier = Lean4Verifier(client=mock_client)

        result = verifier.verify_and_refine(
            question="Tell me about fractions",
            answer="What do you already know?",
            contents=[],
            system_prompt="You are a tutor",
        )

        assert result["verified"] is None
        assert result["reason"] == "no_verifiable_claim"

    def test_refines_on_failure(self):
        mock_client = Mock()
        # First call: translate → bad code
        # Second call: refinement → new answer
        # Third call: translate again → good code
        mock_client.models.generate_content.side_effect = [
            SimpleNamespace(text="theorem t : 1 + 1 = 3 := by native_decide"),
            SimpleNamespace(text="Actually, 1+1=2. Let me correct that."),
            SimpleNamespace(text="theorem t : 1 + 1 = 2 := by native_decide"),
        ]

        verifier = Lean4Verifier(client=mock_client)

        run_results = [
            {"success": False, "output": "error: 1+1=3 is false"},
            {"success": True, "output": ""},
        ]
        with patch.object(verifier, "run_lean4", side_effect=run_results):
            result = verifier.verify_and_refine(
                question="What is 1+1?",
                answer="1+1 equals 3",
                contents=[],
                system_prompt="You are a tutor",
            )

        assert result["verified"] is True
        assert result["final_answer"] == "Actually, 1+1=2. Let me correct that."
        assert len(result["iterations"]) == 2

    def test_max_iterations_reached(self):
        mock_client = Mock()
        # Always returns bad code and bad refinements
        mock_client.models.generate_content.return_value = SimpleNamespace(
            text="theorem t : 1 + 1 = 3 := by native_decide"
        )

        verifier = Lean4Verifier(client=mock_client)

        with patch.object(
            verifier, "run_lean4",
            return_value={"success": False, "output": "error: false"},
        ):
            result = verifier.verify_and_refine(
                question="What is 1+1?",
                answer="1+1 equals 3",
                contents=[],
                system_prompt="You are a tutor",
                max_iterations=2,
            )

        assert result["verified"] is False
        assert result["reason"] == "max_iterations_reached"
        assert len(result["iterations"]) == 2

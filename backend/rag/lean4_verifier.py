"""Lean4 formal verification loop for mathematical reasoning.

Translates LLM math responses into Lean4 logic, runs the Lean4 type-checker,
and feeds errors back to the LLM for refinement (up to max_iterations).
"""

import os
import re
import subprocess
import tempfile
from typing import Optional

from google import genai
from google.genai import types


# Keywords / patterns that suggest a question needs formal verification
_COMPLEXITY_PATTERNS = [
    r"\bsolve\b", r"\bprove\b", r"\bshow\s+that\b", r"\bwhy\b",
    r"\bequation\b", r"\balgebra\b", r"\bvariable\b",
    r"\bfraction\b", r"\bnumerator\b", r"\bdenominator\b",
    r"\bratio\b", r"\bproportion\b", r"\bpercent\b",
    r"\barea\b", r"\bperimeter\b", r"\bvolume\b",
    r"\bangle\b", r"\btriangle\b", r"\bcircle\b",
    r"\bexponent\b", r"\bpower\b", r"\bsquare\s+root\b",
    r"\bword\s+problem\b", r"\bhow\s+many\b", r"\bhow\s+much\b",
    r"\bstep[- ]by[- ]step\b",
    r"[+\-*/]=",  # equations with operators and equals
    r"\d+\s*[+\-*/]\s*\d+\s*[+\-*/]\s*\d+",  # multi-step arithmetic (3+ operands)
    r"[xXyY]\s*[+\-*/=]",  # algebraic variables
]

_COMPLEXITY_RE = re.compile("|".join(_COMPLEXITY_PATTERNS), re.IGNORECASE)

LEAN4_TRANSLATE_PROMPT = """\
You are an expert at translating K-8 math reasoning into Lean4 formal proofs.

Given a student's math question and the tutor's response, extract the core \
mathematical claim(s) and express them as Lean4 `theorem` or `example` statements \
with proofs.

Rules:
- Output ONLY valid Lean4 code, no markdown fences, no commentary.
- Do NOT use `import Mathlib` or any external libraries. Only use Lean4 built-in \
features (Nat, Int, basic arithmetic, logic).
- For simple numeric claims, use `native_decide` or `decide` as the proof tactic.
- For algebraic identities use `omega` or `norm_num`.
- Keep it minimal — verify the core claim, not every sentence.
- If the tutor's response doesn't make a verifiable mathematical claim yet \
(e.g. it only asks guiding questions), output exactly: -- NO_CLAIM
- If the claim requires geometry, advanced algebra, or concepts that need external \
libraries to formalize, output exactly: -- NO_CLAIM
- Do NOT use sorry.

STUDENT QUESTION:
{question}

TUTOR RESPONSE:
{answer}

Lean4 code:"""

LEAN4_REFINEMENT_PROMPT = """\
Your previous response to the student had a logical issue detected by the \
Lean4 formal verifier.

STUDENT QUESTION:
{question}

YOUR PREVIOUS ANSWER:
{previous_answer}

LEAN4 CODE THAT WAS CHECKED:
{lean4_code}

LEAN4 ERRORS:
{lean4_errors}

Please correct your mathematical reasoning and provide an improved response. \
Keep your tutor persona — be friendly, step-by-step, and age-appropriate."""

# Lean4 binary — prefer elan-managed install
_LEAN_BIN = os.environ.get("LEAN_BIN", os.path.expanduser("~/.elan/bin/lean"))


class Lean4Verifier:
    """Translates math answers to Lean4, verifies them, and refines if needed."""

    def __init__(
        self,
        client: genai.Client,
        model: str = "gemini-3.1-flash-lite-preview",
        lean_timeout: int = 30,
    ):
        self.client = client
        self.model = model
        self.lean_timeout = lean_timeout

    # ------------------------------------------------------------------
    # Complexity heuristic
    # ------------------------------------------------------------------

    @staticmethod
    def should_verify(question: str, answer: str) -> bool:
        """Return True if the question/answer pair is complex enough to verify."""
        text = f"{question} {answer}"
        return bool(_COMPLEXITY_RE.search(text))

    # ------------------------------------------------------------------
    # Translate answer → Lean4
    # ------------------------------------------------------------------

    def translate_to_lean4(self, question: str, answer: str) -> str:
        """Ask the LLM to express the math claim as Lean4 code."""
        prompt = LEAN4_TRANSLATE_PROMPT.format(question=question, answer=answer)

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.0,
                max_output_tokens=1024,
            ),
        )

        code = (response.text or "").strip()
        # Strip markdown fences if the model adds them anyway
        code = re.sub(r"^```lean4?\s*", "", code)
        code = re.sub(r"\s*```$", "", code)
        return code

    # ------------------------------------------------------------------
    # Run Lean4 type-checker
    # ------------------------------------------------------------------

    def run_lean4(self, lean4_code: str) -> dict:
        """Write code to a temp file, run `lean`, return result."""
        if "import Mathlib" in lean4_code:
            return {
                "success": False,
                "output": "Mathlib is not available. Only built-in Lean4 features are supported.",
            }

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".lean", delete=False, encoding="utf-8"
        ) as f:
            f.write(lean4_code)
            temp_path = f.name

        try:
            result = subprocess.run(
                [_LEAN_BIN, temp_path],
                capture_output=True,
                text=True,
                timeout=self.lean_timeout,
            )
            success = result.returncode == 0
            output = (result.stdout or "") + (result.stderr or "")
            return {"success": success, "output": output.strip()}
        except subprocess.TimeoutExpired:
            return {"success": False, "output": "Lean4 timed out"}
        except FileNotFoundError:
            return {
                "success": False,
                "output": f"Lean4 binary not found at {_LEAN_BIN}. "
                "Install via elan: https://github.com/leanprover/elan",
            }
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    # ------------------------------------------------------------------
    # Refinement loop
    # ------------------------------------------------------------------

    def verify_and_refine(
        self,
        question: str,
        answer: str,
        contents: list,
        system_prompt: str,
        max_iterations: int = 2,
    ) -> dict:
        """Translate → verify → refine loop. Returns final answer + metadata."""
        iterations = []

        for i in range(max_iterations):
            # Translate
            lean4_code = self.translate_to_lean4(question, answer)

            # If the model says there's no verifiable claim, skip
            if "NO_CLAIM" in lean4_code:
                return {
                    "final_answer": answer,
                    "verified": None,
                    "reason": "no_verifiable_claim",
                    "iterations": iterations,
                }

            # Verify
            result = self.run_lean4(lean4_code)
            iterations.append({
                "iteration": i + 1,
                "lean4_code": lean4_code,
                "lean4_success": result["success"],
                "lean4_output": result["output"],
            })

            if result["success"]:
                return {
                    "final_answer": answer,
                    "verified": True,
                    "reason": "lean4_verified",
                    "iterations": iterations,
                }

            # Refine — ask Gemini to fix its reasoning
            refinement_prompt = LEAN4_REFINEMENT_PROMPT.format(
                question=question,
                previous_answer=answer,
                lean4_code=lean4_code,
                lean4_errors=result["output"],
            )

            # Build contents with the refinement feedback
            refined_contents = list(contents) + [
                types.Content(
                    role="user",
                    parts=[types.Part(text=refinement_prompt)],
                ),
            ]

            response = self.client.models.generate_content(
                model=self.model,
                contents=refined_contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                ),
            )
            answer = response.text

        # Exhausted iterations — return last answer unverified
        return {
            "final_answer": answer,
            "verified": False,
            "reason": "max_iterations_reached",
            "iterations": iterations,
        }

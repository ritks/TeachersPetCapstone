#!/usr/bin/env python3
"""
Response validator using two GitHub-hosted models to ensure Gemini responses
are mathematically correct and safe for middle school students.
"""

import os
from typing import Optional
import requests


class ResponseValidator:
    """Validates LLM responses using GitHub-hosted models."""
    
    ENDPOINT = "https://models.inference.ai.azure.com/chat/completions"
    DEFAULT_VALIDATORS = [
        "meta-llama-3.1-8b-instruct",
        "gpt-4.1-mini"
    ]
    
    def __init__(self, github_token: Optional[str] = None):
        """Initialize validator with GitHub token."""
        self.token = github_token or os.getenv("GITHUB_TOKEN")
        if not self.token:
            raise ValueError("GITHUB_TOKEN environment variable not set")
    
    def validate(
        self,
        question: str,
        response: str,
        validators: list = None,
        timeout: int = 60
    ) -> dict:
        """
        Validate a response using two GitHub models.
        
        Args:
            question: The original student question
            response: The Gemini response to validate
            validators: List of model IDs to use (default: gpt-4o-mini, llama-70b)
            timeout: Request timeout in seconds
        
        Returns:
            {
                "is_safe": bool,  # True if BOTH validators say safe
                "safety_votes": {"model_id": "safe"|"unsafe"},
                "is_correct": bool,  # True if validators agree response is correct
                "explanation": str,  # Combined feedback from validators
                "errors": list  # Any validation errors that occurred
            }
        """
        if validators is None:
            validators = self.DEFAULT_VALIDATORS
        
        safety_votes = {}
        explanations = []
        errors = []
        
        for model in validators:
            try:
                assessment = self._query_validator(
                    model,
                    question,
                    response,
                    timeout
                )
                safety_votes[model] = assessment
                
            except Exception as e:
                errors.append(f"{model}: {str(e)}")
                safety_votes[model] = "error"
        
        # Consider valid only if both models agree it's safe
        safe_votes = sum(1 for v in safety_votes.values() if v == "safe")
        is_safe = safe_votes > len(safety_votes) / 2
        
        # Build explanation from votes
        explanation = f"Validators: {', '.join([f'{k}={v}' for k, v in safety_votes.items()])}"
        if errors:
            explanation += f". Errors: {'; '.join(errors)}"
        
        return {
            "is_safe": is_safe,
            "safety_votes": safety_votes,
            "explanation": explanation,
            "errors": errors
        }
    
    def _query_validator(
        self,
        model: str,
        question: str,
        response: str,
        timeout: int
    ) -> str:
        """
        Query a validator model.
        
        Returns:
            "safe" or "unsafe" string
        """
        validation_prompt = f"""You are a safety and accuracy validator for a middle school math tutor.

STUDENT QUESTION:
{question}

TUTOR RESPONSE:
{response}

Your task: Assess if this response is appropriate and safe for a middle school student (ages 11-14).

Consider:
1. Is the math explanation correct or potentially misleading?
2. Is the language age-appropriate and clear?
3. Are there any unsafe, inappropriate, or harmful elements?
4. Does it encourage learning and critical thinking?

RESPOND WITH ONLY:
"safe" - if the response is appropriate and correct
"unsafe" - if there are concerns (incorrect math, inappropriate content, confusing, etc.)"""

        response = requests.post(
            self.ENDPOINT,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.token}",
                "User-Agent": "TeachersPet/1.0"
            },
            json={
                "model": model,
                "messages": [
                    {"role": "user", "content": validation_prompt}
                ],
                "temperature": 0.3,  # Low temperature for consistent answers
                "max_tokens": 10  # Only need "safe" or "unsafe"
            },
            timeout=timeout
        )
        
        if response.status_code != 200:
            raise Exception(
                f"API error {response.status_code}: {response.text}"
            )
        
        result = response.json()["choices"][0]["message"]["content"].strip().lower()
        
        # Extract "safe" or "unsafe" from response
        if "unsafe" in result:
            return "unsafe"
        elif "safe" in result:
            return "safe"
        else:
            raise Exception(f"Unexpected response: {result}")

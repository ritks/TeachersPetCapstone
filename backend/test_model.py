#!/usr/bin/env python3
"""
Model evaluation script for Teacher's Pet math tutor AI.

Reads test cases from the evaluation xlsx, queries the Gemini API using the
same system prompt as production, and writes responses into the "Actual Output"
column of each sheet. Saves results as a new xlsx for manual scoring.

Usage:
    python test_model.py --input ../math_tutor_ai_eval_testcases.xlsx --model gemini-2.5-flash-lite
    python test_model.py --input ../math_tutor_ai_eval_testcases.xlsx --model gemini-2.0-flash
    python test_model.py --input ../math_tutor_ai_eval_testcases.xlsx --model gemini-2.5-flash-lite --delay 2.0
"""

import argparse
import os
import re
import time
from datetime import date

from dotenv import load_dotenv
from google import genai
import openpyxl

load_dotenv()

# Must match production system prompt exactly for fair evaluation
SYSTEM_PROMPT = """You are Teacher's Pet, a friendly and encouraging math tutor for middle school students (grades 6-8).

TEACHING STYLE:
- Always work through problems step-by-step, numbering each step clearly
- Use simple, age-appropriate language — define any math terms you use
- Guide students toward answers with hints and questions rather than just stating the answer
- When a student makes a mistake, gently explain what went wrong and why
- Be warm, patient, and encouraging — acknowledge effort and celebrate progress
- Offer a second explanation method or real-world example when it helps understanding
- End every response by clearly stating the final answer

SAFETY & BOUNDARIES:
- Only help with math topics from the middle school curriculum (Common Core grades 6-8)
- Never ask for or encourage sharing of personal information (name, age, school, location, etc.)
- If a student expresses distress, respond with empathy and encourage them to talk to a trusted adult
- Politely decline off-topic, inappropriate, or unethical requests (e.g. cheating)"""

# Non-test sheets to skip
SKIP_SHEETS = {"Instructions & Rubric", "Summary Dashboard"}

PROMPT_HEADER = "Test Input / Prompt"
OUTPUT_HEADER = "Actual Output"


def find_col(headers, name):
    """Return 1-based column index for a header name, or None if not found."""
    for i, h in enumerate(headers, 1):
        if h and str(h).strip() == name:
            return i
    return None


def query_model(client, model, question, retries=3):
    """Send a question to the model, auto-retrying on rate limit or overload errors."""
    for attempt in range(retries):
        try:
            response = client.models.generate_content(
                model=model,
                contents=f"{SYSTEM_PROMPT}\n\nStudent: {question}"
            )
            return response.text
        except Exception as e:
            msg = str(e)
            # Parse suggested retry delay from the error message if present
            match = re.search(r'retry[^\d]*(\d+(?:\.\d+)?)\s*s', msg, re.IGNORECASE)
            wait = float(match.group(1)) + 1 if match else 5
            if attempt < retries - 1 and ("429" in msg or "503" in msg):
                print(f"    -> rate limited, waiting {wait:.0f}s then retrying...")
                time.sleep(wait)
            else:
                raise


def count_questions(wb):
    """Count total non-empty prompts across all test sheets."""
    count = 0
    for sheet_name in wb.sheetnames:
        if sheet_name in SKIP_SHEETS:
            continue
        ws = wb[sheet_name]
        headers = [cell.value for cell in ws[1]]
        prompt_col = find_col(headers, PROMPT_HEADER)
        if prompt_col is None:
            continue
        for row_idx in range(2, ws.max_row + 1):
            val = ws.cell(row=row_idx, column=prompt_col).value
            if val and str(val).strip():
                count += 1
    return count


def run_evaluation(input_path, model, delay, output_path):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set in environment or .env file")

    client = genai.Client(api_key=api_key)

    wb = openpyxl.load_workbook(input_path)

    grand_total = count_questions(wb)
    print(f"Total API calls to make: {grand_total}\n")

    call_num = 0
    total = 0
    errors = 0

    for sheet_name in wb.sheetnames:
        if sheet_name in SKIP_SHEETS:
            print(f"[skip] {sheet_name}")
            continue

        ws = wb[sheet_name]
        headers = [cell.value for cell in ws[1]]

        prompt_col = find_col(headers, PROMPT_HEADER)
        output_col = find_col(headers, OUTPUT_HEADER)

        if prompt_col is None:
            print(f"[warn] '{sheet_name}': column '{PROMPT_HEADER}' not found, skipping sheet")
            continue
        if output_col is None:
            print(f"[warn] '{sheet_name}': column '{OUTPUT_HEADER}' not found, skipping sheet")
            continue

        print(f"\n--- {sheet_name} ---")

        for row_idx in range(2, ws.max_row + 1):
            question = ws.cell(row=row_idx, column=prompt_col).value
            if not question or str(question).strip() == "":
                continue

            call_num += 1
            question = str(question).strip()
            row_id = ws.cell(row=row_idx, column=1).value or f"row {row_idx}"
            preview = question[:72] + ("..." if len(question) > 72 else "")
            print(f"  [{call_num}/{grand_total}] {row_id}: {preview}")

            try:
                response = query_model(client, model, question)
                ws.cell(row=row_idx, column=output_col).value = response
                print(f"    -> {len(response)} chars")
                total += 1
            except Exception as e:
                ws.cell(row=row_idx, column=output_col).value = f"[ERROR] {e}"
                print(f"    -> ERROR: {e}")
                errors += 1
                total += 1

            if delay > 0:
                time.sleep(delay)

    wb.save(output_path)
    print(f"\n{'='*50}")
    print(f"Done. {total - errors}/{total} successful")
    print(f"Results saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate a Gemini model against the Teacher's Pet test suite."
    )
    parser.add_argument(
        "--input", required=True,
        help="Path to the evaluation xlsx file"
    )
    parser.add_argument(
        "--model", default="gemini-2.5-flash-lite",
        help="Gemini model ID to test (default: gemini-2.5-flash-lite)"
    )
    parser.add_argument(
        "--delay", type=float, default=0.0,
        help="Seconds to wait between API calls (default: 0, auto-retries on rate limit)"
    )
    parser.add_argument(
        "--output", default=None,
        help="Output xlsx path (default: results_<model>_<date>.xlsx)"
    )
    args = parser.parse_args()

    if args.output is None:
        today = date.today().isoformat()
        safe_model = args.model.replace("/", "-").replace(":", "-")
        args.output = f"results_{safe_model}_{today}.xlsx"

    print(f"Input:  {args.input}")
    print(f"Model:  {args.model}")
    print(f"Delay:  {args.delay}s between requests")
    print(f"Output: {args.output}")
    print()

    run_evaluation(args.input, args.model, args.delay, args.output)


if __name__ == "__main__":
    main()

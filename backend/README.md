## TeachersPetCapstone Backend

This backend provides a simple API endpoint for answering math questions using LLM models. It is built with FastAPI and supports multiple model providers:

- **Google Gemini** (via `google-genai` SDK)
- **GitHub Models** (free access to GPT-4o, Llama, Mistral, and more)

### Prerequisites

- Python 3.9+
- **For Gemini:** A Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey))
- **For GitHub Models:** A GitHub Personal Access Token with the `models` scope

### Setup

1. **Create a virtual environment (recommended):**
	```sh
	python -m venv venv
	source venv/bin/activate  # On Windows: venv\Scripts\activate
	```

2. **Install dependencies:**
	```sh
	pip install -r requirements.txt
	```

3. **Set up your environment variables:**
    Create a `.env` file in the `backend/` directory with the format specified in backend/.env.example:

#### Getting API Keys

**Google Gemini API Key:**
- Go to https://aistudio.google.com/app/apikey
- Click "Create API key"
- Copy and paste into `.env`

**GitHub Personal Access Token:**
- Go to https://github.com/settings/tokens
- Click "Generate new token (classic)"
- Select the `read:packages` scope (minimum required)
- Copy and paste into `.env`

### Running the Backend

```sh
python backend/main.py
```

#### API Endpoint

- **POST** `/ask`
  - **Body:** `{ "question": "<your question here>" }`
  - **Response:** `{ "answer": "<model's answer>" }`

### Testing with the Client

There is a simple Python client for testing the backend interactively.

Run the client:

```sh
python client.py
```

You will be prompted to enter a question. The client will send it to the backend and print the answer.

### Model Evaluation Testing

To evaluate models against the Teacher's Pet test suite, see [Model Testing/MODEL_TESTING_README.md](../Model%20Testing/MODEL_TESTING_README.md) for comprehensive instructions.

The evaluation script supports:
- **Gemini models** (free and paid tiers)
- **GitHub Models** (free with Copilot Pro)
- Multiple rate-limiting strategies
- Detailed scoring rubrics for accuracy and safety

Quick reference:
```sh
# Gemini
python backend/test_model.py --input math_tutor_ai_eval_testcases.xlsx --model gemini-2.5-flash-lite --provider gemini

# GitHub Models (GPT-4o, Llama, Mistral, etc.)
python backend/test_model.py --input math_tutor_ai_eval_testcases.xlsx --model gpt-4o --provider github --delay 5
```

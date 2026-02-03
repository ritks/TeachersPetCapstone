## TeachersPetCapstone Backend

This backend provides a simple API endpoint for answering math questions using Google's Gemini LLM models. It is built with FastAPI and integrates with the Gemini API via the `google-genai` SDK.

### Prerequisites

- Python 3.9+
- A Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey))

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
    Use .env.example as a template

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

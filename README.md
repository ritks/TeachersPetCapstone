# Teacher's Pet

An AI-powered teaching assistant designed to help students learn core subjects like math in a safe, structured, and engaging way. The system uses Google's Gemini LLM to provide clear, step-by-step explanations through a chat interface.

## Prerequisites

- Python 3.9+
- Node.js 18+ and npm
- A Google Gemini API key (free at https://aistudio.google.com/app/apikeys)

## Project Structure

```
TeachersPetCapstone/
├── backend/          # FastAPI server with Gemini integration
│   ├── main.py       # API server (single /ask endpoint)
│   ├── client.py     # CLI test client
│   └── .env.example  # environment variable template
├── frontend/         # React + Vite chat interface
│   └── src/
│       └── App.jsx   # chat UI, connects to the backend
├── requirements.txt  # Python dependencies
└── README.md         # this file
```

## Backend Setup

1. Create and activate a virtual environment from the project root:

```sh
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
```

2. Install Python dependencies:

```sh
pip install -r requirements.txt
```

3. Set up your environment variables. Copy the example file and add your Gemini API key:

```sh
cp backend/.env.example backend/.env
```

Open `backend/.env` and replace `api_key_here` with your actual key.

4. Start the backend server:

```sh
python backend/main.py
```

The server starts on http://localhost:8000.

## Frontend Setup

1. Install Node dependencies:

```sh
cd frontend
npm install
```

2. Start the development server:

```sh
npm run dev
```

The app is available at http://localhost:5173.

## Running the Full App

The frontend expects the backend to be running on port 8000. Open two terminals from the project root:

**Terminal 1 -- backend:**

```sh
source .venv/bin/activate
python backend/main.py
```

**Terminal 2 -- frontend:**

```sh
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser. Type a math question into the input and hit Send. The backend will respond with a step-by-step explanation via Gemini.

## How It Works

1. The frontend POSTs the student's question to `http://localhost:8000/ask`.
2. The backend prepends a math-tutor system prompt and forwards the request to Google's Gemini 2.5 Flash Lite model.
3. The model's response is returned to the frontend and rendered as a chat message.

Each message is independent -- the backend is stateless, so there is no conversation memory between requests.

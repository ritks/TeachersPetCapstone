from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Teachers Pet - Math Tutor")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini API
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not set")

client = genai.Client(api_key=api_key)

SYSTEM_PROMPT = "You are a helpful math tutor. Explain clearly and step-by-step."


@app.post("/ask")
async def ask(data: dict):
    """Send a question, get an answer"""
    try:
        question = data.get("question", "")
        if not question:
            return {"answer": "Please provide a question"}
        
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=f"{SYSTEM_PROMPT}\n\nStudent: {question}"
        )
        return {"answer": response.text}
    except Exception as e:
        return {"answer": f"Error: {str(e)}", "error": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

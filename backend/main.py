from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
import os
from dotenv import load_dotenv
from google.genai import types
from pydantic import BaseModel
from typing import Optional
import uuid

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

# Safety settings
SAFETY_SETTINGS = [
    types.SafetySetting(
        category="HARM_CATEGORY_HARASSMENT",
        threshold="BLOCK_LOW_AND_ABOVE",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_HATE_SPEECH",
        threshold="BLOCK_LOW_AND_ABOVE",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold="BLOCK_LOW_AND_ABOVE",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold="BLOCK_LOW_AND_ABOVE",
    ),
]

# Store conversation sessions
conversations: dict = {}


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ConversationRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class ConversationResponse(BaseModel):
    answer: str
    session_id: str
    error: Optional[bool] = False


@app.post("/chat", response_model=ConversationResponse)
async def chat(data: ConversationRequest):
    """Send a message in a continuous conversation"""
    try:
        question = data.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="Please provide a question")
        
        # Create new session or use existing one
        session_id = data.session_id or str(uuid.uuid4())
        if session_id not in conversations:
            conversations[session_id] = []
        
        # Build message history for the API
        history = conversations[session_id]
        
        # Create contents list with system prompt and conversation history
        contents = []
        
        # Add conversation history
        for msg in history:
            if msg["role"] == "user":
                contents.append(types.Content(role="user", parts=[types.Part(text=msg["content"])]))
            else:
                contents.append(types.Content(role="model", parts=[types.Part(text=msg["content"])]))
        
        # Add current question
        contents.append(types.Content(role="user", parts=[types.Part(text=question)]))
        
        # Get response from Gemini
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                safety_settings=SAFETY_SETTINGS,
            ),
        )
        
        answer = response.text
        
        # Store conversation in session
        conversations[session_id].append({"role": "user", "content": question})
        conversations[session_id].append({"role": "assistant", "content": answer})
        
        return ConversationResponse(
            answer=answer,
            session_id=session_id
        )
    except HTTPException:
        raise
    except Exception as e:
        return ConversationResponse(
            answer=f"Error: {str(e)}",
            session_id=data.session_id or "error",
            error=True
        )


@app.post("/ask")
async def ask(data: dict):
    """Send a question, get an answer"""
    try:
        question = data.get("question", "")
        if not question:
            return {"answer": "Please provide a question"}
        
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=f"{SYSTEM_PROMPT}\n\nStudent: {question}",
            config=types.GenerateContentConfig(
                safety_settings=SAFETY_SETTINGS,
            ),
        )
        return {"answer": response.text}
    except Exception as e:
        return {"answer": f"Error: {str(e)}", "error": True}


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get conversation history for a session"""
    if session_id not in conversations:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session_id, "history": conversations[session_id]}


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a conversation session"""
    if session_id in conversations:
        del conversations[session_id]
        return {"message": "Session deleted"}
    raise HTTPException(status_code=404, detail="Session not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from google import genai
import os
import json
import time
from dotenv import load_dotenv
from google.genai import types
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from database.db import get_db, init_db
from database.models import Module, Document
from rag.embeddings import EmbeddingService
from rag.vector_store import VectorStore
from rag.retriever import Retriever
from rag.document_processor import DocumentProcessor
from rag.validator import ResponseValidator

load_dotenv()

app = FastAPI(title="Teachers Pet - Math Tutor")

try:
    import redis as redis_lib
except Exception:
    redis_lib = None

# ── CORS ──────────────────────────────────────────────────────────────
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
allowed_origins = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Gemini client ─────────────────────────────────────────────────────
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not set")

client = genai.Client(api_key=api_key)

# ── RAG components ────────────────────────────────────────────────────
embedding_service = EmbeddingService(client=client)
vector_store = VectorStore()
retriever = Retriever(embedding_service, vector_store)
document_processor = DocumentProcessor(embedding_service, vector_store)

# ── Response validator (required) ──────────────────────────────────────────────
try:
    validator = ResponseValidator(client=client)
    print("[INFO] Response validation ENABLED")
except ValueError as e:
    print(f"[ERROR] Response validation failed to initialize: {e}")
    raise

# ── Constants ─────────────────────────────────────────────────────────
BASE_SYSTEM_PROMPT = (
    "You are Teacher's Pet, a friendly and encouraging math tutor for "
    "K-8 students (kindergarten through 8th grade).\n"
    "- Always work through problems step-by-step.\n"
    "- Use simple, age-appropriate language.\n"
    "- Adapt the level of formality and difficulty to the student's grade when possible.\n"
    "- Guide students with hints and questions rather than jumping straight to the final answer.\n"
    "- VERY IMPORTANT: For a new math question, your first reply should **not** contain the final numeric answer\n"
    "  • In your first reply: restate the problem, ask at least one guiding question, and suggest a first step the student can try.\n"
    "  • On follow-up replies, try to still guide the student towards the answer without giving it away.\n"
    "- Handle mistakes gently.\n"
    "- Be warm, patient, and encouraging."
)

SAFETY_SETTINGS = [
    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_LOW_AND_ABOVE"),
    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_LOW_AND_ABOVE"),
    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_LOW_AND_ABOVE"),
    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_LOW_AND_ABOVE"),
]

# ── Session store (Redis + TTL, with memory fallback) ───────────────
CHAT_SESSION_TTL_SECONDS = int(os.getenv("CHAT_SESSION_TTL_SECONDS", "86400"))
REDIS_URL = os.getenv("REDIS_URL")


class MemorySessionStore:
    def __init__(self, ttl_seconds: int):
        self.ttl_seconds = ttl_seconds
        self._sessions: dict[str, dict] = {}

    def _purge_expired(self):
        now = time.time()
        expired = [
            sid for sid, row in self._sessions.items()
            if row.get("expires_at", 0) <= now
        ]
        for sid in expired:
            del self._sessions[sid]

    def get_history(self, session_id: str) -> Optional[list[dict]]:
        self._purge_expired()
        row = self._sessions.get(session_id)
        if not row:
            return None
        return row.get("history", [])

    def append_messages(self, session_id: str, messages: list[dict]) -> list[dict]:
        self._purge_expired()
        row = self._sessions.get(session_id) or {"history": []}
        history = row.get("history", [])
        history.extend(messages)
        self._sessions[session_id] = {
            "history": history,
            "expires_at": time.time() + self.ttl_seconds,
        }
        return history

    def delete(self, session_id: str) -> bool:
        self._purge_expired()
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False


class RedisSessionStore:
    KEY_PREFIX = "tp:chat:"

    def __init__(self, redis_url: str, ttl_seconds: int):
        self.ttl_seconds = ttl_seconds
        self.client = redis_lib.Redis.from_url(redis_url, decode_responses=True)
        # validate connection at startup
        self.client.ping()

    def _key(self, session_id: str) -> str:
        return f"{self.KEY_PREFIX}{session_id}"

    def get_history(self, session_id: str) -> Optional[list[dict]]:
        raw = self.client.get(self._key(session_id))
        if not raw:
            return None
        history = json.loads(raw)
        # sliding expiration
        self.client.expire(self._key(session_id), self.ttl_seconds)
        return history

    def append_messages(self, session_id: str, messages: list[dict]) -> list[dict]:
        key = self._key(session_id)
        raw = self.client.get(key)
        history = json.loads(raw) if raw else []
        history.extend(messages)
        self.client.setex(key, self.ttl_seconds, json.dumps(history))
        return history

    def delete(self, session_id: str) -> bool:
        return self.client.delete(self._key(session_id)) > 0


def _build_session_store():
    if REDIS_URL and redis_lib:
        try:
            print(f"[INFO] Using Redis chat sessions with TTL={CHAT_SESSION_TTL_SECONDS}s")
            return RedisSessionStore(REDIS_URL, CHAT_SESSION_TTL_SECONDS)
        except Exception as e:
            print(f"[WARN] Redis unavailable, falling back to memory sessions: {e}")
    elif REDIS_URL and not redis_lib:
        print("[WARN] REDIS_URL set but redis package is missing. Falling back to memory sessions.")

    print(f"[INFO] Using in-memory chat sessions with TTL={CHAT_SESSION_TTL_SECONDS}s")
    return MemorySessionStore(CHAT_SESSION_TTL_SECONDS)


session_store = _build_session_store()


# ── Pydantic schemas ─────────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str


class ConversationRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    module_id: Optional[str] = None  # scope chat to a module via RAG


class CitationItem(BaseModel):
    ref: int
    document_id: str = ""
    chapter: str = ""
    section: str = ""
    page_start: int = 0
    page_end: int = 0
    snippet: str = ""
    original_filename: str = ""


class ConversationResponse(BaseModel):
    answer: str
    session_id: str
    error: Optional[bool] = False
    validation: Optional[dict] = None  # Validation metadata from GitHub models
    flag_category: Optional[str] = None  # unsafe_content | validation_failure | system_error | none
    flag_severity: Optional[str] = None  # low | medium | high
    citations: list[CitationItem] = []


class ModuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    grade_level: int = 8
    topics: list[str] = []
    teacher_uid: Optional[str] = None


class ModuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    grade_level: Optional[int] = None
    topics: Optional[list[str]] = None


class ModuleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    grade_level: int
    topics: list
    document_count: int
    chunk_count: int
    teacher_uid: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: str
    module_id: str
    original_filename: str
    status: str
    chunk_count: int
    error_message: Optional[str]

    class Config:
        from_attributes = True


class TextUpload(BaseModel):
    text: str
    filename: Optional[str] = "pasted_text.txt"


class AnalyticsSummaryItem(BaseModel):
    module_name: Optional[str] = None
    course_code: Optional[str] = None
    prompt: str
    response: str
    flag_category: Optional[str] = None
    flag_severity: Optional[str] = None
    timestamp: Optional[str] = None


class AnalyticsSummaryRequest(BaseModel):
    teacher_uid: str
    module_filter: Optional[str] = "all"
    category_filter: Optional[str] = "all"
    range_filter: Optional[str] = "all"
    rows: list[AnalyticsSummaryItem] = []


class AnalyticsSummaryResponse(BaseModel):
    summary: str
    generated_at: str
    total_rows: int
    sampled_rows: int


# ── Startup ───────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    init_db()


# =====================================================================
#  CHAT ENDPOINTS
# =====================================================================

@app.post("/chat", response_model=ConversationResponse)
async def chat(data: ConversationRequest, db: Session = Depends(get_db)):
    """Send a message in a continuous conversation.

    When ``module_id`` is supplied the response is scoped to that module
    and augmented with relevant textbook chunks retrieved via RAG.
    """
    try:
        question = data.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="Please provide a question")

        session_id = data.session_id or str(uuid.uuid4())
        history = session_store.get_history(session_id) or []

        # ---- build system prompt (base + optional RAG context) --------
        system_prompt = BASE_SYSTEM_PROMPT
        citations_raw: list[dict] = []

        if data.module_id:
            module = db.query(Module).filter(Module.id == data.module_id).first()
            if not module:
                raise HTTPException(status_code=404, detail="Module not found")

            rag_context, citations_raw = retriever.build_context(
                query=question,
                module_id=module.id,
                module_name=module.name,
                module_description=module.description,
            )
            if rag_context:
                system_prompt = f"{system_prompt}\n\n{rag_context}"

        # Enrich citations with original filenames
        citation_items: list[CitationItem] = []
        if citations_raw:
            doc_ids = list({c["document_id"] for c in citations_raw if c.get("document_id")})
            doc_name_map: dict[str, str] = {}
            if doc_ids:
                docs = db.query(Document).filter(Document.id.in_(doc_ids)).all()
                doc_name_map = {d.id: d.original_filename for d in docs}
            for c in citations_raw:
                citation_items.append(CitationItem(
                    ref=c["ref"],
                    document_id=c.get("document_id", ""),
                    chapter=c.get("chapter", ""),
                    section=c.get("section", ""),
                    page_start=c.get("page_start", 0),
                    page_end=c.get("page_end", 0),
                    snippet=c.get("snippet", ""),
                    original_filename=doc_name_map.get(c.get("document_id", ""), ""),
                ))

        # ---- conversation history for Gemini --------------------------
        contents = []
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(
                types.Content(role=role, parts=[types.Part(text=msg["content"])])
            )
        contents.append(
            types.Content(role="user", parts=[types.Part(text=question)])
        )

        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                safety_settings=SAFETY_SETTINGS,
            ),
        )

        answer = response.text

        # ---- Validation with GitHub models (required) ----
        validation_result = None
        try:
            validation_result = validator.validate(question, answer)
            # If unsafe, reject the response
            if not validation_result["is_safe"]:
                print(f"[WARN] Response flagged as unsafe. Votes: {validation_result['safety_votes']}")
                return ConversationResponse(
                    answer="I'm not able to provide that response. Please rephrase your question.",
                    session_id=session_id,
                    validation=validation_result,
                    error=False,
                    flag_category="unsafe_content",
                    flag_severity="high",
                    citations=citation_items,
                )
        except Exception as e:
            # Log validation error but don't block response
            print(f"[ERROR] Validation failed: {e}")
            validation_result = {"error": str(e)}

        session_store.append_messages(
            session_id,
            [
                {"role": "user", "content": question},
                {"role": "assistant", "content": answer},
            ],
        )

        flag_category = None
        flag_severity = None
        if isinstance(validation_result, dict) and validation_result.get("error"):
            flag_category = "validation_failure"
            flag_severity = "medium"

        return ConversationResponse(
            answer=answer,
            session_id=session_id,
            validation=validation_result,
            flag_category=flag_category,
            flag_severity=flag_severity,
            citations=citation_items,
        )

    except HTTPException:
        raise
    except Exception as e:
        return ConversationResponse(
            answer=f"Error: {str(e)}",
            session_id=data.session_id or "error",
            error=True,
            flag_category="system_error",
            flag_severity="high",
        )


@app.post("/ask")
async def ask(data: dict):
    """Stateless single-question endpoint (backward compatible)."""
    try:
        question = data.get("question", "")
        if not question:
            return {"answer": "Please provide a question"}

        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=f"{BASE_SYSTEM_PROMPT}\n\nStudent: {question}",
            config=types.GenerateContentConfig(safety_settings=SAFETY_SETTINGS),
        )
        return {"answer": response.text}
    except Exception as e:
        return {"answer": f"Error: {str(e)}", "error": True}


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    history = session_store.get_history(session_id)
    if not history:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session_id, "history": history}


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    if session_store.delete(session_id):
        return {"message": "Session deleted"}
    raise HTTPException(status_code=404, detail="Session not found")


# =====================================================================
#  ANALYTICS ENDPOINTS
# =====================================================================

def _build_summary_prompt(
    module_filter: str,
    category_filter: str,
    range_filter: str,
    rows: list[AnalyticsSummaryItem],
) -> str:
    lines = []
    for idx, row in enumerate(rows, 1):
        prompt = (row.prompt or "").strip().replace("\n", " ")[:280]
        response = (row.response or "").strip().replace("\n", " ")[:320]
        module = row.module_name or "Unknown Module"
        category = row.flag_category or "none"
        severity = row.flag_severity or "low"
        lines.append(
            f"{idx}. module={module} | category={category} | severity={severity}\n"
            f"   student_prompt={prompt}\n"
            f"   tutor_response={response}"
        )

    rows_blob = "\n".join(lines) if lines else "No rows provided."

    return (
        "You are helping a teacher quickly understand classroom chat trends.\n"
        "Summarize the provided student-tutor chat logs into practical, actionable insights.\n\n"
        f"Filters applied: module={module_filter}, category={category_filter}, range={range_filter}\n\n"
        "Output requirements:\n"
        "- Keep it concise and teacher-friendly.\n"
        "- Use exactly these markdown section headers:\n"
        "  1) ## Key Trends\n"
        "  2) ## Common Struggles\n"
        "  3) ## Safety/Policy Signals\n"
        "  4) ## Suggested Teacher Actions\n"
        "- In Suggested Teacher Actions, provide 3 bullet points max.\n"
        "- Do not include personally identifying student information.\n"
        "- If evidence is weak, say so explicitly.\n\n"
        "Chat rows:\n"
        f"{rows_blob}"
    )


@app.post("/analytics/summary", response_model=AnalyticsSummaryResponse)
async def analytics_summary(body: AnalyticsSummaryRequest):
    total_rows = len(body.rows)
    sampled = body.rows[:180]

    if not sampled:
        return AnalyticsSummaryResponse(
            summary=(
                "## Key Trends\nNo recent chat records matched the selected filters.\n\n"
                "## Common Struggles\nNot enough data yet.\n\n"
                "## Safety/Policy Signals\nNo signals available.\n\n"
                "## Suggested Teacher Actions\n- Keep collecting student chat data."
            ),
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_rows=0,
            sampled_rows=0,
        )

    prompt = _build_summary_prompt(
        module_filter=body.module_filter or "all",
        category_filter=body.category_filter or "all",
        range_filter=body.range_filter or "all",
        rows=sampled,
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=700,
            ),
        )
        summary_text = (response.text or "").strip() or "Unable to generate summary."
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {e}")

    return AnalyticsSummaryResponse(
        summary=summary_text,
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_rows=total_rows,
        sampled_rows=len(sampled),
    )


# =====================================================================
#  MODULE ENDPOINTS (teacher-managed)
# =====================================================================

@app.post("/modules", response_model=ModuleResponse)
async def create_module(body: ModuleCreate, db: Session = Depends(get_db)):
    module = Module(
        name=body.name,
        description=body.description,
        grade_level=body.grade_level,
        topics=body.topics,
        teacher_uid=body.teacher_uid,
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return _module_to_response(module)


@app.get("/modules", response_model=list[ModuleResponse])
async def list_modules(teacher_uid: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Module)
    if teacher_uid:
        query = query.filter(Module.teacher_uid == teacher_uid)
    modules = query.order_by(Module.created_at).all()
    return [_module_to_response(m) for m in modules]


@app.get("/modules/{module_id}", response_model=ModuleResponse)
async def get_module(module_id: str, db: Session = Depends(get_db)):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return _module_to_response(module)


@app.put("/modules/{module_id}", response_model=ModuleResponse)
async def update_module(module_id: str, body: ModuleUpdate, db: Session = Depends(get_db)):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(module, field, value)
    db.commit()
    db.refresh(module)
    return _module_to_response(module)


@app.delete("/modules/{module_id}")
async def delete_module(module_id: str, db: Session = Depends(get_db)):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    vector_store.delete_by_module(module_id)
    db.delete(module)
    db.commit()
    return {"message": f"Module '{module.name}' deleted"}


# =====================================================================
#  DOCUMENT ENDPOINTS
# =====================================================================

@app.post("/modules/{module_id}/documents", response_model=DocumentResponse)
async def upload_document(
    module_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a PDF or text file to a module."""
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    content = await file.read()
    _file_path, saved_name = DocumentProcessor.save_upload(content, file.filename)

    doc = Document(
        module_id=module_id,
        filename=saved_name,
        original_filename=file.filename,
        status="uploaded",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_to_response(doc)


@app.post("/modules/{module_id}/documents/text", response_model=DocumentResponse)
async def upload_text(
    module_id: str,
    body: TextUpload,
    db: Session = Depends(get_db),
):
    """Upload raw text content directly (paste textbook sections)."""
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    _file_path, saved_name = DocumentProcessor.save_upload(
        body.text.encode("utf-8"), body.filename
    )

    doc = Document(
        module_id=module_id,
        filename=saved_name,
        original_filename=body.filename,
        status="uploaded",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_to_response(doc)


@app.get("/modules/{module_id}/documents", response_model=list[DocumentResponse])
async def list_documents(module_id: str, db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.module_id == module_id).all()
    return [_doc_to_response(d) for d in docs]


@app.post(
    "/modules/{module_id}/documents/{document_id}/process",
    response_model=DocumentResponse,
)
async def process_document(
    module_id: str,
    document_id: str,
    db: Session = Depends(get_db),
):
    """Chunk, embed, and index a previously uploaded document."""
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.module_id == module_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.status = "processing"
    db.commit()

    try:
        from rag.document_processor import UPLOAD_DIR

        file_path = os.path.join(UPLOAD_DIR, doc.filename)

        if doc.original_filename.lower().endswith(".pdf"):
            chunk_count = document_processor.process_pdf(file_path, module_id, doc.id)
        else:
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
            chunk_count = document_processor.process_text(text, module_id, doc.id)

        doc.status = "processed"
        doc.chunk_count = chunk_count
        db.commit()
        db.refresh(doc)

    except Exception as e:
        doc.status = "error"
        doc.error_message = str(e)
        db.commit()
        db.refresh(doc)

    return _doc_to_response(doc)


@app.delete("/modules/{module_id}/documents/{document_id}")
async def delete_document(
    module_id: str,
    document_id: str,
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.module_id == module_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    document_processor.delete_document(doc.id)
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}


@app.get("/modules/{module_id}/documents/{document_id}/file")
async def serve_document_file(
    module_id: str,
    document_id: str,
    db_session: Session = Depends(get_db),
):
    """Serve the original uploaded file (PDF) for the frontend viewer."""
    doc = (
        db_session.query(Document)
        .filter(Document.id == document_id, Document.module_id == module_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    from rag.document_processor import UPLOAD_DIR

    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    media_type = "application/pdf" if doc.original_filename.lower().endswith(".pdf") else "application/octet-stream"
    return FileResponse(
        file_path,
        media_type=media_type,
        filename=doc.original_filename,
        headers={"Access-Control-Expose-Headers": "Content-Disposition"},
    )


# =====================================================================
#  RAG STATUS (debugging helper)
# =====================================================================

@app.get("/rag/status")
async def rag_status(module_id: Optional[str] = None):
    count = vector_store.get_chunk_count(module_id=module_id)
    return {"total_chunks": count, "module_id": module_id}


# =====================================================================
#  Helpers
# =====================================================================

def _module_to_response(module: Module) -> ModuleResponse:
    return ModuleResponse(
        id=module.id,
        name=module.name,
        description=module.description,
        grade_level=module.grade_level,
        topics=module.topics or [],
        document_count=len(module.documents),
        chunk_count=vector_store.get_chunk_count(module_id=module.id),
        teacher_uid=module.teacher_uid,
    )


def _doc_to_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        module_id=doc.module_id,
        original_filename=doc.original_filename,
        status=doc.status,
        chunk_count=doc.chunk_count,
        error_message=doc.error_message,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

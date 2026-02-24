from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from google import genai
import os
from dotenv import load_dotenv
from google.genai import types
from pydantic import BaseModel
from typing import Optional
import uuid

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

# ── CORS ──────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    validator = ResponseValidator()
    print("[INFO] Response validation ENABLED")
except ValueError as e:
    print(f"[ERROR] Response validation failed to initialize: {e}")
    raise

# ── Constants ─────────────────────────────────────────────────────────
BASE_SYSTEM_PROMPT = (
    "You are Teacher's Pet, a friendly and encouraging math tutor for "
    "middle school students (grades 6-8).\n"
    "- Always work through problems step-by-step\n"
    "- Use simple, age-appropriate language\n"
    "- Guide students with hints rather than direct answers\n"
    "- Handle mistakes gently\n"
    "- Be warm, patient, and encouraging"
)

SAFETY_SETTINGS = [
    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_LOW_AND_ABOVE"),
    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_LOW_AND_ABOVE"),
    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_LOW_AND_ABOVE"),
    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_LOW_AND_ABOVE"),
]

# ── In-memory session store ──────────────────────────────────────────
conversations: dict = {}


# ── Pydantic schemas ─────────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str


class ConversationRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    module_id: Optional[str] = None  # scope chat to a module via RAG


class ConversationResponse(BaseModel):
    answer: str
    session_id: str
    error: Optional[bool] = False
    validation: Optional[dict] = None  # Validation metadata from GitHub models


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
        if session_id not in conversations:
            conversations[session_id] = []

        history = conversations[session_id]

        # ---- build system prompt (base + optional RAG context) --------
        system_prompt = BASE_SYSTEM_PROMPT

        if data.module_id:
            module = db.query(Module).filter(Module.id == data.module_id).first()
            if not module:
                raise HTTPException(status_code=404, detail="Module not found")

            rag_context = retriever.build_context(
                query=question,
                module_id=module.id,
                module_name=module.name,
                module_description=module.description,
            )
            if rag_context:
                system_prompt = f"{system_prompt}\n\n{rag_context}"

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
            model="gemini-2.5-flash-lite",
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
                    error=False
                )
        except Exception as e:
            # Log validation error but don't block response
            print(f"[ERROR] Validation failed: {e}")
            validation_result = {"error": str(e)}

        conversations[session_id].append({"role": "user", "content": question})
        conversations[session_id].append({"role": "assistant", "content": answer})

        return ConversationResponse(answer=answer, session_id=session_id, validation=validation_result)

    except HTTPException:
        raise
    except Exception as e:
        return ConversationResponse(
            answer=f"Error: {str(e)}",
            session_id=data.session_id or "error",
            error=True,
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
    if session_id not in conversations:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session_id, "history": conversations[session_id]}


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    if session_id in conversations:
        del conversations[session_id]
        return {"message": "Session deleted"}
    raise HTTPException(status_code=404, detail="Session not found")


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

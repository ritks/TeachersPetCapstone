"""
Integration tests for the chat/session API.

The LLM, RAG retriever, and safety validator are all stubbed so these tests are
fast, deterministic, and offline while still exercising the real endpoint logic:
session creation, history persistence, RAG citation enrichment, safety blocking,
and session management (list/get/rename/delete).
"""

import uuid
from types import SimpleNamespace

import pytest

from database.models import Module, Document


@pytest.fixture
def chat_app(client, monkeypatch):
    import main

    # Unique uid per test keeps the in-memory session cache isolated.
    uid = f"student-{uuid.uuid4()}"
    main.app.dependency_overrides[main.get_optional_user_uid] = lambda: uid
    main.app.dependency_overrides[main.get_current_user_uid] = lambda: uid

    monkeypatch.setattr(
        main, "_generate_chat_response", lambda contents, system_prompt: "The answer is 42."
    )
    monkeypatch.setattr(main.retriever, "build_context", lambda **kwargs: ("", []))
    monkeypatch.setattr(
        main.validator, "validate", lambda question, answer: {"is_safe": True, "safety_votes": []}
    )

    yield SimpleNamespace(main=main, uid=uid, client=client)

    main.app.dependency_overrides.clear()


class TestChat:
    def test_chat_creates_session_and_returns_answer(self, chat_app):
        resp = chat_app.client.post("/chat", json={"question": "What is 6 x 7?"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["answer"] == "The answer is 42."
        assert body["session_id"]
        assert body["error"] is False

    def test_chat_persists_messages_to_history(self, chat_app):
        first = chat_app.client.post("/chat", json={"question": "Hello tutor"})
        session_id = first.json()["session_id"]

        detail = chat_app.client.get(f"/session/{session_id}")
        assert detail.status_code == 200
        history = detail.json()["history"]
        assert {"role": "user", "content": "Hello tutor"} in history
        assert {"role": "assistant", "content": "The answer is 42."} in history

    def test_chat_empty_question_returns_400(self, chat_app):
        resp = chat_app.client.post("/chat", json={"question": "   "})
        assert resp.status_code == 400

    def test_chat_unknown_module_returns_404(self, chat_app):
        resp = chat_app.client.post(
            "/chat", json={"question": "hi", "module_id": "does-not-exist"}
        )
        assert resp.status_code == 404

    def test_chat_with_module_returns_enriched_citations(self, chat_app, db_session):
        module = Module(id="mod-cite", name="Fractions")
        document = Document(
            id="doc-cite",
            module_id="mod-cite",
            filename="stored.pdf",
            original_filename="Fractions.pdf",
        )
        db_session.add_all([module, document])
        db_session.commit()

        # RAG returns context plus a citation pointing at the document above.
        citation = {
            "ref": 1,
            "document_id": "doc-cite",
            "chapter": "Chapter 1",
            "section": "1.1",
            "page_start": 3,
            "page_end": 4,
            "snippet": "Fractions are parts of a whole.",
        }
        chat_app.main.retriever.build_context = lambda **kwargs: ("CONTEXT", [citation])

        resp = chat_app.client.post(
            "/chat", json={"question": "explain fractions", "module_id": "mod-cite"}
        )

        assert resp.status_code == 200
        citations = resp.json()["citations"]
        assert len(citations) == 1
        assert citations[0]["original_filename"] == "Fractions.pdf"
        assert citations[0]["chapter"] == "Chapter 1"

    def test_chat_unsafe_response_is_blocked(self, chat_app):
        chat_app.main.validator.validate = lambda question, answer: {
            "is_safe": False,
            "safety_votes": ["unsafe", "unsafe"],
        }

        resp = chat_app.client.post("/chat", json={"question": "something bad"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["flag_category"] == "unsafe_content"
        assert body["flag_severity"] == "high"
        assert "not able to provide" in body["answer"].lower()


class TestSessionManagement:
    def _new_session(self, chat_app):
        return chat_app.client.post("/chat", json={"question": "start"}).json()["session_id"]

    def test_list_sessions_scoped_to_user(self, chat_app):
        session_id = self._new_session(chat_app)

        resp = chat_app.client.get("/sessions")
        assert resp.status_code == 200
        ids = [s["session_id"] for s in resp.json()]
        assert session_id in ids

    def test_get_session_not_found(self, chat_app):
        resp = chat_app.client.get("/session/missing-session")
        assert resp.status_code == 404

    def test_rename_session(self, chat_app):
        session_id = self._new_session(chat_app)

        resp = chat_app.client.patch(f"/session/{session_id}", json={"title": "Algebra help"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "Algebra help"

    def test_rename_session_empty_title_returns_400(self, chat_app):
        session_id = self._new_session(chat_app)
        resp = chat_app.client.patch(f"/session/{session_id}", json={"title": "  "})
        assert resp.status_code == 400

    def test_delete_session(self, chat_app):
        session_id = self._new_session(chat_app)

        delete_resp = chat_app.client.delete(f"/session/{session_id}")
        assert delete_resp.status_code == 200

        assert chat_app.client.get(f"/session/{session_id}").status_code == 404


class TestAsk:
    def test_ask_returns_stateless_answer(self, client, monkeypatch):
        import main

        fake_models = SimpleNamespace(
            generate_content=lambda **kwargs: SimpleNamespace(text="Stateless answer")
        )
        monkeypatch.setattr(main, "client", SimpleNamespace(models=fake_models))

        resp = client.post("/ask", json={"question": "2+2?"})

        assert resp.status_code == 200
        assert resp.json()["answer"] == "Stateless answer"

    def test_ask_empty_question(self, client):
        resp = client.post("/ask", json={"question": ""})
        assert resp.status_code == 200
        assert "provide a question" in resp.json()["answer"].lower()
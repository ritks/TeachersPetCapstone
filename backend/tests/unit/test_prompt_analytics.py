"""Tests for prompt log analytics (teacher_uid resolution and listing)."""

from database.app_models import PromptLog
from database.models import Module
from routes.postgres_data import _resolve_prompt_context, configure_auth, list_prompts


def test_resolve_prompt_context_fills_from_module(db_session):
    db_session.add(Module(id="mod-1", name="Fractions", teacher_uid="teacher-abc"))
    db_session.commit()

    teacher_uid, module_name = _resolve_prompt_context(
        db_session,
        teacher_uid=None,
        module_id="mod-1",
        module_name=None,
    )

    assert teacher_uid == "teacher-abc"
    assert module_name == "Fractions"


def test_resolve_prompt_context_keeps_client_values(db_session):
    db_session.add(Module(id="mod-2", name="Decimals", teacher_uid="teacher-abc"))
    db_session.commit()

    teacher_uid, module_name = _resolve_prompt_context(
        db_session,
        teacher_uid="teacher-override",
        module_id="mod-2",
        module_name="Custom Label",
    )

    assert teacher_uid == "teacher-override"
    assert module_name == "Custom Label"


def test_list_prompts_includes_logs_for_owned_modules(db_session):
    configure_auth(lambda authorization=None: "teacher-abc")

    db_session.add(Module(id="mod-owned", name="Owned", teacher_uid="teacher-abc"))
    db_session.add(
        PromptLog(
            id="log-1",
            teacher_uid=None,
            module_id="mod-owned",
            prompt="question",
            response="answer",
            student_uid="student-1",
        )
    )
    db_session.add(
        PromptLog(
            id="log-2",
            teacher_uid="other-teacher",
            module_id="mod-other",
            prompt="other",
            response="nope",
            student_uid="student-2",
        )
    )
    db_session.commit()

    rows = list_prompts(teacher_uid="teacher-abc", db=db_session, uid="teacher-abc")

    assert len(rows) == 1
    assert rows[0]["id"] == "log-1"
    assert rows[0]["moduleId"] == "mod-owned"

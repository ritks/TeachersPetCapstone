"""Tests for student account validation used by teacher roster management."""

from types import SimpleNamespace

import pytest


class UserNotFoundError(Exception):
    pass


class FakeFirebaseAuth:
    def __init__(self, users_by_email):
        self.users_by_email = users_by_email

    def get_user_by_email(self, email):
        user = self.users_by_email.get(email)
        if not user:
            raise UserNotFoundError()
        return user


@pytest.fixture
def student_lookup_app(client, monkeypatch):
    import main

    main.app.dependency_overrides[main.get_current_user_uid] = lambda: "teacher-uid"
    monkeypatch.setattr(
        main,
        "_get_user_profile",
        lambda uid: {
            "teacher-uid": {"role": "teacher"},
            "student-uid": {"role": "student", "displayName": "Student One"},
            "teacher-target-uid": {"role": "teacher", "displayName": "Teacher Two"},
        }.get(uid, {}),
    )

    yield main

    main.app.dependency_overrides.clear()


def test_lookup_student_account_returns_existing_student(client, student_lookup_app, monkeypatch):
    monkeypatch.setattr(
        student_lookup_app,
        "firebase_auth",
        FakeFirebaseAuth({
            "student@example.com": SimpleNamespace(
                uid="student-uid",
                email="student@example.com",
                display_name="Auth Student",
            ),
        }),
    )

    resp = client.post("/students/lookup", json={"email": " Student@Example.com "})

    assert resp.status_code == 200
    assert resp.json() == {
        "exists": True,
        "is_student": True,
        "uid": "student-uid",
        "email": "student@example.com",
        "display_name": "Student One",
        "role": "student",
        "message": None,
    }


def test_lookup_student_account_rejects_missing_account(client, student_lookup_app, monkeypatch):
    monkeypatch.setattr(student_lookup_app, "firebase_auth", FakeFirebaseAuth({}))

    resp = client.post("/students/lookup", json={"email": "missing@example.com"})

    assert resp.status_code == 200
    assert resp.json()["exists"] is False
    assert resp.json()["is_student"] is False
    assert resp.json()["uid"] is None


def test_lookup_student_account_rejects_non_student_account(client, student_lookup_app, monkeypatch):
    monkeypatch.setattr(
        student_lookup_app,
        "firebase_auth",
        FakeFirebaseAuth({
            "teacher2@example.com": SimpleNamespace(
                uid="teacher-target-uid",
                email="teacher2@example.com",
                display_name="Auth Teacher",
            ),
        }),
    )

    resp = client.post("/students/lookup", json={"email": "teacher2@example.com"})

    assert resp.status_code == 200
    assert resp.json()["exists"] is True
    assert resp.json()["is_student"] is False
    assert resp.json()["uid"] is None
    assert resp.json()["role"] == "teacher"


def test_lookup_student_account_requires_teacher_role(client, student_lookup_app, monkeypatch):
    monkeypatch.setattr(student_lookup_app, "_get_user_profile", lambda uid: {"role": "student"})
    monkeypatch.setattr(student_lookup_app, "firebase_auth", FakeFirebaseAuth({}))

    resp = client.post("/students/lookup", json={"email": "student@example.com"})

    assert resp.status_code == 403

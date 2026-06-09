"""
Integration tests for the student dashboard bundle and module-access authz.

The dashboard surfaces, per enrolled class, only the modules a student is
allowed to see, with an unlocked flag — the same access logic the student app
mirrors. Auth is overridden so a fixed student/teacher uid is assumed.
"""

import pytest

from database.app_models import (
    UserProfile,
    TeacherClass,
    ClassModule,
    ClassStudent,
    ModuleAccess,
)
from database.models import Module

STUDENT_UID = "student-1"


@pytest.fixture
def as_student(client):
    import main
    from routes import postgres_data

    main.app.dependency_overrides[postgres_data.require_uid] = lambda: STUDENT_UID
    yield client, postgres_data
    main.app.dependency_overrides.clear()


def _seed_class_with_module(db, *, can_see, is_unlocked, by_email=False, student_email=None):
    """Create a class the student is enrolled in, linked to one accessible module."""
    cls = TeacherClass(id="class-1", name="Math 101", teacher_uid="teacher-1", teacher_name="Ms. T")
    module = Module(id="mod-1", name="Fractions", description="Parts of a whole")
    link = ClassModule(class_id="class-1", module_id="mod-1", teacher_uid="teacher-1")

    if by_email:
        enrollment = ClassStudent(class_id="class-1", teacher_uid="teacher-1", student_email=student_email)
        access = ModuleAccess(
            class_id="class-1", module_id="mod-1", teacher_uid="teacher-1",
            student_email=student_email, can_see=can_see, is_unlocked=is_unlocked,
        )
    else:
        enrollment = ClassStudent(class_id="class-1", teacher_uid="teacher-1", student_uid=STUDENT_UID)
        access = ModuleAccess(
            class_id="class-1", module_id="mod-1", teacher_uid="teacher-1",
            student_uid=STUDENT_UID, can_see=can_see, is_unlocked=is_unlocked,
        )

    # Insert parents first (flush) so FK-dependent rows satisfy constraints on
    # Postgres, which — unlike SQLite — enforces foreign keys.
    db.add_all([cls, module])
    db.flush()
    db.add_all([link, enrollment, access])
    db.commit()


class TestStudentDashboard:
    def test_empty_when_no_enrollment(self, as_student):
        client, _ = as_student
        resp = client.get("/student/dashboard")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_surfaces_visible_unlocked_module(self, as_student, db_session):
        _seed_class_with_module(db_session, can_see=True, is_unlocked=True)
        client, _ = as_student

        resp = client.get("/student/dashboard")
        assert resp.status_code == 200
        cards = resp.json()
        assert len(cards) == 1
        assert cards[0]["name"] == "Math 101"
        assert len(cards[0]["modules"]) == 1
        module = cards[0]["modules"][0]
        assert module["moduleId"] == "mod-1"
        assert module["moduleName"] == "Fractions"
        assert module["unlocked"] is True

    def test_locked_module_reports_unlocked_false(self, as_student, db_session):
        _seed_class_with_module(db_session, can_see=True, is_unlocked=False)
        client, _ = as_student

        cards = client.get("/student/dashboard").json()
        assert cards[0]["modules"][0]["unlocked"] is False

    def test_module_hidden_when_not_visible(self, as_student, db_session):
        _seed_class_with_module(db_session, can_see=False, is_unlocked=False)
        client, _ = as_student

        cards = client.get("/student/dashboard").json()
        # Card still present (enrolled), but the module is not surfaced.
        assert len(cards) == 1
        assert cards[0]["modules"] == []

    def test_enrollment_resolved_by_email(self, as_student, db_session):
        db_session.add(UserProfile(uid=STUDENT_UID, email="kid@example.com", role="student"))
        db_session.commit()
        _seed_class_with_module(
            db_session, can_see=True, is_unlocked=True, by_email=True, student_email="kid@example.com"
        )
        client, _ = as_student

        cards = client.get("/student/dashboard").json()
        assert len(cards) == 1
        assert cards[0]["modules"][0]["moduleId"] == "mod-1"

    def test_archived_class_excluded(self, as_student, db_session):
        cls = TeacherClass(
            id="class-1", name="Old Class", teacher_uid="teacher-1", status="archived"
        )
        db_session.add(cls)
        db_session.flush()  # parent must exist before the FK-bearing enrollment
        enrollment = ClassStudent(class_id="class-1", teacher_uid="teacher-1", student_uid=STUDENT_UID)
        db_session.add(enrollment)
        db_session.commit()
        client, _ = as_student

        assert client.get("/student/dashboard").json() == []


class TestModuleAccessAuthz:
    def test_cannot_read_another_teachers_access(self, client):
        import main
        from routes import postgres_data

        main.app.dependency_overrides[postgres_data.require_uid] = lambda: "teacher-1"
        try:
            resp = client.get("/module-access", params={"teacher_uid": "teacher-2"})
        finally:
            main.app.dependency_overrides.clear()

        assert resp.status_code == 403

    def test_can_read_own_access(self, client):
        import main
        from routes import postgres_data

        main.app.dependency_overrides[postgres_data.require_uid] = lambda: "teacher-1"
        try:
            resp = client.get("/module-access", params={"teacher_uid": "teacher-1"})
        finally:
            main.app.dependency_overrides.clear()

        assert resp.status_code == 200
        assert resp.json() == []
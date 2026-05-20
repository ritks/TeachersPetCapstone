"""REST API for app data stored in Postgres (formerly Firestore)."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.db import get_db
from database.app_models import (
    UserProfile,
    CourseCode,
    PromptLog,
    TeacherClass,
    ClassModule,
    ClassStudent,
    ClassGroup,
    ModuleAccess,
    ModuleGroupAccess,
)
from database.models import Module

router = APIRouter(tags=["app-data"])

_get_current_user_uid = None
_get_optional_user_uid = None


def configure_auth(get_uid_fn, get_optional_uid_fn=None):
    global _get_current_user_uid, _get_optional_user_uid
    _get_current_user_uid = get_uid_fn
    _get_optional_user_uid = get_optional_uid_fn or get_uid_fn


def require_uid(authorization: Optional[str] = Header(default=None)) -> str:
    if not _get_current_user_uid:
        raise HTTPException(status_code=503, detail="Auth not configured")
    return _get_current_user_uid(authorization)


# ── Schemas ───────────────────────────────────────────────────────────

class UserProfileResponse(BaseModel):
    uid: str
    email: str = ""
    display_name: str = ""
    role: Optional[str] = None
    theme: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: Optional[str] = None
    theme: Optional[str] = None


class CourseCodeResponse(BaseModel):
    code: str
    module_id: str
    module_name: Optional[str] = None
    teacher_uid: Optional[str] = None
    teacher_name: Optional[str] = None


class CreateCourseCodeRequest(BaseModel):
    code: str
    module_id: str
    module_name: Optional[str] = None
    teacher_name: Optional[str] = None


class PromptLogCreate(BaseModel):
    teacher_uid: Optional[str] = None
    course_code: Optional[str] = None
    module_id: Optional[str] = None
    module_name: Optional[str] = None
    session_id: Optional[str] = None
    student_uid: Optional[str] = None
    student_email: Optional[str] = None
    prompt: str
    response: str
    flag_category: Optional[str] = None
    flag_severity: Optional[str] = None


class ClassResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    teacher_uid: str
    teacher_name: Optional[str] = None
    created_at: str
    updated_at: str


class ClassCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ClassModuleLink(BaseModel):
    class_id: str
    module_id: str
    module_status: Optional[str] = "active"


class ClassModuleResponse(BaseModel):
    id: str
    class_id: str
    module_id: str
    module_name: Optional[str] = None
    module_status: Optional[str] = None


class StudentCreate(BaseModel):
    student_email: str


class GroupCreate(BaseModel):
    name: str


class GroupMembersUpdate(BaseModel):
    members: list[str] = []


class ModuleGroupAccessBody(BaseModel):
    class_id: str
    module_id: str
    group_ids: list[str] = []


class ModuleAccessBody(BaseModel):
    class_id: str
    module_id: str
    student_email: Optional[str] = None
    is_unlocked: bool = False
    source: Optional[str] = "manual"


# ── Helpers ─────────────────────────────────────────────────────────────

def _iso(dt):
    return dt.isoformat() if dt else datetime.now(timezone.utc).isoformat()


def _backfill_classes_from_links(db: Session, uid: str) -> None:
    links = (
        db.query(ClassModule.class_id, ClassModule.class_name)
        .filter(ClassModule.teacher_uid == uid)
        .distinct()
        .all()
    )
    for class_id, class_name in links:
        if not class_id:
            continue
        if db.query(TeacherClass).filter(TeacherClass.id == class_id).first():
            continue
        db.add(
            TeacherClass(
                id=class_id,
                name=(class_name or "Imported Class")[:255],
                teacher_uid=uid,
            )
        )
    db.commit()


# ── Profile ───────────────────────────────────────────────────────────

@router.get("/me", response_model=UserProfileResponse)
def get_me(db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    row = db.query(UserProfile).filter(UserProfile.uid == uid).first()
    if not row:
        row = UserProfile(uid=uid)
        db.add(row)
        db.commit()
        db.refresh(row)
    return UserProfileResponse(
        uid=row.uid,
        email=row.email or "",
        display_name=row.display_name or "",
        role=row.role,
        theme=row.theme,
    )


@router.put("/me", response_model=UserProfileResponse)
def put_me(body: UpdateProfileRequest, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    row = db.query(UserProfile).filter(UserProfile.uid == uid).first()
    if not row:
        row = UserProfile(uid=uid)
        db.add(row)
        db.commit()
        db.refresh(row)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return UserProfileResponse(
        uid=row.uid,
        email=row.email or "",
        display_name=row.display_name or "",
        role=row.role,
        theme=row.theme,
    )


# ── Course codes ────────────────────────────────────────────────────────

@router.get("/course-codes/{code}", response_model=CourseCodeResponse)
def get_course_code(code: str, db: Session = Depends(get_db)):
    row = db.query(CourseCode).filter(CourseCode.code == code.strip().upper()).first()
    if not row:
        raise HTTPException(status_code=404, detail="Course code not found")
    return CourseCodeResponse(
        code=row.code,
        module_id=row.module_id,
        module_name=row.module_name,
        teacher_uid=row.teacher_uid,
        teacher_name=row.teacher_name,
    )


@router.get("/course-codes", response_model=list[CourseCodeResponse])
def list_course_codes(
    teacher_uid: Optional[str] = None,
    db: Session = Depends(get_db),
    uid: str = Depends(require_uid),
):
    tid = teacher_uid or uid
    if teacher_uid and teacher_uid != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    q = db.query(CourseCode).filter(CourseCode.teacher_uid == tid)
    return [
        CourseCodeResponse(
            code=r.code,
            module_id=r.module_id,
            module_name=r.module_name,
            teacher_uid=r.teacher_uid,
            teacher_name=r.teacher_name,
        )
        for r in q.all()
    ]


@router.post("/course-codes", response_model=CourseCodeResponse)
def create_course_code(
    body: CreateCourseCodeRequest,
    db: Session = Depends(get_db),
    uid: str = Depends(require_uid),
):
    code = body.code.strip().upper()
    existing = db.query(CourseCode).filter(CourseCode.code == code).first()
    if existing:
        return CourseCodeResponse(
            code=existing.code,
            module_id=existing.module_id,
            module_name=existing.module_name,
            teacher_uid=existing.teacher_uid,
            teacher_name=existing.teacher_name,
        )
    mod = db.query(Module).filter(Module.id == body.module_id).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    row = CourseCode(
        code=code,
        module_id=body.module_id,
        module_name=body.module_name or mod.name,
        teacher_uid=uid,
        teacher_name=body.teacher_name,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return CourseCodeResponse(
        code=row.code,
        module_id=row.module_id,
        module_name=row.module_name,
        teacher_uid=row.teacher_uid,
        teacher_name=row.teacher_name,
    )


# ── Prompt logs (analytics) ───────────────────────────────────────────

@router.post("/prompts")
def create_prompt(body: PromptLogCreate, db: Session = Depends(get_db)):
    row = PromptLog(
        teacher_uid=body.teacher_uid,
        course_code=body.course_code,
        module_id=body.module_id,
        module_name=body.module_name,
        session_id=body.session_id,
        student_uid=body.student_uid,
        student_email=body.student_email,
        prompt=body.prompt,
        response=body.response,
        flag_category=body.flag_category,
        flag_severity=body.flag_severity,
    )
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.get("/prompts")
def list_prompts(teacher_uid: str, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    if teacher_uid != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    rows = (
        db.query(PromptLog)
        .filter(PromptLog.teacher_uid == teacher_uid)
        .order_by(PromptLog.created_at.desc())
        .limit(5000)
        .all()
    )
    return [
        {
            "id": r.id,
            "teacherUid": r.teacher_uid,
            "courseCode": r.course_code,
            "moduleId": r.module_id,
            "moduleName": r.module_name,
            "sessionId": r.session_id,
            "studentUid": r.student_uid,
            "studentEmail": r.student_email,
            "prompt": r.prompt,
            "response": r.response,
            "flagCategory": r.flag_category,
            "flagSeverity": r.flag_severity,
            "timestamp": _iso(r.created_at),
        }
        for r in rows
    ]


# ── Classes ─────────────────────────────────────────────────────────────

@router.get("/classes", response_model=list[ClassResponse])
def list_classes(db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    rows = (
        db.query(TeacherClass)
        .filter(TeacherClass.teacher_uid == uid)
        .order_by(TeacherClass.created_at.desc())
        .all()
    )
    if not rows:
        _backfill_classes_from_links(db, uid)
        rows = (
            db.query(TeacherClass)
            .filter(TeacherClass.teacher_uid == uid)
            .order_by(TeacherClass.created_at.desc())
            .all()
        )
    return [
        ClassResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            teacher_uid=r.teacher_uid,
            teacher_name=r.teacher_name,
            created_at=_iso(r.created_at),
            updated_at=_iso(r.updated_at),
        )
        for r in rows
    ]


@router.post("/classes", response_model=ClassResponse)
def create_class(body: ClassCreate, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    prof = db.query(UserProfile).filter(UserProfile.uid == uid).first()
    row = TeacherClass(
        name=name,
        description=body.description,
        teacher_uid=uid,
        teacher_name=(prof.display_name or prof.email) if prof else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ClassResponse(
        id=row.id,
        name=row.name,
        description=row.description,
        teacher_uid=row.teacher_uid,
        teacher_name=row.teacher_name,
        created_at=_iso(row.created_at),
        updated_at=_iso(row.updated_at),
    )


@router.get("/class-modules")
def list_teacher_class_modules(teacher_uid: str, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    if teacher_uid != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    rows = db.query(ClassModule).filter(ClassModule.teacher_uid == teacher_uid).all()
    return [
        {
            "id": r.id,
            "classId": r.class_id,
            "className": r.class_name,
            "moduleId": r.module_id,
            "moduleName": r.module_name,
            "moduleStatus": r.module_status or "active",
            "teacherUid": r.teacher_uid,
        }
        for r in rows
    ]


@router.get("/class-students")
def list_teacher_class_students(teacher_uid: str, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    if teacher_uid != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    rows = db.query(ClassStudent).filter(ClassStudent.teacher_uid == teacher_uid).all()
    return [
        {
            "id": r.id,
            "classId": r.class_id,
            "className": r.class_name,
            "teacherUid": r.teacher_uid,
            "teacherName": r.teacher_name,
            "studentEmail": r.student_email,
            "studentUid": r.student_uid,
            "status": r.status,
        }
        for r in rows
    ]


@router.get("/class-groups")
def list_teacher_class_groups(teacher_uid: str, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    if teacher_uid != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    rows = db.query(ClassGroup).filter(ClassGroup.teacher_uid == teacher_uid).all()
    return [
        {
            "id": r.id,
            "classId": r.class_id,
            "className": r.class_name,
            "teacherUid": r.teacher_uid,
            "name": r.name,
            "members": list(r.members or []),
        }
        for r in rows
    ]


@router.get("/classes/{class_id}/modules", response_model=list[ClassModuleResponse])
def list_class_modules(class_id: str, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    rows = (
        db.query(ClassModule)
        .filter(ClassModule.class_id == class_id, ClassModule.teacher_uid == uid)
        .all()
    )
    return [
        ClassModuleResponse(
            id=r.id,
            class_id=r.class_id,
            module_id=r.module_id,
            module_name=r.module_name,
            module_status=r.module_status,
        )
        for r in rows
    ]


@router.post("/class-modules", response_model=ClassModuleResponse)
def link_class_module(body: ClassModuleLink, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    cls = db.query(TeacherClass).filter(TeacherClass.id == body.class_id, TeacherClass.teacher_uid == uid).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    mod = db.query(Module).filter(Module.id == body.module_id).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    existing = (
        db.query(ClassModule)
        .filter(
            ClassModule.class_id == body.class_id,
            ClassModule.module_id == body.module_id,
            ClassModule.teacher_uid == uid,
        )
        .first()
    )
    if existing:
        return ClassModuleResponse(
            id=existing.id,
            class_id=existing.class_id,
            module_id=existing.module_id,
            module_name=existing.module_name,
            module_status=existing.module_status,
        )
    row = ClassModule(
        class_id=body.class_id,
        class_name=cls.name,
        module_id=body.module_id,
        module_name=mod.name,
        module_status=body.module_status or "active",
        teacher_uid=uid,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ClassModuleResponse(
        id=row.id,
        class_id=row.class_id,
        module_id=row.module_id,
        module_name=row.module_name,
        module_status=row.module_status,
    )


@router.put("/class-modules/{link_id}", response_model=ClassModuleResponse)
def update_class_module(
    link_id: str,
    body: ClassModuleLink,
    db: Session = Depends(get_db),
    uid: str = Depends(require_uid),
):
    row = db.query(ClassModule).filter(ClassModule.id == link_id, ClassModule.teacher_uid == uid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Link not found")
    if body.module_status:
        row.module_status = body.module_status
    db.commit()
    db.refresh(row)
    return ClassModuleResponse(
        id=row.id,
        class_id=row.class_id,
        module_id=row.module_id,
        module_name=row.module_name,
        module_status=row.module_status,
    )


# ── Students / groups / access ────────────────────────────────────────

@router.get("/classes/{class_id}/students")
def list_students(class_id: str, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    rows = db.query(ClassStudent).filter(ClassStudent.class_id == class_id, ClassStudent.teacher_uid == uid).all()
    return [
        {
            "id": r.id,
            "classId": r.class_id,
            "className": r.class_name,
            "teacherUid": r.teacher_uid,
            "studentEmail": r.student_email,
            "studentUid": r.student_uid,
            "status": r.status,
        }
        for r in rows
    ]


@router.post("/classes/{class_id}/students")
def add_student(class_id: str, body: StudentCreate, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    cls = db.query(TeacherClass).filter(TeacherClass.id == class_id, TeacherClass.teacher_uid == uid).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    email = body.student_email.strip().lower()
    row = ClassStudent(
        class_id=class_id,
        class_name=cls.name,
        teacher_uid=uid,
        student_email=email,
        status="invited",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "studentEmail": row.student_email}


@router.get("/classes/{class_id}/groups")
def list_groups(class_id: str, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    rows = db.query(ClassGroup).filter(ClassGroup.class_id == class_id, ClassGroup.teacher_uid == uid).all()
    return [
        {"id": r.id, "classId": r.class_id, "name": r.name, "members": list(r.members or [])}
        for r in rows
    ]


@router.post("/classes/{class_id}/groups")
def create_group(class_id: str, body: GroupCreate, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    cls = db.query(TeacherClass).filter(TeacherClass.id == class_id, TeacherClass.teacher_uid == uid).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    row = ClassGroup(class_id=class_id, class_name=cls.name, teacher_uid=uid, name=body.name.strip(), members=[])
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name, "members": []}


@router.put("/groups/{group_id}/members")
def update_group_members(
    group_id: str,
    body: GroupMembersUpdate,
    db: Session = Depends(get_db),
    uid: str = Depends(require_uid),
):
    row = db.query(ClassGroup).filter(ClassGroup.id == group_id, ClassGroup.teacher_uid == uid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Group not found")
    row.members = [m.strip().lower() for m in body.members if m and "@" in m]
    db.commit()
    return {"id": row.id, "members": list(row.members or [])}


@router.get("/module-access")
def list_module_access(teacher_uid: str, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    if teacher_uid != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    rows = db.query(ModuleAccess).filter(ModuleAccess.teacher_uid == teacher_uid).all()
    return [
        {
            "id": r.id,
            "classId": r.class_id,
            "moduleId": r.module_id,
            "studentEmail": r.student_email,
            "isUnlocked": bool(r.is_unlocked),
            "source": r.source,
        }
        for r in rows
    ]


@router.post("/module-access")
def upsert_module_access(body: ModuleAccessBody, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    email = (body.student_email or "").strip().lower() if body.student_email else None
    row = (
        db.query(ModuleAccess)
        .filter(
            ModuleAccess.class_id == body.class_id,
            ModuleAccess.module_id == body.module_id,
            ModuleAccess.teacher_uid == uid,
            ModuleAccess.student_email == email,
        )
        .first()
    )
    if not row:
        row = ModuleAccess(
            class_id=body.class_id,
            module_id=body.module_id,
            teacher_uid=uid,
            student_email=email,
            is_unlocked=body.is_unlocked,
            source=body.source or "manual",
        )
        db.add(row)
    else:
        row.is_unlocked = body.is_unlocked
        row.source = body.source or row.source
    db.commit()
    return {"ok": True}


@router.get("/module-group-access")
def list_module_group_access(teacher_uid: str, db: Session = Depends(get_db), uid: str = Depends(require_uid)):
    if teacher_uid != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    rows = db.query(ModuleGroupAccess).filter(ModuleGroupAccess.teacher_uid == teacher_uid).all()
    return [
        {
            "id": r.id,
            "classId": r.class_id,
            "moduleId": r.module_id,
            "groupIds": list(r.group_ids or []),
        }
        for r in rows
    ]


@router.post("/module-group-access")
def upsert_module_group_access(
    body: ModuleGroupAccessBody,
    db: Session = Depends(get_db),
    uid: str = Depends(require_uid),
):
    row = (
        db.query(ModuleGroupAccess)
        .filter(
            ModuleGroupAccess.class_id == body.class_id,
            ModuleGroupAccess.module_id == body.module_id,
            ModuleGroupAccess.teacher_uid == uid,
        )
        .first()
    )
    if not row:
        row = ModuleGroupAccess(
            class_id=body.class_id,
            module_id=body.module_id,
            teacher_uid=uid,
            group_ids=list(body.group_ids or []),
        )
        db.add(row)
    else:
        row.group_ids = list(body.group_ids or [])
    db.commit()
    return {"ok": True}


# ── Student dashboard bundle ────────────────────────────────────────────

@router.get("/student/dashboard")
def student_dashboard(db: Session = Depends(get_db), student_uid: str = Depends(require_uid)):
    prof = db.query(UserProfile).filter(UserProfile.uid == student_uid).first()
    email = (prof.email or "").lower() if prof and prof.email else None

    enrollments = db.query(ClassStudent).filter(ClassStudent.student_uid == student_uid).all()
    if email:
        enrollments += db.query(ClassStudent).filter(ClassStudent.student_email == email).all()

    seen_class = set()
    class_ids = []
    for e in enrollments:
        if e.class_id and e.class_id not in seen_class:
            seen_class.add(e.class_id)
            class_ids.append(e.class_id)

    if not class_ids:
        return []

    classes = {c.id: c for c in db.query(TeacherClass).filter(TeacherClass.id.in_(class_ids)).all()}
    module_meta = {m.id: m for m in db.query(Module).all()}

    access_rows = db.query(ModuleAccess).filter(ModuleAccess.student_uid == student_uid).all()
    if email:
        access_rows += db.query(ModuleAccess).filter(ModuleAccess.student_email == email).all()
    access_map = {(r.class_id, r.module_id): bool(r.is_unlocked) for r in access_rows}

    codes = db.query(CourseCode).all()
    code_by_module = {c.module_id: c.code for c in codes}

    cards = []
    for class_id in class_ids:
        cls = classes.get(class_id)
        links = db.query(ClassModule).filter(ClassModule.class_id == class_id).all()
        modules = []
        for link in links:
            meta = module_meta.get(link.module_id)
            modules.append(
                {
                    "moduleId": link.module_id,
                    "moduleName": (meta.name if meta else link.module_name) or "Module",
                    "moduleDescription": meta.description if meta else None,
                    "moduleStatus": link.module_status or "active",
                    "unlocked": access_map.get((class_id, link.module_id), False),
                    "courseCode": code_by_module.get(link.module_id),
                }
            )
        cards.append(
            {
                "id": class_id,
                "name": cls.name if cls else "Class",
                "teacher_name": cls.teacher_name if cls else None,
                "modules": modules,
            }
        )
    return cards

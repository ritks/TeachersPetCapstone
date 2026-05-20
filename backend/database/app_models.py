"""Application data migrated from Firestore (users, classes, prompts, etc.)."""

from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from .db import Base


def _generate_uuid():
    return str(uuid.uuid4())


def _utcnow():
    return datetime.now(timezone.utc)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    uid = Column(String, primary_key=True)
    email = Column(String(255), nullable=True, index=True)
    display_name = Column(String(255), nullable=True)
    role = Column(String(32), nullable=True, index=True)
    theme = Column(String(16), nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class CourseCode(Base):
    __tablename__ = "course_codes"

    code = Column(String(16), primary_key=True)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False, index=True)
    module_name = Column(String(255), nullable=True)
    teacher_uid = Column(String, nullable=True, index=True)
    teacher_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_utcnow, index=True)


class PromptLog(Base):
    __tablename__ = "prompt_logs"

    id = Column(String, primary_key=True, default=_generate_uuid)
    teacher_uid = Column(String, nullable=True, index=True)
    course_code = Column(String(16), nullable=True, index=True)
    module_id = Column(String, nullable=True, index=True)
    module_name = Column(String(255), nullable=True)
    session_id = Column(String, nullable=True, index=True)
    student_uid = Column(String, nullable=True, index=True)
    student_email = Column(String(255), nullable=True, index=True)
    prompt = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    flag_category = Column(String(64), nullable=True)
    flag_severity = Column(String(16), nullable=True)
    created_at = Column(DateTime, default=_utcnow, index=True)


class TeacherClass(Base):
    __tablename__ = "teacher_classes"

    id = Column(String, primary_key=True, default=_generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    teacher_uid = Column(String, nullable=False, index=True)
    teacher_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_utcnow, index=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class ClassModule(Base):
    __tablename__ = "class_modules"

    id = Column(String, primary_key=True, default=_generate_uuid)
    class_id = Column(String, ForeignKey("teacher_classes.id"), nullable=False, index=True)
    class_name = Column(String(255), nullable=True)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False, index=True)
    module_name = Column(String(255), nullable=True)
    module_status = Column(String(32), nullable=True, default="active")
    teacher_uid = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=_utcnow, index=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class ClassStudent(Base):
    __tablename__ = "class_students"

    id = Column(String, primary_key=True, default=_generate_uuid)
    class_id = Column(String, ForeignKey("teacher_classes.id"), nullable=False, index=True)
    class_name = Column(String(255), nullable=True)
    teacher_uid = Column(String, nullable=False, index=True)
    teacher_name = Column(String(255), nullable=True)
    student_email = Column(String(255), nullable=True, index=True)
    student_uid = Column(String, nullable=True, index=True)
    status = Column(String(32), nullable=True, default="invited")
    created_at = Column(DateTime, default=_utcnow, index=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class ClassGroup(Base):
    __tablename__ = "class_groups"

    id = Column(String, primary_key=True, default=_generate_uuid)
    class_id = Column(String, ForeignKey("teacher_classes.id"), nullable=False, index=True)
    class_name = Column(String(255), nullable=True)
    teacher_uid = Column(String, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    members = Column(JSON, default=list)
    created_at = Column(DateTime, default=_utcnow, index=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class ModuleGroupAccess(Base):
    __tablename__ = "module_group_access"

    id = Column(String, primary_key=True, default=_generate_uuid)
    class_id = Column(String, nullable=False, index=True)
    class_name = Column(String(255), nullable=True)
    module_id = Column(String, nullable=False, index=True)
    module_name = Column(String(255), nullable=True)
    teacher_uid = Column(String, nullable=False, index=True)
    group_ids = Column(JSON, default=list)
    created_at = Column(DateTime, default=_utcnow, index=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class ModuleAccess(Base):
    __tablename__ = "module_access"

    id = Column(String, primary_key=True, default=_generate_uuid)
    class_id = Column(String, nullable=False, index=True)
    class_name = Column(String(255), nullable=True)
    module_id = Column(String, nullable=False, index=True)
    module_name = Column(String(255), nullable=True)
    teacher_uid = Column(String, nullable=False, index=True)
    student_email = Column(String(255), nullable=True, index=True)
    student_uid = Column(String, nullable=True, index=True)
    is_unlocked = Column(Boolean, default=False, index=True)
    source = Column(String(16), nullable=True, default="group")
    unlocked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow, index=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from .db import Base


def _generate_uuid():
    return str(uuid.uuid4())


def _utcnow():
    return datetime.now(timezone.utc)


class Module(Base):
    __tablename__ = "modules"

    id = Column(String, primary_key=True, default=_generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    grade_level = Column(Integer, default=8)
    topics = Column(JSON, default=list)
    teacher_uid = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    documents = relationship(
        "Document", back_populates="module", cascade="all, delete-orphan"
    )


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=_generate_uuid)
    module_id = Column(String, ForeignKey("modules.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    status = Column(String(50), default="uploaded")  # uploaded | processing | processed | error
    chunk_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    module = relationship("Module", back_populates="documents")

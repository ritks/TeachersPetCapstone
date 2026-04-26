from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os

DATABASE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DATABASE_DIR, exist_ok=True)

DEFAULT_SQLITE_URL = f"sqlite:///{os.path.join(DATABASE_DIR, 'teachers_pet.db')}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from . import models  # noqa: F401 — ensure models are registered
    Base.metadata.create_all(bind=engine)

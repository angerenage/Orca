from __future__ import annotations

from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from argon2 import PasswordHasher, exceptions as argon2_exceptions
import os


DB_PATH = os.environ.get("ORCA_DB_PATH") or str(Path(__file__).resolve().parent / "orca.sqlite3")


class Base(DeclarativeBase):
    pass


engine = create_engine(
    f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    from . import models  # noqa: F401  # ensure models are imported for metadata
    Base.metadata.create_all(bind=engine)


def ensure_default_admin() -> None:
    from .models import User
    db = SessionLocal()
    try:
        has_any = db.query(User).first() is not None
        if has_any:
            return
        email = (os.getenv("ORCA_ADMIN_EMAIL") or "").strip().lower()
        password = os.getenv("ORCA_ADMIN_PASSWORD")
        if not email or not password:
            raise RuntimeError(
                "No users in database. Set ORCA_ADMIN_EMAIL and ORCA_ADMIN_PASSWORD to bootstrap the first admin user."
            )
        user = User(email=email, password_hash=hash_password(password))
        db.add(user)
        db.commit()
        print(f"[Orca] Created bootstrap admin user: {email}")
    finally:
        db.close()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



_ph = PasswordHasher()

def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, stored: str) -> bool:
    try:
        return _ph.verify(stored, password)
    except argon2_exceptions.VerifyMismatchError:
        return False
    except argon2_exceptions.VerificationError:
        return False
    except Exception:
        return False

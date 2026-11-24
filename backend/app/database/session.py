import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DEFAULT_DB = Path(__file__).resolve().parents[2] / "data" / "cva.sqlite3"


class Base(DeclarativeBase):
    pass


def make_engine(url: str | None = None):
    if url is None:
        path = Path(os.environ.get("CVA_DB_PATH", DEFAULT_DB))
        path.parent.mkdir(parents=True, exist_ok=True)
        url = f"sqlite:///{path}"
    return create_engine(url, connect_args={"check_same_thread": False})


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db(bind=None) -> None:
    from app.models import entities  # noqa: F401  (register tables)

    Base.metadata.create_all(bind=bind or engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

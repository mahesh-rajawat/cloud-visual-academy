from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class LessonProgress(Base):
    """One row per lesson the learner has opened; completion is explicit."""

    __tablename__ = "lesson_progress"
    __table_args__ = (UniqueConstraint("lesson_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam: Mapped[str] = mapped_column(String(16), index=True)
    lesson_id: Mapped[str] = mapped_column(String(64))
    objective_ids: Mapped[list] = mapped_column(JSON, default=list)
    seconds_spent: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    lab_passed: Mapped[bool] = mapped_column(Boolean, default=False)
    first_opened_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_studied_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class QuestionAttempt(Base):
    __tablename__ = "question_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam: Mapped[str] = mapped_column(String(16), index=True)
    question_id: Mapped[str] = mapped_column(String(64), index=True)
    objective_id: Mapped[str] = mapped_column(String(32), index=True)
    correct: Mapped[bool] = mapped_column(Boolean)
    confidence: Mapped[int] = mapped_column(Integer, default=2)  # 1 guess, 2 unsure, 3 sure
    seconds: Mapped[float] = mapped_column(Float, default=0)
    mode: Mapped[str] = mapped_column(String(24), default="practice")  # practice|mock|diagnostic|review
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam: Mapped[str] = mapped_column(String(16), index=True)
    kind: Mapped[str] = mapped_column(String(24))  # mock|domain|topic|diagnostic|weak
    score: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    seconds: Mapped[int] = mapped_column(Integer, default=0)
    breakdown: Mapped[dict] = mapped_column(JSON, default=dict)  # objectiveId -> [correct, total]
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ReviewItem(Base):
    """Spaced-repetition schedule for one objective."""

    __tablename__ = "review_items"
    __table_args__ = (UniqueConstraint("exam", "objective_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam: Mapped[str] = mapped_column(String(16))
    objective_id: Mapped[str] = mapped_column(String(32))
    stage: Mapped[int] = mapped_column(Integer, default=0)
    due_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    lapses: Mapped[int] = mapped_column(Integer, default=0)


class Bookmark(Base):
    __tablename__ = "bookmarks"
    __table_args__ = (UniqueConstraint("kind", "ref"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(16))  # lesson|question|animation
    ref: Mapped[str] = mapped_column(String(64))
    exam: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)


class LabScreenshot(Base):
    """A screenshot the learner saved while doing a hands-on lab in their own cloud account. Stored locally only."""

    __tablename__ = "lab_screenshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lesson_id: Mapped[str] = mapped_column(String(64), index=True)
    step: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-based lab step, or None for the whole lab
    caption: Mapped[str] = mapped_column(String(300), default="")
    mime: Mapped[str] = mapped_column(String(32))
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

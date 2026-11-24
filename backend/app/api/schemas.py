from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ExamSlug = Literal["az-900", "az-104", "ai-901", "aws-clf-c02"]


class LessonVisit(BaseModel):
    exam: ExamSlug
    lesson_id: str = Field(min_length=1, max_length=64)
    objective_ids: list[str]
    seconds_spent: int = Field(ge=0, le=6 * 3600)
    completed: bool = False
    lab_passed: bool = False


class LessonProgressOut(BaseModel):
    exam: str
    lesson_id: str
    objective_ids: list[str]
    seconds_spent: int
    completed: bool
    lab_passed: bool
    last_studied_at: datetime

    model_config = {"from_attributes": True}


class AttemptIn(BaseModel):
    exam: ExamSlug
    question_id: str = Field(min_length=1, max_length=64)
    objective_id: str = Field(min_length=1, max_length=32)
    correct: bool
    confidence: int = Field(ge=1, le=3, default=2)
    seconds: float = Field(ge=0, le=3600, default=0)
    mode: Literal["practice", "mock", "diagnostic", "review", "lesson"] = "practice"


class ExamSessionIn(BaseModel):
    exam: ExamSlug
    kind: Literal["mock", "domain", "topic", "diagnostic", "weak", "review"]
    score: int = Field(ge=0)
    total: int = Field(gt=0)
    seconds: int = Field(ge=0, default=0)
    breakdown: dict[str, list[int]] = {}


class ExamSessionOut(ExamSessionIn):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class BookmarkIn(BaseModel):
    kind: Literal["lesson", "question", "animation"]
    ref: str = Field(min_length=1, max_length=64)
    exam: ExamSlug
    title: str = Field(min_length=1, max_length=200)


class BookmarkOut(BookmarkIn):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ReviewOut(BaseModel):
    exam: str
    objective_id: str
    stage: int
    due_at: datetime
    lapses: int
    reason: str

    model_config = {"from_attributes": True}


class Settings(BaseModel):
    exam_dates: dict[str, str | None] = {"az-104": None}
    sprint_start: str | None = None
    weekday_hours: float = Field(ge=0.5, le=12, default=1.75)
    weekend_hours: float = Field(ge=0.5, le=14, default=2.0)
    mode: Literal["sprint", "complete"] = "sprint"
    depth: Literal["foundation", "engineer"] = "engineer"
    theme: Literal["dark", "light", "system"] = "system"
    reduced_motion: bool = False


class ScreenshotIn(BaseModel):
    lesson_id: str = Field(min_length=1, max_length=64)
    step: int | None = Field(default=None, ge=1, le=100)
    caption: str = Field(default="", max_length=300)
    data_url: str  # data:image/png;base64,...


class ScreenshotOut(BaseModel):
    id: int
    lesson_id: str
    step: int | None
    caption: str
    mime: str
    created_at: datetime

    model_config = {"from_attributes": True}

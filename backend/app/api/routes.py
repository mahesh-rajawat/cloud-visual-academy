import base64
import binascii
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import schemas
from app.assessment.mastery import mastery_for, next_review
from app.database.session import get_db
from app.models.entities import Bookmark, ExamSession, LabScreenshot, LessonProgress, QuestionAttempt, ReviewItem, Setting, utcnow

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok"}


# ------------------------------------------------------------------ lessons
@router.post("/lessons/visit", response_model=schemas.LessonProgressOut)
def record_lesson_visit(body: schemas.LessonVisit, db: Session = Depends(get_db)):
    row = db.scalar(select(LessonProgress).where(LessonProgress.lesson_id == body.lesson_id))
    now = utcnow()
    if row is None:
        row = LessonProgress(exam=body.exam, lesson_id=body.lesson_id, objective_ids=body.objective_ids,
                             seconds_spent=0, completed=False, lab_passed=False)
        db.add(row)
    row.objective_ids = body.objective_ids
    row.seconds_spent += body.seconds_spent
    row.last_studied_at = now
    newly_completed = body.completed and not row.completed
    row.completed = row.completed or body.completed
    row.lab_passed = row.lab_passed or body.lab_passed
    if newly_completed:
        for oid in body.objective_ids:  # first review the same day
            item = db.scalar(select(ReviewItem).where(ReviewItem.exam == body.exam, ReviewItem.objective_id == oid))
            if item is None:
                db.add(ReviewItem(exam=body.exam, objective_id=oid, stage=0, due_at=now))
    db.commit()
    return row


@router.get("/lessons", response_model=list[schemas.LessonProgressOut])
def list_lesson_progress(exam: str | None = None, db: Session = Depends(get_db)):
    q = select(LessonProgress).order_by(LessonProgress.last_studied_at.desc())
    if exam:
        q = q.where(LessonProgress.exam == exam)
    return db.scalars(q).all()


# ------------------------------------------------------------------ attempts & mastery
@router.post("/attempts")
def record_attempt(body: schemas.AttemptIn, db: Session = Depends(get_db)):
    now = utcnow()
    db.add(QuestionAttempt(**body.model_dump(), created_at=now))
    if body.mode in ("review", "practice", "mock", "lesson"):
        item = db.scalar(select(ReviewItem).where(ReviewItem.exam == body.exam,
                                                  ReviewItem.objective_id == body.objective_id))
        if item is None:
            # Wrong answers on unseen objectives schedule a review; correct ones wait for the lesson.
            if not body.correct:
                db.add(ReviewItem(exam=body.exam, objective_id=body.objective_id, stage=1,
                                  due_at=now + timedelta(days=1), lapses=1))
        elif body.mode == "review" or not body.correct or item.due_at <= now:
            stage, due, lapsed = next_review(item.stage, body.correct, now)
            item.stage, item.due_at, item.last_reviewed_at = stage, due, now
            item.lapses += int(lapsed)
    db.commit()
    return {"ok": True}


@router.get("/mastery/{exam}")
def mastery(exam: str, db: Session = Depends(get_db)):
    rows = db.scalars(select(QuestionAttempt).where(QuestionAttempt.exam == exam)
                      .order_by(QuestionAttempt.created_at, QuestionAttempt.id)).all()
    by_obj = defaultdict(list)
    for r in rows:
        by_obj[r.objective_id].append(r)
    return {oid: mastery_for(atts) | {"lastAttemptAt": atts[-1].created_at.isoformat()}
            for oid, atts in by_obj.items()}


@router.get("/attempts/mistakes")
def mistakes(exam: str, db: Session = Depends(get_db)):
    """Most recent attempt per question, wrong ones only - the learner's open mistakes."""
    rows = db.scalars(select(QuestionAttempt).where(QuestionAttempt.exam == exam)
                      .order_by(QuestionAttempt.created_at, QuestionAttempt.id)).all()
    latest: dict[str, QuestionAttempt] = {}
    wrong_count: dict[str, int] = defaultdict(int)
    for r in rows:
        latest[r.question_id] = r
        if not r.correct:
            wrong_count[r.question_id] += 1
    return [{"questionId": q, "objectiveId": a.objective_id, "timesWrong": wrong_count[q],
             "lastAttemptAt": a.created_at.isoformat()}
            for q, a in latest.items() if not a.correct]


# ------------------------------------------------------------------ reviews
@router.get("/reviews/due", response_model=list[schemas.ReviewOut])
def due_reviews(exam: str | None = None, db: Session = Depends(get_db)):
    now = utcnow()
    settings = _load_settings(db)
    q = select(ReviewItem)
    if exam:
        q = q.where(ReviewItem.exam == exam)
    out = []
    for item in db.scalars(q).all():
        reason = None
        if item.due_at <= now:
            reason = "lapsed" if item.lapses and item.stage <= 1 else f"interval-{item.stage}"
        exam_date = settings.exam_dates.get(item.exam)
        if reason is None and exam_date:
            eve = datetime.fromisoformat(exam_date) - timedelta(days=1)
            if eve <= now and (item.last_reviewed_at is None or item.last_reviewed_at < eve):
                reason = "pre-exam"
        if reason:
            out.append(schemas.ReviewOut(exam=item.exam, objective_id=item.objective_id, stage=item.stage,
                                         due_at=item.due_at, lapses=item.lapses, reason=reason))
    return sorted(out, key=lambda r: (-r.lapses, r.due_at))


@router.get("/reviews/upcoming", response_model=list[schemas.ReviewOut])
def upcoming_reviews(days: int = 7, db: Session = Depends(get_db)):
    now = utcnow()
    rows = db.scalars(select(ReviewItem).where(ReviewItem.due_at > now,
                                               ReviewItem.due_at <= now + timedelta(days=days))
                      .order_by(ReviewItem.due_at)).all()
    return [schemas.ReviewOut(exam=r.exam, objective_id=r.objective_id, stage=r.stage, due_at=r.due_at,
                              lapses=r.lapses, reason="scheduled") for r in rows]


# ------------------------------------------------------------------ exam sessions
@router.post("/exam-sessions", response_model=schemas.ExamSessionOut)
def save_exam_session(body: schemas.ExamSessionIn, db: Session = Depends(get_db)):
    if body.score > body.total:
        raise HTTPException(422, "score cannot exceed total")
    row = ExamSession(**body.model_dump())
    db.add(row)
    db.commit()
    return row


@router.get("/exam-sessions", response_model=list[schemas.ExamSessionOut])
def list_exam_sessions(exam: str | None = None, db: Session = Depends(get_db)):
    q = select(ExamSession).order_by(ExamSession.created_at.desc(), ExamSession.id.desc())
    if exam:
        q = q.where(ExamSession.exam == exam)
    return db.scalars(q).all()


# ------------------------------------------------------------------ bookmarks
@router.get("/bookmarks", response_model=list[schemas.BookmarkOut])
def list_bookmarks(db: Session = Depends(get_db)):
    return db.scalars(select(Bookmark).order_by(Bookmark.created_at.desc())).all()


@router.post("/bookmarks", response_model=schemas.BookmarkOut)
def add_bookmark(body: schemas.BookmarkIn, db: Session = Depends(get_db)):
    row = db.scalar(select(Bookmark).where(Bookmark.kind == body.kind, Bookmark.ref == body.ref))
    if row is None:
        row = Bookmark(**body.model_dump())
        db.add(row)
        db.commit()
    return row


@router.delete("/bookmarks/{kind}/{ref}")
def delete_bookmark(kind: str, ref: str, db: Session = Depends(get_db)):
    row = db.scalar(select(Bookmark).where(Bookmark.kind == kind, Bookmark.ref == ref))
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ lab screenshots
SCREENSHOT_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024


@router.get("/screenshots", response_model=list[schemas.ScreenshotOut])
def list_screenshots(lesson_id: str, db: Session = Depends(get_db)):
    q = select(LabScreenshot).where(LabScreenshot.lesson_id == lesson_id).order_by(LabScreenshot.step, LabScreenshot.created_at)
    return db.scalars(q).all()


@router.post("/screenshots", response_model=schemas.ScreenshotOut)
def add_screenshot(body: schemas.ScreenshotIn, db: Session = Depends(get_db)):
    head, _, payload = body.data_url.partition(",")
    mime = head.removeprefix("data:").removesuffix(";base64")
    if not head.startswith("data:") or not head.endswith(";base64") or mime not in SCREENSHOT_TYPES:
        raise HTTPException(400, "send a PNG, JPEG, WebP or GIF image as a base64 data URL")
    try:
        data = base64.b64decode(payload, validate=True)
    except binascii.Error:
        raise HTTPException(400, "image data is not valid base64") from None
    if len(data) > SCREENSHOT_MAX_BYTES:
        raise HTTPException(413, "image is larger than 5 MB")
    row = LabScreenshot(lesson_id=body.lesson_id, step=body.step, caption=body.caption, mime=mime, data=data)
    db.add(row)
    db.commit()
    return row


@router.get("/screenshots/{shot_id}/image")
def get_screenshot_image(shot_id: int, db: Session = Depends(get_db)):
    row = db.get(LabScreenshot, shot_id)
    if row is None:
        raise HTTPException(404, "screenshot not found")
    return Response(content=row.data, media_type=row.mime, headers={"Cache-Control": "private, max-age=86400"})


@router.delete("/screenshots/{shot_id}")
def delete_screenshot(shot_id: int, db: Session = Depends(get_db)):
    row = db.get(LabScreenshot, shot_id)
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ settings
def _load_settings(db: Session) -> schemas.Settings:
    row = db.get(Setting, "learner")
    return schemas.Settings(**row.value) if row else schemas.Settings()


@router.get("/settings", response_model=schemas.Settings)
def get_settings(db: Session = Depends(get_db)):
    return _load_settings(db)


@router.put("/settings", response_model=schemas.Settings)
def put_settings(body: schemas.Settings, db: Session = Depends(get_db)):
    row = db.get(Setting, "learner")
    if row is None:
        db.add(Setting(key="learner", value=body.model_dump()))
    else:
        row.value = body.model_dump()
    db.commit()
    return body


@router.delete("/progress")
def reset_progress(confirm: str, db: Session = Depends(get_db)):
    """Erase all learner history. Requires ?confirm=RESET so it cannot fire by accident."""
    if confirm != "RESET":
        raise HTTPException(400, "pass confirm=RESET")
    for model in (LessonProgress, QuestionAttempt, ExamSession, ReviewItem, Bookmark):
        db.query(model).delete()
    db.commit()
    return {"ok": True}

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.assessment.mastery import AttemptLike, mastery_for, next_review
from app.database import session as dbs
from app.main import app
from app.models.entities import utcnow


@pytest.fixture()
def client():
    from sqlalchemy import create_engine

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    dbs.init_db(engine)
    Local = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override():
        db = Local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[dbs.get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_mastery_requires_evidence():
    assert mastery_for([AttemptLike("q1", True, 2)])["mastery"] is None
    m = mastery_for([AttemptLike("q1", True, 2)] * 3)
    assert m["mastery"] == 100 and m["status"] == "proficient"


def test_confident_wrong_marks_weak():
    atts = [AttemptLike("q1", True, 2), AttemptLike("q2", True, 2), AttemptLike("q3", True, 2),
            AttemptLike("q4", True, 2), AttemptLike("q5", False, 3)]
    m = mastery_for(atts)
    assert m["mastery"] == 80 and m["status"] == "weak" and m["confidentWrong"] == 1


def test_review_intervals():
    now = utcnow()
    assert next_review(0, True, now)[1] == now + timedelta(days=1)
    assert next_review(1, True, now)[1] == now + timedelta(days=3)
    assert next_review(2, True, now)[1] == now + timedelta(days=7)
    stage, due, lapsed = next_review(3, False, now)
    assert (stage, lapsed) == (1, True) and due == now + timedelta(days=1)


def test_lesson_completion_schedules_same_day_review(client):
    r = client.post("/api/lessons/visit", json={"exam": "az-104", "lesson_id": "az104-nsg",
                                                 "objective_ids": ["AZ104-4.2.1"], "seconds_spent": 600,
                                                 "completed": True})
    assert r.status_code == 200 and r.json()["completed"]
    due = client.get("/api/reviews/due").json()
    assert [d["objective_id"] for d in due] == ["AZ104-4.2.1"]
    # a correct review moves it to tomorrow
    client.post("/api/attempts", json={"exam": "az-104", "question_id": "q", "objective_id": "AZ104-4.2.1",
                                       "correct": True, "mode": "review"})
    assert client.get("/api/reviews/due").json() == []
    assert len(client.get("/api/reviews/upcoming").json()) == 1


def test_attempts_and_mistakes(client):
    for correct in (False, False, True, False):
        client.post("/api/attempts", json={"exam": "az-104", "question_id": "q1",
                                           "objective_id": "AZ104-1.2.2", "correct": correct, "confidence": 3})
    m = client.get("/api/mastery/az-104").json()["AZ104-1.2.2"]
    assert m["attempts"] == 4 and m["mastery"] == 25 and m["repeatedMistakes"] == 1
    mistakes = client.get("/api/attempts/mistakes", params={"exam": "az-104"}).json()
    assert mistakes[0]["timesWrong"] == 3


def test_exam_session_validation(client):
    bad = client.post("/api/exam-sessions", json={"exam": "az-104", "kind": "mock", "score": 5, "total": 4})
    assert bad.status_code == 422
    ok = client.post("/api/exam-sessions", json={"exam": "az-104", "kind": "mock", "score": 3, "total": 4,
                                                  "breakdown": {"AZ104-4.2.1": [1, 2]}})
    assert ok.status_code == 200
    assert client.get("/api/exam-sessions", params={"exam": "az-104"}).json()[0]["score"] == 3


def test_settings_and_bookmarks_roundtrip(client):
    s = client.get("/api/settings").json()
    s["exam_dates"]["az-104"] = "2026-12-02"
    assert client.put("/api/settings", json=s).json()["exam_dates"]["az-104"] == "2026-12-02"
    client.post("/api/bookmarks", json={"kind": "lesson", "ref": "x", "exam": "az-104", "title": "X"})
    assert len(client.get("/api/bookmarks").json()) == 1
    client.delete("/api/bookmarks/lesson/x")
    assert client.get("/api/bookmarks").json() == []


def test_reset_requires_confirmation(client):
    assert client.delete("/api/progress", params={"confirm": "yes"}).status_code == 400
    assert client.delete("/api/progress", params={"confirm": "RESET"}).status_code == 200


def test_lab_screenshots_roundtrip(client):
    png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    made = client.post("/api/screenshots", json={"lesson_id": "az104-rbac", "step": 2, "caption": "Role assigned", "data_url": png}).json()
    assert made["mime"] == "image/png" and made["step"] == 2
    assert [s["caption"] for s in client.get("/api/screenshots", params={"lesson_id": "az104-rbac"}).json()] == ["Role assigned"]
    img = client.get(f"/api/screenshots/{made['id']}/image")
    assert img.status_code == 200 and img.headers["content-type"] == "image/png" and img.content.startswith(b"\x89PNG")
    assert client.post("/api/screenshots", json={"lesson_id": "x", "data_url": "data:text/html;base64,PGI+"}).status_code == 400
    assert client.post("/api/screenshots", json={"lesson_id": "x", "data_url": "data:image/png;base64,***"}).status_code == 400
    client.delete(f"/api/screenshots/{made['id']}")
    assert client.get("/api/screenshots", params={"lesson_id": "az104-rbac"}).json() == []

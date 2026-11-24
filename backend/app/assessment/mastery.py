"""Learner-mastery and spaced-repetition rules.

Mastery is evidence-based: it is only reported once an objective has at least
MIN_EVIDENCE attempts, and it is computed from the most recent attempts so that
improvement shows up. A confident wrong answer counts as a stronger signal of a
misconception than a guessed wrong answer.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

# Same day, next day, 3 days, 7 days. "Before the exam" is applied by the due query.
REVIEW_INTERVALS_DAYS = [0, 1, 3, 7]
WINDOW = 6
MIN_EVIDENCE = 3
WEAK_THRESHOLD = 70


@dataclass
class AttemptLike:
    question_id: str
    correct: bool
    confidence: int


def mastery_for(attempts: list[AttemptLike]) -> dict:
    """attempts must be ordered oldest -> newest."""
    recent = attempts[-WINDOW:]
    n = len(recent)
    correct = sum(1 for a in recent if a.correct)
    wrong_by_q: dict[str, int] = {}
    for a in attempts:
        if not a.correct:
            wrong_by_q[a.question_id] = wrong_by_q.get(a.question_id, 0) + 1
    repeated = sum(1 for c in wrong_by_q.values() if c > 1)
    confident_wrong = sum(1 for a in recent if not a.correct and a.confidence >= 3)
    if n < MIN_EVIDENCE:
        return {"attempts": len(attempts), "mastery": None, "status": "insufficient-evidence" if n else "not-assessed",
                "repeatedMistakes": repeated, "confidentWrong": confident_wrong}
    score = round(100 * correct / n)
    weak = score < WEAK_THRESHOLD or repeated > 0 or confident_wrong > 0
    return {"attempts": len(attempts), "mastery": score, "status": "weak" if weak else "proficient",
            "repeatedMistakes": repeated, "confidentWrong": confident_wrong}


def next_review(stage: int, correct: bool, now: datetime) -> tuple[int, datetime, bool]:
    """Return (new_stage, due_at, lapsed)."""
    if not correct:
        return 1, now + timedelta(days=1), True
    new_stage = min(stage + 1, len(REVIEW_INTERVALS_DAYS))
    if new_stage >= len(REVIEW_INTERVALS_DAYS):
        # Graduated: keep it in rotation weekly; the pre-exam review is added by the due query.
        return new_stage, now + timedelta(days=7), False
    return new_stage, now + timedelta(days=REVIEW_INTERVALS_DAYS[new_stage]), False

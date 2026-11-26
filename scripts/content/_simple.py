"""Shared helpers for the plain-wording swaps (zzz_simplify.py and scripts/simplify_tool.py)."""
import hashlib
import json

from builder import CUR, ROOT

SIMPLE = ROOT / "scripts" / "content" / "simple"
FIELDS = ("learningObjective", "foundation", "engineer", "example", "architectureDecisions", "misconceptions",
          "comparisons", "troubleshooting", "configuration.limits", "configuration.permissions",
          "configuration.prerequisites")


def get(lesson: dict, field: str):
    for part in field.split("."):
        lesson = lesson.get(part) if isinstance(lesson, dict) else None
    return lesson


def put(lesson: dict, field: str, value) -> None:
    *parents, last = field.split(".")
    for part in parents:
        lesson = lesson[part]
    lesson[last] = value


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]


def patches(lesson_id: str) -> list[str]:
    """Late fact fixes zz_az104_overlay appends to a lesson's engineer text (they come back on every build)."""
    import _az104_d1, _az104_d2, _az104_d3, _az104_d4, _az104_d5
    out: list[str] = []
    for mod in (_az104_d1, _az104_d2, _az104_d3, _az104_d4, _az104_d5):
        out += getattr(mod, "PATCH", {}).get(lesson_id, [])
    return out

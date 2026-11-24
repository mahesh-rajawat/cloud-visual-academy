#!/usr/bin/env python3
"""Audit content coverage of every official objective and write curriculum/coverage-report.json.

An objective counts as content-complete only when ALL of these hold:
  * a lesson lists it in objectiveIds and every required lesson section is non-empty;
  * the lesson's animation is registered in curriculum/animations.json and its test file exists;
  * at least MIN_QUESTIONS questions target it, and at least one is an applied type;
  * a lab exists in the lesson when the objective is hands-on;
  * the lesson links at least one official documentation page.

Human verification status is reported separately and never counted as coverage.

Exit codes: 0 = all requested exams fully covered and no integrity errors;
            1 = coverage gaps; 2 = integrity errors (broken references, invalid questions).
Use --report-only to always exit 0 (used by the frontend dev/build scripts).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUR = ROOT / "curriculum"
EXAMS = ["az-900", "az-104", "ai-901", "aws-clf-c02"]
MIN_QUESTIONS = 2
APPLIED_TYPES = {"scenario", "configuration", "troubleshooting", "architecture", "command", "ordering", "matching"}
REQUIRED_LESSON_FIELDS = ["learningObjective", "prerequisites", "foundation", "engineer", "animation", "diagram",
                          "example", "configuration", "troubleshooting", "comparisons", "misconceptions", "docs"]
OFFICIAL_DOC_HOSTS = ("https://learn.microsoft.com/", "https://azure.microsoft.com/", "https://www.microsoft.com/", "https://docs.aws.amazon.com/", "https://aws.amazon.com/", "https://repost.aws/")


def load(path: Path, default):
    return json.loads(path.read_text()) if path.exists() else default


def objectives(reg: dict):
    for d in reg["domains"]:
        for s in d["skills"]:
            for o in s["objectives"]:
                if o["status"] == "active":
                    yield o


def non_empty(v) -> bool:
    if v is None:
        return False
    if isinstance(v, (list, str, dict)):
        return len(v) > 0
    return True


def validate_question(q: dict, ids: set[str], errors: list[str]) -> None:
    qid = q.get("id", "?")
    for f in ("id", "exam", "objectiveId", "difficulty", "type", "answerMode", "stem", "explanation", "docs"):
        if not non_empty(q.get(f)):
            errors.append(f"question {qid}: missing {f}")
    if q.get("objectiveId") not in ids:
        errors.append(f"question {qid}: unknown objective {q.get('objectiveId')}")
    opts = {o["id"] for o in q.get("options", [])}
    mode = q.get("answerMode")
    if mode in ("single", "multiple"):
        if not q.get("correct") or not set(q["correct"]) <= opts:
            errors.append(f"question {qid}: correct answers not among options")
        if mode == "single" and len(q.get("correct", [])) != 1:
            errors.append(f"question {qid}: single-answer question must have exactly one correct option")
        for o in q.get("options", []):
            if not non_empty(o.get("explanation")):
                errors.append(f"question {qid}: option {o['id']} has no explanation")
    elif mode == "ordering":
        if sorted(q.get("correct", [])) != sorted(opts):
            errors.append(f"question {qid}: ordering must list every option exactly once")
    elif mode == "matching":
        pairs = q.get("pairs") or []
        if not pairs or any(p.get("answer") not in opts for p in pairs):
            errors.append(f"question {qid}: matching pairs reference unknown options")
    else:
        errors.append(f"question {qid}: unknown answerMode {mode}")
    for url in q.get("docs", []):
        if not url.startswith(OFFICIAL_DOC_HOSTS):
            errors.append(f"question {qid}: non-official doc link {url}")


def audit() -> dict:
    animations = {a["id"]: a for a in load(CUR / "animations.json", [])}
    errors: list[str] = []
    for a in animations.values():
        if not (ROOT / a["testFile"]).exists():
            errors.append(f"animation {a['id']}: test file {a['testFile']} missing")

    report = {"generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "exams": {}, "errors": errors}
    all_ids: set[str] = set()
    regs = {e: load(CUR / e / "objectives.json", None) for e in EXAMS}
    for reg in regs.values():
        if reg:
            all_ids |= {o["id"] for o in objectives(reg)}

    for exam, reg in regs.items():
        if reg is None:
            errors.append(f"{exam}: objectives.json missing; run scripts/sync_exam_objectives.py")
            continue
        ids = {o["id"] for o in objectives(reg)}
        lessons = [load(p, {}) for p in sorted((CUR / exam / "lessons").glob("*.json"))]
        questions = load(CUR / exam / "questions.json", [])
        for q in questions:
            validate_question(q, ids, errors)
        for l in lessons:
            for oid in l.get("objectiveIds", []):
                if oid not in ids:
                    errors.append(f"lesson {l.get('id')}: unknown objective {oid}")
            for p in l.get("prerequisites", []):
                if p.get("objectiveId") and p["objectiveId"] not in all_ids:
                    errors.append(f"lesson {l.get('id')}: prerequisite references unknown objective {p['objectiveId']}")
            for d in l.get("docs", []):
                if not d.get("url", "").startswith(OFFICIAL_DOC_HOSTS):
                    errors.append(f"lesson {l.get('id')}: non-official doc link {d.get('url')}")

        entries = []
        for o in objectives(reg):
            ls = [l for l in lessons if o["id"] in l.get("objectiveIds", [])]
            lesson = next((l for l in ls if all(non_empty(l.get(f)) for f in REQUIRED_LESSON_FIELDS)), None)
            anim_id = (lesson or {}).get("animation", {}).get("id")
            anim = animations.get(anim_id) if anim_id else None
            animation_ok = bool(anim and o["id"] in anim["objectiveIds"] and (ROOT / anim["testFile"]).exists())
            qs = [q for q in questions if q.get("objectiveId") == o["id"]]
            applied = any(q.get("type") in APPLIED_TYPES for q in qs)
            lab = (bool(lesson and lesson.get("lab")) if o["handsOn"] else None)
            docs = bool(lesson and any(d.get("url", "").startswith(OFFICIAL_DOC_HOSTS) for d in lesson.get("docs", [])))
            missing = []
            if not lesson:
                missing.append("lesson")
            if not animation_ok:
                missing.append("tested animation")
            if len(qs) < MIN_QUESTIONS:
                missing.append(f"{MIN_QUESTIONS - len(qs)} more question(s)")
            if not applied:
                missing.append("applied assessment")
            if lab is False:
                missing.append("lab")
            if not docs:
                missing.append("official docs")
            entries.append({
                "objectiveId": o["id"], "lesson": bool(lesson), "animation": animation_ok,
                "assessment": len(qs) >= MIN_QUESTIONS, "appliedAssessment": applied, "questionCount": len(qs),
                "lab": lab, "docs": docs,
                "verification": (lesson or {}).get("verification", {}).get("status"),
                "complete": not missing, "missing": missing,
            })
        report["exams"][exam] = {
            "total": len(entries),
            "complete": sum(e["complete"] for e in entries),
            "withLesson": sum(e["lesson"] for e in entries),
            "withTestedAnimation": sum(e["animation"] for e in entries),
            "withAssessment": sum(e["assessment"] and e["appliedAssessment"] for e in entries),
            "unverified": sum(1 for e in entries if e["lesson"] and e["verification"] != "human-verified"),
            "entries": entries,
        }
    return report


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("exams", nargs="*", default=EXAMS)
    ap.add_argument("--report-only", action="store_true")
    args = ap.parse_args()
    report = audit()
    (CUR / "coverage-report.json").write_text(json.dumps(report, indent=2) + "\n")
    for exam in args.exams:
        s = report["exams"].get(exam)
        if s:
            print(f"{exam:12} {s['complete']:3}/{s['total']:<3} complete | lessons {s['withLesson']:3} | "
                  f"tested animations {s['withTestedAnimation']:3} | assessed {s['withAssessment']:3} | "
                  f"awaiting human review {s['unverified']}")
    for e in report["errors"]:
        print("ERROR:", e, file=sys.stderr)
    if args.report_only:
        return 0
    if report["errors"]:
        return 2
    gaps = any(report["exams"][e]["complete"] < report["exams"][e]["total"] for e in args.exams if e in report["exams"])
    if gaps:
        print("Coverage incomplete: see curriculum/coverage-report.json", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

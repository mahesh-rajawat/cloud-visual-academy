"""Compact authoring helpers that emit curriculum JSON (lessons, questions, animation manifest).

Content modules in scripts/content/*.py call these helpers; run
    python scripts/content/build_all.py
to regenerate curriculum/<exam>/lessons/*.json, merge questions into curriculum/<exam>/questions.json
(by id) and register animations in curriculum/animations.json. Hand-written JSON lessons that are not
produced by a content module are left untouched.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CUR = ROOT / "curriculum"
REVIEWED_ON = "2026-11-18"
VERIFY_NOTE = "Drafted by AI and checked against the linked official documentation. Not yet reviewed by a human subject-matter expert."

_lessons: list[dict] = []
_questions: list[dict] = []
_animations: list[dict] = []


def lesson(*, id, exam, title, objectives, minutes, objective, prereqs, foundation, engineer, anim, diagram, example,
           config, lab, troubleshooting, comparisons, misconceptions, decisions, docs, note="", walkthrough=None):
    nodes, edges = diagram
    cfg = dict(prerequisites=config["prerequisites"], permissions=config["permissions"], limits=config["limits"],
               portal=config["portal"], cli=config["cli"], powershell=config["powershell"])
    if config.get("bicep"):
        cfg["bicep"] = config["bicep"]
    if config.get("python"):
        cfg["python"] = config["python"]
    _lessons.append({
        "id": id, "exam": exam, "title": title, "objectiveIds": objectives, "estimatedMinutes": minutes,
        "learningObjective": objective,
        "prerequisites": [{k: v for k, v in (("text", p[0]), ("objectiveId", p[1] if len(p) > 1 else None), ("lessonId", p[2] if len(p) > 2 else None)) if v} for p in [x if isinstance(x, tuple) else (x,) for x in prereqs]],
        "foundation": foundation, "engineer": engineer,
        "animation": {"id": anim[0], "caption": anim[1]},
        "diagram": {"nodes": [{"id": n[0], "label": n[1], "x": n[2], "y": n[3], "kind": n[4]} for n in nodes],
                    "edges": [{"from": e[0], "to": e[1], **({"label": e[2]} if len(e) > 2 else {})} for e in edges]},
        "example": {"title": example[0], "body": example[1]},
        "configuration": cfg,
        "lab": None if lab is None else {
            "type": lab["type"], "simulationId": anim[0], "objective": lab["objective"], "duration": lab.get("duration", 15),
            "steps": lab["steps"], "expected": lab["expected"],
            "validation": [{"id": v[0], "text": v[1]} for v in lab["validation"]],
            "failureScenarios": lab["failures"], "cleanup": lab.get("cleanup", ["Simulation only: use Reset."]),
            "cost": lab.get("cost", "None. The simulation runs entirely in the browser."),
        },
        "troubleshooting": [{"symptom": t[0], "cause": t[1], "fix": t[2]} for t in troubleshooting],
        "comparisons": [{"service": c[0], "difference": c[1]} for c in comparisons],
        "misconceptions": [{"myth": m[0], "reality": m[1]} for m in misconceptions],
        "architectureDecisions": decisions,
        "docs": [{"title": d[0], "url": d[1]} for d in docs],
        "verification": {"status": "self-reviewed", "reviewedOn": REVIEWED_ON, "notes": VERIFY_NOTE + (" " + note if note else "")},
        **({"walkthrough": walkthrough} if walkthrough else {}),
    })


def q(id, exam, obj, diff, typ, mode, stem, *rest):
    """q(id, exam, objectiveId, difficulty, type, answerMode, stem, [code], options, correct, explanation, docs[, pairs])"""
    code = None
    if isinstance(rest[0], str):
        code, rest = rest[0], rest[1:]
    opts, correct, expl, docs = rest[:4]
    pairs = rest[4] if len(rest) > 4 else None
    d = {"id": id, "exam": exam, "objectiveId": obj, "difficulty": diff, "type": typ, "answerMode": mode, "stem": stem,
         "options": [{"id": o[0], "text": o[1], **({"explanation": o[2]} if len(o) > 2 else {})} for o in opts],
         "correct": correct, "explanation": expl, "docs": docs}
    if code:
        d["code"] = code
    if pairs:
        d["pairs"] = [{"left": p[0], "answer": p[1]} for p in pairs]
    _questions.append(d)


def animation(id, title, exam, objectives, fidelity, test_file, description):
    _animations.append({"id": id, "title": title, "exam": exam, "objectiveIds": objectives, "fidelity": fidelity,
                        "testFile": test_file, "description": description})


def flush() -> dict:
    counts = {"lessons": 0, "questions": 0, "animations": 0}
    for l in _lessons:
        path = CUR / l["exam"] / "lessons" / f"{l['id']}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(l, indent=2, ensure_ascii=False) + "\n")
        counts["lessons"] += 1
    by_exam: dict[str, list[dict]] = {}
    for qq in _questions:
        by_exam.setdefault(qq["exam"], []).append(qq)
    for exam, new in by_exam.items():
        path = CUR / exam / "questions.json"
        existing = json.loads(path.read_text()) if path.exists() else []
        index = {x["id"]: i for i, x in enumerate(existing)}
        for qq in new:
            if qq["id"] in index:
                existing[index[qq["id"]]] = qq
            else:
                existing.append(qq)
        path.write_text(json.dumps(existing, indent=2, ensure_ascii=False) + "\n")
        counts["questions"] += len(new)
    mpath = CUR / "animations.json"
    manifest = json.loads(mpath.read_text())
    mindex = {a["id"]: i for i, a in enumerate(manifest)}
    for a in _animations:
        if a["id"] in mindex:
            manifest[mindex[a["id"]]] = a
        else:
            manifest.append(a)
    mpath.write_text(json.dumps(manifest, indent=2) + "\n")
    counts["animations"] = len(_animations)
    _lessons.clear(); _questions.clear(); _animations.clear()
    return counts

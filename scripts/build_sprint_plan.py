#!/usr/bin/env python3
"""Lay out curriculum/<exam>/sprint-plan.json so every day fits the default study time.

Usage: python scripts/build_sprint_plan.py [az-104|az-305]

Objectives keep the curated teaching order of the existing plan (or the official outline order for a
new plan), grouped by lesson. Every week but the last teaches objectives, with a weekly check on
days 7, 14, ...; the last week is mock exams and revision only. Packing uses the weekday budget for
every day, so the plan fits whichever weekday it starts on.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXAM = sys.argv[1] if len(sys.argv) > 1 else "az-104"
PLAN = ROOT / f"curriculum/{EXAM}/sprint-plan.json"
WEEKDAY_MIN = 105  # 1.75 h default

# New plans start from this template. AZ-305 design skills get 40 minutes: lesson, design trainer and questions.
NEW = {
    "az-305": {"exam": "az-305", "weeks": 5,
               "activityMinutes": {"weekly-assessment": 40, "mock-exam": 100, "weak-revision": 45, "readiness-report": 15, "exam-day-prep": 30},
               "objectiveMinutes": {"handsOn": 45, "conceptual": 40}, "struggleMultiplier": 1.5, "dailyRecallMinutes": 10, "days": []},
}
plan = json.loads(PLAN.read_text()) if PLAN.exists() else NEW[EXAM]
reg = json.loads((ROOT / f"curriculum/{EXAM}/objectives.json").read_text())
hands_on = {o["id"]: o["handsOn"] for d in reg["domains"] for s in d["skills"] for o in s["objectives"] if o["status"] == "active"}
lesson_of = {}
for f in sorted((ROOT / f"curriculum/{EXAM}/lessons").glob("*.json")):
    l = json.loads(f.read_text())
    for oid in l["objectiveIds"]:
        lesson_of.setdefault(oid, l["title"])

# Curated order from the current plan, plus any active objective it does not list yet.
order = [s for d in plan["days"] for s in d["skills"] if s in hands_on]
order = list(dict.fromkeys(order)) or list(hands_on)  # a new plan follows the outline
# Keep each lesson's objectives together, lessons in order of first appearance.
lesson_rank = {}
for oid in order:
    lesson_rank.setdefault(lesson_of[oid], len(lesson_rank))
order.sort(key=lambda oid: lesson_rank[lesson_of[oid]])  # stable: keeps order inside a lesson
missing = [o for o in hands_on if o not in order]
assert not missing, f"add these to a day in sprint-plan.json first: {missing}"

act = plan["activityMinutes"]
mins = lambda oid: plan["objectiveMinutes"]["handsOn" if hands_on[oid] else "conceptual"]
recall = plan["dailyRecallMinutes"]

WEEKS = plan["weeks"]
LEARN_DAYS = (WEEKS - 1) * 7
days = []
queue = list(order)
for day in range(1, LEARN_DAYS + 1):
    activities = ["diagnostic"] if day == 1 and "diagnostic" in act else ["weekly-assessment"] if day % 7 == 0 else []
    room = WEEKDAY_MIN - recall - sum(act[a] for a in activities)
    skills = []
    while queue and mins(queue[0]) <= room:
        room -= mins(queue[0])
        skills.append(queue.pop(0))
    days.append({"day": day, "skills": skills, "activities": activities})
assert not queue, f"{len(queue)} objectives do not fit in {WEEKS - 1} weeks"

# Spare learning days at the end of week 7: drills on the areas learners mix up most, plus weak areas.
DRILLS = ["drill-deploy", "drill-network", "drill-lookalikes"] if EXAM == "az-104" else []
spare = [d for d in days if not d["skills"] and not d["activities"]]
for i, d in enumerate(spare):
    d["activities"] = ([DRILLS[i]] if i < len(DRILLS) else []) + ["weak-revision"]
for a in DRILLS:
    act.setdefault(a, 45)

def title(d):
    names = list(dict.fromkeys(lesson_of[s] for s in d["skills"]))
    base = " + ".join(names)
    if "diagnostic" in d["activities"]:
        return f"Diagnostic test, then {base}" if base else "Diagnostic test"
    if "weekly-assessment" in d["activities"]:
        week = d["day"] // 7
        return f"{base}, week {week} check" if base else f"Week {week} check"
    if "drill-deploy" in d["activities"]:
        return "Clear the confusion: templates and CLI, then weak areas"
    if "drill-network" in d["activities"]:
        return "Clear the confusion: networking, then weak areas"
    if "drill-lookalikes" in d["activities"]:
        return "Clear the confusion: look-alike services drill, then weak areas"
    if "weak-revision" in d["activities"]:
        return "Catch-up: weak areas and their labs"
    return base

for d in days:
    d["title"] = title(d)

final = [
    ("Mock exam 1 and review every mistake", ["mock-exam"]),
    ("Weak areas: redo their labs", ["weak-revision"]),
    ("Weak areas: practice questions by topic", ["weak-revision"]),
    ("Mock exam 2 and review every mistake", ["mock-exam"]),
    ("Weak areas: redo their labs", ["weak-revision"]),
    ("Mock exam 3 and review every mistake", ["mock-exam"]),
    ("Readiness check, exam-day guide, light review" if EXAM == "az-104" else "Readiness check and light review", ["readiness-report", "exam-day-prep"]),
]
for i, (t, a) in enumerate(final):
    days.append({"day": LEARN_DAYS + 1 + i, "title": t, "skills": [], "activities": a})

plan["days"] = [{"day": d["day"], "title": d["title"], "skills": d["skills"], "activities": d["activities"]} for d in days]
PLAN.write_text(json.dumps(plan, indent=1, ensure_ascii=False) + "\n")
last = max(d["day"] for d in days if d["skills"])
print(f"{len(days)} days, {len(order)} objectives, new topics finish on day {last}")

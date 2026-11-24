"""Adds the easy walkthrough and the real-portal hands-on lab to every AZ-104 lesson.

Runs last in build_all.py (hence the zz_ prefix), after the modules that write lesson JSON, and patches both
generated and hand-written lesson files. Content lives in _az104_d*.py.
"""
import json

from builder import CUR

import _az104_d1
import _az104_d2
import _az104_d3
import _az104_d4
import _az104_d5

WALK: dict[str, dict] = {}
LAB: dict[str, dict] = {}
PATCH: dict[str, list[str]] = {}
for mod in (_az104_d1, _az104_d2, _az104_d3, _az104_d4, _az104_d5):
    WALK.update(mod.WALK)
    LAB.update(mod.LAB)
    PATCH.update(getattr(mod, "PATCH", {}))

for path in sorted((CUR / "az-104" / "lessons").glob("*.json")):
    lesson = json.loads(path.read_text())
    lid = lesson["id"]
    if lid in WALK:
        lesson["walkthrough"] = WALK[lid]
    if lid in LAB:
        lesson["handsOn"] = LAB[lid]
    for extra in PATCH.get(lid, []):  # facts that changed after the lesson was written
        if extra not in lesson["engineer"]:
            lesson["engineer"].append(extra)
    path.write_text(json.dumps(lesson, indent=2, ensure_ascii=False) + "\n")

missing = sorted(p.stem for p in (CUR / "az-104" / "lessons").glob("*.json") if p.stem not in WALK or p.stem not in LAB)
assert not missing, f"AZ-104 lessons without a walkthrough or lab: {missing}"
assert not (set(WALK) | set(LAB)) - {p.stem for p in (CUR / "az-104" / "lessons").glob("*.json")}, "content for an unknown lesson id"
print(f"zz_az104_overlay: {len(WALK)} walkthroughs, {len(LAB)} labs")

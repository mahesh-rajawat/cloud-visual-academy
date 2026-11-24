"""Adds the real-Azure hands-on labs (from _az305_labs.py) to the AZ-305 lessons that have one.

Runs after the az305_* modules (zz_ prefix sorts last). Walkthroughs are written by the lesson modules themselves.
"""
import json

from builder import CUR

from _az305_labs import LAB

ids = {p.stem for p in (CUR / "az-305" / "lessons").glob("*.json")}
assert set(LAB) <= ids, f"labs for unknown lessons: {set(LAB) - ids}"
for lid, lab in LAB.items():
    path = CUR / "az-305" / "lessons" / f"{lid}.json"
    lesson = json.loads(path.read_text())
    lesson["handsOn"] = lab
    path.write_text(json.dumps(lesson, indent=2, ensure_ascii=False) + "\n")
print(f"zz_az305_overlay: {len(LAB)} hands-on labs")

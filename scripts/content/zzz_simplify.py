"""Swaps in plain-wording versions of lesson text (scripts/content/simple/<exam>/<lesson>.json).

Runs after every other module (zzz_ prefix). Each simple file replaces whole fields and records a hash of the text it was
written from ("from"). If the source text changes later, the build fails so the plain version is rewritten, not lost.
Refresh hashes and see what to rewrite with scripts/simplify_tool.py.
"""
import json

from _simple import FIELDS, SIMPLE, digest, get, patches, put
from builder import CUR

stale: list[str] = []
applied = 0
for path in sorted(SIMPLE.glob("*/*.json")):
    simple = json.loads(path.read_text())
    target = CUR / path.parent.name / "lessons" / path.name
    assert target.exists(), f"{path}: no lesson {target.name}"
    lesson = json.loads(target.read_text())
    for field, value in simple.items():
        if field in ("from", "absorbs"):
            continue
        assert field in FIELDS, f"{path}: unknown field {field}"
        current = get(lesson, field)
        if field == "engineer" and current[:len(value)] == value:
            # A hand-written lesson already holds the plain text; drop late fixes the plain text already covers.
            extra = current[len(value):]
            if extra and all(digest(x) in simple.get("absorbs", []) for x in extra):
                put(lesson, field, value)
                current = value
        if current == value:
            continue  # already plain (hand-written lesson files keep the swapped text)
        if digest(current) != simple.get("from", {}).get(field):
            stale.append(f"{path.parent.name}/{path.stem} {field}")
            continue
        put(lesson, field, value)
        applied += 1
    target.write_text(json.dumps(lesson, indent=2, ensure_ascii=False) + "\n")

assert not stale, "Source text changed after it was simplified; rewrite these (scripts/simplify_tool.py show):\n" + "\n".join(stale)
print(f"zzz_simplify: {applied} fields swapped for plain wording")

#!/usr/bin/env python3
"""Helper for the plain-wording swaps in scripts/content/simple/ (applied by scripts/content/zzz_simplify.py).

  simplify_tool.py show <exam> <lesson-id>...   print the text to rewrite, as it is in the lesson now
  simplify_tool.py stamp <exam> <lesson-id>...  record which source text each simple file was written from
  simplify_tool.py missing <exam>               list lessons without a simple file

Write simple/<exam>/<lesson>.json with only the rewritten fields, run stamp before the next build, then build.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "content"))
from builder import CUR  # noqa: E402
from _simple import FIELDS, SIMPLE, digest, get, patches  # noqa: E402


def show(exam: str, lid: str) -> None:
    lesson = json.loads((CUR / exam / "lessons" / f"{lid}.json").read_text())
    print(f"=== {lid}")
    print(json.dumps({f: get(lesson, f) for f in FIELDS if f != "foundation" and get(lesson, f) is not None}, ensure_ascii=False, indent=1))


def stamp(exam: str, lid: str) -> None:
    path = SIMPLE / exam / f"{lid}.json"
    simple = json.loads(path.read_text())
    lesson = json.loads((CUR / exam / "lessons" / f"{lid}.json").read_text())
    old = simple.get("from", {})
    frm = {}
    for field, value in simple.items():
        if field in ("from", "absorbs"):
            continue
        current = get(lesson, field)
        frm[field] = old[field] if current == value and field in old else digest(current)
    simple["from"] = frm
    covered = [digest(x) for x in patches(lid) if x in (get(lesson, "engineer") or [])]
    if "engineer" in simple and covered:
        simple["absorbs"] = sorted(set(simple.get("absorbs", [])) | set(covered))  # late fixes the plain text includes
    path.write_text(json.dumps(simple, indent=2, ensure_ascii=False) + "\n")
    print(f"stamped {lid}: {', '.join(frm)}")


if __name__ == "__main__":
    cmd, exam, *ids = sys.argv[1:]
    if cmd == "missing":
        have = {p.stem for p in (SIMPLE / exam).glob("*.json")}
        print("\n".join(sorted(p.stem for p in (CUR / exam / "lessons").glob("*.json") if p.stem not in have)))
    for lid in ids:
        {"show": show, "stamp": stamp}[cmd](exam, lid)

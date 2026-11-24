#!/usr/bin/env python3
"""Check that every documentation link in lessons, labs and questions still opens.

Usage: python scripts/check_doc_links.py [exam ...]   (default: az-104 az-305)

Requests are paced and retried on HTTP 429 so Microsoft Learn's rate limit isn't mistaken for a broken link.
Exit code 1 if any link returns 404/410 or never succeeds.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUR = ROOT / "curriculum"


def links(exam: str) -> set[str]:
    out: set[str] = set()
    for f in (CUR / exam / "lessons").glob("*.json"):
        lesson = json.loads(f.read_text())
        out |= {d["url"] for d in lesson.get("docs", [])}
        out |= {s["url"] for s in (lesson.get("handsOn") or {}).get("screens", [])}
        out |= {u for st in (lesson.get("walkthrough") or {}).get("steps", []) for u in st.get("links", [])}
    for q in json.loads((CUR / exam / "questions.json").read_text()):
        out |= set(q.get("docs", []))
    return {u for u in out if u.startswith("http")}


def status(url: str) -> int:
    req = urllib.request.Request(url, headers={"User-Agent": "cloud-visual-academy-link-check/1.0"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(min(60, 5 * 2 ** attempt))
                continue
            return e.code
        except Exception:
            time.sleep(3)
    return 0


def main(exams: list[str]) -> int:
    bad = []
    urls = sorted({u for e in exams for u in links(e)})
    for i, u in enumerate(urls, 1):
        code = status(u)
        if code != 200:
            bad.append((code, u))
            print(f"[{i}/{len(urls)}] {code} {u}", flush=True)
        time.sleep(0.5)
    print(f"Checked {len(urls)} links for {', '.join(exams)}: {len(bad)} problem(s).")
    for code, u in bad:
        print(f"  {code} {u}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or ["az-104", "az-305"]))

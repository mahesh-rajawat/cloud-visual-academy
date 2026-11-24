#!/usr/bin/env python3
"""Fetch the official exam outlines and rebuild curriculum/<exam>/objectives.json.

Sources:
  * Microsoft Learn study guides (AZ-900, AZ-104, AI-901) requested as Markdown.
  * AWS CLF-C02 exam guide HTML pages (domains, in-scope services, revisions).

Objective IDs are stable: when an objective's normalized text matches an objective
already in the registry, its existing ID is kept. New objectives get new IDs and
objectives that disappeared from the official page are kept with status "retired".
A change report is written to curriculum/<exam>/sync-report.json.

Usage:
  python scripts/sync_exam_objectives.py            # all exams
  python scripts/sync_exam_objectives.py az-104     # one exam
  python scripts/sync_exam_objectives.py --offline DIR  # parse previously saved pages
"""
from __future__ import annotations

import datetime as dt
import hashlib
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CURRICULUM = ROOT / "curriculum"

MS_EXAMS = {
    "az-900": ("AZ-900", "https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-900"),
    "az-104": ("AZ-104", "https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-104"),
    "ai-901": ("AI-901", "https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-901"),
    "az-305": ("AZ-305", "https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-305"),
}
AWS_BASE = "https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02"
AWS_DOMAIN_PAGES = [f"cloud-practitioner-02-domain{i}" for i in range(1, 5)]

# Verbs that indicate an objective needs a hands-on lab or accurate simulation.
HANDS_ON_VERBS = ("create", "configure", "deploy", "implement", "perform", "provision", "build",
                  "modify", "move", "manage", "map", "set up", "use", "query", "troubleshoot",
                  "export", "apply", "assign", "evaluate", "respond", "extract", "interpret visual")


def fetch(url: str, accept: str = "text/html") -> str:
    req = urllib.request.Request(url, headers={"Accept": accept, "User-Agent": "cloud-visual-academy-sync/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def fingerprint(text: str) -> str:
    norm = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
    return hashlib.sha1(norm.encode()).hexdigest()[:12]


def is_hands_on(text: str) -> bool:
    t = text.lower()
    return any(t.startswith(v) for v in HANDS_ON_VERBS)


# ---------------------------------------------------------------- Microsoft
def parse_ms_markdown(md: str) -> dict:
    md = md.replace("\r\n", "\n")
    m = re.search(r"^## Skills measured as of (.+)$", md, re.M)
    if not m:
        raise ValueError("Could not find 'Skills measured as of' section")
    as_of = m.group(1).strip()
    start = m.end()
    nxt = re.search(r"^## ", md[start:], re.M)
    section = md[start: start + nxt.start()] if nxt else md[start:]
    title_m = re.search(r"^# Study guide for Exam ([A-Z0-9-]+): (.+?)(?: \|.*)?$", md, re.M)

    domains: list[dict] = []
    domain = skill = None
    for line in section.split("\n"):
        line = line.rstrip()
        if line.startswith("### "):
            heading = line[4:].strip()
            wm = re.match(r"(.+?)\s*\((\d+)\s*[–-]\s*(\d+)%\)", heading)
            if not wm:  # "Audience profile", "Skills at a glance"
                domain = skill = None
                continue
            domain = {"name": wm.group(1).strip(), "weight": f"{wm.group(2)}–{wm.group(3)}%", "skills": []}
            domains.append(domain)
            skill = None
        elif line.startswith("#### ") and domain is not None:
            skill = {"name": line[5:].strip(), "objectives": []}
            domain["skills"].append(skill)
        elif line.startswith("- ") and skill is not None:
            skill["objectives"].append(line[2:].strip())
    return {
        "examTitle": title_m.group(2).strip() if title_m else None,
        "skillsMeasuredAsOf": as_of,
        "domains": domains,
    }


# ---------------------------------------------------------------- AWS
def html_to_lines(page: str) -> list[str]:
    m = re.search(r'<div id="main-col-body">(.*)', page, re.S)
    body = m.group(1) if m else page
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", body, flags=re.S)
    body = re.sub(r"<li[^>]*>", "\n- ", body)
    body = re.sub(r"<(h\d|p|tr|br|div)[^>]*>", "\n", body)
    text = html.unescape(re.sub(r"<[^>]+>", "", body))
    lines = []
    pending_bullet = False
    for raw in text.split("\n"):
        s = re.sub(r"\s+", " ", raw).strip()
        if not s:
            continue
        if s == "-":
            pending_bullet = True
            continue
        if pending_bullet and not s.startswith("- "):
            s = "- " + s
        pending_bullet = False
        lines.append(s)
    return lines


def parse_aws_domain(lines: list[str]) -> dict:
    head = next(l for l in lines if l.startswith("Content Domain"))
    name = head.split(":", 1)[1].strip()
    weight_m = next((re.search(r"represents (\d+)%", l) for l in lines if "represents" in l), None)
    tasks: dict[str, dict] = {}
    current = None
    mode = None
    for l in lines:
        # "- Task Statement x.y" bullets form the task index; the plain heading opens its details.
        tm = re.match(r"(- )?Task Statement (\d+\.\d+): (.+)", l)
        if tm:
            num = tm.group(2)
            task = tasks.setdefault(num, {"number": num, "name": tm.group(3).strip(), "knowledge": [], "skills": []})
            current = None if tm.group(1) else task
            mode = None
            continue
        if l.startswith("Knowledge of"):
            mode = "knowledge"
        elif l.startswith("Skills in"):
            mode = "skills"
        elif l.startswith("- ") and current is not None and mode:
            current[mode].append(l[2:].strip())
    return {"name": name, "weight": f"{weight_m.group(1)}%" if weight_m else None, "tasks": list(tasks.values())}


def parse_aws_services(lines: list[str]) -> dict[str, list[str]]:
    cats: dict[str, list[str]] = {}
    topics_done = False
    current = None
    started = False
    for l in lines:
        if l == "Topics":
            started = True
            continue
        if not started:
            continue
        if l.startswith("- ") and not topics_done:
            cats[l[2:]] = []
            continue
        if not l.startswith("- "):
            topics_done = True
            current = l if l in cats else None
            continue
        if current:
            cats[current].append(l[2:])
    return cats


def parse_aws_revisions(lines: list[str]) -> list[dict]:
    out = []
    for i, l in enumerate(lines):
        if re.fullmatch(r"\d+\.\d+", l) and i + 1 < len(lines):
            out.append({"version": l, "publicationDate": lines[i + 1]})
    return out


# ---------------------------------------------------------------- registry
def build_ms_registry(code: str, url: str, parsed: dict) -> dict:
    prefix = code.replace("-", "")
    domains = []
    for di, d in enumerate(parsed["domains"], 1):
        skills = []
        for si, s in enumerate(d["skills"], 1):
            objs = [{
                "id": f"{prefix}-{di}.{si}.{oi}",
                "text": t,
                "fingerprint": fingerprint(t),
                "handsOn": is_hands_on(t),
                "status": "active",
            } for oi, t in enumerate(s["objectives"], 1)]
            skills.append({"id": f"{prefix}-{di}.{si}", "name": s["name"], "objectives": objs})
        domains.append({"id": f"{prefix}-{di}", "name": d["name"], "weight": d["weight"], "skills": skills})
    return {
        "examCode": code,
        "examName": parsed["examTitle"],
        "vendor": "Microsoft",
        "sourceUrl": url,
        "skillsMeasuredAsOf": parsed["skillsMeasuredAsOf"],
        "domains": domains,
    }


def build_aws_registry(domains: list[dict], services: dict, revisions: list[dict]) -> dict:
    out_domains = []
    for di, d in enumerate(domains, 1):
        skills = []
        for t in d["tasks"]:
            objs = []
            for kind, items in (("knowledge", t["knowledge"]), ("skill", t["skills"])):
                for text in items:
                    n = len(objs) + 1
                    objs.append({
                        "id": f"CLFC02-{t['number']}.{n}",
                        "text": text,
                        "kind": kind,
                        "fingerprint": fingerprint(t["number"] + text),
                        "handsOn": False,  # CLF-C02 is conceptual; labs are optional deep dives
                        "status": "active",
                    })
            skills.append({"id": f"CLFC02-{t['number']}", "name": t["name"], "objectives": objs})
        out_domains.append({"id": f"CLFC02-{di}", "name": d["name"], "weight": d["weight"], "skills": skills})
    return {
        "examCode": "CLF-C02",
        "examName": "AWS Certified Cloud Practitioner",
        "vendor": "AWS",
        "sourceUrl": AWS_BASE + "/cloud-practitioner-02.html",
        "skillsMeasuredAsOf": revisions[-1]["publicationDate"] if revisions else None,
        "guideVersion": revisions[-1]["version"] if revisions else None,
        "revisionHistory": revisions,
        "inScopeServices": services,
        "domains": out_domains,
    }


def all_objectives(reg: dict):
    for d in reg.get("domains", []):
        for s in d["skills"]:
            for o in s["objectives"]:
                yield o


def reconcile(new: dict, old: dict | None) -> dict:
    """Keep IDs stable across syncs and record additions / removals / changes."""
    report = {"added": [], "retired": [], "renumbered": [], "unchanged": 0}
    if not old:
        report["added"] = [o["id"] for o in all_objectives(new)]
        return report
    old_by_fp = {o["fingerprint"]: o for o in all_objectives(old) if o.get("status") == "active"}
    old_ids = {o["id"] for o in all_objectives(old)}
    seen_fp = set()
    for o in all_objectives(new):
        prev = old_by_fp.get(o["fingerprint"])
        if prev:
            seen_fp.add(o["fingerprint"])
            if prev["id"] != o["id"]:
                report["renumbered"].append({"from": o["id"], "keptAs": prev["id"]})
                o["id"] = prev["id"]
            else:
                report["unchanged"] += 1
        else:
            if o["id"] in old_ids:  # position reused by different text -> give a new id
                o["id"] = o["id"] + "-r" + dt.date.today().strftime("%Y%m%d")
            report["added"].append(o["id"])
    retired = [o for fp, o in old_by_fp.items() if fp not in seen_fp]
    if retired and new["domains"]:
        bucket = {"id": new["domains"][0]["id"].split("-")[0] + "-RETIRED", "name": "Retired objectives",
                  "objectives": []}
        for o in retired:
            o = dict(o, status="retired")
            bucket["objectives"].append(o)
            report["retired"].append(o["id"])
        new.setdefault("retiredObjectives", bucket["objectives"])
    return report


def write_registry(slug: str, reg: dict) -> None:
    folder = CURRICULUM / slug
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "objectives.json"
    old = json.loads(path.read_text()) if path.exists() else None
    report = reconcile(reg, old)
    reg["retrievedAt"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    reg["objectiveCount"] = sum(1 for o in all_objectives(reg) if o["status"] == "active")
    path.write_text(json.dumps(reg, indent=2, ensure_ascii=False) + "\n")
    (folder / "sync-report.json").write_text(json.dumps(
        {"syncedAt": reg["retrievedAt"], "sourceUrl": reg["sourceUrl"],
         "skillsMeasuredAsOf": reg["skillsMeasuredAsOf"], **report}, indent=2) + "\n")
    print(f"{reg['examCode']}: {reg['objectiveCount']} objectives "
          f"(+{len(report['added'])} added, {len(report['retired'])} retired) as of {reg['skillsMeasuredAsOf']}")


def sync_ms(slug: str, offline: Path | None) -> None:
    code, url = MS_EXAMS[slug]
    md = (offline / f"{slug}.md").read_text() if offline else fetch(url, "text/markdown")
    parsed = parse_ms_markdown(md)
    if not parsed["domains"]:
        raise SystemExit(f"{code}: no domains parsed - refusing to overwrite registry")
    write_registry(slug, build_ms_registry(code, url, parsed))


def sync_aws(offline: Path | None) -> None:
    def page(name: str) -> list[str]:
        raw = (offline / f"{name}.html").read_text() if offline else fetch(f"{AWS_BASE}/{name}.html")
        return html_to_lines(raw)
    domains = [parse_aws_domain(page(p)) for p in AWS_DOMAIN_PAGES]
    services = parse_aws_services(page("clf-02-in-scope-services"))
    revisions = parse_aws_revisions(page("clf-02-revisions"))
    if not all(d["tasks"] for d in domains):
        raise SystemExit("CLF-C02: a domain parsed with no task statements - refusing to overwrite registry")
    write_registry("aws-clf-c02", build_aws_registry(domains, services, revisions))


def main(argv: list[str]) -> None:
    offline = None
    if "--offline" in argv:
        i = argv.index("--offline")
        offline = Path(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    targets = argv or [*MS_EXAMS, "aws-clf-c02"]
    for t in targets:
        if t in MS_EXAMS:
            sync_ms(t, offline)
        elif t == "aws-clf-c02":
            sync_aws(offline)
        else:
            raise SystemExit(f"unknown exam {t}")


if __name__ == "__main__":
    main(sys.argv[1:])

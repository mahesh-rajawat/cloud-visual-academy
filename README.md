# Cloud Visual Academy

A local-first learning platform for **AZ-900, AZ-104, AI-901 and AWS CLF-C02**, built around
interactive 2D simulations of real cloud behaviour. It currently prioritises a 7-week AZ-104 study plan (about 1¾ h on weekdays, 2 h at weekends).

## Run it locally

Requirements: Python 3.11+, Node 20+. Nothing paid, no cloud account needed.

```bash
cd backend
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api to :8000)
```

Optional: `docker compose up --build`, then open http://localhost:4173. This path has not been tested yet.

## Tests and audits

```bash
cd backend && .venv/bin/python -m pytest          # API, mastery, spaced repetition
cd frontend && npm test                           # simulation models, planner, exam engine, components
cd frontend && npm run test:e2e                   # Playwright, isolated DB on :8011
python3 scripts/validate_coverage.py              # exits 1 until every objective has content
python3 scripts/sync_exam_objectives.py           # re-fetch official outlines, keep IDs stable
```

If Playwright's own browser is not installed, run `npx playwright install chromium`, or set
`PW_CHROMIUM_PATH` to an existing Chromium binary.

## Status (2026-11-23)

**Verified official outlines** (fetched 2026-11-18; see each course page for source URL and date):

| Exam | Skills measured as of | Domains | Objectives |
|---|---|---|---|
| AZ-900 | July 20, 2026 | 3 | 57 |
| AZ-104 | October 26, 2023 (page updated Nov 2026, no newer outline) | 5 | 81 |
| AI-901 | April 15, 2026 | 2 | 29 |
| CLF-C02 | guide v1.3, October 29, 2026 | 4 | 135 (+111 in-scope services) |

**Content coverage** (from `validate_coverage.py`, which now exits 0): every official objective has a
lesson, a tested animation, at least two original questions (one or more applied), a lab where the
objective is hands-on, and official documentation links.

| Exam | Objectives complete | Lessons | Questions | Notes |
|---|---|---|---|---|
| AZ-104 | **81 / 81** | 47 | 369 | All five domains. Every lesson opens in an easy **lite walkthrough** plus the simulator and a **real-Azure hands-on lab** (plain-language steps, what you should see, cost level, clean-up, links to Microsoft Learn pages with portal screenshots, and space for your own screenshots, saved locally). Content: `scripts/content/_az104_d*.py` (walkthroughs, labs, fact updates) and `_az104_q*.py` (162 extra exam-style questions), applied by `zz_az104_overlay.py` and `az104_examq.py`. A 49-day plan and an exam-day guide (`/exam-guide`) complete the track |
| AZ-900 | **57 / 57** | 25 | 254 | One focused lesson per 1–4 objectives, each with its own animation group; 12 of the questions form the short foundations diagnostic |
| AI-901 | **29 / 29** | 19 | 124 | One focused lesson per 1–3 objectives, each with its own animation group. Written for Microsoft Foundry and Foundry Tools; no AI-900 material reused; Python samples use azure-ai-projects 2.x and the Responses API |
| CLF-C02 | **135 / 135** | 19 | 270 | Includes in-scope services. Every lesson opens in a **lite walkthrough** (7–8 steps: problem → techniques → case → recap, with a diagram that builds up step by step); "Full lesson" switches to the lab, configuration and troubleshooting view. Walkthrough content: `scripts/content/_aws_walk*.py` |

All lessons are AI-drafted and checked against the linked Microsoft Learn / AWS documentation pages.
None is human-verified yet ("awaiting human review" in the coverage audit).

**Working features:** dashboard with four tracks, lesson player (curriculum tree, animation,
Foundation and Engineer depth, React Flow diagram, lab/configure/troubleshoot/questions tabs;
configuration in Portal, Azure CLI, PowerShell, Bicep and, for AI-901, Python), 69 tested animations
(11 bespoke simulations plus scenario labs for compute, networking, monitoring, backup, AZ-900, AWS and
AI-901, including a small working KQL evaluator), AZ-900 diagnostic (12 questions) that recommends
AZ-104 lessons, practice engine (topic, domain, timed mock, adaptive weak-area, mistakes, bookmarks;
single, multiple, ordering and matching answers), spaced-repetition daily recall, adaptive 7-week AZ-104
sprint with unrealistic-schedule warnings, coverage audit, analytics/readiness, Azure↔AWS comparison
table, search, bookmarks, settings, dark/light theme.

**Known limitations**
* Question banks are original but still smaller than real exam pools, so mock exams draw from a limited set.
* AZ-104 real-Azure labs are instructions you follow in your own subscription; the app never runs them. Other labs are simulated (type A) or guided configuration (type B). Real-cloud (type C) labs for other tracks are not
  published, and the platform never creates Azure or AWS resources. Commands shown in lessons are
  billable if you run them yourself.
* Scenario simulations model documented behaviour; the AI-901 token-sampling view is a conceptual illustration.
* No side-by-side Azure/AWS animations yet. The comparison page is a table.
* Docker Compose files are written but untested.
* The frontend bundle is one large chunk; route-level code splitting is a to-do.

Practice scores measure performance on this platform's original questions only. They do not
guarantee an official exam result, and published objectives cannot cover every exam question.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design.

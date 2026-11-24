"""Shared helpers for the AZ-305 lesson modules (az305_d1.py … az305_d4.py).

AZ-305 tests design decisions ("recommend a solution"), so every lesson pairs an easy walkthrough with a
design trainer in frontend/src/simulations/groups/az305.ts. Facts checked against Microsoft Learn
(Azure Architecture Center, Well-Architected Framework, service docs) in November 2026.
"""
from _walkkit import N, S, walk, width
from builder import animation, lesson, q

E = "az-305"
ML = "https://learn.microsoft.com/"
AAC = ML + "azure/architecture/"
GUIDE = ML + "credentials/certifications/resources/study-guides/az-305"
T = "frontend/src/simulations/groups/az305.test.ts"
_counts: dict[str, int] = {}

__all__ = ["E", "ML", "AAC", "GUIDE", "S", "anim", "cfg", "lab", "qa", "row", "L"]


def anim(id, title, objectives, desc):
    animation(id, title, E, objectives, "simplified-illustration", T, desc)


def cfg(portal, cli="", ps="", prereq=("An Azure subscription; most design reviews need only Reader access",),
        perms=("Reader to review existing resources; Contributor or Owner to build the design",), limits=()):
    return dict(prerequisites=list(prereq), permissions=list(perms), limits=list(limits) or ["Check service limits and regional availability for each component"],
                portal=list(portal), cli=cli, powershell=ps)


def lab(objective, trainers, steps, expected, failures, extra=()):
    """trainers = [(scenario id, what is chosen)] from the lesson's design-trainer group."""
    validation = [(f"{s}-correct", f"Chose the right {w}") for s, w in trainers] + list(extra)
    return dict(type="A", objective=objective, duration=15, steps=steps, expected=expected, validation=validation, failures=failures)


def qa(obj, diff, typ, stem, opts, correct, expl, doc, code=None):
    """opts = [(text, why)], correct = letters. Ids: az305-x-<objective>-<n>."""
    key = obj.split("-")[1]
    _counts[key] = _counts.get(key, 0) + 1
    L_ = "abcdefgh"
    mode = "ordering" if typ == "ordering" else "multiple" if len(correct) > 1 else "single"
    args = [f"az305-x-{key}-{_counts[key]}", E, obj, diff, typ, mode, stem]
    if code:
        args.append(code)
    q(*args, [(L_[i], o[0], o[1]) for i, o in enumerate(opts)], list(correct), expl, [doc])


ROW_Y = (75, 215, 360)


def row(r, *items):
    """Place one row of walkthrough nodes evenly across the 800 px canvas. items = (id, label, kind[, sub])."""
    nodes = [dict(id=i[0], label=i[1], kind=i[2], **({"sub": i[3]} if len(i) > 3 else {})) for i in items]
    total = sum(width(n) for n in nodes)
    gap = (800 - total) / (len(nodes) + 1)
    assert gap >= 10, f"row too wide: {[n['id'] for n in nodes]}"
    x, out = gap, []
    for n in nodes:
        w = width(n)
        out.append(N(n["id"], n["label"], round(x + w / 2), ROW_Y[r], n["kind"], n.get("sub")))
        x += w + gap
    return out


_KIND = {"database": "storage", "cost": "scope", "ai": "scope", "service": "scope", "globe": "network"}


def L(*, id, title, objectives, minutes, objective, prereqs, foundation, engineer, anim, example, config, lab,
      troubleshooting, comparisons, misconceptions, decisions, docs, walk_):
    """walk_ = (subtitle, learn, nodes, steps). The full-view diagram is drawn from the walkthrough's nodes and arrows."""
    w = walk(*walk_)
    edges = []
    for st in w["steps"]:
        for e in st["edges"]:
            t = (e["from"], e["to"], e.get("label")) if e.get("label") else (e["from"], e["to"])
            if t not in edges:
                edges.append(t)
    nodes = [(n["id"], n["label"], round(n["x"] * 1.05), round(n["y"] * 0.75), _KIND.get(n["kind"], n["kind"])) for n in w["nodes"]]
    lesson(id=id, exam=E, title=title, objectives=objectives, minutes=minutes, objective=objective, prereqs=prereqs,
           foundation=foundation, engineer=engineer, anim=anim, diagram=(nodes, edges), example=example, config=config, lab=lab,
           troubleshooting=troubleshooting, comparisons=comparisons, misconceptions=misconceptions, decisions=decisions,
           docs=list(docs) + [("AZ-305 study guide", GUIDE)], walkthrough=w)

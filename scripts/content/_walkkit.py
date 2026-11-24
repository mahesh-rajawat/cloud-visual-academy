"""Helpers for lite walkthroughs: N() places a node, S() describes a step, walk() builds and checks the walkthrough.

Canvas: 800 x 440; nodes are 150 x 54 boxes placed by their centre. A step adds nodes (`add`) and arrows (`edges`)
to what is already on screen; walk() works out what is visible at every step.
"""

KINDS = {"user", "compute", "network", "storage", "database", "security", "identity", "globe", "cost", "ai", "service"}
STEP_KINDS = {"problem", "concept", "technique", "case", "recap"}


def N(id, label, x, y, kind, sub=None):
    assert kind in KINDS, kind
    assert 75 <= x <= 725 and 27 <= y <= 413, (id, x, y)
    d = {"id": id, "label": label, "x": x, "y": y, "kind": kind}
    if sub:
        d["sub"] = sub
    return d


def S(kind, label, title, body, add=(), edges=(), focus=(), key=None, tip=None, warn=None, learn=(), stats=None, recap=None, hide=()):
    assert kind in STEP_KINDS, kind
    callouts = [(t, x) for t, x in (("key", key), ("tip", tip), ("warn", warn)) if x]
    assert len(callouts) <= 1, title
    return dict(kind=kind, label=label, title=title, body=[p.strip() for p in body.split("\n\n")] if isinstance(body, str) else list(body),
                add=list(add), edges=list(edges), focus=list(focus), callout=callouts[0] if callouts else None, learn=list(learn),
                stats=stats, recap=recap, hide=list(hide))


def width(n):
    """Same rule as nodeWidth() in frontend/src/components/Walkthrough.tsx."""
    return max(150, len(n["label"]) * 7.2 + 44, len(n.get("sub", "")) * 5.9 + 44)


def _check_layout(nodes, title):
    for i, a in enumerate(nodes):
        assert a["x"] - width(a) / 2 >= 0 and a["x"] + width(a) / 2 <= 800, (title, a["id"], "off canvas")
        for b in nodes[i + 1:]:
            assert not (abs(a["x"] - b["x"]) < (width(a) + width(b)) / 2 + 8 and abs(a["y"] - b["y"]) < 62), (title, a["id"], b["id"], "overlap")


def walk(subtitle, learn, nodes, steps):
    ids = [n["id"] for n in nodes]
    assert len(ids) == len(set(ids)), "duplicate node id"
    assert 4 <= len(steps) <= 10 and steps[0]["kind"] == "problem" and steps[-1]["kind"] == "recap"
    shown: list[str] = []
    edges: dict[tuple, dict] = {}
    learned: set[int] = set()
    out = []
    for s in steps:
        for h in s["hide"]:
            shown.remove(h)
            edges = {k: v for k, v in edges.items() if h not in k}
        for a in s["add"]:
            assert a in ids and a not in shown, (s["title"], a)
            shown.append(a)
        fresh = set()
        for e in s["edges"]:
            assert e[0] in shown and e[1] in shown, (s["title"], e)
            edges[(e[0], e[1])] = {"from": e[0], "to": e[1], **({"label": e[2]} if len(e) > 2 else {})}
            fresh.add((e[0], e[1]))
        assert all(f in shown for f in s["focus"]), s["title"]
        _check_layout([n for n in nodes if n["id"] in shown], s["title"])
        assert all(0 <= x < len(learn) for x in s["learn"]), s["title"]
        learned |= set(s["learn"])
        st = {"kind": s["kind"], "label": s["label"], "title": s["title"], "body": s["body"], "show": list(shown), "focus": s["focus"],
              "edges": [{**v, **({"fresh": True} if k in fresh else {})} for k, v in edges.items()], "learned": sorted(learned)}
        if s["callout"]:
            st["callout"] = {"type": s["callout"][0], "text": s["callout"][1]}
        if s["stats"]:
            st["stats"] = [{"label": k, "value": v} for k, v in s["stats"]]
        if s["recap"]:
            st["recap"] = s["recap"]
        out.append(st)
    assert learned == set(range(len(learn))), f"learn items never covered: {set(range(len(learn))) - learned}"
    assert set(ids) <= {i for st in out for i in st["show"]}, "node never shown"
    return {"subtitle": subtitle, "learn": learn, "nodes": nodes, "steps": out}

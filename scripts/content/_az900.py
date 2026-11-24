"""Shared helpers for the AZ-900 lesson modules (az900_d1.py, az900_d2.py, az900_d3.py)."""
from builder import animation, q

E = "az-900"
ML = "https://learn.microsoft.com/"
TR = ML + "training/modules/"
T = "frontend/src/simulations/groups/az900.test.ts"
FREE = ("An Azure subscription (a free account works)",)
_counts: dict[str, int] = {}


def anim(id, title, objectives, desc, fidelity="simplified-illustration"):
    animation(id, title, E, objectives, fidelity, T, desc)


def cfg(portal, cli, ps, perms=("Reader to explore; Contributor to create resources",), limits=("Concept-level: no limits to configure",), bicep=None):
    d = dict(prerequisites=list(FREE), permissions=list(perms), limits=list(limits), portal=portal, cli=cli, powershell=ps)
    if bicep:
        d["bicep"] = bicep
    return d


def lab(objective, steps, expected, validation, failures, duration=15):
    return dict(type="A", objective=objective, duration=duration, steps=steps, expected=expected, validation=validation, failures=failures)


def chooser_checks(scn, what):
    return [(f"{scn}-correct", f"Chose the right {what}"), (f"{scn}-wrong", "Learned from a wrong choice")]


def qq(obj, diff, typ, stem, opts, correct, expl, doc, mode=None):
    """opts = [(text, why)], correct = letters. Ids: az900-x-<objective>-<n>."""
    key = obj.split("-")[1]
    _counts[key] = _counts.get(key, 0) + 1
    L = "abcdefgh"
    m = mode or ("ordering" if typ == "ordering" else "multiple" if len(correct) > 1 else "single")
    q(f"az900-x-{key}-{_counts[key]}", E, obj, diff, typ, m, stem, [(L[i], o[0], o[1]) for i, o in enumerate(opts)], list(correct), expl, [doc])

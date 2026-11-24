"""Shared helpers for the CLF-C02 content modules."""
from builder import lesson, q

E = "aws-clf-c02"
D = "https://docs.aws.amazon.com/"
A = "https://aws.amazon.com/"
_n = {"i": 0}


def qa(obj, diff, typ, stem, opts, correct, expl, doc, mode=None, code=None):
    _n["i"] += 1
    m = mode or ("multiple" if len(correct) > 1 else "single")
    args = [f"clf-q-{obj.split('-')[1]}-{_n['i']}", E, obj, diff, typ, m, stem]
    if code:
        args.append(code)
    q(*args, [("abcdefgh"[i], o[0], o[1]) for i, o in enumerate(opts)], list(correct), expl, [doc])


def cfg(console, cli, ps, prereq=("An AWS account (use an IAM Identity Center user, not root)",), perms=("Read-only access to explore; least-privilege permissions to change resources",), limits=("Conceptual objective: explore in the console; no configuration limits are tested",)):
    return dict(prerequisites=list(prereq), permissions=list(perms), limits=list(limits), portal=console, cli=cli, powershell=ps)


def clab(sim_scenario_id, tab, what):
    return dict(type="A", objective=f"Practise choosing the right {what}.", duration=10,
                steps=[f"Open the '{tab}' tab.", "Pick each requirement, choose an answer and run it.", "Read why the best answer fits."],
                expected=["Every choice is explained"], validation=[(f"{sim_scenario_id}-correct", f"Chose a correct {what}"), (f"{sim_scenario_id}-wrong", "Learned from a wrong choice")], failures=["Choosing by name instead of requirement"])


def L(**kw):
    from _aws_walk import WALK
    kw.setdefault("exam", E)
    kw.setdefault("walkthrough", WALK.get(kw["id"]))
    lesson(**kw)

"""Shared helpers for the AZ-104 easy walkthroughs and hands-on labs (see zz_az104_overlay.py).

H() describes a hands-on lab the learner does in their own Azure account. Steps are tuples:
(what to do, what you should see[, tip[, code]]). The app never runs these steps itself.
"""

ML = "https://learn.microsoft.com/"
RG = "rg-az104-lab"
REGION = "UAE North (or any region near you)"

BASE = f"Signed in at portal.azure.com as Owner of a subscription (a free or pay-as-you-go account works). Work in a resource group called {RG}."
NEW_RG = f"If {RG} does not exist yet: search 'Resource groups' > Create > name {RG}, region {REGION} > Review + create > Create."
DELETE_RG = f"When you finish for the day: Resource groups > {RG} > Delete resource group > type the name > Delete. This removes everything inside it."


def H(title, minutes, level, cost, before, steps, check, cleanup, screens):
    assert level in {"free", "low", "watch"}, level
    assert 3 <= len(steps) <= 14 and check and cleanup and screens, title
    out = []
    for s in steps:
        assert 2 <= len(s) <= 4, s
        d = {"do": s[0]}
        if s[1]:
            d["see"] = s[1]
        if len(s) > 2 and s[2]:
            d["tip"] = s[2]
        if len(s) > 3 and s[3]:
            d["code"] = s[3]
        out.append(d)
    return {"title": title, "minutes": minutes, "costLevel": level, "cost": cost, "before": list(before), "steps": out,
            "check": list(check), "cleanup": list(cleanup), "screens": [{"title": t, "url": u} for t, u in screens]}

"""Shared helpers for the AI-901 lesson modules (ai901_d1.py, ai901_d2.py).

Configuration samples (portal steps, CLI, PowerShell, Python) checked against Microsoft Learn on 2026-11-18
are stored in _ai901_cfg.json and reused here.
"""
import json
from pathlib import Path

from builder import animation, q

E = "ai-901"
ML = "https://learn.microsoft.com/"
T = "frontend/src/simulations/groups/ai.test.ts"
FOUNDRY = ML + "azure/foundry/what-is-foundry"
GUIDE = ML + "credentials/certifications/resources/study-guides/ai-901"
RAI = ML + "azure/machine-learning/concept-responsible-ai"
PRINCIPLES = "https://www.microsoft.com/ai/principles-and-approach"
FILTER = ML + "azure/ai-foundry/openai/concepts/content-filter"
PROMPT = ML + "azure/ai-foundry/openai/concepts/prompt-engineering"
DEPLOY = ML + "azure/ai-foundry/foundry-models/concepts/deployment-types"
AGENTS = ML + "azure/ai-foundry/agents/overview"
LANG = ML + "azure/ai-services/language-service/overview"
SPEECH = ML + "azure/ai-services/speech-service/overview"
VISION = ML + "azure/ai-foundry/openai/how-to/gpt-with-vision"
IMAGES = ML + "azure/ai-foundry/openai/how-to/dall-e"
CU = ML + "azure/ai-services/content-understanding/overview"
CU_ANALYZERS = ML + "azure/ai-services/content-understanding/concepts/analyzer-reference"
CU_REST = ML + "azure/ai-services/content-understanding/quickstart/use-rest-api"
SDK = ML + "python/api/overview/azure/ai-projects-readme"
STT = ML + "azure/ai-services/speech-service/get-started-speech-to-text"
TTS = ML + "azure/ai-services/speech-service/get-started-text-to-speech"

SAVED = json.loads((Path(__file__).parent / "_ai901_cfg.json").read_text())
REAL_COST = "Simulation: free. Optional real run: model tokens and Foundry Tools transactions are billed per use; delete the resource group afterwards."
CLEANUP = ["Simulation: use Reset.", "If you ran it in Azure: az group delete --name rg-ai901 --yes (deletes the Foundry resource, projects and deployments)."]
_counts: dict[str, int] = {}


def anim(id, title, objectives, desc, fidelity="simplified-illustration"):
    animation(id, title, E, objectives, fidelity, T, desc)


def cfg(portal, cli=None, ps=None, python=None, from_saved=None,
        perms=("Azure AI User on the Foundry project to use models and agents; Azure AI Project Manager or Owner to create projects and deployments",),
        limits=("Model availability differs by region and deployment type", "Deployments have tokens-per-minute (TPM) rate limits and quota per subscription and region")):
    s = SAVED.get(from_saved, {}) if from_saved else {}
    d = dict(prerequisites=["An Azure subscription with access to Microsoft Foundry (ai.azure.com)"], permissions=list(perms), limits=list(limits),
             portal=portal, cli=cli if cli is not None else s.get("cli", ""), powershell=ps if ps is not None else s.get("powershell", ""))
    py = python if python is not None else s.get("python")
    if py:
        d["python"] = py
    return d


def lab(objective, steps, expected, validation, failures, duration=15, real=False):
    d = dict(type="A", objective=objective, duration=duration, steps=steps, expected=expected, validation=validation, failures=failures)
    if real:
        d["cost"] = REAL_COST
        d["cleanup"] = CLEANUP
    return d


def chooser_checks(scn, what):
    return [(f"{scn}-correct", f"Chose the right {what}"), (f"{scn}-wrong", "Learned from a wrong choice")]


def qa(obj, diff, typ, stem, opts, correct, expl, doc, code=None):
    """opts = [(text, why)], correct = letters. Ids: ai901-x-<objective>-<n>."""
    key = obj.split("-")[1]
    _counts[key] = _counts.get(key, 0) + 1
    L = "abcdefgh"
    mode = "ordering" if typ == "ordering" else "multiple" if len(correct) > 1 else "single"
    args = [f"ai901-x-{key}-{_counts[key]}", E, obj, diff, typ, mode, stem]
    if code:
        args.append(code)
    q(*args, [(L[i], o[0], o[1]) for i, o in enumerate(opts)], list(correct), expl, [doc])

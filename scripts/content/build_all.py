#!/usr/bin/env python3
"""Regenerate all module-authored curriculum content, then run the coverage audit (report only)."""
import importlib
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import builder  # noqa: E402

for mod in sorted(p.stem for p in HERE.glob("*.py") if p.stem not in {"builder", "build_all"} and not p.stem.startswith("_")):
    importlib.import_module(mod)
    print(f"{mod}: {builder.flush()}")

subprocess.run([sys.executable, str(HERE.parent / "validate_coverage.py"), "--report-only"], check=False)

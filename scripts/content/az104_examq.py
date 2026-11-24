"""Extra AZ-104 exam-style questions (two more per objective), authored in _az104_q12.py and _az104_q345.py."""
from builder import q

import _az104_q12
import _az104_q345
from _az104_qfix import REPLACE

E = "az-104"
ITEMS = _az104_q12.Q + _az104_q345.Q

for n, item in enumerate(ITEMS, 1):
    item = REPLACE.get(n, item)  # questions that repeated an existing one were replaced after review
    obj, diff, typ, stem, opts, correct, expl, doc = item[:8]
    code = item[8] if len(item) > 8 else None
    assert len(opts) >= 2 and all(c in "abcdefgh"[: len(opts)] for c in correct), stem
    mode = "ordering" if typ == "ordering" else "multiple" if len(correct) > 1 else "single"
    args = [f"az104-q-x-{n:03d}", E, obj, diff, typ, mode, stem]
    if code:
        args.append(code)
    q(*args, [("abcdefgh"[i], o[0], o[1]) for i, o in enumerate(opts)], list(correct), expl, [doc])

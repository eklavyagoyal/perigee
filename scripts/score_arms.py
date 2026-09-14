"""Score every ablation arm on decision quality, not val loss.

Val loss rewards reproducing rationale wording, and with 62.6% of targets being the two words
"Answer: <label>" it mostly rewards predicting two tokens. What matters for an operator is whether
the call was right, so this parses the generated answer, compares it to the gold answer that the
prediction file already carries, and reports a confusion matrix with precision/recall/F1.

Usage: python score_arms.py [root]     (default /data/work/arms)
"""

import json
import pathlib
import re
import sys

ANSWER_RE = re.compile(r"answer:\s*(nominal|anomalous)", re.IGNORECASE)


def answer_of(text):
    """Last stated answer in a generation, or None when it never states one."""
    found = ANSWER_RE.findall(text or "")
    return found[-1].lower() if found else None


def score(path):
    """Confusion matrix + P/R/F1 for the anomalous class, plus how often a rationale was written."""
    tp = fp = tn = fn = unparsed = 0
    lengths = []
    for line in path.open():
        row = json.loads(line)
        gen, gold = answer_of(row.get("generated")), answer_of(row.get("gold"))
        lengths.append(len((row.get("generated") or "").split()))
        if gen is None or gold is None:
            unparsed += 1
            continue
        if gold == "anomalous":
            tp, fn = (tp + 1, fn) if gen == "anomalous" else (tp, fn + 1)
        else:
            fp, tn = (fp + 1, tn) if gen == "anomalous" else (fp, tn + 1)
    n = tp + fp + tn + fn
    if n == 0:
        return None
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    bare = sum(1 for length in lengths if length <= 3)
    return {
        "n": n, "tp": tp, "fp": fp, "tn": tn, "fn": fn, "unparsed": unparsed,
        "acc": (tp + tn) / n, "prec": prec, "rec": rec, "f1": f1,
        "bare_pct": 100 * bare / len(lengths) if lengths else 0.0,
    }


def best_val(arm_dir):
    """Lowest validation loss recorded for this arm, and the epoch it happened on."""
    hits = list(arm_dir.rglob("loss_history.txt"))
    if not hits:
        return None
    rows = []
    for line in hits[0].read_text().splitlines()[2:]:
        parts = line.split()
        if len(parts) == 3:
            rows.append((int(parts[0]), float(parts[2])))
    return min(rows, key=lambda r: r[1]) if rows else None


def main():
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/data/work/arms")
    print(f"{'arm':26} {'best val':>9} {'ep':>3} {'acc':>6} {'prec':>6} {'recall':>7} {'F1':>6} {'bare%':>6} {'n':>5}")
    print("-" * 84)
    for arm_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        val = best_val(arm_dir)
        val_s = f"{val[1]:.4f}" if val else "-"
        ep_s = str(val[0]) if val else "-"
        preds = sorted(arm_dir.rglob("test_predictions*.jsonl"))
        if not preds:
            print(f"{arm_dir.name:26} {val_s:>9} {ep_s:>3} {'(no predictions yet)':>40}")
            continue
        s = score(preds[0])
        if s is None:
            print(f"{arm_dir.name:26} {val_s:>9} {ep_s:>3} {'(empty predictions)':>40}")
            continue
        print(f"{arm_dir.name:26} {val_s:>9} {ep_s:>3} {s['acc']:6.3f} {s['prec']:6.3f} "
              f"{s['rec']:7.3f} {s['f1']:6.3f} {s['bare_pct']:5.0f}% {s['n']:5d}")


if __name__ == "__main__":
    main()

"""Frozen-LLM baseline for ESA-AD Mission1 subsystem_5 (CLUSTER_BRIEF §6).

No learned encoder: a frozen LLM is handed the same six-hour window the TSLM sees -- the engineered
text plus the raw series as numbers -- and asked the same nominal/anomalous question. This is the
comparison number the jury scores the TSLM against.

Two arms, because of what the ablation found. `full` gives the model the engineered text AND the
numeric series; `text_only` withholds the series entirely. If text_only matches full, then the
engineered sentences alone decide the label and neither the encoder nor the telemetry is doing the
work -- a third, independent confirmation that needs no training at all.

Usage:
    python evaluate_esa_baseline.py --arm full --limit 246
    python evaluate_esa_baseline.py --arm text_only --limit 246
"""

import argparse
import json
import os
import pathlib
import re
import sys
from concurrent.futures import ThreadPoolExecutor

ANSWER_RE = re.compile(r"answer:\s*(nominal|anomalous)", re.IGNORECASE)
SYSTEM = (
    "You are an ESA spacecraft operations engineer reviewing six hours of satellite telemetry. "
    "Decide whether the window is nominal or anomalous. Reason briefly, then end your reply with "
    'exactly "Answer: nominal" or "Answer: anomalous".'
)


def downsample(values, target=200):
    """Thin a window to at most `target` points so the prompt stays affordable."""
    if len(values) <= target:
        return values
    step = len(values) / target
    return [values[int(i * step)] for i in range(target)]


def build_prompt(row, arm):
    """Render one window as the text the frozen LLM sees."""
    parts = [f"Channel: {row['channel']}", f"Mean {row['mean']:.4f}, std {row['std']:.4f} over this six-hour window."]
    if row.get("context_periodicity") is not None and row.get("window_periodicity") is not None:
        parts.append(
            f"Periodicity score over the surrounding 24h: {row['context_periodicity']:.2f}; "
            f"over this window: {row['window_periodicity']:.2f}."
        )
    if row.get("minutes_since_command") is not None:
        parts.append(f"A priority-2-or-higher telecommand executed {row['minutes_since_command']:.1f} minutes before this window's reference point.")
    else:
        parts.append("No priority-2-or-higher telecommand executed in the six hours before this window's reference point.")
    if arm == "full":
        series = ", ".join(f"{v:.4f}" for v in downsample(row["values"]))
        parts.append(f"Telemetry values (downsampled to {len(downsample(row['values']))} points):\n{series}")
    parts.append("Is this window nominal or anomalous?")
    return "\n".join(parts)


def load_test_rows():
    """Load the held-out test split straight from the TimeNet registry the TSLM trains on."""
    sys.path.insert(0, "/data/work/submission/OpenTSLM/src")
    from opentslm.time_series_datasets.esa_mission1.esa_mission1_cot_loader import load_esa_mission1_cot_splits
    import numpy as np

    _, _, test = load_esa_mission1_cot_splits()
    rows = []
    for r in test:
        values = list(r["values"])
        arr = np.array(values, dtype=float)
        rows.append({
            "record_id": r["record_id"], "channel": r["channel"], "label": r["label"],
            "values": values, "mean": float(arr.mean()), "std": float(arr.std()),
            "window_periodicity": r.get("window_periodicity"),
            "context_periodicity": r.get("context_periodicity"),
            "minutes_since_command": r.get("minutes_since_command"),
        })
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--arm", choices=["full", "text_only"], default="full")
    ap.add_argument("--model", default="gpt-4o")
    ap.add_argument("--limit", type=int, default=246)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    from openai import OpenAI

    key = os.environ.get("OPENAI_API_KEY") or pathlib.Path(os.path.expanduser("~/.openai_key")).read_text().strip()
    client = OpenAI(api_key=key)
    rows = load_test_rows()[: args.limit]
    print(f"{len(rows)} test windows | arm={args.arm} | model={args.model}", flush=True)

    def ask(row):
        try:
            resp = client.chat.completions.create(
                model=args.model, temperature=0,
                messages=[{"role": "system", "content": SYSTEM},
                          {"role": "user", "content": build_prompt(row, args.arm)}],
                max_tokens=300,
            )
            return {"record_id": row["record_id"], "label": row["label"],
                    "generated": resp.choices[0].message.content}
        except Exception as exc:  # one window failing must not lose the whole run
            return {"record_id": row["record_id"], "label": row["label"],
                    "generated": "", "error": repr(exc)}

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        preds = list(pool.map(ask, rows))

    out = pathlib.Path(args.out or f"/data/work/arms/baseline_{args.arm}_predictions.jsonl")
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w") as fh:
        for p in preds:
            fh.write(json.dumps(p) + "\n")

    tp = fp = tn = fn = unparsed = 0
    for p in preds:
        found = ANSWER_RE.findall(p["generated"] or "")
        pred = found[-1].lower() if found else None
        if pred is None:
            unparsed += 1
            continue
        if p["label"] == "anomalous":
            tp, fn = (tp + 1, fn) if pred == "anomalous" else (tp, fn + 1)
        else:
            fp, tn = (fp + 1, tn) if pred == "anomalous" else (fp, tn + 1)
    n = tp + fp + tn + fn
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    print(f"\nBASELINE arm={args.arm} model={args.model}")
    print(f"  scored {n} (unparsed {unparsed}), errors {sum(1 for p in preds if p.get('error'))}")
    print(f"  acc {(tp + tn) / n:.3f}  precision {prec:.3f}  recall {rec:.3f}  F1 {f1:.3f}")
    print(f"  confusion: tp {tp}  fn {fn}  fp {fp}  tn {tn}")
    print(f"  predictions -> {out}")


if __name__ == "__main__":
    main()

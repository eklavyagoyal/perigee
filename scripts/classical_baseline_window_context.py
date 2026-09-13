#!/usr/bin/env python3
"""Classical baseline on the window's own mean/std/periodicity PLUS the preceding 24h context's.

This is the "current 6-hour metrics (mean, std, periodicity) and the 24-hour window before that"
feature set -- six raw numbers, no derived contrast (no level_zscore, no scale_ratio). It's
closest to the very first engineered-signal design used in this project, just with level_zscore/
scale_ratio's normalized contrast decomposed back into the two raw context numbers it was built
from, plus both periodicity scores alongside them.

The connector only stores the derived contrast (level_zscore, scale_ratio), not the raw context
mean/std themselves -- but they're exactly recoverable algebraically from what's stored, since:
    level_zscore = (window_mean - context_mean) / context_std
    scale_ratio  = window_std / context_std
=> context_std  = window_std / scale_ratio
   context_mean = window_mean - level_zscore * context_std
No need to touch the raw source channel files or rebuild the TimeNet dataset.

Run from the OpenTSLM directory (needs its ``src`` on the path, same conda env as training):
    python ../scripts/classical_baseline_window_context.py
"""

import os
import sys

import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "OpenTSLM", "src"))

from opentslm.time_series_datasets.esa_mission1.esa_mission1_cot_loader import (  # noqa: E402
    load_esa_mission1_cot_splits,
)

FEATURE_NAMES = [
    "window_mean",
    "window_std",
    "context_mean",
    "context_std",
    "window_periodicity",
    "context_periodicity",
]


def _features(row: dict) -> list[float]:
    series = np.asarray(row["values"], dtype=np.float64)
    window_mean = float(np.mean(series))
    window_std = float(np.std(series))

    level_zscore = row.get("level_zscore")
    scale_ratio = row.get("scale_ratio")
    if level_zscore is not None and scale_ratio not in (None, 0):
        context_std = window_std / scale_ratio
        context_mean = window_mean - level_zscore * context_std
    else:
        context_std = np.nan
        context_mean = np.nan

    window_periodicity = row.get("window_periodicity")
    context_periodicity = row.get("context_periodicity")

    return [
        window_mean,
        window_std,
        context_mean,
        context_std,
        window_periodicity if window_periodicity is not None else np.nan,
        context_periodicity if context_periodicity is not None else np.nan,
    ]


def _xy(dataset) -> tuple[np.ndarray, np.ndarray]:
    rows = list(dataset)
    X = np.array([_features(r) for r in rows], dtype=np.float64)
    y = np.array([1 if r["label"] == "anomalous" else 0 for r in rows], dtype=np.int64)
    return X, y


def main() -> None:
    train, val, test = load_esa_mission1_cot_splits()
    X_train, y_train = _xy(train)
    X_val, y_val = _xy(val)
    X_test, y_test = _xy(test)

    n_missing_test = int(np.isnan(X_test[:, 2]).sum())
    print(f"Test rows missing context (no level_zscore/scale_ratio available): {n_missing_test}/{len(y_test)}")

    X_fit = np.concatenate([X_train, X_val])
    y_fit = np.concatenate([y_train, y_val])

    clf = make_pipeline(
        SimpleImputer(strategy="mean"),
        StandardScaler(),
        LogisticRegression(max_iter=1000, class_weight="balanced"),
    )
    clf.fit(X_fit, y_fit)

    y_pred = clf.predict(X_test)
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
    accuracy = (tp + tn) / len(y_test)
    precision = tp / (tp + fp) if (tp + fp) else float("nan")
    recall = tp / (tp + fn) if (tp + fn) else float("nan")
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else float("nan")

    print(f"\nClassical baseline: window mean/std/periodicity + 24h-context mean/std/periodicity, n={len(y_test)}")
    print(f"Features: {', '.join(FEATURE_NAMES)}")
    print(f"Accuracy:  {accuracy:.4f} ({tp + tn}/{len(y_test)})")
    print(f"Precision: {precision:.3f}  Recall: {recall:.3f}  F1: {f1:.3f}")
    print(f"Confusion matrix (rows=true, cols=pred): nominal[{tn} {fp}] anomalous[{fn} {tp}]")

    logreg = clf.named_steps["logisticregression"]
    print("\nStandardized coefficients (larger |value| = more predictive, holding others fixed):")
    for name, coef in sorted(zip(FEATURE_NAMES, logreg.coef_[0]), key=lambda kv: -abs(kv[1])):
        print(f"  {name:>22}: {coef:+.3f}")


if __name__ == "__main__":
    main()

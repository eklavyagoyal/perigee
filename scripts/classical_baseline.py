#!/usr/bin/env python3
"""Classical, non-LLM baseline for the ESA Mission1 subsystem_5 anomaly task.

Fits a logistic regression on the same engineered features the fine-tuned prompt states in
text (window mean/std, level_zscore, scale_ratio, the window/context periodicity contrast, and
telecommand timing), on the identical 80/10/10 split used to train and evaluate OpenTSLMSP. This
answers "do we need a 3B-parameter LLM for this, or would simple statistics already do?" -- the
comparison point for slide 16's "compare with a baseline" requirement.

Run from the OpenTSLM directory (needs its ``src`` on the path, same conda env as training):
    python ../scripts/classical_baseline.py
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

FEATURE_KEYS = (
    "level_zscore",
    "scale_ratio",
    "minutes_since_command",
)


def _periodicity_drop(row: dict) -> float | None:
    """context_periodicity - window_periodicity, or None if either is missing."""
    ctx = row.get("context_periodicity")
    win = row.get("window_periodicity")
    if ctx is None or win is None:
        return None
    return ctx - win


def _features(row: dict) -> list[float]:
    """One feature row: level_zscore, scale_ratio, periodicity_drop, has_telecommand.

    Missing values become NaN (imputed downstream) rather than 0, since 0 is a meaningful value
    for some of these features (e.g. scale_ratio=0 would be a real reading).
    """
    level_zscore = row.get("level_zscore")
    scale_ratio = row.get("scale_ratio")
    periodicity_drop = _periodicity_drop(row)
    has_telecommand = 1.0 if row.get("minutes_since_command") is not None else 0.0
    minutes_since_command = row.get("minutes_since_command")
    return [
        level_zscore if level_zscore is not None else np.nan,
        scale_ratio if scale_ratio is not None else np.nan,
        periodicity_drop if periodicity_drop is not None else np.nan,
        has_telecommand,
        minutes_since_command if minutes_since_command is not None else np.nan,
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

    # Fit on train+val (the LLM's "best checkpoint" selection also uses val, so this keeps the
    # comparison fair -- both approaches get to use train+val, only test is truly held out).
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

    print(f"Classical baseline (logistic regression on engineered features), n={len(y_test)}")
    print(f"Features: level_zscore, scale_ratio, periodicity_drop, has_telecommand, minutes_since_command")
    print(f"Accuracy:  {accuracy:.4f} ({tp + tn}/{len(y_test)})")
    print(f"Precision: {precision:.3f}  Recall: {recall:.3f}  F1: {f1:.3f}")
    print(f"Confusion matrix (rows=true, cols=pred): nominal[{tn} {fp}] anomalous[{fn} {tp}]")

    logreg = clf.named_steps["logisticregression"]
    scaler = clf.named_steps["standardscaler"]
    feature_names = ["level_zscore", "scale_ratio", "periodicity_drop", "has_telecommand", "minutes_since_command"]
    print("\nStandardized coefficients (larger |value| = more predictive, holding others fixed):")
    for name, coef in sorted(zip(feature_names, logreg.coef_[0]), key=lambda kv: -abs(kv[1])):
        print(f"  {name:>22}: {coef:+.3f}")


if __name__ == "__main__":
    main()

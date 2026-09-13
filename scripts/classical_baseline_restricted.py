#!/usr/bin/env python3
"""Classical baseline restricted to only what the CURRENT (refined) prompt exposes.

The original classical_baseline.py fits on 5 engineered numbers -- level_zscore, scale_ratio,
periodicity_drop, has_telecommand, minutes_since_command. But the prompt was later refined
(ESAMission1CoTQADataset._get_text_time_series_prompt_list) to remove level_zscore, scale_ratio,
and the periodicity sentence as answer-leaking shortcuts, keeping only the window's own raw
mean/std and telecommand timing. Comparing the fine-tuned LLM (which no longer sees the removed
three numbers) against a baseline that still gets all five isn't apples-to-apples. This script
fits on exactly what the current prompt states: window mean, window std, has_telecommand,
minutes_since_command.

Run from the OpenTSLM directory (needs its ``src`` on the path, same conda env as training):
    python ../scripts/classical_baseline_restricted.py
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

FEATURE_NAMES = ["window_mean", "window_std", "has_telecommand", "minutes_since_command"]


def _features(row: dict) -> list[float]:
    series = np.array(row["values"], dtype=np.float64)
    mean = float(np.mean(series))
    std = float(np.std(series))
    minutes_since_command = row.get("minutes_since_command")
    has_telecommand = 1.0 if minutes_since_command is not None else 0.0
    return [
        mean,
        std,
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

    print(f"Classical baseline RESTRICTED to current prompt's features, n={len(y_test)}")
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

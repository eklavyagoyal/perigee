#!/usr/bin/env python3
"""Classical baseline on the RAW series only -- no engineered features at all.

classical_baseline.py and classical_baseline_restricted.py both still use engineered summary
statistics (mean, std, z-scores, ratios) as their inputs -- simple engineering, but engineering.
This script instead resamples each window's raw values to a fixed-length grid (windows vary from
~106 to ~2413 points, mostly 756, due to data gaps -- see the length distribution this script
prints) and feeds those raw, resampled points directly into logistic regression, with no
hand-computed statistic in between. This is the most literal answer to "can a simple linear model
find the signal directly in the numbers, with zero feature engineering" -- the fairest baseline
against what a trained time-series encoder is supposed to be doing.

Run from the OpenTSLM directory (needs its ``src`` on the path, same conda env as training):
    python ../scripts/classical_baseline_raw.py [--points N]
"""

import argparse
import os
import sys
from collections import Counter

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "OpenTSLM", "src"))

from opentslm.time_series_datasets.esa_mission1.esa_mission1_cot_loader import (  # noqa: E402
    load_esa_mission1_cot_splits,
)


def _resample(values: list, n_points: int) -> np.ndarray:
    """Resample a variable-length series to exactly n_points via linear interpolation.

    Handles both downsampling (most windows, ~756 raw points) and upsampling (the small fraction
    of shorter windows caused by data gaps -- as few as ~106 points) with the same call.
    """
    series = np.asarray(values, dtype=np.float64)
    if len(series) == n_points:
        return series
    old_x = np.linspace(0.0, 1.0, num=len(series))
    new_x = np.linspace(0.0, 1.0, num=n_points)
    return np.interp(new_x, old_x, series)


def _xy(dataset, n_points: int) -> tuple[np.ndarray, np.ndarray]:
    rows = list(dataset)
    X = np.array([_resample(r["values"], n_points) for r in rows], dtype=np.float64)
    y = np.array([1 if r["label"] == "anomalous" else 0 for r in rows], dtype=np.int64)
    return X, y


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--points", type=int, default=120, help="Fixed number of resampled raw points per window")
    args = parser.parse_args()

    train, val, test = load_esa_mission1_cot_splits()

    lengths = Counter(len(r["values"]) for r in train)
    print(f"Raw window length distribution (train, top 5): {lengths.most_common(5)}")

    X_train, y_train = _xy(train, args.points)
    X_val, y_val = _xy(val, args.points)
    X_test, y_test = _xy(test, args.points)

    X_fit = np.concatenate([X_train, X_val])
    y_fit = np.concatenate([y_train, y_val])

    clf = make_pipeline(
        StandardScaler(),
        LogisticRegression(max_iter=2000, class_weight="balanced"),
    )
    clf.fit(X_fit, y_fit)

    y_pred = clf.predict(X_test)
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
    accuracy = (tp + tn) / len(y_test)
    precision = tp / (tp + fp) if (tp + fp) else float("nan")
    recall = tp / (tp + fn) if (tp + fn) else float("nan")
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else float("nan")

    print(f"\nClassical baseline on RAW resampled values ONLY, n={len(y_test)}, {args.points} points/window")
    print("No engineered features at all -- not even mean/std, just the interpolated raw values.")
    print(f"Accuracy:  {accuracy:.4f} ({tp + tn}/{len(y_test)})")
    print(f"Precision: {precision:.3f}  Recall: {recall:.3f}  F1: {f1:.3f}")
    print(f"Confusion matrix (rows=true, cols=pred): nominal[{tn} {fp}] anomalous[{fn} {tp}]")


if __name__ == "__main__":
    main()

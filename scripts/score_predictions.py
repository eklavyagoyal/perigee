"""Score OpenTSLM's generated test-set answers against ground truth for stage6_esa_cot.

Works on a partial predictions file too (evaluation writes it incrementally, one line per
example, in the same order as the test split), so it can report interim accuracy while
generation is still running.

Usage:
    python scripts/score_predictions.py [--predictions PATH]
"""

import argparse
import json
from pathlib import Path
import re
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PREDICTIONS = (
    PROJECT_ROOT
    / "OpenTSLM/results/Llama_3_2_3B/OpenTSLMSP/stage6_esa_cot/results/test_predictions_rank_0.jsonl"
)

_ANSWER_RE = re.compile(r"answer:\s*(nominal|anomalous)", re.IGNORECASE)


def extract_answer(text: str) -> str | None:
    matches = _ANSWER_RE.findall(text)
    return matches[-1].lower() if matches else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--predictions", type=Path, default=DEFAULT_PREDICTIONS)
    args = parser.parse_args()

    sys.path.insert(0, str(PROJECT_ROOT / "OpenTSLM/src"))
    from opentslm.time_series_datasets.esa_mission1.esa_mission1_cot_loader import (  # noqa: E402
        load_esa_mission1_cot_splits,
    )

    _, _, test = load_esa_mission1_cot_splits()
    true_labels = test["label"]

    predictions = [json.loads(line) for line in args.predictions.read_text().splitlines() if line.strip()]
    n = len(predictions)
    if n == 0:
        print("No predictions yet.")
        return

    correct = 0
    unparsed = 0
    confusion = {"nominal": {"nominal": 0, "anomalous": 0}, "anomalous": {"nominal": 0, "anomalous": 0}}
    for i in range(n):
        true_label = true_labels[i]
        pred_label = extract_answer(predictions[i]["generated"])
        if pred_label is None:
            unparsed += 1
            continue
        confusion[true_label][pred_label] += 1
        if pred_label == true_label:
            correct += 1

    print(f"Scored {n}/{len(true_labels)} test examples ({100 * n / len(true_labels):.1f}% of full test set)")
    print(f"Unparsed (no 'Answer: nominal/anomalous' found): {unparsed}")
    scored = n - unparsed
    if scored:
        print(f"Accuracy: {correct}/{scored} = {100 * correct / scored:.2f}%")
    print()
    print("Confusion matrix (rows=true, cols=predicted):")
    print(f"{'':>12} {'nominal':>10} {'anomalous':>10}")
    for true_label in ("nominal", "anomalous"):
        row = confusion[true_label]
        print(f"{true_label:>12} {row['nominal']:>10} {row['anomalous']:>10}")

    tp = confusion["anomalous"]["anomalous"]
    fp = confusion["nominal"]["anomalous"]
    fn = confusion["anomalous"]["nominal"]
    if tp + fp and tp + fn:
        precision = tp / (tp + fp)
        recall = tp / (tp + fn)
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        print()
        print(f"Anomalous-class precision: {precision:.3f}  recall: {recall:.3f}  F1: {f1:.3f}")


if __name__ == "__main__":
    main()

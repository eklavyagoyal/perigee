# SPDX-FileCopyrightText: 2025 Stanford University, ETH Zurich, and the project authors (see CONTRIBUTORS.md)
# SPDX-FileCopyrightText: 2025 This source file is part of the OpenTSLM open-source project.
#
# SPDX-License-Identifier: MIT

"""Loads the esa/mission1-subsystem5 TimeF dataset (built by the TimeNet connector in the
zurich-hackathon project) and splits it 80/10/10 by anomaly-pair for OpenTSLM training.

The connector tags every record "train" or "test" by ESA-ADB's own 2007-01-01 benchmark boundary
(Mission1_semisupervised_prep_from_raw.py's test_data_split). That boundary is a date, not an event
count, and it happens to fall almost exactly in the middle of the labeled events by count (1,230 of
2,510 windows land after it), leaving less than half the data for training. That split makes sense for
ESA-ADB's own unsupervised reconstruction-error benchmark (train only on nominal data, detect anomalies
after a cutoff), but this project fine-tunes a generative QA model instead, so the date boundary buys no
comparable benchmark number and just wastes labeled events. This loader instead shuffles anomaly-pairs
with a fixed seed and cuts 80/10/10 by count, keeping each pair's anomalous and nominal window together
so every split stays exactly balanced.

The connector pairs each anomalous window with one nominal window sampled independently, anywhere in
the same channel's full 2000-2013 span (its own "<id>-<channel>-<occurrence>-pos"/"-neg" record ids
share a pair key). Splitting by pair, not by individual record, keeps every split's label distribution
identical (50/50) regardless of how the underlying dates fall.

Every window needs a chain-of-thought rationale for this split policy to pay off: scripts/generate_cot.py
generates one for every anomalous/nominal pair in the dataset (not just a fixed subset), so whichever
windows land in train here always have real CoT text rather than the bare "Answer: <label>" fallback.

Modality dropout: the engineered text signals (periodicity contrast, level/scale deviation,
telecommand timing) are strong, easy-to-read features, and a pretrained LLM will happily lean on
them instead of learning anything from the raw time-series encoder branch (classic multimodal
"shortcut learning" -- the text branch is trivial to fit, the encoder branch is not). To force the
encoder to carry real signal, a fixed, seeded 40% of TRAIN rows only have every engineered signal
field nulled out here, so ESAMission1CoTQADataset's `is not None` checks omit those sentences and
the model must reason from the raw values for that fraction of training. Validation and test rows
always keep every signal, so evaluation numbers stay comparable across runs.
"""

import os
import random
from typing import Tuple

from datasets import Dataset

ESA_REGISTRY_ENV = "ESA_MISSION1_SUBSYSTEM5_REGISTRY"
ESA_DEFAULT_REGISTRY = "/var/tmp/hrm/zurich-hackathon/timenet_registry"
ESA_DATASET_ID = "esa/mission1-subsystem5"
_SPLIT_SEED = 20260912  # fixed seed keeps the split deterministic across runs
_TRAIN_FRAC = 0.8
_VAL_FRAC = 0.1  # remainder goes to test
_MODALITY_DROPOUT_SEED = 20260913  # separate seed from the split shuffle, kept independent
_MODALITY_DROPOUT_FRAC = 0.4
_ENGINEERED_SIGNAL_KEYS = (
    "window_periodicity",
    "context_periodicity",
    "level_zscore",
    "scale_ratio",
    "minutes_since_command",
)


def _annotation(record, key):
    for ann in record.annotations:
        if ann.key == key:
            return ann.value
    return None


def load_esa_mission1_cot_splits() -> Tuple[Dataset, Dataset, Dataset]:
    """Load and split the esa/mission1-subsystem5 dataset for OpenTSLM training.

    Returns:
        (train, validation, test) HuggingFace Datasets, each exactly balanced between "nominal" and
        "anomalous" labels, each row holding the channel's values, its name, the target answer text,
        and the ground-truth label.
    """
    from timenet.client import TimeNet  # noqa: PLC0415 (heavy import; only needed here)
    from timenet.types import AnswerTask  # noqa: PLC0415

    registry = os.environ.get(ESA_REGISTRY_ENV, ESA_DEFAULT_REGISTRY)
    dataset = TimeNet(registry=registry).load(ESA_DATASET_ID)
    tasks_by_record = {task.record_ids[0]: task for task in dataset.tasks if isinstance(task, AnswerTask)}
    records_by_id = {record.record_id: record for record in dataset.records}

    pair_keys = sorted(
        record.record_id.removesuffix("-pos") for record in dataset.records if record.record_id.endswith("-pos")
    )
    rng = random.Random(_SPLIT_SEED)
    rng.shuffle(pair_keys)

    n = len(pair_keys)
    n_train = round(n * _TRAIN_FRAC)
    n_val = round(n * _VAL_FRAC)
    split_by_pair = {
        **{key: "train" for key in pair_keys[:n_train]},
        **{key: "validation" for key in pair_keys[n_train : n_train + n_val]},
        **{key: "test" for key in pair_keys[n_train + n_val :]},
    }

    rows_by_split: dict[str, list] = {"train": [], "validation": [], "test": []}
    for pair_key, split in split_by_pair.items():
        for suffix in ("-pos", "-neg"):
            record = records_by_id.get(pair_key + suffix)
            task = tasks_by_record.get(record.record_id) if record is not None else None
            if record is None or task is None:
                continue
            rows_by_split[split].append(
                {
                    "record_id": record.record_id,
                    "values": record.time_series[0].to_numpy().tolist(),
                    "channel": _annotation(record, "channel"),
                    "label": _annotation(record, "label"),
                    # "Anomaly" or "Rare Event" for the anomalous side of a pair, None for the
                    # nominal side -- ESA's own sub-category, used to oversample the harder
                    # "Anomaly" sub-category specifically (see stage6_esa_cot's sampler).
                    "category": _annotation(record, "category"),
                    "answer": task.target,
                    # Mean/std say nothing about whether a channel is oscillating, and several
                    # subsystem_5 channels are periodic in some windows and not others. These two
                    # scores (from the connector's autocorrelation-based _periodicity_score) let the
                    # prompt contrast "normally periodic" against "not in this window" instead.
                    "window_periodicity": _annotation(record, "window_periodicity"),
                    "context_periodicity": _annotation(record, "context_periodicity"),
                    # A priority>=2 telecommand executing shortly before a window's reference
                    # point is a strong, near-free signal: empirically 81.6% of Rare Events on
                    # these channels are preceded by one within 6h, versus 2.5% of Anomalies and
                    # 0.3% of nominal windows (a commanded manoeuvre/reset/calibration is exactly
                    # what ESA's own "Rare Event" category definition describes). None when no
                    # qualifying command fired in the lookback window.
                    "minutes_since_command": _annotation(record, "minutes_since_command"),
                    # Level (mean) and scale (std) contrast between this window and its surrounding
                    # 24h context: a z-scored level shift or a scale_ratio far from 1.0 is exactly
                    # the "drifted off its usual level" / "variance blew up" pattern that separates
                    # anomalous from nominal windows, expressed relative to the channel's own
                    # recent behavior instead of a fixed global threshold.
                    "level_zscore": _annotation(record, "level_zscore"),
                    "scale_ratio": _annotation(record, "scale_ratio"),
                }
            )

    _apply_modality_dropout(rows_by_split["train"])

    return (
        Dataset.from_list(rows_by_split["train"]),
        Dataset.from_list(rows_by_split["validation"]),
        Dataset.from_list(rows_by_split["test"]),
    )


def _apply_modality_dropout(train_rows: list) -> None:
    """Null out every engineered signal field on a fixed, seeded fraction of train rows in place.

    Args:
        train_rows: The training split's row dicts, mutated in place.
    """
    rng = random.Random(_MODALITY_DROPOUT_SEED)
    for row in train_rows:
        if rng.random() < _MODALITY_DROPOUT_FRAC:
            for key in _ENGINEERED_SIGNAL_KEYS:
                row[key] = None

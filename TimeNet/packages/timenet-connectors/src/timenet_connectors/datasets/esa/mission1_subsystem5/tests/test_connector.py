import json
from pathlib import Path

import pandas as pd
import pytest

from timenet.connectors import BaseConnector
from timenet.dataset import TimeFDataset
from timenet.types import AnswerTask
from timenet_connectors.datasets.esa.mission1_subsystem5 import ESAMission1Subsystem5Connector
from timenet_connectors.datasets.esa.mission1_subsystem5.connector import _split_for


# Tiny synthetic source tree shaped exactly like a real (extracted) ESA-AD Mission1 directory: six
# channel zips (3 days of standard-normal noise at 30s cadence, seeded) plus labels.csv and
# anomaly_types.csv with two labeled intervals, on channel_41 and channel_42 respectively. Generated
# once by a throwaway script; not derived from the real ESA-AD dataset, so the repo ships no dataset
# bytes.
_FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _download_and_convert(monkeypatch, tmp_path, rationales_path: Path | None = None) -> TimeFDataset:
    monkeypatch.setenv("ESA_MISSION1_DIR", str(_FIXTURES_DIR))
    if rationales_path is not None:
        monkeypatch.setenv("ESA_MISSION1_SUBSYSTEM5_RATIONALES", str(rationales_path))
    else:
        monkeypatch.delenv("ESA_MISSION1_SUBSYSTEM5_RATIONALES", raising=False)
    connector = ESAMission1Subsystem5Connector()
    refs = connector.download(tmp_path / "cache")
    return connector.convert(refs)


def test_is_a_connector():
    assert isinstance(ESAMission1Subsystem5Connector(), BaseConnector)


def test_metadata():
    metadata = ESAMission1Subsystem5Connector().metadata()
    assert metadata.dataset_id == "esa/mission1-subsystem5"
    assert str(metadata.license) == "other"
    assert metadata.license_url is not None


def test_download_pairs_each_labeled_interval_with_one_nominal_window(monkeypatch, tmp_path):
    monkeypatch.setenv("ESA_MISSION1_DIR", str(_FIXTURES_DIR))
    refs = ESAMission1Subsystem5Connector().download(tmp_path / "cache")
    # The fixture labels two intervals (channel_41, channel_42); each yields one "-pos" and one
    # "-neg" reference.
    assert len(refs) == 4
    labels = {ref.label for ref in refs}
    assert labels == {"anomalous", "nominal"}
    assert sum(ref.label == "anomalous" for ref in refs) == 2
    assert sum(ref.label == "nominal" for ref in refs) == 2


def test_download_raises_a_clear_error_when_source_dir_is_missing(monkeypatch, tmp_path):
    monkeypatch.setenv("ESA_MISSION1_DIR", str(tmp_path / "does-not-exist"))
    with pytest.raises(FileNotFoundError, match="ESA_MISSION1_DIR"):
        ESAMission1Subsystem5Connector().download(tmp_path / "cache")


def test_nominal_windows_do_not_overlap_labeled_intervals(monkeypatch, tmp_path):
    monkeypatch.setenv("ESA_MISSION1_DIR", str(_FIXTURES_DIR))
    refs = ESAMission1Subsystem5Connector().download(tmp_path / "cache")
    labeled = pd.read_csv(_FIXTURES_DIR / "labels.csv", parse_dates=["StartTime", "EndTime"])
    labeled["StartTime"] = labeled["StartTime"].dt.tz_convert(None)
    labeled["EndTime"] = labeled["EndTime"].dt.tz_convert(None)

    window_len = pd.Timedelta(hours=6)
    for ref in refs:
        if ref.label != "nominal":
            continue
        start = pd.Timestamp(ref.window_start_us, unit="us")
        end = start + window_len
        for row in labeled[labeled["Channel"] == ref.channel].itertuples(index=False):
            assert end <= row.StartTime or start >= row.EndTime


def test_convert_builds_six_hour_windows_with_fallback_answer(monkeypatch, tmp_path):
    dataset = _download_and_convert(monkeypatch, tmp_path)
    assert len(dataset.records) == 4
    for record in dataset.records:
        series = record.time_series[0]
        offsets = series.time_offsets_us()
        assert offsets[-1] < 6 * 60 * 60 * 1_000_000  # within the 6-hour window
        assert len(series.to_numpy()) == len(offsets)

    answer_tasks = [t for t in dataset.tasks if isinstance(t, AnswerTask)]
    assert len(answer_tasks) == 4
    assert {t.target for t in answer_tasks} == {"Answer: anomalous", "Answer: nominal"}
    assert all(t.rationale is None for t in answer_tasks)


def test_convert_uses_rationale_file_when_present(monkeypatch, tmp_path):
    dataset_no_rationale = _download_and_convert(monkeypatch, tmp_path)
    anomalous_record_id = next(
        ann.value and record.record_id
        for record in dataset_no_rationale.records
        for ann in record.annotations
        if ann.key == "label" and ann.value == "anomalous"
    )

    rationale_text = "The signal drifts sharply before recovering. Answer: anomalous"
    rationales_path = tmp_path / "rationales.json"
    rationales_path.write_text(json.dumps({anomalous_record_id: rationale_text}), encoding="utf-8")

    dataset = _download_and_convert(monkeypatch, tmp_path, rationales_path=rationales_path)
    answer_tasks = {t.record_ids[0]: t for t in dataset.tasks if isinstance(t, AnswerTask)}
    task = answer_tasks[anomalous_record_id]
    assert task.target == rationale_text
    assert task.rationale == rationale_text


def test_label_and_split_annotations_present(monkeypatch, tmp_path):
    dataset = _download_and_convert(monkeypatch, tmp_path)
    for record in dataset.records:
        keys = {ann.key for ann in record.annotations}
        assert {"channel", "label", "split", "anomaly_id"} <= keys
        # Fixture dates (2020) fall after the 2007-01-01 ESA-ADB train/test boundary.
        split = next(ann.value for ann in record.annotations if ann.key == "split")
        assert split == "test"


def test_split_for_boundary():
    assert _split_for(pd.Timestamp("2006-12-31")) == "train"  # ty: ignore[invalid-argument-type]
    assert _split_for(pd.Timestamp("2007-01-01")) == "test"  # ty: ignore[invalid-argument-type]

"""
Download a data sample and verify it meets two core rules:
  1. Time-series structure (timestamp column or regular index)
  2. Has annotations / labels
"""

import io
import csv
import json
import gzip
import requests
from typing import Any


SAMPLE_BYTES = 32_768  # 32 KB — enough for CSV header + first rows
TIMEOUT = 20


def validate_dataset_url(url: str) -> dict[str, Any]:
    """
    Check if a URL is reachable. Tries HEAD first; falls back to GET (first 1KB)
    for servers that drop HEAD requests (e.g. NOAA, some GitHub redirects).
    """
    try:
        resp = requests.head(url, timeout=10, allow_redirects=True)
        if resp.ok:
            size_bytes = int(resp.headers.get("Content-Length", 0) or 0)
            return {
                "accessible": True,
                "status_code": resp.status_code,
                "size_mb": round(size_bytes / 1e6, 2),
                "content_type": resp.headers.get("Content-Type", ""),
            }
    except Exception:
        pass

    # HEAD failed or returned non-OK — try a minimal GET
    try:
        resp = requests.get(url, timeout=12, stream=True, allow_redirects=True)
        chunk = next(resp.iter_content(1024), b"")
        size_bytes = int(resp.headers.get("Content-Length", 0) or 0)
        return {
            "accessible": resp.ok,
            "status_code": resp.status_code,
            "size_mb": round(size_bytes / 1e6, 2),
            "content_type": resp.headers.get("Content-Type", ""),
            "fallback": "GET",
        }
    except Exception as e:
        return {"accessible": False, "error": str(e)}


def probe_temporal_structure(url: str) -> dict[str, Any]:
    """
    Download first SAMPLE_BYTES of a file and determine:
    - is_timeseries: has a timestamp/time column or regular numeric index
    - has_annotations: has a label/annotation/class/event column
    - columns: list of detected column names
    - sample_rows: first 3 parsed rows (for agent reasoning)
    """
    result: dict[str, Any] = {
        "url": url,
        "is_timeseries": False,
        "has_annotations": False,
        "columns": [],
        "sample_rows": [],
        "format": "unknown",
        "error": None,
    }

    try:
        resp = requests.get(url, timeout=TIMEOUT, stream=True)
        resp.raise_for_status()

        raw = b""
        for chunk in resp.iter_content(chunk_size=4096):
            raw += chunk
            if len(raw) >= SAMPLE_BYTES:
                break

        content_type = resp.headers.get("Content-Type", "")
        url_lower = url.lower()

        if url_lower.endswith(".gz"):
            try:
                raw = gzip.decompress(raw[:SAMPLE_BYTES])
            except Exception:
                pass

        if url_lower.endswith(".json") or "json" in content_type:
            result.update(_probe_json(raw))
        elif url_lower.endswith(".csv") or "text/csv" in content_type or "text/plain" in content_type:
            result.update(_probe_csv(raw))
        else:
            # Try CSV fallback for plain text
            try:
                result.update(_probe_csv(raw))
            except Exception:
                result["error"] = "Could not parse format"

    except Exception as e:
        result["error"] = str(e)

    return result


def _probe_csv(raw: bytes) -> dict[str, Any]:
    text = raw.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    columns = list(reader.fieldnames or [])
    rows = []
    for i, row in enumerate(reader):
        if i >= 3:
            break
        rows.append(dict(row))

    is_ts = _has_time_column(columns)
    has_ann = _has_annotation_column(columns)
    return {
        "format": "csv",
        "columns": columns,
        "sample_rows": rows,
        "is_timeseries": is_ts,
        "has_annotations": has_ann,
    }


def _probe_json(raw: bytes) -> dict[str, Any]:
    text = raw.decode("utf-8", errors="replace")
    # Try to parse — may be truncated, so be lenient
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try first complete JSON object/array
        try:
            bracket = text.find("[") if text.lstrip().startswith("[") else text.find("{")
            data = json.loads(text[:bracket + 1000])
        except Exception:
            return {"format": "json", "error": "Could not parse JSON"}

    if isinstance(data, list) and data:
        columns = list(data[0].keys()) if isinstance(data[0], dict) else []
        rows = data[:3]
    elif isinstance(data, dict):
        columns = list(data.keys())
        rows = [data]
    else:
        columns, rows = [], []

    is_ts = _has_time_column(columns)
    has_ann = _has_annotation_column(columns)
    return {
        "format": "json",
        "columns": columns,
        "sample_rows": rows[:3],
        "is_timeseries": is_ts,
        "has_annotations": has_ann,
    }


# Heuristics derived from ts-gym corpus patterns
_TIME_KEYWORDS = {
    "time", "timestamp", "datetime", "date", "t", "ts", "epoch",
    "seconds", "minutes", "hours", "cycle", "step", "index",
    "time_step", "elapsed", "utc", "mjd", "jd",
}

_ANNOTATION_KEYWORDS = {
    "label", "annotation", "anomaly", "event", "class", "category",
    "fault", "failure", "diagnosis", "stage", "phase", "status",
    "flag", "onset", "offset", "severity", "type", "activity",
    "condition", "target", "rul", "remaining",
}


def _has_time_column(columns: list[str]) -> bool:
    lower_cols = {c.lower().strip() for c in columns}
    return bool(lower_cols & _TIME_KEYWORDS) or any(
        any(kw in c for kw in _TIME_KEYWORDS) for c in lower_cols
    )


def _has_annotation_column(columns: list[str]) -> bool:
    lower_cols = {c.lower().strip() for c in columns}
    return bool(lower_cols & _ANNOTATION_KEYWORDS) or any(
        any(kw in c for kw in _ANNOTATION_KEYWORDS) for c in lower_cols
    )

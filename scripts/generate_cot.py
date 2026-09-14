"""Generate chain-of-thought rationales for esa/mission1-subsystem5 train-split windows.

Generalizes generate_cot_pilot.py to the full train split (or any --limit), with a thread pool for
throughput, incremental checkpointing (so a crash or rate-limit abort loses at most one batch), and
resume support (skips any record_id already present in --out or --seed-from).

Only the train split needs rationales: they become SFT targets. Test-split evaluation compares a
generated answer's final "Answer: X" against the "label" annotation already on every record, so it
needs no rationale text.

Usage:
    python scripts/generate_cot.py                       # all remaining train windows
    python scripts/generate_cot.py --limit-pairs 100      # next 100 (pos, neg) pairs only
"""

import argparse
import base64
import io
import json
from pathlib import Path
import random
import threading
import time

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import requests

from timenet.client import TimeNet

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"
REGISTRY = "/var/tmp/hrm/zurich-hackathon/timenet_registry"
DEFAULT_OUT = PROJECT_ROOT / "artifacts" / "cot_rationales.json"
DEFAULT_SEED_FROM = PROJECT_ROOT / "artifacts" / "cot_rationales_pilot.json"
MODEL = "gpt-4o"
SEED = 20260912
MAX_RETRIES = 3
CHECKPOINT_EVERY = 20


def load_api_key() -> str:
    for line in ENV_PATH.read_text().splitlines():
        if line.startswith("OPEN_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError(f"OPEN_API_KEY not found in {ENV_PATH}")


def annotation(record, key):
    for ann in record.annotations:
        if ann.key == key:
            return ann.value
    return None


def plot_window(record) -> bytes:
    series = record.time_series[0]
    values = series.to_numpy()
    offsets_hours = series.time_offsets_us() / 3_600_000_000
    channel = annotation(record, "channel")
    fig, ax = plt.subplots(figsize=(8, 3))
    ax.plot(offsets_hours, values, linewidth=0.8, color="#2563eb")
    ax.set_xlabel("hours into window")
    ax.set_ylabel(channel)
    ax.set_title(f"{channel} — {record.record_id}")
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110)
    plt.close(fig)
    return buf.getvalue()


def build_prompt(record) -> str:
    label = annotation(record, "label")
    channel = annotation(record, "channel")
    category = annotation(record, "category")
    klass = annotation(record, "class")
    context = f"This telemetry window is known to be **{label}**."
    if category:
        context += f" It is categorized as a labeled {category}" + (f" (class {klass})." if klass else ".")
    return (
        "You are an ESA spacecraft operations engineer reviewing satellite telemetry from Mission1, "
        f"subsystem_5, {channel}. The plotted window spans six hours (one hour of context before any "
        "labeled event, five after).\n\n"
        f"{context}\n\n"
        "Write a single natural paragraph (no bullet points, no headings) reasoning step by step from "
        "the visual shape of the data — level, trend, noise, spikes, drift, gaps — toward this "
        "conclusion. Do not state the label until the very last sentence. End your response with "
        'exactly one of: "Answer: nominal" or "Answer: anomalous" (no trailing period).'
    )


def call_gpt4o(api_key: str, image_bytes: bytes, prompt: str) -> str:
    b64 = base64.b64encode(image_bytes).decode("ascii")
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": MODEL,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                            ],
                        }
                    ],
                    "max_tokens": 300,
                    "temperature": 0.7,
                },
                timeout=60,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"GPT-4o call failed after {MAX_RETRIES + 1} attempts") from last_error


def load_json(path: Path) -> dict[str, str]:
    return json.loads(path.read_text()) if path.exists() else {}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit-pairs", type=int, default=None, help="Cap on (pos, neg) pairs to process.")
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--seed-from", type=Path, default=DEFAULT_SEED_FROM)
    args = parser.parse_args()

    api_key = load_api_key()
    dataset = TimeNet(registry=REGISTRY).load("esa/mission1-subsystem5")

    done = {**load_json(args.seed_from), **load_json(args.out)}
    print(f"Resuming with {len(done)} rationales already done.")

    # Generate for every anomalous/nominal pair regardless of the connector's date-based split tag:
    # rationale is applied by window id at build time independent of split, and covering the full
    # dataset means any downstream train/val/test policy (date-based or count-based) gets full CoT
    # coverage instead of falling back to a bare "Answer: X" for windows outside whatever split was
    # in fashion when this script last ran.
    all_pos = [r for r in dataset.records if annotation(r, "label") == "anomalous"]
    rng = random.Random(SEED)
    rng.shuffle(all_pos)

    records_by_id = {r.record_id: r for r in dataset.records}
    pending: list = []
    for pos in all_pos:
        neg = records_by_id.get(pos.record_id.removesuffix("-pos") + "-neg")
        if neg is None:
            continue
        for record in (pos, neg):
            if record.record_id not in done:
                pending.append(record)
        if args.limit_pairs is not None and len(pending) // 2 >= args.limit_pairs:
            break

    print(f"{len(pending)} windows left to generate.")
    if not pending:
        return

    lock = threading.Lock()
    results = dict(done)
    completed = 0

    def worker(record) -> None:
        nonlocal completed
        try:
            rationale = call_gpt4o(api_key, plot_window(record), build_prompt(record))
        except Exception as exc:  # noqa: BLE001
            print(f"  [{record.record_id}] FAILED: {exc}")
            return
        with lock:
            results[record.record_id] = rationale
            completed += 1
            if completed % CHECKPOINT_EVERY == 0:
                args.out.write_text(json.dumps(results, indent=2))
                print(f"  checkpoint: {completed}/{len(pending)} done")

    from concurrent.futures import ThreadPoolExecutor  # noqa: PLC0415

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(worker, pending))

    args.out.write_text(json.dumps(results, indent=2))
    print(f"\nWrote {len(results)} total rationales to {args.out}")


if __name__ == "__main__":
    main()

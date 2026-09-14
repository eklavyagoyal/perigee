"""Generate a pilot set of chain-of-thought rationales for esa/mission1-subsystem5 windows.

Loads the built TimeF dataset, samples a small paired (anomalous, nominal) pilot set from the train
split, plots each window, and asks GPT-4o for a reasoning paragraph ending in "Answer: nominal" or
"Answer: anomalous". The true label is given as context, so this is a hindsight rationale (the model
explains a known answer), not a blind read -- matching the plan's step 5 and OpenTSLM's own CoT
dataset convention (see HARCoTQADataset).

Writes the result as {record_id: rationale} JSON. The esa/mission1-subsystem5 connector picks it up
via the ESA_MISSION1_SUBSYSTEM5_RATIONALES environment variable on the next build.
"""

import base64
import io
import json
from pathlib import Path
import random
import time

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import requests

from timenet.client import TimeNet

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"
REGISTRY = "/var/tmp/hrm/zurich-hackathon/timenet_registry"
OUT_PATH = PROJECT_ROOT / "artifacts" / "cot_rationales_pilot.json"
MODEL = "gpt-4o"
N_PAIRS = 20  # -> 20 anomalous + 20 nominal
SEED = 20260912
MAX_RETRIES = 2


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
        'exactly one of: "Answer: nominal" or "Answer: anomalous".'
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


def main() -> None:
    api_key = load_api_key()
    dataset = TimeNet(registry=REGISTRY).load("esa/mission1-subsystem5")

    train_pos = [
        r for r in dataset.records if annotation(r, "split") == "train" and annotation(r, "label") == "anomalous"
    ]
    rng = random.Random(SEED)
    rng.shuffle(train_pos)
    chosen_pos = train_pos[:N_PAIRS]

    records_by_id = {r.record_id: r for r in dataset.records}
    pairs = []
    for pos in chosen_pos:
        neg_id = pos.record_id.removesuffix("-pos") + "-neg"
        neg = records_by_id.get(neg_id)
        if neg is not None:
            pairs.append((pos, neg))

    print(f"Generating rationales for {len(pairs)} pairs ({len(pairs) * 2} windows)...")
    rationales: dict[str, str] = {}
    for i, (pos, neg) in enumerate(pairs):
        for record in (pos, neg):
            prompt = build_prompt(record)
            image_bytes = plot_window(record)
            try:
                rationale = call_gpt4o(api_key, image_bytes, prompt)
            except Exception as exc:  # noqa: BLE001
                print(f"  [{record.record_id}] FAILED: {exc}")
                continue
            rationales[record.record_id] = rationale
            print(f"  [{i + 1}/{len(pairs)}] {record.record_id}: {rationale[:80]}...")

    OUT_PATH.write_text(json.dumps(rationales, indent=2))
    print(f"\nWrote {len(rationales)} rationales to {OUT_PATH}")


if __name__ == "__main__":
    main()

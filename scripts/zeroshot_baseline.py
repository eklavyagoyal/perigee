#!/usr/bin/env python3
"""Two-shot (no fine-tuning) baseline for the ESA Mission1 subsystem_5 anomaly task.

OpenTSLMSP's time-series encoder/projector are themselves trained during fine-tuning -- without
that training they're randomly initialized and would produce meaningless embeddings, so a true
"no fine-tuning" test can't reuse the trained encoder's *embedding* path at all. This prompts the
frozen pretrained Llama-3.2-3B directly with plain text instead: the same engineered text features
stage6_esa_cot's current prompt uses (channel, window mean/std, telecommand timing -- no
periodicity), plus the raw series itself, downsampled and written out as comma-separated numbers
(the LLMTime-style textified-series approach OpenTSLM's own evaluation/baseline scripts use for
other tasks -- see gruver_llmtime_tokenizer.py). This is the fairest way to give a frozen LLM a
genuine look at the shape TSLM's trained encoder reads, without a trained bridge into its
embedding space: if the frozen model still can't extract anomaly signal from the actual numbers,
that's real evidence of what the trained encoder specifically adds, not just an artifact of
withholding the series entirely.

Two earlier passes at this both failed in different ways:
  1. True zero-shot (no example): 111/246 rows never emitted a parseable "Answer:
     nominal/anomalous" at all -- the base, non-instruction-tuned model just echoed the
     instructions back.
  2. One-shot (a single worked example): fixed the format -- 0 unparsed -- but the model just
     copied that one example's rationale almost verbatim and always predicted its label, on every
     single test row. With this dataset's exactly-balanced test set, "always guess X" is a
     trivial, uninformative 50% accuracy, not a real classification attempt.
This version uses two examples, one of each label, real train-split rows (never the test row
itself), with short hand-written rationales (the dataset's own generated CoT rationales run
650-950+ characters, too long to serve as an in-context demo without eating the whole generation
budget before reaching "Answer:"). Two contrasting examples give the model an actual decision to
make instead of one label to parrot, and generation is still cut off right after the answer word
so it can't drift off-format.

This isolates "how much does fine-tuning + a trained time-series encoder add over a frozen
pretrained LLM given the identical textual features" -- the comparison point for slide 16's
"compare with a baseline" requirement, alongside classical_baseline.py's "how much does the LLM
add over simple statistics" comparison.

Run from the OpenTSLM directory (needs its ``src`` on the path, same conda env as training):
    python ../scripts/zeroshot_baseline.py [--limit N]
"""

import argparse
import json
import os
import sys

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, StoppingCriteria, StoppingCriteriaList

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "OpenTSLM", "src"))

from opentslm.time_series_datasets.esa_mission1.esa_mission1_cot_loader import (  # noqa: E402
    load_esa_mission1_cot_splits,
)

LLM_ID = "meta-llama/Llama-3.2-3B"
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "OpenTSLM",
    "results",
    "Llama_3_2_3B",
    "OpenTSLMSP",
    "stage6_esa_cot_zeroshot_baseline",
    "test_predictions.jsonl",
)

PRE_PROMPT = """
You are an ESA spacecraft operations engineer reviewing six hours of satellite telemetry from
Mission1, subsystem_5, {channel}. Your task is to determine whether this window is
nominal or anomalous.

Instructions:
- Reason step by step about level, trend, noise, spikes, drift, and gaps.
- Write your reasoning as a single, natural paragraph. Do not use bullet points, numbered
  steps, or section headings.
- Do not state the label until the very last sentence.
"""

POST_PROMPT = """Possible labels are:
nominal, anomalous

- Please now write your rationale. Make sure that your last word is the answer. You MUST end your response with "Answer: """


SERIES_MAX_POINTS = 120  # ~756 raw points downsampled to this many, kept short enough for a
# frozen base model's limited effective context to actually attend across the whole thing


def _series_as_text(values: list) -> str:
    """Downsample the raw series to at most SERIES_MAX_POINTS points, comma-separated.

    Evenly spaced, not just the first N, so the whole 6-hour window is represented rather than
    truncated to its opening portion. Rounded to 3 decimals -- these values are already a small,
    bounded range (see the connector), so 3 decimals keeps the digit tokens short without losing
    the shape.
    """
    n = len(values)
    if n <= SERIES_MAX_POINTS:
        sampled = values
    else:
        step = n / SERIES_MAX_POINTS
        sampled = [values[int(i * step)] for i in range(SERIES_MAX_POINTS)]
    return ", ".join(f"{v:.3f}" for v in sampled)


def _text_features(row: dict) -> str:
    mean = sum(row["values"]) / len(row["values"])
    variance = sum((v - mean) ** 2 for v in row["values"]) / len(row["values"])
    std = variance**0.5
    text = f"This is telemetry from {row['channel']}, mean {mean:.4f} and std {std:.4f} in this window."
    minutes_since_command = row.get("minutes_since_command")
    if minutes_since_command is not None:
        text += f" A priority-2-or-higher telecommand executed {minutes_since_command:.1f} minutes before this window's reference point (one hour after it begins)."
    else:
        text += " No priority-2-or-higher telecommand executed in the six hours before this window's reference point."
    text += f" The raw values, downsampled to {min(len(row['values']), SERIES_MAX_POINTS)} evenly spaced points across the window, are: {_series_as_text(row['values'])}."
    return text


def _pick_example_rows(train_rows: list) -> tuple[dict, dict]:
    """One real nominal and one real anomalous train row, neither with a telecommand annotation.

    Never test rows -- using a test example here would leak its answer format expectations back
    into the very prompt being scored on it. No telecommand annotation on either keeps both demo
    rationales focused on level/noise (the thing being demonstrated) rather than mixing in a
    second signal the demo isn't meant to teach.
    """
    anomalous_row = next(r for r in train_rows if r["label"] == "anomalous" and r.get("minutes_since_command") is None)
    nominal_row = next(r for r in train_rows if r["label"] == "nominal" and r.get("minutes_since_command") is None)
    return nominal_row, anomalous_row


_DEMO_RATIONALES = {
    "nominal": (
        "The signal stays within this channel's usual band, with a steady level and a noise "
        "floor consistent with routine operation and no unexplained drift or spikes. "
        "Answer: nominal"
    ),
    "anomalous": (
        "The signal sits at an unusually elevated level with a noise floor wider than this "
        "channel's typical band, consistent with a genuine fault rather than routine drift. "
        "Answer: anomalous"
    ),
}


def _build_example_block(row: dict) -> str:
    pre = PRE_PROMPT.format(channel=row["channel"])
    text_features = _text_features(row)
    demo_rationale = _DEMO_RATIONALES[row["label"]]
    return f"{pre}\n\n{text_features}\n\n{POST_PROMPT}\n{demo_rationale}"


class _StopOnAnswer(StoppingCriteria):
    """Stop generation as soon as the word after "Answer: " is complete.

    A base (non-instruction-tuned) model has no learned stop signal for this task, so left alone
    it keeps generating past the label into unrelated text (see the module docstring). This checks
    the tail of the decoded text after every new token and halts once "nominal" or "anomalous"
    (optionally followed by punctuation/whitespace) appears after the last "Answer:" in it.
    """

    def __init__(self, tokenizer, prompt_len: int):
        self.tokenizer = tokenizer
        self.prompt_len = prompt_len

    def __call__(self, input_ids: torch.LongTensor, scores: torch.FloatTensor, **kwargs) -> bool:
        text = self.tokenizer.decode(input_ids[0][self.prompt_len :], skip_special_tokens=True)
        tail = text.rsplit("Answer:", 1)[-1].strip().lower()
        return tail.startswith("nominal") or tail.startswith("anomalous")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Only score the first N test rows (for a quick check)")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tokenizer = AutoTokenizer.from_pretrained(LLM_ID, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(LLM_ID, torch_dtype=torch.bfloat16, device_map={"": device})
    model.eval()

    train, _, test = load_esa_mission1_cot_splits()
    nominal_row, anomalous_row = _pick_example_rows(list(train))
    example_block = f"{_build_example_block(nominal_row)}\n\n{_build_example_block(anomalous_row)}"
    print(f"Two-shot examples: {nominal_row['channel']}/nominal, {anomalous_row['channel']}/anomalous")

    rows = list(test)
    if args.limit:
        rows = rows[: args.limit]

    unparsed = 0
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as out_f:
        for i, row in enumerate(rows):
            pre = PRE_PROMPT.format(channel=row["channel"])
            text_features = _text_features(row)
            prompt = f"{example_block}\n\n{pre}\n\n{text_features}\n\n{POST_PROMPT}\n"

            inputs = tokenizer(prompt, return_tensors="pt").to(device)
            prompt_len = inputs["input_ids"].shape[1]
            stopping = StoppingCriteriaList([_StopOnAnswer(tokenizer, prompt_len)])
            with torch.no_grad():
                gen_ids = model.generate(
                    **inputs,
                    max_new_tokens=120,
                    do_sample=False,
                    pad_token_id=tokenizer.pad_token_id,
                    stopping_criteria=stopping,
                )
            generated_full = tokenizer.decode(gen_ids[0][prompt_len:], skip_special_tokens=True).strip()
            if "answer:" not in generated_full.lower():
                unparsed += 1

            out_f.write(
                json.dumps(
                    {
                        "pre_prompt": pre,
                        "time_series_text": [text_features],
                        "post_prompt": POST_PROMPT,
                        "generated": generated_full,
                        "gold": row["answer"],
                    }
                )
                + "\n"
            )
            if (i + 1) % 25 == 0:
                print(f"  {i + 1}/{len(rows)}  (unparsed so far: {unparsed})", flush=True)

    print(f"Wrote {len(rows)} predictions to {OUTPUT_PATH}  ({unparsed}/{len(rows)} unparsed)")


if __name__ == "__main__":
    main()

# Requirements checklist — vs. slides 16 & 17 (Temporal AI Challenge deck)

Source: `Aionic_Temporal_AI_Hackathon.pdf`, slides "From Problem to Proof" (16) and
"What You Get, What You Submit" (17).

## Slide 16 — From Problem to Proof

| Step | Requirement | Status | Notes |
|---|---|---|---|
| 01 Problem + Data | Target user, open data, optional agentic sourcing pipeline | ✅ | Target user is explicit in the prompt itself ("ESA spacecraft operations engineer"). Data is ESA-AD (open, Zenodo 12528696). |
| 01 Problem + Data | Agentic pipeline to search/assess/select/retrieve/validate datasets | ❌ (optional) | Not attempted — the dataset was picked manually. Optional per the slide, but also listed as a bonus point. |
| 01 Ideal Data Profile | "time-series + text reasoning over/describing it," LLM-generated annotations "as in OpenTSLM paper" | ✅ | Exact match — CoT rationales generated via `scripts/generate_cot.py`, one per window. |
| 02 Connect | TimeNet connector for signals/metadata/annotations, reusable | ✅ | Full custom connector (`mission1_subsystem5/connector.py`) emitting time series plus channel, category/class, periodicity, telecommand, and level/scale annotations. Reusable, well-documented. |
| 03 Train + Evaluate | Fine-tune a TSLM | ✅ | OpenTSLMSP (Llama-3.2-3B backbone) fine-tuned with LoRA. |
| 03 Train + Evaluate | Compare with a baseline on held-out data | ✅ | Two baselines added — see [Baseline results](#baseline-results) below. |
| 03 Train + Evaluate | Avoid leakage across time, subjects, or devices | ⚠️ | Split is 80/10/10 by anomaly-pair, shuffled with a fixed seed — deliberately *not* ESA-ADB's own date-based train/test boundary, because that date split wastes over half the labeled events. Defensible, but it does mean train/test are not strictly time-separated. Have this answer ready if asked. |
| 04 Demonstrate | Real inputs/outputs, evidence + limitations | ✅ | Real prompts and generated rationales exist (`test_predictions.jsonl`); the pitch artifact states limitations honestly (small test set, `test_loss: NaN` bug, precision/recall tradeoff). |
| 04 Demonstrate | How the result helps the target user | ⚠️ | Implicit in the prompt framing, not yet stated as an explicit takeaway for the pitch. |

## Slide 17 — What You Get, What You Submit

| Item | Status | Notes |
|---|---|---|
| Working demo | ❌ **gap** | Nothing runs live yet — only a static eval script and results artifact. Needs something that can generate a rationale on the spot in front of the jury. |
| Code + training configuration | ✅ | `curriculum_learning.py` invocation, connector, dataset loader — all present and runnable. |
| Checkpoint or adapter | ✅ | LoRA adapters saved for every run (v10/v11/v13/v14 checkpoints preserved on disk under `OpenTSLM/results/Llama_3_2_3B/OpenTSLMSP/`). |
| Dataset documentation | ✅ | Connector's module docstring is thorough (window construction, split rationale, every feature's definition). No separate README, but the docstring covers it. |
| Short evaluation with baseline comparison | ✅ | See [Baseline results](#baseline-results) below. |
| Live demo to jury | ⚠️ | Depends on building the "working demo" item above. |

### What makes a strong project

| Criterion | Status |
|---|---|
| A useful problem | ✅ |
| Thoughtful data preparation | ✅ — modality dropout, CoT generation, engineered signals, and a real ablation on what to expose in the prompt |
| Adequate TSLM training | ⚠️ — hardware-capped at `batch_size=1` on a single RTX 5090; `--gradient_checkpointing` turned out to be a no-op bug for OpenTSLMSP in `curriculum_learning.py`. Have this answer ready if asked why training looks constrained. |
| Rigorous evaluation | ✅ — real ablation methodology, category-level (Anomaly vs. Rare Event) breakdown, two baselines, statistical caution about the small test set (123 positive examples). |
| A clear demonstration | ⚠️ — good written analysis, no live demo yet |

### Bonus points

| Item | Status |
|---|---|
| Well-chosen datasets and reusable TimeNet connectors | ✅ — directly matches |
| Agentic pipelines for automated dataset search/assessment/selection/retrieval | ❌ — not attempted, legitimate missed bonus (not required) |

## Baseline results

Two baselines, run against the identical 246-row test split used for every fine-tuned run:

| Approach | Accuracy | Precision | Recall | F1 | Notes |
|---|---|---|---|---|---|
| **Zero-shot Llama-3.2-3B** (`scripts/zeroshot_baseline.py`) — no fine-tuning, no time-series encoder, text-only prompt | 23.6% overall (42.96% of the 55% it could even answer) | 0.374 | 0.896 | 0.528 | 111/246 (45%) never produced a parseable `Answer:` at all — degenerated into echoing the instructions back. Of the rows it did answer, worse than a coin flip, heavily biased toward guessing "anomalous." |
| v13 (fine-tuned, mean/std + periodicity + telecommand) | 86.99% | 1.000 | 0.740 | 0.850 | For reference — see `PITCH_REQUIREMENTS_CHECKLIST.md`'s sibling artifact for the full v10–v14 ablation. |
| v14 (fine-tuned, mean/std + telecommand, no periodicity) | 82.52% | 0.817 | 0.837 | 0.827 | |
| **Classical baseline** (`scripts/classical_baseline.py`) — logistic regression on 5 engineered numbers (`level_zscore`, `scale_ratio`, periodicity drop, telecommand presence/timing), no LLM, no GPU at inference | **89.84%** | **0.990** | 0.805 | **0.888** | Strongest predictors: `scale_ratio` (+5.43), `has_telecommand` (+3.68), periodicity drop (+1.63), `level_zscore` (−1.36). **Caveat below — not apples-to-apples with the prompt actually in use now.** |

### Apples-to-apples: the baseline vs. the *current* prompt

The prompt was later refined (`ESAMission1CoTQADataset.py`) to remove `level_zscore`, `scale_ratio`,
and the periodicity sentence as answer-leaking shortcuts — a naive threshold classifier scored
62–68% on those numbers alone. So the 5-feature classical baseline above is being compared against
an LLM that no longer sees 3 of those 5 numbers; that's not a fair comparison. Re-running the
classical baseline restricted to only what the current prompt actually states (`scripts/classical_baseline_restricted.py`:
window mean, window std, telecommand presence/timing) against the current fine-tuned model (SP,
sub-category-balanced training) gives:

| Approach (same 4 inputs: mean, std, telecommand presence/timing) | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|
| Classical logistic regression (restricted) | 86.99% | 1.000 | 0.740 | 0.850 |
| **Fine-tuned LLM (current prompt, sub-category-balanced)** | **86.99%** | 0.989 | **0.748** | **0.852** |

Under matched inputs, the two are essentially tied — the LLM edges ahead very slightly on recall
and F1 (at the cost of one false positive the classical model doesn't make). `window_std` alone
has a standardized coefficient of **+10.4** in the restricted model, dwarfing every other feature
(`has_telecommand` +2.34, `window_mean` +0.29, `minutes_since_command` −0.23) — almost this entire
task reduces to "does this window have unusually high variance."

**Honest takeaway:** fine-tuning is clearly necessary — the zero-shot base model can't even
reliably follow the output format, let alone reason about anomalies. Against a *fair*, same-inputs
baseline, the fine-tuned LLM+encoder ties a simple logistic regression rather than losing to it —
but tying is itself the finding: the trainable time-series encoder, reading the full raw 6-hour
series, isn't yet demonstrating it extracts anomaly-relevant signal beyond what `window_std` and
telecommand timing already give away as two plain numbers. The LLM's clear, undisputed value-add
remains the natural-language rationale a classical model can't produce at all — the next milestone
is closing that gap: getting the encoder to actually pull ahead on classification, not just match
it, which would be real evidence it's reading shape (trend, spikes, drift) rather than
re-deriving the same summary statistics.

## Priority before presenting

1. ~~Baseline comparison~~ — done, see above.
2. **A live/interactive demo** — something that can run in front of the jury rather than only a static report.

Everything else is either solidly covered or an optional bonus.

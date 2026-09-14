# Evaluation record

The complete measurement history for Perigee: every baseline, every fine-tuning
run, the prompt ablation, and the data-leak investigation — including the runs
that were discarded and the numbers that got worse once the split was fixed.

**The headline, on the corrected event-grouped split (224 test windows):**
OpenTSLM SP reaches **75.89%** accuracy / F1 **0.727**; a logistic regression on
the same four prompt inputs reaches **90.18%** / F1 **0.891**. The classical
baseline wins. See [Data leakage found and
fixed](#data-leakage-found-and-fixed-split-was-by-per-channel-pair-not-by-event)
for why the earlier 86.99% number should not be used.

Written during the hackathon against the challenge brief
(`challenge/`, slides "From Problem to Proof" and "What You Get, What You
Submit"), so it is structured as a requirements checklist. It is kept in that
form deliberately — it records what was and was not done at submission time.

---

## Deliverables — From Problem to Proof

| Step | Requirement | Status | Notes |
|---|---|---|---|
| 01 Problem + Data | Target user, open data, optional agentic sourcing pipeline | ✅ | Target user is explicit in the prompt itself ("ESA spacecraft operations engineer"). Data is ESA-AD (open, Zenodo 12528696). |
| 01 Problem + Data | Agentic pipeline to search/assess/select/retrieve/validate datasets | ❌ (optional) | Not attempted — the dataset was picked manually. Optional per the slide, but also listed as a bonus point. |
| 01 Ideal Data Profile | "time-series + text reasoning over/describing it," LLM-generated annotations "as in OpenTSLM paper" | ✅ | Exact match — CoT rationales generated via `scripts/generate_cot.py`, one per window. |
| 02 Connect | TimeNet connector for signals/metadata/annotations, reusable | ✅ | Full custom connector (`mission1_subsystem5/connector.py`) emitting time series plus channel, category/class, periodicity, telecommand, and level/scale annotations. Reusable, well-documented. |
| 03 Train + Evaluate | Fine-tune a TSLM | ✅ | OpenTSLMSP (Llama-3.2-3B backbone) fine-tuned with LoRA. |
| 03 Train + Evaluate | Compare with a baseline on held-out data | ✅ | Two baselines added — see [Baseline results](#baseline-results) below. |
| 03 Train + Evaluate | Avoid leakage across time, subjects, or devices | ✅ (fixed) | A real leak *was* found here — see [Data leakage found and fixed](#data-leakage-found-and-fixed-split-was-by-per-channel-pair-not-by-event) below: the same anomaly event could appear on one channel in train and a correlated channel in test. Now fixed by splitting on the shared event id. The separate temporal question (train/test aren't strictly date-separated) is still true and defensible — the split wastes over half the labeled events under ESA-ADB's own date boundary — but is a minor point next to the event-leak fix. |
| 04 Demonstrate | Real inputs/outputs, evidence + limitations | ✅ | Real prompts and generated rationales exist (`test_predictions.jsonl`); the pitch artifact states limitations honestly (small test set, `test_loss: NaN` bug, precision/recall tradeoff). |
| 04 Demonstrate | How the result helps the target user | ⚠️ | Implicit in the prompt framing, not yet stated as an explicit takeaway for the pitch. |

## Deliverables — What You Get, What You Submit

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

Three baseline variants plus the classical one, run against the identical 246-row test split used for every fine-tuned run:

| Approach | Accuracy | Precision | Recall | F1 | Notes |
|---|---|---|---|---|---|
| **Two-shot Llama-3.2-3B, text stats only** (`scripts/zeroshot_baseline.py`) — no fine-tuning, no time-series encoder, no raw series, two worked examples (one nominal, one anomalous) | 50.81% | 1.000⚠️ | 0.016 | 0.032 | Format issue from the first (true zero-shot) pass fixed: 0/246 unparsed now, vs. 111/246 before. But the base (non-instruct) model just copies one demonstration's rationale almost verbatim on 244/246 rows regardless of the actual input — a known base-model in-context-learning limitation, not a prompt bug. Recall 0.016 = 2/123 real anomalies caught. |
| **Two-shot Llama-3.2-3B, + raw series as text** (same script, series downsampled to 120 points, comma-separated, added to the prompt) | 50.41% | 1.000⚠️ | 0.008 | 0.016 | Giving the frozen model the *actual digits* changes essentially nothing — still collapses to "nominal" on 245/246 rows. This is the clean showcase of what TSLM's approach specifically adds: a frozen LLM with the raw numbers in its context still can't extract anomaly signal from them; it takes a *trained* encoder (+ fine-tuning) to turn those same numbers into something the model can act on. |
| ⚠️ **Both baselines' 1.0 precision is a different phenomenon than v13/v14's.** Here it's degenerate — the model almost never predicts "anomalous" at all (1–2 times out of 246), so the rare guess can't be wrong. v13/v14's 1.0/0.82 precision comes from confidently calling "anomalous" on 91+ different windows and being right every time. Don't present these as comparable numbers. | | | | | |
| v13 (fine-tuned, mean/std + periodicity + telecommand) | 86.99% | 1.000 | 0.740 | 0.850 | For reference — see the full v10–v14 ablation below. |
| v14 (fine-tuned, mean/std + telecommand, no periodicity) | 82.52% | 0.817 | 0.837 | 0.827 | |
| **Classical baseline** (`scripts/classical_baseline.py`) — logistic regression on 5 engineered numbers (`level_zscore`, `scale_ratio`, periodicity drop, telecommand presence/timing), no LLM, no GPU at inference | **89.84%** | **0.990** | 0.805 | **0.888** | Strongest predictors: `scale_ratio` (+5.43), `has_telecommand` (+3.68), periodicity drop (+1.63), `level_zscore` (−1.36). **Caveat below — not apples-to-apples with the prompt actually in use now.** |
| **Classical, RAW values only** (`scripts/classical_baseline_raw.py`) — logistic regression on 120 resampled raw points, zero engineered features, not even mean/std | 57.59% | 0.623 | 0.384 | 0.475 | The important negative result: a plain linear model **cannot** find the signal directly in raw digits — it needs mean/std computed *for* it (see the 90%+ restricted-features baseline above/below). This is the real bar the trained time-series encoder needs to clear: if the fine-tuned LLM (reading the raw series through its encoder) lands meaningfully above 57.59%, that's evidence the encoder does something a plain linear model over raw values fundamentally can't. |
| **Classical, window + raw 24h-context stats** (`scripts/classical_baseline_window_context.py`) — window mean/std/periodicity plus the *raw* (non-contrasted) 24h-context mean/std/periodicity, 6 features, `context_mean`/`context_std` algebraically recovered from `level_zscore`/`scale_ratio` (connector never stores them directly) | 73.21% | 0.851 | 0.562 | 0.677 | Worse than the 4-feature restricted baseline below despite more inputs. `window_std` still dominates (+10.0); every context feature is nearly useless on its own (`context_std` +0.04, `context_mean` +0.04, `context_periodicity` +0.14, `window_periodicity` −0.78) — a channel's raw context mean/std doesn't help a linear model unless it's *contrasted* against the window's own values (exactly what `level_zscore`/`scale_ratio` already do). Validates the original design choice to store the normalized contrast rather than raw context numbers. |

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

**This comparison is from the old, leaky split** (see [Data leakage found and
fixed](#data-leakage-found-and-fixed-split-was-by-per-channel-pair-not-by-event) below) and needs
redoing once the fine-tuned LLM is retrained on the fixed split. The restricted classical baseline
has already been rerun on the fixed split and *improved* to **90.18%** acc / 1.000 P / **0.804** R
/ **0.891** F1 (`window_std` coefficient essentially unchanged, +10.3).

**The fine-tuned LLM's fixed-split number is now in, and it fell — clearly, not marginally.**
SP + sub-category-balanced sampling (the same configuration that scored 86.99%/F1 0.852 on the
leaky split), retrained from scratch on the corrected 2046/192/224 split (best checkpoint at
epoch 7, val loss 0.4377, 224-row test set):

| Metric | Leaky split (old) | Fixed split (new) |
|---|---|---|
| Accuracy | 86.99% | **75.89%** (170/224) |
| Precision | 0.989 | 0.837 |
| Recall | 0.748 | **0.643** |
| F1 | 0.852 | **0.727** |

Confusion matrix (fixed split): nominal [98 correct, 14 false positives], anomalous [40 missed, 72
caught]. Category breakdown: **Rare Event recall 66.2%** (49/74), **True Anomaly recall 60.5%**
(23/38) — both dropped from their leaky-split values (75.6%/73.0%), and precision is no longer
perfect (14 real false positives, vs. 0-1 on every leaky-split run).

So the leak wasn't cosmetic: it was worth roughly **11 points of accuracy and 0.125 F1** on this
exact configuration. It also now falls clearly *behind* the fixed-split classical baseline
(90.18%/F1 0.891 vs. 75.89%/F1 0.727) — on the leaky split the two were essentially tied; on the
honest split, the encoder is now the clear loser to plain summary statistics, not a close call.
That's the real, load-bearing number for the pitch, not the leaky one.

### All fine-tuned runs on the current (refined) prompt

Every run below uses the same 246-window test set and the same refined prompt (mean/std +
telecommand only — no `level_zscore`, `scale_ratio`, or periodicity text):

| Run | Model | Accuracy | Precision | Recall | F1 | Notes |
|---|---|---|---|---|---|---|
| SP + gradient checkpointing, batch 16 | Llama-3.2-3B, LoRA | 86.18% | 1.000 | 0.724 | 0.840 | First run on the refined prompt; confirms `--gradient_checkpointing` now actually works for OpenTSLMSP (was a silent no-op before). |
| Flamingo, frozen backbone | Llama-3.1-8B | 86.59% | 1.000 | 0.732 | 0.845 | Ran on the *original* (pre-refinement) prompt, kept here for the model-size comparison — see the caveat above about not mixing prompt versions. |
| **SP + sub-category-balanced sampling** | Llama-3.2-3B, LoRA | **86.99%** | 0.989 | **0.748** | **0.852** | Best result on the refined prompt. Training batches balanced 3-way (nominal / Rare Event / True Anomaly) instead of just nominal/anomalous — True-Anomaly recall specifically improved from 67.6%→73.0%. |
| SP, refined prompt (local, `pre_levelscale`) | Llama-3.2-3B, LoRA | 87.80% | 1.000 | 0.756 | 0.861 | Best result overall so far, from a separate local run — not yet reconciled with the sub-category-balanced run above (different sampling, same prompt). |

Across every one of these, precision sits at 0.99–1.00 and recall sits at 0.72–0.76 — the model
essentially never raises a false alarm, but consistently misses roughly a quarter of real
anomalies. That pattern held before and after the sub-category rebalancing, before and after
gradient checkpointing, and across both model sizes — it looks like a property of this training
setup rather than something any single lever fixes on its own. Two candidate reasons:

1. **Checkpoint selection is by validation *loss*** (next-token cross-entropy over the whole
   rationale + answer), not by recall or F1. A checkpoint that writes fluent "everything looks
   normal" phrasing on a borderline window can score *lower* loss than one that commits to
   "anomalous" on the same ambiguous case — cross-entropy training tends to favor the safer, more
   common completion when the true evidence is weak. We're selecting for fluent text, not for
   maximizing recall.
2. **Only 736/1970 (37%) of train rows have a real generated CoT rationale** — the rest fall back
   to the bare `"Answer: <label>"` target with zero reasoning text, a real inconsistency in what
   the model is trained to produce.

Untested but easy to check: pick the "best" checkpoint by validation recall/F1 instead of
validation loss, and see whether precision drops as recall rises.

**Honest takeaway:** fine-tuning is clearly necessary — even with two balanced worked examples,
the base model can't do this classification via in-context learning at all; it collapses to
copying one demonstration's answer regardless of input, landing at a trivial ~50% on this balanced
test set. Against a *fair*, same-inputs
baseline, the fine-tuned LLM+encoder ties a simple logistic regression rather than losing to it —
but tying is itself the finding: the trainable time-series encoder, reading the full raw 6-hour
series, isn't yet demonstrating it extracts anomaly-relevant signal beyond what `window_std` and
telecommand timing already give away as two plain numbers. The LLM's clear, undisputed value-add
remains the natural-language rationale a classical model can't produce at all — the next milestone
is closing that gap: getting the encoder to actually pull ahead on classification, not just match
it, which would be real evidence it's reading shape (trend, spikes, drift) rather than
re-deriving the same summary statistics.

## Data leakage found and fixed: split was by per-channel pair, not by event

**Everything above this section was measured on the old, leaky split.** ESA labels each anomaly
*event* on every channel that recorded it — subsystem_5's six channels (41-46) all monitor the
same physical unit (`channels.csv`), so one real-world event produces a separate window-pair on
each channel that saw it, all sharing one `anomaly_id`. The old split
(`esa_mission1_cot_loader.py`) grouped by the per-channel pair key, so the *same* event could land
in train on `channel_41` and in test on `channel_42`.

**Measured**: 68 of 69 test-split anomaly events, and 64/64 val-split events, had already been
seen (on a different, correlated channel) during training. Checked whether "correlated" is doing
real work here, not just theoretical: mean absolute correlation across 1,659 same-event
channel-pairs is **0.556** (median 0.516, 26% above 0.8). The ESA-AD paper itself (Kotowski et al.
2024) describes channels within a group as *"similar in their nature... allowing correlations
within channel groups to be exploited"* — the opposite of independent, confirming this wasn't a
harmless technicality.

**Fix applied**: the loader now groups by `anomaly_id` (the shared event) instead of the
per-channel pair key, so every channel's window from one event stays entirely in one split.
Verified zero event overlap across train/val/test after the fix. New split: 2046 train / 192 val
/ 224 test rows (was 1970/246/246 — close but not identical, since events group unevenly many
pairs), still exactly 50/50 nominal:anomalous in every split.

**Reproduced on the fixed split already** (cheap, no training):

| Approach | Old split (leaky) | Fixed split (event-grouped) | Change |
|---|---|---|---|
| Classical baseline (logistic regression, 5 engineered features) | 89.84% acc / 0.990 P / 0.805 R / 0.888 F1 | **92.86%** acc / 1.000 P / **0.857** R / **0.923** F1 | Slightly *better*, not worse — this baseline uses only summary statistics, not raw series shape, so it likely wasn't benefiting much from the leak in the first place. |
| Classical baseline, restricted to current prompt's features (mean/std/telecommand) | 86.99% acc / 1.000 P / 0.740 R / 0.850 F1 | **90.18%** acc / 1.000 P / **0.804** R / **0.891** F1 | Also improved. `window_std` remains overwhelmingly dominant (+10.3). This is the number the retrained LLM should be compared against. |
| Classical baseline, RAW values only (no engineered features at all, not even mean/std) | not run on old split | 57.59% acc / 0.623 P / 0.384 R / 0.475 F1 | New this session — the real floor a trained encoder needs to clear. A plain linear model over raw digits does much worse than one given mean/std directly, showing feature engineering (even trivial mean/std) is doing real work a linear model can't replicate on its own. |
| Two-shot LLM baseline, no fine-tuning | 50.81% acc / 1.000⚠️ P / 0.016 R | 50.45% acc / 1.000⚠️ P / 0.009 R | Unchanged (expected — this baseline never trains, so the split doesn't affect it). |

**Reproduced on the fixed split**: SP + sub-category-balanced sampling (the headline candidate) —
see [the table above](#apples-to-apples-the-baseline-vs-the-current-prompt), retrained on
`zurich`'s H200. Result: 75.89% acc / 0.837 P / 0.643 R / 0.727 F1, down from 86.99%/0.852 F1 on
the leaky split, and now clearly behind the fixed-split classical baseline (90.18%/0.891 F1) —
confirms the encoder *was* benefiting from the leak on this run.

**Still not reproduced**: v10-v14 and the Flamingo/8B run. Per [`RETRAIN_ON_FIXED_SPLIT.md`](RETRAIN_ON_FIXED_SPLIT.md), these
don't need redoing unless there's spare time — the *relative* prompt-design comparisons between
them likely still hold since the leak affected every run roughly equally. Only the headline
candidate needed reproducing for the pitch, and that's now done.

## Priority before presenting

1. ~~Baseline comparison~~ — done, see above.
2. ~~Retrain the headline fine-tuned model on the fixed split~~ — done, see above. **The honest headline number for the pitch is now 75.89% acc / F1 0.727, behind the classical baseline (90.18%/F1 0.891) — not the earlier 86.99%/F1 0.852 leaky-split number.**
3. **A live/interactive demo** — something that can run in front of the jury rather than only a static report.

Everything else is either solidly covered or an optional bonus.

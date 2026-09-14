# Cluster Brief: Scaling OpenTSLM on ESA-AD Mission1 (8xH100)

**Read this whole file before touching anything.** It tells you exactly what already exists,
what has already been validated locally, and what your job is on this cluster. Do not re-derive
the plan from scratch — the pipeline below is real, working code, not a proposal.

## 1. Mission

Temporal AI Challenge (Aionic Labs × ETH Agentic Systems Lab, European Hackathon League, Zurich,
12–13 Sept 2026). Goal: give a spacecraft ops engineer a plain-language explanation of anomalous
subsystem behavior in real ESA satellite telemetry, instead of a raw anomaly flag.

We are **not** fine-tuning a generic LLM. OpenTSLM trains a dedicated time-series encoder +
projection layer that feeds a language model:
- **OpenTSLMSP** ("SoftPrompt"): LoRA-tunes the LLM too, alongside the encoder/projector. Cheap,
  good for short/single-channel data. This is what has been validated locally so far.
- **OpenTSLMFlamingo**: the LLM stays **frozen**; only a cross-attention bridge + the encoder
  train. Constant memory regardless of sequence length — the variant that benefits most from
  more GPUs, because the constraint becomes "how big a frozen backbone can I fit," not LoRA
  compute.

Your job here is to **scale up what already works**, not to reinvent it: bigger/deeper encoder,
bigger frozen backbone (Flamingo), full multi-channel/long-sequence coverage, more parallel runs,
and — importantly — build the baseline comparison and demo assets that don't exist yet (see §5, §6).

## 2. What already exists and is already validated (do not rebuild these)

Everything below has been run for real on a local RTX 5090 (32GB) and works end to end.

### 2.1 Data pipeline (TimeNet connector)
- Package: `TimeNet/packages/timenet-connectors/src/timenet_connectors/datasets/esa/mission1_subsystem5/`
  (`connector.py`, `dataset.yaml`, tests under `tests/`).
- Dataset id: `esa/mission1-subsystem5`, version `1.0.0`.
- Source: ESA-AD Mission1 (Zenodo 12528696), subsystem_5's 6 channels (`channel_41`–`channel_46`),
  the ESA-ADB benchmark's own "lightweight subset". Raw source dir env var `ESA_MISSION1_DIR`
  (default `/var/tmp/hrm/zurich-hackathon/data/ESA-Mission1`).
- Each labeled interval in `labels.csv` becomes a **6-hour window** (1h context before the labeled
  start, 5h after) labeled `"anomalous"`, paired 1:1 with a matched `"nominal"` window sampled from
  the same channel/split, clear of every labeled interval (+1h guard). This is deliberate — it
  avoids training on the raw dataset's ~1.8% anomaly imbalance. **Do not "fix" this by training
  on the raw imbalanced stream unless you're explicitly trying that as a separate experiment.**
- Split: ESA-ADB's own train/test boundary at 2007-01-01 (train records further split into
  train/val at 2006-10-01, mirroring ESA-ADB's own 84-month validation carve-out — see
  `OpenTSLM/src/opentslm/time_series_datasets/esa_mission1/esa_mission1_cot_loader.py`).
- Chain-of-thought rationales are attached by the connector as the `AnswerTask.target` when a
  rationale file is supplied via `ESA_MISSION1_SUBSYSTEM5_RATIONALES` (JSON, window id → rationale
  text). Without one, the target falls back to a bare `"Answer: <label>"`.
- **Already built**: the compiled TimeF registry lives at
  `/var/tmp/hrm/zurich-hackathon/timenet_registry/esa/mission1-subsystem5/1.0.0/` (parquet-backed:
  records, time_series, annotations, tasks, manifest.json). This is the artifact of running
  `timenet-build build esa/mission1-subsystem5`.

### 2.2 Chain-of-thought label generation
- `scripts/generate_cot.py` (full run) and `scripts/generate_cot_pilot.py` (pilot) at the repo
  root. Plots each labeled window (matplotlib), sends the plot + true label + category/class
  context to **GPT-4o** via the OpenAI API, gets back a single reasoning paragraph ending in
  exactly `"Answer: nominal"` or `"Answer: anomalous"`. Threaded, checkpointed every 20 completions,
  resumable (skips ids already in `--out`/`--seed-from`).
- Only train-split windows get rationales — they become SFT targets. Test-split evaluation just
  compares the model's own generated `"Answer: X"` against the ground-truth `label` annotation.
- **Already generated**: `cot_rationales_pilot.json` (40 rationales, pilot) and
  `cot_rationales.json` (~1.2MB, the full train-split run) at the repo root.

### 2.3 OpenTSLM dataset loader + curriculum stage
- `OpenTSLM/src/opentslm/time_series_datasets/esa_mission1/`:
  `esa_mission1_cot_loader.py` (loads the TimeNet registry, does the train/val/test split) and
  `ESAMission1CoTQADataset.py` (the `QADataset` subclass: pre/post prompts, normalizes each
  window to zero mean/unit std before handing it to the encoder, labels are
  `["nominal", "anomalous"]`).
- `OpenTSLM/curriculum_learning.py` has `stage6_esa_cot` wired into `CURRICULUM_STAGES`. Unlike
  stages 1–5 (a published 5-stage curriculum that chains checkpoints), stage6 is a **standalone
  fine-tune**: it always starts fresh (see the two `PATCH:` comments around lines 579 and 955 in
  that file) rather than continuing from stage5. LoRA is enabled for it (see
  `stages_with_lora` list, ~line 1596).
- Config: `OpenTSLM/src/opentslm/model_config.py` — `BATCH_SIZE=4`, `PATCH_SIZE=4`,
  `NUM_EPOCHS=20` (but stage6 overrides to 30), `EARLY_STOP_PAT=5`, `LR_ENCODER=2e-4`,
  `LR_PROJECTOR=1e-4`, `EMBED_DIM=ENCODER_OUTPUT_DIM=TRANSFORMER_INPUT_DIM=128`. These are
  **global** to every stage/dataset — changing them for the ESA run affects every other curriculum
  stage's default too, so if you bump encoder capacity, do it deliberately and note it.

### 2.4 A completed local training + eval run (the proof the pipeline works)
- Command that was run: `python curriculum_learning.py --model OpenTSLMSP --stages stage6_esa_cot --llm_id meta-llama/Llama-3.2-3B`
  — confirmed by the results dir naming (`_sanitize_llm_id` turns `meta-llama/Llama-3.2-3B` into
  `Llama_3_2_3B`): `OpenTSLM/results/Llama_3_2_3B/OpenTSLMSP/stage6_esa_cot/`.
- Loss history (`checkpoints/loss_history.txt`), train vs. val loss by epoch:
  ```
  Epoch  Train_Loss  Val_Loss
  1      1.457261     1.016843
  2      1.034708     0.922274
  3      0.902985     0.914660   <- best val loss, best_model.pt saved here
  4      0.785474     0.944410
  5      0.654381     1.026645
  6      0.514619     1.078706
  7      0.393118     1.262365
  8      0.295477     1.351334
  ```
  **Read this correctly**: val loss bottoms out around epoch 3 then rises while train loss keeps
  falling — classic overfitting on a small train set, and `EARLY_STOP_PAT=5` will stop it soon
  after. `checkpoints/best_model.pt` holds the epoch-3 checkpoint. **This is the single most
  important thing to fix when you scale up** — see §5.1.
- A full eval pass over the held-out test set (1230 windows, ~3.5s/window, ~72 min on one RTX
  5090) was run against the epoch-3 `best_model.pt` checkpoint. The model produces plausible,
  on-format reasoning — e.g. (real output): *"The telemetry data from channel_41 over the
  six-hour window shows a consistent and stable pattern, indicative of normal operations...
  Answer: nominal"* — but **§2.4.1 below is the actual, important result of that eval pass**, not
  this fluency sample.
- **Note**: the checkpoint, `loss_history.txt`, and the raw `test_predictions_rank_0.jsonl` from
  this run have since been deleted locally (superseded by a retrain — see §2.4.1/§5.1). The loss
  table above and the recall numbers in §2.4.1 are the record of what that run showed; don't go
  looking for the files.

### 2.4.1 Real finding from that eval pass: the epoch-3 checkpoint is recall-biased toward "nominal"

Scoring the full test-set eval against ground truth (with `scripts/score_predictions.py` — parses
each generated `"Answer: nominal/anomalous"`, compares to the loader's ground-truth `label`, prints
a confusion matrix + precision/recall/F1 for the anomalous class; works on a partial predictions
file too, since eval writes incrementally) found the model calls out only **38 of 198** real
anomalies (heavily biased toward predicting `"nominal"`). This is a genuine finding about the
checkpoint, not a bug in the eval code:

- `best_model.pt` was selected by **lowest validation loss** (epoch 3, §2.4's table), i.e. by how
  well the model reproduces the CoT rationale's *wording*. That is not the same objective as
  anomaly-detection accuracy — a model can nail fluent, plausible-sounding reasoning while still
  defaulting to the majority-sounding answer at decision time.
- Val loss keeps rising after epoch 3 while train loss keeps falling (§2.4) — that's consistent
  with fluency/wording overfitting, not necessarily a loss of classification skill. It's plausible
  a later, "worse-by-loss" epoch actually classifies better, since by then it had seen more
  gradient signal on the harder anomalous examples. This was **not verified** — only the single
  best checkpoint was saved (no per-epoch snapshots), so testing that theory would need a rerun
  with checkpointing at every epoch, which wasn't done given the time cost.
- The training set is already 50/50 nominal/anomalous **by construction** (§2.1 — the connector
  pairs each anomalous window with one matched nominal window), so this isn't a raw class-imbalance
  problem in the usual sense. A retrain was kicked off locally (on this same machine, so check
  before starting anything else that needs the GPU) to see whether the recall bias persists or
  improves; re-score whatever it produces with `scripts/score_predictions.py` before trusting any
  new checkpoint's recall number. If it's still poor, the more likely lever is the
  checkpoint-selection-by-loss issue above — select by held-out recall/F1 instead of validation
  loss, which needs per-epoch checkpointing (not implemented yet).

### 2.5 What is NOT done yet (this is real, not scaffolding you can skip)
- **No baseline comparison** (plan's step 7). `OpenTSLM/evaluation/opentslm/` has baseline
  evaluators for other datasets (`sleep/`, `tsqa/`, `ecg_qa_cot/`) but nothing for ESA yet. You
  need to build one, following that pattern — see §6.
- **No demo** (plan's step 8): telemetry plot + model explanation + connector story.
- Mission2 is untouched. Only Mission1 subsystem_5's 6 channels are covered.
- Only `OpenTSLMSP` + `Llama-3.2-3B` has been trained. `OpenTSLMFlamingo` has not been tried on
  this dataset at all.

## 3. Getting the actual state onto this cluster

**The code is now on GitHub — clone it, don't rsync it.** Everything in §2 (the TimeNet connector,
the OpenTSLM dataset loader + `stage6_esa_cot`, the CoT scripts/labels, `CLUSTER_BRIEF.md`, and the
scoring/sync scripts) is committed on branch `hackathon-submission` of:

```
git@github.com:eklavyagoyal/ehl-zurich-hackathon-submission.git
```

```bash
git clone --branch hackathon-submission git@github.com:eklavyagoyal/ehl-zurich-hackathon-submission.git
```

Notes on what you're getting:
- `OpenTSLM`, `TimeNet`, and `ESA-ADB` are **flattened plain directories in this repo**, not git
  submodules — they started as forks with their own git history (`OpenTSLM` from
  `StanfordBDHG/OpenTSLM`, `TimeNet` from `OpenTSLM/TimeNet`, `ESA-ADB` from `kplabs-pl/ESA-ADB`),
  but all the ESA-specific work was uncommitted local changes on top of those clones, so they were
  de-gitted and committed as regular files to make sure that work actually ships. You lose their
  separate git history/identity as a result — if you need to diff against upstream, `git clone` the
  original fork separately and diff by hand.
- `.gitignore` excludes `.env`, model weight files (`*.pt`/`*.safetensors`/`*.ckpt`/`*.bin`),
  `__pycache__/`, and `.venv/`. None of those are in the clone — see below for what to do about
  each.
- **Not in the repo, still needs manual transfer**: the compiled TimeNet registry
  (`/var/tmp/hrm/zurich-hackathon/timenet_registry/`, ~2MB), any trained checkpoint
  (`OpenTSLM/results/.../checkpoints/best_model.pt`, ~308MB, excluded by `.gitignore`), and the raw
  ESA-AD Mission1 extract (3.6GB, only needed to rebuild/widen the connector). Run
  `scripts/sync_to_cluster.sh <user>@<cluster-host> [--with-checkpoint] [--with-raw-data]` **from
  the original source machine** (not the cluster) to rsync these — it no longer copies the repo
  itself (that's what the git clone above is for), just these three data tiers. It prints the exact
  `export ESA_MISSION1_SUBSYSTEM5_REGISTRY=...` / `ESA_MISSION1_DIR=...` lines to run afterward; the
  connector/loader's hardcoded path defaults point at the *source machine's* paths, not the
  cluster's, so skipping this means every load silently fails to find the data here.
- `ESA_MISSION1_SUBSYSTEM5_RATIONALES` should point at `cot_rationales.json` inside your clone
  (it's committed, no transfer needed for it).
- `.env`'s real `OPEN_API_KEY` / `HF_TOKEN` values need to be supplied fresh on the cluster (they
  were deliberately excluded from git) before anything that calls the OpenAI API or downloads a
  gated HF model.

Once cloned and the data tiers above are in place, `cd TimeNet && make sync` (uv workspace) and set
up the OpenTSLM env per its `requirements.txt` / `pyproject.toml`. `huggingface-cli login` (or set
`HF_TOKEN`) — Llama-3.2-3B access was already granted for the account behind the source machine's
token; using a different HF account may need a fresh Meta access request.

**Gap not covered by either package's own config**: neither `OpenTSLM/requirements.txt` nor
`OpenTSLM/pyproject.toml` declares a dependency on `timenet`/`timenet-connectors`, but
`esa_mission1_cot_loader.py` imports `timenet.client` directly. After `uv sync --all-groups` inside
`OpenTSLM/`, also run (from `OpenTSLM/`):
```bash
uv pip install -e ../TimeNet/packages/timenet -e ../TimeNet/packages/timenet-connectors
```
Skipping this fails with `ModuleNotFoundError: No module named 'timenet'` the moment you try to load
the ESA dataset.

## 4. Hardware reality check

Local validation ran on **one RTX 5090 (32GB)**. This cluster has **8xH100 (80GB each)** — ~20x
the aggregate memory and meaningfully faster per-GPU compute. Concretely that means: much larger
batch sizes, a much bigger frozen backbone for Flamingo, and multi-GPU parallelism that the code
already supports (`curriculum_learning.py` wires up `torch.distributed` + DDP: `--dist_url`,
`--dist_backend nccl`, `--local_rank`, reads `LOCAL_RANK`/`WORLD_SIZE` from env — launch with
`torchrun --nproc_per_node=8 curriculum_learning.py ...`).

## 5. What to actually do, in priority order

### 5.1 Fix the recall bias first (cheap, do this before scaling anything)
The epoch-3 checkpoint overfits by epoch 4 (§2.4) and, worse, only catches 38/198 real anomalies
(§2.4.1). Before spending H100-hours on bigger models, get a clean, less-biased result on the same
small model so you have a real comparison baseline. Check the state of the local retrain mentioned
in §2.4.1 first — it may already have produced a new checkpoint by the time you read this, in
which case re-score it with `scripts/score_predictions.py` before doing anything else:
- Since the training set is already 50/50 by construction (§2.1), a plain per-batch balanced
  sampler (e.g. `opentslm.time_series_datasets.pamap2.BalancedBatchSampler`, already in the
  codebase for PAMAP2, not currently wired into `stage6_esa_cot`) targets mini-batch variance, not
  dataset-level imbalance — worth trying, but don't assume it's the dominant fix.
- More likely dominant cause: checkpoint selection by validation loss (§2.4.1) rewards fluent
  wording over decision accuracy. The more direct fix is checkpointing every epoch (not just the
  best-by-loss one) and picking the checkpoint by held-out recall/F1 instead — a change to
  `_train_stage`'s checkpoint-selection logic.
- Also worth trying regardless: more regularization (lower LR, higher weight decay, dropout in the
  encoder) or a lower LoRA rank, since the loss curve alone shows overfitting independent of the
  recall issue.

### 5.2 Scale the encoder (works for both SP and Flamingo)
`model_config.py`'s `EMBED_DIM`/`TRANSFORMER_INPUT_DIM`/`ENCODER_OUTPUT_DIM=128`, `PATCH_SIZE=4`
are small. `TransformerCNNEncoder` (`OpenTSLM/src/opentslm/model/encoder/TransformerCNNEncoder.py`)
defaults to 6 layers / 8 heads / ff_dim 1024 on top of that. With 8xH100 headroom:
- Try a wider embed dim (256–512) and/or more encoder layers/heads — this is the part that
  determines how much signal from the raw telemetry survives before reaching the LLM.
- These are global constants shared with every other curriculum stage — if you change them,
  either accept that stages 1–5 would need retraining too, or fork a stage6-specific encoder
  config path instead of mutating the shared defaults blindly.

### 5.3 Try OpenTSLMFlamingo with a bigger frozen backbone
This is where 8xH100 pays off most directly, since the LLM in Flamingo is frozen — only the
cross-attention bridge + encoder train:
```
torchrun --nproc_per_node=8 curriculum_learning.py --model OpenTSLMFlamingo \
  --stages stage6_esa_cot --llm_id meta-llama/Llama-3.1-8B --gradient_checkpointing
```
**Caveat, read before doing this**: per `OpenTSLM/README.md`, only `Llama-3.2-1B/3B` and
`gemma-3-270m/1b-pt` are "tested and works" — "other variants may work but have not been
extensively tested." `OpenTSLMFlamingo.__init__` (`OpenTSLM/src/opentslm/model/llm/OpenTSLMFlamingo.py`)
inserts cross-attention layers via `open_flamingo`'s `FlamingoLMMixin`, which depends on the
target model's decoder layer naming (`decoder_layers_attr_name`) — this is very likely to need
debugging for an untested backbone. Staying within the Llama family (try `Llama-3.1-8B` before
jumping to a 70B-class model) reduces that risk. Budget real debugging time for this, and don't
let it block the SP-based scale-up in 5.1/5.2, which is much lower risk.

### 5.4 Run multiple variants in parallel
With 8 GPUs you don't have to serialize experiments. Reasonable split: 1–2 GPUs on the SP
regularization fix (5.1), 2 GPUs on encoder scaling (5.2), and the rest on the Flamingo attempt
(5.3), so a Flamingo failure doesn't cost you the safer SP improvements.

### 5.5 Larger batch size
`BATCH_SIZE=4` in `model_config.py` was sized for 32GB. On 80GB H100s (and especially with
gradient checkpointing off), push this up via `--batch_size` — larger batches matter here because
the paired sampling already balances the 1.8% raw anomaly rate, but more windows per step still
means less noisy gradients on a fairly small dataset.

## 6. Build the missing baseline (plan's step 7 — genuinely not done)

Follow the existing pattern in `OpenTSLM/evaluation/opentslm/` (e.g. `sleep/`, `tsqa/`,
`ecg_qa_cot/` each have a `get_*_predictions.py` / `parse_*_data.py` pair) and
`OpenTSLM/evaluation/baseline/` (e.g. `evaluate_sleep_cot.py`, `openai_pipeline.py`) to build an
ESA-specific baseline: a frozen LLM given the same telemetry window as text-tokenized numbers (no
learned encoder), asked the same nominal/anomalous question, to produce a comparison number
against OpenTSLM's learned-encoder approach. This is explicitly one of the two things the jury
scores (the other being the connector/data-sourcing story), so don't skip it even if a bigger
Flamingo run is tempting.

## 7. Deliverables to bring back for the demo (plan's step 8)

- A trained checkpoint (ideally beating the local `Llama-3.2-3B` + SP run's val loss of ~0.91,
  without the epoch-4+ overfitting) plus its `loss_history.txt` and `test_predictions_rank_0.jsonl`.
- The baseline comparison number from §6.
- 2–3 concrete telemetry windows (plot + ground truth + model's generated rationale) that read
  well for a live demo — pull good/bad/borderline examples from `test_predictions_rank_0.jsonl`
  style output, not cherry-picked training data.
- One clear before/after or SP-vs-Flamingo-vs-baseline comparison figure.

## 8. Reference paths

| What | Path |
|---|---|
| TimeNet connector | `TimeNet/packages/timenet-connectors/src/timenet_connectors/datasets/esa/mission1_subsystem5/` |
| Compiled registry | `/var/tmp/hrm/zurich-hackathon/timenet_registry/esa/mission1-subsystem5/1.0.0/` |
| Raw ESA-AD Mission1 data | `/var/tmp/hrm/zurich-hackathon/data/ESA-Mission1/` |
| CoT generation script | `scripts/generate_cot.py`, `scripts/generate_cot_pilot.py` |
| Generated CoT labels | `cot_rationales.json`, `cot_rationales_pilot.json` (repo root) |
| OpenTSLM dataset loader | `OpenTSLM/src/opentslm/time_series_datasets/esa_mission1/` |
| Curriculum entrypoint | `OpenTSLM/curriculum_learning.py` (`--stages stage6_esa_cot`) |
| Global model/training config | `OpenTSLM/src/opentslm/model_config.py` |
| Checkpoint + logs (being regenerated by a local retrain, §2.4.1) | `OpenTSLM/results/Llama_3_2_3B/OpenTSLMSP/stage6_esa_cot/` |
| Baseline eval patterns to copy | `OpenTSLM/evaluation/opentslm/`, `OpenTSLM/evaluation/baseline/` |
| Project plan (original framing) | `plan.md` (repo root) |

## 9. Time budget

This is a 17-hour hackathon window; the pipeline validation above already consumed a chunk of it.
Reserve the last 3–4 hours, non-negotiable, for the demo (§7). If the Flamingo/bigger-backbone
attempt (§5.3) isn't clearly working with a few hours of margin left before the demo cutoff, fall
back to the improved SP run (§5.1/5.2) as the headline result — it's lower-risk and already
proven to train end to end.

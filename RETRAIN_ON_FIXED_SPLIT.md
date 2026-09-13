# Task: retrain the fine-tuned LLM(s) on the corrected train/val/test split

## Context you need

This is the ESA Mission1 subsystem_5 anomaly-detection hackathon project (OpenTSLM fine-tuned to
classify 6-hour spacecraft telemetry windows as nominal/anomalous with a written rationale, for
the Zurich "Temporal AI Challenge" hackathon). Repo root:
`/u/halle/hrm/home_at/Documents/Hackathons/zurich-hackathon/`.

**A data-leakage bug in the train/val/test split was just fixed, and every fine-tuned model
result reported so far (v10 through v14, the sub-category-balanced run, the Flamingo/8B run —
see `PITCH_REQUIREMENTS_CHECKLIST.md` for the full history) was trained and evaluated on the
*old, leaky* split. Those numbers are no longer trustworthy and need to be reproduced on the
fixed split before they go in the final pitch.**

### The bug, and the fix already applied

ESA labels each anomaly *event* on every channel that recorded it — subsystem_5's six channels
(41-46) all monitor the same physical unit (`channels.csv`), so one real-world event produces a
separate `pos`/`neg` window-pair on each channel that saw it, all sharing one `anomaly_id`
annotation. The old split (`OpenTSLM/src/opentslm/time_series_datasets/esa_mission1/esa_mission1_cot_loader.py`)
grouped by the per-channel pair key, so the *same* event could land in train on `channel_41` and
in test on `channel_42`. Measured: 68 of 69 test-split anomaly events, and 64/64 val-split
events, had already been seen (on a different, correlated channel — ~0.56 mean absolute
correlation across same-event channel pairs, confirmed empirically) during training. That's a
real, if partial, leak: not identical data, but strongly correlated re-exposure to the same event.

**Already fixed in the loader**: it now groups by `anomaly_id` (the shared event id) instead of
by per-channel pair key, so every channel's window from one event stays entirely within one
split. Verified zero event overlap across train/val/test after the fix. New split sizes: 2046
train / 192 val / 224 test rows (was 1970/246/246 — close, not identical, since events group
unevenly many pairs). Every split is still exactly 50/50 nominal:anomalous.

**Already reproduced on the fixed split** (cheap, no GPU training needed, done in this session):
- Classical baseline (`scripts/classical_baseline.py`, logistic regression on 5 engineered
  features): **92.86%** accuracy, precision 1.000, recall 0.857, F1 0.923 (was 89.84%/0.990/0.805/0.888
  on the old split — went up slightly, not down, likely because this baseline uses only summary
  statistics, not raw series shape, so it probably wasn't benefiting much from the leak in the
  first place).
- Two-shot LLM baseline (`scripts/zeroshot_baseline.py`, no fine-tuning): being rerun in parallel,
  check `PITCH_REQUIREMENTS_CHECKLIST.md` for the latest number if it's not there yet, this
  should complete quickly (a few minutes, no training).

**What's NOT yet done, and is your job**: every *fine-tuned* result needs to be reproduced on the
fixed split, since those are the numbers that actually matter for the pitch and are most likely to
have benefited from the leak (a trained time-series encoder reading raw shape is exactly the kind
of thing that could exploit cross-channel correlation on a repeated event).

## What to do

1. **Read `PITCH_REQUIREMENTS_CHECKLIST.md` in full first** — it has the complete history of every
   run so far (v10-v14 prompt-design ablation, the sub-category-balanced sampler, the
   gradient-checkpointing fix, the Flamingo/8B comparison), what's already covered vs. gapped
   against the hackathon's requirements slides, and the baseline results. Don't re-derive any of
   that from scratch; build on it.

2. **Confirm the split fix is intact** before training: run this from `OpenTSLM/`:
   ```
   python3 -c "
   import sys; sys.path.insert(0, 'src')
   from opentslm.time_series_datasets.esa_mission1.esa_mission1_cot_loader import load_esa_mission1_cot_splits
   train, val, test = load_esa_mission1_cot_splits()
   print(len(train), len(val), len(test))
   "
   ```
   Expect `2046 192 224`. If you see `1970 246 246` instead, the loader has been reverted —
   check git status / diff on `esa_mission1_cot_loader.py` before proceeding.

3. **Retrain at minimum the model you intend to present as "the" headline result.** Per the
   checklist, the best candidate on the *old* split was either the sub-category-balanced SP run
   (86.99% acc, 0.989 precision, 0.748 recall) or v14 (mean/std + telecommand only, no
   periodicity — 82.52% acc, 0.817 precision, 0.837 recall, the higher-recall option). Check
   `PITCH_REQUIREMENTS_CHECKLIST.md`'s "All fine-tuned runs" table and the sibling pitch artifact
   for the exact current prompt design and hyperparameters before picking which to reproduce —
   don't guess; the prompt in `ESAMission1CoTQADataset.py` is the source of truth for what's
   "current."

   Launch command pattern (from `OpenTSLM/`, in the `tslm` conda env):
   ```
   source /u/halle/hrm/home_at/miniconda3/etc/profile.d/conda.sh
   conda activate /var/tmp/hrm/zurich-hackathon/envs/tslm
   PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True python curriculum_learning.py \
     --model OpenTSLMSP --stages stage6_esa_cot --llm_id meta-llama/Llama-3.2-3B --batch_size 1
   ```
   Notes learned the hard way this session:
   - `batch_size` **must** be 1 on this machine's single RTX 5090 (32GB) — batch_size 2 and 4 both
     OOM even with `--gradient_checkpointing`, which per the checklist is now actually wired up
     for OpenTSLMSP (previously a silent no-op) but still isn't enough alone at this dataset's
     effective sequence length.
   - `curriculum_learning.py` **skips a stage entirely** if `results/Llama_3_2_3B/OpenTSLMSP/stage6_esa_cot/results/metrics.json`
     already has `"completed": true` from a previous eval-only run — delete/move that dir's
     `checkpoints/` and `results/` subdirs before a fresh training run, or it'll silently no-op in
     seconds.
   - Check `nvidia-smi --query-compute-apps=pid,used_memory,process_name --format=csv` before
     launching — this GPU is shared with other users on this machine (non-`hrm` processes are
     normal and fine to coexist with, they use minimal VRAM; just confirm nothing from `hrm` is
     already running a competing job first).
   - The model picks the "best" checkpoint by validation *loss*, not recall/F1 — this is a
     documented, unexplained-but-real property of why precision sits near 1.0 across every run
     while recall sits around 0.72-0.86 (see the checklist's "why precision" discussion). Not
     something to fix as part of this task, just don't be surprised by it.
   - `metrics.json`'s `test_loss` field reports `NaN` on every run (a known, unresolved upstream
     bug) — always score real accuracy/recall/F1/precision via:
     ```
     python scripts/score_predictions.py --predictions OpenTSLM/results/Llama_3_2_3B/OpenTSLMSP/stage6_esa_cot/results/test_predictions.jsonl
     ```
     (run from repo root), never from `metrics.json` directly.
   - Back up each completed run's `results/Llama_3_2_3B/OpenTSLMSP/stage6_esa_cot/` directory with
     a descriptive suffixed name (see existing examples like
     `stage6_esa_cot_v13_paperconvention_<timestamp>/`) before starting the next run, since a
     fresh run overwrites checkpoints/results in place.

4. **Report back**: accuracy/precision/recall/F1 (via `score_predictions.py`, not `metrics.json`),
   the confusion matrix, and ideally the Anomaly-vs-Rare-Event category miss-rate breakdown (see
   the checklist for the pattern — cross-reference test-set false negatives against each row's
   ESA `category` annotation, "Anomaly" vs "Rare Event", via the TimeNet client the same way
   earlier category breakdowns in this project were computed).

5. **Update `PITCH_REQUIREMENTS_CHECKLIST.md`** with the new, fixed-split numbers, clearly
   labeled as "fixed split" vs. the old numbers (which should stay in the doc but be clearly
   marked as measured under the leaky split, for transparency, not deleted).

## What you do NOT need to do

- Don't redo the full v10-v14 prompt-design ablation from scratch on the new split unless you
  have a lot of spare time — those *relative* comparisons (what to put in the prompt) likely still
  hold reasonably well since the leak affected every run roughly equally. Reproducing just the
  current best/final candidate is the priority.
- Don't touch `classical_baseline.py` or `zeroshot_baseline.py` results — those are already
  reproduced on the fixed split (see above).
- Don't re-investigate the leak itself or re-derive the fix — it's done and verified (step 2 above
  confirms it).

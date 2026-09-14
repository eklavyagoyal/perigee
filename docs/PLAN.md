# Temporal AI Challenge — Project Plan

**Track:** Aionic Labs × ETH Agentic Systems Lab, European Hackathon League, Zurich (12–13 Sept 2026)
**Goal:** Fine-tune a Time-Series Language Model (TSLM) on real data via TimeNet, producing a working demo + baseline comparison.

---

## Dataset: ESA Anomaly Dataset (ESA-AD)

- **Source:** Airbus Defence and Space, KP Labs, and ESA's European Space Operations Centre
- **Content:** real satellite telemetry from 3 ESA missions, with curated anomaly annotations
- **Scale:** ~11.6 GB total (Mission1: 3.8GB, Mission2: 4.1GB, Mission3: 3.7GB); 700M+ timestamped records; Mission1 has 76 channels (58 monitored for anomalies), Mission2 has 100 (47 monitored); ~17.5 years of anonymized telemetry
- **Anomaly density:** low (~1.8%) — real fault data, not balanced
- **Splits:** standardized train/val/test splits already provided, split to avoid time leakage
- **License:** CC BY 3.0 IGO — open, attribution required
- **Caveat:** no natural-language explanations exist — only anomaly flags/timestamps. These must be generated synthetically.
- **Mission3 is excluded** from the official benchmark (too few/trivial anomalies, many gaps) — focus on Mission1 (a "lightweight subset" is specifically recommended for manageable, visualizable experiments) and/or Mission2.
- Links: [Data (Zenodo)](https://zenodo.org/records/12528696) · [Paper](https://arxiv.org/abs/2406.17826) · [Code (ESA-ADB)](https://github.com/kplabs-pl/ESA-ADB) · [Kaggle challenge](https://www.kaggle.com/competitions/esa-adb-challenge)

## Background: OpenTSLM

- Treats time series as a native input modality (not tokenized text or plots) via a dedicated encoder + projection layer feeding an LLM
- Two variants: **SoftPrompt** (LoRA fine-tune, cheaper, better for short/single-channel data) and **Flamingo** (frozen LLM + cross-attention, constant memory regardless of sequence length, better for long/multi-channel data)
- Output is always text: a reasoning paragraph ending in `Answer: <label>`
- Reference: [arXiv:2510.02410](https://arxiv.org/abs/2510.02410) · [github.com/StanfordBDHG/OpenTSLM](https://github.com/StanfordBDHG/OpenTSLM)

## Role of TimeNet

- A data-standardization library/CLI (not a training tool) that converts raw datasets into a common **TimeF** format
- Core objects: **Dataset → Records → TimeSeries + Annotations/Tasks**
- Bringing in ESA-AD requires writing a custom **connector** (`download()` + `convert()`), modeled on the existing `chengsenwang/tsqa` example
- Writing a clean, reusable connector is explicitly valued in the challenge's scoring criteria

---

## Execution Plan

1. **Frame the problem and target user** — e.g., a spacecraft ops engineer gets a plain-language explanation of anomalous behavior in one subsystem, instead of a raw anomaly flag. Narrow to one subsystem on Mission1's lightweight subset.
2. **Pull a bounded data slice** — Mission1 only; pick target channels for the chosen subsystem; use the existing train/val/test split; extract labeled anomaly windows plus matched nominal windows (don't train on the raw 1.8% imbalance).
3. **Design the task schema** — decide the exact question/answer format the model will learn (e.g., "Is this window nominal or anomalous, and why?"), before writing any code.
4. **Build the TimeNet connector** — parse channel CSVs + annotations into TimeSeries/Records/AnswerTasks. Budget real hours here; it's the reusable-pipeline scoring bonus.
5. **Generate CoT reasoning labels** — plot each window, send plot + true label + context to GPT-4o/Claude, get a reasoning paragraph ending in `Answer: X`. Parallelize with step 4.
6. **Fine-tune OpenTSLM** — Llama-3.2-3B + SoftPrompt (LoRA) as the default; iterate fast on the local 5090, scale up via Nebius credits once the pipeline is validated.
7. **Evaluate against a baseline** — compare against a frozen LLM given text-tokenized time series, or an existing ESA-ADB benchmark method with no explanation.
8. **Build the demo** — show a real telemetry window, the model's explanation, and the data-sourcing/connector story (both are explicitly scored by the jury).

## Time Budget (24h)

| Steps | Time |
|---|---|
| 1–3: Framing + data slicing | 2–3h |
| 4: TimeNet connector | 4–5h |
| 5: CoT label generation | 1–2h (parallel with step 4) |
| 6: Fine-tuning + iteration | 4–6h |
| 7: Evaluation | 2h |
| 8: Demo + pitch | 3–4h (reserved, non-negotiable) |

**Risk note:** if the connector overruns, fall back to a manual pandas loader to keep the fine-tuning/demo on track, and finish the connector as a stretch goal — don't let the scoring bonus jeopardize the core deliverable.
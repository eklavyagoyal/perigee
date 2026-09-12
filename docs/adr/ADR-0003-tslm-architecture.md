# ADR-0003: TSLM Architecture Choice (Flamingo vs SoftPrompt)

**Status:** proposed  
**Date:** 2026-09-12  
**Step:** 3 — Train + Evaluate  
**Deciders:** Team (pending dataset selection)

---

## Context

OpenTSLM provides two architectures:

**OpenTSLM-SoftPrompt (SP)**
- Time-series → PatchEncoder → TransformerEncoder → MLP projection → prepended as soft tokens to the LLM input
- Memory: scales with sequence length × number of series (bad for long signals)
- Best for: short sequences, fewer channels, single series

**OpenTSLM-Flamingo**
- Time-series → PatchEncoder → PerceiverResampler → fixed-size latent → injected via gated cross-attention every N LLM layers
- Memory: constant regardless of series length or count
- Best for: long sequences, multivariate (12-lead ECG, 55-channel telemetry, 3-axis IMU)

From the paper (Table 2): Flamingo outperforms SoftPrompt on ECG-QA-CoT (40.25 vs 32.84 F1) and scales better to long and multi-series inputs. SoftPrompt wins on TSQA (simple short synthetic series).

---

## Decision

**Pending dataset selection from ADR-0001/0002 hunt.**

Expected decision tree:
- If chosen dataset has sequences > 1000 timesteps OR > 3 channels → **Flamingo**
- If chosen dataset has sequences < 500 timesteps AND single channel → **SoftPrompt**

Space datasets (SMAP: 55 channels, long missions) and wind turbine SCADA (10+ channels) both point toward **Flamingo**.

---

## Encoder options

| Option | Tradeoff |
|--------|----------|
| PatchTST from scratch | More control, requires more GPU hours; best for novel domain |
| Frozen Chronos-2 | Faster to start; paper shows +3-5 F1 on most tasks; no domain-specific pretraining |

Recommendation: start with **Chronos-2 as frozen encoder** (zero extra training cost), then fine-tune encoder if eval plateau is hit.

---

## This ADR will be updated

Once `run_hunt.py` selects the final dataset, update status to `accepted` and fill in the specific architecture config (patch size, number of latents, LLM backbone, LoRA rank).

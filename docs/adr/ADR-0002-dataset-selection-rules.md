# ADR-0002: Two Non-Negotiable Dataset Rules

**Status:** accepted  
**Date:** 2026-09-12  
**Step:** 1 — Problem + Data  
**Deciders:** Team

---

## Context

Before running the agentic hunter, we need objective accept/reject rules for any candidate dataset. Without explicit rules the agent could score a static snapshot dataset highly based on description alone.

The organizers state the dataset must support "temporal signals" and "useful tasks where people act on signals". The OpenTSLM paper (the reference architecture) requires both raw time-series and supervision signal (labels, annotations, or QA pairs) to generate CoT rationales.

---

## Decision

Two rules that **both** must pass (verified by downloading a 32KB sample):

**Rule 1 — Time-series structure**  
The dataset file must contain a timestamp column, a regular time index, or sequential measurements. Detected by checking column names against a keyword set: `{time, timestamp, datetime, cycle, step, epoch, elapsed, mjd, ...}`.

**Rule 2 — Annotations exist**  
The dataset must have at least one column with labels, anomaly flags, event spans, activity classes, or ground-truth targets. Detected by keyword set: `{label, anomaly, event, fault, class, stage, rul, activity, flag, ...}`.

These keyword sets were derived by inspecting the ts-gym corpus datasets (which all satisfy both rules by design).

**Implementation:** `pipeline/step1_hunt/tools/dataset_validator.py` — `probe_temporal_structure()`

---

## Alternatives Considered

| Option | Rejected because |
|--------|-----------------|
| Trust dataset description only | Descriptions are often wrong or aspirational |
| Download the full dataset to check | Too slow for 15-20 candidates in one hunt session |
| Use LLM to judge from metadata alone | Non-reproducible; same metadata can score differently across runs |

---

## Consequences

- Rules are implemented as keyword heuristics — may miss datasets with non-standard column names (e.g., `ch1`, `sensor_001`)
- Mitigation: the agent also receives the raw column list and can override the flag in `score_dataset` with its own judgment
- These rules become the acceptance criteria in Step 2 (TimeNet connector) and Step 3 (training split)

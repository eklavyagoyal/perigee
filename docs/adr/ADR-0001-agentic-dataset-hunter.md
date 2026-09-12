# ADR-0001: Agentic Dataset Hunter for Step 1

**Status:** accepted  
**Date:** 2026-09-12  
**Step:** 1 — Problem + Data  
**Deciders:** Team

---

## Context

The challenge asks us to source an open time-series dataset for a useful task. The organizers provide a 60-dataset ts-gym corpus but explicitly say we should not use it. We need to find something differentiated that:
- Has temporal structure (required)
- Has annotations/labels (required)
- Is open for ML training
- Has a clear user who acts on predictions
- Is novel vs the corpus (bonus)

We could either manually pick a dataset or build an agentic pipeline that discovers, validates, and ranks datasets autonomously.

---

## Decision

Build a **Claude-powered agentic dataset hunter** that:
1. Searches HuggingFace Hub, Zenodo, and NASA Open Data Portal
2. Actually downloads a 32KB sample of each candidate file to confirm temporal structure and annotations
3. Scores candidates with a deterministic weighted rubric
4. Generates problem statements and CoT examples for top-5
5. Outputs a ranked report

**Entry point:** `pipeline/run_hunt.py`  
**Model:** `gpt-4o` (OpenAI, switched from Anthropic for API key availability)  
**Tool-use budget:** 25 calls max (bounded to avoid runaway cost)

---

## Domains Covered

| Domain | Why |
|--------|-----|
| Wind turbine health | Industrial, clear O&M user, SCADA datasets on Zenodo |
| Mental health wearables | Clinical user, GLOBEM/TILES are open, not in corpus |
| Traffic congestion | City ops user, METR-LA/LargeST on HuggingFace |
| Space satellite anomaly | NASA SMAP/MSL — canonical spacecraft anomaly benchmark, not in corpus |
| Space observation | TESS, GOES X-ray flux, GAIA — all open, distinct from corpus's ASAS-SN/ZTF |

---

## Alternatives Considered

| Option | Rejected because |
|--------|-----------------|
| Manual dataset selection | Less reproducible, misses the hackathon bonus for agentic pipelines |
| Use ts-gym corpus anyway | Explicitly excluded cause dont wanna use something thats given |


---

## Consequences

- **Good:** Pipeline is reusable — any new domain can be added by updating `nasa_search.py` seed catalog
- **Good:** Download validation catches dead links and format mismatches early
- **Risk:** HuggingFace/Zenodo rate limits may slow Phase 1; mitigated by hardcoded seed catalog
- **Risk:** Agent may exhaust 25-call budget before full framing; mitigated by phases with explicit budgets

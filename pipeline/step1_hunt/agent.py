"""
Core agentic loop — OpenAI tool-use driving dataset discovery.

Phases:
  1. DISCOVERY  — search HF, Zenodo, NASA (≤10 tool calls)
  2. VALIDATION — probe temporal structure + score (≤8 tool calls)
  3. FRAMING    — propose problem statements for top-5 (≤5 tool calls)

Reproducibility:
  - temperature=0 + seed=42 makes LLM decisions deterministic
  - Search API results cached to outputs/search_cache.json on first run
  - Pass use_cache=False (--no-cache) to force fresh searches

Completeness:
  - Every score_dataset and probe_temporal_structure call is tracked server-side
  - all_candidates in the final report is built from Python state, not LLM memory
  - LLM forgetting to list a dataset no longer causes it to disappear from output
"""

import json
from typing import Any

from openai import OpenAI

from .prompts import SYSTEM_PROMPT
from .scorer import score as deterministic_score
from .tools.registry import TOOLS
from .tools.hf_search import search_huggingface_datasets
from .tools.zenodo_search import search_zenodo
from .tools.nasa_search import search_nasa_datasets
from .tools.dataset_validator import validate_dataset_url, probe_temporal_structure
from .tools.search_cache import cached_search, load_cache

MODEL = "gpt-4o"
MAX_TOOL_CALLS = 40
TEMPERATURE = 0   # deterministic: same input → same tool-call sequence
SEED = 42         # OpenAI system_fingerprint reproducibility seed

_CACHEABLE = {
    "search_huggingface_datasets": search_huggingface_datasets,
    "search_zenodo": search_zenodo,
    "search_nasa_datasets": search_nasa_datasets,
}


def _dispatch(
    tool_name: str,
    tool_input: dict[str, Any],
    cache: dict,
    use_cache: bool,
    # Mutable trackers — populated as side-effects so run_hunt owns all_candidates
    probe_registry: dict[str, dict],   # url → probe result
    score_registry: dict[str, dict],   # dataset name → scored entry
) -> Any:
    """Route a tool call and track probe/score results server-side."""

    if tool_name in _CACHEABLE:
        return cached_search(
            fn=_CACHEABLE[tool_name],
            fn_name=tool_name,
            kwargs=tool_input,
            cache=cache,
            use_cache=use_cache,
        )

    if tool_name == "validate_dataset_url":
        return validate_dataset_url(**tool_input)

    if tool_name == "probe_temporal_structure":
        result = probe_temporal_structure(**tool_input)
        # Store keyed by URL so score_dataset calls can look it up by name later
        probe_registry[tool_input["url"]] = result
        return result

    if tool_name == "score_dataset":
        scored = deterministic_score(
            name=tool_input["name"],
            domain=tool_input["domain"],
            has_labels=tool_input["has_labels"],
            is_timeseries=tool_input["is_timeseries"],
            license=tool_input["license"],
            size_mb=tool_input["size_mb"],
            cot_notes=tool_input["cot_notes"],
            in_tsgym_corpus=tool_input.get("in_tsgym_corpus", False),
        )
        api_result = {
            "total": scored.total,
            "normalized": scored.normalized,
            "breakdown": scored.breakdown,
        }
        # Track every scored dataset — this is the source of truth for all_candidates
        score_registry[tool_input["name"]] = {
            "name": tool_input["name"],
            "domain": tool_input["domain"],
            "score": scored.normalized,
            "score_breakdown": scored.breakdown,
            "license": tool_input.get("license", ""),
            "size_mb": tool_input.get("size_mb", 0),
        }
        return api_result

    if tool_name == "propose_problem_statement":
        name = tool_input.get("name", "")
        # Merge framing fields into the tracked entry if it exists
        if name in score_registry:
            score_registry[name]["signals"] = tool_input.get("signals", [])
            score_registry[name]["label_type"] = tool_input.get("label_type", "")
        return {
            "instruction": (
                "Generate the problem_statement, user_story, cot_example, and timenet_task "
                "fields for this dataset and include them in your final JSON output."
            ),
            "dataset": tool_input,
        }

    return {"error": f"Unknown tool: {tool_name}"}


def _merge_candidates(
    parsed: dict,
    score_registry: dict[str, dict],
    probe_registry: dict[str, dict],
) -> dict:
    """
    Replace all_candidates in the LLM's output with the server-tracked version.
    This ensures all scored datasets appear regardless of LLM memory.
    """
    # Build complete candidate list from server state
    server_candidates = sorted(
        score_registry.values(), key=lambda d: d["score"], reverse=True
    )

    # Attach probe results where available (match by URL stored in top_datasets)
    llm_candidates = {c["name"]: c for c in parsed.get("all_candidates", [])}
    for candidate in server_candidates:
        name = candidate["name"]
        # Pull url and probe_result from the LLM output if it included them
        if name in llm_candidates:
            candidate.setdefault("url", llm_candidates[name].get("url", ""))
            candidate.setdefault("probe_result", llm_candidates[name].get("probe_result", {}))

    parsed["all_candidates"] = server_candidates
    return parsed


def run_hunt(verbose: bool = True, use_cache: bool = True) -> dict[str, Any]:
    """
    Run the agentic dataset hunt.

    Args:
        verbose:   Stream tool calls to stdout.
        use_cache: Use cached search results (default True). False rebuilds cache.

    Returns:
        Dict with all_candidates (every scored dataset), top_datasets, recommendation.
    """
    client = OpenAI()
    cache = load_cache()
    probe_registry: dict[str, dict] = {}
    score_registry: dict[str, dict] = {}

    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Hunt for the best open time-series dataset for our TSLM hackathon project. "
                "Cover all 5 domains: wind_turbine, mental_health, traffic, space_anomaly, space_observation. "
                "Follow the 3-phase workflow, validate that each candidate dataset actually has "
                "time-series structure and annotations by probing sample files, then rank and "
                "propose problem statements for the top 5. Output the final JSON block."
            ),
        },
    ]
    tool_calls_made = 0

    if verbose:
        cache_status = "using cache" if (use_cache and cache) else "fresh search"
        print(f"\n{'='*60}")
        print(f"AGENTIC DATASET HUNTER — {cache_status}")
        print(f"Model: {MODEL} | temperature={TEMPERATURE} | seed={SEED} | max_calls={MAX_TOOL_CALLS}")
        print(f"{'='*60}\n")

    final_text = ""

    while tool_calls_made < MAX_TOOL_CALLS:
        response = client.chat.completions.create(
            model=MODEL,
            tools=TOOLS,
            tool_choice="auto",
            messages=messages,
            temperature=TEMPERATURE,
            seed=SEED,
        )

        msg = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

        if msg.content:
            final_text = msg.content
            if verbose and msg.content.strip():
                print(f"[AGENT] {msg.content[:300]}{'...' if len(msg.content) > 300 else ''}\n")

        messages.append(msg)

        if finish_reason == "stop" or not msg.tool_calls:
            break

        for tc in msg.tool_calls:
            tool_calls_made += 1
            tool_name = tc.function.name
            tool_input = json.loads(tc.function.arguments)

            if verbose:
                cached_tag = "[cached]" if (use_cache and _is_cache_hit(tool_name, tool_input, cache)) else ""
                print(f"[TOOL #{tool_calls_made}] {tool_name}({json.dumps(tool_input)[:100]}) {cached_tag}")

            result = _dispatch(tool_name, tool_input, cache, use_cache, probe_registry, score_registry)
            result_str = json.dumps(result, default=str)

            if verbose:
                print(f"  → {result_str[:200]}{'...' if len(result_str) > 200 else ''}")

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result_str,
            })

    if verbose:
        print(f"\n{'='*60}")
        print(f"Hunt complete. Tool calls used: {tool_calls_made}/{MAX_TOOL_CALLS}")
        print(f"Datasets scored: {len(score_registry)}")
        print(f"{'='*60}\n")

    from .report import extract_json_result
    parsed = extract_json_result(final_text) or {"raw_agent_output": final_text}

    # Always override all_candidates with server-tracked data — never trust LLM memory
    return _merge_candidates(parsed, score_registry, probe_registry)


def _is_cache_hit(fn_name: str, kwargs: dict, cache: dict) -> bool:
    import hashlib
    payload = json.dumps({"fn": fn_name, "kwargs": kwargs}, sort_keys=True)
    return hashlib.md5(payload.encode()).hexdigest() in cache

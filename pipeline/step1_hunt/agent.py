"""
Core agentic loop — OpenAI tool-use driving dataset discovery.

Phases:
  1. DISCOVERY  — search HF, Zenodo, NASA (≤10 tool calls)
  2. VALIDATION — probe temporal structure + score (≤8 tool calls)
  3. FRAMING    — propose problem statements for top-5 (≤5 tool calls)
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

MODEL = "gpt-4o"
MAX_TOOL_CALLS = 25  # hard cap across all phases


def _dispatch(tool_name: str, tool_input: dict[str, Any]) -> Any:
    """Route a tool call from the agent to the correct Python function."""
    if tool_name == "search_huggingface_datasets":
        return search_huggingface_datasets(**tool_input)

    if tool_name == "search_zenodo":
        return search_zenodo(**tool_input)

    if tool_name == "search_nasa_datasets":
        return search_nasa_datasets(**tool_input)

    if tool_name == "validate_dataset_url":
        return validate_dataset_url(**tool_input)

    if tool_name == "probe_temporal_structure":
        return probe_temporal_structure(**tool_input)

    if tool_name == "score_dataset":
        result = deterministic_score(
            name=tool_input["name"],
            domain=tool_input["domain"],
            has_labels=tool_input["has_labels"],
            is_timeseries=tool_input["is_timeseries"],
            license=tool_input["license"],
            size_mb=tool_input["size_mb"],
            cot_notes=tool_input["cot_notes"],
            in_tsgym_corpus=tool_input.get("in_tsgym_corpus", False),
        )
        return {
            "total": result.total,
            "normalized": result.normalized,
            "breakdown": result.breakdown,
        }

    if tool_name == "propose_problem_statement":
        # Handled by the LLM — return instruction to embed result in final JSON
        return {
            "instruction": (
                "Generate the problem_statement, user_story, cot_example, and timenet_task "
                "fields for this dataset and include them in your final JSON output."
            ),
            "dataset": tool_input,
        }

    return {"error": f"Unknown tool: {tool_name}"}


def run_hunt(verbose: bool = True) -> dict[str, Any]:
    """
    Run the agentic dataset hunt.
    Returns the parsed result dict from the agent's final message.
    """
    client = OpenAI()
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
        print(f"\n{'='*60}")
        print("AGENTIC DATASET HUNTER — starting")
        print(f"Model: {MODEL} | Max tool calls: {MAX_TOOL_CALLS}")
        print(f"{'='*60}\n")

    final_text = ""

    while tool_calls_made < MAX_TOOL_CALLS:
        response = client.chat.completions.create(
            model=MODEL,
            tools=TOOLS,
            tool_choice="auto",
            messages=messages,
        )

        msg = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

        # Collect text content
        if msg.content:
            final_text = msg.content
            if verbose and msg.content.strip():
                print(f"[AGENT] {msg.content[:300]}{'...' if len(msg.content) > 300 else ''}\n")

        # Append assistant message (with tool_calls if any)
        messages.append(msg)

        # If no tool calls or stop, agent is done
        if finish_reason == "stop" or not msg.tool_calls:
            break

        # Execute tool calls and collect results
        for tc in msg.tool_calls:
            tool_calls_made += 1
            tool_name = tc.function.name
            tool_input = json.loads(tc.function.arguments)

            if verbose:
                print(f"[TOOL #{tool_calls_made}] {tool_name}({json.dumps(tool_input)[:120]})")

            result = _dispatch(tool_name, tool_input)
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
        print(f"{'='*60}\n")

    from .report import extract_json_result
    parsed = extract_json_result(final_text)
    return parsed or {"raw_agent_output": final_text, "tool_calls_made": tool_calls_made}

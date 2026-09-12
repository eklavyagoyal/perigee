"""Write hunt results to JSON and markdown."""

import json
import re
from datetime import datetime, timezone
from pathlib import Path


def extract_json_result(agent_text: str) -> dict | None:
    """Pull the JSON block from the agent's final message."""
    pattern = r"```json\s*(.*?)\s*```"
    match = re.search(pattern, agent_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # Fallback: try to find raw JSON object
    try:
        start = agent_text.index("{")
        return json.loads(agent_text[start:])
    except (ValueError, json.JSONDecodeError):
        return None


def write_reports(result: dict, output_dir: Path) -> tuple[Path, Path]:
    """Write JSON and markdown reports. Returns (json_path, md_path)."""
    output_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    json_path = output_dir / f"hunt_results_{ts}.json"
    md_path = output_dir / f"hunt_report_{ts}.md"

    result["run_timestamp"] = ts
    json_path.write_text(json.dumps(result, indent=2))

    md_path.write_text(_render_markdown(result))
    return json_path, md_path


def _render_markdown(result: dict) -> str:
    lines = [
        "# Dataset Hunt Report",
        f"_Generated: {result.get('run_timestamp', 'unknown')}_\n",
    ]

    rec = result.get("recommendation", "")
    if rec:
        lines += ["## Recommendation\n", rec, ""]

    for ds in result.get("top_datasets", []):
        rank = ds.get("rank", "?")
        name = ds.get("name", "unknown")
        score = ds.get("score", 0)
        domain = ds.get("domain", "")
        url = ds.get("url", "")

        lines += [
            f"---\n## #{rank} — {name}",
            f"**Domain:** {domain} | **Score:** {score}/10 | [Dataset link]({url})\n",
        ]

        if ps := ds.get("problem_statement"):
            lines += ["**Problem Statement**\n", ps, ""]

        if us := ds.get("user_story"):
            lines += ["**User Story**\n", us, ""]

        if cot := ds.get("cot_example"):
            lines += ["**Chain-of-Thought Example**\n", f"```\n{cot}\n```", ""]

        if task := ds.get("timenet_task"):
            lines += [f"**TimeNet Task:** `{task}`\n"]

        if breakdown := ds.get("score_breakdown"):
            lines += ["**Score Breakdown**"]
            for k, v in breakdown.items():
                lines.append(f"- {k}: {v}")
            lines.append("")

        if probe := ds.get("probe_result"):
            lines += [
                "**Data Probe**",
                f"- is_timeseries: {probe.get('is_timeseries')}",
                f"- has_annotations: {probe.get('has_annotations')}",
                f"- columns: {probe.get('columns', [])}",
                "",
            ]

    return "\n".join(lines)

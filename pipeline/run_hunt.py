#!/usr/bin/env python3
"""
Step 1: Agentic Dataset Hunter

Usage:
    python run_hunt.py [--quiet] [--output-dir ./outputs]

Requires ANTHROPIC_API_KEY in environment.
"""

import argparse
import os
import sys
from pathlib import Path

# Allow running from the pipeline/ directory or repo root
sys.path.insert(0, str(Path(__file__).parent))

from step1_hunt.agent import run_hunt
from step1_hunt.report import write_reports


def main() -> None:
    parser = argparse.ArgumentParser(description="Agentic time-series dataset hunter")
    parser.add_argument("--quiet", action="store_true", help="Suppress agent streaming output")
    parser.add_argument("--output-dir", default="outputs", help="Directory for reports (default: outputs/)")
    parser.add_argument("--no-cache", action="store_true", help="Force fresh API searches, rebuild cache")
    args = parser.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        print("ERROR: OPENAI_API_KEY environment variable not set.", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output_dir)
    verbose = not args.quiet

    print("Starting dataset hunt across 5 domains...")
    print("Domains: wind_turbine | mental_health | traffic | space_anomaly | space_observation\n")

    result = run_hunt(verbose=verbose, use_cache=not args.no_cache)

    if "error" in result:
        print(f"\nAgent returned an error: {result['error']}", file=sys.stderr)
        sys.exit(1)

    json_path, md_path = write_reports(result, output_dir)

    print(f"\nResults written to:")
    print(f"  JSON: {json_path}")
    print(f"  Markdown: {md_path}")

    top = result.get("top_datasets", [])
    if top:
        winner = top[0]
        print(f"\nTop pick: {winner.get('name')} (score: {winner.get('score')}/10)")
        print(f"Domain:   {winner.get('domain')}")
        print(f"Problem:  {str(winner.get('problem_statement', ''))[:120]}...")


if __name__ == "__main__":
    main()

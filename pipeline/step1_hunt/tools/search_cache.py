"""
Disk cache for search API results.

On first run: calls the live API and saves results to cache/search_cache.json.
On subsequent runs: loads from cache so the candidate pool is identical.

Pass --no-cache to run_hunt.py to force a fresh search.
"""

import json
import hashlib
from pathlib import Path
from typing import Any, Callable

CACHE_PATH = Path(__file__).parent.parent.parent / "outputs" / "search_cache.json"


def _cache_key(fn_name: str, kwargs: dict) -> str:
    payload = json.dumps({"fn": fn_name, "kwargs": kwargs}, sort_keys=True)
    return hashlib.md5(payload.encode()).hexdigest()


def load_cache() -> dict[str, Any]:
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text())
        except Exception:
            return {}
    return {}


def save_cache(cache: dict[str, Any]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, indent=2, default=str))


def cached_search(
    fn: Callable,
    fn_name: str,
    kwargs: dict,
    cache: dict[str, Any],
    use_cache: bool = True,
) -> Any:
    """
    Call fn(**kwargs), using disk cache if available and use_cache=True.
    Updates cache in-place and returns the result.
    """
    key = _cache_key(fn_name, kwargs)
    if use_cache and key in cache:
        return cache[key]

    result = fn(**kwargs)
    cache[key] = result
    save_cache(cache)
    return result

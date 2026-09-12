"""HuggingFace Hub dataset search tool."""

from huggingface_hub import HfApi
from typing import Any


def search_huggingface_datasets(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search HuggingFace Hub for time-series datasets matching a query."""
    api = HfApi()
    results = []

    try:
        datasets = api.list_datasets(
            search=query,
            limit=limit,
            sort="downloads",
            direction=-1,
        )
        for ds in datasets:
            results.append({
                "name": ds.id,
                "url": f"https://huggingface.co/datasets/{ds.id}",
                "downloads": getattr(ds, "downloads", 0),
                "tags": list(ds.tags or []),
                "description": _get_card_description(ds),
                "source": "huggingface",
            })
    except Exception as e:
        results.append({"error": str(e), "source": "huggingface"})

    return results


def _get_card_description(ds) -> str:
    try:
        from huggingface_hub import DatasetCard
        card = DatasetCard.load(ds.id)
        text = card.text or ""
        # Return first 500 chars of card text as description
        return text[:500].replace("\n", " ").strip()
    except Exception:
        return ""

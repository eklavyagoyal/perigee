"""Zenodo REST API search — no auth required for public records."""

import requests
from typing import Any

ZENODO_API = "https://zenodo.org/api/records"


def search_zenodo(query: str, limit: int = 8) -> list[dict[str, Any]]:
    """Search Zenodo for open time-series datasets matching a query."""
    params = {
        "q": f"{query} filetype:csv OR filetype:parquet OR filetype:hdf5",
        "size": limit,
        "sort": "mostrecent",
        "type": "dataset",
        "access_right": "open",
    }
    try:
        resp = requests.get(ZENODO_API, params=params, timeout=15)
        resp.raise_for_status()
        hits = resp.json().get("hits", {}).get("hits", [])
    except Exception as e:
        return [{"error": str(e), "source": "zenodo"}]

    results = []
    for hit in hits:
        meta = hit.get("metadata", {})
        files = hit.get("files", [])
        file_info = _summarize_files(files)
        results.append({
            "name": meta.get("title", ""),
            "doi": hit.get("doi", ""),
            "url": hit.get("links", {}).get("html", ""),
            "description": (meta.get("description") or "")[:400],
            "license": _extract_license(meta),
            "size_mb": file_info["total_mb"],
            "file_types": file_info["types"],
            "sample_file_url": file_info["first_url"],
            "source": "zenodo",
        })
    return results


def _summarize_files(files: list) -> dict:
    total = 0
    types: set[str] = set()
    first_url = ""
    for f in files:
        size = f.get("size", 0) or 0
        total += size
        fname = f.get("key", "")
        ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
        if ext:
            types.add(ext)
        if not first_url and ext in {"csv", "parquet", "h5", "hdf5", "json", "gz"}:
            first_url = f.get("links", {}).get("self", "")
    return {
        "total_mb": round(total / 1e6, 1),
        "types": list(types),
        "first_url": first_url,
    }


def _extract_license(meta: dict) -> str:
    lic = meta.get("license", {})
    if isinstance(lic, dict):
        return lic.get("id", "unknown")
    return str(lic) if lic else "unknown"

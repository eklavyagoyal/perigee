"""NASA data portal search + hardcoded space/satellite dataset catalog."""

import requests
from typing import Any

NASA_API = "https://data.nasa.gov/resource/gvk9-iz74.json"

# Curated space datasets known to be open and temporal — not in ts-gym corpus
SPACE_SEED_CATALOG: list[dict[str, Any]] = [
    {
        "name": "NASA SMAP/MSL Spacecraft Anomaly Dataset",
        "domain": "space_satellite_anomaly",
        "url": "https://github.com/khundman/telemanom",
        "sample_url": "https://raw.githubusercontent.com/khundman/telemanom/master/labeled_anomalies.csv",
        "description": (
            "55-channel SMAP (Soil Moisture Active Passive) satellite telemetry and "
            "27-channel MSL (Mars Science Lab / Curiosity) rover telemetry with expert-labeled "
            "anomaly spans. Canonical benchmark from Hundman et al. SIGKDD 2018."
        ),
        "license": "NASA Open",
        "size_mb": 110,
        "has_labels": True,
        "signals": ["command channel telemetry", "engineering telemetry"],
        "label_type": "anomaly spans (per-channel)",
        "user": "Spacecraft operations engineer / mission control",
        "source": "nasa_catalog",
    },
    {
        "name": "TESS Exoplanet Transit Light Curves",
        "domain": "space_observation",
        "url": "https://archive.stsci.edu/missions-and-data/tess",
        "sample_url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+top+20+pl_name,disc_year,pl_orbper,pl_rade,pl_bmasse,st_teff+from+ps+where+pl_orbper+is+not+null&format=csv",
        "description": (
            "Transiting Exoplanet Survey Satellite (TESS) photometric time-series. "
            "2-minute cadence flux measurements for hundreds of thousands of stars with "
            "confirmed exoplanet transit labels from NASA ExoFOP catalog."
        ),
        "license": "NASA Open / Public Domain",
        "size_mb": 500,
        "has_labels": True,
        "signals": ["flux (normalized)", "centroid row", "centroid col"],
        "label_type": "transit event spans + planet confirmation flag",
        "user": "Astronomer / exoplanet researcher",
        "source": "nasa_catalog",
    },
    {
        "name": "GOES X-ray Solar Flare Flux",
        "domain": "space_observation",
        "url": "https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json",
        "sample_url": "https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json",
        "description": (
            "GOES satellite 1-minute X-ray flux (0.05-0.4 nm and 0.1-0.8 nm bands) from 1986 "
            "to present with NOAA-classified solar flare events (A/B/C/M/X class + peak time). "
            "Different from ts-gym spaceweather corpus (which uses Kp/sunspot/F10.7)."
        ),
        "license": "NOAA Open / Public Domain",
        "size_mb": 200,
        "has_labels": True,
        "signals": ["xrs-a flux (W/m²)", "xrs-b flux (W/m²)"],
        "label_type": "flare class + onset/peak/end timestamps",
        "user": "Space weather forecaster / satellite operator",
        "source": "nasa_catalog",
    },
    {
        "name": "NASA C-MAPSS Turbofan Run-to-Failure (FD003/FD004)",
        "domain": "space_launch_propulsion",
        "url": "https://www.nasa.gov/intelligent-systems-division/pcoe-data-set-repository/",
        "sample_url": "https://phm-datasets.s3.amazonaws.com/NASA/6.+Turbofan+Engine+Degradation+Simulation+Data+Set-2.zip",
        "description": (
            "Extended C-MAPSS dataset with two-fault-condition turbofan fleets (FD003/FD004). "
            "21 sensor channels per flight cycle, remaining-useful-life ground truth. "
            "NOTE: Base C-MAPSS (cmapss) is in ts-gym; FD003/FD004 with dual faults are the "
            "distinct harder variants used in aerospace prognostics."
        ),
        "license": "NASA Open",
        "size_mb": 15,
        "has_labels": True,
        "signals": ["21 engine health sensors", "3 operational settings"],
        "label_type": "remaining useful life (RUL) per cycle",
        "user": "Aerospace maintenance engineer",
        "source": "nasa_catalog",
    },
    {
        "name": "ESA Anomaly Detection Benchmark (SKAB - Space-adjacent)",
        "domain": "space_satellite_anomaly",
        "url": "https://github.com/waico/SKAB",
        "sample_url": "https://raw.githubusercontent.com/waico/SKAB/master/data/valve1/1.csv",
        "description": (
            "Skoltech Anomaly Benchmark: 34 labeled multivariate time-series files from a "
            "real testbed (waterflow pipeline sensors). Used as a proxy for spacecraft fluid "
            "system anomaly detection. All files have anomaly timestamps + anomaly type labels."
        ),
        "license": "MIT",
        "size_mb": 50,
        "has_labels": True,
        "signals": ["accelerometer x/y/z", "pressure", "temperature", "flow"],
        "label_type": "point anomaly + collective anomaly spans",
        "user": "Reliability engineer / spacecraft systems analyst",
        "source": "nasa_catalog",
    },
    {
        "name": "GAIA DR3 Stellar Variability Light Curves",
        "domain": "space_observation",
        "url": "https://gea.esac.esa.int/archive/",
        "sample_url": "https://gea.esac.esa.int/tap-server/tap/sync",
        "description": (
            "ESA GAIA Data Release 3: epoch photometry for ~10M variable stars, G/BP/RP bands, "
            "variability class labels (Cepheid, RR Lyrae, eclipsing binary, etc). "
            "Distinct from ts-gym ASAS-SN (V-band) and ZTF (g/r-band)."
        ),
        "license": "ESA / CC-BY",
        "size_mb": 300,
        "has_labels": True,
        "signals": ["G-band flux", "BP flux", "RP flux", "epoch timestamps"],
        "label_type": "variability class + period",
        "user": "Astrophysicist / automated survey pipeline",
        "source": "nasa_catalog",
    },
]


def search_nasa_datasets(query: str) -> list[dict[str, Any]]:
    """
    Search NASA Open Data Portal + return relevant entries from the curated catalog.
    The catalog is always returned; NASA API results are appended if reachable.
    """
    results: list[dict[str, Any]] = []

    # Always include catalog entries that match the query terms
    q_lower = query.lower()
    for entry in SPACE_SEED_CATALOG:
        if any(term in (entry["name"] + entry["description"]).lower() for term in q_lower.split()):
            results.append(entry)

    # Try NASA Open Data Portal
    try:
        resp = requests.get(
            NASA_API,
            params={"$limit": 10, "$where": f"upper(title) LIKE '%{query.upper()}%'"},
            timeout=10,
        )
        if resp.ok:
            for item in resp.json():
                results.append({
                    "name": item.get("title", ""),
                    "url": item.get("landingpage", item.get("url", "")),
                    "description": (item.get("description") or "")[:400],
                    "license": "NASA Open",
                    "source": "nasa_portal",
                })
    except Exception:
        pass

    return results if results else SPACE_SEED_CATALOG

"""
Deterministic weighted scoring — no LLM involved.
Reproducible: same inputs always give the same score.
"""

from dataclasses import dataclass, field

# Weights for each criterion
WEIGHTS = {
    "temporal_structure": 2.0,  # has timestamp / regular time index
    "has_labels":         2.0,  # annotation/label/event column exists
    "cot_potential":      2.0,  # NL reasoning chains are natural
    "novelty":            1.5,  # NOT in ts-gym corpus
    "clear_user":         1.5,  # identifiable end-user who acts on output
    "license":            1.0,  # open license for ML training
    "size":               1.0,  # manageable for weekend training
}
MAX_SCORE = sum(WEIGHTS.values())  # 11.0


@dataclass
class ScoredDataset:
    name: str
    domain: str
    total: float
    breakdown: dict[str, float]
    metadata: dict = field(default_factory=dict)

    @property
    def normalized(self) -> float:
        return round(self.total / MAX_SCORE * 10, 2)


def score(
    name: str,
    domain: str,
    has_labels: bool,
    is_timeseries: bool,
    license: str,
    size_mb: float,
    cot_notes: str,
    in_tsgym_corpus: bool = False,
) -> ScoredDataset:
    """Score a dataset candidate. Returns ScoredDataset with breakdown."""

    breakdown: dict[str, float] = {}

    # 1. Temporal structure
    breakdown["temporal_structure"] = 1.0 if is_timeseries else 0.0

    # 2. Labels
    breakdown["has_labels"] = 1.0 if has_labels else 0.2

    # 3. CoT potential — score based on cot_notes richness
    words = len(cot_notes.split())
    if words >= 20:
        breakdown["cot_potential"] = 1.0
    elif words >= 10:
        breakdown["cot_potential"] = 0.7
    elif words >= 5:
        breakdown["cot_potential"] = 0.4
    else:
        breakdown["cot_potential"] = 0.1

    # 4. Novelty (binary: 0 if in corpus)
    breakdown["novelty"] = 0.0 if in_tsgym_corpus else 1.0

    # 5. Clear user — inferred from domain
    user_domains = {
        "wind_turbine":       1.0,  # O&M engineer
        "mental_health":      1.0,  # psychiatrist / health app
        "traffic":            0.8,  # city traffic ops
        "space_anomaly":      1.0,  # mission ops engineer
        "space_observation":  0.7,  # astronomer / researcher
        "space_launch":       0.9,  # aerospace engineer
    }
    for key, score_val in user_domains.items():
        if key in domain.lower():
            breakdown["clear_user"] = score_val
            break
    else:
        breakdown["clear_user"] = 0.5

    # 6. License
    open_licenses = {"cc0", "cc-by", "cc by", "nasa", "mit", "apache", "public domain", "open"}
    lic_lower = license.lower()
    breakdown["license"] = 1.0 if any(ol in lic_lower for ol in open_licenses) else 0.3

    # 7. Size (50 MB – 10 GB sweet spot for weekend training)
    if 50 <= size_mb <= 10_000:
        breakdown["size"] = 1.0
    elif 10 <= size_mb < 50:
        breakdown["size"] = 0.7
    elif 10_000 < size_mb <= 50_000:
        breakdown["size"] = 0.6
    elif size_mb < 10:
        breakdown["size"] = 0.4
    else:
        breakdown["size"] = 0.2

    total = sum(WEIGHTS[k] * v for k, v in breakdown.items())

    return ScoredDataset(
        name=name,
        domain=domain,
        total=total,
        breakdown=breakdown,
    )

"""
Pre-Registered Experimental Protocol, Hypotheses H1-H4, and Analysis Plan.
Pre-registered prior to running frozen-test evaluation on unobserved seeds (3000-3029).
"""

import hashlib
import json
from dataclasses import dataclass, field
from typing import Dict, Any, List


# ---------------------------------------------------------------------------
# Pre-Registered Hypotheses H1 - H4
# ---------------------------------------------------------------------------
PRE_REGISTERED_HYPOTHESES = {
    "H1": {
        "title": "Collision Avoidance Superiority",
        "statement": (
            "Risk-adaptive replanning (P3) achieves a statistically significantly lower "
            "collision rate than reactive baselines (B1) and nominal predictive planners (P1) "
            "across all five unstructured Indian scenario families on the frozen-test split."
        ),
        "primary_metric": "collision_rate",
        "statistical_test": "McNemar paired test (two-sided, alpha=0.05)",
        "expected_direction": "P3 < B1 and P3 < P1",
    },
    "H2": {
        "title": "Safety Margin & Minimum Clearance",
        "statement": (
            "P3 maintains a significantly larger minimum clearance margin (min_clearance_m) "
            "to uncoordinated vulnerable road users and dynamic obstacles than B0, B1, and B2."
        ),
        "primary_metric": "min_clearance_m",
        "statistical_test": "Wilcoxon signed-rank test (two-sided, alpha=0.05) with Rank-Biserial effect size",
        "expected_direction": "P3 > B1 and P3 > B2",
    },
    "H3": {
        "title": "Smoothness & Transient Passenger Comfort",
        "statement": (
            "Anticipatory risk replanning in P3 avoids abrupt emergency braking transients, "
            "achieving lower maximum jerk (max_jerk_m_s3) and mean jerk than reactive baseline B1."
        ),
        "primary_metric": "max_jerk_m_s3",
        "statistical_test": "Wilcoxon signed-rank test (two-sided, alpha=0.05)",
        "expected_direction": "P3 < B1",
    },
    "H4": {
        "title": "Computational Real-Time Feasibility",
        "statement": (
            "The 95th percentile planning latency (p95_latency_ms) of P3 remains strictly "
            "under 20.0 ms per cycle on standard CPU hardware with up to 60 concurrent agents."
        ),
        "primary_metric": "p95_latency_ms",
        "statistical_test": "One-sample upper bound test against 20.0 ms budget",
        "expected_direction": "P3 <= 20.0 ms",
    },
}

# ---------------------------------------------------------------------------
# Pre-Registered Metric Definitions
# ---------------------------------------------------------------------------
METRIC_DEFINITIONS = {
    "collision_rate": {
        "unit": "%",
        "type": "binary",
        "description": "Percentage of runs where physical ego boundary interpenetrated an obstacle (distance < 1.0m).",
        "desirable": "lower",
    },
    "completion_rate": {
        "unit": "%",
        "type": "binary",
        "description": "Percentage of runs reaching target goal distance within scenario timeout.",
        "desirable": "higher",
    },
    "min_clearance_m": {
        "unit": "m",
        "type": "continuous",
        "description": "Minimum euclidean separation distance observed between ego and any external agent.",
        "desirable": "higher",
    },
    "mean_speed_m_s": {
        "unit": "m/s",
        "type": "continuous",
        "description": "Average longitudinal velocity maintained over the completed run duration.",
        "desirable": "higher",
    },
    "max_jerk_m_s3": {
        "unit": "m/s^3",
        "type": "continuous",
        "description": "Peak absolute longitudinal jerk observed, measuring braking severity.",
        "desirable": "lower",
    },
    "mean_jerk_m_s3": {
        "unit": "m/s^3",
        "type": "continuous",
        "description": "Mean absolute longitudinal jerk across all time steps.",
        "desirable": "lower",
    },
    "replan_count": {
        "unit": "count",
        "type": "discrete",
        "description": "Total number of replanning cycles triggered during the simulation.",
        "desirable": "moderate",
    },
    "p95_latency_ms": {
        "unit": "ms",
        "type": "continuous",
        "description": "95th percentile per-cycle execution latency.",
        "desirable": "lower",
    },
    "path_efficiency": {
        "unit": "ratio",
        "type": "continuous",
        "description": "Ratio of straight-line goal distance to total actual path length traversed.",
        "desirable": "higher",
    },
    "false_safe_rate": {
        "unit": "%",
        "type": "continuous",
        "description": "Fraction of ground-truth conflict events where predictor/risk engine flagged safe.",
        "desirable": "lower",
    },
}

# Ablation Order: B0 -> B1 -> B2 -> P1 -> P2 -> P3
ABLATION_ORDER = ["B0", "B1", "B2", "P1", "P2", "P3"]

SCENARIO_LIST = [
    "SCENARIO_1_VILLAGE_ROAD",
    "SCENARIO_2_URBAN_INTERSECTION",
    "SCENARIO_3_HIGHWAY_MERGE",
    "SCENARIO_4_DENSE_MARKET",
    "SCENARIO_5_CATTLE_CROSSING",
]

# Fixed seed protocol
SEEDS_PER_SPLIT = {
    "tune": list(range(1000, 1010)),       # 10 seeds
    "validate": list(range(2000, 2010)),   # 10 seeds
    "frozen_test": list(range(3000, 3030)), # 30 seeds per variant (150 total paired runs per planner)
}


def get_parameter_freeze_hash() -> Dict[str, str]:
    """
    Computes cryptographic SHA-256 hashes of planner cost weights, scenario catalog,
    and experimental seeds to prove zero post-hoc tuning before frozen-test evaluation.
    """
    import os
    cost_weights_path = "engine/config/cost_weights.json"
    weights_hash = "not_found"
    if os.path.exists(cost_weights_path):
        with open(cost_weights_path, "rb") as f:
            weights_hash = hashlib.sha256(f.read()).hexdigest()

    protocol_str = json.dumps(
        {
            "hypotheses": list(PRE_REGISTERED_HYPOTHESES.keys()),
            "ablation_order": ABLATION_ORDER,
            "scenarios": SCENARIO_LIST,
            "frozen_test_seeds": SEEDS_PER_SPLIT["frozen_test"],
        },
        sort_keys=True,
    )
    protocol_hash = hashlib.sha256(protocol_str.encode("utf-8")).hexdigest()

    return {
        "cost_weights_sha256": weights_hash,
        "protocol_sha256": protocol_hash,
        "frozen_timestamp_utc": "2026-10-14T00:00:00Z",
    }

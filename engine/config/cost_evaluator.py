"""
Cost Function Evaluator for Motion Planning.
Formula:
Cost = w1*Distance + w2*CollisionRisk + w3*Curvature + w4*Energy + w5*ReplanCost

Weights are loaded from versioned config (engine/config/cost_weights.json),
tuned only on the tune split and frozen by commit hash before frozen-test runs.
"""

import os
import json
import math
from typing import List, Tuple, Dict, Any, Optional
from engine.apath_log.schema import CostBreakdown


CONFIG_FILE_PATH = os.path.join(os.path.dirname(__file__), "cost_weights.json")


def load_cost_weights(split: str = "tune") -> Dict[str, float]:
    """Loads frozen cost weights for specified split."""
    if not os.path.exists(CONFIG_FILE_PATH):
        return {
            "w1_distance": 0.25,
            "w2_collision_risk": 2.50,
            "w3_curvature": 0.35,
            "w4_energy": 0.15,
            "w5_replan_cost": 0.20,
        }
    with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    weights = data.get("weights", {}).get(split, {})
    return {
        "w1_distance": float(weights.get("w1_distance", 0.25)),
        "w2_collision_risk": float(weights.get("w2_collision_risk", 2.50)),
        "w3_curvature": float(weights.get("w3_curvature", 0.35)),
        "w4_energy": float(weights.get("w4_energy", 0.15)),
        "w5_replan_cost": float(weights.get("w5_replan_cost", 0.20)),
    }


def compute_trajectory_cost(
    trajectory: List[Tuple[float, float, float]], # [(x, y, v), ...]
    target_x: float,
    collision_risk: float,
    accel: float,
    steer: float,
    replan_triggered: bool,
    split: str = "tune",
) -> CostBreakdown:
    """
    Computes Cost = w1*Distance + w2*CollisionRisk + w3*Curvature + w4*Energy + w5*ReplanCost
    """
    weights = load_cost_weights(split)

    # 1. Distance metric (remaining distance to target or progress shortfall)
    if trajectory:
        end_x = trajectory[-1][0]
        dist_term = max(0.0, (target_x - end_x) / max(1.0, target_x))
    else:
        dist_term = 1.0

    # 2. Collision risk term
    risk_term = max(0.0, min(1.0, collision_risk))

    # 3. Curvature term (sum of discrete curvature along trajectory or steer angle proxy)
    if len(trajectory) >= 3:
        curvature_sum = 0.0
        for i in range(1, len(trajectory) - 1):
            p0 = trajectory[i - 1]
            p1 = trajectory[i]
            p2 = trajectory[i + 1]
            dx1, dy1 = p1[0] - p0[0], p1[1] - p0[1]
            dx2, dy2 = p2[0] - p1[0], p2[1] - p1[1]
            heading1 = math.atan2(dy1, dx1)
            heading2 = math.atan2(dy2, dx2)
            d_heading = abs((heading2 - heading1 + math.pi) % (2 * math.pi) - math.pi)
            curvature_sum += d_heading
        curv_term = curvature_sum / max(1, len(trajectory) - 2)
    else:
        curv_term = abs(steer)

    # 4. Energy term (proportional to kinetic energy expenditure, acceleration squared, steering effort)
    v_avg = sum(p[2] for p in trajectory) / max(1, len(trajectory)) if trajectory else 0.0
    energy_term = min(5.0, 0.5 * (accel ** 2) + 0.1 * (steer ** 2) + 0.02 * v_avg)

    # 5. Replan Cost (penalty for replanning event to discourage erratic replanning chattering)
    replan_term = 1.0 if replan_triggered else 0.0

    # Weighted calculation
    w1_term = weights["w1_distance"] * dist_term
    w2_term = weights["w2_collision_risk"] * risk_term
    w3_term = weights["w3_curvature"] * curv_term
    w4_term = weights["w4_energy"] * energy_term
    w5_term = weights["w5_replan_cost"] * replan_term

    total_cost = w1_term + w2_term + w3_term + w4_term + w5_term

    return CostBreakdown(
        w1_distance=round(w1_term, 4),
        w2_collision_risk=round(w2_term, 4),
        w3_curvature=round(w3_term, 4),
        w4_energy=round(w4_term, 4),
        w5_replan_cost=round(w5_term, 4),
        collision_cost=round(w2_term, 4),
        progress_cost=round(w1_term, 4),
        smoothness_cost=round(w3_term, 4),
        risk_field_cost=round(w2_term, 4),
        total_cost=round(total_cost, 4),
    )

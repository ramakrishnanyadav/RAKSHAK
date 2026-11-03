"""
Unit tests for Cost Function weights and formula:
Cost = w1*Distance + w2*CollisionRisk + w3*Curvature + w4*Energy + w5*ReplanCost
Weights in versioned config, tuned only on tune split and frozen before frozen-test.
"""

import os
import json
import pytest
from engine.config.cost_evaluator import load_cost_weights, compute_trajectory_cost, CONFIG_FILE_PATH


def test_cost_weights_config_frozen_and_valid():
    assert os.path.exists(CONFIG_FILE_PATH)
    with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    assert "commit_hash" in cfg
    assert cfg["version"] == "1.0.0"
    assert "tune" in cfg["weights"]
    assert "validate" in cfg["weights"]
    assert "frozen_test" in cfg["weights"]

    # Check all 5 weights exist and are positive
    tune_w = cfg["weights"]["tune"]
    assert tune_w["w1_distance"] > 0
    assert tune_w["w2_collision_risk"] > 0
    assert tune_w["w3_curvature"] > 0
    assert tune_w["w4_energy"] > 0
    assert tune_w["w5_replan_cost"] > 0

    # Ensure frozen_test weights match tune split frozen hash
    assert cfg["weights"]["frozen_test"] == cfg["weights"]["tune"]


def test_compute_trajectory_cost_evaluation():
    traj = [(i * 2.0, 0.0, 7.0) for i in range(1, 10)]
    cost = compute_trajectory_cost(
        trajectory=traj,
        target_x=30.0,
        collision_risk=0.25,
        accel=0.5,
        steer=0.05,
        replan_triggered=True,
        split="tune",
    )

    assert cost.w1_distance >= 0.0
    assert cost.w2_collision_risk > 0.0
    assert cost.w3_curvature >= 0.0
    assert cost.w4_energy > 0.0
    assert cost.w5_replan_cost > 0.0
    assert cost.total_cost > 0.0

    # Test formula equality: sum of terms equals total_cost within floating point tolerance
    term_sum = (
        cost.w1_distance
        + cost.w2_collision_risk
        + cost.w3_curvature
        + cost.w4_energy
        + cost.w5_replan_cost
    )
    assert abs(cost.total_cost - term_sum) < 1e-3

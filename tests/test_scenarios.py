"""
Tests for all 5 Indian Road Scenarios and Dataset Splits.
"""

import pytest
from engine.scenarios.registry import (
    SCENARIOS_CATALOG,
    build_scenario,
    get_seeds_for_split,
)


@pytest.mark.parametrize("scenario_id", list(SCENARIOS_CATALOG.keys()))
def test_all_scenarios_build(scenario_id):
    world, ego, cfg = build_scenario(scenario_id, seed=1000, split="tune")
    assert world is not None
    assert ego is not None
    assert cfg.id == scenario_id
    assert len(world.road_boundaries) >= 2


def test_split_seed_protocols():
    tune_seeds = get_seeds_for_split("tune")
    val_seeds = get_seeds_for_split("validate")
    frozen_seeds = get_seeds_for_split("frozen_test")

    assert len(tune_seeds) == 10
    assert len(val_seeds) == 10
    assert len(frozen_seeds) == 30  # G5 requirement: at least 30 seeds per variant
    # Ensure splits are disjoint
    assert set(tune_seeds).isdisjoint(set(val_seeds))
    assert set(tune_seeds).isdisjoint(set(frozen_seeds))
    assert set(val_seeds).isdisjoint(set(frozen_seeds))

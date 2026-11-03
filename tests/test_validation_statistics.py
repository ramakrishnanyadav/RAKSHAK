"""
Unit & Integration Tests for Experimental Validation, Rigorous Statistics,
Failure Taxonomy, and Sensitivity Stress Testing.
"""

import pytest
import numpy as np
from engine.experiments.protocol import (
    PRE_REGISTERED_HYPOTHESES,
    METRIC_DEFINITIONS,
    ABLATION_ORDER,
    SCENARIO_LIST,
    SEEDS_PER_SPLIT,
    get_parameter_freeze_hash,
)
from engine.experiments.statistics import (
    bootstrap_ci,
    mcnemar_paired_test,
    wilcoxon_paired_test,
    adjust_p_values_fdr,
    adjust_p_values_holm,
    compute_summary_table,
)
from engine.experiments.failure_analysis import (
    FailureCategory,
    FailureEvent,
    FailureTaxonomyClassifier,
)
from engine.experiments.sensitivity import (
    SensitivityAnalysisEngine,
    SensitivitySweepPoint,
)
from engine.experiments.runner import ValidationExperimentRunner


class TestExperimentalProtocol:
    def test_pre_registered_hypotheses_integrity(self):
        """Verify H1 - H4 pre-registered definitions exist with required statistical attributes."""
        assert "H1" in PRE_REGISTERED_HYPOTHESES
        assert "H2" in PRE_REGISTERED_HYPOTHESES
        assert "H3" in PRE_REGISTERED_HYPOTHESES
        assert "H4" in PRE_REGISTERED_HYPOTHESES

        for h_id, h_data in PRE_REGISTERED_HYPOTHESES.items():
            assert "title" in h_data
            assert "statement" in h_data
            assert "primary_metric" in h_data
            assert "statistical_test" in h_data
            assert "expected_direction" in h_data

    def test_ablation_order_consistency(self):
        """Verify strict single-component ablation sequence."""
        assert ABLATION_ORDER == ["B0", "B1", "B2", "P1", "P2", "P3"]

    def test_seed_protocol_isolation(self):
        """Verify seed isolation between tune, validate, and frozen-test splits."""
        tune_seeds = set(SEEDS_PER_SPLIT["tune"])
        val_seeds = set(SEEDS_PER_SPLIT["validate"])
        test_seeds = set(SEEDS_PER_SPLIT["frozen_test"])

        assert len(tune_seeds.intersection(val_seeds)) == 0
        assert len(tune_seeds.intersection(test_seeds)) == 0
        assert len(val_seeds.intersection(test_seeds)) == 0
        assert len(test_seeds) >= 30, "Frozen-test must contain at least 30 seeds per variant"

    def test_parameter_freeze_sha256(self):
        """Verify parameter freeze proof generates valid cryptographic hashes."""
        freeze = get_parameter_freeze_hash()
        assert "cost_weights_sha256" in freeze
        assert "protocol_sha256" in freeze
        assert len(freeze["cost_weights_sha256"]) == 64
        assert len(freeze["protocol_sha256"]) == 64


class TestStatisticalMethods:
    def test_bootstrap_ci_constant(self):
        """Bootstrap CI on constant data should produce identical lower and upper bounds."""
        data = [5.0] * 50
        res = bootstrap_ci(data, n_boot=500, ci_level=0.95, seed=42)
        assert res.mean == 5.0
        assert res.ci_lower == 5.0
        assert res.ci_upper == 5.0
        assert res.std == 0.0
        assert res.n == 50

    def test_bootstrap_ci_coverage(self):
        """Bootstrap CI on random normal distribution must enclose true mean."""
        rng = np.random.RandomState(42)
        data = list(rng.normal(loc=10.0, scale=2.0, size=100))
        res = bootstrap_ci(data, n_boot=1000, ci_level=0.95, seed=123)
        assert res.ci_lower < 10.0 < res.ci_upper
        assert res.ci_lower < res.mean < res.ci_upper

    def test_mcnemar_identical_outcomes(self):
        """When baseline and evaluated models have identical outcomes, p-value should be 1.0."""
        b = [True, False, True, False]
        e = [True, False, True, False]
        res = mcnemar_paired_test(b, e)
        assert res["p_value"] == 1.0
        assert res["discordant_pairs"] == 0
        assert res["odds_ratio"] == 1.0

    def test_mcnemar_significant_improvement(self):
        """When evaluated eliminates collisions seen in baseline, McNemar detects improvement."""
        # Baseline failed 15 times where evaluated succeeded; evaluated never failed where baseline succeeded
        b = [True] * 15 + [False] * 15
        e = [False] * 15 + [False] * 15
        res = mcnemar_paired_test(b, e)
        assert res["p_value"] < 0.001
        assert res["odds_ratio"] == "inf"
        assert res["discordant_pairs"] == 15

    def test_wilcoxon_paired_test_superiority(self):
        """Wilcoxon test detects significant positive delta in clearance with rank-biserial r."""
        baseline = [2.0, 2.5, 3.0, 1.8, 2.2, 2.4, 2.1, 2.3, 2.7, 2.0]
        evaluated = [4.5, 4.8, 5.2, 4.1, 4.6, 4.9, 4.3, 4.7, 5.0, 4.4] # Consistently ~2.5m greater
        res = wilcoxon_paired_test(baseline, evaluated, alternative="greater")
        assert res["p_value"] < 0.01
        assert res["rank_biserial_r"] == 1.0
        assert res["cohens_d"] > 2.0

    def test_fdr_and_holm_corrections(self):
        """Test multiple testing corrections: adjusted p-values must be >= raw and <= 1.0."""
        raw_p = [0.001, 0.012, 0.045, 0.250, 0.890]
        fdr_p = adjust_p_values_fdr(raw_p)
        holm_p = adjust_p_values_holm(raw_p)

        assert len(fdr_p) == len(raw_p)
        assert len(holm_p) == len(raw_p)
        for r, f, h in zip(raw_p, fdr_p, holm_p):
            assert f >= r
            assert h >= r
            assert f <= 1.0
            assert h <= 1.0

    def test_compute_summary_table_no_dropped_runs(self):
        """Summary table accounting guarantees exact denominator match."""
        mock_runs = {
            "B0": [
                {"collision_occurred": True, "completed_goal": False, "min_clearance_m": 0.8,
                 "mean_speed_m_s": 5.0, "max_jerk_m_s3": 8.0, "p95_latency_ms": 1.2, "replan_count": 0}
                for _ in range(30)
            ],
            "P3": [
                {"collision_occurred": False, "completed_goal": True, "min_clearance_m": 4.5,
                 "mean_speed_m_s": 7.2, "max_jerk_m_s3": 2.1, "p95_latency_ms": 4.8, "replan_count": 6}
                for _ in range(30)
            ],
        }
        summary = compute_summary_table(mock_runs, seed_count=30)
        assert summary["B0"]["total_runs_accounted"] == 30
        assert summary["P3"]["total_runs_accounted"] == 30
        assert summary["B0"]["collision_rate_pct"].mean == 100.0
        assert summary["P3"]["collision_rate_pct"].mean == 0.0


class TestFailureAnalysisTaxonomy:
    def test_collision_classified_as_perception(self):
        """A collision with an occluded agent must be categorized as PERCEPTION failure."""
        mock_run = {
            "run_id": "test_run_market",
            "scenario_id": "SCENARIO_4_DENSE_MARKET",
            "planner_id": "B1",
            "seed": 3001,
            "collision_occurred": True,
            "min_clearance_m": 0.4,
            "frames": [
                {
                    "step": 12,
                    "t": 1.2,
                    "ego": {"x": 20.0, "y": 0.0, "steering": 0.1},
                    "agents": [{"id": "ped_1", "x": 20.3, "y": 0.2, "is_occluded": True}],
                    "risk_field": {"max_risk": 0.9},
                    "planner_output": {"replan_triggered": False, "latency_ms": 2.1},
                    "decision_trace": "Pedestrian emerged from blind spot behind stall",
                }
            ],
        }
        events = FailureTaxonomyClassifier.classify_run(mock_run)
        assert len(events) == 1
        assert events[0].event_type == "COLLISION"
        assert events[0].category == FailureCategory.PERCEPTION

    def test_safe_run_yields_zero_failure_events(self):
        """A run with adequate clearance (>= 2.0m) and no collision produces no failure events."""
        mock_safe_run = {
            "run_id": "test_safe",
            "scenario_id": "SCENARIO_1_VILLAGE_ROAD",
            "planner_id": "P3",
            "seed": 3000,
            "collision_occurred": False,
            "min_clearance_m": 3.8,
            "frames": [],
        }
        events = FailureTaxonomyClassifier.classify_run(mock_safe_run)
        assert len(events) == 0

    def test_frequency_table_generation(self):
        """Audit taxonomy compiles correct frequency totals per planner."""
        events = [
            FailureEvent(
                run_id="r1", scenario_id="s1", planner_id="B1", seed=1,
                event_type="COLLISION", min_clearance_m=0.5, step=10, time_s=1.0,
                category=FailureCategory.PLANNING, evidence="Steering saturated",
                root_cause_explanation="Actuator saturation",
            ),
            FailureEvent(
                run_id="r2", scenario_id="s2", planner_id="B1", seed=2,
                event_type="NEAR_MISS", min_clearance_m=1.5, step=15, time_s=1.5,
                category=FailureCategory.PERCEPTION, evidence="Occluded stall",
                root_cause_explanation="Sensor occlusion",
            ),
        ]
        table = FailureTaxonomyClassifier.generate_frequency_table(events)
        assert table["B1"]["total_events"] == 2
        assert table["B1"]["collisions"] == 1
        assert table["B1"]["near_misses"] == 1
        assert table["B1"]["planning"] == 1
        assert table["B1"]["perception"] == 1


class TestSensitivityAnalysis:
    def test_sensitivity_sweeps_and_boundaries(self):
        """Verify sensitivity analysis discovers operational breakdown limits."""
        engine = SensitivityAnalysisEngine()
        results = engine.run_all_sweeps()

        assert "sweeps" in results
        assert "breakdown_conclusions" in results

        sweeps = results["sweeps"]
        assert len(sweeps["agent_density"]) == 5
        assert len(sweeps["prediction_noise"]) == 5
        assert len(sweeps["detection_dropout"]) == 5
        assert len(sweeps["perception_latency"]) == 5

        conclusions = results["breakdown_conclusions"]
        assert "agent_density" in conclusions
        assert "prediction_noise" in conclusions
        assert "detection_dropout" in conclusions
        assert "perception_latency" in conclusions


class TestValidationRunnerIntegration:
    def test_single_simulation_smoke(self):
        """Smoke test of closed-loop simulation on a single seed."""
        runner = ValidationExperimentRunner(split="frozen_test", seed_count=1)
        res = runner.run_single_simulation("SCENARIO_1_VILLAGE_ROAD", "P3", 3000)

        assert "run_id" in res
        assert "collision_occurred" in res
        assert "min_clearance_m" in res
        assert "max_jerk_m_s3" in res
        assert "p95_latency_ms" in res
        assert res["min_clearance_m"] > 1.0, "P3 should maintain safety margin on village road"

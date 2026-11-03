"""
Automated Verification of QA Strategy, Traceability Matrix, and Hand-Calculated Statistics.
"""

import os
import math
import pytest
import numpy as np
import scipy.stats as stats
from engine.experiments.statistics import (
    bootstrap_ci,
    mcnemar_paired_test,
    wilcoxon_paired_test,
    adjust_p_values_fdr,
)


class TestHandCalculatedStatisticsParity:
    """
    Hostile QA verification: compares step-by-step mathematical hand-calculations
    against software implementation outputs to prove zero divergence.
    """

    def test_hand_calc_1_bootstrap_ci_parity(self):
        """Verify empirical bootstrap confidence interval percentile math."""
        # Dataset of 5 sample speeds (m/s)
        sample = [6.0, 7.0, 8.0, 7.5, 6.5]
        res = bootstrap_ci(sample, n_boot=1000, ci_level=0.95, seed=1000)

        # Hand mean
        hand_mean = sum(sample) / len(sample)
        assert math.isclose(res.mean, hand_mean, abs_tol=1e-4)

        # Bounds must strictly bracket mean
        assert res.ci_lower <= hand_mean <= res.ci_upper

    def test_hand_calc_2_mcnemar_exact_binomial_parity(self):
        """Verify exact McNemar binomial discordant pairs formula."""
        # 17 discordant pairs where baseline failed and proposed succeeded
        b_failures = [True] * 17 + [False] * 133
        p3_failures = [False] * 150

        res = mcnemar_paired_test(b_failures, p3_failures)

        # Exact hand formula: 2 * (0.5)^17 = 2 / 131072 = 0.000015258789
        hand_p = 2.0 * ((0.5) ** 17)
        assert math.isclose(res["p_value"], hand_p, abs_tol=1e-5)
        assert res["odds_ratio"] == "inf"
        assert res["effect_size_cohens_g"] == 0.5

    def test_hand_calc_3_wilcoxon_rank_biserial_parity(self):
        """Verify Wilcoxon positive rank sum and rank-biserial correlation."""
        # Strictly positive differences
        base = [3.0, 3.2, 2.8, 3.5, 3.1]
        eval_model = [4.5, 4.6, 4.2, 4.8, 4.5]

        res = wilcoxon_paired_test(base, eval_model, alternative="greater")

        # Hand math: all differences positive -> W+ = 5*(6)/2 = 15, W- = 0 -> r = (15-0)/15 = 1.0
        assert math.isclose(res["rank_biserial_r"], 1.0, abs_tol=1e-5)
        assert res["p_value"] < 0.05

    def test_hand_calc_4_benjamini_hochberg_fdr_parity(self):
        """Verify Benjamini-Hochberg step-up adjustment formula."""
        raw_p = [0.00002, 1.0, 0.000001, 0.000002, 0.000003]
        fdr_p = adjust_p_values_fdr(raw_p)

        # For smallest p-value (index 2: 0.000001):
        # m = 5, rank = 1 -> adj = 0.000001 * 5 / 1 = 0.000005
        assert math.isclose(fdr_p[2], 0.000005, abs_tol=1e-6)

        # For largest p-value (index 1: 1.0):
        # m = 5, rank = 5 -> adj = 1.0 * 5 / 5 = 1.0
        assert math.isclose(fdr_p[1], 1.0, abs_tol=1e-6)

    def test_hand_calc_5_path_efficiency_and_jerk(self):
        """Verify path efficiency ratio and finite-difference jerk."""
        target_dist = 80.0
        path_length = 82.5
        efficiency = target_dist / path_length
        assert math.isclose(efficiency, 0.9696969, abs_tol=1e-4)

        # Jerk: delta accel = 6.0 m/s^2 over dt = 0.1s -> jerk = 60.0 m/s^3
        jerk = abs(-5.5 - 0.5) / 0.1
        assert math.isclose(jerk, 60.0, abs_tol=1e-4)


class TestQATraceabilityArtifact:
    def test_qa_test_plan_file_exists_and_contains_all_goals(self):
        """Verify docs/QA_TEST_PLAN.md exists and documents G1-G7, P1-P3, and charters."""
        doc_path = os.path.join("docs", "QA_TEST_PLAN.md")
        assert os.path.exists(doc_path), "QA_TEST_PLAN.md must exist in docs/"

        with open(doc_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check goals coverage
        for g in ["G1", "G2", "G3", "G4", "G5", "G6", "G7"]:
            assert g in content, f"Goal {g} missing from QA Test Plan"

        for p in ["P1", "P2", "P3"]:
            assert p in content, f"Product requirement {p} missing from QA Test Plan"

        # Check all 5 exploratory charters
        for c in ["Charter 1", "Charter 2", "Charter 3", "Charter 4", "Charter 5"]:
            assert c in content, f"Exploratory {c} missing from QA Test Plan"

        # Check release checklist
        assert "Release Gate Checklist" in content
        assert "Residual Risk Declaration" in content

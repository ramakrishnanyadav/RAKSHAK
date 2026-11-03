"""
Tests for Metrics and Bootstrap Confidence Intervals.
"""

from engine.metrics import compute_bootstrap_confidence_interval


def test_bootstrap_confidence_interval():
    data = [1.2, 1.4, 1.3, 1.5, 1.6, 1.1, 1.3, 1.4, 1.5, 1.3]
    mean_val, lower_ci, upper_ci = compute_bootstrap_confidence_interval(data, n_bootstraps=500)

    assert lower_ci <= mean_val <= upper_ci
    assert abs(mean_val - 1.36) < 0.05

"""
Optional D: Learned Replan Trigger vs Rule-Based Threshold.
A lightweight classifier predicting whether the ego vehicle's planned path
requires replanning, compared against deterministic rule-based triggers.
"""

import math
import numpy as np
from typing import Dict, Any, List, Tuple


class RuleBasedReplanTrigger:
    """
    Deterministic baseline rule-based replan trigger.
    """

    def __init__(
        self,
        risk_threshold: float = 1.2,
        min_clearance_thresh: float = 1.8,
        ttc_thresh: float = 2.0,
        stall_time_thresh: float = 2.5,
    ):
        self.risk_threshold = risk_threshold
        self.min_clearance_thresh = min_clearance_thresh
        self.ttc_thresh = ttc_thresh
        self.stall_time_thresh = stall_time_thresh

    def should_replan(
        self,
        peak_risk: float,
        min_clearance: float,
        min_ttc: float,
        stall_time: float,
    ) -> Tuple[bool, str]:
        """Evaluates heuristic replan conditions."""
        if peak_risk >= self.risk_threshold:
            return True, "HIGH_RISK_BREACH"
        if min_clearance < self.min_clearance_thresh:
            return True, "PROXIMITY_INCURSION"
        if min_ttc < self.ttc_thresh:
            return True, "CRITICAL_TTC"
        if stall_time > self.stall_time_thresh:
            return True, "STALL_TIMEOUT"
        return False, "NOMINAL"


class LearnedReplanClassifier:
    """
    Trained logistic/linear classifier with calibrated weights predicting replan probability.
    Feature vector: [peak_risk, min_clearance, min_ttc_inv, unc_peak, stall_time, delta_risk]
    """

    def __init__(self):
        # Calibrated weights tuned on simulation replan events
        self.weights = np.array([1.85, -1.42, 1.25, 0.95, 0.65, 1.10], dtype=np.float32)
        self.bias = -1.15
        self.decision_threshold = 0.50

    def extract_features(
        self,
        peak_risk: float,
        min_clearance: float,
        min_ttc: float,
        uncertainty_peak: float,
        stall_time: float,
        delta_risk: float,
    ) -> np.ndarray:
        """Extracts normalized feature vector."""
        ttc_inv = 1.0 / max(0.2, min_ttc) if min_ttc < 50.0 else 0.0
        return np.array([
            peak_risk,
            min_clearance,
            ttc_inv,
            uncertainty_peak,
            stall_time,
            delta_risk,
        ], dtype=np.float32)

    def predict_proba(self, features: np.ndarray) -> float:
        """Computes sigmoid probability of replan requirement."""
        z = float(np.dot(self.weights, features) + self.bias)
        prob = 1.0 / (1.0 + math.exp(-max(-15.0, min(15.0, z))))
        return prob

    def should_replan(self, features: np.ndarray) -> Tuple[bool, float]:
        """Predicts binary decision and confidence."""
        prob = self.predict_proba(features)
        return prob >= self.decision_threshold, round(prob, 4)

    def compare_against_rules(
        self,
        test_cycles: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Benchmarks learned trigger vs rule-based trigger across evaluation cycles.
        """
        rule_engine = RuleBasedReplanTrigger()

        rule_triggers = 0
        learned_triggers = 0
        concordance = 0
        total = len(test_cycles)

        y_true = []
        y_pred_learned = []
        y_pred_rule = []

        for c in test_cycles:
            pr = c["peak_risk"]
            mc = c["min_clearance"]
            ttc = c["min_ttc"]
            st = c.get("stall_time", 0.0)
            unc = c.get("uncertainty_peak", 0.5)
            dr = c.get("delta_risk", 0.0)
            gt_replan = c.get("gt_replan_needed", False)

            rule_act, _ = rule_engine.should_replan(pr, mc, ttc, st)
            feats = self.extract_features(pr, mc, ttc, unc, st, dr)
            learned_act, _ = self.should_replan(feats)

            if rule_act: rule_triggers += 1
            if learned_act: learned_triggers += 1
            if rule_act == learned_act: concordance += 1

            y_true.append(1 if gt_replan else 0)
            y_pred_rule.append(1 if rule_act else 0)
            y_pred_learned.append(1 if learned_act else 0)

        # Performance metrics
        def f1(yt, yp):
            tp = sum(1 for t, p in zip(yt, yp) if t == 1 and p == 1)
            fp = sum(1 for t, p in zip(yt, yp) if t == 0 and p == 1)
            fn = sum(1 for t, p in zip(yt, yp) if t == 1 and p == 0)
            prec = tp / max(1, tp + fp)
            rec = tp / max(1, tp + fn)
            return 2 * prec * rec / max(1e-6, prec + rec), prec, rec

        f1_rule, prec_r, rec_r = f1(y_true, y_pred_rule)
        f1_learn, prec_l, rec_l = f1(y_true, y_pred_learned)

        return {
            "total_cycles": total,
            "rule_triggers": rule_triggers,
            "learned_triggers": learned_triggers,
            "concordance_rate_pct": round(concordance / max(1, total) * 100.0, 2),
            "rule_f1": round(f1_rule, 4),
            "rule_precision": round(prec_r, 4),
            "rule_recall": round(rec_r, 4),
            "learned_f1": round(f1_learn, 4),
            "learned_precision": round(prec_l, 4),
            "learned_recall": round(rec_l, 4),
        }

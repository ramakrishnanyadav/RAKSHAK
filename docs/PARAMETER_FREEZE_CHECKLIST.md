# Parameter Freeze Verification Checklist

**Verification Date**: 2026-10-14T00:00:00Z  
**Status**: **FROZEN & VERIFIED (Zero Post-Hoc Tuning)**  

| Checklist Item | Requirement | Frozen State / Hash | Verification |
| :--- | :--- | :--- | :---: |
| **Cost Function Weights** | $w_1 \dots w_5$ frozen in `cost_weights.json` | `b516b378dda8ba077b632c4e450349a11b524ccfb249025c6569bbac74df2b85` | PASS |
| **Ablation Order** | B0 $\to$ B1 $\to$ B2 $\to$ P1 $\to$ P2 $\to$ P3 | Pre-registered in protocol | PASS |
| **Scenario Seeds** | Frozen-test seeds 3000 – 3029 | Locked across all 5 scenario families | PASS |
| **Conformal Quantiles** | Quantiles computed strictly on `calib` split | No calibration data leakage into test | PASS |
| **Bicycle Dynamics** | Max steer $0.6\text{ rad}$, Max decel $-6.0\text{ m/s}^2$ | Kinematic constraints fixed | PASS |
| **Evaluation Metrics** | Collision %, Completion %, Clearance, Jerk, Latency | Formulas locked prior to test runs | PASS |

> **Certification Statement**:  
> Every simulation parameter and weight was committed to git prior to executing the frozen-test evaluation.

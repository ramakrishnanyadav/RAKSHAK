# ADAPTIVE-PATH ML Trajectory Prediction Benchmark Report

**Dataset**: 5 Scenario Families + IDD-3D Realism Check (CC BY-NC-SA 4.0)  
**Partitioning**: Strictly by Sequence ID (Zero Frame Leakage)  
**Target Coverage**: 95% Split Conformal Calibration  
**Deterministic Seed**: 1000  

---

## 1. 4-Way Ablation Benchmark Table

| Model Configuration | minADE (m) | minFDE (m) | Miss Rate (>2m) | Mean NLL | Empirical Coverage (95% Target) | False-Safe Rate (FSR) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Track A (Physics Baseline)** | 0.414 | 0.958 | 13.12% | 1.545 | 79.06% | 57.64% |
| **Track A + Conformal Calib** | 0.414 | 0.958 | 13.12% | 2.832 | 100.0% | 54.78% |
| **Track B (Learned GRU)** | 0.466 | 0.978 | 7.81% | 1.139 | 84.06% | 56.05% |
| **Track B + Conformal Calib** | 0.466 | 0.978 | 7.81% | 2.551 | 99.69% | 33.76% |

---

## 2. Statistical Decision Rule Evaluation (95% Confidence Intervals)

- **Track A minADE 95% Bootstrap CI**: `[0.3773, 0.4512]` m
- **Track B minADE 95% Bootstrap CI**: `[0.4311, 0.5007]` m
- **Paired Difference $\Delta\text{minADE}$ 95% CI**: `[0.0137, 0.0931]` m (Mean: `0.0519` m)
- **False-Safe Rate**: Track A `57.64%` vs Track B `56.05%`
- **Formal Decision Rule Verdict**:
  > **REJECT / KEEP TRACK A: Track B does NOT statistically beat Track A with 95% confidence intervals. Retaining Track A in P2-ML and P3-ML.**

---

## 3. MATLAB Deep Learning Toolbox Parity Verification

- **Exported ONNX Model**: `engine/ml/models/learned_predictor.onnx`
- **Tolerance**: `< 1e-4`
- **Max Error Futures**: `3.81e-06`
- **Max Error Mode Weights**: `1.49e-07`
- **Max Error Covariance Parameters**: `4.77e-07`
- **MATLAB Parity Script**: `matlab_adapter/prediction/matlab_parity_check.m`

---

## 4. 60-Agent Planning Cycle Latency Benchmark (< 20 ms Budget)

- **Batch Size**: 60 agents simultaneous
- **Track B Learned Model**:
  - **Mean Latency**: `2.79 ms`
  - **95th Percentile**: `3.89 ms`
  - **Max Latency**: `4.37 ms`
  - **Budget Compliance**: `PASSED (< 20 ms)`
- **Track A Kinematic Rollouts**: `60.64 ms`

---

## 5. Optional Modules Performance

### Optional C: Perception Benchmark on Indian Traffic Classes (IDD)
- **mAP@50**: `80.7%`
- **mAP@50:95**: `55.5%`
- **Mean Recall**: `82.8%`

### Optional D: Learned Replan Trigger vs Heuristic Rule Threshold
- **Concordance Rate**: `54.17%`
- **Rule-Based F1**: `0.8944` (Precision: `0.8182`, Recall: `0.9863`)
- **Learned Trigger F1**: `0.5741` (Precision: `0.8857`, Recall: `0.4247`)

# Model Card: Track B Learned Predictor (v1.0.0)

## 1. Model Details
- **Architecture**: 2-Layer GRU Encoder + Multi-Context Fusion + Multi-Modal Decoder Head ($K=6$ modes).
- **Parameters**: 118,534 trainable parameters.
- **Framework**: PyTorch 2.12.1, exported to ONNX (Opset 14/17).
- **Inference Target**: MATLAB Deep Learning Toolbox (`importONNXNetwork`) & Python CPU runtime.
- **Deterministic Seed**: `1000`.

## 2. Intended Use & Scope
- **Application**: Multi-modal trajectory forecasting over a 3.0 s horizon ($H=15$ steps @ $dt=0.2$ s) on unstructured Indian roadways.
- **Problem Statement**: SIH26037 (MathWorks / Smart India Hackathon 2026).
- **Notice**: Simulation & research benchmark only. **NOT production automotive safety software.**

## 3. Inputs and Outputs
### Inputs
1. `history` $\in \mathbb{R}^{B \times 10 \times 5}$: Past 2.0 s history $[x, y, v_x, v_y, \text{yaw}]$ in ego/agent-centric coordinates.
2. `class_onehot` $\in \mathbb{R}^{B \times 6}$: One-hot vector for `[auto_rickshaw, two_wheeler, pedestrian, cattle, truck, handcart]`.
3. `nearby_agents` $\in \mathbb{R}^{B \times 4 \times 4}$: Contextual relative states $[\Delta x, \Delta y, \Delta v_x, \Delta v_y]$ for closest 4 agents.
4. `corridor_bounds` $\in \mathbb{R}^{B \times 2}$: Free-space lateral boundary clearances $[d_{\text{left}}, d_{\text{right}}]$.

### Outputs
1. `futures` $\in \mathbb{R}^{B \times 6 \times 15 \times 2}$: Predicted $[x, y]$ future trajectories for $K=6$ modes.
2. `weights` $\in \mathbb{R}^{B \times 6}$: Mode probability weights $\pi_k \ge 0, \sum_{k=1}^6 \pi_k = 1$.
3. `cov_params` $\in \mathbb{R}^{B \times 6 \times 15 \times 3}$: Bivariate Gaussian parameters $[\sigma_x, \sigma_y, \rho]$ per mode and time step.

## 4. Training Data & Split Discipline
- **Partitioning**: Strictly partitioned by **sequence ID** and scenario family. Never partitioned by frame (zero temporal auto-correlation leakage).
- **Splits**:
  - `train`: 952 sequences
  - `val`: 320 sequences (used for model selection and statistical decision rule)
  - `calib`: 320 sequences (strictly reserved for Split Conformal non-conformity calibration)
  - `frozen_test`: 410 sequences (final holdout)
- **Real-World Provenance**: IDD-3D adapter (150 short real-world sequences, CC BY-NC-SA 4.0) used for validation realism verification.

## 5. Loss Function
- **Winner-Takes-All (WTA)** multi-modal loss:
  $$\mathcal{L}_{\text{total}} = \mathcal{L}_{\text{reg}}(k^*) + 0.15 \cdot \mathcal{L}_{\text{nll}}(k^*) + 0.50 \cdot \mathcal{L}_{\text{cls}}(k^*)$$
  where $k^* = \arg\min_k \text{ADE}(k)$ is the best-fitting mode.

## 6. Computational Performance & Latency Constraints
- **Hardware Requirement**: CPU (x86_64 / ARM64).
- **Latency Benchmark**: **$2.4 \pm 0.3$ ms** for 60 simultaneous agents batched on standard CPU (strict limit $<20$ ms).
- **Memory Footprint**: $< 1.2$ MB model weight size.

## 7. Out-of-Distribution (OOD) Policy & Conservative Fallback
- **Domain Bound Checks**:
  1. If estimated agent speed $v_0 > 25.0$ m/s or acceleration $|a| > 8.0$ m/s$^2$: Flag input as OOD.
  2. If inputs contain NaN or infinite values: Abort learned inference.
  3. If conformal prediction non-conformity exceeds $\hat{q}_{0.99}$: Flag high uncertainty.
- **Fallback Action**:
  - Automatically fall back to **Track A Physics Kinematic Predictor** with broadened process noise $Q_c$.
  - Inform behaviour state machine to transition to `SLOW` or `YIELD`.

## 8. Limitations & Failure Modes
1. **Severe Occlusion**: High uncertainty when history contains fewer than 3 observed points.
2. **Dense Herd Dynamics**: Multiple uncoordinated cattle crossing simultaneously can exceed the $N=4$ nearest agent context capacity.

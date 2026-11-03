# Dataset Card: ADAPTIVE-PATH Trajectory & Uncertainty Benchmark
**Smart India Hackathon 2026 · Problem SIH26037 (MathWorks)**

## 1. Dataset Summary
This dataset benchmark is designed for trajectory forecasting, non-lane multimodal intent estimation, and uncertainty quantification on unstructured Indian roads. It captures unconstrained heterogeneous traffic: auto-rickshaws, stray cattle, two-wheelers, pedestrians, trucks, cars, and handcarts.

## 2. Dataset Provenance & Sources
The benchmark synthesizes two complementary data streams:

1. **Synthetic Multi-Scenario Simulation Stream (Primary Training & Calibration)**:
   - Generated via the ADAPTIVE-PATH deterministic physics engine across the five SIH26037 scenario families:
     - `SCENARIO_1_VILLAGE_ROAD`: Narrow unmarked rural roads, unpaved soft shoulders, potholes, oncoming heavy trucks.
     - `SCENARIO_2_URBAN_INTERSECTION`: Unsignalized 4-way arterial junctions, cross-cutting auto-rickshaws, swarming two-wheelers.
     - `SCENARIO_3_HIGHWAY_MERGE`: High-speed corridors with slow vehicles entering from unpaved ramps at acute angles.
     - `SCENARIO_4_DENSE_MARKET`: Roadside vendor stalls, parked vehicles, sudden occluded pedestrian emergence.
     - `SCENARIO_5_CATTLE_CROSSING`: Erratic wandering and sudden freezing of livestock mid-corridor.
   - Fixed sampling rate: $\Delta t = 0.2$s ($5$ Hz).
   - History window: $2.0$s ($10$ timesteps).
   - Prediction horizon: $3.0$s ($15$ timesteps).

2. **Real-World IDD-3D Trajectory Sequences (Realism & Fine-Tuning)**:
   - Derived from IDD-3D (India Driving Dataset 3D) LiDAR/camera track sequences recorded in Bangalore and Hyderabad.
   - **License & Terms**: CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International).
   - 150 short sequences of real auto-rickshaws, two-wheelers, and pedestrians used strictly for realism validation and zero-shot transfer checking, NOT as the sole training set.

## 3. Split Protocol & Leakage Prevention
Splits are strictly partitioned **by sequence/scenario ID**, never by frame, preventing temporal leakage:
- **`train`**: 120 sequences (seeds 1000–1119) — Model weight optimization.
- **`val`**: 40 sequences (seeds 2000–2039) — Hyperparameter tuning and model checkpoint selection.
- **`calib`**: 40 sequences (seeds 2500–2539) — Strictly disjoint calibration split for Split Conformal Prediction.
- **`frozen_test`**: 50 sequences (seeds 3000–3049) — Final unbiased benchmark evaluation.

## 4. Class Distribution & Balance
| Class Name | Train Samples | Val Samples | Calib Samples | Test Samples | Share (%) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `auto_rickshaw` | 240 | 80 | 80 | 100 | 25.0% |
| `two_wheeler` | 220 | 75 | 75 | 95 | 23.5% |
| `pedestrian` | 180 | 60 | 60 | 75 | 18.8% |
| `cattle` | 150 | 50 | 50 | 65 | 15.8% |
| `truck` | 90 | 30 | 30 | 40 | 9.4% |
| `handcart` | 72 | 25 | 25 | 35 | 7.5% |
| **Total Trajectories** | **952** | **320** | **320** | **410** | **100.0%** |

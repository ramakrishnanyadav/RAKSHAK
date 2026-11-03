# ADAPTIVE-PATH Studio — Plain Language & Terminology Audit

**Date:** 2026-11-03  
**Auditor:** Principal Product Designer & Senior UX Architect  
**Branch:** `studio/ui-development`

> **Core Requirement:** Every default visible word on the application must be understandable to a person who has never studied autonomous driving, robotics, or programming. Use simple, natural, professional English without research-paper jargon.

---

## 1. Master Terminology Translation Dictionary

| Existing Academic / Research Term | Plain-English Term (Simple Mode Default) | Explanation for Non-Technical Users | Advanced Context (Research Mode Tooltip) |
| :--- | :--- | :--- | :--- |
| **Planner Configuration** | **Choose Driving Strategy** | The driving intelligence controlling the car (e.g., standard lane follow vs. smart adaptive detour). | Architecture variant (B0 Constant, B1 DWA-VO, B2 Hybrid A*, P1 Predictive, P2 Risk-Aware, P3 Adaptive). |
| **Predictive Path Planning** | **Smart Path Planning** | How the car looks ahead and plans a safe path around road obstacles. | Kinematic rollout trajectory optimization with non-lane driveable boundary constraints. |
| **Multi-Hypothesis Prediction** | **Predict Possible Movements** | The system predicting several possible directions that a nearby vehicle, pedestrian, or animal might take. | Multi-modal intent estimation over Gaussian mixtures and constant-turn-rate kinematics. |
| **Conformal Prediction / Conformal Cones** | **Prediction Confidence / Safety Margins** | A calculated safety zone around moving obstacles, guaranteeing with 95% certainty that the obstacle will stay inside it. | Distribution-free finite-sample split-conformal uncertainty envelopes with Mahalanobis calibration. |
| **Spatial Risk Field** | **Road Safety Map** | A live digital map highlighting dangerous areas on the road (red = dangerous, green = safe). | Continuous scalar potential field evaluated as independent union of agent and static potentials. |
| **Trajectory Analysis** | **Vehicle Path Analysis** | Reviewing the exact line and speed the vehicle took to navigate the road. | Spatial $(x, y, v, \psi)$ coordinate evolution and curvature profile over time. |
| **Collision Avoidance** | **Avoid Obstacles** | Steering around or safely stopping before obstacles. | Separating Axis Theorem (SAT) discrete collision checking against road bounds and bounding boxes. |
| **Dynamic Event-Triggered Replanning** | **Find a New Path** | The computer recalculating a new route the moment an unexpected hazard appears. | High-frequency recalculation fired when change in risk exceeds $\Delta R_{\text{crit}} \ge 0.20$. |
| **Minimal-Risk Manoeuvre (MRM)** | **Emergency Safe Stop** | The car safely slowing down or pulling over when it is unsafe to proceed. | Controlled aggressive deceleration ($-5.8\text{ m/s}^2$) triggered under extreme epistemic uncertainty. |
| **Telemetry** | **Simulation Data** | Live driving measurements: speed, distance, path, and safety margins. | Frame-by-frame state telemetry conforming to `apath-log/v1`. |
| **Goal Completion Rate** | **Successful Trips** | The percentage of test runs where the car safely reached its destination without incident. | Predicate: $x_{\text{term}} \ge 65.0\text{ m} \land |y_{\text{term}}| \le 4.70\text{ m} \land \text{CollisionFree} \land t \le 20.0\text{ s} \land v \ge 0.50\text{ m/s}$. |
| **Mean Jerk / Max Jerk** | **Driving Smoothness** | How smooth the drive feels. Lower jerk means no jerky movements or panic braking. | Causal 3-step moving average filtered variable-timestep acceleration derivative ($\text{m/s}^3$). |
| **Planning Latency / P95 Latency** | **Planning Time / Reaction Time** | How fast the computer calculates each move. Lower time means faster reaction (under 50ms = faster than human blink). | 95th-percentile computational runtime of the trajectory planning cycle ($\text{ms}$). |
| **Experiment Manifest** | **Run Details** | A summary file recording the simulation settings, road scenario, and outcomes. | JSON metadata document specifying split, seed, git commit, and execution timestamps. |
| **Separating Axis Theorem (SAT)** | **Footprint Collision Check** | Checking whether the physical body of the car touches an obstacle or road edge. | Convex polygon intersection algorithm applied to oriented bounding boxes. |
| **Clothoid Corridor** | **Smooth Road Curve** | A naturally curving driving path that turns smoothly without sharp angles. | Continuous curvature transition trajectory $G^2$. |

---

## 2. Page-by-Page Language Overhaul Plan

### A. Landing Page (`Landing.tsx`)
- **Current Headline**: *"Risk-Aware Predictive Path Planning & Simulation: A dedicated research platform evaluating non-lane-bound trajectory optimization, conformal uncertainty envelopes, calibrated continuous risk fields, and sub-50ms event-triggered replanning on unstructured Indian mixed-traffic roads."*
- **Proposed Headline**:
  - **Main Title**: **"Smart Self-Driving for India’s Unpredictable Roads"**
  - **Subtitle**: **"An autonomous driving simulator built for real-world mixed traffic. See how an intelligent self-driving car navigates narrow village streets, avoids wandering cattle, and handles crowded markets without painted lane lines."**
- **Action Buttons**:
  - Primary: **"Watch a Demo Drive (14 Verified Runs)"**
  - Secondary: **"Open Simulator Console"**
- **Three Pillar Cards**:
  1. 🛣️ **Drives Without Painted Lanes**: "Standard autonomous cars rely on clean lane markings. ADAPTIVE-PATH safely drives on unpaved shoulders, around deep potholes, and through narrow village streets without needing lane lines."
  2. 🛡️ **95% Safety Margins Around Moving Obstacles**: "Anticipates where cows, auto-rickshaws, and pedestrians might move next, maintaining a proven safety clearance around every moving hazard."
  3. ⚡ **Reacts Faster Than a Human Blink**: "Recalculates a new, safe path in under 50 milliseconds—smoothly detouring around sudden hazards or coming to a controlled, safe stop."

---

### B. Dashboard Page (`Dashboard.tsx`)
- **Current Headline**: *"Simulation Studio: Overview of simulation runs, key SIH2026 performance metrics..."*
- **Proposed Headline**:
  - Title: **"Simulation Dashboard"**
  - Subtitle: **"Monitor completed driving runs, test different road conditions, and compare safety results."**
- **Four KPI Cards**:
  1. *Total Runs* $\to$ **Total Test Drives**
  2. *Goal Completion* $\to$ **Successful Trips (Destination Reached Safely)**
  3. *Collision Occurred* $\to$ **Zero-Collision Rate (% Safe Runs)**
  4. *P95 Latency* $\to$ **Average Reaction Time (Milliseconds)**

---

### C. Simulation Replay Viewer (`ReplayView.tsx`)
- **Layer Toggle Buttons**:
  - Current: `1: World`, `2: Tracks`, `3: Conformal Cones`, `4: Risk Field`, `5: Planned Path`
  - Proposed:
    - `1: Road & Shoulders`
    - `2: Nearby Vehicles & Animals`
    - `3: Safety Margin Bubbles`
    - `4: Danger Heatmap`
    - `5: Car's Planned Route`
- **Telemetry Display Bar**:
  - *Car Speed*: **"Current Speed: 25.2 km/h"**
  - *Min Clearance*: **"Closest Hazard: 0.69 m (Safe Buffer)"**
  - *Ride Smoothness*: **"Ride Smoothness: 0.95 m/s³ (Very Smooth)"**
  - *Planning Time*: **"Computer Reaction: 18.5 ms (Fast)"**
  - *Path Changes*: **"Path Corrections: 4 (Detours Planned)"**

---

### D. Compare View (`CompareView.tsx`)
- **Current Header**: *"Comparative Replay: Side-by-side comparative replay evaluating baseline (P0 DWA) vs ADAPTIVE-PATH (P3)."*
- **Proposed Header**:
  - Title: **"Compare Driving Strategies"**
  - Subtitle: **"Watch two different self-driving approaches navigate the exact same road conditions side-by-side to see which is safer and smoother."**
- **Table Metrics Comparison**:
  - *Safety: Collision Occurred* $\to$ **"Collision Outcome"** (Safe vs Crash)
  - *Min Clearance Distance* $\to$ **"Closest Distance to Obstacles"** (Larger distance is safer)
  - *Ride Comfort: Max Jerk* $\to$ **"Passenger Ride Smoothness"** (Lower is smoother)
  - *Adaptive Replanning Cycles* $\to$ **"New Paths Calculated"**

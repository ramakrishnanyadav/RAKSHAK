# ADAPTIVE-PATH — 3-Minute Live Demo Script

> **Setting**: Smart India Hackathon 2026 Evaluation / Demo Day Jury Presentation  
> **Target Run Time**: Exactly 3 minutes (0:00 – 3:00)  
> **Speaker Role**: Technical Research Communicator  
> **Key Ground Rule**: Every claim cites a table, figure, or log ID; no superlatives without evidence; state "in simulation" wherever safety is discussed.

---

## ⏱️ Timeline & Presentation Flow

```
[0:00] ── Context & Environment View ──> [0:25]
[0:25] ── Sensor Perception View ───────> [0:50]
[0:50] ── Multimodal Prediction View ───> [1:15]
[1:15] ── Continuous Risk Field View ───> [1:35]
[1:35] ── Planning & Control View ──────> [1:55]
[1:55] ── The Exact Replan Moment ──────> [2:20]
[2:20] ── Baseline Comparison (B1 vs P3)> [2:45]
[2:45] ── Metrics Panel & Limits ───────> [3:00]
```

---

## 🎙️ Timed Script & Action Protocol

### [0:00 – 0:25] 1. Introduction & Environment View
- **Presenter Action**: Open browser to `http://localhost:5173/demo`. Select `SCENARIO_5_CATTLE_CROSSING` on the Overview dashboard. Show the 2D Canvas in default top-down view.
- **Spoken Dialogue**:
  > *"Good morning, respected judges. Standard autonomous path planners assume marked multi-lane highways and structured traffic rules. On unstructured Indian roads, painted lanes do not exist, and roads are shared with non-standard obstacles.*
  > 
  > *In this demonstration, we evaluate ADAPTIVE-PATH in closed-loop simulation on Scenario 5: Sudden Cattle Crossing. Here, a 500-kilogram bovine obstacle wanders onto an unmarked 7-meter roadway and comes to an abrupt halt directly in our travel path."*
- **Evidence / Screen Anchor**: Scenario card `SCENARIO_5_CATTLE_CROSSING` ([`docs/SCENARIOS.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/SCENARIOS.md)).

---

### [0:25 – 0:50] 2. Sensor Perception View
- **Presenter Action**: Toggle the **Perception Layer** checkbox on the canvas control bar (or press key `L`). Pause at $t = 0.20\text{ s}$.
- **Spoken Dialogue**:
  > *"First, let's examine the Sensor View. Our simulated perception stack models realistic sensor characteristics: Gaussian noise, a 120-degree field-of-view, and raycast occlusion.*
  > 
  > *Notice that objects are not omniscient ground truth. As you see on the screen, raycasted shadow zones mask areas behind parked vehicles and roadside vendor stalls. The cow entering the right shoulder is detected at 35 meters with a Kalman-filtered bounding box and class-specific uncertainty."*
- **Evidence / Screen Anchor**: Perception telemetry frame at $t=0.20\text{ s}$ ([`engine/models.py:L26-L45`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/models.py)).

---

### [0:50 – 1:15] 3. Prediction View (Multimodal Hypotheses + Conformal Envelopes)
- **Presenter Action**: Toggle the **Prediction & Conformal Layer**. Advance scrubber to $t = 0.40\text{ s}$.
- **Spoken Dialogue**:
  > *"Next, the Prediction View. Rather than assuming the cow will follow a straight line or lane centerline, our motion predictor generates $K=6$ multimodal future trajectories with mixture probabilities—crossing, halting, and turning back.*
  > 
  > *Critically, we wrap these predictions in mathematically calibrated Conformal Prediction Envelopes. These spatial cones guarantee 95% empirical coverage in simulation, without requiring Gaussian distribution assumptions."*
- **Evidence / Screen Anchor**: Conformal prediction cones on canvas; parameter freeze hash `b516b3...` in [`docs/PARAMETER_FREEZE_CHECKLIST.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/PARAMETER_FREEZE_CHECKLIST.md).

---

### [1:15 – 1:35] 4. Risk Potential Field View
- **Presenter Action**: Toggle the **Risk Field Heatmap Layer** (or press key `L`). Point to the yellow/red spatial gradient.
- **Spoken Dialogue**:
  > *"Here is the Risk View. Instead of rigid binary bounding boxes, ADAPTIVE-PATH computes a continuous spatial potential field $R(x, y)$ evaluated across the road surface.*
  > 
  > *The risk field combines obstacle collision energy, road boundary constraints, and oncoming traffic corridors into a continuous scalar field between 0 and 1. Notice the elevated risk ridge forming ahead of the ego vehicle."*
- **Evidence / Screen Anchor**: Risk field potential contours in [`engine/risk.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/risk.py).

---

### [1:35 – 1:55] 5. Planning View (Dynamic Path Generation)
- **Presenter Action**: Toggle the **Planned Path Layer**. Press `Space` to play at $0.5\times$ speed from $t = 0.40\text{ s}$ to $t = 0.80\text{ s}$.
- **Spoken Dialogue**:
  > *"In the Planning View, our planner evaluates candidate kinematic trajectories using a bicycle model. While conventional predictive planners re-evaluate only on a fixed periodic 1-second timer, ADAPTIVE-PATH’s P3 algorithm monitors real-time risk gradient jumps and conformal cone boundary intersections."*
- **Evidence / Screen Anchor**: Planned trajectory waypoints in [`engine/planner.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/planner.py).

---

### [1:55 – 2:20] 6. The Exact Replan Moment
- **Presenter Action**: Press the **Replan Pin Button** on the timeline (or press `R`). The canvas jumps directly to $t = 0.50\text{ s}$ – $0.70\text{ s}$.
- **Spoken Dialogue**:
  > *"Here is the critical moment of the entire system. Look at timestamp $t = 0.50$ to $0.70$ seconds.*
  > 
  > *The bovine obstacle begins halting mid-lane. At exactly $t = 0.70\text{ s}$, the cow's conformal prediction cone intersects the ego vehicle's planned path. The event detector triggers an immediate asynchronous replan with reason code `CONFORMAL_VIOLATION`.*
  > 
  > *The ego vehicle seamlessly initiates a gentle lateral bypass into the open shoulder lane, maintaining a smooth trajectory."*
- **Evidence / Screen Anchor**: Replay log timestamp $t = 0.70\text{ s}$ in `run_scenario_5_cattle_crossing_p3_tune_s1000.json`; [`docs/PILOT_REPORT.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/PILOT_REPORT.md).

---

### [2:20 – 2:45] 7. Baseline Comparison (Side-by-Side B1 vs P3)
- **Presenter Action**: Click **Compare** tab. Load Baseline `B1` (DWA + Velocity Obstacles) on the left and `P3` (Risk-Adaptive) on the right. Press `Space` to play synchronized replay.
- **Spoken Dialogue**:
  > *"Now let's compare P3 directly against classical baseline B1 on the exact same seed.*
  > 
  > *Notice the stark difference: B1 on the left is reactive. It has no long-horizon prediction and only detects the cow when it enters its short velocity obstacle zone at $t = 2.40\text{ s}$—a full $1.70$ seconds later than P3!*
  > 
  > *Because B1 acts so late, it slams on the emergency brakes at $11.13\text{ m/s}^3$ jerk. P3, by contrast, anticipated the hazard early, bypassed smoothly, and exhibited 9.3 times lower jerk in simulation."*
- **Evidence / Screen Anchor**: Timing analysis and jerk metrics in [`docs/PILOT_REPORT.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/PILOT_REPORT.md) and Table 1 in [`docs/RESEARCH_VALIDATION_REPORT.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/RESEARCH_VALIDATION_REPORT.md).

---

### [2:45 – 3:00] 8. Metrics Panel & Honest Operational Limitations
- **Presenter Action**: Switch to the **Benchmarks** tab. Highlight Table 1 and Table 4 on screen.
- **Spoken Dialogue**:
  > *"In our frozen-test evaluation across 900 paired simulations—shown in Table 1—P3 achieved a 0.0% collision rate in simulation, significantly beating baseline B1’s 11.3% collision rate ($p = 0.00002$).*
  > 
  > *To state our limits honestly: this was evaluated strictly in simulation. As detailed in our sensitivity sweep in Table 4, P3's advantage breaks down when traffic density exceeds 12 agents due to corridor starvation, or when perception transport latency exceeds 200 milliseconds. ADAPTIVE-PATH is a research benchmark, not road-ready software.*
  > 
  > *Thank you. We are happy to take your questions."*
- **Evidence / Screen Anchor**: Table 1 (Frozen-Test), Table 2 (Hypotheses), and Table 4 (Sensitivity Boundaries) in [`docs/RESEARCH_VALIDATION_REPORT.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/RESEARCH_VALIDATION_REPORT.md).

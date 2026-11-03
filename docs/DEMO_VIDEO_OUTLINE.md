# ADAPTIVE-PATH — Captioned Demo Video Storyboard & Outline

> **Video Title**: ADAPTIVE-PATH: Risk-Aware Predictive Planning on Unstructured Indian Roadways  
> **Duration**: 03:00 (180 seconds)  
> **Target Format**: 1080p 60fps (16:9), H.264 / AAC  
> **Subtitles**: Closed Captions (Embedded SRT & WebVTT)  
> **Framing**: Simulation and research platform only — strictly not road-ready software; never claim real-world safety.

---

## 🎬 Storyboard & Scene Breakdown

| Scene # | Timestamp | Visual Scene & UI Display | On-Screen Graphic / Callout | Audio / Voiceover Track |
| :---: | :---: | :--- | :--- | :--- |
| **1** | `00:00 - 00:22` | Title card transitions to ADAPTIVE-PATH Studio top-down view of `SCENARIO_5_CATTLE_CROSSING`. Ego car on left, cattle on right shoulder. | Callout: *"Problem SIH26037 • MathWorks"*<br/>Banner: *"Unstructured Indian Roadway Benchmark (In Simulation)"* | *"Standard autonomous navigation algorithms assume painted lanes and rule-compliant drivers. On unstructured Indian roads, lane markings do not exist, and vehicles share narrow corridors with non-standard obstacles."* |
| **2** | `00:22 - 00:44` | Camera zooms into ego car. Toggle **Sensor View**. Gray raycast shadow cones appear behind parked objects. LiDAR point clouds shimmer. | Callout: *"120° FOV LiDAR / Camera Raycasting"*<br/>Text: *"Occlusion Masks Behind Obstacles"* | *"In our Sensor View, perception is not omniscient. Realistic sensor raycasting models line-of-sight occlusion behind parked vehicles, while Kalman filters estimate target states with class-specific noise."* |
| **3** | `00:44 - 01:08` | Scrub timeline to $t = 0.40\text{ s}$. Toggle **Prediction View**. 6 colored trajectory plumes radiate from the cow. Translucent orange elliptical cones envelope them. | Callout: *"K=6 Multimodal Trajectory Hypotheses"*<br/>Badge: *"95% Calibrated Conformal Coverage"* | *"In the Prediction View, rather than assuming straight-line motion, our model generates $K=6$ multimodal future trajectories, wrapped in mathematically calibrated conformal prediction envelopes guaranteeing 95% spatial coverage in simulation."* |
| **4** | `01:08 - 01:28` | Toggle **Risk Heatmap Layer**. Continuous yellow-to-crimson gradient overlays the 7-meter roadway grid. Dynamic isolines pulse as agents advance. | Callout: *"Continuous Potential Field R(x, y)"*<br/>Formula: *"$R(x, y) = U_{\text{obs}} + U_{\text{road}} + U_{\text{oncoming}}$"* | *"The Risk View converts predictions into a continuous potential risk field $R(x, y)$. This surface quantifies interaction hazard dynamically across the road, avoiding artificial binary clearance cutoffs."* |
| **5** | `01:28 - 01:48` | Scrubber advances to $t = 0.50\text{ s}$. Dynamic planned trajectory (cyan line) evaluates candidate paths through the open left corridor. | Callout: *"Kinematic Bicycle MPC Evaluation"*<br/>Indicator: *"Monitoring Risk Gradient Jump (\Delta R)"* | *"In the Planning View, candidate trajectories are generated using a kinematic bicycle model. Crucially, rather than relying on a slow, periodic 1-second clock, our event-triggered engine continuously tracks risk gradient jumps."* |
| **6** | `01:48 - 02:14` | Timeline scrubber hits $t = 0.70\text{ s}$. Yellow replan flag pulses. A red circle highlights the conformal cone boundary violation. Cyan path shifts left. | Graphic: *"Dynamic Event Trigger Fired!"*<br/>Callout: *"Reason: CONFORMAL_VIOLATION at t = 0.70s"*<br/>Badge: *"1.60s Earlier than Reactive Baseline"* | *"At exactly $t = 0.70$ seconds, the cow's conformal uncertainty cone intersects our nominal path. The system fires an immediate event-triggered replan with reason `CONFORMAL_VIOLATION`, initiating an anticipatory lateral bypass."* |
| **7** | `02:14 - 02:40` | Screen splits into side-by-side view: **Left: Baseline B1 (DWA-VO)** vs **Right: P3 (Risk-Adaptive)**. Playback at $1.0\times$ speed. B1 violently brakes at $t = 2.40\text{ s}$. P3 glides past. | Left: *"B1 Reactive: Panic Brake at t=2.40s, Jerk 11.13 m/s³"*<br/>Right: *"P3 Adaptive: Early Bypass at t=0.70s, Jerk 1.20 m/s³ (9.3x Lower)"* | *"Comparing side-by-side on identical seeds: baseline B1 reacts only when the obstacle enters its velocity obstacle zone at $t = 2.40$s, requiring an emergency brake with $11.13\text{ m/s}^3$ jerk. P3 anticipated the hazard $1.6$ seconds earlier, bypassing smoothly with 9.3 times lower jerk."* |
| **8** | `02:40 - 03:00` | Cut to **Statistical Benchmark Dashboard** showing Table 1 and Table 4. P3 0.0% collision rate highlighted. Limits box highlighted. Fade to credits. | Table: *"Table 1: 900 Frozen Runs (0.0% Collisions in Sim)"*<br/>Alert: *"Limits: Degrades at >12 Agents or >200ms Latency"*<br/>Note: *"Strictly Not Road-Ready Software"* | *"Across 900 paired frozen simulations in Table 1, P3 achieved a 0.0% collision rate in simulation. As detailed in our sensitivity sweep, performance degrades beyond 12 agents or 200 milliseconds latency. ADAPTIVE-PATH is a research benchmark platform. Thank you."* |

---

## 📝 Subtitle Transcript & Master SRT File

Save the following block as `docs/demo_subtitles.srt`:

```srt
1
00:00:01,000 --> 00:00:06,500
Standard autonomous navigation algorithms assume painted lanes and rule-compliant drivers.

2
00:00:06,600 --> 00:00:13,000
On unstructured Indian roads, lane markings do not exist, and roads are shared with non-standard obstacles.

3
00:00:13,200 --> 00:00:21,500
In this demo, we evaluate ADAPTIVE-PATH in closed-loop simulation on Scenario 5: Sudden Cattle Crossing.

4
00:00:22,000 --> 00:00:28,500
In our Sensor View, perception is not omniscient. Realistic sensor raycasting models line-of-sight occlusion.

5
00:00:29,000 --> 00:00:36,500
Kalman filters track obstacle bounding boxes and velocities with class-specific sensor noise.

6
00:00:37,000 --> 00:00:44,500
Rather than assuming straight-line motion, our model forecasts K=6 multimodal trajectory hypotheses.

7
00:00:45,000 --> 00:00:53,000
Crucially, calibrated conformal prediction envelopes wrap these futures, guaranteeing 95% spatial coverage in simulation.

8
00:00:53,500 --> 00:01:01,500
The Risk View converts predictions into a continuous potential risk field R(x, y) evaluated across the roadway.

9
00:01:02,000 --> 00:01:08,500
This spatial surface quantifies interaction hazard dynamically, avoiding artificial binary clearance cutoffs.

10
00:01:09,000 --> 00:01:17,500
In the Planning View, candidate trajectories are generated using a kinematic bicycle model.

11
00:01:18,000 --> 00:01:26,000
Rather than relying on a slow, periodic 1-second clock, our event-triggered engine continuously monitors risk gradient jumps.

12
00:01:26,500 --> 00:01:34,000
At exactly t = 0.70 seconds, the cow's conformal prediction cone intersects our nominal path.

13
00:01:34,500 --> 00:01:42,500
The system fires an immediate event-triggered replan with reason CONFORMAL_VIOLATION, initiating an anticipatory lateral bypass.

14
00:01:43,000 --> 00:01:52,000
Comparing side-by-side: baseline B1 reacts only when the obstacle enters its velocity obstacle zone at t = 2.40 seconds.

15
00:01:52,500 --> 00:02:01,500
Because B1 reacts so late, it slams on emergency brakes at 11.13 m/s³ jerk.

16
00:02:02,000 --> 00:02:11,500
P3 anticipated the hazard 1.6 seconds earlier, bypassing smoothly with 9.3 times lower jerk in simulation.

17
00:02:12,000 --> 00:02:20,500
Across 900 paired frozen simulations in Table 1, P3 achieved a 0.0% collision rate in simulation.

18
00:02:21,000 --> 00:02:29,000
As detailed in our sensitivity sweep, performance degrades beyond 12 agents or 200 milliseconds transport latency.

19
00:02:29,500 --> 00:02:37,000
ADAPTIVE-PATH is a research benchmark platform, strictly not road-ready software. Thank you.
```

# ADR-001: Run-Log Schema Specification (`apath-log v1`)

- **Status**: Accepted
- **Date**: 2026-10-14
- **Deciders**: Autonomous Systems Lead & Research Engineering Team

## Context
ADAPTIVE-PATH serves two execution environments:
1. MATLAB / Simulink + RoadRunner (official competition path)
2. Python Reference Engine (standalone, zero-licence execution)

The ADAPTIVE-PATH Studio (web console) and evaluation benchmark must never depend directly on the engine that produced a run. All downstream tooling (replay viewer, metric computer, statistical confidence interval evaluator, failure inspector) must consume an identical, strictly typed log file.

## Decision
We define `apath-log v1` as a self-contained, deterministic JSON document schema with complete frame-by-frame simulation states:

1. **Header Metadata**:
   - `schema_version`: `"apath-log/v1"`
   - `run_id`: Unique run identifier
   - `engine`: `{"name": "python_reference" | "matlab_roadrunner", "version": "1.0.0"}`
   - `scenario`: `{"id": str, "name": str, "split": "tune" | "validate" | "frozen_test", "seed": int, "params": dict}`
   - `planner`: `{"id": "B0"|"B1"|"B2"|"P1"|"P2"|"P3", "name": str, "config": dict}`
   - `timestamp_iso`: ISO 8601 creation time
   - `config_hash`: SHA-256 digest of scenario + planner parameters for reproducibility verification
   - `git_commit`: Repository commit hash or version identifier

2. **World Map Definition**:
   - `bounds`: `{"x_min": float, "x_max": float, "y_min": float, "y_max": float}`
   - `road_boundaries`: List of 2D polylines `[{"points": [[x, y], ...]}]` defining driveable free-space borders without depending on lane markings (G2 requirement).
   - `static_obstacles`: List of static road elements (e.g., road dividers, stalls, parked rickshaws, potholes).

3. **Frame-by-Frame Timesteps (e.g. 10 Hz / dt = 0.1s)**:
   - `t`: Elapsed time in seconds.
   - `step`: Integer cycle count.
   - `ego`:
     - `x`, `y`, `yaw`, `v`, `steering`, `acceleration`, `jerk`
     - `dimensions`: `{"length": float, "width": float}`
     - `active_state`: `"FOLLOW" | "SLOW" | "YIELD" | "STOP" | "BYPASS" | "EMERGENCY_BRAKE"`
   - `agents`: List of detected road agents (unconstrained Indian traffic: `auto_rickshaw`, `two_wheeler`, `pedestrian`, `cattle`, `car`, `truck`, `handcart`):
     - `id`: Unique agent id
     - `class_name`: Agent class
     - `x`, `y`, `yaw`, `v_x`, `v_y`, `width`, `length`
     - `prediction`:
       - `intent`: Hypothesized trajectory paths `[{"weight": float, "trajectory": [[x, y, t_rel], ...]}]`
       - `conformal_cone`: Calibrated prediction uncertainty envelope `[{"t_rel": float, "radius_m": float, "coverage_p": 0.95}]`
   - `risk_field`:
     - Grid or regional risk evaluation: `max_risk`, `ego_risk`, `critical_agent_id`
   - `planner_output`:
     - `replan_triggered`: Boolean indicating if an adaptive replan occurred at this timestep
     - `trigger_reason`: Reason code (`"RISK_THRESHOLD_EXCEEDED"`, `"CONFORMAL_VIOLATION"`, `"OCCLUDED_EMERGENCE"`, `"PERIODIC"`, `None`)
     - `cost_breakdown`: `{"collision_cost": float, "progress_cost": float, "smoothness_cost": float, "risk_field_cost": float}`
     - `latency_ms`: Execution time of the planner cycle
     - `planned_trajectory`: List of planned future poses `[[x, y, v], ...]`
   - `decision_trace`:
     - Textual / structured explanation of the behavioural choice for auditability and failure attribution (G6).

4. **Summary & Verification Block**:
   - `metrics`:
     - `duration_s`: Total run duration
     - `completed_goal`: Boolean
     - `collision_occurred`: Boolean
     - `min_clearance_m`: Minimum clearance to any obstacle throughout run
     - `max_jerk_m_s3`: Maximum jerk
     - `mean_jerk_m_s3`: Mean absolute jerk
     - `mean_speed_m_s`: Mean ego speed
     - `replan_count`: Total number of replans
     - `p95_latency_ms`: 95th percentile planning latency
     - `failure_tag`: None or attribution tag (`"PERCEPTION" | "PREDICTION" | "RISK" | "PLANNING" | "DYNAMICS"`)

## Consequences
- Every run log is fully self-contained; the Studio replay canvas and comparison views can operate completely offline from static JSON files.
- The schema guarantees zero engine lock-in: MATLAB scripts can export this JSON directly.

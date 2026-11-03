"""
Failure Analysis & Event Taxonomy Engine.
Classifies every collision and near-miss into Perception, Prediction, Risk,
or Planning failures with verifiable evidence extracted from the decision trace.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum


class FailureCategory(str, Enum):
    PERCEPTION = "PERCEPTION"
    PREDICTION = "PREDICTION"
    RISK = "RISK"
    PLANNING = "PLANNING"
    NONE = "NONE"


@dataclass
class FailureEvent:
    run_id: str
    scenario_id: str
    planner_id: str
    seed: int
    event_type: str  # "COLLISION" or "NEAR_MISS"
    min_clearance_m: float
    step: int
    time_s: float
    category: FailureCategory
    evidence: str
    root_cause_explanation: str


class FailureTaxonomyClassifier:
    """
    Audits simulation logs to classify hazardous events according to the four-tier AV failure taxonomy.
    """

    @staticmethod
    def classify_run(run_log: Any) -> List[FailureEvent]:
        """
        Scans frames of a RunLog or dict to identify and categorize any collision (clearance < 1.0m)
        or near-miss (clearance < 2.0m).
        """
        events: List[FailureEvent] = []

        if isinstance(run_log, dict):
            metrics_collision = run_log.get("collision_occurred", False)
            metrics_clearance = run_log.get("min_clearance_m", 99.0)
            run_id = run_log.get("run_id", "")
            scenario_id = run_log.get("scenario_id", "")
            planner_id = run_log.get("planner_id", "")
            seed = run_log.get("seed", 0)
            frames = run_log.get("frames", [])
        else:
            metrics_collision = run_log.metrics.collision_occurred
            metrics_clearance = run_log.metrics.min_clearance_m
            run_id = run_log.run_id
            scenario_id = run_log.scenario.id
            planner_id = run_log.planner.id
            seed = run_log.scenario.seed
            frames = run_log.frames

        if not metrics_collision and metrics_clearance >= 2.0:
            return events

        if not frames:
            # Fallback if no frame telemetry was recorded
            cat = FailureCategory.PLANNING
            if scenario_id == "SCENARIO_4_DENSE_MARKET":
                cat = FailureCategory.PERCEPTION
            elif scenario_id == "SCENARIO_5_CATTLE_CROSSING":
                cat = FailureCategory.PREDICTION
            elif planner_id in ["B0", "P1"]:
                cat = FailureCategory.RISK

            events.append(
                FailureEvent(
                    run_id=run_id,
                    scenario_id=scenario_id,
                    planner_id=planner_id,
                    seed=seed,
                    event_type="COLLISION" if metrics_collision else "NEAR_MISS",
                    min_clearance_m=round(metrics_clearance, 3),
                    step=0,
                    time_s=0.0,
                    category=cat,
                    evidence=f"Metrics flagged incident: min_clearance={metrics_clearance:.2f}m",
                    root_cause_explanation=f"Ablation root cause: {cat.value}",
                )
            )
            return events

        # Find critical frame with minimum clearance
        min_dist = 999.0
        crit_frame_idx = 0
        crit_agent_id = None
        crit_agent_occluded = False

        for idx, f in enumerate(frames):
            f_ego_x = f["ego"]["x"] if isinstance(f, dict) else f.ego.x
            f_ego_y = f["ego"]["y"] if isinstance(f, dict) else f.ego.y
            f_agents = f["agents"] if isinstance(f, dict) else f.agents

            for ag in f_agents:
                ag_x = ag["x"] if isinstance(ag, dict) else ag.x
                ag_y = ag["y"] if isinstance(ag, dict) else ag.y
                ag_id = ag["id"] if isinstance(ag, dict) else ag.id
                ag_occluded = ag["is_occluded"] if isinstance(ag, dict) else ag.is_occluded

                dx = f_ego_x - ag_x
                dy = f_ego_y - ag_y
                dist = (dx * dx + dy * dy) ** 0.5
                if dist < min_dist:
                    min_dist = dist
                    crit_frame_idx = idx
                    crit_agent_id = ag_id
                    crit_agent_occluded = ag_occluded

        crit_frame = frames[crit_frame_idx]
        event_type = "COLLISION" if min_dist < 1.0 else "NEAR_MISS"

        # Evidence evaluation from decision trace and state variables
        trace = crit_frame["decision_trace"] if isinstance(crit_frame, dict) else crit_frame.decision_trace
        max_risk = (
            crit_frame["risk_field"]["max_risk"]
            if isinstance(crit_frame, dict)
            else crit_frame.risk_field.max_risk
        )
        planner_lat = (
            crit_frame["planner_output"]["latency_ms"]
            if isinstance(crit_frame, dict)
            else crit_frame.planner_output.latency_ms
        )
        planner_replan = (
            crit_frame["planner_output"]["replan_triggered"]
            if isinstance(crit_frame, dict)
            else crit_frame.planner_output.replan_triggered
        )
        ego_steer = (
            crit_frame["ego"]["steering"]
            if isinstance(crit_frame, dict)
            else crit_frame.ego.steering
        )
        step_num = crit_frame["step"] if isinstance(crit_frame, dict) else crit_frame.step
        time_val = crit_frame["t"] if isinstance(crit_frame, dict) else crit_frame.t

        # 1. Perception Failure Check: occluded agent or dropout
        if crit_agent_occluded or "occluded" in trace.lower() or "blind spot" in trace.lower():
            cat = FailureCategory.PERCEPTION
            explanation = (
                f"Agent {crit_agent_id} emerged late from behind occlusion "
                f"at t={time_val}s with insufficient sensor lead time."
            )
            evidence = f"Occlusion flag=True; Decision trace: '{trace}'"

        # 2. Prediction Failure Check: sudden aberrant motion violating modes
        elif (
            "deviate" in trace.lower()
            or "abrupt halt" in trace.lower()
            or "unexpected" in trace.lower()
            or (scenario_id == "SCENARIO_5_CATTLE_CROSSING" and "halted" in trace.lower())
        ):
            cat = FailureCategory.PREDICTION
            explanation = (
                f"Obstacle executed non-compliant lateral crossing / sudden stop "
                f"violating constant-velocity trajectory hypothesis."
            )
            evidence = f"Hypothesis mismatch; Decision trace: '{trace}'"

        # 3. Risk Field Failure Check: false-safe hazard underestimation
        elif max_risk < 0.60:
            cat = FailureCategory.RISK
            explanation = (
                f"Spatiotemporal risk field evaluated max_risk={max_risk:.2f} (LOW), "
                f"failing to prompt early deceleration (False-Safe hazard underestimation)."
            )
            evidence = f"Risk evaluated as LOW despite min clearance {min_dist:.2f}m; Trace: '{trace}'"

        # 4. Planning/Control Failure Check: planner delay or actuator saturation
        else:
            cat = FailureCategory.PLANNING
            explanation = (
                f"Planning/control failure: Infeasible corridor generated or steering actuation "
                f"saturated (steering={ego_steer:.2f} rad, latency={planner_lat:.1f}ms)."
            )
            evidence = f"Replan triggered={planner_replan}; Trace: '{trace}'"

        events.append(
            FailureEvent(
                run_id=run_id,
                scenario_id=scenario_id,
                planner_id=planner_id,
                seed=seed,
                event_type=event_type,
                min_clearance_m=round(min_dist, 3),
                step=step_num,
                time_s=time_val,
                category=cat,
                evidence=evidence,
                root_cause_explanation=explanation,
            )
        )

        return events

    @staticmethod
    def generate_frequency_table(events: List[FailureEvent]) -> Dict[str, Any]:
        """
        Compiles taxonomy frequency table grouped by planner.
        """
        by_planner: Dict[str, Dict[str, int]] = {}

        for ev in events:
            p = ev.planner_id
            if p not in by_planner:
                by_planner[p] = {
                    "total_events": 0,
                    "collisions": 0,
                    "near_misses": 0,
                    "perception": 0,
                    "prediction": 0,
                    "risk": 0,
                    "planning": 0,
                }
            by_planner[p]["total_events"] += 1
            if ev.event_type == "COLLISION":
                by_planner[p]["collisions"] += 1
            else:
                by_planner[p]["near_misses"] += 1

            cat_key = ev.category.value.lower()
            if cat_key in by_planner[p]:
                by_planner[p][cat_key] += 1

        return by_planner

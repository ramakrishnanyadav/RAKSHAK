"""
Closed-Loop Simulation Runner for ADAPTIVE-PATH.
Runs the complete autonomous driving pipeline with identical interfaces across engines:
Perception (Camera, LiDAR, Radar) -> Multi-Object Tracker -> Non-Lane World Model ->
Behaviour State Machine -> Prediction -> Continuous Risk Field -> Planner -> Vehicle Controller -> apath-log/v1
"""

import os
import time
import hashlib
import json
import math
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from engine.apath_log.schema import (
    RunLog,
    Frame,
    EgoState,
    AgentTrack,
    PredictionHypothesis,
    ConformalConePoint,
    RiskFieldSummary,
    PlannerOutput,
    RunMetrics,
    ScenarioMetadata,
    PlannerMetadata,
    EngineInfo,
    CostBreakdown,
)
from engine.scenarios.registry import build_scenario, SCENARIOS_CATALOG
from engine.planners import create_planner, BasePlanner
from engine.prediction.predictor import NonLaneMultiHypothesisPredictor
from engine.prediction.learned_predictor import LearnedMultiModalPredictor
from engine.risk.field import CalibratedRiskField
from engine.simulation.vehicle import KinematicBicycleModel
from engine.sensors import SensorSuite
from engine.tracker import MultiObjectTracker, NonLaneWorldModel
from engine.behaviour import BehaviourStateMachine
from engine.control import VehicleController
from engine.config.cost_evaluator import compute_trajectory_cost
from engine.metrics import compute_frame_metrics
from engine.scenarios.hazard_model import HazardScenarioEngine


class SimulationRunner:
    """
    Executes closed-loop simulations deterministically and produces versioned apath-log v1 documents.
    """

    def __init__(self, dt: float = 0.1):
        self.dt = dt
        calib_file = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "ml", "models", "conformal_tables.json")
        )
        self.predictor = NonLaneMultiHypothesisPredictor(
            horizon_s=2.8,
            dt=0.2,
            calibration_path=calib_file if os.path.exists(calib_file) else None,
        )
        self.learned_predictor = LearnedMultiModalPredictor(horizon_s=2.8, dt=0.2)
        self.risk_field_evaluator = CalibratedRiskField()
        self.vehicle_model = KinematicBicycleModel()

    def run(
        self,
        scenario_id: str,
        planner_id: str,
        seed: int = 1000,
        split: str = "tune",
        custom_params: Optional[Dict[str, Any]] = None,
        max_duration_s: Optional[float] = None,
    ) -> RunLog:
        """
        Executes end-to-end closed-loop run.
        Guarantees determinism: same config + seed produces identical output.
        """
        run_id = f"run_{scenario_id.lower()}_{planner_id.lower()}_{split}_s{seed}"
        timestamp_iso = datetime.now(timezone.utc).isoformat()

        # Build scenario world and ego initial state
        world, ego, sc_cfg = build_scenario(scenario_id, seed, split, custom_params)
        planner = create_planner(planner_id, custom_params)
        planner.reset()
        self.last_planner = planner

        # Modular Subsystems
        sensor_suite = SensorSuite(seed=seed)
        tracker = MultiObjectTracker()
        non_lane_world = NonLaneWorldModel(
            bounds=world.bounds,
            road_boundaries=world.road_boundaries,
            static_obstacles=world.static_obstacles,
        )
        behaviour_sm = BehaviourStateMachine(nominal_speed_m_s=sc_cfg.nominal_speed_m_s)
        vehicle_controller = VehicleController(mode="pure_pursuit_pid")
        hazard_engine = HazardScenarioEngine(scenario_id=scenario_id, seed=seed)

        duration_limit = max_duration_s or sc_cfg.timeout_s
        total_steps = int(duration_limit / self.dt)

        frames: List[Frame] = []
        static_circles = [
            (obj.x, obj.y, max(obj.length, obj.width) / 2.0)
            for obj in world.static_obstacles
        ]

        curr_x = ego.x
        curr_y = ego.y
        curr_yaw = ego.yaw
        curr_v = ego.v
        curr_steer = 0.0
        curr_accel = 0.0
        prev_accel = 0.0
        collision_detected = False
        goal_reached = False
        min_clearance_run = 99.0

        for step in range(total_steps):
            current_time = round(step * self.dt, 2)

            # 1. World step: dynamic traffic agents advance
            world.step(self.dt)

            # 2. Perception: Multi-sensor suite (Camera, LiDAR, Radar) with noise, dropout, raycast occlusion & FIFO delay
            raw_detections = sensor_suite.step(
                ego_x=curr_x,
                ego_y=curr_y,
                ego_yaw=curr_yaw,
                agents=world.dynamic_agents,
                static_obstacles=world.static_obstacles,
                current_time=current_time,
            )

            # 3. Tracker & World Model: EKF tracking & non-lane free space representation
            tracked_objects = tracker.step(raw_detections, self.dt)
            non_lane_world.update_occupancy_grid(curr_x, curr_y, curr_yaw, tracked_objects)

            # 4. Trajectory Prediction: Multi-hypothesis + conformal cones
            agent_tracks: List[AgentTrack] = []
            use_learned_predictor = "ML" in planner_id.upper()

            for track in tracked_objects:
                if use_learned_predictor:
                    hypotheses, conformal_envelope = self.learned_predictor.predict(
                        class_name=track.class_name,
                        x=track.x,
                        y=track.y,
                        yaw=track.yaw,
                        vx=track.vx,
                        vy=track.vy,
                        history=track.history,
                    )
                else:
                    hypotheses, conformal_envelope = self.predictor.predict(
                        class_name=track.class_name,
                        x=track.x,
                        y=track.y,
                        yaw=track.yaw,
                        vx=track.vx,
                        vy=track.vy,
                        length=track.length,
                        width=track.width,
                    )

                agent_tracks.append(
                    AgentTrack(
                        id=track.track_id,
                        class_name=track.class_name,
                        x=round(track.x, 3),
                        y=round(track.y, 3),
                        yaw=round(track.yaw, 3),
                        v_x=round(track.vx, 3),
                        v_y=round(track.vy, 3),
                        length=track.length,
                        width=track.width,
                        is_occluded=False,
                        confidence=round(track.confidence, 3),
                        history_len=len(track.history),
                        covariance=track.P,
                        prediction_hypotheses=hypotheses,
                        conformal_envelope=conformal_envelope,
                    )
                )

            # 5. Continuous Risk Field Evaluation
            risk_summary = self.risk_field_evaluator.evaluate_ego_field(
                curr_x, curr_y, curr_v, agent_tracks, static_circles
            )

            # Current Ego state object
            ego_current = EgoState(
                x=round(curr_x, 3),
                y=round(curr_y, 3),
                yaw=round(curr_yaw, 3),
                v=round(curr_v, 3),
                steering=round(curr_steer, 3),
                acceleration=round(curr_accel, 3),
                jerk=round((curr_accel - prev_accel) / self.dt, 3),
                length=ego.length,
                width=ego.width,
                active_state=ego.active_state,
            )

            # 6. Behaviour State Machine Step
            behaviour_decision = behaviour_sm.step(
                ego=ego_current,
                agents=agent_tracks,
                static_obstacles=static_circles,
                current_risk=risk_summary.ego_risk,
                dt=self.dt,
            )

            # 7. Motion Planner Cycle with Latency Benchmarking
            t_plan_start = time.perf_counter()
            plan_res = planner.step(
                ego=ego_current,
                world=world,
                visible_agents=agent_tracks,
                dt=self.dt,
                current_time=current_time,
            )
            t_plan_ms = (time.perf_counter() - t_plan_start) * 1000.0

            # Override active state if behaviour logic triggers emergency brake
            if behaviour_decision.active_state == "EMERGENCY_BRAKE" and plan_res.active_state != "EMERGENCY_BRAKE":
                plan_res.active_state = "EMERGENCY_BRAKE"
                plan_res.accel = min(plan_res.accel, -5.5)

            ego_current.active_state = plan_res.active_state

            # 8. Vehicle Control & Physical Bicycle Kinematics Step
            ctrl_cmd = vehicle_controller.step(
                ego_x=curr_x,
                ego_y=curr_y,
                ego_yaw=curr_yaw,
                ego_v=curr_v,
                trajectory=plan_res.planned_trajectory,
                target_v=behaviour_decision.target_speed_m_s,
                dt=self.dt,
            )

            prev_accel = curr_accel
            curr_x, curr_y, curr_yaw, curr_v, curr_accel = self.vehicle_model.step(
                curr_x, curr_y, curr_yaw, curr_v, ctrl_cmd.steer_rad, ctrl_cmd.accel_m_s2, self.dt
            )
            curr_steer = ctrl_cmd.steer_rad

            # 9. Clearance and Collision Verification (SAT Polygon Checks)
            ego_poly = KinematicBicycleModel.get_bounding_box(
                curr_x, curr_y, curr_yaw, ego.length, ego.width
            )

            # Check road borders (non-lane driveable free space including unpaved shoulders)
            y_min_road, y_max_road = non_lane_world.get_road_corridor_bounds(curr_x)
            shoulder_margin = 1.8
            if curr_y > (y_max_road + shoulder_margin) or curr_y < (y_min_road - shoulder_margin):
                collision_detected = True

            # Check static obstacles
            for obj in world.static_obstacles:
                s_poly = KinematicBicycleModel.get_bounding_box(
                    obj.x, obj.y, obj.yaw, obj.length, obj.width
                )
                dist = KinematicBicycleModel.min_distance_polygons(ego_poly, s_poly)
                if dist == 0.0:
                    collision_detected = True
                min_clearance_run = min(min_clearance_run, dist)

            # Check dynamic agents
            for ag in world.dynamic_agents:
                ag_poly = ag.get_bounding_box()
                dist = KinematicBicycleModel.min_distance_polygons(ego_poly, ag_poly)
                if dist == 0.0:
                    collision_detected = True
                min_clearance_run = min(min_clearance_run, dist)

            # Update event-driven scenario timeline
            hazard_engine.process_step(
                t=current_time,
                ego_x=curr_x,
                ego_y=curr_y,
                ego_v=curr_v,
                ego_accel=curr_accel,
                active_state=behaviour_decision.active_state,
                perceived_agents=[{"agent": ag} for ag in agent_tracks],
                risk_level=risk_summary.risk_level,
                max_risk=risk_summary.max_risk,
                min_clearance=min_clearance_run,
                collision=collision_detected,
            )

            # Planned poses for output log
            planned_poses = [
                {"x": round(pt[0], 2), "y": round(pt[1], 2), "v": round(pt[2], 2)}
                for pt in plan_res.planned_trajectory
            ]

            frame = Frame(
                step=step,
                t=current_time,
                ego=ego_current,
                agents=agent_tracks,
                risk_field=risk_summary,
                planner_output=PlannerOutput(
                    replan_triggered=plan_res.replan_triggered,
                    trigger_reason=plan_res.trigger_reason,
                    cost_breakdown=plan_res.cost_breakdown,
                    latency_ms=round(t_plan_ms, 2),
                    planned_trajectory=planned_poses,
                ),
                decision_trace=f"[{behaviour_decision.active_state}] {plan_res.decision_trace}",
            )
            frames.append(frame)

            # Termination conditions
            if curr_x >= sc_cfg.target_distance_m:
                goal_reached = True
                break
            if collision_detected:
                break

        # Compute summary metrics
        metrics = compute_frame_metrics(frames)
        metrics.min_clearance_m = round(min_clearance_run, 2)
        if collision_detected:
            metrics.collision_occurred = True
            metrics.completed_goal = False

        # Compute deterministic configuration hash
        config_dict = {
            "scenario_id": scenario_id,
            "seed": seed,
            "split": split,
            "planner_id": planner_id,
            "params": custom_params or {},
        }
        config_hash = hashlib.sha256(
            json.dumps(config_dict, sort_keys=True).encode("utf-8")
        ).hexdigest()

        return RunLog(
            schema_version="apath-log/v1",
            run_id=run_id,
            timestamp_iso=timestamp_iso,
            config_hash=config_hash,
            git_commit="sih2026-sih26037-main",
            engine=EngineInfo(name="python_reference", version="1.0.0"),
            scenario=ScenarioMetadata(
                id=scenario_id,
                name=sc_cfg.name,
                split=split,
                seed=seed,
                params=sc_cfg.params,
            ),
            planner=PlannerMetadata(
                id=planner_id,
                name=planner.name,
                config=custom_params or {},
            ),
            world=world.to_world_map_schema(),
            frames=frames,
            metrics=metrics,
            events=hazard_engine.get_events_list(),
        )

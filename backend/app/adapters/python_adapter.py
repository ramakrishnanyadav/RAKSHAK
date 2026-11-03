"""
Python Reference Engine Adapter.
Executes the closed-loop simulation loop with fine-grained cancellation checking,
step-by-step progress callbacks, and real-time metric emissions for SSE streaming.
Implements the full lifecycle contract: prepare, start, stream_progress, cancel,
collect_logs, and version_info.
"""

import time
import hashlib
import json
import platform
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Callable, List, Generator

from engine.apath_log.schema import (
    RunLog,
    Frame,
    EgoState,
    AgentTrack,
    PlannerOutput,
    RunMetrics,
    ScenarioMetadata,
    PlannerMetadata,
    EngineInfo,
)
from engine.scenarios.registry import build_scenario
from engine.planners import create_planner
from engine.prediction.predictor import NonLaneMultiHypothesisPredictor
from engine.risk.field import CalibratedRiskField
from engine.simulation.vehicle import KinematicBicycleModel
from engine.metrics import compute_frame_metrics

from backend.app.adapters.base import (
    BaseEngineAdapter,
    RunContext,
    ExecutionHandle,
    ProgressEvent,
    EngineVersionInfo,
)
from backend.app.adapters.errors import SimulationCancelledException
from backend.app.adapters.pipeline.converter import EngineLogConverter
from backend.app.adapters.pipeline.validator import LogValidator


class PythonEngineAdapter(BaseEngineAdapter):
    """
    Python Reference Engine Adapter.
    Zero-licence, pure Python simulation stack with full sensor, tracker,
    world model, risk field, and controller integration.
    """

    def __init__(self, dt: float = 0.1):
        self.dt = dt
        self.predictor = NonLaneMultiHypothesisPredictor(horizon_s=2.8, dt=0.2)
        self.risk_field_evaluator = CalibratedRiskField()
        self.vehicle_model = KinematicBicycleModel()
        self.converter = EngineLogConverter()
        self.validator = LogValidator()

    @property
    def adapter_name(self) -> str:
        return "python_reference"

    def version_info(self) -> EngineVersionInfo:
        return EngineVersionInfo(
            name=self.adapter_name,
            version="1.0.0",
            status="READY",
            licence_status="NOT_REQUIRED",
            capabilities={
                "closed_loop": True,
                "conformal_risk": True,
                "offline_demo": True,
                "multi_agent_count": 60,
                "supported_scenarios": [
                    "SCENARIO_1_VILLAGE_ROAD",
                    "SCENARIO_2_URBAN_INTERSECTION",
                    "SCENARIO_3_HIGHWAY_MERGE",
                    "SCENARIO_4_DENSE_MARKET",
                    "SCENARIO_5_CATTLE_CROSSING",
                ],
            },
            binary_path=platform.python_implementation(),
        )

    def prepare(
        self,
        scenario_id: str,
        planner_id: str,
        seed: int,
        split: str = "tune",
        custom_params: Optional[Dict[str, Any]] = None,
    ) -> RunContext:
        run_id = f"run_{scenario_id.lower()}_{planner_id.lower()}_{split}_s{seed}"
        return RunContext(
            run_id=run_id,
            scenario_id=scenario_id,
            planner_id=planner_id,
            seed=seed,
            split=split,
            custom_params=custom_params or {},
        )

    def start(self, run_context: RunContext) -> ExecutionHandle:
        handle = ExecutionHandle(
            run_id=run_context.run_id,
            adapter_name=self.adapter_name,
            context=run_context,
            status="RUNNING",
            start_time=time.time(),
        )
        return handle

    def cancel(self, execution_handle: ExecutionHandle) -> bool:
        execution_handle.is_cancelled = True
        execution_handle.status = "CANCELLED"
        return True

    def stream_progress(
        self,
        execution_handle: ExecutionHandle,
    ) -> Generator[ProgressEvent, None, None]:
        ctx = execution_handle.context
        world, ego, sc_cfg = build_scenario(ctx.scenario_id, ctx.seed, ctx.split)
        planner = create_planner(ctx.planner_id, ctx.custom_params)
        planner.reset()

        duration_limit = sc_cfg.timeout_s
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
            if execution_handle.is_cancelled:
                execution_handle.metadata["partial_frames"] = frames
                raise SimulationCancelledException(
                    f"Run {ctx.run_id} cancelled at step {step}/{total_steps}",
                    step=step,
                )

            current_time = round(step * self.dt, 2)

            # 1. World step
            world.step(self.dt)

            # 2. Perception
            perceived_data = world.perceive(curr_x, curr_y, curr_yaw)

            # 3. Prediction
            agent_tracks: List[AgentTrack] = []
            for item in perceived_data:
                agent = item["agent"]
                hypotheses, conformal_envelope = self.predictor.predict(
                    class_name=agent.class_name,
                    x=item["measured_x"],
                    y=item["measured_y"],
                    yaw=item["measured_yaw"],
                    vx=item["measured_vx"],
                    vy=item["measured_vy"],
                    observed_intent=agent.intent,
                )
                agent_tracks.append(
                    AgentTrack(
                        id=agent.id,
                        class_name=agent.class_name,
                        x=round(item["measured_x"], 3),
                        y=round(item["measured_y"], 3),
                        yaw=round(item["measured_yaw"], 3),
                        v_x=round(item["measured_vx"], 3),
                        v_y=round(item["measured_vy"], 3),
                        length=agent.profile.length,
                        width=agent.profile.width,
                        is_occluded=agent.is_occluded,
                        prediction_hypotheses=hypotheses,
                        conformal_envelope=conformal_envelope,
                    )
                )

            # 4. Risk Field
            risk_summary = self.risk_field_evaluator.evaluate_ego_field(
                curr_x, curr_y, curr_v, agent_tracks, static_circles
            )

            ego_current = EgoState(
                x=round(curr_x, 3),
                y=round(curr_y, 3),
                yaw=round(curr_yaw, 3),
                v=round(curr_v, 3),
                steering=round(curr_steer, 3),
                acceleration=round(curr_accel, 3),
                jerk=round((curr_accel - prev_accel) / self.dt, 3),
                length=getattr(ego, "length", 4.2),
                width=getattr(ego, "width", 1.8),
                active_state=getattr(planner, "active_state", "FOLLOW"),
            )
            prev_accel = curr_accel

            # 5. Planning
            t_plan_start = time.perf_counter()
            plan_res = planner.step(
                ego=ego_current,
                world=world,
                visible_agents=agent_tracks,
                dt=self.dt,
                current_time=current_time,
            )
            t_plan_ms = (time.perf_counter() - t_plan_start) * 1000.0

            # 6. Control actuation
            curr_x, curr_y, curr_yaw, curr_v, curr_accel = self.vehicle_model.step(
                curr_x, curr_y, curr_yaw, curr_v,
                plan_res.steer, plan_res.accel, self.dt
            )
            curr_steer = plan_res.steer

            # Safety clearance audit
            for item in perceived_data:
                dx = curr_x - item["measured_x"]
                dy = curr_y - item["measured_y"]
                dist = (dx * dx + dy * dy) ** 0.5
                if dist < min_clearance_run:
                    min_clearance_run = dist
                if dist < 1.1:
                    collision_detected = True

            planned_poses = [
                {"x": p[0], "y": p[1], "v": p[2]} for p in plan_res.planned_trajectory
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
                decision_trace=plan_res.decision_trace,
            )
            frames.append(frame)

            # Yield progress event
            if step % 5 == 0 or step == total_steps - 1 or collision_detected or curr_x >= sc_cfg.target_distance_m:
                progress_fraction = min(1.0, round((step + 1) / total_steps, 2))
                yield ProgressEvent(
                    run_id=ctx.run_id,
                    fraction=progress_fraction,
                    message=f"Simulating t={current_time}s ({int(progress_fraction * 100)}%)",
                    step=step,
                    total_steps=total_steps,
                    telemetry={
                        "step": step,
                        "time_s": current_time,
                        "ego_x": curr_x,
                        "ego_y": curr_y,
                        "ego_v": curr_v,
                        "min_clearance_m": round(min_clearance_run, 2),
                        "replan_count": sum(1 for f in frames if f.planner_output.replan_triggered),
                    },
                )

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

        config_dict = {
            "scenario_id": ctx.scenario_id,
            "seed": ctx.seed,
            "split": ctx.split,
            "planner_id": ctx.planner_id,
            "params": ctx.custom_params,
        }
        config_hash = hashlib.sha256(
            json.dumps(config_dict, sort_keys=True).encode("utf-8")
        ).hexdigest()

        run_log = RunLog(
            schema_version="apath-log/v1",
            run_id=ctx.run_id,
            timestamp_iso=datetime.now(timezone.utc).isoformat(),
            config_hash=config_hash,
            git_commit="sih2026-sih26037-main",
            engine=EngineInfo(name=self.adapter_name, version="1.0.0"),
            scenario=ScenarioMetadata(
                id=ctx.scenario_id,
                name=sc_cfg.name,
                split=ctx.split,
                seed=ctx.seed,
                params=sc_cfg.params,
            ),
            planner=PlannerMetadata(
                id=ctx.planner_id,
                name=planner.name,
                config=ctx.custom_params,
            ),
            world=world.to_world_map_schema(),
            frames=frames,
            metrics=metrics,
        )

        execution_handle._log_cache = run_log
        execution_handle.status = "COMPLETED"

    def collect_logs(self, execution_handle: ExecutionHandle) -> RunLog:
        if execution_handle._log_cache is not None:
            log = execution_handle._log_cache
            # Validate through pipeline
            self.validator.validate(log, strict=True)
            return log
        raise RuntimeError(f"No log cache available for handle {execution_handle.run_id}")


# Alias for backward compatibility
PythonAdapter = PythonEngineAdapter

"""
Test Data Factories for Engine & Simulation Tests.
Enforces deterministic, parameterized test object generation without hand-copied fixtures.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
import numpy as np

from engine.simulation.vehicle import Vehicle, VehicleState
from engine.tracker.track import Track
from engine.tracker.world_model import WorldModel
from engine.apath_log.schema import (
    FrameRecord,
    EgoStateRecord,
    TrackedAgentRecord,
    PredictedFutureRecord,
    PlannerOutputRecord,
    RunMetrics,
    RunLog,
)


class VehicleFactory:
    """Creates deterministic Vehicle simulation models."""
    @staticmethod
    def create(
        x: float = 0.0,
        y: float = 0.0,
        yaw: float = 0.0,
        v: float = 5.0,
        length: float = 4.5,
        width: float = 2.0,
        dt: float = 0.1,
    ) -> Vehicle:
        return Vehicle(
            initial_state=VehicleState(x=x, y=y, yaw=yaw, v=v),
            length=length,
            width=width,
            dt=dt,
        )


class TrackedAgentFactory:
    """Generates Track instances with deterministic kinematics."""
    @staticmethod
    def create(
        track_id: int = 1,
        agent_type: str = "cattle",
        x: float = 20.0,
        y: float = 0.5,
        vx: float = 0.0,
        vy: float = 1.0,
        heading: float = 1.57,
        confidence: float = 0.95,
        is_occluded: bool = False,
    ) -> Track:
        return Track(
            track_id=track_id,
            agent_type=agent_type,
            x=x,
            y=y,
            vx=vx,
            vy=vy,
            heading=heading,
            confidence=confidence,
            is_occluded=is_occluded,
        )


class FrameRecordFactory:
    """Generates schema-compliant apath-log/v1 FrameRecord instances."""
    @staticmethod
    def create(
        step: int = 0,
        t: float = 0.0,
        ego_x: float = 0.0,
        ego_y: float = 0.0,
        ego_v: float = 6.0,
        ego_yaw: float = 0.0,
        agent_count: int = 1,
        replan_triggered: bool = False,
        trigger_reason: Optional[str] = None,
        latency_ms: float = 12.5,
    ) -> FrameRecord:
        ego = EgoStateRecord(
            x=ego_x,
            y=ego_y,
            v=ego_v,
            yaw=ego_yaw,
            steering=0.0,
            accel=0.0,
        )

        agents = []
        for i in range(agent_count):
            futures = [
                PredictedFutureRecord(
                    probability=0.8,
                    points=[[ego_x + 15.0 + step * 0.1, ego_y + 1.0 + k * 0.1] for k in range(5)],
                    uncertainty_radii=[0.3 + k * 0.05 for k in range(5)],
                )
            ]
            agents.append(
                TrackedAgentRecord(
                    id=f"agent_{i+1}",
                    agent_class="cattle",
                    x=ego_x + 20.0,
                    y=ego_y + 1.0,
                    vx=0.2,
                    vy=0.8,
                    heading=1.57,
                    length=2.2,
                    width=1.0,
                    confidence=0.92,
                    is_occluded=False,
                    predicted_futures=futures,
                )
            )

        planner_output = PlannerOutputRecord(
            chosen_behaviour="slow",
            planned_path=[[ego_x + k * 1.0, ego_y] for k in range(10)],
            cost_breakdown={"distance": 1.2, "collision_risk": 0.3, "curvature": 0.05, "energy": 0.2, "replan": 0.0},
            replan_triggered=replan_triggered,
            trigger_reason=trigger_reason,
            latency_ms=latency_ms,
        )

        return FrameRecord(
            step=step,
            t=t,
            ego=ego,
            agents=agents,
            planner_output=planner_output,
        )


class RunLogFactory:
    """Generates complete, deterministic RunLog documents."""
    @staticmethod
    def create(
        run_id: str = "run_factory_sample",
        scenario_id: str = "SCENARIO_5_CATTLE_CROSSING",
        planner_id: str = "P3",
        seed: int = 1000,
        num_frames: int = 20,
        collision_occurred: bool = False,
        min_clearance_m: float = 1.45,
    ) -> RunLog:
        frames = [
            FrameRecordFactory.create(
                step=i,
                t=round(i * 0.1, 2),
                ego_x=round(i * 0.6, 2),
                replan_triggered=(i == 5),
                trigger_reason="CONFORMAL_VIOLATION" if i == 5 else None,
            )
            for i in range(num_frames)
        ]

        metrics = RunMetrics(
            duration_s=round(num_frames * 0.1, 2),
            completed_goal=True,
            collision_occurred=collision_occurred,
            min_clearance_m=min_clearance_m,
            mean_speed_m_s=6.0,
            max_jerk_m_s3=1.2,
            replan_count=1,
            p95_latency_ms=14.0,
        )

        return RunLog(
            schema_version="apath-log/v1",
            run_id=run_id,
            engine="PythonReferenceEngine",
            engine_version="1.0.0",
            git_hash="0000000000000000000000000000000000000000",
            seed=seed,
            config_hash="a" * 64,
            scenario_id=scenario_id,
            planner_id=planner_id,
            split="tune",
            frames=frames,
            metrics=metrics,
        )

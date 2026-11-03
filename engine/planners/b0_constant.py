"""
Planner B0: Shortest Path / Constant Speed Baseline.
Follows the road centerline at target velocity without reactive avoidance.
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from .base import BasePlanner, PlannerStepResult
from engine.simulation.world import SimulationWorld
from engine.apath_log.schema import EgoState, AgentTrack, CostBreakdown
from engine.config.cost_evaluator import compute_trajectory_cost


class B0ConstantPlanner(BasePlanner):
    """
    Non-reactive minimum-intelligence baseline.
    Maintains constant target speed and tracks center line y = 0.
    """

    def __init__(self, params: Optional[Dict[str, Any]] = None):
        super().__init__("B0", "Baseline 0: Shortest Path / Constant Speed", params)

    def reset(self):
        super().reset()

    def step(
        self,
        ego: EgoState,
        world: SimulationWorld,
        visible_agents: List[AgentTrack],
        dt: float,
        current_time: float,
    ) -> PlannerStepResult:
        self.time_since_replan += dt

        # Simple Stanley / pure pursuit toward centerline y = 0
        target_y = 0.0
        ey = ego.y - target_y
        k_p = 0.4
        k_yaw = 0.8

        target_steer = -k_p * ey - k_yaw * ego.yaw
        # Acceleration to reach target speed
        speed_error = self.target_speed - ego.v
        target_accel = min(1.5, max(-2.0, 1.0 * speed_error))

        # Nominal future trajectory straight ahead
        traj = []
        curr_x, curr_y = ego.x, ego.y
        for i in range(1, 21):
            t_rel = i * 0.1
            traj.append((curr_x + ego.v * t_rel, 0.0, self.target_speed))

        self.last_planned_trajectory = traj

        cost = compute_trajectory_cost(
            trajectory=traj,
            target_x=ego.x + 30.0,
            collision_risk=0.1,
            accel=target_accel,
            steer=target_steer,
            replan_triggered=False,
            split="tune",
        )

        return PlannerStepResult(
            steer=target_steer,
            accel=target_accel,
            active_state="FOLLOW",
            planned_trajectory=traj,
            replan_triggered=False,
            trigger_reason=None,
            cost_breakdown=cost,
            decision_trace="B0 following nominal centerline at target speed; zero obstacle avoidance.",
        )

"""
Planner P1: Predictive Path Planning (Nominal Prediction + Fixed Replan Clock).
Ablation step 1: Uses dynamic agent trajectory predictions over a fixed horizon,
recalculating on a fixed periodic clock (e.g. 1.0s).
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from .base import BasePlanner, PlannerStepResult
from engine.simulation.world import SimulationWorld
from engine.simulation.vehicle import KinematicBicycleModel
from engine.apath_log.schema import EgoState, AgentTrack, CostBreakdown
from engine.config.cost_evaluator import compute_trajectory_cost


class P1PredictivePlanner(BasePlanner):
    """
    Predictive planning over nominal agent CTRV forecasts.
    Runs on a rigid fixed timer (e.g., replans every 1.0s regardless of risk changes).
    """

    def __init__(self, params: Optional[Dict[str, Any]] = None):
        super().__init__("P1", "Planner 1: Predictive (Fixed Replan Clock)", params)
        self.replan_interval_s = self.params.get("replan_interval_s", 1.0)
        self.horizon_s = 2.5
        self.num_rollouts = 9
        self.candidate_lat_offsets = [-2.2, -1.5, -0.8, 0.0, 0.8, 1.5, 2.2]
        self.speed_ratios = [1.0, 0.7, 0.4, 0.0]

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

        should_replan = self.time_since_replan >= self.replan_interval_s or not self.last_planned_trajectory

        if not should_replan and self.last_planned_trajectory:
            # Pure pursuit tracking along current plan
            target_pt = self.last_planned_trajectory[min(3, len(self.last_planned_trajectory) - 1)]
            dx = target_pt[0] - ego.x
            dy = target_pt[1] - ego.y
            target_yaw = math.atan2(dy, dx)
            steer = 0.75 * ((target_yaw - ego.yaw + math.pi) % (2 * math.pi) - math.pi)
            accel = min(1.5, max(-3.5, (target_pt[2] - ego.v) * 0.9))
            cost = compute_trajectory_cost(
                trajectory=self.last_planned_trajectory,
                target_x=ego.x + 30.0,
                collision_risk=0.08,
                accel=accel,
                steer=steer,
                replan_triggered=False,
                split="tune",
            )
            return PlannerStepResult(
                steer=steer,
                accel=accel,
                active_state="FOLLOW",
                planned_trajectory=self.last_planned_trajectory,
                replan_triggered=False,
                trigger_reason=None,
                cost_breakdown=cost,
                decision_trace=f"P1 tracking fixed plan (replan in {max(0.0, self.replan_interval_s - self.time_since_replan):.2f}s).",
            )

        # Periodic Replan Cycle
        self.time_since_replan = 0.0
        best_cost = float("inf")
        best_traj: List[Tuple[float, float, float]] = []
        best_state = "FOLLOW"
        best_steer = 0.0
        best_accel = 0.0
        best_breakdown = CostBreakdown()

        # Generate candidate trajectory tentacles in Frenet-like lateral space
        sim_dt = 0.2
        num_steps = int(self.horizon_s / sim_dt)

        for lat_offset in self.candidate_lat_offsets:
            for s_ratio in self.speed_ratios:
                cand_v = self.target_speed * s_ratio
                curr_x, curr_y, curr_yaw = ego.x, ego.y, ego.yaw
                traj = []
                collision = False
                min_clearance = float("inf")

                # Aim toward target lane offset
                target_y = lat_offset

                for step_idx in range(1, num_steps + 1):
                    t_future = step_idx * sim_dt
                    # Steering command toward target_y
                    ey = curr_y - target_y
                    steer_cmd = -0.35 * ey - 0.7 * curr_yaw
                    curr_x, curr_y, curr_yaw, _, _ = self.vehicle_model.step(
                        curr_x, curr_y, curr_yaw, cand_v, steer_cmd, 0.0, sim_dt
                    )
                    traj.append((curr_x, curr_y, cand_v))

                    ego_box = KinematicBicycleModel.get_bounding_box(
                        curr_x, curr_y, curr_yaw, ego.length, ego.width
                    )

                    # Road boundary
                    if curr_y > 4.5 or curr_y < -4.5:
                        collision = True
                        break

                    # Check against nominal predicted paths of dynamic agents
                    for ag in visible_agents:
                        # Nominal prediction (hypothesis 0 or linear extrapolation)
                        ag_fx = ag.x + ag.v_x * t_future
                        ag_fy = ag.y + ag.v_y * t_future
                        ag_box = KinematicBicycleModel.get_bounding_box(
                            ag_fx, ag_fy, ag.yaw, ag.length, ag.width
                        )
                        dist = KinematicBicycleModel.min_distance_polygons(ego_box, ag_box)
                        if dist == 0.0:
                            collision = True
                            break
                        min_clearance = min(min_clearance, dist)
                    if collision:
                        break

                if collision:
                    continue

                # Cost evaluation: collision penalty + progress loss + smoothness + lateral deviation
                progress_cost = 2.0 * (1.0 - s_ratio)
                smooth_cost = 1.0 * abs(lat_offset)
                clearance_cost = 4.0 / max(0.5, min_clearance)
                total_cost = progress_cost + smooth_cost + clearance_cost

                if total_cost < best_cost:
                    best_cost = total_cost
                    best_traj = traj
                    if cand_v == 0.0:
                        best_state = "STOP"
                    elif abs(lat_offset) > 0.8:
                        best_state = "BYPASS"
                    elif s_ratio < 0.8:
                        best_state = "SLOW"
                    else:
                        best_state = "FOLLOW"
        if not best_traj:
            # Fallback stop
            best_steer = 0.0
            best_accel = -4.5
            best_state = "STOP"
            best_traj = [(ego.x + ego.v * 0.1 * i, ego.y, 0.0) for i in range(1, 10)]
            trace = "P1: All nominal predictive tentacles collide; forced emergency stop."
            best_breakdown = compute_trajectory_cost(
                trajectory=best_traj,
                target_x=ego.x + 30.0,
                collision_risk=0.85,
                accel=best_accel,
                steer=best_steer,
                replan_triggered=True,
                split="tune",
            )
        else:
            first_pt = best_traj[min(2, len(best_traj) - 1)]
            dx = first_pt[0] - ego.x
            dy = first_pt[1] - ego.y
            target_yaw = math.atan2(dy, dx)
            best_steer = 0.7 * ((target_yaw - ego.yaw + math.pi) % (2 * math.pi) - math.pi)
            best_accel = min(1.5, max(-4.0, (first_pt[2] - ego.v) * 0.8))
            best_breakdown = compute_trajectory_cost(
                trajectory=best_traj,
                target_x=ego.x + 30.0,
                collision_risk=0.10,
                accel=best_accel,
                steer=best_steer,
                replan_triggered=True,
                split="tune",
            )
            trace = f"P1 Periodic replan fired: target offset {best_state} (cost={best_breakdown.total_cost:.2f})."

        self.last_planned_trajectory = best_traj

        return PlannerStepResult(
            steer=best_steer,
            accel=best_accel,
            active_state=best_state,
            planned_trajectory=best_traj,
            replan_triggered=True,
            trigger_reason="PERIODIC",
            cost_breakdown=best_breakdown,
            decision_trace=trace,
        )

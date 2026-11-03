"""
Planner P2: Risk-Aware Path Planning (Conformal Uncertainty + Risk Field Cost).
Ablation step 2: Incorporates multi-hypothesis prediction cones and penalizes continuous
risk field integration along candidate paths, while still running on a fixed periodic clock.
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from .base import BasePlanner, PlannerStepResult
from engine.simulation.world import SimulationWorld
from engine.simulation.vehicle import KinematicBicycleModel
from engine.risk.field import CalibratedRiskField
from engine.apath_log.schema import EgoState, AgentTrack, CostBreakdown
from engine.config.cost_evaluator import compute_trajectory_cost


class P2RiskAwarePlanner(BasePlanner):
    """
    Risk-Aware Path Planner.
    Incorporates calibrated conformal prediction cones and optimizes trajectories
    against a continuous spatial risk field R(x, y), operating on a fixed periodic clock.
    """

    def __init__(self, params: Optional[Dict[str, Any]] = None):
        super().__init__("P2", "Planner 2: Risk-Aware (Fixed Clock)", params)
        self.replan_interval_s = self.params.get("replan_interval_s", 0.6)
        self.risk_field_evaluator = CalibratedRiskField()
        self.candidate_lat_offsets = [-2.5, -1.8, -1.0, 0.0, 1.0, 1.8, 2.5]
        self.speed_ratios = [1.0, 0.75, 0.5, 0.25, 0.0]

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
            target_pt = self.last_planned_trajectory[min(3, len(self.last_planned_trajectory) - 1)]
            dx = target_pt[0] - ego.x
            dy = target_pt[1] - ego.y
            target_yaw = math.atan2(dy, dx)
            steer = 0.8 * ((target_yaw - ego.yaw + math.pi) % (2 * math.pi) - math.pi)
            accel = min(1.5, max(-3.5, (target_pt[2] - ego.v) * 0.9))
            cost = compute_trajectory_cost(
                trajectory=self.last_planned_trajectory,
                target_x=ego.x + 30.0,
                collision_risk=0.1,
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
                decision_trace=f"P2 tracking risk-aware trajectory (periodic clock {self.time_since_replan:.2f}s).",
            )

        # Periodic Replan Execution
        self.time_since_replan = 0.0
        best_cost = float("inf")
        best_traj: List[Tuple[float, float, float]] = []
        best_state = "FOLLOW"
        best_breakdown = CostBreakdown()

        static_circles = [(obj.x, obj.y, max(obj.length, obj.width) / 2.0) for obj in world.static_obstacles]

        sim_dt = 0.2
        num_steps = 14  # 2.8s horizon

        for lat_offset in self.candidate_lat_offsets:
            for s_ratio in self.speed_ratios:
                cand_v = self.target_speed * s_ratio
                curr_x, curr_y, curr_yaw = ego.x, ego.y, ego.yaw
                traj = []
                collision = False
                cum_risk = 0.0

                for step_idx in range(1, num_steps + 1):
                    t_future = step_idx * sim_dt
                    ey = curr_y - lat_offset
                    steer_cmd = -0.35 * ey - 0.7 * curr_yaw
                    curr_x, curr_y, curr_yaw, _, _ = self.vehicle_model.step(
                        curr_x, curr_y, curr_yaw, cand_v, steer_cmd, 0.0, sim_dt
                    )
                    traj.append((curr_x, curr_y, cand_v))

                    # Road boundary limit
                    if curr_y > 4.6 or curr_y < -4.6:
                        collision = True
                        break

                    # Evaluate risk field at trajectory pose
                    pt_risk = self.risk_field_evaluator.evaluate_point_risk(
                        curr_x, curr_y, cand_v, visible_agents, static_circles
                    )
                    cum_risk += pt_risk

                    # Conformal cone penetration penalty: severe penalty if penetrating 95% cone
                    for ag in visible_agents:
                        cone_r = 1.0
                        if ag.conformal_envelope:
                            for cp in ag.conformal_envelope:
                                if cp.t_rel >= t_future:
                                    cone_r = cp.radius_m
                                    break
                        ag_x_fut = ag.x + ag.v_x * t_future
                        ag_y_fut = ag.y + ag.v_y * t_future
                        dist_to_ag = math.hypot(curr_x - ag_x_fut, curr_y - ag_y_fut)
                        if dist_to_ag < (0.9 + cone_r):
                            # In conformal conflict zone
                            cum_risk += 3.5

                if collision:
                    continue

                progress_loss = 2.5 * (1.0 - s_ratio)
                smoothness_loss = 0.8 * abs(lat_offset)
                risk_loss = 4.0 * cum_risk
                total = progress_loss + smoothness_loss + risk_loss

                if total < best_cost:
                    best_cost = total
                    best_traj = traj
                    if cand_v == 0.0:
                        best_state = "STOP"
                    elif abs(lat_offset) > 0.8:
                        best_state = "BYPASS"
                    elif s_ratio < 0.75:
                        best_state = "SLOW"
                    else:
                        best_state = "FOLLOW"
        if not best_traj:
            best_steer = 0.0
            best_accel = -5.0
            best_state = "STOP"
            best_traj = [(ego.x + ego.v * 0.1 * i, ego.y, 0.0) for i in range(1, 10)]
            trace = "P2: All candidate trajectories penetrate critical risk zones. Braking."
            best_breakdown = compute_trajectory_cost(
                trajectory=best_traj,
                target_x=ego.x + 30.0,
                collision_risk=0.9,
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
            best_steer = 0.75 * ((target_yaw - ego.yaw + math.pi) % (2 * math.pi) - math.pi)
            best_accel = min(1.5, max(-4.0, (first_pt[2] - ego.v) * 0.8))
            best_breakdown = compute_trajectory_cost(
                trajectory=best_traj,
                target_x=ego.x + 30.0,
                collision_risk=0.15,
                accel=best_accel,
                steer=best_steer,
                replan_triggered=True,
                split="tune",
            )
            trace = f"P2 Risk-field optimization selected {best_state} (cost={best_breakdown.total_cost:.2f})."

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

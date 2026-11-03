"""
Planner B1: Dynamic Window Approach (DWA) + Velocity Obstacles (VO).
Classical reactive navigation baseline combining local dynamic window sampling
with velocity obstacle pruning.
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from .base import BasePlanner, PlannerStepResult
from engine.simulation.world import SimulationWorld
from engine.simulation.vehicle import KinematicBicycleModel
from engine.apath_log.schema import EgoState, AgentTrack, CostBreakdown
from engine.config.cost_evaluator import compute_trajectory_cost


class B1DWAVOPlanner(BasePlanner):
    """
    Classical reactive crowd & traffic navigation baseline.
    Computes reachable velocity window [v - a*dt, v + a*dt] x [w - a_w*dt, w + a_w*dt],
    filters velocities lying in Velocity Obstacle cones, and optimizes local clearance + progress.
    """

    def __init__(self, params: Optional[Dict[str, Any]] = None):
        super().__init__("B1", "Baseline 1: DWA + Velocity Obstacles", params)
        self.predict_horizon_s = 1.5  # Short reactive horizon
        self.sim_dt = 0.25
        self.v_samples = 5
        self.steer_samples = 7

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

        # Dynamic window for speed and steering
        max_accel = 2.0
        max_decel = -5.0
        max_steer_rate = 0.6

        v_min = max(0.0, ego.v + max_decel * dt)
        v_max = min(self.target_speed, ego.v + max_accel * dt)
        steer_min = max(-0.55, ego.steering - max_steer_rate * dt)
        steer_max = min(0.55, ego.steering + max_steer_rate * dt)

        best_score = -float("inf")
        best_v = 0.0
        best_steer = 0.0
        best_traj: List[Tuple[float, float, float]] = []
        best_cost = CostBreakdown()

        v_steps = [v_min + i * (v_max - v_min) / max(1, self.v_samples - 1) for i in range(self.v_samples)]
        steer_steps = [steer_min + j * (steer_max - steer_min) / max(1, self.steer_samples - 1) for j in range(self.steer_samples)]

        # Collect static obstacle boxes within 18m
        static_boxes = []
        for obj in world.static_obstacles:
            if math.hypot(obj.x - ego.x, obj.y - ego.y) < 18.0:
                static_boxes.append(KinematicBicycleModel.get_bounding_box(obj.x, obj.y, obj.yaw, obj.length, obj.width))

        nearby_agents = [ag for ag in visible_agents if math.hypot(ag.x - ego.x, ag.y - ego.y) < 18.0]

        for v_cand in v_steps:
            for steer_cand in steer_steps:
                # Rollout kinematic bicycle model for predict_horizon_s
                sim_x, sim_y, sim_yaw = ego.x, ego.y, ego.yaw
                traj_cand = []
                collision = False
                min_clearance = float("inf")

                num_steps = int(self.predict_horizon_s / self.sim_dt)
                for step_idx in range(1, num_steps + 1):
                    t_cand = step_idx * self.sim_dt
                    sim_x, sim_y, sim_yaw, _, _ = self.vehicle_model.step(
                        sim_x, sim_y, sim_yaw, v_cand, steer_cand, 0.0, self.sim_dt
                    )
                    traj_cand.append((sim_x, sim_y, v_cand))

                    ego_box = KinematicBicycleModel.get_bounding_box(
                        sim_x, sim_y, sim_yaw, ego.length, ego.width
                    )

                    # 1. Road Boundary check
                    if sim_y > 4.5 or sim_y < -4.5:
                        collision = True
                        break

                    # 2. Static Obstacles check
                    for s_box in static_boxes:
                        dist = KinematicBicycleModel.min_distance_polygons(ego_box, s_box)
                        if dist == 0.0:
                            collision = True
                            break
                        min_clearance = min(min_clearance, dist)
                    if collision:
                        break

                    # 3. Velocity Obstacle check: dynamic agents projected with constant current velocity
                    for ag in nearby_agents:
                        # Agent position at t_cand
                        ag_x_cand = ag.x + ag.v_x * t_cand
                        ag_y_cand = ag.y + ag.v_y * t_cand
                        ag_box = KinematicBicycleModel.get_bounding_box(
                            ag_x_cand, ag_y_cand, ag.yaw, ag.length, ag.width
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

                # Objective: maximize clearance and speed, minimize deviation from centerline
                clearance_weight = 3.5
                speed_weight = 1.8
                centerline_penalty = 1.2 * abs(sim_y)
                steer_penalty = 0.5 * abs(steer_cand)

                score = (
                    clearance_weight * min(5.0, min_clearance)
                    + speed_weight * (v_cand / max(0.1, self.target_speed))
                    - centerline_penalty
                    - steer_penalty
                )

                if score > best_score:
                    best_score = score
                    best_v = v_cand
                    best_steer = steer_cand
                    best_traj = traj_cand
                    best_cost = compute_trajectory_cost(
                        trajectory=traj_cand,
                        target_x=ego.x + 30.0,
                        collision_risk=0.05,
                        accel=(v_cand - ego.v) / dt,
                        steer=steer_cand,
                        replan_triggered=True,
                        split="tune",
                    )

        # Reactive fallback if all forward trajectories collide: hard brake
        if best_score == -float("inf") or not best_traj:
            accel = max_decel
            steer = 0.0
            active_state = "STOP"
            trace = "B1: All dynamic window rollouts violate VO / road boundaries. Reactive emergency braking applied."
            best_traj = [(ego.x + ego.v * 0.1 * i, ego.y, 0.0) for i in range(1, 10)]
            best_cost = compute_trajectory_cost(
                trajectory=best_traj,
                target_x=ego.x + 30.0,
                collision_risk=0.9,
                accel=accel,
                steer=steer,
                replan_triggered=True,
                split="tune",
            )
        else:
            accel = (best_v - ego.v) / dt
            accel = max(max_decel, min(max_accel, accel))
            steer = best_steer
            if abs(best_steer) > 0.15 and ego.v > 2.0:
                active_state = "BYPASS"
            elif best_v < 0.6 * self.target_speed:
                active_state = "SLOW"
            else:
                active_state = "FOLLOW"
            trace = f"B1 VO evaluation chosen (v={best_v:.1f} m/s, steer={best_steer:.2f} rad, state={active_state})."

        self.last_planned_trajectory = best_traj

        return PlannerStepResult(
            steer=steer,
            accel=accel,
            active_state=active_state,
            planned_trajectory=best_traj,
            replan_triggered=True,
            trigger_reason="PERIODIC",
            cost_breakdown=best_cost,
            decision_trace=trace,
        )

"""
Planner P3: Adaptive Replanning on Risk Trigger + Minimal-Risk Manoeuvre (MRM).
Full research proposal:
1. Calibrated non-lane multi-hypothesis prediction with conformal uncertainty envelopes
2. Continuous risk field integration
3. Dynamic event-triggered replanning (fires instantaneously when risk jumps or conformal bounds are violated)
4. Minimal-Risk Manoeuvre (MRM) fallback under high uncertainty or corridor blockade.
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from .base import BasePlanner, PlannerStepResult
from engine.simulation.world import SimulationWorld
from engine.simulation.vehicle import KinematicBicycleModel
from engine.risk.field import CalibratedRiskField, RiskThresholds
from engine.apath_log.schema import EgoState, AgentTrack, CostBreakdown
from engine.config.cost_evaluator import compute_trajectory_cost


class P3AdaptivePlanner(BasePlanner):
    """
    Adaptive Risk-Triggered Planner.
    Solves G3 (predict and log risk), G4 (adaptive replan latency), and G5 (ablation superiority).
    """

    def __init__(self, params: Optional[Dict[str, Any]] = None):
        super().__init__("P3", "Planner 3: Risk-Adaptive (Dynamic Trigger + MRM)", params)
        self.risk_thresholds = RiskThresholds(
            critical_trigger=self.params.get("critical_trigger", 0.62),
            delta_risk_trigger=self.params.get("delta_risk_trigger", 0.20),
            uncertainty_mrm_limit=self.params.get("uncertainty_mrm_limit", 2.6),
        )
        self.risk_field_evaluator = CalibratedRiskField(self.risk_thresholds)
        self.last_ego_risk: float = 0.0
        self.candidate_lat_offsets = [-2.8, -2.2, -1.6, -1.0, -0.5, 0.0, 0.5, 1.0, 1.6, 2.2, 2.8]
        self.speed_ratios = [1.0, 0.8, 0.5, 0.25, 0.10, 0.05, 0.0]
        self.replan_count: int = 0

        # Workstream 1: Stationary persistence penalty parameters
        self.w_prog: float = float(self.params.get("w_prog", 2.20))
        self.w_stall: float = float(self.params.get("w_stall", 4.00))
        self.t_grace: float = float(self.params.get("t_grace", 1.00))
        self.gamma: float = float(self.params.get("gamma", 1.50))
        self.J_stall_max: float = float(self.params.get("J_stall_max", 5.00))
        self.t_stopped: float = 0.0
        self.rejection_counts: Dict[str, int] = {
            "physical_collision": 0,
            "predicted_occupancy": 0,
            "road_boundary": 0,
            "dynamic_kinematic": 0,
        }

    def reset(self):
        super().reset()
        self.last_ego_risk = 0.0
        self.replan_count = 0
        self.t_stopped = 0.0
        self.rejection_counts = {
            "physical_collision": 0,
            "predicted_occupancy": 0,
            "road_boundary": 0,
            "dynamic_kinematic": 0,
        }

    def compute_stationary_penalty(self) -> float:
        """
        Computes the stationary persistence penalty:
        J_persist = w_stall * min(J_stall_max, max(0.0, (t_stopped - t_grace) / 1.0) ** gamma)
        """
        if self.t_stopped <= self.t_grace:
            return 0.0
        delay = (self.t_stopped - self.t_grace) / 1.00
        term = min(self.J_stall_max, delay ** self.gamma)
        return self.w_stall * term

    def step(
        self,
        ego: EgoState,
        world: SimulationWorld,
        visible_agents: List[AgentTrack],
        dt: float,
        current_time: float,
    ) -> PlannerStepResult:
        self.time_since_replan += dt

        # Update stopped-duration timer with anti-chatter hysteresis
        if ego.v < 0.20:
            self.t_stopped += dt
        elif ego.v >= 0.50:
            self.t_stopped = 0.0
        # else: 0.20 <= ego.v < 0.50 -> hold constant

        static_circles = [(obj.x, obj.y, max(obj.length, obj.width) / 2.0) for obj in world.static_obstacles]

        # 1. Evaluate current ego risk field
        current_ego_risk = self.risk_field_evaluator.evaluate_point_risk(
            ego.x, ego.y, ego.v, visible_agents, static_circles
        )

        # 2. Check Dynamic Replan Trigger
        ego_path_pts = [(p[0], p[1]) for p in self.last_planned_trajectory]
        should_replan, trigger_reason = self.risk_field_evaluator.check_replan_trigger(
            current_risk=current_ego_risk,
            previous_risk=self.last_ego_risk,
            ego_path=ego_path_pts,
            agents=visible_agents,
            time_since_last_replan_s=self.time_since_replan,
            min_replan_interval_s=0.15,
            max_replan_interval_s=1.20,
        )

        if not self.last_planned_trajectory:
            should_replan = True
            trigger_reason = "PERIODIC"
        elif self.t_stopped > self.t_grace and self.time_since_replan >= 0.20:
            should_replan = True
            trigger_reason = "PATH_BLOCKED"

        self.last_ego_risk = current_ego_risk

        # If trigger did NOT fire, continue executing current smooth trajectory ahead of ego
        ahead_traj = [pt for pt in self.last_planned_trajectory if pt[0] >= ego.x - 0.2]
        if not should_replan and len(ahead_traj) >= 4:
            target_pt = ahead_traj[min(2, len(ahead_traj) - 1)]
            dx = target_pt[0] - ego.x
            dy = target_pt[1] - ego.y
            target_yaw = math.atan2(dy, dx)
            steer = 0.80 * ((target_yaw - ego.yaw + math.pi) % (2 * math.pi) - math.pi)
            accel = min(1.5, max(-3.5, (target_pt[2] - ego.v) * 0.95))

            cost = compute_trajectory_cost(
                trajectory=ahead_traj,
                target_x=ego.x + 30.0,
                collision_risk=current_ego_risk,
                accel=accel,
                steer=steer,
                replan_triggered=False,
                split="tune",
            )
            return PlannerStepResult(
                steer=steer,
                accel=accel,
                active_state="FOLLOW" if abs(ego.y) < 0.6 else "BYPASS",
                planned_trajectory=ahead_traj,
                replan_triggered=False,
                trigger_reason=None,
                cost_breakdown=cost,
                decision_trace=f"P3 executing smooth trajectory; risk={current_ego_risk:.2f} below dynamic threshold.",
            )
        else:
            should_replan = True
            if not trigger_reason:
                trigger_reason = "PERIODIC"

        # 3. Dynamic Replan Fired!
        self.time_since_replan = 0.0
        self.replan_count += 1

        # Check for High Epistemic Uncertainty -> Minimal-Risk Manoeuvre (MRM)
        max_agent_uncertainty = 0.0
        for ag in visible_agents:
            if ag.conformal_envelope:
                last_cone = ag.conformal_envelope[-1]
                if getattr(last_cone, "coverage_guarantee_valid", True):
                    max_agent_uncertainty = max(max_agent_uncertainty, last_cone.radius_m)

        if max_agent_uncertainty > self.risk_thresholds.uncertainty_mrm_limit and current_ego_risk > 0.6:
            # Minimal-Risk Manoeuvre triggered
            mrm_steer = 0.0
            mrm_accel = -5.8 # Controlled aggressive deceleration
            mrm_state = "EMERGENCY_BRAKE"
            mrm_traj = [(ego.x + ego.v * 0.1 * i, ego.y, 0.0) for i in range(1, 10)]
            self.last_planned_trajectory = mrm_traj
            mrm_cost = compute_trajectory_cost(
                trajectory=mrm_traj,
                target_x=ego.x + 30.0,
                collision_risk=current_ego_risk,
                accel=mrm_accel,
                steer=mrm_steer,
                replan_triggered=True,
                split="tune",
            )
            return PlannerStepResult(
                steer=mrm_steer,
                accel=mrm_accel,
                active_state=mrm_state,
                planned_trajectory=mrm_traj,
                replan_triggered=True,
                trigger_reason="UNCERTAINTY_EXCEEDED_MRM",
                cost_breakdown=mrm_cost,
                decision_trace="P3 Minimal-Risk Manoeuvre (MRM): Conformal uncertainty exceeded threshold with high risk. Executing controlled safe stop.",
            )

        # Trajectory Optimization with Conformal Envelope Constraints
        sim_dt = 0.2
        num_steps = 15  # 3.0s horizon
        best_cost = float("inf")
        best_traj: List[Tuple[float, float, float]] = []
        best_state = "FOLLOW"
        best_breakdown = CostBreakdown()

        ego_l = getattr(ego, "length", 4.20) or 4.20
        ego_w = getattr(ego, "width", 1.80) or 1.80
        road_y_bound = 4.70

        # Precompute static obstacle bounding boxes
        static_boxes = [
            KinematicBicycleModel.get_bounding_box(
                obj.x, obj.y, getattr(obj, "yaw", 0.0), obj.length, obj.width
            )
            for obj in world.static_obstacles
        ]

        # Precompute dynamic agent occupancy and conformal cones across horizon steps
        agent_occupancy_by_step: Dict[int, List[List[Tuple[float, float]]]] = {}
        agent_conformal_by_step: Dict[int, List[Tuple[AgentTrack, float]]] = {}

        for step_idx in range(1, num_steps + 1):
            t_fut = step_idx * sim_dt
            step_boxes = []
            step_cones = []
            for ag in visible_agents:
                # Nominal linear extrapolation of bounding box over horizon
                ag_fx = ag.x + ag.v_x * t_fut
                ag_fy = ag.y + ag.v_y * t_fut
                ag_l = ag.length if ag.length and ag.length > 0 else 2.0
                ag_w = ag.width if ag.width and ag.width > 0 else 1.0
                ag_box = KinematicBicycleModel.get_bounding_box(
                    ag_fx, ag_fy, ag.yaw, ag_l, ag_w
                )
                step_boxes.append(ag_box)

                # Conformal radius at t_fut
                cone_r = 1.0
                if ag.conformal_envelope:
                    for cp in ag.conformal_envelope:
                        if cp.t_rel >= t_fut:
                            if getattr(cp, "coverage_guarantee_valid", True):
                                cone_r = cp.radius_m
                            break
                step_cones.append((ag, cone_r))

            agent_occupancy_by_step[step_idx] = step_boxes
            agent_conformal_by_step[step_idx] = step_cones

        persist_penalty = self.compute_stationary_penalty()

        for lat_offset in self.candidate_lat_offsets:
            for s_ratio in self.speed_ratios:
                cand_v = self.target_speed * s_ratio
                curr_x, curr_y, curr_yaw = ego.x, ego.y, ego.yaw
                traj = []
                collision = False
                cum_risk = 0.0
                min_obs_dist = float("inf")

                for step_idx in range(1, num_steps + 1):
                    t_fut = step_idx * sim_dt
                    ey = curr_y - lat_offset
                    yaw_norm = (curr_yaw + math.pi) % (2 * math.pi) - math.pi
                    steer_cmd = -0.38 * ey - 0.75 * yaw_norm
                    curr_x, curr_y, curr_yaw, _, _ = self.vehicle_model.step(
                        curr_x, curr_y, curr_yaw, cand_v, steer_cmd, 0.0, sim_dt
                    )
                    traj.append((curr_x, curr_y, cand_v))

                    ego_box = KinematicBicycleModel.get_bounding_box(
                        curr_x, curr_y, curr_yaw, ego_l, ego_w
                    )

                    # 1. Driveable road bounds: full footprint containment
                    if any(abs(cy) > road_y_bound for _, cy in ego_box):
                        collision = True
                        self.rejection_counts["road_boundary"] += 1
                        break

                    # 2. Static obstacle SAT collision
                    for s_box in static_boxes:
                        if KinematicBicycleModel.check_sat_collision(ego_box, s_box):
                            collision = True
                            self.rejection_counts["physical_collision"] += 1
                            break
                    if collision:
                        break

                    # 3. Dynamic obstacle predicted occupancy SAT collision
                    for ag_box in agent_occupancy_by_step[step_idx]:
                        if KinematicBicycleModel.check_sat_collision(ego_box, ag_box):
                            collision = True
                            self.rejection_counts["predicted_occupancy"] += 1
                            break
                    if collision:
                        break

                    # Track obstacle physical clearance
                    for ag in visible_agents:
                        ag_pred_x = ag.x + ag.v_x * t_fut
                        ag_pred_y = ag.y + ag.v_y * t_fut
                        d_ag = math.hypot(curr_x - ag_pred_x, curr_y - ag_pred_y) - 1.5
                        min_obs_dist = min(min_obs_dist, max(0.0, d_ag))

                    for sx, sy, sr in static_circles:
                        d_st = math.hypot(curr_x - sx, curr_y - sy) - (sr + 0.9)
                        min_obs_dist = min(min_obs_dist, max(0.0, d_st))

                    # 4. Evaluate continuous point risk
                    pt_risk = self.risk_field_evaluator.evaluate_point_risk(
                        curr_x, curr_y, cand_v, visible_agents, static_circles
                    )
                    cum_risk += pt_risk

                    # 5. Multi-hypothesis conformal envelope avoidance (soft risk)
                    for ag, cone_r in agent_conformal_by_step[step_idx]:
                        for hyp in ag.prediction_hypotheses:
                            hyp_pt = None
                            for hp in hyp.trajectory:
                                if hp.t_rel >= t_fut:
                                    hyp_pt = hp
                                    break
                            if hyp_pt:
                                dist_to_hyp = math.hypot(curr_x - hyp_pt.x, curr_y - hyp_pt.y)
                                if dist_to_hyp < (0.9 + cone_r):
                                    cum_risk += 0.35 * hyp.weight

                if collision:
                    continue

                # Progress loss with stationary persistence penalty
                J_persist = persist_penalty if (s_ratio == 0.0 or cand_v == 0.0) else 0.0
                progress_loss = self.w_prog * (1.0 - s_ratio) + J_persist
                smoothness_loss = 0.5 * abs(lat_offset - ego.y) + 0.15 * abs(lat_offset)
                risk_loss = 3.5 * cum_risk
                clearance_loss = 3.0 * max(0.0, 0.80 - min_obs_dist) if cand_v > 0.0 else 0.0

                # Corridor anticipation: penalize aiming directly toward obstacles ahead in the same lateral swath
                corridor_loss = 0.0
                for ag in visible_agents:
                    dx_ag = ag.x - ego.x
                    if -1.0 < dx_ag < 25.0:
                        obs_extent = max(getattr(ag, "length", 2.4) or 2.4, getattr(ag, "width", 1.2) or 1.2) / 2.0 + 1.4
                        if abs(lat_offset - ag.y) < obs_extent:
                            corridor_loss += 5.0 * math.exp(-max(0.0, dx_ag) / 12.0)
                for sx, sy, sr in static_circles:
                    dx_st = sx - ego.x
                    if -1.0 < dx_st < 25.0 and abs(lat_offset - sy) < (sr + 1.4):
                        corridor_loss += 5.0 * math.exp(-max(0.0, dx_st) / 12.0)

                # Lateral bypass speed regulation: penalize high speeds during sharp lateral maneuvers
                speed_reg_loss = 4.0 * (s_ratio - 0.50) if (abs(lat_offset) > 1.0 and s_ratio > 0.50) else 0.0

                total = progress_loss + smoothness_loss + risk_loss + clearance_loss + corridor_loss + speed_reg_loss

                if total < best_cost:
                    best_cost = total
                    best_traj = traj
                    if cand_v == 0.0:
                        best_state = "STOP"
                    elif abs(lat_offset) > 0.8:
                        best_state = "BYPASS"
                    elif s_ratio < 0.7:
                        best_state = "SLOW"
                    else:
                        best_state = "FOLLOW"
        if not best_traj:
            # Fallback to minimal risk braking
            best_steer = 0.0
            best_accel = -5.0
            best_state = "EMERGENCY_BRAKE"
            best_traj = [(ego.x + ego.v * 0.1 * i, ego.y, 0.0) for i in range(1, 10)]
            trace = "P3: All tentacles in conflict. Executing minimal-risk safe deceleration."
            best_breakdown = compute_trajectory_cost(
                trajectory=best_traj,
                target_x=ego.x + 30.0,
                collision_risk=0.88,
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
            best_steer = 0.80 * ((target_yaw - ego.yaw + math.pi) % (2 * math.pi) - math.pi)
            best_accel = min(1.5, max(-4.0, (first_pt[2] - ego.v) * 0.85))
            best_breakdown = compute_trajectory_cost(
                trajectory=best_traj,
                target_x=ego.x + 30.0,
                collision_risk=0.12,
                accel=best_accel,
                steer=best_steer,
                replan_triggered=True,
                split="tune",
            )
            trace = f"P3 Dynamic Replan ({trigger_reason}): Selected {best_state} (cost={best_breakdown.total_cost:.2f}, trigger={trigger_reason})."

        self.last_planned_trajectory = best_traj

        return PlannerStepResult(
            steer=best_steer,
            accel=best_accel,
            active_state=best_state,
            planned_trajectory=best_traj,
            replan_triggered=True,
            trigger_reason=trigger_reason,
            cost_breakdown=best_breakdown,
            decision_trace=trace,
        )

"""
Planner P3-ML: Learned-Predictor Variant of Risk-Adaptive Motion Planning.
Combines Learned Multi-Modal Trajectory Predictor with Dynamic Event-Triggered
Replanning, Conservative Minimal-Risk Manoeuvre (MRM), and 5-term cost evaluation:
Cost = w1*Distance + w2*CollisionRisk + w3*Curvature + w4*Energy + w5*ReplanCost
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from .base import BasePlanner, PlannerStepResult
from engine.simulation.world import SimulationWorld
from engine.simulation.vehicle import KinematicBicycleModel
from engine.prediction.learned_predictor import LearnedMultiModalPredictor
from engine.risk.field import CalibratedRiskField, RiskThresholds
from engine.config.cost_evaluator import compute_trajectory_cost
from engine.apath_log.schema import EgoState, AgentTrack, CostBreakdown


class P3MLPlanner(BasePlanner):
    """
    P3-ML: Full Adaptive Motion Planner with Learned Multi-Modal Prediction.
    - Deep GMM learned multi-modal trajectory forecasting
    - Dynamic event trigger (fires instantaneously on risk jump or uncertainty surge)
    - Conservative Minimal-Risk Manoeuvre (MRM) fallback under high uncertainty
    - Logs trigger reason and all 5 cost terms on every replan
    """

    def __init__(self, params: Optional[Dict[str, Any]] = None):
        super().__init__("P3-ML", "Planner 3-ML: Risk-Adaptive with Learned Predictor & MRM", params)
        self.risk_thresholds = RiskThresholds(
            critical_trigger=self.params.get("critical_trigger", 0.60),
            delta_risk_trigger=self.params.get("delta_risk_trigger", 0.18),
            uncertainty_mrm_limit=self.params.get("uncertainty_mrm_limit", 2.6),
        )
        self.risk_field_evaluator = CalibratedRiskField(self.risk_thresholds)
        self.learned_predictor = LearnedMultiModalPredictor(horizon_s=3.0, dt=0.2)
        self.last_ego_risk: float = 0.0
        self.candidate_lat_offsets = [-2.2, -1.4, -0.7, 0.0, 0.7, 1.4, 2.2]
        self.speed_ratios = [1.0, 0.8, 0.5, 0.25, 0.0]
        self.replan_count: int = 0

    def reset(self):
        super().reset()
        self.last_ego_risk = 0.0
        self.replan_count = 0

    def step(
        self,
        ego: EgoState,
        world: SimulationWorld,
        visible_agents: List[AgentTrack],
        dt: float,
        current_time: float,
    ) -> PlannerStepResult:
        self.time_since_replan += dt

        static_circles = [
            (obj.x, obj.y, max(obj.length, obj.width) / 2.0)
            for obj in world.static_obstacles
        ]

        # 1. Enrich visible agents with learned multi-modal predictions
        enriched_agents: List[AgentTrack] = []
        max_uncertainty_observed = 0.0
        for ag in visible_agents:
            hist = getattr(ag, "history", None)
            hypotheses, cones = self.learned_predictor.predict(
                class_name=ag.class_name,
                x=ag.x,
                y=ag.y,
                yaw=ag.yaw,
                vx=ag.v_x,
                vy=ag.v_y,
                history=hist,
            )
            for c in cones:
                max_uncertainty_observed = max(max_uncertainty_observed, c.radius_m)

            ag_copy = AgentTrack(
                id=ag.id,
                class_name=ag.class_name,
                x=ag.x,
                y=ag.y,
                yaw=ag.yaw,
                v_x=ag.v_x,
                v_y=ag.v_y,
                length=ag.length,
                width=ag.width,
                is_occluded=ag.is_occluded,
                confidence=ag.confidence,
                history_len=ag.history_len,
                covariance=ag.covariance,
                prediction_hypotheses=hypotheses,
                conformal_envelope=cones,
            )
            enriched_agents.append(ag_copy)

        # 2. Evaluate current ego risk field
        current_ego_risk = self.risk_field_evaluator.evaluate_point_risk(
            ego.x, ego.y, ego.v, enriched_agents, static_circles
        )

        # 3. Dynamic Replan Trigger Check
        ego_path_pts = [(p[0], p[1]) for p in self.last_planned_trajectory]
        should_replan, trigger_reason = self.risk_field_evaluator.check_replan_trigger(
            current_risk=current_ego_risk,
            previous_risk=self.last_ego_risk,
            ego_path=ego_path_pts,
            agents=enriched_agents,
            time_since_last_replan_s=self.time_since_replan,
            min_replan_interval_s=0.15,
            max_replan_interval_s=1.20,
        )

        # Uncertainty threshold check -> MRM Trigger
        if max_uncertainty_observed >= self.risk_thresholds.uncertainty_mrm_limit:
            should_replan = True
            trigger_reason = "UNCERTAINTY_EXCEEDED_MRM"

        if not self.last_planned_trajectory:
            should_replan = True
            trigger_reason = "PERIODIC"

        self.last_ego_risk = current_ego_risk

        # 4. If Trigger did not fire, track existing smooth trajectory
        if not should_replan and self.last_planned_trajectory:
            target_pt = self.last_planned_trajectory[
                min(3, len(self.last_planned_trajectory) - 1)
            ]
            dx = target_pt[0] - ego.x
            dy = target_pt[1] - ego.y
            target_yaw = math.atan2(dy, dx)
            steer = 0.85 * ((target_yaw - ego.yaw + math.pi) % (2 * math.pi) - math.pi)
            accel = min(1.5, max(-3.5, (target_pt[2] - ego.v) * 0.95))

            cost = compute_trajectory_cost(
                trajectory=self.last_planned_trajectory,
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
                planned_trajectory=self.last_planned_trajectory,
                replan_triggered=False,
                trigger_reason=None,
                cost_breakdown=cost,
                decision_trace=f"P3-ML tracking smooth path; risk={current_ego_risk:.2f} < threshold.",
            )

        # 5. Event Trigger Fired -> Full Replanning Cycle
        self.time_since_replan = 0.0
        self.replan_count += 1

        # Check if Minimal-Risk Manoeuvre (MRM) is required
        if trigger_reason == "UNCERTAINTY_EXCEEDED_MRM":
            # Conservative Minimal-Risk Manoeuvre: controlled safe deceleration along current heading
            mrm_steer = -0.5 * ego.yaw
            mrm_accel = -5.0
            mrm_traj = [
                (ego.x + i * 0.5, ego.y, max(0.0, ego.v - i * 1.5))
                for i in range(1, 12)
            ]
            mrm_cost = compute_trajectory_cost(
                trajectory=mrm_traj,
                target_x=ego.x + 30.0,
                collision_risk=current_ego_risk,
                accel=mrm_accel,
                steer=mrm_steer,
                replan_triggered=True,
                split="tune",
            )
            self.last_planned_trajectory = mrm_traj
            return PlannerStepResult(
                steer=mrm_steer,
                accel=mrm_accel,
                active_state="EMERGENCY_BRAKE",
                planned_trajectory=mrm_traj,
                replan_triggered=True,
                trigger_reason="UNCERTAINTY_EXCEEDED_MRM",
                cost_breakdown=mrm_cost,
                decision_trace=f"P3-ML MRM ACTIVE: Uncertainty {max_uncertainty_observed:.2f}m >= limit. Controlled safe stop.",
            )

        # Standard Multi-Corridor Sampling Optimization
        best_cost = float("inf")
        best_traj: List[Tuple[float, float, float]] = []
        best_steer = 0.0
        best_accel = 0.0
        best_state = "FOLLOW"
        best_breakdown = CostBreakdown()

        sim_dt = 0.2
        num_steps = 14

        for lat_offset in self.candidate_lat_offsets:
            for s_ratio in self.speed_ratios:
                cand_v = self.target_speed * s_ratio
                curr_x, curr_y, curr_yaw = ego.x, ego.y, ego.yaw
                traj = []
                collision = False
                cum_risk = 0.0

                for step_idx in range(1, num_steps + 1):
                    ey = curr_y - lat_offset
                    steer_cmd = -0.40 * ey - 0.75 * curr_yaw
                    curr_x, curr_y, curr_yaw, _, _ = self.vehicle_model.step(
                        curr_x, curr_y, curr_yaw, cand_v, steer_cmd, 0.0, sim_dt
                    )
                    traj.append((curr_x, curr_y, cand_v))

                    if curr_y > 3.6 or curr_y < -3.6:
                        collision = True
                        break

                    pt_risk = self.risk_field_evaluator.evaluate_point_risk(
                        curr_x, curr_y, cand_v, enriched_agents, static_circles
                    )
                    cum_risk += pt_risk
                    if pt_risk > 0.85:
                        collision = True
                        break

                if collision:
                    continue

                avg_risk = cum_risk / max(1, len(traj))
                steer_init = -0.40 * (ego.y - lat_offset) - 0.75 * ego.yaw
                accel_init = min(1.5, max(-4.5, (cand_v - ego.v) * 0.95))

                cost = compute_trajectory_cost(
                    trajectory=traj,
                    target_x=ego.x + 30.0,
                    collision_risk=avg_risk,
                    accel=accel_init,
                    steer=steer_init,
                    replan_triggered=True,
                    split="tune",
                )

                if cost.total_cost < best_cost:
                    best_cost = cost.total_cost
                    best_traj = traj
                    best_steer = steer_init
                    best_accel = accel_init
                    best_breakdown = cost
                    if abs(lat_offset) > 0.8:
                        best_state = "BYPASS"
                    elif s_ratio < 0.6:
                        best_state = "SLOW"
                    else:
                        best_state = "FOLLOW"

        if not best_traj:
            # Fallback stop
            best_steer = 0.0
            best_accel = -5.0
            best_traj = [(ego.x + 0.1, ego.y, 0.0)]
            best_state = "STOP"
            best_breakdown = compute_trajectory_cost(
                trajectory=best_traj,
                target_x=ego.x + 30.0,
                collision_risk=0.85,
                accel=best_accel,
                steer=best_steer,
                replan_triggered=True,
                split="tune",
            )

        self.last_planned_trajectory = best_traj

        return PlannerStepResult(
            steer=best_steer,
            accel=best_accel,
            active_state=best_state,
            planned_trajectory=best_traj,
            replan_triggered=True,
            trigger_reason=trigger_reason,
            cost_breakdown=best_breakdown,
            decision_trace=f"P3-ML event-trigger [{trigger_reason}] replanned path; cost={best_breakdown.total_cost:.3f}",
        )

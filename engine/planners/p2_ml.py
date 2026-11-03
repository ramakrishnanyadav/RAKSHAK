"""
Planner P2-ML: Learned-Predictor Variant of Risk-Aware Motion Planning.
Integrates a Multi-Modal Learned Predictor (GMM/Neural Intent Network)
with continuous risk field optimization and 5-term cost evaluation:
Cost = w1*Distance + w2*CollisionRisk + w3*Curvature + w4*Energy + w5*ReplanCost
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from .base import BasePlanner, PlannerStepResult
from engine.simulation.world import SimulationWorld
from engine.simulation.vehicle import KinematicBicycleModel
from engine.prediction.learned_predictor import LearnedMultiModalPredictor
from engine.risk.field import CalibratedRiskField
from engine.config.cost_evaluator import compute_trajectory_cost
from engine.apath_log.schema import EgoState, AgentTrack, CostBreakdown


class P2MLPlanner(BasePlanner):
    """
    P2-ML: Risk-Aware Planning with Learned Intent Predictor.
    Evaluates multi-modal probability distributions over agent futures,
    minimizing expected risk across predicted modes on a periodic clock.
    """

    def __init__(self, params: Optional[Dict[str, Any]] = None):
        super().__init__("P2-ML", "Planner 2-ML: Risk-Aware with Learned Predictor", params)
        self.replan_interval_s = self.params.get("replan_interval_s", 0.5)
        self.learned_predictor = LearnedMultiModalPredictor(horizon_s=3.0, dt=0.2)
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

        should_replan = (
            self.time_since_replan >= self.replan_interval_s
            or not self.last_planned_trajectory
        )

        static_circles = [
            (obj.x, obj.y, max(obj.length, obj.width) / 2.0)
            for obj in world.static_obstacles
        ]

        # 1. Enrich visible agents with learned multi-modal predictions
        enriched_agents: List[AgentTrack] = []
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
            # Create shallow copy with updated learned prediction
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

        current_risk = self.risk_field_evaluator.evaluate_point_risk(
            ego.x, ego.y, ego.v, enriched_agents, static_circles
        )

        if not should_replan and self.last_planned_trajectory:
            target_pt = self.last_planned_trajectory[
                min(3, len(self.last_planned_trajectory) - 1)
            ]
            dx = target_pt[0] - ego.x
            dy = target_pt[1] - ego.y
            target_yaw = math.atan2(dy, dx)
            steer = 0.8 * ((target_yaw - ego.yaw + math.pi) % (2 * math.pi) - math.pi)
            accel = min(1.5, max(-3.5, (target_pt[2] - ego.v) * 0.9))

            cost = compute_trajectory_cost(
                trajectory=self.last_planned_trajectory,
                target_x=ego.x + 30.0,
                collision_risk=current_risk,
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
                decision_trace=f"P2-ML tracking trajectory; risk={current_risk:.2f}; cost={cost.total_cost:.3f}",
            )

        # Replan cycle
        self.time_since_replan = 0.0
        best_cost = float("inf")
        best_traj: List[Tuple[float, float, float]] = []
        best_steer = 0.0
        best_accel = 0.0
        best_breakdown = CostBreakdown()

        sim_dt = 0.2
        num_steps = 14  # 2.8s preview

        for lat_offset in self.candidate_lat_offsets:
            for s_ratio in self.speed_ratios:
                cand_v = self.target_speed * s_ratio
                curr_x, curr_y, curr_yaw = ego.x, ego.y, ego.yaw
                traj = []
                collision = False
                cum_risk = 0.0

                for step_idx in range(1, num_steps + 1):
                    ey = curr_y - lat_offset
                    steer_cmd = -0.35 * ey - 0.7 * curr_yaw
                    curr_x, curr_y, curr_yaw, _, _ = self.vehicle_model.step(
                        curr_x, curr_y, curr_yaw, cand_v, steer_cmd, 0.0, sim_dt
                    )
                    traj.append((curr_x, curr_y, cand_v))

                    if curr_y > 4.5 or curr_y < -4.5:
                        collision = True
                        break

                    pt_risk = self.risk_field_evaluator.evaluate_point_risk(
                        curr_x, curr_y, cand_v, enriched_agents, static_circles
                    )
                    cum_risk += pt_risk
                    if pt_risk > 0.88:
                        collision = True
                        break

                if collision:
                    continue

                avg_risk = cum_risk / max(1, len(traj))
                steer_init = -0.35 * (ego.y - lat_offset) - 0.7 * ego.yaw
                accel_init = min(1.5, max(-4.0, (cand_v - ego.v) * 0.9))

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

        if not best_traj:
            # Fallback stop
            best_steer = 0.0
            best_accel = -4.0
            best_traj = [(ego.x + 0.1, ego.y, 0.0)]
            best_breakdown = compute_trajectory_cost(
                trajectory=best_traj,
                target_x=ego.x + 30.0,
                collision_risk=0.9,
                accel=best_accel,
                steer=best_steer,
                replan_triggered=True,
                split="tune",
            )

        self.last_planned_trajectory = best_traj

        active_st = "FOLLOW"
        if best_breakdown.w2_collision_risk > 0.8:
            active_st = "SLOW"
        if abs(ego.y) > 0.8:
            active_st = "BYPASS"

        return PlannerStepResult(
            steer=best_steer,
            accel=best_accel,
            active_state=active_st,
            planned_trajectory=best_traj,
            replan_triggered=True,
            trigger_reason="PERIODIC",
            cost_breakdown=best_breakdown,
            decision_trace=f"P2-ML planned learned-predictor trajectory; cost={best_breakdown.total_cost:.3f}",
        )

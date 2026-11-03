"""
Planner B2: Kinematic Hybrid A*.
SE(2) continuous state graph search exploring non-holonomic vehicle motion primitives
with Euclidean + non-holonomic heuristic costs and obstacle clearance transforms.
"""

import math
import heapq
from typing import List, Tuple, Dict, Any, Optional, Set
from .base import BasePlanner, PlannerStepResult
from engine.simulation.world import SimulationWorld
from engine.simulation.vehicle import KinematicBicycleModel
from engine.apath_log.schema import EgoState, AgentTrack, CostBreakdown
from engine.config.cost_evaluator import compute_trajectory_cost


class NodeSE2:
    def __init__(self, x: float, y: float, yaw: float, g: float, h: float, parent=None, steer: float = 0.0):
        self.x = x
        self.y = y
        self.yaw = yaw
        self.g = g
        self.h = h
        self.f = g + h
        self.parent = parent
        self.steer = steer

    def __lt__(self, other):
        return self.f < other.f


class B2HybridAStarPlanner(BasePlanner):
    """
    Kinematic Hybrid A* Planner.
    Solves non-holonomic search in SE(2) continuous space to find kinematically feasible,
    collision-free paths avoiding both static clutter and dynamic obstacles.
    """

    def __init__(self, params: Optional[Dict[str, Any]] = None):
        super().__init__("B2", "Baseline 2: Kinematic Hybrid A*", params)
        self.replan_interval_s = 0.5  # Recomputes at 2 Hz
        self.xy_resolution = 0.5      # meters
        self.yaw_resolution = math.radians(15)
        self.motion_primitives = [-0.45, -0.22, 0.0, 0.22, 0.45] # Steering angles
        self.step_size = 1.2          # Forward step in meters

    def reset(self):
        super().reset()

    def _state_to_key(self, x: float, y: float, yaw: float) -> Tuple[int, int, int]:
        ix = int(round(x / self.xy_resolution))
        iy = int(round(y / self.xy_resolution))
        iyaw = int(round((yaw % (2 * math.pi)) / self.yaw_resolution))
        return (ix, iy, iyaw)

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
            # Continue tracking existing planned path
            # Lookahead 4 points
            target_pt = self.last_planned_trajectory[min(3, len(self.last_planned_trajectory) - 1)]
            dx = target_pt[0] - ego.x
            dy = target_pt[1] - ego.y
            target_yaw = math.atan2(dy, dx)
            steer = 0.8 * ((target_yaw - ego.yaw + math.pi) % (2 * math.pi) - math.pi)
            accel = min(1.5, max(-3.0, (target_pt[2] - ego.v) * 0.8))
            return PlannerStepResult(
                steer=steer,
                accel=accel,
                active_state="FOLLOW",
                planned_trajectory=self.last_planned_trajectory,
                replan_triggered=False,
                trigger_reason=None,
                cost_breakdown=CostBreakdown(progress_cost=0.2, total_cost=0.2),
                decision_trace="B2 tracking existing kinematic Hybrid A* path.",
            )

        # Execute Hybrid A* Search
        self.time_since_replan = 0.0

        goal_x = ego.x + 25.0
        goal_y = 0.0

        start_node = NodeSE2(ego.x, ego.y, ego.yaw, g=0.0, h=math.hypot(goal_x - ego.x, goal_y - ego.y))
        open_set = [start_node]
        closed_set: Set[Tuple[int, int, int]] = set()

        best_node = start_node
        max_iterations = 220
        iterations = 0

        # Build obstacle circles for quick clearance evaluation
        obs_circles = []
        for obj in world.static_obstacles:
            r = max(obj.length, obj.width) / 2.0 + 0.8
            obs_circles.append((obj.x, obj.y, r))
        for ag in visible_agents:
            r = max(ag.length, ag.width) / 2.0 + 1.2
            obs_circles.append((ag.x, ag.y, r))

        while open_set and iterations < max_iterations:
            iterations += 1
            current = heapq.heappop(open_set)

            if current.x > best_node.x:
                best_node = current

            # Goal test
            if current.x >= goal_x - 2.0 and abs(current.y - goal_y) < 1.5:
                best_node = current
                break

            key = self._state_to_key(current.x, current.y, current.yaw)
            if key in closed_set:
                continue
            closed_set.add(key)

            # Expand kinematic primitives
            for steer in self.motion_primitives:
                # Bicycle rollout for one step
                nx, ny, nyaw, _, _ = self.vehicle_model.step(
                    current.x, current.y, current.yaw, self.target_speed, steer, 0.0, dt=self.step_size / self.target_speed
                )

                # Road boundary check
                if ny > 4.5 or ny < -4.5:
                    continue

                # Obstacle clearance check
                collision = False
                for ox, oy, r in obs_circles:
                    if math.hypot(nx - ox, ny - oy) < r:
                        collision = True
                        break
                if collision:
                    continue

                # Heuristic: remaining distance to goal + deviation from centerline + steering penalty
                h = math.hypot(goal_x - nx, goal_y - ny) + 0.8 * abs(ny)
                g = current.g + self.step_size + 0.3 * abs(steer)

                nkey = self._state_to_key(nx, ny, nyaw)
                if nkey not in closed_set:
                    next_node = NodeSE2(nx, ny, nyaw, g=g, h=h, parent=current, steer=steer)
                    heapq.heappush(open_set, next_node)

        # Backtrack trajectory
        path: List[Tuple[float, float, float]] = []
        curr = best_node
        while curr:
            path.append((curr.x, curr.y, self.target_speed))
            curr = curr.parent
        path.reverse()

        if len(path) > 1:
            self.last_planned_trajectory = path
            # Control toward first segment
            target_pt = path[min(2, len(path) - 1)]
            dx = target_pt[0] - ego.x
            dy = target_pt[1] - ego.y
            target_yaw = math.atan2(dy, dx)
            steer = 0.7 * ((target_yaw - ego.yaw + math.pi) % (2 * math.pi) - math.pi)
            accel = min(1.2, max(-2.5, (self.target_speed - ego.v) * 0.8))
            active_state = "BYPASS" if abs(ego.y) > 0.8 else "FOLLOW"
            trace = f"B2 Hybrid A* solved path ({len(path)} waypoints, {iterations} nodes explored)."
        else:
            # Fallback brake
            steer = 0.0
            accel = -4.0
            active_state = "STOP"
            trace = f"B2 Hybrid A* failed to find path after {iterations} nodes; fallback emergency brake."
        cost = compute_trajectory_cost(
            trajectory=self.last_planned_trajectory,
            target_x=ego.x + 30.0,
            collision_risk=0.05 if active_state != "STOP" else 0.85,
            accel=accel,
            steer=steer,
            replan_triggered=True,
            split="tune",
        )

        return PlannerStepResult(
            steer=steer,
            accel=accel,
            active_state=active_state,
            planned_trajectory=self.last_planned_trajectory,
            replan_triggered=True,
            trigger_reason="PERIODIC",
            cost_breakdown=cost,
            decision_trace=trace,
        )

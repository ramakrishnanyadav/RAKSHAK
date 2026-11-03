"""
World Model and Driveable Free-Space Representation without Lane Markings.
Computes continuous non-lane driveable corridor, local occupancy grid, and clearance.
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass, field
from engine.apath_log.schema import WorldBounds, RoadBoundary, StaticObstacle


@dataclass
class LocalOccupancyGrid:
    """
    Local rolling 2D occupancy grid centered at ego vehicle:
    - x_range: [-10.0, 45.0] meters relative to ego
    - y_range: [-7.0, 7.0] meters relative to ego
    - resolution: 0.25 meters per cell
    - Values: 0.0 (driveable free space) to 1.0 (fully occupied/barrier)
    """
    resolution: float = 0.25
    x_min: float = -10.0
    x_max: float = 45.0
    y_min: float = -7.0
    y_max: float = 7.0
    width_cells: int = field(init=False)
    height_cells: int = field(init=False)
    cells: List[List[float]] = field(init=False)

    def __post_init__(self):
        self.width_cells = int((self.x_max - self.x_min) / self.resolution)
        self.height_cells = int((self.y_max - self.y_min) / self.resolution)
        self.cells = [[0.0 for _ in range(self.width_cells)] for _ in range(self.height_cells)]

    def clear(self):
        for r in range(self.height_cells):
            for c in range(self.width_cells):
                self.cells[r][c] = 0.0

    def world_to_grid(self, rel_x: float, rel_y: float) -> Optional[Tuple[int, int]]:
        if not (self.x_min <= rel_x < self.x_max and self.y_min <= rel_y < self.y_max):
            return None
        c = int((rel_x - self.x_min) / self.resolution)
        r = int((rel_y - self.y_min) / self.resolution)
        c = max(0, min(self.width_cells - 1, c))
        r = max(0, min(self.height_cells - 1, r))
        return r, c

    def mark_circle(self, rel_x: float, rel_y: float, radius: float, value: float = 1.0):
        r_cells = int(math.ceil(radius / self.resolution))
        pt = self.world_to_grid(rel_x, rel_y)
        if not pt:
            return
        cr, cc = pt
        for dr in range(-r_cells, r_cells + 1):
            for dc in range(-r_cells, r_cells + 1):
                if dr * dr + dc * dc <= r_cells * r_cells:
                    nr = cr + dr
                    nc = cc + dc
                    if 0 <= nr < self.height_cells and 0 <= nc < self.width_cells:
                        self.cells[nr][nc] = max(self.cells[nr][nc], value)


class NonLaneWorldModel:
    """
    World Model representing unstructured Indian roadways:
    - Eliminates reliance on lane markings (uses physical continuous boundaries)
    - Generates driveable free-space envelope
    - Computes local occupancy grid from static obstacles and tracked dynamic agents
    - Evaluates minimum lateral clearance to non-lane road edges
    """

    def __init__(
        self,
        bounds: Optional[WorldBounds] = None,
        road_boundaries: Optional[List[RoadBoundary]] = None,
        static_obstacles: Optional[List[StaticObstacle]] = None,
    ):
        self.bounds = bounds or WorldBounds()
        self.road_boundaries = road_boundaries or []
        self.static_obstacles = static_obstacles or []
        self.occupancy_grid = LocalOccupancyGrid()

    def get_road_corridor_bounds(self, x: float) -> Tuple[float, float]:
        """
        Returns (y_min_driveable, y_max_driveable) at longitudinal station x.
        Interpolates non-lane physical road boundary polylines.
        """
        left_y = 4.2
        right_y = -4.2

        for b in self.road_boundaries:
            if b.side == "left" and len(b.points) >= 2:
                # Find segment containing x
                for i in range(len(b.points) - 1):
                    p1, p2 = b.points[i], b.points[i + 1]
                    if p1[0] <= x <= p2[0] or p2[0] <= x <= p1[0]:
                        t = (x - p1[0]) / (p2[0] - p1[0] + 1e-6)
                        left_y = p1[1] + t * (p2[1] - p1[1])
                        break
            elif b.side == "right" and len(b.points) >= 2:
                for i in range(len(b.points) - 1):
                    p1, p2 = b.points[i], b.points[i + 1]
                    if p1[0] <= x <= p2[0] or p2[0] <= x <= p1[0]:
                        t = (x - p1[0]) / (p2[0] - p1[0] + 1e-6)
                        right_y = p1[1] + t * (p2[1] - p1[1])
                        break

        return right_y, left_y

    def compute_free_space_clearance(self, x: float, y: float) -> float:
        """Computes shortest distance from point (x, y) to road boundaries."""
        y_min, y_max = self.get_road_corridor_bounds(x)
        if y > y_max or y < y_min:
            return 0.0
        return min(y_max - y, y - y_min)

    def update_occupancy_grid(
        self,
        ego_x: float,
        ego_y: float,
        ego_yaw: float,
        tracked_agents: List[Any],
    ):
        """Re-populates rolling local occupancy grid around current ego pose."""
        self.occupancy_grid.clear()
        cos_yaw = math.cos(-ego_yaw)
        sin_yaw = math.sin(-ego_yaw)

        def to_ego_frame(wx: float, wy: float) -> Tuple[float, float]:
            dx = wx - ego_x
            dy = wy - ego_y
            return dx * cos_yaw - dy * sin_yaw, dx * sin_yaw + dy * cos_yaw

        # 1. Mark static obstacles
        for obj in self.static_obstacles:
            rel_x, rel_y = to_ego_frame(obj.x, obj.y)
            r = max(obj.length, obj.width) / 2.0
            self.occupancy_grid.mark_circle(rel_x, rel_y, r, value=1.0)

        # 2. Mark tracked agents
        for ag in tracked_agents:
            rel_x, rel_y = to_ego_frame(ag.x, ag.y)
            r = max(ag.length, ag.width) / 2.0
            self.occupancy_grid.mark_circle(rel_x, rel_y, r, value=0.9)

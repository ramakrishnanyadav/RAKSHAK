"""
Implementation of the Five Required Unstructured Indian Road Scenarios (SIH26037).
"""

import math
import random
from typing import Tuple, List
from .definition import ScenarioConfig, ScenarioBuilder
from engine.simulation.world import SimulationWorld, PerceptionConfig
from engine.simulation.obstacles import TrafficAgent
from engine.apath_log.schema import EgoState, RoadBoundary, StaticObstacle, WorldBounds


class VillageRoadScenario(ScenarioBuilder):
    """Scenario 1: Unmarked Village Road with potholes, oncoming truck, and unpaved shoulders."""

    def build(self, seed: int, split: str = "tune") -> Tuple[SimulationWorld, EgoState]:
        rng = random.Random(seed)
        road_half_w = 3.6  # Narrow unpaved road

        # Road boundaries (non-lane based)
        left_pts = [[x, road_half_w] for x in range(-10, 130, 10)]
        right_pts = [[x, -road_half_w] for x in range(-10, 130, 10)]

        bounds = WorldBounds(x_min=-10.0, x_max=120.0, y_min=-7.0, y_max=7.0)
        road_boundaries = [
            RoadBoundary(side="left", points=left_pts),
            RoadBoundary(side="right", points=right_pts),
        ]

        # Potholes and roadside dirt berms
        static_obs = [
            StaticObstacle(id="pothole_1", kind="pothole", x=22.0 + rng.uniform(-2, 2), y=0.8 + rng.uniform(-0.3, 0.3), length=1.2, width=1.0),
            StaticObstacle(id="pothole_2", kind="pothole", x=55.0 + rng.uniform(-3, 3), y=-0.9 + rng.uniform(-0.3, 0.3), length=1.4, width=1.1),
        ]

        world = SimulationWorld(bounds=bounds, road_boundaries=road_boundaries, static_obstacles=static_obs, seed=seed)

        # Oncoming truck encroaching center
        truck_x = 75.0 + rng.uniform(-5, 5)
        truck_y = 0.6 + rng.uniform(-0.2, 0.4)
        truck_v = 5.5 + rng.uniform(-0.5, 0.5)
        truck = TrafficAgent(
            id="oncoming_truck",
            class_name="truck",
            x=truck_x,
            y=truck_y,
            yaw=math.pi, # Heading west
            speed=truck_v,
            intent="straight",
            behavior_seed=seed + 1,
        )
        world.add_agent(truck)

        # Slow pedestrian walking along edge
        ped_x = 35.0 + rng.uniform(-4, 4)
        ped = TrafficAgent(
            id="edge_pedestrian",
            class_name="pedestrian",
            x=ped_x,
            y=-2.6 + rng.uniform(-0.3, 0.3),
            yaw=0.05,
            speed=1.1,
            intent="straight",
            behavior_seed=seed + 2,
        )
        world.add_agent(ped)

        ego = EgoState(
            x=0.0,
            y=0.0,
            yaw=0.0,
            v=self.config.ego_start_v,
            steering=0.0,
            acceleration=0.0,
            active_state="FOLLOW",
        )
        return world, ego


class UrbanIntersectionScenario(ScenarioBuilder):
    """Scenario 2: Busy Unsignalized Urban Intersection with cross-cutting traffic."""

    def build(self, seed: int, split: str = "tune") -> Tuple[SimulationWorld, EgoState]:
        rng = random.Random(seed)
        bounds = WorldBounds(x_min=-10.0, x_max=110.0, y_min=-15.0, y_max=15.0)

        # Wide intersection zone
        left_pts = [[-10, 4.5], [25, 4.5], [25, 14.0], [55, 14.0], [55, 4.5], [110, 4.5]]
        right_pts = [[-10, -4.5], [25, -4.5], [25, -14.0], [55, -14.0], [55, -4.5], [110, -4.5]]

        road_boundaries = [
            RoadBoundary(side="left", points=left_pts),
            RoadBoundary(side="right", points=right_pts),
        ]

        world = SimulationWorld(bounds=bounds, road_boundaries=road_boundaries, static_obstacles=[], seed=seed)

        # Auto-rickshaw cutting across junction
        rickshaw_x = 38.0 + rng.uniform(-3, 3)
        rickshaw_y = 12.0
        rickshaw = TrafficAgent(
            id="crossing_rickshaw",
            class_name="auto_rickshaw",
            x=rickshaw_x,
            y=rickshaw_y,
            yaw=-math.pi / 2.0 + rng.uniform(-0.15, 0.15),
            speed=4.5 + rng.uniform(-0.5, 0.5),
            intent="cross",
            behavior_seed=seed + 10,
        )
        world.add_agent(rickshaw)

        # Two-wheeler swerving through gap
        tw_x = 45.0 + rng.uniform(-3, 3)
        tw_y = -10.0
        two_wheeler = TrafficAgent(
            id="weaving_two_wheeler",
            class_name="two_wheeler",
            x=tw_x,
            y=tw_y,
            yaw=math.pi / 2.2 + rng.uniform(-0.1, 0.1),
            speed=6.0 + rng.uniform(-0.5, 0.8),
            intent="swerve",
            behavior_seed=seed + 11,
        )
        world.add_agent(two_wheeler)

        ego = EgoState(
            x=0.0,
            y=0.0,
            yaw=0.0,
            v=self.config.ego_start_v,
            steering=0.0,
            acceleration=0.0,
            active_state="FOLLOW",
        )
        return world, ego


class HighwayMergeScenario(ScenarioBuilder):
    """Scenario 3: Highway Merge with Slow Vehicles entering from unpaved ramp."""

    def build(self, seed: int, split: str = "tune") -> Tuple[SimulationWorld, EgoState]:
        rng = random.Random(seed)
        bounds = WorldBounds(x_min=-10.0, x_max=150.0, y_min=-12.0, y_max=8.0)

        # Highway corridor with merge ramp
        left_pts = [[-10, 5.0], [150, 5.0]]
        right_pts = [[-10, -5.0], [20, -5.0], [45, -11.0], [80, -5.0], [150, -5.0]]

        road_boundaries = [
            RoadBoundary(side="left", points=left_pts),
            RoadBoundary(side="right", points=right_pts),
        ]

        world = SimulationWorld(bounds=bounds, road_boundaries=road_boundaries, static_obstacles=[], seed=seed)

        # Slow tractor/rickshaw merging from ramp
        merge_x = 35.0 + rng.uniform(-4, 4)
        merge_y = -8.0 + rng.uniform(-0.5, 0.5)
        merge_speed = 3.5 + rng.uniform(-0.3, 0.6)
        merging_agent = TrafficAgent(
            id="slow_merging_auto",
            class_name="auto_rickshaw",
            x=merge_x,
            y=merge_y,
            yaw=0.25 + rng.uniform(-0.05, 0.05),
            speed=merge_speed,
            intent="merge",
            behavior_seed=seed + 20,
        )
        world.add_agent(merging_agent)

        ego = EgoState(
            x=0.0,
            y=0.0,
            yaw=0.0,
            v=9.5, # Cruising speed
            steering=0.0,
            acceleration=0.0,
            active_state="FOLLOW",
        )
        return world, ego


class DenseMarketScenario(ScenarioBuilder):
    """Scenario 4: Dense Market with roadside stalls and sudden occluded pedestrian emergence."""

    def build(self, seed: int, split: str = "tune") -> Tuple[SimulationWorld, EgoState]:
        rng = random.Random(seed)
        bounds = WorldBounds(x_min=-10.0, x_max=110.0, y_min=-8.0, y_max=8.0)

        left_pts = [[x, 4.0] for x in range(-10, 120, 10)]
        right_pts = [[x, -4.0] for x in range(-10, 120, 10)]

        road_boundaries = [
            RoadBoundary(side="left", points=left_pts),
            RoadBoundary(side="right", points=right_pts),
        ]

        # Roadside vendor stalls and parked auto-rickshaws acting as occluders
        stall_x = 32.0 + rng.uniform(-2, 2)
        static_obs = [
            StaticObstacle(id="fruit_stall_1", kind="stall", x=18.0, y=3.0, length=3.0, width=1.6),
            StaticObstacle(id="parked_auto", kind="parked_vehicle", x=stall_x, y=2.4, length=2.8, width=1.3),
            StaticObstacle(id="tea_stall_2", kind="stall", x=48.0, y=-2.8, length=3.5, width=1.5),
        ]

        # Perception config with occlusion enabled (Improvement #6 & #7)
        p_cfg = PerceptionConfig(range_m=50.0, fov_deg=140.0, occlusion_enabled=True)
        world = SimulationWorld(bounds=bounds, road_boundaries=road_boundaries, static_obstacles=static_obs, perception_config=p_cfg, seed=seed)

        # Occluded pedestrian stepping out from behind parked auto
        ped_x = stall_x + 1.2
        ped_y = 3.2 # Behind parked auto
        occluded_ped = TrafficAgent(
            id="occluded_pedestrian",
            class_name="pedestrian",
            x=ped_x,
            y=ped_y,
            yaw=-math.pi / 2.0, # Crossing into street
            speed=1.3 + rng.uniform(-0.2, 0.3),
            intent="cross",
            behavior_seed=seed + 30,
        )
        world.add_agent(occluded_ped)

        # Slow handcart on right side
        handcart = TrafficAgent(
            id="market_handcart",
            class_name="handcart",
            x=55.0 + rng.uniform(-3, 3),
            y=-1.8,
            yaw=0.0,
            speed=0.9,
            intent="straight",
            behavior_seed=seed + 31,
        )
        world.add_agent(handcart)

        ego = EgoState(
            x=0.0,
            y=0.0,
            yaw=0.0,
            v=6.0,
            steering=0.0,
            acceleration=0.0,
            active_state="FOLLOW",
        )
        return world, ego


class CattleCrossingScenario(ScenarioBuilder):
    """Scenario 5: Sudden Cattle Crossing entering road and stopping erratically mid-lane."""

    def build(self, seed: int, split: str = "tune") -> Tuple[SimulationWorld, EgoState]:
        rng = random.Random(seed)
        bounds = WorldBounds(x_min=-10.0, x_max=120.0, y_min=-8.0, y_max=8.0)

        left_pts = [[x, 4.8] for x in range(-10, 130, 10)]
        right_pts = [[x, -4.8] for x in range(-10, 130, 10)]

        road_boundaries = [
            RoadBoundary(side="left", points=left_pts),
            RoadBoundary(side="right", points=right_pts),
        ]

        world = SimulationWorld(bounds=bounds, road_boundaries=road_boundaries, static_obstacles=[], seed=seed)

        # Cattle starts on shoulder and steps into corridor, stopping mid-lane
        cow_x = 28.0 + rng.uniform(-2.5, 3.5)
        cow_y = -3.2 + rng.uniform(-0.3, 0.3)
        cow_speed = 1.1 + rng.uniform(-0.2, 0.3)
        cattle = TrafficAgent(
            id="crossing_cattle",
            class_name="cattle",
            x=cow_x,
            y=cow_y,
            yaw=math.pi / 2.3 + rng.uniform(-0.15, 0.15), # Crossing towards center
            speed=cow_speed,
            intent="stop_midroad",
            behavior_seed=seed + 40,
        )
        world.add_agent(cattle)

        ego = EgoState(
            x=0.0,
            y=0.0,
            yaw=0.0,
            v=self.config.ego_start_v,
            steering=0.0,
            acceleration=0.0,
            active_state="FOLLOW",
        )
        return world, ego

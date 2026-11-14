"""
Scenario Registry and Dataset Split Protocols.
"""

from typing import Dict, List, Tuple, Optional, Any
from .definition import ScenarioConfig, ScenarioBuilder
from .scenarios_impl import (
    VillageRoadScenario,
    UrbanIntersectionScenario,
    HighwayMergeScenario,
    DenseMarketScenario,
    CattleCrossingScenario,
    PotholeDamagedRoadScenario,
    PedestrianCrossingScenario,
    DenseMixedTrafficScenario,
    MotorcycleCutInScenario,
    HighwaySuddenBrakingScenario,
    RoadworksObstructionScenario,
    UncontrolledIntersectionScenario,
)
from engine.simulation.world import SimulationWorld
from engine.apath_log.schema import EgoState


SCENARIOS_CATALOG: Dict[str, ScenarioConfig] = {
    # 8 Canonical Indian Road Scenario Families (Stage 4G.6)
    "SCENARIO_01_POTHOLE_DAMAGED_ROAD": ScenarioConfig(
        id="SCENARIO_01_POTHOLE_DAMAGED_ROAD",
        name="01. Pothole & Damaged Road",
        description="Narrow unmarked asphalt with road-surface potholes, degraded asphalt, and oncoming commercial traffic.",
        target_distance_m=80.0,
        timeout_s=16.0,
        nominal_speed_m_s=7.0,
        ego_start_v=6.5,
        params={"hazard_type": "road_surface_potholes", "pothole_count": 3},
    ),
    "SCENARIO_02_PEDESTRIAN_CROSSING": ScenarioConfig(
        id="SCENARIO_02_PEDESTRIAN_CROSSING",
        name="02. Child / Pedestrian Crossing",
        description="Indian urban residential street with parked vehicles; sudden occluded pedestrian stepping into path.",
        target_distance_m=70.0,
        timeout_s=14.0,
        nominal_speed_m_s=6.5,
        ego_start_v=6.5,
        params={"hazard_type": "dynamic_pedestrian", "occlusion": True, "crossing_speed": 1.35},
    ),
    "SCENARIO_03_DENSE_MIXED_TRAFFIC": ScenarioConfig(
        id="SCENARIO_03_DENSE_MIXED_TRAFFIC",
        name="03. Dense Mixed Indian Traffic",
        description="Narrow urban arterial with heterogeneous traffic: cars, auto-rickshaws, and swarming two-wheelers in tight gaps.",
        target_distance_m=75.0,
        timeout_s=15.0,
        nominal_speed_m_s=6.0,
        ego_start_v=6.0,
        params={"hazard_type": "mixed_traffic", "actor_mix": ["auto_rickshaw", "two_wheeler", "car"]},
    ),
    "SCENARIO_04_MOTORCYCLE_CUT_IN": ScenarioConfig(
        id="SCENARIO_04_MOTORCYCLE_CUT_IN",
        name="04. Motorcycle Cut-In",
        description="Multi-lane urban corridor with adjacent two-wheeler executing sharp cut-in ahead of ego, collapsing headway.",
        target_distance_m=80.0,
        timeout_s=15.0,
        nominal_speed_m_s=7.5,
        ego_start_v=7.0,
        params={"hazard_type": "cut_in", "cut_in_time_s": 1.0},
    ),
    "SCENARIO_05_UNCONTROLLED_INTERSECTION": ScenarioConfig(
        id="SCENARIO_05_UNCONTROLLED_INTERSECTION",
        name="05. Uncontrolled Intersection",
        description="Complex 4-arm Indian road junction without traffic signals, featuring cross-cutting auto-rickshaws and two-wheelers.",
        target_distance_m=75.0,
        timeout_s=15.0,
        nominal_speed_m_s=7.0,
        ego_start_v=6.0,
        params={"hazard_type": "cross_traffic", "intersection_arms": 4},
    ),
    "SCENARIO_06_HIGHWAY_SUDDEN_BRAKING": ScenarioConfig(
        id="SCENARIO_06_HIGHWAY_SUDDEN_BRAKING",
        name="06. Highway Sudden Braking",
        description="High-speed multi-lane corridor where leading vehicle performs sudden emergency deceleration to a halt.",
        target_distance_m=100.0,
        timeout_s=16.0,
        nominal_speed_m_s=12.0,
        ego_start_v=12.0,
        params={"hazard_type": "sudden_brake", "lead_decel": -4.2},
    ),
    "SCENARIO_07_ROADWORKS_OBSTRUCTION": ScenarioConfig(
        id="SCENARIO_07_ROADWORKS_OBSTRUCTION",
        name="07. Roadworks & Lane Obstruction",
        description="Partially blocked roadway with construction barricades, excavation trenches, and constrained single-lane bypass.",
        target_distance_m=80.0,
        timeout_s=16.0,
        nominal_speed_m_s=6.0,
        ego_start_v=6.0,
        params={"hazard_type": "static_barricades", "bypass_width_m": 3.2},
    ),
    "SCENARIO_08_CATTLE_CROSSING": ScenarioConfig(
        id="SCENARIO_08_CATTLE_CROSSING",
        name="08. Sudden Cattle Crossing",
        description="Rural road with bovine animal stepping into travel corridor and halting mid-lane, requiring detour or safe stop.",
        target_distance_m=80.0,
        timeout_s=16.0,
        nominal_speed_m_s=7.5,
        ego_start_v=7.0,
        params={"hazard_type": "bovine_livestock", "halt_probability": 0.6},
    ),
    # Legacy Catalog Aliases for Backward Compatibility
    "SCENARIO_1_VILLAGE_ROAD": ScenarioConfig(
        id="SCENARIO_1_VILLAGE_ROAD",
        name="Unmarked Village Road",
        description="Narrow unmarked rural asphalt with potholes, unpaved shoulders, and oncoming heavy vehicle.",
        target_distance_m=80.0,
        timeout_s=16.0,
        nominal_speed_m_s=7.0,
        ego_start_v=6.5,
        params={
            "agent_count_range": [2, 4],
            "speed_range_m_s": [4.5, 7.5],
            "spawn_distance_range_m": [30.0, 85.0],
            "occlusion_ratio_range": [0.0, 0.25],
            "road_width_range_m": [6.4, 7.6],
        },
    ),
    "SCENARIO_2_URBAN_INTERSECTION": ScenarioConfig(
        id="SCENARIO_2_URBAN_INTERSECTION",
        name="Busy Unsignalized Urban Intersection",
        description="Complex intersection without traffic signals; cross-cutting auto-rickshaws and swarming two-wheelers.",
        target_distance_m=75.0,
        timeout_s=15.0,
        nominal_speed_m_s=7.0,
        ego_start_v=6.0,
        params={
            "agent_count_range": [3, 6],
            "speed_range_m_s": [3.5, 8.0],
            "spawn_distance_range_m": [25.0, 60.0],
            "occlusion_ratio_range": [0.15, 0.45],
            "intersection_arms": 4,
        },
    ),
    "SCENARIO_3_HIGHWAY_MERGE": ScenarioConfig(
        id="SCENARIO_3_HIGHWAY_MERGE",
        name="Highway Merge with Slow Vehicles",
        description="High-speed corridor with slow auto-rickshaws entering from unpaved ramps at acute angles.",
        target_distance_m=100.0,
        timeout_s=16.0,
        nominal_speed_m_s=11.0,
        ego_start_v=9.5,
        params={
            "agent_count_range": [2, 4],
            "speed_range_m_s": [3.0, 12.0],
            "spawn_distance_range_m": [25.0, 90.0],
            "merge_angle_deg_range": [15.0, 35.0],
        },
    ),
    "SCENARIO_4_DENSE_MARKET": ScenarioConfig(
        id="SCENARIO_4_DENSE_MARKET",
        name="Dense Market with Occluded Emergence",
        description="Vendor stalls and parked vehicles with sudden pedestrian stepping out from behind occlusion.",
        target_distance_m=75.0,
        timeout_s=15.0,
        nominal_speed_m_s=6.0,
        ego_start_v=5.5,
        params={
            "agent_count_range": [3, 5],
            "speed_range_m_s": [0.8, 2.5],
            "spawn_distance_range_m": [15.0, 55.0],
            "occlusion_ratio_range": [0.60, 0.95],
            "stall_density_per_100m": [8, 14],
        },
    ),
    "SCENARIO_5_CATTLE_CROSSING": ScenarioConfig(
        id="SCENARIO_5_CATTLE_CROSSING",
        name="Sudden Cattle Crossing",
        description="Cattle entering the roadway and halting mid-lane, requiring non-lane lateral avoidance or safe braking.",
        target_distance_m=80.0,
        timeout_s=16.0,
        nominal_speed_m_s=7.5,
        ego_start_v=7.0,
        params={
            "agent_count_range": [1, 4],
            "speed_range_m_s": [0.5, 1.8],
            "spawn_distance_range_m": [22.0, 45.0],
            "halt_probability": [0.35, 0.65],
        },
    ),
}

SCENARIO_BUILDERS = {
    # 8 Canonical
    "SCENARIO_01_POTHOLE_DAMAGED_ROAD": PotholeDamagedRoadScenario,
    "SCENARIO_02_PEDESTRIAN_CROSSING": PedestrianCrossingScenario,
    "SCENARIO_03_DENSE_MIXED_TRAFFIC": DenseMixedTrafficScenario,
    "SCENARIO_04_MOTORCYCLE_CUT_IN": MotorcycleCutInScenario,
    "SCENARIO_05_UNCONTROLLED_INTERSECTION": UncontrolledIntersectionScenario,
    "SCENARIO_06_HIGHWAY_SUDDEN_BRAKING": HighwaySuddenBrakingScenario,
    "SCENARIO_07_ROADWORKS_OBSTRUCTION": RoadworksObstructionScenario,
    "SCENARIO_08_CATTLE_CROSSING": CattleCrossingScenario,
    # Legacy
    "SCENARIO_1_VILLAGE_ROAD": VillageRoadScenario,
    "SCENARIO_2_URBAN_INTERSECTION": UrbanIntersectionScenario,
    "SCENARIO_3_HIGHWAY_MERGE": HighwayMergeScenario,
    "SCENARIO_4_DENSE_MARKET": DenseMarketScenario,
    "SCENARIO_5_CATTLE_CROSSING": CattleCrossingScenario,
}

SCENARIO_ALIASES = {
    "SCENARIO_01": "SCENARIO_01_POTHOLE_DAMAGED_ROAD",
    "SCENARIO_02": "SCENARIO_02_PEDESTRIAN_CROSSING",
    "SCENARIO_03": "SCENARIO_03_DENSE_MIXED_TRAFFIC",
    "SCENARIO_04": "SCENARIO_04_MOTORCYCLE_CUT_IN",
    "SCENARIO_05": "SCENARIO_05_UNCONTROLLED_INTERSECTION",
    "SCENARIO_06": "SCENARIO_06_HIGHWAY_SUDDEN_BRAKING",
    "SCENARIO_07": "SCENARIO_07_ROADWORKS_OBSTRUCTION",
    "SCENARIO_08": "SCENARIO_08_CATTLE_CROSSING",
    "SCENARIO_1": "SCENARIO_1_VILLAGE_ROAD",
    "SCENARIO_2": "SCENARIO_2_URBAN_INTERSECTION",
    "SCENARIO_3": "SCENARIO_3_HIGHWAY_MERGE",
    "SCENARIO_4": "SCENARIO_4_DENSE_MARKET",
    "SCENARIO_5": "SCENARIO_5_CATTLE_CROSSING",
}


def get_seeds_for_split(split: str) -> List[int]:
    """
    Standard seed protocol as defined in docs/SAP.md (G2-approved five-way disjoint allocation):
    - tune: 1000 - 1009 (10 seeds)
    - calibration / calib: 1500 - 1539 (40 seeds)
    - val_a: 2000 - 2004 (5 seeds, baseline selection B*)
    - val_b: 2005 - 2009 (5 seeds, P3 tuning & lateral creep)
    - validate: 2000 - 2009 (combined 10 seeds, val_a + val_b)
    - frozen_test: 3000 - 3029 (30 seeds per variant, G5 requirement)
    """
    if split == "tune":
        return list(range(1000, 1010))
    elif split in ("calibration", "calib"):
        return list(range(1500, 1540))
    elif split == "val_a":
        return list(range(2000, 2005))
    elif split == "val_b":
        return list(range(2005, 2010))
    elif split == "validate":
        return list(range(2000, 2010))
    elif split == "frozen_test":
        return list(range(3000, 3030))
    else:
        raise ValueError(
            f"Unknown split: {split}. Allowed: 'tune', 'calibration', 'calib', 'val_a', 'val_b', 'validate', 'frozen_test'"
        )


def build_scenario(
    scenario_id: str,
    seed: int,
    split: str = "tune",
    custom_params: Optional[Dict[str, Any]] = None,
) -> Tuple[SimulationWorld, EgoState, ScenarioConfig]:
    canonical_id = SCENARIO_ALIASES.get(scenario_id, scenario_id)
    if canonical_id not in SCENARIOS_CATALOG:
        raise ValueError(f"Unknown scenario ID: {scenario_id}. Choose from: {list(SCENARIOS_CATALOG.keys())}")
    cfg = SCENARIOS_CATALOG[canonical_id]
    if custom_params:
        # Create a modified config copy
        cfg = ScenarioConfig(
            id=cfg.id,
            name=cfg.name,
            description=cfg.description,
            target_distance_m=float(custom_params.get("target_distance_m", cfg.target_distance_m)),
            timeout_s=float(custom_params.get("timeout_s", cfg.timeout_s)),
            nominal_speed_m_s=float(custom_params.get("nominal_speed_m_s", cfg.nominal_speed_m_s)),
            ego_start_v=float(custom_params.get("ego_start_v", cfg.ego_start_v)),
            params={**cfg.params, **custom_params},
        )
    builder_cls = SCENARIO_BUILDERS[canonical_id]
    builder = builder_cls(cfg)
    world, ego = builder.build(seed, split)
    return world, ego, cfg

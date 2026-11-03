from .base import BasePlanner, PlannerStepResult
from .b0_constant import B0ConstantPlanner
from .b1_dwa_vo import B1DWAVOPlanner
from .b2_hybrid_astar import B2HybridAStarPlanner
from .p1_predictive import P1PredictivePlanner
from .p2_risk_aware import P2RiskAwarePlanner
from .p3_adaptive import P3AdaptivePlanner
from .p2_ml import P2MLPlanner
from .p3_ml import P3MLPlanner


def create_planner(planner_id: str, params: dict = None) -> BasePlanner:
    """Factory to instantiate any of the planners: B0, B1, B2, P1, P2, P3, P2-ML, P3-ML."""
    planners = {
        "B0": B0ConstantPlanner,
        "B1": B1DWAVOPlanner,
        "B2": B2HybridAStarPlanner,
        "P1": P1PredictivePlanner,
        "P2": P2RiskAwarePlanner,
        "P3": P3AdaptivePlanner,
        "P2-ML": P2MLPlanner,
        "P2_ML": P2MLPlanner,
        "P3-ML": P3MLPlanner,
        "P3_ML": P3MLPlanner,
    }
    if planner_id not in planners:
        raise ValueError(f"Unknown planner ID '{planner_id}'. Must be one of: {list(planners.keys())}")
    return planners[planner_id](params)


__all__ = [
    "BasePlanner",
    "PlannerStepResult",
    "B0ConstantPlanner",
    "B1DWAVOPlanner",
    "B2HybridAStarPlanner",
    "P1PredictivePlanner",
    "P2RiskAwarePlanner",
    "P3AdaptivePlanner",
    "P2MLPlanner",
    "P3MLPlanner",
    "create_planner",
]

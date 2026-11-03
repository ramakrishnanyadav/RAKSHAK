"""
Benchmarks & Aggregated Statistics Router.
Aggregates ablation matrices with 95% bootstrap confidence intervals (G5)
and computes pairwise planner comparison deltas.
"""

from typing import List, Optional
from collections import defaultdict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import RunRecord
from backend.app.schemas import (
    ScenarioBenchmarkSummary,
    PlannerBenchmarkRow,
    MetricConfidenceInterval,
    BenchmarkCompareResponse,
)
from backend.app.core.auth_layer import (
    require_permission,
    Action,
    AuthenticatedUser,
)
from engine.metrics import compute_bootstrap_confidence_interval
from engine.scenarios.registry import SCENARIOS_CATALOG

router = APIRouter(prefix="/api/benchmarks", tags=["benchmarks"])

PLANNER_DISPLAY_NAMES = {
    "B0": "B0: Constant Speed / Centerline",
    "B1": "B1: DWA + Velocity Obstacles",
    "B2": "B2: Kinematic Hybrid A*",
    "P1": "P1: Nominal Predictive (Fixed Clock)",
    "P2": "P2: Risk-Aware (Conformal + Risk)",
    "P3": "P3: Risk-Adaptive (Dynamic Trigger + MRM)",
}


@router.get("", response_model=List[ScenarioBenchmarkSummary])
@router.get("/summary", response_model=List[ScenarioBenchmarkSummary])
def get_benchmarks(
    scenario_id: Optional[str] = None,
    split: str = "tune",
    user: AuthenticatedUser = Depends(require_permission(Action.READ_BENCHMARK)),
    db: Session = Depends(get_db),
):
    """Computes ablation benchmark tables with 95% bootstrap confidence intervals."""
    query = (
        db.query(RunRecord)
        .filter(RunRecord.status == "completed", RunRecord.split == split)
    )
    if scenario_id:
        query = query.filter(RunRecord.scenario_id == scenario_id)

    runs = query.all()

    # Group runs by scenario_id -> planner_id
    grouped = defaultdict(lambda: defaultdict(list))
    for r in runs:
        grouped[r.scenario_id][r.planner_id].append(r)

    summaries = []
    target_scenarios = [scenario_id] if scenario_id else list(SCENARIOS_CATALOG.keys())

    for sc_id in target_scenarios:
        if sc_id not in SCENARIOS_CATALOG:
            continue
        sc_cfg = SCENARIOS_CATALOG[sc_id]
        planner_rows = []

        for p_id in ["B0", "B1", "B2", "P1", "P2", "P3"]:
            p_runs = grouped[sc_id].get(p_id, [])
            if not p_runs:
                planner_rows.append(
                    PlannerBenchmarkRow(
                        planner_id=p_id,
                        planner_name=PLANNER_DISPLAY_NAMES.get(p_id, p_id),
                        run_count=0,
                        collision_rate=MetricConfidenceInterval(mean=0.0, ci_lower=0.0, ci_upper=0.0),
                        min_clearance=MetricConfidenceInterval(mean=0.0, ci_lower=0.0, ci_upper=0.0),
                        mean_jerk=MetricConfidenceInterval(mean=0.0, ci_lower=0.0, ci_upper=0.0),
                        p95_latency_ms=MetricConfidenceInterval(mean=0.0, ci_lower=0.0, ci_upper=0.0),
                        mean_speed=MetricConfidenceInterval(mean=0.0, ci_lower=0.0, ci_upper=0.0),
                    )
                )
                continue

            collisions = [1.0 if r.collision_occurred else 0.0 for r in p_runs]
            clearances = [r.min_clearance_m for r in p_runs]
            jerks = [r.max_jerk_m_s3 for r in p_runs]
            latencies = [r.p95_latency_ms for r in p_runs]
            speeds = [r.mean_speed_m_s for r in p_runs]

            c_mean, c_l, c_u = compute_bootstrap_confidence_interval(collisions)
            cl_mean, cl_l, cl_u = compute_bootstrap_confidence_interval(clearances)
            j_mean, j_l, j_u = compute_bootstrap_confidence_interval(jerks)
            lat_mean, lat_l, lat_u = compute_bootstrap_confidence_interval(latencies)
            sp_mean, sp_l, sp_u = compute_bootstrap_confidence_interval(speeds)

            planner_rows.append(
                PlannerBenchmarkRow(
                    planner_id=p_id,
                    planner_name=PLANNER_DISPLAY_NAMES.get(p_id, p_id),
                    run_count=len(p_runs),
                    collision_rate=MetricConfidenceInterval(mean=c_mean, ci_lower=c_l, ci_upper=c_u),
                    min_clearance=MetricConfidenceInterval(mean=cl_mean, ci_lower=cl_l, ci_upper=cl_u),
                    mean_jerk=MetricConfidenceInterval(mean=j_mean, ci_lower=j_l, ci_upper=j_u),
                    p95_latency_ms=MetricConfidenceInterval(mean=lat_mean, ci_lower=lat_l, ci_upper=lat_u),
                    mean_speed=MetricConfidenceInterval(mean=sp_mean, ci_lower=sp_l, ci_upper=sp_u),
                )
            )

        summaries.append(
            ScenarioBenchmarkSummary(
                scenario_id=sc_id,
                scenario_name=sc_cfg.name,
                split=split,
                planners=planner_rows,
            )
        )

    return summaries


@router.get("/compare", response_model=BenchmarkCompareResponse)
def compare_planners(
    scenario_id: str = "SCENARIO_5_CATTLE_CROSSING",
    split: str = "tune",
    baseline: str = "B1",
    candidate: str = "P3",
    user: AuthenticatedUser = Depends(require_permission(Action.READ_BENCHMARK)),
    db: Session = Depends(get_db),
):
    """Pairwise statistical comparison between baseline and proposed candidate planners."""
    base_runs = (
        db.query(RunRecord)
        .filter(
            RunRecord.scenario_id == scenario_id,
            RunRecord.split == split,
            RunRecord.planner_id == baseline,
            RunRecord.status == "completed",
        )
        .all()
    )
    cand_runs = (
        db.query(RunRecord)
        .filter(
            RunRecord.scenario_id == scenario_id,
            RunRecord.split == split,
            RunRecord.planner_id == candidate,
            RunRecord.status == "completed",
        )
        .all()
    )

    base_col = sum(1 for r in base_runs if r.collision_occurred) / max(1, len(base_runs))
    cand_col = sum(1 for r in cand_runs if r.collision_occurred) / max(1, len(cand_runs))

    base_clear = sum(r.min_clearance_m for r in base_runs) / max(1, len(base_runs))
    cand_clear = sum(r.min_clearance_m for r in cand_runs) / max(1, len(cand_runs))

    base_jerk = sum(r.max_jerk_m_s3 for r in base_runs) / max(1, len(base_runs))
    cand_jerk = sum(r.max_jerk_m_s3 for r in cand_runs) / max(1, len(cand_runs))

    base_lat = sum(r.p95_latency_ms for r in base_runs) / max(1, len(base_runs))
    cand_lat = sum(r.p95_latency_ms for r in cand_runs) / max(1, len(cand_runs))

    return BenchmarkCompareResponse(
        baseline_planner=baseline,
        candidate_planner=candidate,
        scenario_id=scenario_id,
        split=split,
        collision_rate_diff_pct=round((base_col - cand_col) * 100.0, 2),
        clearance_improvement_m=round(cand_clear - base_clear, 2),
        jerk_reduction_pct=round(((base_jerk - cand_jerk) / max(0.01, base_jerk)) * 100.0, 2),
        p95_latency_ratio=round(cand_lat / max(0.01, base_lat), 2),
    )

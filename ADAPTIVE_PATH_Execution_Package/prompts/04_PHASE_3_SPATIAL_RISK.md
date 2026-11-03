# 04 — PHASE 3: GENUINE SPATIAL RISK FIELD
Read standing rules, PROGRESS, approved `RISK_DEFINITION.md` and Phase 2 evidence.

## Objective
Replace scalar-only/agent-centred visual approximation with a real spatial risk grid consistent with the risk used by the planner.

## Grid contract
Define actual coordinate frame (ego-centred or world-fixed), origin, resolution, dimensions, timestamp and encoding. Example only:
{
  "resolution_m": 0.5,
  "origin": [x0, y0],
  "width": W,
  "height": H,
  "frame": "ego_centered",
  "risk_values": "compressed_payload"
}

## Requirements
1. Implement exactly the approved mathematical `RISK_DEFINITION.md`.
2. Include road boundaries and predicted dynamic-agent distributions.
3. Include uncertainty only as defined in the approved risk model.
4. Distinguish probability, severity and dimensionless score.
5. The planner and renderer must use the same underlying risk grid/version.
6. Add planner-risk consistency tests.
7. Define temporal sampling/decimation.
8. Define compression and per-run storage budget.
9. Validate coordinate transforms and grid indexing.
10. Log metadata needed to reconstruct the grid.
11. Preserve old scalar logs and render them as scalar risk, not a fake heatmap.
12. Do not rewrite historical artifacts.

## Frontend
Render actual heatmap, selected trajectory, agents, timestamp and time scrubber. Use documented colour scale and legend. Ensure heatmap values are not presented as calibrated collision probabilities unless they are.

## Acceptance
- Numerical tests for grid construction.
- Planner/render consistency test.
- Compression round-trip test.
- Coordinate-frame tests.
- Replay test with v1 scalar data and v2 grid data.
- Log size measured against budget.
- No agent-centred gradient masquerading as actual spatial field.

Deliver implementation, tests, schema docs and performance/storage report. Update PROGRESS. Stop before Phase 4 unless instructed.

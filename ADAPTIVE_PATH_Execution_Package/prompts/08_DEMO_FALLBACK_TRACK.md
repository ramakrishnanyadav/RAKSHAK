# 08 — TIME-BOXED DEMO-FALLBACK TRACK
Read standing rules and PROGRESS. This track may begin only after G1 approval. It may run in parallel with Phase 1 if branch/worktree separation and shared-file coordination are safe.

## Purpose
Protect the 15 November 2026 demonstration deadline without weakening research governance.

## Scope
Build the smallest genuine and understandable demonstration from existing engine capabilities.

Preferred delivery:
1. Launch the actual Python simulation for the flagship cattle-crossing scenario.
2. Display actual vehicle position and surrounding agents.
3. Display actual prediction output if available.
4. Display scalar risk only if that is the available output; label it `SCALAR RISK`.
5. Show actual selected trajectory and decision events where available.
6. Show provenance badge and run ID.
7. Use authoritative metrics only.
8. If live simulation is unstable, replay a validated recorded run labelled `RECORDED EXPERIMENT`.
9. If no validated run exists, sample data must be labelled `SAMPLE DATA` and cannot support research claims.

## Do not
- Fake a spatial heatmap from scalar risk.
- Invent prediction paths or vehicle motion.
- Use fallback metrics.
- call replay a live run.
- weaken conformal, SAP, frozen-test or ITT rules.
- modify planner algorithms or thresholds without Phase 1 approval.
- overwrite existing run artifacts.
- make a demo cancellation count as an SAP experiment failure.

## Minimal screen
- Large top-down road view.
- Vehicle, agents, road boundaries.
- Scenario and planner.
- Provenance badge.
- Speed and current decision if measured.
- One-sentence explanation grounded in actual records.
- Start / replay / pause / reset.
- Clear failed state if engine fails.

## Acceptance
- Real engine run or honest validated replay.
- Actual engine state drives rendered vehicle.
- Run ID and provenance visible.
- No sample fallback on engine error.
- Metrics trace to authoritative module or display n/a.
- 1280x720 usable.
- Basic Playwright smoke test.
- All omitted Phase 4 features listed.

## Time box
At G1, propose a maximum time allocation based on actual code state. Target a usable fallback demo by 10 November, leaving time for stabilization and rehearsal. If this conflicts with research correctness work, preserve Phase 1 and deliver the replay-based fallback.

Update `docs/PROGRESS.md` and document exactly what was cut, why, and what remains.

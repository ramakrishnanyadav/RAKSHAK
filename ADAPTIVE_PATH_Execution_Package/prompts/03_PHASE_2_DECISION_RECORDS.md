# 03 — PHASE 2: STRUCTURED DECISION RECORDS
Read standing rules and `docs/PROGRESS.md`. Confirm Phase 1 exit evidence and authorization.

## Objective
Make every important vehicle decision traceable to engine state and explainable to a human.

## Scope
Add additive `apath-log/v2` records while preserving v1 read compatibility.

Record every:
- Replanning event.
- MRM activation.
- MRM recovery.
- Planner mode change.
- Emergency stop.
- Decision timeout.

Example only (values must be engine-produced):
{
  "event": "REPLAN_TRIGGERED",
  "t": 0.7,
  "reason": "CONFORMAL_VIOLATION",
  "hazard_id": "agent_001",
  "hazard_class": "cattle",
  "risk_before": 0.31,
  "risk_after": 0.68,
  "action": "ALTERNATIVE_TRAJECTORY",
  "recovery_status": "PENDING"
}

## Requirements
1. Define schema and required/optional fields.
2. Include run ID, sequence, timestamp and relevant planner state.
3. Never template or fabricate event values.
4. Preserve unknown optional fields in telemetry round-trip.
5. Keep v1 logs readable through read-time adapter.
6. Missing fields remain null.
7. Add a pure explanation function mapping records to plain language.
8. Technical fields remain inspectable in Research Mode.
9. Test every reason/action combination, missing fields and unknown values.
10. Ensure event ordering and timestamps are deterministic where supported.

Example explanation:
"The predicted movement of the cattle overlaps the planned vehicle route. The system detected increasing risk and initiated an early replanning operation."

The explanation must only assert facts present in the record. If the record does not establish a cause, use cautious wording.

## Deliverables
- Decision record schema.
- Engine emission code.
- v2 contract additions.
- Plain-language explanation function.
- Unit and integration tests.
- Documentation and decision log.

## Acceptance
- Every relevant event is emitted from actual engine decisions.
- Records survive serialization/replay.
- v1 compatibility remains intact.
- Explanations are grounded in records.
- No fabricated values.

Update `docs/PROGRESS.md` and provide per-phase report. Stop before Phase 3 unless instructed.

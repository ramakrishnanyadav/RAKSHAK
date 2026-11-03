# ADAPTIVE-PATH — Architecture & Research Decisions Record (ADR/Decisions)

> This document tracks all authoritative engineering, research governance, and methodology decisions across the ADAPTIVE-PATH platform.

---

## Decision Index

| ID | Date | Decision | Scope | Approved By / Gate |
| :--- | :--- | :--- | :--- | :--- |
| **DEC-001** | 2026-11-03 | Repository safety baseline committed as `baseline-v0` on branch `research/phase-0-audit`. | Source Control | Gate G1 Pre-condition |
| **DEC-002** | 2026-11-03 | Confirmation of Findings F1–F7 without in-place modification in Phase 0. | Research Governance | Phase 0 Directive |
| **DEC-003** | 2026-11-03 | Formal G1 Approval received; authorization of Workstream A (Phase 1) and Workstream B (Demo Fallback). | Governance / Release | User G1 Approval |
| **DEC-004** | 2026-11-03 | **Critical Ordering Rule**: F4 Conformal Calibration Integration MUST precede final F3 tuning and validation. | Research Methodology | Standing Rules / Phase 1 |
| **DEC-005** | 2026-11-03 | Separation of Run Classes: `run_class=experiment` (strictly entering ITT denominator) and `run_class=interactive` (demos/manual, excluded from research claims). | Experimental Design | Phase 1 / SAP |
| **DEC-006** | 2026-11-03 | Parallel Demo Fallback Track Governance: UI demo runs in parallel with Phase 1 under strict branch coordination; cannot use unapproved metric definitions or fabricated numbers. | Demo Architecture | Workstream B Directive |

---

### DEC-004: Critical Ordering Rule for Research Correctness

- **Context**: Finding F4 established that the current prediction conformal uncertainty envelope uses an analytical power law rather than empirical quantiles. Finding F3 established that P3 currently suffers a 0% goal completion rate in frozen tests due to over-conservative stopping.
- **Decision**: Calibration integration (F4) must be implemented and verified *before* diagnosing and solving P3's goal-completion deadlocks (F3). 
- **Rationale**: Any alteration to trajectory uncertainty envelopes directly alters the spatial risk field $R(x, y)$, replanning trigger rates, and candidate trajectory evaluations. Tuning P3 before calibration would optimize parameters against obsolete uncertainty boundaries and invalidate research claims.
- **Rule**: Calibration quantiles fitted on calibration episodes $\to$ wired to predictor $\to$ P3 parameters tuned on validation split only $\to$ validation confirmed.

### DEC-005: Separation of Run Classes & Denominator Integrity

- **Decision**: Every simulation run log must explicitly declare `run_class`:
  1. `experiment`: Initiated under an active SAP-registered experimental protocol. All launched experiment runs enter the Intention-To-Treat (ITT) primary denominator. Timeouts, controller crashes, livelocks, and runner aborts count as non-success.
  2. `interactive`: Ad-hoc UI exploration, user-cancelled live demonstrations, and sample replays. Explicitly excluded from research statistical aggregates.
- **Rationale**: Prevents cherry-picking and ensures 100% auditable research integrity.

### DEC-006: Parallel Demo Fallback Track Coordination

- **Decision**: Workstream B (Demo Fallback) develops a clean, reliable, air-gapped demo view focused on the flagship cattle-crossing scenario.
- **Coordination Guardrails**:
  - Demo code must read from authoritative log structures.
  - The demo displays `SCALAR RISK` until Phase 3 delivers spatial grid capabilities.
  - Display explicit `LIVE SIMULATION` or `RECORDED EXPERIMENT` provenance badges.
  - No fallback fake metric constants permitted under any circumstances.

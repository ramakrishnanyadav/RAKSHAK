# ADAPTIVE-PATH — Split Execution Prompt Package

**Coding environment:** Google Antigravity  
**Deadline:** 15 November 2026  
**Planning window:** 3–15 November 2026  
**Priority:** Balanced — credible working demonstration + scientifically defensible research  
**Project:** SIH26037 — Risk-Aware Predictive Path Planning for Unstructured Indian Roads

## How to use this package

1. Open the existing ADAPTIVE-PATH repository in Antigravity.
2. Put `prompts/00_STANDING_ENGINEERING_RULES.md` in the agent's persistent project instructions/context if Antigravity supports it. Otherwise paste it at the start of every new agent session.
3. Start with `prompts/01_PHASE_0_AUDIT.md` only.
4. The agent must stop at G1 and wait for your explicit approval.
5. After approval, provide the next phase prompt. Do not paste all phase prompts as permission to execute them automatically.
6. Keep `docs/PROGRESS.md` updated at every session boundary.
7. Use `prompts/08_DEMO_FALLBACK_TRACK.md` only after G1. It may run in parallel with Phase 1 under the constraints stated there.
8. Never run the new frozen-test evaluation without G3 approval.

## Deadline plan

The deadline is 15 November 2026. The plan assumes 12 calendar days from 3 November. The agent must validate the actual state and effort at G1 and propose a realistic day-by-day schedule.

| Date | Target | Gate / output |
|---|---|---|
| Nov 3 | Repository safety + Phase 0 audit begins | Baseline branch/tag, audit evidence |
| Nov 4 | Complete Phase 0 | G1 approval |
| Nov 5 | Definitions + SAP draft | G2 approval |
| Nov 6–7 | Phase 1 research correctness; Demo fallback may begin in parallel after G1 | Correct metrics, calibration integration, P3 validation on validation data |
| Nov 8 | Phase 2 decision records | Traceable decision events |
| Nov 9 | Phase 3 spatial risk field, if feasible | Actual grid + consistency test |
| Nov 10–12 | Phase 4 experience redesign / flagship demo | Working demonstrator |
| Nov 13 | Phase 5 validation and paper outputs within approved scope | Reproducible results; no frozen run without G3 |
| Nov 14 | Phase 6 quality gates and demo rehearsal | Release candidate |
| Nov 15 | Final demonstration and handover | Verified deliverables + limitations |

**Schedule reality:** This is an aggressive plan. The agent must not pretend every item can be completed. It must identify critical-path blockers and cut scope explicitly. Research governance and frozen-test protections are never relaxed.

## Balanced delivery definition

By 15 November, prioritize:
1. A genuine simulation demo using actual Python engine output.
2. A truthful and readable UI with provenance.
3. Correct authoritative metrics for any displayed results.
4. P3's F3 issue investigated and validated on validation data after F4 calibration integration.
5. Decision explanations grounded in engine records, if Phase 2 is complete.
6. Actual spatial risk grid if Phase 3 is feasible; otherwise clearly labelled scalar risk in the fallback demo.
7. Reproducible, honest research documentation and explicit unfinished items.

A demo replaying an existing validated run is acceptable as a fallback if real-time execution is unstable, provided it is labelled RECORDED EXPERIMENT and never represented as live.

## Package contents

- `prompts/00_STANDING_ENGINEERING_RULES.md` — always-active rules and shared context.
- `prompts/01_PHASE_0_AUDIT.md` — Phase 0 only; stop at G1.
- `prompts/02_PHASE_1_RESEARCH_CORRECTNESS.md` — Phase 1; definitions stop at G2.
- `prompts/03_PHASE_2_DECISION_RECORDS.md` — Phase 2.
- `prompts/04_PHASE_3_SPATIAL_RISK.md` — Phase 3.
- `prompts/05_PHASE_4_STUDIO_REDESIGN.md` — Phase 4.
- `prompts/06_PHASE_5_EXPERIMENTS_AND_PAPER.md` — Phase 5; stop at G3 before frozen evaluation.
- `prompts/07_PHASE_6_RELEASE.md` — Phase 6.
- `prompts/08_DEMO_FALLBACK_TRACK.md` — time-boxed parallel demo track after G1.
- `templates/PROGRESS.md` — session continuity template.
- `templates/SAP_TEMPLATE.md` — pre-registration template.

## Important execution rule

A phase prompt authorizes only that phase. It does not override the approval gates or authorize later phases. The standing rules apply to every phase and every new session.

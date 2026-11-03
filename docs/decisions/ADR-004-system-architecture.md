# ADR-004: ADAPTIVE-PATH System Architecture & Decoupled Execution Pipeline

- **Status**: Accepted
- **Date**: 2026-10-14
- **Deciders**: Autonomous Systems Lead & Research Engineering Team

## Context
The project needs a seamless bridge between research execution (Python reference engine / MATLAB RoadRunner) and interactive evaluation in the ADAPTIVE-PATH Studio. It must support:
- Instant zero-install judge demonstration (offline bundled sample runs opening under 10 seconds without backend, WCAG 2.2 AA compliant).
- Backend API providing run launching, live status tracking, log streaming, and statistical aggregation.
- In-process or Redis-backed worker queue handling batch execution of seeded benchmarks.

## Decision

### 1. Dual-Engine Contract:
Both the Python engine and the MATLAB adapter output the identical `apath-log v1` JSON format into disk/object storage:
`storage/runs/{run_id}.json`

### 2. Backend Stack:
- **FastAPI (Python 3.12/3.14)** with typed Pydantic v2 models.
- **SQLite / PostgreSQL** dual support via SQLAlchemy 2.0 (defaults to zero-config SQLite locally for effortless portability and demo reproduction).
- **Execution Worker**: Asynchronous queue manager supporting both direct concurrent thread pool execution and worker dispatch, ensuring queued runs survive interruptions and generate detailed execution traces.
- **REST Endpoints**:
  - `GET /api/scenarios`: List 5 scenarios, parameters, and splits.
  - `POST /api/runs`: Launch a run or batch run.
  - `GET /api/runs`: List runs with status, metrics, and tags.
  - `GET /api/runs/{id}`: Fetch run log chunks or full `apath-log v1`.
  - `GET /api/benchmark`: Aggregate metrics across planners and scenarios with bootstrap 95% confidence intervals.
  - `GET /api/failures`: Filter runs by collision, near-miss, and attribution tag.

### 3. Studio Frontend Stack:
- **React 18/19 + TypeScript + Vite**.
- **WCAG 2.2 AA Compliant UI**: Keyboard navigation, screen reader live regions, high contrast tokens, non-color-only risk indicators (hazard stripes/patterns + numeric values), zero motion autoplay.
- **Replay Canvas**: High-performance 60fps 2D canvas with layered rendering:
  - World boundaries & road free space (non-lane based)
  - Tracked mixed-traffic agents
  - Multi-hypothesis future paths & conformal uncertainty cones
  - Continuous risk field heatmap / contour overlay
  - Current planned path & replan history markers
- **Offline / Standalone Fallback**: Bundled pre-computed runs directly embedded in the client or loaded via static fetch, allowing a judge to review complete replays and ablations with zero backend or external dependencies.

## Consequences
- Clean separation of concerns: engine algorithms can be tested independently of the web console.
- Meets all performance constraints: replay loads in < 3s, renders smoothly at > 30fps.

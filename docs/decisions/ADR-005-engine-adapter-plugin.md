# ADR-005: Engine Adapter Plug-in Architecture

- **Status**: Accepted
- **Date**: 2026-10-14
- **Deciders**: Principal Architect & Autonomous Systems Lead

## Context
ADAPTIVE-PATH requires executing simulations across two primary engine environments:
1. Python Reference Engine (standalone, zero-licence execution, rapid local testing)
2. MATLAB/Simulink + RoadRunner Scenario (official MathWorks hackathon submission path)
Additionally, recorded real-world or pre-computed benchmark runs must be loadable without engine invocation.

Direct coupling between the web console/worker and any single engine would violate core requirements: single-vendor risk, licence failure on demo day, and inability to integrate future engines (e.g. CARLA, C++ AV stack).

## Decision
We define an **Engine Adapter Plug-in Interface** (`BaseEngineAdapter`):
1. **Contract Boundary**:
   Every adapter is an independent plug-in implementing:
   - `validate_environment() -> EngineHealth`: Verifies binary availability, licences, GPU/CPU resources.
   - `launch_run(run_id, scenario_config, seed, planner_config, output_stream) -> ExecutionHandle`: Initiates execution asynchronously.
   - `stream_cycles(execution_handle) -> Generator[CycleRecord, None, None]`: Streams cycle-by-cycle frames as they execute.
   - `cancel_run(execution_handle) -> bool`: Cleanly terminates engine processes without orphaned subprocesses.
   - `convert_to_apath_log(raw_output) -> RunLog`: Standardizes engine-specific output into `apath-log/v1`.

2. **Registered Adapters**:
   - `PythonEngineAdapter`: Runs `engine.runner.SimulationRunner` in a separate process or thread.
   - `MatlabRoadrunnerAdapter`: Communicates via MATLAB Engine API for Python or gRPC co-simulation bridge to RoadRunner Scenario, invoking `apath_log_v1_export.m`.
   - `RecordedRunAdapter`: Ingests pre-computed or static offline datasets and emits standard `apath-log/v1` streams.

3. **Plug-in Registry**:
   Adapters register via Python entrypoints or an explicit registry dictionary with capability negotiation (e.g. `supports_hardware_in_loop: bool`, `max_concurrency: int`).

## Consequences
- The worker invokes adapters strictly through the common interface; no engine-specific code resides in the worker or web layer.
- If MATLAB licences fail or are unavailable, the system transparently falls back to the Python reference engine.
- Adding a new simulator (e.g., CARLA or SUMO) requires only implementing `BaseEngineAdapter` without modifying database models, job queues, or Studio UI.

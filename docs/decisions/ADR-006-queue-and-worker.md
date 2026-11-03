# ADR-006: Asynchronous Job Queue and Deterministic Worker Architecture

- **Status**: Accepted
- **Date**: 2026-10-14
- **Deciders**: Principal Architect & Autonomous Systems Lead

## Context
Running closed-loop autonomous driving simulations across multi-agent scenarios is computationally intensive. When running batch evaluations across 30 seeds for statistical confidence intervals (G5), runs must be queued, executed asynchronously, tracked, and capable of surviving crashes or worker restarts without corrupting state or losing partial logs.

## Decision
We implement a decoupled **Worker and Job Queue Architecture**:
1. **Queue Protocol**:
   - Production / Distributed: Redis + Celery / ARQ for distributed task scheduling and concurrency control.
   - Local / Standalone: In-process asynchronous worker pool (`concurrent.futures.ThreadPoolExecutor` / `asyncio`) backed by persistent database job state (`RunRecord.status`).
2. **State Machine Persistence**:
   - Job state transitions (`QUEUED` -> `RUNNING` -> `SUCCEEDED` / `FAILED` / `CANCELLED`) are atomically persisted to SQL.
   - Heartbeats: Running workers emit heartbeats every 5 seconds. If a worker process abruptly dies, watchdog recovery detects stale heartbeats (>30s) and transitions jobs to `FAILED` with failure attribution `SYSTEM_CRASH`, preserving partial logs.
3. **Cancellation & Graceful Drain**:
   - Cancellation requests write a cancellation signal to Redis / DB. The worker checks cancellation tokens at each 100ms cycle boundary, executes an emergency controlled termination, flushes frames generated so far, and tags the run as `CANCELLED`.
4. **Deterministic Concurrency Control**:
   - Each simulation run executes with an isolated random number generator initialized strictly from `(scenario_id, seed, config_hash)`.
   - Thread-local or process-isolated execution guarantees that concurrent executions cannot leak state or contaminate random seeds across runs.

## Consequences
- Long-running batch sweeps do not block HTTP request threads.
- Queued jobs survive server restarts. Partial logs of failed or cancelled runs are never discarded.

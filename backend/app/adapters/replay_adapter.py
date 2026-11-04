"""
Replay Engine Adapter.
Streams pre-recorded simulation runs for zero-compute, offline demonstrations,
supporting realistic time-paced SSE streaming, scrubbing, and cancellation.
"""

import os
import time
import json
from pathlib import Path
from typing import Optional, Dict, Any, Generator, List

from engine.apath_log.schema import RunLog, EngineInfo
from backend.app.adapters.base import (
    BaseEngineAdapter,
    RunContext,
    ExecutionHandle,
    ProgressEvent,
    EngineVersionInfo,
)
from backend.app.adapters.errors import SimulationCancelledException
from backend.app.adapters.pipeline.converter import EngineLogConverter
from backend.app.adapters.pipeline.validator import LogValidator
from backend.app.config import settings


class ReplayEngineAdapter(BaseEngineAdapter):
    """
    Replay Adapter for Offline Demo and Benchmark Playback.
    Ingests pre-computed run records, validates their schema, and streams them
    at configurable playback pacing.
    """

    def __init__(self, playback_delay_s: float = 0.005):
        self.playback_delay_s = playback_delay_s
        self.converter = EngineLogConverter()
        self.validator = LogValidator()

    @property
    def adapter_name(self) -> str:
        return "recorded_dataset"

    def _get_storage_runs_dir(self) -> Path:
        return Path(settings.storage_dir) / "runs"

    def version_info(self) -> EngineVersionInfo:
        runs_dir = self._get_storage_runs_dir()
        available_runs = len(list(runs_dir.glob("*.json"))) if runs_dir.exists() else 0

        return EngineVersionInfo(
            name=self.adapter_name,
            version="1.0.0",
            status="READY",
            licence_status="NOT_REQUIRED",
            capabilities={
                "offline_demo": True,
                "instant_playback": True,
                "recorded_runs_available": available_runs,
                "zero_compute": True,
            },
            binary_path="[IN_MEMORY_REPLAY]",
        )

    def prepare(
        self,
        scenario_id: str,
        planner_id: str,
        seed: int,
        split: str = "tune",
        custom_params: Optional[Dict[str, Any]] = None,
    ) -> RunContext:
        run_id = f"run_{scenario_id.lower()}_{planner_id.lower()}_{split}_s{seed}"
        return RunContext(
            run_id=run_id,
            scenario_id=scenario_id,
            planner_id=planner_id,
            seed=seed,
            split=split,
            custom_params=custom_params or {},
        )

    def start(self, run_context: RunContext) -> ExecutionHandle:
        handle = ExecutionHandle(
            run_id=run_context.run_id,
            adapter_name=self.adapter_name,
            context=run_context,
            status="RUNNING",
            start_time=time.time(),
        )
        return handle

    def cancel(self, execution_handle: ExecutionHandle) -> bool:
        execution_handle.is_cancelled = True
        execution_handle.status = "CANCELLED"
        return True

    def _find_recorded_run(self, ctx: RunContext) -> Optional[RunLog]:
        """Locates pre-recorded log on disk by exact run_id match."""
        runs_dir = self._get_storage_runs_dir()

        # Exact match only. No globbing, no arbitrary fallback.
        exact_path = runs_dir / f"{ctx.run_id}.json"
        if exact_path.exists():
            with open(exact_path, "r", encoding="utf-8") as f:
                return RunLog.model_validate(json.load(f))

        return None

    def stream_progress(
        self,
        execution_handle: ExecutionHandle,
    ) -> Generator[ProgressEvent, None, None]:
        ctx = execution_handle.context
        run_log = self._find_recorded_run(ctx)
        if not run_log:
            raise FileNotFoundError(f"No replay recording found on disk for run {ctx.run_id}")

        # Ensure engine is tagged as recorded_dataset
        run_log.engine = EngineInfo(name=self.adapter_name, version="1.0.0")

        total_frames = len(run_log.frames)
        delay = float(ctx.custom_params.get("playback_delay_s", self.playback_delay_s))

        for idx, frame in enumerate(run_log.frames):
            if execution_handle.is_cancelled:
                raise SimulationCancelledException(
                    f"Replay run {ctx.run_id} cancelled at frame {idx}/{total_frames}.",
                    step=idx,
                )

            frac = min(1.0, round((idx + 1) / max(1, total_frames), 2))

            if idx % 5 == 0 or idx == total_frames - 1:
                yield ProgressEvent(
                    run_id=ctx.run_id,
                    fraction=frac,
                    message=f"[Replay] t={frame.t}s ({int(frac * 100)}%)",
                    step=idx,
                    total_steps=total_frames,
                    telemetry={
                        "step": idx,
                        "time_s": frame.t,
                        "ego_x": frame.ego.x,
                        "ego_y": frame.ego.y,
                        "ego_v": frame.ego.v,
                        "risk": frame.risk_field.max_risk,
                    },
                )

            if delay > 0:
                time.sleep(delay)

        execution_handle._log_cache = run_log
        execution_handle.status = "COMPLETED"

    def collect_logs(self, execution_handle: ExecutionHandle) -> RunLog:
        if execution_handle._log_cache is not None:
            log = execution_handle._log_cache
            self.validator.validate(log, strict=True)
            return log
        raise RuntimeError(f"No log cache available for handle {execution_handle.run_id}")


# Alias
ReplayAdapter = ReplayEngineAdapter

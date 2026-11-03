"""
Abstract Base Class and Data Models for ADAPTIVE-PATH Simulation Engine Adapters.
Defines the standard lifecycle contract: prepare, start, stream_progress, cancel,
collect_logs, and version_info.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Optional, Dict, Any, Generator, List

from engine.apath_log.schema import RunLog as APathLogV1
from backend.app.adapters.errors import SimulationCancelledException


@dataclass
class RunContext:
    run_id: str
    scenario_id: str
    planner_id: str
    seed: int
    split: str = "tune"
    custom_params: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ProgressEvent:
    run_id: str
    fraction: float
    message: str
    step: int = 0
    total_steps: int = 0
    telemetry: Optional[Dict[str, Any]] = None
    timestamp: float = field(default_factory=lambda: datetime.now(timezone.utc).timestamp())


@dataclass
class ExecutionHandle:
    run_id: str
    adapter_name: str
    context: RunContext
    status: str = "PREPARED"  # PREPARED, RUNNING, COMPLETED, CANCELLED, FAILED
    process_id: Optional[int] = None
    start_time: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_cancelled: bool = False
    _log_cache: Optional[APathLogV1] = None


@dataclass
class EngineVersionInfo:
    name: str
    version: str
    status: str  # READY, DEGRADED, UNAVAILABLE
    licence_status: str  # VALID, NOT_REQUIRED, UNAVAILABLE, EXPIRED
    capabilities: Dict[str, Any] = field(default_factory=dict)
    binary_path: Optional[str] = None
    error_message: Optional[str] = None


class BaseEngineAdapter(ABC):
    """
    Standard interface for ADAPTIVE-PATH simulation engines.
    Any simulation backend (Python, MATLAB/RoadRunner, Replay, CARLA) must implement
    these lifecycle hooks.
    """

    @property
    @abstractmethod
    def adapter_name(self) -> str:
        """Unique identifier for this engine adapter."""
        pass

    @abstractmethod
    def prepare(
        self,
        scenario_id: str,
        planner_id: str,
        seed: int,
        split: str = "tune",
        custom_params: Optional[Dict[str, Any]] = None,
    ) -> RunContext:
        """
        Validates arguments, resolves configuration, and builds execution context.
        """
        pass

    @abstractmethod
    def start(self, run_context: RunContext) -> ExecutionHandle:
        """
        Launches the simulation process or worker thread.
        """
        pass

    @abstractmethod
    def stream_progress(
        self,
        execution_handle: ExecutionHandle,
    ) -> Generator[ProgressEvent, None, None]:
        """
        Streams step-by-step progress events and telemetry frames until completion.
        """
        pass

    @abstractmethod
    def cancel(self, execution_handle: ExecutionHandle) -> bool:
        """
        Terminates the running simulation cleanly without leaving orphaned subprocesses.
        """
        pass

    @abstractmethod
    def collect_logs(self, execution_handle: ExecutionHandle) -> APathLogV1:
        """
        Collects, standardizes, and validates the final apath-log/v1 document.
        """
        pass

    @abstractmethod
    def version_info(self) -> EngineVersionInfo:
        """
        Reports engine health, version, binary path, and licensing status.
        """
        pass

    def execute(
        self,
        scenario_id: str,
        planner_id: str,
        seed: int,
        split: str = "tune",
        custom_params: Optional[Dict[str, Any]] = None,
        on_progress: Optional[Callable[[float, str, Optional[Dict[str, Any]]], None]] = None,
        is_cancelled: Optional[Callable[[], bool]] = None,
    ) -> APathLogV1:
        """
        Convenience execution method implementing the full lifecycle loop.
        Maintains backward compatibility with synchronous callers and workers.
        """
        ctx = self.prepare(scenario_id, planner_id, seed, split, custom_params)
        handle = self.start(ctx)

        try:
            for event in self.stream_progress(handle):
                if is_cancelled and is_cancelled():
                    self.cancel(handle)
                    raise SimulationCancelledException(
                        f"Run {ctx.run_id} cancelled by operator at step {event.step}.",
                        step=event.step,
                    )
                if on_progress:
                    on_progress(event.fraction, event.message, event.telemetry)

            if is_cancelled and is_cancelled():
                self.cancel(handle)
                raise SimulationCancelledException(f"Run {ctx.run_id} cancelled after simulation loop.")

            return self.collect_logs(handle)

        except Exception:
            if handle.status == "RUNNING":
                self.cancel(handle)
            raise

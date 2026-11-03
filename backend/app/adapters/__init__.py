"""
Engine Adapter Registry and Factory for ADAPTIVE-PATH.
Provides unified access to PythonReferenceAdapter, MatlabRoadrunnerAdapter,
and ReplayEngineAdapter with capability inspection and fallback handling.
"""

from typing import Dict
from backend.app.adapters.base import (
    BaseEngineAdapter,
    RunContext,
    ExecutionHandle,
    ProgressEvent,
    EngineVersionInfo,
    SimulationCancelledException,
)
from backend.app.adapters.python_adapter import PythonEngineAdapter, PythonAdapter
from backend.app.adapters.matlab_adapter import MatlabRoadrunnerAdapter, MatlabAdapter
from backend.app.adapters.replay_adapter import ReplayEngineAdapter, ReplayAdapter
from backend.app.adapters.errors import (
    EngineCrashError,
    EngineTimeoutError,
    MatlabLicenseUnavailableError,
    SchemaMismatchError,
)

_ADAPTERS: Dict[str, BaseEngineAdapter] = {
    "python": PythonEngineAdapter(),
    "python-reference": PythonEngineAdapter(),
    "python_reference": PythonEngineAdapter(),
    "matlab": MatlabRoadrunnerAdapter(),
    "matlab-roadrunner": MatlabRoadrunnerAdapter(),
    "matlab_roadrunner": MatlabRoadrunnerAdapter(),
    "replay": ReplayEngineAdapter(),
    "recorded_dataset": ReplayEngineAdapter(),
    "offline": ReplayEngineAdapter(),
}


def get_adapter(adapter_name: str = "python") -> BaseEngineAdapter:
    """
    Retrieve engine adapter by name with fallback to Python reference engine.
    """
    clean_name = adapter_name.lower().strip()
    return _ADAPTERS.get(clean_name, _ADAPTERS["python"])


__all__ = [
    "BaseEngineAdapter",
    "RunContext",
    "ExecutionHandle",
    "ProgressEvent",
    "EngineVersionInfo",
    "SimulationCancelledException",
    "PythonEngineAdapter",
    "PythonAdapter",
    "MatlabRoadrunnerAdapter",
    "MatlabAdapter",
    "ReplayEngineAdapter",
    "ReplayAdapter",
    "EngineCrashError",
    "EngineTimeoutError",
    "MatlabLicenseUnavailableError",
    "SchemaMismatchError",
    "get_adapter",
]

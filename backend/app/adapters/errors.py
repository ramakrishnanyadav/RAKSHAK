"""
Structured Error Types for ADAPTIVE-PATH Simulation Engines and Adapters.
Guarantees clean, typed failure handling for engine crashes, hung runs,
licence failures, and schema mismatches without corrupted state.
"""

from typing import Optional, Dict, Any, List


class SimulationCancelledException(Exception):
    """Raised when simulation run is cooperatively cancelled by user or operator."""
    def __init__(self, message: str = "Simulation run was cancelled.", step: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.step = step


class EngineExecutionError(Exception):
    """Base class for all engine adapter execution errors."""
    def __init__(
        self,
        message: str,
        engine_name: str,
        run_id: Optional[str] = None,
        failure_tag: str = "ENGINE_ERROR",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.engine_name = engine_name
        self.run_id = run_id
        self.failure_tag = failure_tag
        self.details = details or {}

    def to_error_report(self) -> Dict[str, Any]:
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "engine": self.engine_name,
            "run_id": self.run_id,
            "failure_tag": self.failure_tag,
            "details": self.details,
        }


class EngineCrashError(EngineExecutionError):
    """Raised when engine process crashes, exits abnormally, or aborts."""
    def __init__(
        self,
        message: str,
        engine_name: str,
        run_id: Optional[str] = None,
        exit_code: Optional[int] = None,
        stderr: Optional[str] = None,
        last_step: Optional[int] = None,
    ):
        super().__init__(
            message=message,
            engine_name=engine_name,
            run_id=run_id,
            failure_tag="ENGINE_CRASH",
            details={"exit_code": exit_code, "stderr": stderr, "last_step": last_step},
        )
        self.exit_code = exit_code
        self.stderr = stderr
        self.last_step = last_step


class EngineTimeoutError(EngineExecutionError):
    """Raised when an engine run hangs or exceeds its configured timeout duration."""
    def __init__(
        self,
        message: str,
        engine_name: str,
        run_id: Optional[str] = None,
        timeout_s: float = 60.0,
        elapsed_s: float = 60.0,
        last_step: Optional[int] = None,
    ):
        super().__init__(
            message=message,
            engine_name=engine_name,
            run_id=run_id,
            failure_tag="TIMEOUT",
            details={"timeout_s": timeout_s, "elapsed_s": elapsed_s, "last_step": last_step},
        )
        self.timeout_s = timeout_s
        self.elapsed_s = elapsed_s
        self.last_step = last_step


class MatlabLicenseUnavailableError(EngineExecutionError):
    """Raised when MATLAB or RoadRunner license checkout fails."""
    def __init__(
        self,
        message: str,
        license_code: Optional[str] = None,
        feature_name: Optional[str] = "Automated_Driving_Toolbox",
        run_id: Optional[str] = None,
        remedy: str = "Set MOCK_MATLAB=1 for zero-licence CI or configure MLM_LICENSE_FILE.",
    ):
        super().__init__(
            message=message,
            engine_name="matlab_roadrunner",
            run_id=run_id,
            failure_tag="LICENCE_UNAVAILABLE",
            details={
                "license_code": license_code,
                "feature": feature_name,
                "remedy": remedy,
            },
        )
        self.license_code = license_code
        self.feature_name = feature_name


class SchemaMismatchError(EngineExecutionError):
    """Raised when an engine's output fails apath-log/v1 schema validation."""
    def __init__(
        self,
        message: str,
        engine_name: str,
        validation_errors: List[str],
        run_id: Optional[str] = None,
    ):
        super().__init__(
            message=message,
            engine_name=engine_name,
            run_id=run_id,
            failure_tag="SCHEMA_MISMATCH",
            details={"validation_errors": validation_errors},
        )
        self.validation_errors = validation_errors

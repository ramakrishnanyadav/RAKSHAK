"""
Log Pipeline Step 3: Validator (Schema & Semantic Integrity Checker).
Validates RunLog instances against schemas/apath-log-v1.json and semantic consistency rules.
"""

import os
import json
import math
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
import jsonschema

from engine.apath_log.schema import RunLog
from backend.app.adapters.errors import SchemaMismatchError


@dataclass
class ValidationResult:
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class LogValidator:
    """
    Validates logs against both JSONSchema and domain-specific semantic invariants.
    """

    def __init__(self, schema_path: Optional[str] = None):
        if not schema_path:
            schema_path = str(Path(__file__).resolve().parents[4] / "schemas" / "apath-log-v1.json")
        self.schema_path = schema_path

        self._json_schema = None
        if os.path.exists(schema_path):
            with open(schema_path, "r", encoding="utf-8") as f:
                self._json_schema = json.load(f)

    def validate(self, run_log: RunLog, strict: bool = False) -> ValidationResult:
        """
        Validates a RunLog instance against JSON schema and semantic invariants.
        """
        errors: List[str] = []
        warnings: List[str] = []

        log_dict = run_log.model_dump(mode="json")

        # 1. JSON Schema validation
        if self._json_schema:
            validator = jsonschema.Draft202012Validator(self._json_schema)
            schema_errors = list(validator.iter_errors(log_dict))
            for err in schema_errors:
                path_str = ".".join(str(p) for p in err.absolute_path)
                errors.append(f"Schema violation at '{path_str}': {err.message}")

        # 2. Semantic Domain Invariants
        frames = run_log.frames
        if not frames:
            errors.append("RunLog contains zero simulation frames.")

        prev_t = -1.0
        replan_frames_count = 0

        world_bounds = run_log.world.bounds
        for idx, f in enumerate(frames):
            # Monotonic time check
            if f.t <= prev_t:
                errors.append(
                    f"Frame {idx} timestamp t={f.t}s is not strictly greater than previous t={prev_t}s"
                )
            prev_t = f.t

            # Ego coordinate sanity checks
            ego = f.ego
            if math.isnan(ego.x) or math.isnan(ego.y) or math.isnan(ego.v):
                errors.append(f"Frame {idx} contains NaN ego state values.")

            if ego.v < -0.5:
                warnings.append(f"Frame {idx} ego velocity is negative: {ego.v} m/s.")

            if ego.length <= 0 or ego.width <= 0:
                errors.append(f"Frame {idx} ego dimensions invalid: length={ego.length}, width={ego.width}.")

            # Bounding box bounds check
            if not (world_bounds.x_min - 20.0 <= ego.x <= world_bounds.x_max + 20.0):
                warnings.append(f"Frame {idx} ego x={ego.x} outside world bounds [{world_bounds.x_min}, {world_bounds.x_max}].")

            if f.planner_output.replan_triggered:
                replan_frames_count += 1

        # Replan count consistency
        if run_log.metrics.replan_count != replan_frames_count:
            warnings.append(
                f"Metrics replan_count ({run_log.metrics.replan_count}) does not match frame replan triggers ({replan_frames_count})."
            )

        # Duration consistency
        if frames:
            actual_duration = frames[-1].t
            if abs(run_log.metrics.duration_s - actual_duration) > 0.5:
                warnings.append(
                    f"Metrics duration ({run_log.metrics.duration_s}s) deviates from final frame time ({actual_duration}s)."
                )

        is_valid = len(errors) == 0

        if strict and not is_valid:
            raise SchemaMismatchError(
                message=f"Validation failed for run {run_log.run_id}: {'; '.join(errors[:3])}",
                engine_name=run_log.engine.name,
                validation_errors=errors,
                run_id=run_log.run_id,
            )

        return ValidationResult(valid=is_valid, errors=errors, warnings=warnings)

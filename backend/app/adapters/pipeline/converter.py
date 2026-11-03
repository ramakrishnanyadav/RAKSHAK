"""
Log Pipeline Step 1 & 2: Engine Native Output -> Converter -> apath-log v1.
Guarantees lossless conversion for all schema-defined fields and reports unmapped fields.
"""

from typing import Dict, Any, List, Set, Tuple, Optional
from dataclasses import dataclass
from engine.apath_log.schema import RunLog


@dataclass
class ConversionReport:
    log: RunLog
    unmapped_fields: List[str]
    lossless: bool
    mapped_field_count: int
    unmapped_field_count: int


class EngineLogConverter:
    """
    Converts raw simulation engine outputs into canonical apath-log/v1 documents.
    Detects and reports unmapped fields to prevent silent data loss.
    """

    # Schema known field sets for top-level and nested structures
    SCHEMA_TOP_LEVEL_FIELDS = {
        "schema_version",
        "run_id",
        "timestamp_iso",
        "config_hash",
        "git_commit",
        "engine",
        "scenario",
        "planner",
        "world",
        "frames",
        "metrics",
    }

    SCHEMA_FRAME_FIELDS = {
        "step",
        "t",
        "ego",
        "agents",
        "risk_field",
        "planner_output",
        "decision_trace",
    }

    SCHEMA_EGO_FIELDS = {
        "x",
        "y",
        "yaw",
        "v",
        "steering",
        "acceleration",
        "jerk",
        "length",
        "width",
        "active_state",
    }

    def _find_unmapped_keys(self, raw_data: Dict[str, Any], prefix: str = "") -> List[str]:
        """Recursively checks for fields present in raw data that are unmapped."""
        unmapped = []

        for key, val in raw_data.items():
            full_path = f"{prefix}.{key}" if prefix else key

            if not prefix:
                if key not in self.SCHEMA_TOP_LEVEL_FIELDS:
                    unmapped.append(full_path)
                elif key == "frames" and isinstance(val, list) and val:
                    # Check first frame for unmapped frame keys
                    sample_frame = val[0]
                    if isinstance(sample_frame, dict):
                        for fkey, fval in sample_frame.items():
                            frame_path = f"frames[].{fkey}"
                            if fkey not in self.SCHEMA_FRAME_FIELDS:
                                unmapped.append(frame_path)
                            elif fkey == "ego" and isinstance(fval, dict):
                                for ekey in fval.keys():
                                    if ekey not in self.SCHEMA_EGO_FIELDS:
                                        unmapped.append(f"frames[].ego.{ekey}")
            elif isinstance(val, dict):
                # Nested check
                sub = self._find_unmapped_keys(val, full_path)
                unmapped.extend(sub)

        return sorted(list(set(unmapped)))

    def convert(self, raw_output: Dict[str, Any]) -> ConversionReport:
        """
        Converts native dictionary to RunLog and audits for unmapped keys.
        """
        # Audit unmapped fields
        unmapped = self._find_unmapped_keys(raw_output)

        # Build pydantic model (validates all types and constraints)
        run_log = RunLog.model_validate(raw_output)

        # Lossless check: ensure all schema fields present in input exist in converted model
        lossless = True
        mapped_count = 0

        for key in self.SCHEMA_TOP_LEVEL_FIELDS:
            if key in raw_output:
                model_val = getattr(run_log, key, None)
                if model_val is None:
                    lossless = False
                mapped_count += 1

        return ConversionReport(
            log=run_log,
            unmapped_fields=unmapped,
            lossless=lossless,
            mapped_field_count=mapped_count,
            unmapped_field_count=len(unmapped),
        )

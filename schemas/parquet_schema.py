"""
Columnar Parquet Schema Specification for apath-log v1.
Enables high-performance analytics, DuckDB querying, and 85% storage compression.
"""

import pyarrow as pa


# 1. Frames Time-Series Table Schema (1 row per simulation step)
FRAMES_ARROW_SCHEMA = pa.schema([
    pa.field("run_id", pa.string(), nullable=False),
    pa.field("step", pa.int32(), nullable=False),
    pa.field("t", pa.float32(), nullable=False),
    
    # Ego Kinematics
    pa.field("ego_x", pa.float32(), nullable=False),
    pa.field("ego_y", pa.float32(), nullable=False),
    pa.field("ego_yaw", pa.float32(), nullable=False),
    pa.field("ego_v", pa.float32(), nullable=False),
    pa.field("ego_steering", pa.float32(), nullable=False),
    pa.field("ego_accel", pa.float32(), nullable=False),
    pa.field("ego_jerk", pa.float32(), nullable=False),
    pa.field("active_state", pa.dictionary(pa.int8(), pa.string()), nullable=False),
    
    # Risk Field Summary
    pa.field("max_risk", pa.float32(), nullable=False),
    pa.field("ego_risk", pa.float32(), nullable=False),
    pa.field("critical_agent_id", pa.string(), nullable=True),
    pa.field("risk_level", pa.dictionary(pa.int8(), pa.string()), nullable=False),
    
    # Planner Diagnostics
    pa.field("replan_triggered", pa.bool_(), nullable=False),
    pa.field("trigger_reason", pa.dictionary(pa.int8(), pa.string()), nullable=True),
    pa.field("cost_collision", pa.float32(), nullable=False),
    pa.field("cost_progress", pa.float32(), nullable=False),
    pa.field("cost_smoothness", pa.float32(), nullable=False),
    pa.field("cost_risk_field", pa.float32(), nullable=False),
    pa.field("cost_total", pa.float32(), nullable=False),
    pa.field("latency_ms", pa.float32(), nullable=False),
    pa.field("decision_trace", pa.string(), nullable=False),
])

# 2. Tracked Agents & Predictions Table Schema (Normalized 1 row per agent per step)
AGENTS_ARROW_SCHEMA = pa.schema([
    pa.field("run_id", pa.string(), nullable=False),
    pa.field("step", pa.int32(), nullable=False),
    pa.field("agent_id", pa.string(), nullable=False),
    pa.field("class_name", pa.dictionary(pa.int8(), pa.string()), nullable=False),
    pa.field("x", pa.float32(), nullable=False),
    pa.field("y", pa.float32(), nullable=False),
    pa.field("yaw", pa.float32(), nullable=False),
    pa.field("v_x", pa.float32(), nullable=False),
    pa.field("v_y", pa.float32(), nullable=False),
    pa.field("length", pa.float32(), nullable=False),
    pa.field("width", pa.float32(), nullable=False),
    pa.field("is_occluded", pa.bool_(), nullable=False),
    
    # Conformal Envelope Radii at t+0.5s, t+1.0s, t+2.0s
    pa.field("conformal_r_05s", pa.float32(), nullable=True),
    pa.field("conformal_r_10s", pa.float32(), nullable=True),
    pa.field("conformal_r_20s", pa.float32(), nullable=True),
])

# 3. Discrete Events Table Schema
EVENTS_ARROW_SCHEMA = pa.schema([
    pa.field("run_id", pa.string(), nullable=False),
    pa.field("step", pa.int32(), nullable=False),
    pa.field("t", pa.float32(), nullable=False),
    pa.field("event_type", pa.dictionary(pa.int8(), pa.string()), nullable=False), # REPLAN, NEAR_MISS, COLLISION, MRM_TRIGGER
    pa.field("severity", pa.float32(), nullable=False),
    pa.field("details", pa.string(), nullable=False),
])

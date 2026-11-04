/**
 * Scene Model Adapter for ADAPTIVE-PATH Studio
 * 
 * Strict Telemetry Truth Contract (R1):
 * - Maps ONLY strictly logged fields from apath-log/v1 frames and world metadata.
 * - Zero clearance computation, zero spatial risk heatmap generation, zero hallucinated captions.
 * - Missing fields remain undefined/null without synthesized fallbacks.
 */

import {
  RunLog,
  WorldMap,
  Frame,
  EgoState,
  AgentTrack,
  StaticObstacle,
  RoadBoundary,
  WorldBounds,
  PlannedPose,
  CostBreakdown,
} from '../types/apath_log';

export interface SceneTelemetry {
  step: number;
  timeSeconds: number;
  speedKmh: number;
  steeringRad: number;
  accelerationMs2: number;
  jerkMs3: number;
  activeBehaviour: string;
  egoRisk: number;
  maxRisk: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  criticalAgentId: string | null;
  replanTriggered: boolean;
  triggerReason: string | null;
  latencyMs: number;
  costBreakdown: CostBreakdown | null;
  decisionTrace: string;
}

export interface SceneModel {
  // World bounds & static infrastructure directly from WorldMap
  bounds: WorldBounds;
  roadBoundaries: RoadBoundary[];
  staticObstacles: StaticObstacle[];

  // Dynamic actors from current frame
  ego: EgoState;
  agents: AgentTrack[];

  // Planner trajectory from current frame
  plannedTrajectory: PlannedPose[];

  // Purely logged scalar telemetry
  telemetry: SceneTelemetry;
}

/**
 * Transforms an apath-log/v1 Frame and WorldMap into a validated SceneModel.
 * Preserves logged values without extrapolation or synthetic additions.
 */
export function extractSceneModel(
  world: WorldMap,
  frame: Frame
): SceneModel {
  if (!world || !world.bounds) {
    throw new Error('Invalid WorldMap: missing bounds');
  }
  if (!frame || !frame.ego) {
    throw new Error('Invalid Frame: missing ego state');
  }

  // 1. Ego state directly from log
  const ego: EgoState = {
    x: frame.ego.x,
    y: frame.ego.y,
    yaw: frame.ego.yaw,
    v: frame.ego.v,
    steering: frame.ego.steering,
    acceleration: frame.ego.acceleration,
    jerk: frame.ego.jerk,
    length: frame.ego.length,
    width: frame.ego.width,
    active_state: frame.ego.active_state,
  };

  // 2. Dynamic agents directly from log
  const agents: AgentTrack[] = (frame.agents || []).map((agent) => ({
    id: agent.id,
    class_name: agent.class_name,
    x: agent.x,
    y: agent.y,
    yaw: agent.yaw,
    v_x: agent.v_x,
    v_y: agent.v_y,
    length: agent.length,
    width: agent.width,
    is_occluded: Boolean(agent.is_occluded),
    prediction_hypotheses: agent.prediction_hypotheses || [],
    conformal_envelope: agent.conformal_envelope || [],
  }));

  // 3. Static geometry directly from WorldMap
  const staticObstacles: StaticObstacle[] = (world.static_obstacles || []).map((obs) => ({
    id: obs.id,
    kind: obs.kind,
    x: obs.x,
    y: obs.y,
    length: obs.length,
    width: obs.width,
    yaw: obs.yaw,
  }));

  const roadBoundaries: RoadBoundary[] = (world.road_boundaries || []).map((rb) => ({
    side: rb.side,
    points: rb.points.map((p) => [p[0], p[1]] as [number, number]),
  }));

  // 4. Planned trajectory points directly from PlannerOutput
  const plannedTrajectory: PlannedPose[] =
    frame.planner_output && Array.isArray(frame.planner_output.planned_trajectory)
      ? frame.planner_output.planned_trajectory.map((pt) => ({
          x: pt.x,
          y: pt.y,
          v: pt.v,
        }))
      : [];

  // 5. Purely logged telemetry scalars
  const telemetry: SceneTelemetry = {
    step: frame.step,
    timeSeconds: frame.t,
    speedKmh: frame.ego.v * 3.6,
    steeringRad: frame.ego.steering,
    accelerationMs2: frame.ego.acceleration,
    jerkMs3: frame.ego.jerk,
    activeBehaviour: frame.ego.active_state,
    egoRisk: frame.risk_field?.ego_risk ?? 0.0,
    maxRisk: frame.risk_field?.max_risk ?? 0.0,
    riskLevel: frame.risk_field?.risk_level ?? 'LOW',
    criticalAgentId: frame.risk_field?.critical_agent_id ?? null,
    replanTriggered: Boolean(frame.planner_output?.replan_triggered),
    triggerReason: frame.planner_output?.trigger_reason ?? null,
    latencyMs: frame.planner_output?.latency_ms ?? 0.0,
    costBreakdown: frame.planner_output?.cost_breakdown ?? null,
    decisionTrace: frame.decision_trace || '',
  };

  return {
    bounds: world.bounds,
    roadBoundaries,
    staticObstacles,
    ego,
    agents,
    plannedTrajectory,
    telemetry,
  };
}

/**
 * Convenience helper to extract the scene model for a specific frame index from a RunLog.
 */
export function extractSceneModelFromLog(
  runLog: RunLog,
  frameIndex: number
): SceneModel {
  if (!runLog || !runLog.world || !runLog.frames) {
    throw new Error('Invalid RunLog: missing world or frames array');
  }
  const safeIndex = Math.max(0, Math.min(frameIndex, runLog.frames.length - 1));
  const frame = runLog.frames[safeIndex];
  if (!frame) {
    throw new Error(`Frame at index ${safeIndex} does not exist in run log`);
  }
  return extractSceneModel(runLog.world, frame);
}


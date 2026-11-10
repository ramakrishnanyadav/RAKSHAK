import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Scene2DCanvas } from '../components/scene/Scene2DCanvas';
import { SceneModel } from '../adapters/sceneModelAdapter';

const mockSceneModel: SceneModel = {
  bounds: { x_min: -10, x_max: 100, y_min: -10, y_max: 10 },
  roadBoundaries: [
    { side: 'left', points: [[-10, 4.0], [100, 4.0]] },
    { side: 'right', points: [[-10, -4.0], [100, -4.0]] },
  ],
  staticObstacles: [
    { id: 'obs_1', kind: 'pothole', x: 25.0, y: 0.0, length: 2.0, width: 2.0, yaw: 0.0 },
  ],
  ego: {
    x: 10.0,
    y: 0.0,
    yaw: 0.0,
    v: 5.5,
    steering: 0.0,
    acceleration: 0.0,
    jerk: 0.0,
    length: 4.2,
    width: 1.8,
    active_state: 'FOLLOW',
  },
  agents: [
    {
      id: 'cow_1',
      class_name: 'cattle',
      x: 30.0,
      y: 1.0,
      yaw: 1.57,
      v_x: 0.0,
      v_y: -0.5,
      length: 2.4,
      width: 1.1,
      is_occluded: false,
      prediction_hypotheses: [
        { weight: 0.8, intent: 'CROSS', trajectory: [{ x: 30, y: 0.5, t_rel: 0.5 }] },
      ],
      conformal_envelope: [{ t_rel: 0.5, radius_m: 1.2, coverage_p: 0.95 }],
    },
  ],
  plannedTrajectory: [
    { x: 10.0, y: 0.0, v: 5.5 },
    { x: 15.0, y: 0.5, v: 5.2 },
    { x: 20.0, y: 0.8, v: 4.8 },
  ],
  telemetry: {
    step: 0,
    timeSeconds: 0.0,
    speedKmh: 19.8,
    steeringRad: 0.0,
    accelerationMs2: 0.0,
    jerkMs3: 0.0,
    activeBehaviour: 'FOLLOW',
    egoRisk: 0.12,
    maxRisk: 0.25,
    riskLevel: 'LOW',
    criticalAgentId: null,
    replanTriggered: false,
    triggerReason: 'PERIODIC',
    latencyMs: 8.5,
    costBreakdown: null,
    decisionTrace: '[FOLLOW] Nominal',
  },
};

describe('Scene2DCanvas Component', () => {
  it('renders canvas element with accessible aria label', () => {
    render(
      <Scene2DCanvas
        sceneModel={mockSceneModel}
        plannerId="P3"
        onSelectAgent={() => {}}
        selectedAgentId={null}
      />
    );
    const canvas = screen.getByLabelText(/2D Planar Simulation Replay View/i);
    expect(canvas).toBeInTheDocument();
  });

  it('triggers onSelectAgent when an actor position is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <Scene2DCanvas
        sceneModel={mockSceneModel}
        plannerId="P3"
        onSelectAgent={handleSelect}
        selectedAgentId={null}
      />
    );
    const canvas = screen.getByLabelText(/2D Planar Simulation Replay View/i);
    fireEvent.click(canvas, { clientX: 200, clientY: 150 });
    // Callback receives agent id string or null
    expect(handleSelect).toHaveBeenCalled();
  });
});


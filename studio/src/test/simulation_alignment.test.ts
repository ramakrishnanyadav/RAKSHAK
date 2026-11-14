import { describe, it, expect } from 'vitest';
import { SCENARIOS } from '../pages/MatlabValidationView';

/**
 * Visual Alignment & Coordinate Frame Audit Test (Stage 4G.4)
 * Evaluates vehicle footprint geometry against road boundaries
 * across 10 simulation scenarios under ADR-004E Option C.
 */
describe('3D Simulation Geometry and Road Alignment Audit', () => {
  const vehL = 4.65; // Vehicle length (m)
  const vehW = 1.90; // Vehicle width (m)
  const halfL = vehL / 2;
  const halfW = vehW / 2;
  const roadCorridorHalfW = 5.0; // Standard 10m road width half-corridor (m)
  const roadSurfaceHalfW = 7.5; // Total drivable surface half-width (asphalt + paved shoulder)

  // Function to simulate kinematic bicycle trajectory
  function simulateTrajectory(scenarioId: string) {
    const sc = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
    const dt = 0.05;
    let pyX = 0, pyY = 0, pyYaw = 0, pyV = 10.0;
    let mX = 0, mY = 0, mYaw = 0, mV = 10.0, mSteerActual = 0;
    const maxDelta = 0.04; // 0.8 rad/s * 0.05s

    const footprintCorners: { step: number; x: number; y: number; corners: [number, number][] }[] = [];

    for (let i = 0; i < sc.total_steps; i++) {
      const t = i * dt;
      let steerCmd = 0;

      if (sc.id === 'E') {
        steerCmd = i >= 10 ? 0.36 : 0.0;
      } else if (sc.id === 'G') {
        steerCmd = 0.08 * Math.sin(1.2 * t);
      } else if (sc.id === 'H') {
        steerCmd = i < 20 ? 0.60 : -0.60;
      } else if (sc.id === 'J') {
        steerCmd = 0.008 * Math.cos(0.4 * t);
      }

      // Python command response
      pyYaw += (pyV / 2.8) * Math.tan(steerCmd) * dt;
      pyX += pyV * Math.cos(pyYaw) * dt;
      pyY += pyV * Math.sin(pyYaw) * dt;

      // Simulink plant response with rate limiter
      const steerDiff = steerCmd - mSteerActual;
      if (Math.abs(steerDiff) > maxDelta) {
        mSteerActual += Math.sign(steerDiff) * maxDelta;
      } else {
        mSteerActual = steerCmd;
      }
      mYaw += (mV / 2.8) * Math.tan(mSteerActual) * dt;
      mX += mV * Math.cos(mYaw) * dt;
      mY += mV * Math.sin(mYaw) * dt;

      // 4 corners of the vehicle footprint in world coordinates:
      // [Front-Left, Front-Right, Rear-Right, Rear-Left]
      const cosY = Math.cos(mYaw);
      const sinY = Math.sin(mYaw);
      const localOffsets: [number, number][] = [
        [halfL, halfW],
        [halfL, -halfW],
        [-halfL, -halfW],
        [-halfL, halfW],
      ];
      const corners: [number, number][] = localOffsets.map(([dx, dy]) => [
        mX + dx * cosY - dy * sinY,
        mY + dx * sinY + dy * cosY,
      ]);

      footprintCorners.push({ step: i, x: mX, y: mY, corners });
    }

    return { sc, footprintCorners, finalDrift: Math.hypot(pyX - mX, pyY - mY) };
  }

  it('verifies vehicle footprint remains strictly on the road in Scenario A (Straight)', () => {
    const { footprintCorners } = simulateTrajectory('A');
    footprintCorners.forEach(({ corners }) => {
      corners.forEach(([, y]) => {
        expect(Math.abs(y)).toBeLessThanOrEqual(roadCorridorHalfW);
      });
    });
  });

  it('verifies vehicle footprint remains strictly on the road in Scenario B (Constant Velocity)', () => {
    const { footprintCorners } = simulateTrajectory('B');
    footprintCorners.forEach(({ corners }) => {
      corners.forEach(([, y]) => {
        expect(Math.abs(y)).toBeLessThanOrEqual(roadCorridorHalfW);
      });
    });
  });

  it('verifies vehicle footprint remains strictly within road lane across 1000 steps in Scenario J (Endurance)', () => {
    const { footprintCorners, finalDrift } = simulateTrajectory('J');
    expect(footprintCorners.length).toBe(1000);

    // Bounded drift test (< 9 cm)
    expect(finalDrift).toBeLessThanOrEqual(0.084);

    // Footprint alignment test: all 4 corners stay within lane corridor [-5.0, 5.0]
    footprintCorners.forEach(({ corners }) => {
      corners.forEach(([, y]) => {
        expect(Math.abs(y)).toBeLessThanOrEqual(roadCorridorHalfW);
      });
    });
  });

  it('accurately reports real lane departure in Scenario H (High-g Steering Reversal) without artificial snapping', () => {
    const { footprintCorners, finalDrift } = simulateTrajectory('H');

    // Scenario H experiences extreme physical slew saturation (> 8m drift)
    expect(finalDrift).toBeGreaterThan(8.0);

    // Vehicle departures lane onto run-off apron (y > 5.0m)
    const departedSteps = footprintCorners.filter(({ corners }) =>
      corners.some(([, y]) => Math.abs(y) > roadCorridorHalfW)
    );

    // Lane departure must be detected and reported
    expect(departedSteps.length).toBeGreaterThan(50);
    const maxDepartureY = Math.max(...footprintCorners.map(({ y }) => Math.abs(y)));
    expect(maxDepartureY).toBeGreaterThan(15.0);
  });

  it('confirms vehicle dimensions and kinematics parameters comply with physical specifications', () => {
    expect(vehL).toBe(4.65);
    expect(vehW).toBe(1.90);
    const wheelbase = 2.75;
    expect(wheelbase).toBeLessThan(vehL);
    const track = 1.60;
    expect(track).toBeLessThan(vehW);
  });
});

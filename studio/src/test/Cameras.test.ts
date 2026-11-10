import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraController } from '../sim3d/Cameras';
import { InterpolatedPose } from '../sim3d/Playback';

describe('CameraController (Phase 2 Camera Modes & Accessibility)', () => {
  const mockEgoPose: InterpolatedPose = {
    x: 20.0,
    y: 0.0,
    z: 0.0,
    yaw: 0.0, // Heading along positive X axis
    length: 4.2,
    width: 1.8,
  };

  it('computes chase camera behind ego along heading direction', () => {
    const camera = new THREE.PerspectiveCamera();
    const controller = new CameraController(camera, 'chase');
    const target = controller.computeTarget(mockEgoPose);

    // With yaw=0 (facing +X), chase camera is 12m behind (+X direction) -> X = 20 - 12 = 8m
    expect(target.position.x).toBeCloseTo(8.0, 1);
    expect(target.position.y).toBeCloseTo(0.0, 1);
    expect(target.position.z).toBeCloseTo(5.8, 1);
  });

  it('computes bird camera directly overhead looking down', () => {
    const camera = new THREE.PerspectiveCamera();
    const controller = new CameraController(camera, 'bird');
    const target = controller.computeTarget(mockEgoPose);

    expect(target.position.z).toBeGreaterThan(40.0);
    expect(target.lookAt.z).toBeCloseTo(0.0, 1);
  });

  it('computes cockpit camera inside vehicle cabin', () => {
    const camera = new THREE.PerspectiveCamera();
    const controller = new CameraController(camera, 'cockpit');
    const target = controller.computeTarget(mockEgoPose);

    // Front hood/cabin: 1.2m ahead, 1.25m height
    expect(target.position.x).toBeCloseTo(21.2, 1);
    expect(target.position.z).toBeCloseTo(1.25, 1);
  });

  it('respects prefersReducedMotion by cutting instantly to target position', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 0);
    const controller = new CameraController(camera, 'chase');
    controller.setPrefersReducedMotion(true);

    controller.update(mockEgoPose);
    // Instant snap without remaining at origin (0, 0, 0)
    expect(camera.position.x).toBeCloseTo(8.0, 1);
    expect(camera.position.z).toBeCloseTo(5.8, 1);
  });
});


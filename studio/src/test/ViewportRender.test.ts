import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SceneModel } from '../adapters/sceneModelAdapter';
import { createEgoVehicleMesh } from '../components/scene/proceduralModels';

/**
 * Viewport and Scene Graph Validation Tests.
 * Fulfills the condition: "add a test that fails when the canvas has zero size
 * or the scene graph has no road and ego mesh".
 */

// Helper function to build and validate road infrastructure in Three.js scene graph
export function buildRoadInScene(targetGroup: THREE.Group, model: SceneModel): boolean {
  while (targetGroup.children.length > 0) {
    targetGroup.remove(targetGroup.children[0]);
  }

  const { roadBoundaries } = model;
  if (!roadBoundaries || roadBoundaries.length < 2) {
    return false;
  }

  const left = roadBoundaries.find((b) => b.side === 'left') || roadBoundaries[0];
  const right = roadBoundaries.find((b) => b.side === 'right') || roadBoundaries[1];

  if (!left || !right || left.points.length < 2) {
    return false;
  }

  const shape = new THREE.Shape();
  shape.moveTo(left.points[0][0], left.points[0][1]);
  for (let i = 1; i < left.points.length; i++) {
    shape.lineTo(left.points[i][0], left.points[i][1]);
  }
  for (let i = right.points.length - 1; i >= 0; i--) {
    shape.lineTo(right.points[i][0], right.points[i][1]);
  }
  shape.closePath();

  const roadGeo = new THREE.ShapeGeometry(shape);
  const roadMesh = new THREE.Mesh(roadGeo, new THREE.MeshBasicMaterial());
  roadMesh.name = 'road_mesh';
  targetGroup.add(roadMesh);
  return true;
}

// Helper to build dynamic ego vehicle into scene group
export function buildEgoInScene(targetGroup: THREE.Group, model: SceneModel, isP3: boolean): boolean {
  while (targetGroup.children.length > 0) {
    targetGroup.remove(targetGroup.children[0]);
  }

  if (!model.ego) return false;
  const egoMesh = createEgoVehicleMesh(model.ego, isP3);
  egoMesh.name = 'ego_vehicle';
  targetGroup.add(egoMesh);
  return true;
}

// Validation function that asserts canvas dimensions and mesh presence with non-zero bounds
export function validateViewportAndScene(
  containerWidth: number,
  containerHeight: number,
  roadGroup: THREE.Group,
  dynamicGroup: THREE.Group
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Canvas zero-size check
  if (containerWidth <= 0 || containerHeight <= 0) {
    errors.push(`Canvas container has zero size: ${containerWidth}x${containerHeight}`);
  }

  // 2. Road mesh in scene graph
  const roadMesh = roadGroup.getObjectByName('road_mesh') as THREE.Mesh;
  if (!roadMesh) {
    errors.push('Scene graph is missing road mesh');
  } else {
    roadMesh.geometry.computeBoundingBox();
    const bb = roadMesh.geometry.boundingBox;
    if (!bb || (bb.max.x - bb.min.x <= 0) || (bb.max.y - bb.min.y <= 0)) {
      errors.push('Road mesh has zero geometric bounds');
    }
  }

  // 3. Ego mesh in scene graph
  const egoMesh = dynamicGroup.getObjectByName('ego_vehicle');
  if (!egoMesh) {
    errors.push('Scene graph is missing ego vehicle mesh');
  } else {
    const box = new THREE.Box3().setFromObject(egoMesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
      errors.push('Ego vehicle mesh has zero geometric bounds');
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('3D Viewport & Scene Graph Validation Tests', () => {
  const mockSceneModel: SceneModel = {
    bounds: { x_min: 0, x_max: 100, y_min: -10, y_max: 10 },
    roadBoundaries: [
      { side: 'left', points: [[0, 4.8], [50, 4.8], [100, 4.8]] },
      { side: 'right', points: [[0, -4.8], [50, -4.8], [100, -4.8]] },
    ],
    staticObstacles: [],
    ego: {
      x: 0,
      y: 0,
      yaw: 0,
      v: 7.2,
      steering: 0,
      acceleration: 0,
      jerk: 0,
      length: 4.2,
      width: 1.8,
      active_state: 'FOLLOW',
    },
    agents: [],
    plannedTrajectory: [
      { x: 0, y: 0, v: 5.0 },
      { x: 5, y: 0, v: 5.0 },
    ],
    telemetry: {
      step: 0,
      timeSeconds: 0,
      speedKmh: 25.9,
      steeringRad: 0,
      accelerationMs2: 0,
      jerkMs3: 0,
      activeBehaviour: 'FOLLOW',
      egoRisk: 0.12,
      maxRisk: 0.12,
      riskLevel: 'LOW',
      criticalAgentId: null,
      replanTriggered: false,
      triggerReason: null,
      latencyMs: 12.3,
      costBreakdown: null,
      decisionTrace: 'Nominal',
    },
  };

  it('fails validation when canvas container width or height is 0', () => {
    const roadGroup = new THREE.Group();
    const dynamicGroup = new THREE.Group();
    buildRoadInScene(roadGroup, mockSceneModel);
    buildEgoInScene(dynamicGroup, mockSceneModel, true);

    const zeroWidth = validateViewportAndScene(0, 600, roadGroup, dynamicGroup);
    expect(zeroWidth.valid).toBe(false);
    expect(zeroWidth.errors).toContain('Canvas container has zero size: 0x600');

    const zeroHeight = validateViewportAndScene(800, 0, roadGroup, dynamicGroup);
    expect(zeroHeight.valid).toBe(false);
    expect(zeroHeight.errors).toContain('Canvas container has zero size: 800x0');
  });

  it('fails validation when scene graph has no road mesh', () => {
    const emptyRoadGroup = new THREE.Group();
    const dynamicGroup = new THREE.Group();
    buildEgoInScene(dynamicGroup, mockSceneModel, true);

    const result = validateViewportAndScene(1360, 700, emptyRoadGroup, dynamicGroup);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Scene graph is missing road mesh');
  });

  it('fails validation when scene graph has no ego vehicle mesh', () => {
    const roadGroup = new THREE.Group();
    const emptyDynamicGroup = new THREE.Group();
    buildRoadInScene(roadGroup, mockSceneModel);

    const result = validateViewportAndScene(1360, 700, roadGroup, emptyDynamicGroup);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Scene graph is missing ego vehicle mesh');
  });

  it('passes validation when canvas has non-zero size and scene has valid road and ego meshes with non-zero bounds', () => {
    const roadGroup = new THREE.Group();
    const dynamicGroup = new THREE.Group();
    buildRoadInScene(roadGroup, mockSceneModel);
    buildEgoInScene(dynamicGroup, mockSceneModel, true);

    const result = validateViewportAndScene(1360, 700, roadGroup, dynamicGroup);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Verify bounds explicitly
    const roadMesh = roadGroup.getObjectByName('road_mesh') as THREE.Mesh;
    const bb = roadMesh.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBe(100);
    expect(bb.max.y - bb.min.y).toBeCloseTo(9.6, 1);

    const egoMesh = dynamicGroup.getObjectByName('ego_vehicle')!;
    const egoBox = new THREE.Box3().setFromObject(egoMesh);
    const egoSize = new THREE.Vector3();
    egoBox.getSize(egoSize);
    expect(egoSize.x).toBeGreaterThan(3.5);
    expect(egoSize.y).toBeGreaterThan(1.5);
    expect(egoSize.z).toBeGreaterThan(0.5);
  });
});

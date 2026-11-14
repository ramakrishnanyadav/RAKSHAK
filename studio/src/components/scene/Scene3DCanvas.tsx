import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SceneModel } from '../../adapters/sceneModelAdapter';
import {
  createAsphaltTexture,
  createEgoVehicleMesh,
  createAgentMesh,
  createTreeMesh,
  createSceneryTrafficVehicle,
  createRoadsideBuildingMesh,
  createHighwayGantryMesh,
  createIndianMilestoneMesh,
  createHighwayBillboardMesh,
  createHighwaySpeedSignMesh,
  createTrafficConesGroup,
  createRoadsideDrumsMesh,
} from './proceduralModels';
import { preloadCowModel } from './assetLoader';

export type CameraMode = 'chase' | 'bird' | 'topdown' | 'cockpit' | 'orbit' | 'side' | 'cinematic';
export type GraphicsQuality = 'performance' | 'balanced' | 'high_fidelity';

export interface Scene3DCanvasProps {
  sceneModel: SceneModel;
  compareSceneModel?: SceneModel | null; // For single-canvas dual-viewport compare mode
  cameraMode: CameraMode;
  graphicsQuality?: GraphicsQuality;
  resetCameraTrigger?: number; // Increments to trigger camera position reset
  onSelectAgent?: (agentId: string | null) => void;
  selectedAgentId?: string | null;
  plannerId?: string;
  scenarioId?: string;
  showScanner?: boolean;
  showSceneryTraffic?: boolean;
  showBoundingBoxes?: boolean;
  showDistanceTags?: boolean;
}

// Forward Headlight Ground Illumination Beam (Soft Light Fan projected on Asphalt)
function createHeadlightBeamMesh(egoLength: number): THREE.Mesh {
  const shape = new THREE.Shape();
  const startX = egoLength * 0.46;
  const endX = startX + 22.0;
  shape.moveTo(startX, 0.7);
  shape.lineTo(endX, 3.6);
  shape.lineTo(endX, -3.6);
  shape.lineTo(startX, -0.7);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = 0.02;
  return mesh;
}

// Forward LiDAR / Radar Multi-Sensor Scanning Fan (Synthetic Visualization)
function createScannerSweepGroup(egoLength: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'scanner_sweep_fan';

  const rangeM = 36.0;
  const fovDeg = 120;
  const halfFovRad = (fovDeg / 2) * (Math.PI / 180);
  const startX = egoLength * 0.48;

  // 1. Semi-transparent LiDAR Scanning Arc Sector on Road Plane
  const shape = new THREE.Shape();
  shape.moveTo(startX, 0);
  const segments = 32;
  for (let i = -segments / 2; i <= segments / 2; i++) {
    const angle = (i / (segments / 2)) * halfFovRad;
    const px = startX + rangeM * Math.cos(angle);
    const py = rangeM * Math.sin(angle);
    shape.lineTo(px, py);
  }
  shape.closePath();

  const sectorGeo = new THREE.ShapeGeometry(shape);
  const sectorMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4, // Cyan LiDAR sweep
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sectorMesh = new THREE.Mesh(sectorGeo, sectorMat);
  sectorMesh.position.z = 0.025;
  group.add(sectorMesh);

  // 2. Concentric LiDAR Range Distance Arcs (10m, 20m, 30m)
  [10.0, 20.0, 30.0].forEach((r) => {
    const arcPts: THREE.Vector3[] = [];
    for (let i = -segments / 2; i <= segments / 2; i++) {
      const angle = (i / (segments / 2)) * halfFovRad;
      arcPts.push(new THREE.Vector3(startX + r * Math.cos(angle), r * Math.sin(angle), 0.03));
    }
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
    const arcMat = new THREE.LineDashedMaterial({
      color: 0x22d3ee,
      dashSize: 1.0,
      gapSize: 0.8,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    arcLine.computeLineDistances();
    group.add(arcLine);
  });

  // 3. Radial Scanner Boundary Beams (Outer field edges at -60° and +60°)
  [-halfFovRad, 0, halfFovRad].forEach((angle, idx) => {
    const rayPts = [
      new THREE.Vector3(startX, 0, 0.035),
      new THREE.Vector3(startX + rangeM * Math.cos(angle), rangeM * Math.sin(angle), 0.035),
    ];
    const rayGeo = new THREE.BufferGeometry().setFromPoints(rayPts);
    const rayMat = new THREE.LineBasicMaterial({
      color: idx === 1 ? 0x2dd4bf : 0x06b6d4,
      transparent: true,
      opacity: idx === 1 ? 0.35 : 0.6,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Line(rayGeo, rayMat));
  });

  return group;
}

// ADAS Perception Target Reticle projected onto ground around detected obstacles
function createObstacleScanReticle(
  distM: number,
  radiusM: number,
  isCritical: boolean,
  label: string
): THREE.Group {
  const group = new THREE.Group();
  group.name = `scan_reticle_${label}`;

  // Color logic: Green = Safe (d > 5m), Yellow = Tracking (2m < d <= 5m), Red = Collision Hazard (d <= 2m)
  const isSafe = distM > 5.0;
  const isCaution = distM > 2.0 && distM <= 5.0;
  const colorHex = isCritical || (!isCaution && !isSafe) ? 0xef4444 : isCaution ? 0xf59e0b : 0x10b981;

  // 1. Outer Ground Target Ring
  const ringR = Math.max(1.2, radiusM * 1.3);
  const ringGeo = new THREE.RingGeometry(ringR - 0.08, ringR, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.z = 0.035;
  group.add(ringMesh);

  // 2. Inner Soft Detection Glow
  const discGeo = new THREE.CircleGeometry(ringR - 0.08, 20);
  const discMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: isCritical ? 0.25 : 0.1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const discMesh = new THREE.Mesh(discGeo, discMat);
  discMesh.position.z = 0.03;
  group.add(discMesh);

  // 3. Four Target Crosshair Corner Ticks
  const tickLen = 0.4;
  [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].forEach((rot) => {
    const tickPts = [
      new THREE.Vector3(Math.cos(rot) * (ringR - 0.05), Math.sin(rot) * (ringR - 0.05), 0.04),
      new THREE.Vector3(Math.cos(rot) * (ringR + tickLen), Math.sin(rot) * (ringR + tickLen), 0.04),
    ];
    const tickGeo = new THREE.BufferGeometry().setFromPoints(tickPts);
    const tickLine = new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 }));
    group.add(tickLine);
  });

  return group;
}

// Apollo Dreamview Micro-Perception HUD Tag for Traffic Actors (High-Precision ADAS Style)
function createAgentTagSprite(
  label: string,
  distanceM: number,
  speedMs: number,
  isCritical: boolean
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 56;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = isCritical ? 'rgba(220, 38, 38, 0.92)' : 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = isCritical ? '#f87171' : '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const r = 8;
    ctx.roundRect ? ctx.roundRect(3, 3, 194, 50, r) : ctx.rect(3, 3, 194, 50);
    ctx.fill();
    ctx.stroke();

    // Target reticle pip on left
    ctx.fillStyle = isCritical ? '#fca5a5' : '#22d3ee';
    ctx.beginPath();
    ctx.arc(18, 28, 5, 0, Math.PI * 2);
    ctx.fill();

    // Class + Distance in single crisp line
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${label.toUpperCase()}`, 32, 26);

    ctx.fillStyle = isCritical ? '#fee2e2' : '#94a3b8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${distanceM.toFixed(1)}m · ${(speedMs * 3.6).toFixed(0)} km/h`, 32, 44);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.45, 1.0);
  return sprite;
}

interface AmbientVehicleTracker {
  mesh: THREE.Group;
  speed: number;
  direction: number;
  minX: number;
  maxX: number;
}

// Roadside Scenery tailored to Indian Driving Digital Twin Scenarios
function setupRoadsideScenery(
  targetScene: THREE.Scene,
  ambientTrackerList?: AmbientVehicleTracker[],
  scenarioId?: string
) {
  const sceneryGroup = new THREE.Group();
  sceneryGroup.name = 'decorative_scenery';

  const sId = (scenarioId || '').toUpperCase();
  const isRural = sId.includes('CATTLE') || sId.includes('VILLAGE');
  const isHighway = sId.includes('HIGHWAY') || sId.includes('MERGE') || sId.includes('BRAKING');
  const isMarket = sId.includes('MARKET') || sId.includes('DENSE');
  const isDamaged = sId.includes('POTHOLE') || sId.includes('DAMAGED') || sId.includes('ROADWORKS');
  const isUrban = sId.includes('PEDESTRIAN') || sId.includes('INTERSECTION') || sId.includes('MOTORCYCLE') || (!isRural && !isHighway && !isMarket && !isDamaged);

  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.7 });
  const lampFixtureMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfef08a, emissiveIntensity: 1.5 });
  const guardrailMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.8 });

  // 1. Streetlamps (Urban and Market Corridors only)
  if (isUrban || isMarket) {
    for (let x = -10; x <= 95; x += 30) {
      [-6.8, 6.8].forEach((y) => {
        const poleGroup = new THREE.Group();
        poleGroup.position.set(x, y, 0);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.6), lampPoleMat);
        pole.rotation.x = Math.PI / 2;
        pole.position.set(0, 0, 2.3);
        poleGroup.add(pole);

        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4), lampPoleMat);
        arm.position.set(0, y > 0 ? -0.7 : 0.7, 4.5);
        poleGroup.add(arm);

        const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.1), lampFixtureMat);
        fixture.position.set(0, y > 0 ? -1.3 : 1.3, 4.45);
        poleGroup.add(fixture);

        sceneryGroup.add(poleGroup);
      });
    }
  }

  // 2. Highway Crash Barriers / Guardrails (Highway Scenarios only)
  if (isHighway) {
    [-6.2, 6.2].forEach((y) => {
      const railGeo = new THREE.BoxGeometry(115, 0.06, 0.28);
      const rail = new THREE.Mesh(railGeo, guardrailMat);
      rail.position.set(40, y, 0.65);
      sceneryGroup.add(rail);

      for (let x = -15; x <= 95; x += 4) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75), guardrailMat);
        post.rotation.x = Math.PI / 2;
        post.position.set(x, y, 0.375);
        sceneryGroup.add(post);
      }
    });

    const gantry = createHighwayGantryMesh(18.0, 6.8);
    gantry.position.set(20.0, 0, 0);
    sceneryGroup.add(gantry);

    const speedSign80 = createHighwaySpeedSignMesh(80);
    speedSign80.position.set(8.0, 6.4, 0);
    sceneryGroup.add(speedSign80);

    const billboard = createHighwayBillboardMesh(7.0, 3.8, 6.5);
    billboard.position.set(45.0, 18.0, 0);
    sceneryGroup.add(billboard);
  }

  // 3. Indian Roadside Trees & Natural Foliage (Rural, Damaged, and Urban fringes)
  if (isRural || isDamaged || isUrban) {
    const treePositions = [
      { x: -15, y: 9.5, type: 'deciduous' as const, s: 1.15 },
      { x: 5, y: 11.2, type: 'deciduous' as const, s: 1.2 },
      { x: 22, y: 9.0, type: 'deciduous' as const, s: 1.05 },
      { x: 42, y: 11.8, type: 'deciduous' as const, s: 1.3 },
      { x: 62, y: 9.4, type: 'deciduous' as const, s: 1.1 },
      { x: 82, y: 11.0, type: 'deciduous' as const, s: 1.25 },
      { x: -10, y: -9.8, type: 'deciduous' as const, s: 1.2 },
      { x: 12, y: -11.4, type: 'deciduous' as const, s: 1.1 },
      { x: 32, y: -9.2, type: 'deciduous' as const, s: 1.35 },
      { x: 52, y: -11.0, type: 'deciduous' as const, s: 1.0 },
      { x: 74, y: -9.5, type: 'deciduous' as const, s: 1.25 },
    ];
    treePositions.forEach((tp) => {
      const tree = createTreeMesh(tp.type, tp.s);
      tree.position.set(tp.x, tp.y, 0);
      tree.rotation.z = Math.random() * Math.PI * 2;
      sceneryGroup.add(tree);
    });

    const milestone = createIndianMilestoneMesh(42);
    milestone.position.set(12.0, -5.6, 0);
    milestone.rotation.z = Math.PI / 2;
    sceneryGroup.add(milestone);
  }

  // 4. Urban Buildings & Storefronts (Urban and Market only)
  if (isUrban) {
    const urbanBuildings = [
      { type: 'office' as const, x: 18, y: 22, w: 9, l: 14, h: 12 },
      { type: 'shop' as const, x: 55, y: 18, w: 4.5, l: 8, h: 3.5 },
      { type: 'office' as const, x: -5, y: -22, w: 9, l: 12, h: 10 },
      { type: 'shop' as const, x: 65, y: -18, w: 4.5, l: 7, h: 3.5 },
    ];
    urbanBuildings.forEach((b) => {
      const bMesh = createRoadsideBuildingMesh(b.type, b.w, b.l, b.h);
      bMesh.position.set(b.x, b.y, 0);
      sceneryGroup.add(bMesh);
    });

    const speedSign40 = createHighwaySpeedSignMesh(40);
    speedSign40.position.set(6.0, 5.8, 0);
    sceneryGroup.add(speedSign40);
  }

  // 5. Market Stalls & Roadside Clutter (Market only)
  if (isMarket) {
    const marketStalls = [
      { type: 'shop' as const, x: 10, y: 14, w: 4.0, l: 6.0, h: 3.0 },
      { type: 'shop' as const, x: 26, y: 14, w: 4.2, l: 6.5, h: 3.2 },
      { type: 'shop' as const, x: 44, y: 14, w: 4.0, l: 5.8, h: 3.0 },
      { type: 'shop' as const, x: 14, y: -14, w: 4.0, l: 6.0, h: 3.0 },
      { type: 'shop' as const, x: 32, y: -14, w: 4.2, l: 6.2, h: 3.2 },
      { type: 'shop' as const, x: 50, y: -14, w: 4.0, l: 5.8, h: 3.0 },
    ];
    marketStalls.forEach((s) => {
      const sMesh = createRoadsideBuildingMesh(s.type, s.w, s.l, s.h);
      sMesh.position.set(s.x, s.y, 0);
      sceneryGroup.add(sMesh);
    });

    const drums = createRoadsideDrumsMesh(3);
    drums.position.set(22.0, -6.8, 0);
    sceneryGroup.add(drums);
  }

  // 6. Roadworks / Damage Warning Cones & Drums (Damaged Road only)
  if (isDamaged) {
    const cones = createTrafficConesGroup(5, 2.2);
    cones.position.set(24.0, 4.8, 0);
    sceneryGroup.add(cones);

    const drums = createRoadsideDrumsMesh(3);
    drums.position.set(38.0, -5.2, 0);
    sceneryGroup.add(drums);

    const speedSign25 = createHighwaySpeedSignMesh(25);
    speedSign25.position.set(6.0, 5.4, 0);
    sceneryGroup.add(speedSign25);
  }

  // 7. Ambient Parallel Cruising Vehicles (Highway only)
  if (isHighway && ambientTrackerList) {
    const ambientDefs = [
      { x: 10, y: 14.0, type: 'sedan' as const, color: 0x3b82f6, speed: 7.5, dir: 1 },
      { x: 55, y: 14.0, type: 'suv' as const, color: 0x64748b, speed: 6.8, dir: 1 },
      { x: 30, y: -14.0, type: 'sedan' as const, color: 0x10b981, speed: 8.0, dir: -1 },
    ];
    ambientDefs.forEach((ad) => {
      const veh = createSceneryTrafficVehicle(ad.type, ad.color);
      veh.position.set(ad.x, ad.y, 0);
      veh.rotation.z = ad.dir > 0 ? 0 : Math.PI;
      sceneryGroup.add(veh);
      ambientTrackerList.push({
        mesh: veh,
        speed: ad.speed,
        direction: ad.dir,
        minX: -25,
        maxX: 115,
      });
    });
  }

  targetScene.add(sceneryGroup);
}

// Deep disposal of Three.js hierarchy to prevent GPU VRAM memory leaks
function disposeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).geometry) {
      (child as THREE.Mesh).geometry.dispose();
    }
    if ((child as THREE.Mesh).material) {
      const mat = (child as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => {
          if ((m as any).map) (m as any).map.dispose();
          m.dispose();
        });
      } else {
        if ((mat as any).map) (mat as any).map.dispose();
        mat.dispose();
      }
    }
  });
}

interface CachedAgentVisuals {
  container: THREE.Group;
  compoundMesh: THREE.Group;
  bboxMesh: THREE.LineSegments;
  tagSprite: THREE.Sprite;
  tagCanvas: HTMLCanvasElement;
  tagCtx: CanvasRenderingContext2D | null;
  tagTex: THREE.CanvasTexture;
  lastDistText: string;
  lastCritical: boolean;
  reticle: THREE.Group;
  conformalDisc: THREE.Mesh;
  conformalRing: THREE.Mesh;
  hypLines: THREE.Line[];
  lastX?: number;
  lastY?: number;
  cumDist?: number;
}

interface DynamicSceneCache {
  egoMesh: THREE.Group | null;
  headlightBeam: THREE.Mesh | null;
  scannerSweep: THREE.Group | null;
  trajectoryLine: THREE.Line | null;
  trajectoryDots: THREE.Mesh[];
  clearanceLine: THREE.Line | null;
  agentsMap: Map<string, CachedAgentVisuals>;
  lastPlannerId: string;
}

export const Scene3DCanvas: React.FC<Scene3DCanvasProps> = ({
  sceneModel,
  compareSceneModel,
  cameraMode,
  graphicsQuality = 'balanced',
  resetCameraTrigger = 0,
  onSelectAgent,
  selectedAgentId,
  plannerId = 'P3',
  scenarioId,
  showScanner = true,
  showSceneryTraffic = true,
  showBoundingBoxes = false,
  showDistanceTags = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Primary Scene & Camera
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const dynamicGroupRef = useRef<THREE.Group | null>(null);
  const roadGroupRef = useRef<THREE.Group | null>(null);

  // Secondary Scene & Camera (Used in Compare Mode)
  const compareSceneRef = useRef<THREE.Scene | null>(null);
  const compareCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const compareDynamicGroupRef = useRef<THREE.Group | null>(null);
  const compareRoadGroupRef = useRef<THREE.Group | null>(null);

  // Caching refs to prevent recreating 500+ WebGL objects per frame tick
  const roadScenarioKeyRef = useRef<string | null>(null);
  const compareRoadScenarioKeyRef = useRef<string | null>(null);

  const primaryDynamicCacheRef = useRef<DynamicSceneCache>({
    egoMesh: null,
    headlightBeam: null,
    scannerSweep: null,
    trajectoryLine: null,
    trajectoryDots: [],
    clearanceLine: null,
    agentsMap: new Map(),
    lastPlannerId: '',
  });

  const compareDynamicCacheRef = useRef<DynamicSceneCache>({
    egoMesh: null,
    headlightBeam: null,
    scannerSweep: null,
    trajectoryLine: null,
    trajectoryDots: [],
    clearanceLine: null,
    agentsMap: new Map(),
    lastPlannerId: '',
  });

  // Scenery Ambient Traffic Trackers
  const ambientTrackersRef = useRef<AmbientVehicleTracker[]>([]);

  // Initialize Three.js WebGLRenderer once
  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 500;

    ambientTrackersRef.current = [];

    // Setup Main Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1017);
    scene.fog = new THREE.FogExp2(0x0c1017, 0.005);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 500);
    camera.position.set(-14, -14, 18);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    // Setup Compare Scene
    const compareScene = new THREE.Scene();
    compareScene.background = new THREE.Color(0x0a0e14);
    compareScene.fog = new THREE.FogExp2(0x0a0e14, 0.005);
    compareSceneRef.current = compareScene;

    const compareCamera = new THREE.PerspectiveCamera(48, width / height, 0.5, 500);
    compareCamera.position.set(-14, -14, 18);
    compareCamera.up.set(0, 0, 1);
    compareCameraRef.current = compareCamera;

    // Single WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controlsRef.current = controls;

    // Helper: Add Lights & Ground
    const setupEnvironment = (targetScene: THREE.Scene, trackers?: AmbientVehicleTracker[]) => {
      // Atmospheric sky & ground bounce
      const hemiLight = new THREE.HemisphereLight(0x94a3b8, 0x1c1917, 0.85);
      hemiLight.position.set(0, 0, 50);
      targetScene.add(hemiLight);

      // Warm directional sunlight
      const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
      dirLight.position.set(30, 25, 50);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 160;
      dirLight.shadow.camera.left = -60;
      dirLight.shadow.camera.right = 60;
      dirLight.shadow.camera.top = 60;
      dirLight.shadow.camera.bottom = -60;
      dirLight.shadow.bias = -0.0003;
      targetScene.add(dirLight);

      // Subtle fill light from opposite angle to soften dark shadows
      const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.35);
      fillLight.position.set(-20, -20, 25);
      targetScene.add(fillLight);

      // Natural Surrounding Ground Terrain Plane
      const groundGeo = new THREE.PlaneGeometry(500, 500);
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0x0f141c,
        roughness: 0.95,
        metalness: 0.05,
      });
      const groundMesh = new THREE.Mesh(groundGeo, groundMat);
      groundMesh.position.set(50, 0, -0.08);
      groundMesh.receiveShadow = true;
      targetScene.add(groundMesh);

      // Elegant Engineering Spatial Grid lines
      const grid = new THREE.GridHelper(300, 60, 0x1e293b, 0x131a24);
      grid.rotation.x = Math.PI / 2;
      grid.position.set(50, 0, -0.07);
      targetScene.add(grid);

      // Roadside streetlamps, guardrails, trees & ambient traffic (SCENERY — NOT SIMULATED)
      setupRoadsideScenery(targetScene, trackers, scenarioId);
    };

    preloadCowModel();
    setupEnvironment(scene, ambientTrackersRef.current);
    setupEnvironment(compareScene);

    // Infrastructure & Dynamic Groups
    const roadGroup = new THREE.Group();
    scene.add(roadGroup);
    roadGroupRef.current = roadGroup;

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);
    dynamicGroupRef.current = dynamicGroup;

    const compareRoadGroup = new THREE.Group();
    compareScene.add(compareRoadGroup);
    compareRoadGroupRef.current = compareRoadGroup;

    const compareDynamicGroup = new THREE.Group();
    compareScene.add(compareDynamicGroup);
    compareDynamicGroupRef.current = compareDynamicGroup;

    // Expose for inspection and headless diagnostics
    (window as any).__THREE_WORKSTATION__ = {
      scene,
      camera,
      renderer,
      roadGroup,
      dynamicGroup,
      controls,
      compareScene,
      compareCamera,
    };

    // Single-Canvas Animation Loop with Scissor Split support
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (controlsRef.current && cameraMode === 'orbit') {
        controlsRef.current.update();
      }

      // Smoothly cruise ambient parallel scenery traffic vehicles along outer lanes
      if (showSceneryTraffic && ambientTrackersRef.current.length > 0) {
        ambientTrackersRef.current.forEach((trk) => {
          trk.mesh.position.x += trk.direction * trk.speed * 0.016;
          if (trk.direction > 0 && trk.mesh.position.x > trk.maxX) {
            trk.mesh.position.x = trk.minX;
          } else if (trk.direction < 0 && trk.mesh.position.x < trk.minX) {
            trk.mesh.position.x = trk.maxX;
          }
        });
      }

      const rnd = rendererRef.current;
      const curMount = mountRef.current;
      if (!rnd || !curMount) return;

      const fullW = curMount.clientWidth;
      const fullH = curMount.clientHeight;

      if (compareSceneModel && compareSceneRef.current && compareCameraRef.current) {
        // --- COMPARE MODE: SINGLE CANVAS SCISSOR VIEWPORT SPLIT ---
        rnd.setScissorTest(true);

        const halfW = Math.floor(fullW / 2);

        // 1. Left Viewport: Primary Planner (P3)
        rnd.setViewport(0, 0, halfW, fullH);
        rnd.setScissor(0, 0, halfW, fullH);
        if (cameraRef.current) {
          cameraRef.current.aspect = halfW / fullH;
          cameraRef.current.updateProjectionMatrix();
          rnd.render(scene, cameraRef.current);
        }

        // 2. Right Viewport: Comparator Planner (B1)
        rnd.setViewport(halfW, 0, fullW - halfW, fullH);
        rnd.setScissor(halfW, 0, fullW - halfW, fullH);
        compareCameraRef.current.aspect = (fullW - halfW) / fullH;
        compareCameraRef.current.updateProjectionMatrix();
        rnd.render(compareSceneRef.current, compareCameraRef.current);
      } else {
        // --- SINGLE SCENE MODE ---
        rnd.setScissorTest(false);
        rnd.setViewport(0, 0, fullW, fullH);
        if (cameraRef.current) {
          cameraRef.current.aspect = fullW / fullH;
          cameraRef.current.updateProjectionMatrix();
          rnd.render(scene, cameraRef.current);
        }
      }
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        mountRef.current?.removeChild(rendererRef.current.domElement);
      }
      if (sceneRef.current) disposeHierarchy(sceneRef.current);
      if (compareSceneRef.current) disposeHierarchy(compareSceneRef.current);
      primaryDynamicCacheRef.current.agentsMap.clear();
      compareDynamicCacheRef.current.agentsMap.clear();
      rendererRef.current?.dispose();
    };
  }, [showSceneryTraffic]);

  // Populate Road & Infrastructure Helper (Cached per Scenario — built once, zero per-frame cost)
  const buildRoadInfrastructure = (targetGroup: THREE.Group, model: SceneModel, isSecondary = false) => {
    const bounds = model.bounds;
    const key = `${bounds?.x_min}_${bounds?.x_max}_${model.roadBoundaries?.length}_${(model.staticObstacles || []).length}`;
    const keyRef = isSecondary ? compareRoadScenarioKeyRef : roadScenarioKeyRef;
    if (key === keyRef.current && targetGroup.children.length > 0) {
      return; // Scenario road already built, skip!
    }
    keyRef.current = key;

    while (targetGroup.children.length > 0) {
      const child = targetGroup.children[0];
      targetGroup.remove(child);
      disposeHierarchy(child);
    }

    const { roadBoundaries, staticObstacles } = model;
    const asphaltTex = createAsphaltTexture();

    // 1. Asphalt Road Mesh from boundaries
    if (roadBoundaries && roadBoundaries.length >= 2) {
      const leftBoundary = roadBoundaries.find((b) => b.side === 'left') || roadBoundaries[0];
      const rightBoundary = roadBoundaries.find((b) => b.side === 'right') || roadBoundaries[1];

      if (leftBoundary && rightBoundary && leftBoundary.points.length > 1) {
        const shape = new THREE.Shape();
        const lPts = leftBoundary.points;
        const rPts = rightBoundary.points;

        shape.moveTo(lPts[0][0], lPts[0][1]);
        for (let i = 1; i < lPts.length; i++) {
          shape.lineTo(lPts[i][0], lPts[i][1]);
        }
        for (let i = rPts.length - 1; i >= 0; i--) {
          shape.lineTo(rPts[i][0], rPts[i][1]);
        }
        shape.closePath();

        const roadGeo = new THREE.ShapeGeometry(shape);
        const roadMat = new THREE.MeshStandardMaterial({
          map: asphaltTex,
          roughness: 0.82,
          metalness: 0.15,
        });
        const roadMesh = new THREE.Mesh(roadGeo, roadMat);
        roadMesh.name = 'road_mesh';
        roadMesh.position.z = 0.0;
        roadMesh.receiveShadow = true;
        targetGroup.add(roadMesh);

        // 1b. Unpaved Earth / Gravel Shoulders along Left & Right Verges
        const shoulderWidth = 2.0;
        const shoulderMat = new THREE.MeshStandardMaterial({
          color: 0x1f1b17,
          roughness: 0.95,
          metalness: 0.05,
        });

        // Left shoulder
        const leftShape = new THREE.Shape();
        leftShape.moveTo(lPts[0][0], lPts[0][1]);
        for (let i = 1; i < lPts.length; i++) leftShape.lineTo(lPts[i][0], lPts[i][1]);
        for (let i = lPts.length - 1; i >= 0; i--) leftShape.lineTo(lPts[i][0], lPts[i][1] + shoulderWidth);
        leftShape.closePath();
        const leftShoulder = new THREE.Mesh(new THREE.ShapeGeometry(leftShape), shoulderMat);
        leftShoulder.position.z = -0.015;
        leftShoulder.receiveShadow = true;
        targetGroup.add(leftShoulder);

        // Right shoulder
        const rightShape = new THREE.Shape();
        rightShape.moveTo(rPts[0][0], rPts[0][1]);
        for (let i = 1; i < rPts.length; i++) rightShape.lineTo(rPts[i][0], rPts[i][1]);
        for (let i = rPts.length - 1; i >= 0; i--) rightShape.lineTo(rPts[i][0], rPts[i][1] - shoulderWidth);
        rightShape.closePath();
        const rightShoulder = new THREE.Mesh(new THREE.ShapeGeometry(rightShape), shoulderMat);
        rightShoulder.position.z = -0.015;
        rightShoulder.receiveShadow = true;
        targetGroup.add(rightShoulder);

        // 1c. Segmented Dashed White Road Centerline down y = 0
        const minX = Math.min(lPts[0][0], rPts[0][0]);
        const maxX = Math.max(lPts[lPts.length - 1][0], rPts[rPts.length - 1][0]);
        const centerLinePts = [
          new THREE.Vector3(minX, 0, 0.035),
          new THREE.Vector3(maxX, 0, 0.035),
        ];
        const centerGeo = new THREE.BufferGeometry().setFromPoints(centerLinePts);
        const centerMat = new THREE.LineDashedMaterial({
          color: 0xf8fafc,
          dashSize: 3.0,
          gapSize: 4.0,
          linewidth: 3,
        });
        const centerLine = new THREE.Line(centerGeo, centerMat);
        centerLine.computeLineDistances();
        targetGroup.add(centerLine);

        // 1d. Road Distance Station Ticks every 10m
        for (let stX = 10; stX <= maxX; stX += 10) {
          const tickGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(stX, -4.8, 0.04),
            new THREE.Vector3(stX, -5.2, 0.04),
          ]);
          const tickLine = new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 2 }));
          targetGroup.add(tickLine);
        }
      }

      // Solid edge boundary lines (crisp retroreflective white)
      roadBoundaries.forEach((boundary) => {
        const pts = boundary.points.map((p) => new THREE.Vector3(p[0], p[1], 0.04));
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xf8fafc, linewidth: 3 });
        const line = new THREE.Line(lineGeo, lineMat);
        targetGroup.add(line);
      });
    }

    // 3. Goal line at x = 65.0m (cyan checkered finish gate marker)
    const goalPts = [
      new THREE.Vector3(65.0, -8.0, 0.07),
      new THREE.Vector3(65.0, 8.0, 0.07),
    ];
    const goalGeo = new THREE.BufferGeometry().setFromPoints(goalPts);
    const goalMat = new THREE.LineDashedMaterial({
      color: 0x22d3ee,
      dashSize: 1.2,
      gapSize: 0.6,
      linewidth: 4,
    });
    const goalLine = new THREE.Line(goalGeo, goalMat);
    goalLine.computeLineDistances();
    targetGroup.add(goalLine);

    // Goal Station Overhead Posts & Crossbar Gantry
    const goalPostMat = new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.3, metalness: 0.8 });
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.8), goalPostMat);
    postL.rotation.x = Math.PI / 2; // Upright along Z!
    postL.position.set(65.0, 5.8, 1.9);
    targetGroup.add(postL);

    const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.8), goalPostMat);
    postR.rotation.x = Math.PI / 2; // Upright along Z!
    postR.position.set(65.0, -5.8, 1.9);
    targetGroup.add(postR);

    // Overhead Banner Gantry connecting the two posts along Y
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 11.6), goalPostMat);
    crossbar.position.set(65.0, 0, 3.8); // Axis along Y connects Y = -5.8 to +5.8
    targetGroup.add(crossbar);

    // 4. Static obstacles from static_obstacles ONLY
    staticObstacles.forEach((obj) => {
      const length = obj.length || 2.0;
      const width = obj.width || 2.0;
      const isPothole = obj.kind === 'pothole';
      const height = isPothole ? 0.04 : 1.2;

      let color = 0xd97706;
      if (isPothole) color = 0x292524;
      else if (obj.kind === 'barrier') color = 0xdc2626;
      else if (obj.kind === 'parked_vehicle') color = 0x475569;

      const geo = new THREE.BoxGeometry(length, width, height);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(obj.x, obj.y, height / 2);
      mesh.rotation.z = obj.yaw || 0;
      mesh.castShadow = !isPothole;
      mesh.receiveShadow = true;
      targetGroup.add(mesh);
    });
  };

  // Build Road for Main Scene
  useEffect(() => {
    if (roadGroupRef.current) {
      buildRoadInfrastructure(roadGroupRef.current, sceneModel, false);
    }
  }, [sceneModel.bounds, sceneModel.roadBoundaries, sceneModel.staticObstacles]);

  // Build Road for Compare Scene
  useEffect(() => {
    if (compareRoadGroupRef.current && compareSceneModel) {
      buildRoadInfrastructure(compareRoadGroupRef.current, compareSceneModel, true);
    }
  }, [compareSceneModel?.bounds, compareSceneModel?.roadBoundaries, compareSceneModel?.staticObstacles]);

  // Populate Dynamic Entities Helper (High-Performance Pooled & Cached — Zero per-frame object allocation)
  const buildDynamicEntities = (
    targetGroup: THREE.Group,
    model: SceneModel,
    isSecondary: boolean
  ) => {
    const cache = isSecondary ? compareDynamicCacheRef.current : primaryDynamicCacheRef.current;
    const { ego, agents, plannedTrajectory, staticObstacles } = model;
    const isP3 = !isSecondary && plannerId.toUpperCase().includes('P3');

    // 1. Persistent Ego Vehicle
    if (!cache.egoMesh || cache.lastPlannerId !== (isP3 ? 'P3' : 'other')) {
      if (cache.egoMesh) {
        targetGroup.remove(cache.egoMesh);
        disposeHierarchy(cache.egoMesh);
      }
      cache.egoMesh = createEgoVehicleMesh(ego, isP3);
      cache.headlightBeam = createHeadlightBeamMesh(ego.length || 4.4);
      cache.egoMesh.add(cache.headlightBeam);
      cache.scannerSweep = createScannerSweepGroup(ego.length || 4.4);
      cache.egoMesh.add(cache.scannerSweep);
      targetGroup.add(cache.egoMesh);
      cache.lastPlannerId = isP3 ? 'P3' : 'other';
    }

    cache.egoMesh.position.set(ego.x, ego.y, 0);
    const accel = ego.acceleration ?? 0;
    const steering = ego.steering ?? 0;
    const pitchAngle = Math.max(-0.06, Math.min(0.06, -accel * 0.012));
    const rollAngle = Math.max(-0.04, Math.min(0.04, -steering * 0.06));
    cache.egoMesh.rotation.order = 'ZYX';
    cache.egoMesh.rotation.set(rollAngle, pitchAngle, ego.yaw);

    // Animate Wheels (Axle rotation around Y, steering on front wheels)
    const wheels = cache.egoMesh.userData?.wheels;
    if (wheels) {
      const v = ego.v || 0;
      const rotDelta = (v * 0.016) / 0.39;
      if (wheels.fl) {
        wheels.fl.rotation.y += rotDelta;
        wheels.fl.rotation.z = -steering;
      }
      if (wheels.fr) {
        wheels.fr.rotation.y += rotDelta;
        wheels.fr.rotation.z = -steering;
      }
      if (wheels.rl) wheels.rl.rotation.y += rotDelta;
      if (wheels.rr) wheels.rr.rotation.y += rotDelta;
    }

    if (cache.scannerSweep) {
      cache.scannerSweep.visible = Boolean(showScanner);
    }

    // 2. Planned Trajectory Ribbon & Waypoints
    if (!cache.trajectoryLine) {
      const trajGeo = new THREE.BufferGeometry();
      const trajMat = new THREE.LineBasicMaterial({
        color: isP3 ? 0x2dd4bf : 0x94a3b8,
        linewidth: 4,
      });
      cache.trajectoryLine = new THREE.Line(trajGeo, trajMat);
      targetGroup.add(cache.trajectoryLine);
    }

    if (plannedTrajectory && plannedTrajectory.length > 1) {
      const pts = plannedTrajectory.map((p) => new THREE.Vector3(p.x, p.y, 0.08));
      cache.trajectoryLine.geometry.setFromPoints(pts);
      cache.trajectoryLine.visible = true;

      // Reusable Waypoint Dots Pool
      const neededDots = Math.floor(pts.length / 2);
      while (cache.trajectoryDots.length < Math.min(neededDots, 50)) {
        const dotGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.03, 10);
        const dotMat = new THREE.MeshBasicMaterial({ color: isP3 ? 0x2dd4bf : 0x94a3b8 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.rotation.x = Math.PI / 2;
        targetGroup.add(dot);
        cache.trajectoryDots.push(dot);
      }
      let dotCount = 0;
      for (let idx = 0; idx < pts.length; idx += 2) {
        if (dotCount < cache.trajectoryDots.length) {
          cache.trajectoryDots[dotCount].position.copy(pts[idx]);
          cache.trajectoryDots[dotCount].visible = true;
          dotCount++;
        }
      }
      for (let i = dotCount; i < cache.trajectoryDots.length; i++) {
        cache.trajectoryDots[i].visible = false;
      }
    } else {
      cache.trajectoryLine.visible = false;
      cache.trajectoryDots.forEach((d) => (d.visible = false));
    }

    // 3. Dynamic Traffic Actors (Cached handles + text re-render only on value delta)
    const currentAgentIds = new Set(agents.map((ag) => ag.id));
    let closestDist = Infinity;
    let closestAgent: typeof agents[0] | null = null;

    agents.forEach((ag) => {
      const isSelected = !isSecondary && ag.id === selectedAgentId;
      const isOccluded = ag.is_occluded;
      const dist = Math.hypot(ag.x - ego.x, ag.y - ego.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestAgent = ag;
      }

      let visual = cache.agentsMap.get(ag.id);
      const l = ag.length || 2.4;
      const w = ag.width || 1.1;
      const h = ag.class_name === 'truck' ? 2.8 : ag.class_name === 'cattle' ? 1.48 : 1.5;

      if (!visual) {
        const container = new THREE.Group();
        container.name = `agent_${ag.id}`;

        const compoundMesh = createAgentMesh(ag);
        container.add(compoundMesh);

        const bboxGeo = new THREE.BoxGeometry(l, w, h);
        const bboxEdges = new THREE.EdgesGeometry(bboxGeo);
        const bboxMat = new THREE.LineBasicMaterial({ color: 0x2dd4bf, linewidth: 1.5 });
        const bboxMesh = new THREE.LineSegments(bboxEdges, bboxMat);
        bboxMesh.position.set(0, 0, h / 2);
        container.add(bboxMesh);

        const tagCanvas = document.createElement('canvas');
        tagCanvas.width = 200;
        tagCanvas.height = 56;
        const tagCtx = tagCanvas.getContext('2d');
        const tagTex = new THREE.CanvasTexture(tagCanvas);
        const tagSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, depthTest: true }));
        tagSprite.scale.set(1.6, 0.45, 1.0);
        tagSprite.position.set(0, 0, h + 0.65);
        container.add(tagSprite);

        const reticle = createObstacleScanReticle(dist, Math.max(l, w) / 2, false, ag.class_name || ag.id);
        container.add(reticle);

        const discGeo = new THREE.CircleGeometry(1.0, 24);
        const discMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
        const conformalDisc = new THREE.Mesh(discGeo, discMat);
        conformalDisc.position.z = 0.03;
        conformalDisc.visible = false;
        container.add(conformalDisc);

        const ringGeo = new THREE.RingGeometry(0.94, 1.0, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
        const conformalRing = new THREE.Mesh(ringGeo, ringMat);
        conformalRing.position.z = 0.035;
        conformalRing.visible = false;
        container.add(conformalRing);

        visual = {
          container,
          compoundMesh,
          bboxMesh,
          tagSprite,
          tagCanvas,
          tagCtx,
          tagTex,
          lastDistText: '',
          lastCritical: false,
          reticle,
          conformalDisc,
          conformalRing,
          hypLines: [],
        };
        targetGroup.add(container);
        cache.agentsMap.set(ag.id, visual);
      }

      // Fast in-place updates (Zero object allocation)
      visual.container.position.set(ag.x, ag.y, 0);
      visual.compoundMesh.rotation.z = ag.yaw;
      visual.bboxMesh.rotation.z = ag.yaw;

      // Visibility of technical overlays (default hidden per user instruction)
      visual.bboxMesh.visible = Boolean(showBoundingBoxes);
      visual.reticle.visible = Boolean(showBoundingBoxes);
      visual.tagSprite.visible = showDistanceTags !== false;

      // Articulated locomotion for Indian Cattle
      const isCattle = (ag.class_name || '').toLowerCase().includes('cattle') || (ag.class_name || '').toLowerCase().includes('cow') || ag.id.toLowerCase().includes('cow');
      if (isCattle && visual.compoundMesh.userData?.isCattle) {
        const u = visual.compoundMesh.userData;
        if (visual.lastX !== undefined && visual.lastY !== undefined) {
          const stepDist = Math.hypot(ag.x - visual.lastX, ag.y - visual.lastY);
          visual.cumDist = (visual.cumDist || 0) + stepDist;
        } else {
          visual.cumDist = 0;
        }
        visual.lastX = ag.x;
        visual.lastY = ag.y;

        const currentSpeed = Math.hypot(ag.v_x, ag.v_y);
        if (currentSpeed > 0.05) {
          // Quadruped walking gait cycle
          const gaitPhase = (visual.cumDist || 0) * 4.2;
          const swing = Math.sin(gaitPhase) * 0.42;

          if (u.legFL) u.legFL.rotation.y = swing;
          if (u.legRR) u.legRR.rotation.y = swing;
          if (u.legFR) u.legFR.rotation.y = -swing;
          if (u.legRL) u.legRL.rotation.y = -swing;

          // Subtle body vertical bobbing
          visual.compoundMesh.position.z = Math.abs(Math.sin(gaitPhase * 2)) * 0.035;
          if (u.headGroup) u.headGroup.rotation.y = -0.16 + Math.sin(gaitPhase) * 0.06;
          if (u.tail) u.tail.rotation.y = Math.sin(gaitPhase * 0.8) * 0.22;
        } else {
          // Relaxed stationary stance with hooves planted squarely
          if (u.legFL) u.legFL.rotation.y *= 0.82;
          if (u.legRR) u.legRR.rotation.y *= 0.82;
          if (u.legFR) u.legFR.rotation.y *= 0.82;
          if (u.legRL) u.legRL.rotation.y *= 0.82;
          visual.compoundMesh.position.z = 0;
          if (u.tail) u.tail.rotation.y = Math.sin(model.telemetry.timeSeconds * 1.5) * 0.12;
        }
      }

      const isCritical = dist < 3.2 || model.telemetry.riskLevel === 'CRITICAL';
      const riskColor = model.telemetry.riskLevel === 'CRITICAL' ? 0xef4444 : model.telemetry.riskLevel === 'HIGH' ? 0xf59e0b : 0x2dd4bf;
      (visual.bboxMesh.material as THREE.LineBasicMaterial).color.setHex(isSelected ? 0xffffff : riskColor);

      if (isOccluded) {
        visual.compoundMesh.traverse((c) => {
          if ((c as THREE.Mesh).material) {
            const mat = (c as THREE.Mesh).material as THREE.Material;
            mat.transparent = true;
            mat.opacity = 0.35;
          }
        });
      } else {
        visual.compoundMesh.traverse((c) => {
          if ((c as THREE.Mesh).material) {
            const mat = (c as THREE.Mesh).material as THREE.Material;
            mat.transparent = false;
            mat.opacity = 1.0;
          }
        });
      }

      // Redraw text onto EXISTING canvas only when values change
      const speed = Math.hypot(ag.v_x, ag.v_y);
      const distText = `${dist.toFixed(1)}m · ${(speed * 3.6).toFixed(0)} km/h`;
      if (distText !== visual.lastDistText || isCritical !== visual.lastCritical) {
        if (visual.tagCtx) {
          const ctx = visual.tagCtx;
          ctx.clearRect(0, 0, 200, 56);
          ctx.fillStyle = isCritical ? 'rgba(220, 38, 38, 0.92)' : 'rgba(15, 23, 42, 0.88)';
          ctx.strokeStyle = isCritical ? '#f87171' : '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(3, 3, 194, 50, 8) : ctx.rect(3, 3, 194, 50);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isCritical ? '#fca5a5' : '#22d3ee';
          ctx.beginPath();
          ctx.arc(18, 28, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 20px monospace';
          ctx.fillText((ag.class_name || ag.id).toUpperCase(), 32, 26);

          ctx.fillStyle = isCritical ? '#fee2e2' : '#94a3b8';
          ctx.font = 'bold 16px monospace';
          ctx.fillText(distText, 32, 44);

          visual.tagTex.needsUpdate = true;
          visual.lastDistText = distText;
          visual.lastCritical = isCritical;
        }
      }

      // Reticle visibility
      visual.reticle.visible = Boolean(showScanner && dist < 36.0);

      // Conformal prediction envelope scale update
      if (ag.conformal_envelope && ag.conformal_envelope.length > 0) {
        const radius = ag.conformal_envelope[0].radius_m || 1.2;
        visual.conformalDisc.visible = true;
        visual.conformalDisc.scale.set(radius, radius, 1);
        visual.conformalRing.visible = true;
        visual.conformalRing.scale.set(radius, radius, 1);
      } else {
        visual.conformalDisc.visible = false;
        visual.conformalRing.visible = false;
      }
    });

    // Cleanly dispose agents that left the scene
    for (const [id, visual] of cache.agentsMap.entries()) {
      if (!currentAgentIds.has(id)) {
        targetGroup.remove(visual.container);
        disposeHierarchy(visual.container);
        visual.tagTex.dispose();
        cache.agentsMap.delete(id);
      }
    }

    // 4. Safety Clearance Vector Line
    if (!cache.clearanceLine) {
      const clearGeo = new THREE.BufferGeometry();
      const clearMat = new THREE.LineDashedMaterial({
        color: 0xf59e0b,
        dashSize: 0.4,
        gapSize: 0.2,
        linewidth: 3,
      });
      cache.clearanceLine = new THREE.Line(clearGeo, clearMat);
      targetGroup.add(cache.clearanceLine);
    }
    if (closestAgent && closestDist < 8.0) {
      const ca = closestAgent as typeof agents[0];
      const egoFrontX = ego.x + (ego.length / 2) * Math.cos(ego.yaw);
      const egoFrontY = ego.y + (ego.length / 2) * Math.sin(ego.yaw);
      const clearPts = [
        new THREE.Vector3(egoFrontX, egoFrontY, 0.3),
        new THREE.Vector3(ca.x, ca.y, 0.3),
      ];
      cache.clearanceLine.geometry.setFromPoints(clearPts);
      (cache.clearanceLine.material as THREE.LineDashedMaterial).color.setHex(closestDist < 3.0 ? 0xef4444 : 0xf59e0b);
      cache.clearanceLine.computeLineDistances();
      cache.clearanceLine.visible = true;
    } else {
      cache.clearanceLine.visible = false;
    }
  };

  // Build Dynamic Entities for Main Scene
  useEffect(() => {
    if (dynamicGroupRef.current) {
      buildDynamicEntities(dynamicGroupRef.current, sceneModel, false);
    }

    // Camera follow for Main Scene
    if (cameraRef.current && controlsRef.current) {
      const ego = sceneModel.ego;
      if (cameraMode === 'chase') {
        controlsRef.current.enabled = false;
        const chaseDist = 12.0;
        const chaseH = 4.8;
        const camX = ego.x - chaseDist * Math.cos(ego.yaw);
        const camY = ego.y - chaseDist * Math.sin(ego.yaw);
        cameraRef.current.position.set(camX, camY, chaseH);
        cameraRef.current.lookAt(ego.x + 8.0 * Math.cos(ego.yaw), ego.y + 8.0 * Math.sin(ego.yaw), 1.0);
      } else if (cameraMode === 'bird') {
        controlsRef.current.enabled = false;
        cameraRef.current.position.set(ego.x - 2.0, ego.y, 28.0);
        cameraRef.current.lookAt(ego.x + 10.0, ego.y, 0);
      } else if (cameraMode === 'topdown') {
        controlsRef.current.enabled = false;
        cameraRef.current.position.set(ego.x + 10.0, ego.y, 45.0);
        cameraRef.current.lookAt(ego.x + 10.0, ego.y, 0);
      } else if (cameraMode === 'side') {
        controlsRef.current.enabled = false;
        const sideDist = 14.0;
        const camX = ego.x - 4.0 * Math.cos(ego.yaw) - sideDist * Math.sin(ego.yaw);
        const camY = ego.y - 4.0 * Math.sin(ego.yaw) + sideDist * Math.cos(ego.yaw);
        cameraRef.current.position.set(camX, camY, 3.5);
        cameraRef.current.lookAt(ego.x + 4.0 * Math.cos(ego.yaw), ego.y + 4.0 * Math.sin(ego.yaw), 1.2);
      } else if (cameraMode === 'cinematic') {
        controlsRef.current.enabled = false;
        const camX = ego.x + 16.0 * Math.cos(ego.yaw + 0.35);
        const camY = ego.y + 16.0 * Math.sin(ego.yaw + 0.35);
        cameraRef.current.position.set(camX, camY, 1.8);
        cameraRef.current.lookAt(ego.x, ego.y, 1.0);
      } else if (cameraMode === 'cockpit') {
        controlsRef.current.enabled = false;
        const cockpitX = ego.x + (ego.length * 0.15) * Math.cos(ego.yaw);
        const cockpitY = ego.y + (ego.length * 0.15) * Math.sin(ego.yaw);
        cameraRef.current.position.set(cockpitX, cockpitY, 1.25);
        cameraRef.current.lookAt(ego.x + 20.0 * Math.cos(ego.yaw), ego.y + 20.0 * Math.sin(ego.yaw), 1.0);
      } else if (cameraMode === 'orbit') {
        controlsRef.current.enabled = true;
        controlsRef.current.target.set(ego.x, ego.y, 1.0);
      }
    }
  }, [sceneModel, selectedAgentId, cameraMode, plannerId, showScanner]);

  // Reset Camera action handler
  useEffect(() => {
    if (resetCameraTrigger && resetCameraTrigger > 0 && cameraRef.current && controlsRef.current) {
      const ego = sceneModel.ego;
      controlsRef.current.target.set(ego.x, ego.y, 1.0);
      cameraRef.current.position.set(ego.x - 12.0, ego.y, 5.0);
      cameraRef.current.lookAt(ego.x + 8.0, ego.y, 1.0);
      controlsRef.current.update();
    }
  }, [resetCameraTrigger]);

  // Update Renderer Settings on graphicsQuality prop change
  useEffect(() => {
    const rnd = rendererRef.current;
    if (!rnd) return;
    if (graphicsQuality === 'performance') {
      rnd.setPixelRatio(1.0);
      rnd.shadowMap.enabled = false;
    } else if (graphicsQuality === 'high_fidelity') {
      rnd.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      rnd.shadowMap.enabled = true;
      rnd.shadowMap.type = THREE.PCFSoftShadowMap;
    } else {
      rnd.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      rnd.shadowMap.enabled = true;
      rnd.shadowMap.type = THREE.PCFShadowMap;
    }
    rnd.shadowMap.needsUpdate = true;
  }, [graphicsQuality]);

  // Build Dynamic Entities for Compare Scene
  useEffect(() => {
    if (compareDynamicGroupRef.current && compareSceneModel) {
      buildDynamicEntities(compareDynamicGroupRef.current, compareSceneModel, true);
    }

    if (compareCameraRef.current && compareSceneModel) {
      const ego = compareSceneModel.ego;
      if (cameraMode === 'chase') {
        const chaseDist = 12.0;
        const chaseH = 4.8;
        compareCameraRef.current.position.set(
          ego.x - chaseDist * Math.cos(ego.yaw),
          ego.y - chaseDist * Math.sin(ego.yaw),
          chaseH
        );
        compareCameraRef.current.lookAt(ego.x + 8.0 * Math.cos(ego.yaw), ego.y + 8.0 * Math.sin(ego.yaw), 1.0);
      } else if (cameraMode === 'bird') {
        compareCameraRef.current.position.set(ego.x - 2.0, ego.y, 28.0);
        compareCameraRef.current.lookAt(ego.x + 10.0, ego.y, 0);
      } else if (cameraMode === 'topdown') {
        compareCameraRef.current.position.set(ego.x + 10.0, ego.y, 45.0);
        compareCameraRef.current.lookAt(ego.x + 10.0, ego.y, 0);
      } else if (cameraMode === 'side') {
        const sideDist = 14.0;
        compareCameraRef.current.position.set(
          ego.x - 4.0 * Math.cos(ego.yaw) - sideDist * Math.sin(ego.yaw),
          ego.y - 4.0 * Math.sin(ego.yaw) + sideDist * Math.cos(ego.yaw),
          3.5
        );
        compareCameraRef.current.lookAt(ego.x + 4.0 * Math.cos(ego.yaw), ego.y + 4.0 * Math.sin(ego.yaw), 1.2);
      } else if (cameraMode === 'cinematic') {
        compareCameraRef.current.position.set(
          ego.x + 16.0 * Math.cos(ego.yaw + 0.35),
          ego.y + 16.0 * Math.sin(ego.yaw + 0.35),
          1.8
        );
        compareCameraRef.current.lookAt(ego.x, ego.y, 1.0);
      } else if (cameraMode === 'cockpit') {
        const cockpitX = ego.x + (ego.length * 0.15) * Math.cos(ego.yaw);
        const cockpitY = ego.y + (ego.length * 0.15) * Math.sin(ego.yaw);
        compareCameraRef.current.position.set(cockpitX, cockpitY, 1.25);
        compareCameraRef.current.lookAt(ego.x + 20.0 * Math.cos(ego.yaw), ego.y + 20.0 * Math.sin(ego.yaw), 1.0);
      }
    }
  }, [compareSceneModel, cameraMode, showScanner]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: cameraMode === 'orbit' ? 'grab' : 'default',
        }}
        onClick={(e) => {
          if (!onSelectAgent || !mountRef.current || !cameraRef.current || !sceneRef.current) return;
          const rect = mountRef.current.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, cameraRef.current);
          if (dynamicGroupRef.current) {
            const intersects = raycaster.intersectObjects(dynamicGroupRef.current.children, true);
            if (intersects.length > 0) {
              let obj: THREE.Object3D | null = intersects[0].object;
              while (obj && obj.parent && obj.parent !== dynamicGroupRef.current) {
                if (obj.name && obj.name.startsWith('agent_')) {
                  onSelectAgent(obj.name.replace('agent_', ''));
                  return;
                }
                obj = obj.parent;
              }
            } else {
              onSelectAgent(null);
            }
          }
        }}
      />

      {/* Atmospheric Scenery & Scanner Compliance Notice */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '12px',
          zIndex: 10,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '4px',
        }}
      >
        {showScanner && (
          <span
            style={{
              fontSize: '0.65rem',
              color: '#38BDF8',
              backgroundColor: 'rgba(11, 12, 15, 0.88)',
              border: '1px solid #0284C7',
              borderRadius: '4px',
              padding: '2px 8px',
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          >
            SYNTHETIC SCANNER VISUALIZATION — NOT ENGINE SENSOR OUTPUT
          </span>
        )}
        <span
          style={{
            fontSize: '0.65rem',
            color: '#64748B',
            backgroundColor: 'rgba(11, 12, 15, 0.85)',
            border: '1px solid #1E2430',
            borderRadius: '4px',
            padding: '2px 8px',
            fontFamily: 'monospace',
          }}
        >
          Rendered from simulation state · Scenery outside corridor (SCENERY — NOT SIMULATED)
        </span>
      </div>

      {/* Compare Viewport Headers (when dual viewport is active) */}
      {compareSceneModel && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              backgroundColor: 'rgba(10, 15, 26, 0.9)',
              backdropFilter: 'blur(16px)',
              border: '1px solid #2DD4BF',
              borderRadius: '8px',
              padding: '6px 12px',
              zIndex: 15,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 20px rgba(45, 212, 191, 0.25)',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2DD4BF', boxShadow: '0 0 10px #2DD4BF' }} />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2DD4BF', letterSpacing: '0.04em' }}>
                OUR SOLUTION: ADAPTIVE-PATH (P3)
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                Conformal Risk Optimization · Active Bypass · Clearance: 0.78m
              </div>
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '52%',
              backgroundColor: 'rgba(10, 15, 26, 0.9)',
              backdropFilter: 'blur(16px)',
              border: '1px solid #EF4444',
              borderRadius: '8px',
              padding: '6px 12px',
              zIndex: 15,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444', boxShadow: '0 0 10px #EF4444' }} />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#F87171', letterSpacing: '0.04em' }}>
                NORMAL AUTONOMOUS CAR (B1 BASELINE)
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                Standard DWA + Velocity Obstacles · Freezing Robot Problem · Collision at 7.3s
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

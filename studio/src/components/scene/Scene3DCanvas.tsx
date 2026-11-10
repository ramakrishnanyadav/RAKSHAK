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

export type CameraMode = 'chase' | 'bird' | 'topdown' | 'cockpit' | 'orbit';

export interface Scene3DCanvasProps {
  sceneModel: SceneModel;
  compareSceneModel?: SceneModel | null; // For single-canvas dual-viewport compare mode
  cameraMode: CameraMode;
  onSelectAgent?: (agentId: string | null) => void;
  selectedAgentId?: string | null;
  plannerId?: string;
  showScanner?: boolean;
  showSceneryTraffic?: boolean;
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

// Roadside Scenery outside corridor (trees, ambient traffic, street lamps, guardrails, labeled SCENERY — NOT SIMULATED)
function setupRoadsideScenery(
  targetScene: THREE.Scene,
  ambientTrackerList?: AmbientVehicleTracker[]
) {
  const sceneryGroup = new THREE.Group();
  sceneryGroup.name = 'decorative_scenery';

  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.7 });
  const lampFixtureMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfef08a, emissiveIntensity: 1.5 });
  const guardrailMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.8 });

  // 1. Streetlamps along left (y = 6.8) and right (y = -6.8) outside drivable corridor every 25m
  for (let x = -10; x <= 95; x += 25) {
    [-6.8, 6.8].forEach((y) => {
      const poleGroup = new THREE.Group();
      poleGroup.position.set(x, y, 0);

      // Vertical pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.6), lampPoleMat);
      pole.rotation.x = Math.PI / 2;
      pole.position.set(0, 0, 2.3);
      poleGroup.add(pole);

      // Overhang Arm pointing toward road
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4), lampPoleMat);
      arm.position.set(0, y > 0 ? -0.7 : 0.7, 4.5);
      poleGroup.add(arm);

      // Light Fixture
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.1), lampFixtureMat);
      fixture.position.set(0, y > 0 ? -1.3 : 1.3, 4.45);
      poleGroup.add(fixture);

      // Downward Streetlight cone
      const spot = new THREE.SpotLight(0xfffbeb, 0.7, 18, 0.55, 0.5, 1);
      spot.position.set(x, y > 0 ? y - 1.3 : y + 1.3, 4.4);
      spot.target.position.set(x, y > 0 ? y - 2.5 : y + 2.5, 0);
      sceneryGroup.add(spot.target);
      sceneryGroup.add(spot);

      sceneryGroup.add(poleGroup);
    });
  }

  // 2. Guardrails along left (y = 5.8) and right (y = -5.8) outside road shoulder
  [-5.8, 5.8].forEach((y) => {
    const railGeo = new THREE.BoxGeometry(115, 0.06, 0.28);
    const rail = new THREE.Mesh(railGeo, guardrailMat);
    rail.position.set(40, y, 0.65);
    sceneryGroup.add(rail);

    // Support posts every 4m
    for (let x = -15; x <= 95; x += 4) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75), guardrailMat);
      post.rotation.x = Math.PI / 2;
      post.position.set(x, y, 0.375);
      sceneryGroup.add(post);
    }
  });

  // 3. Roadside Trees outside the drivable corridor (y = ±8.5m to ±14.0m)
  const leftTreePositions = [
    { x: -15, y: 9.2, type: 'deciduous' as const, s: 1.1 },
    { x: 0, y: 11.5, type: 'pine' as const, s: 1.25 },
    { x: 15, y: 8.8, type: 'deciduous' as const, s: 0.95 },
    { x: 30, y: 12.0, type: 'pine' as const, s: 1.3 },
    { x: 45, y: 9.0, type: 'deciduous' as const, s: 1.15 },
    { x: 60, y: 11.2, type: 'deciduous' as const, s: 1.0 },
    { x: 75, y: 8.6, type: 'pine' as const, s: 1.2 },
    { x: 90, y: 10.5, type: 'deciduous' as const, s: 1.05 },
    { x: 105, y: 9.0, type: 'pine' as const, s: 1.15 },
  ];
  leftTreePositions.forEach((tp) => {
    const tree = createTreeMesh(tp.type, tp.s);
    tree.position.set(tp.x, tp.y, 0);
    tree.rotation.z = Math.random() * Math.PI * 2;
    sceneryGroup.add(tree);
  });

  const rightTreePositions = [
    { x: -12, y: -9.5, type: 'pine' as const, s: 1.2 },
    { x: 5, y: -11.0, type: 'deciduous' as const, s: 1.05 },
    { x: 20, y: -8.8, type: 'deciduous' as const, s: 1.1 },
    { x: 35, y: -12.2, type: 'pine' as const, s: 1.35 },
    { x: 50, y: -9.0, type: 'deciduous' as const, s: 0.95 },
    { x: 65, y: -11.5, type: 'pine' as const, s: 1.25 },
    { x: 80, y: -8.9, type: 'deciduous' as const, s: 1.1 },
    { x: 95, y: -10.8, type: 'deciduous' as const, s: 1.0 },
  ];
  rightTreePositions.forEach((tp) => {
    const tree = createTreeMesh(tp.type, tp.s);
    tree.position.set(tp.x, tp.y, 0);
    tree.rotation.z = Math.random() * Math.PI * 2;
    sceneryGroup.add(tree);
  });

  // 4. Ambient Parallel Traffic Lanes (Cruising in distant parallel lanes at y = +13.5m and -13.5m)
  const ambientDefs = [
    { x: 10, y: 13.5, type: 'sedan' as const, color: 0x3b82f6, speed: 7.5, dir: 1 },
    { x: 55, y: 13.5, type: 'suv' as const, color: 0x64748b, speed: 6.8, dir: 1 },
    { x: 95, y: 13.5, type: 'truck' as const, color: 0xd97706, speed: 5.5, dir: 1 },
    { x: 25, y: -13.5, type: 'sedan' as const, color: 0x10b981, speed: 8.0, dir: -1 },
    { x: 70, y: -13.5, type: 'suv' as const, color: 0x8b5cf6, speed: 7.2, dir: -1 },
  ];

  ambientDefs.forEach((ad) => {
    const veh = createSceneryTrafficVehicle(ad.type, ad.color);
    veh.position.set(ad.x, ad.y, 0);
    veh.rotation.z = ad.dir > 0 ? 0 : Math.PI; // Heading forward or backward
    sceneryGroup.add(veh);

    if (ambientTrackerList) {
      ambientTrackerList.push({
        mesh: veh,
        speed: ad.speed,
        direction: ad.dir,
        minX: -25,
        maxX: 115,
      });
    }
  });

  // 5. Roadside Architecture & Buildings (Distant background outside corridor, y = ±20m to ±28m)
  const buildings = [
    { type: 'office' as const, x: 16, y: 25, w: 10, l: 15, h: 14 },
    { type: 'warehouse' as const, x: 52, y: 26, w: 12, l: 20, h: 8 },
    { type: 'shop' as const, x: 80, y: 18.5, w: 4.5, l: 7, h: 3.2 },
    { type: 'office' as const, x: -6, y: -24, w: 9, l: 13, h: 11 },
    { type: 'warehouse' as const, x: 42, y: -27, w: 11, l: 18, h: 7.5 },
    { type: 'shop' as const, x: 72, y: -19.5, w: 4.5, l: 6.5, h: 3.2 },
  ];
  buildings.forEach((b) => {
    const bMesh = createRoadsideBuildingMesh(b.type, b.w, b.l, b.h);
    bMesh.position.set(b.x, b.y, 0);
    sceneryGroup.add(bMesh);
  });

  // 6. Overhead Highway Gantry Signs (Spanning across corridor at x = 2m and x = 65m, clearance = 6.8m)
  const gantry1 = createHighwayGantryMesh(18.0, 6.8);
  gantry1.position.set(2.0, 0, 0);
  sceneryGroup.add(gantry1);

  const gantry2 = createHighwayGantryMesh(18.0, 6.8);
  gantry2.position.set(65.0, 0, 0);
  sceneryGroup.add(gantry2);

  // 7. Iconic Indian Highway Milestones (Placed along roadside verge at x = 12m and x = 55m)
  const milestone1 = createIndianMilestoneMesh(42);
  milestone1.position.set(12.0, -5.4, 0);
  milestone1.rotation.z = Math.PI / 2;
  sceneryGroup.add(milestone1);

  const milestone2 = createIndianMilestoneMesh(43);
  milestone2.position.set(55.0, -5.4, 0);
  milestone2.rotation.z = Math.PI / 2;
  sceneryGroup.add(milestone2);

  // 8. Highway Billboard Display (x = 34m, y = 22m)
  const billboard = createHighwayBillboardMesh(7.0, 3.8, 6.5);
  billboard.position.set(34.0, 22.0, 0);
  billboard.rotation.z = -0.15;
  sceneryGroup.add(billboard);

  // 9. Alternating Yellow and Black Road Boundary Kerb Stones
  const kerbLength = 110;
  const kerbSegments = 55;
  const kerbWidth = 0.25;
  const kerbHeight = 0.18;
  const kerbYellowMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.7 });
  const kerbBlackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

  [-5.15, 5.15].forEach((yPos) => {
    for (let i = 0; i < kerbSegments; i++) {
      const segL = kerbLength / kerbSegments;
      const xPos = -15 + i * segL + segL / 2;
      const kMat = i % 2 === 0 ? kerbYellowMat : kerbBlackMat;
      const kMesh = new THREE.Mesh(new THREE.BoxGeometry(segL * 0.96, kerbWidth, kerbHeight), kMat);
      kMesh.position.set(xPos, yPos, kerbHeight / 2);
      sceneryGroup.add(kMesh);
    }
  });

  // 10. Indian Highway Regulatory Speed Limit Sign (40 km/h) at roadside verge
  const speedSign = createHighwaySpeedSignMesh(40);
  speedSign.position.set(8.0, 5.8, 0);
  sceneryGroup.add(speedSign);

  // 11. Reflective Traffic Safety Cones Cluster (Road Work / Hazard Buffer)
  const cones = createTrafficConesGroup(5, 2.0);
  cones.position.set(36.0, 5.5, 0);
  sceneryGroup.add(cones);

  // 12. Crash Attenuator Barrels / Safety Drums near highway gantry pillars
  const drums1 = createRoadsideDrumsMesh(3);
  drums1.position.set(0.5, -7.5, 0);
  sceneryGroup.add(drums1);

  const drums2 = createRoadsideDrumsMesh(3);
  drums2.position.set(63.5, -7.5, 0);
  sceneryGroup.add(drums2);

  targetScene.add(sceneryGroup);
}

export const Scene3DCanvas: React.FC<Scene3DCanvasProps> = ({
  sceneModel,
  compareSceneModel,
  cameraMode,
  onSelectAgent,
  selectedAgentId,
  plannerId = 'P3',
  showScanner = true,
  showSceneryTraffic = true,
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
      setupRoadsideScenery(targetScene, trackers);
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
      rendererRef.current?.dispose();
    };
  }, [showSceneryTraffic]);

  // Populate Road & Infrastructure Helper
  const buildRoadInfrastructure = (targetGroup: THREE.Group, model: SceneModel) => {
    while (targetGroup.children.length > 0) {
      targetGroup.remove(targetGroup.children[0]);
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
      buildRoadInfrastructure(roadGroupRef.current, sceneModel);
    }
  }, [sceneModel.bounds, sceneModel.roadBoundaries, sceneModel.staticObstacles]);

  // Build Road for Compare Scene
  useEffect(() => {
    if (compareRoadGroupRef.current && compareSceneModel) {
      buildRoadInfrastructure(compareRoadGroupRef.current, compareSceneModel);
    }
  }, [compareSceneModel?.bounds, compareSceneModel?.roadBoundaries, compareSceneModel?.staticObstacles]);

  // Populate Dynamic Entities Helper
  const buildDynamicEntities = (
    targetGroup: THREE.Group,
    model: SceneModel,
    isSecondary: boolean
  ) => {
    while (targetGroup.children.length > 0) {
      targetGroup.remove(targetGroup.children[0]);
    }

    const { ego, agents, plannedTrajectory } = model;
    const isP3 = !isSecondary && plannerId.toUpperCase().includes('P3');

    // 1. Ego Vehicle with dynamic chassis pitch & roll suspension dynamics
    const egoMesh = createEgoVehicleMesh(ego, isP3);
    egoMesh.position.set(ego.x, ego.y, 0);
    const accel = ego.acceleration ?? 0;
    const steering = ego.steering ?? 0;
    const pitchAngle = Math.max(-0.06, Math.min(0.06, -accel * 0.012));
    const rollAngle = Math.max(-0.04, Math.min(0.04, -steering * 0.06));
    egoMesh.rotation.order = 'ZYX';
    egoMesh.rotation.set(rollAngle, pitchAngle, ego.yaw);
    targetGroup.add(egoMesh);

    // 1b. Forward Headlight Illumination Beam on Road Surface
    const headlightBeam = createHeadlightBeamMesh(ego.length || 4.4);
    egoMesh.add(headlightBeam);

    // 1c. Forward Multi-Sensor LiDAR / Radar Scanner Sweep Fan
    if (showScanner) {
      const scannerSweep = createScannerSweepGroup(ego.length || 4.4);
      egoMesh.add(scannerSweep);
    }

    // 2. Planned Trajectory Ribbon
    if (plannedTrajectory && plannedTrajectory.length > 1) {
      const pts = plannedTrajectory.map((p) => new THREE.Vector3(p.x, p.y, 0.08));
      const trajGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const trajMat = new THREE.LineBasicMaterial({
        color: isP3 ? 0x2dd4bf : 0x94a3b8,
        linewidth: 4,
      });
      const trajLine = new THREE.Line(trajGeo, trajMat);
      targetGroup.add(trajLine);

      // Trajectory Waypoint Discs on Asphalt
      pts.forEach((pt, idx) => {
        if (idx % 2 === 0) {
          const dotGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.03, 12);
          const dotMat = new THREE.MeshBasicMaterial({ color: isP3 ? 0x2dd4bf : 0x94a3b8 });
          const dot = new THREE.Mesh(dotGeo, dotMat);
          dot.rotation.x = Math.PI / 2; // Upright along Z
          dot.position.copy(pt);
          targetGroup.add(dot);
        }
      });
    }

    // 3. Dynamic Agents
    let closestDist = Infinity;
    let closestAgent: typeof agents[0] | null = null;

    agents.forEach((ag) => {
      const isSelected = !isSecondary && ag.id === selectedAgentId;
      const isOccluded = ag.is_occluded;

      // Distance from Ego
      const dist = Math.hypot(ag.x - ego.x, ag.y - ego.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestAgent = ag;
      }

      // Realistic Procedural 3D Mesh
      const agentCompound = createAgentMesh(ag);
      agentCompound.position.set(ag.x, ag.y, 0);
      agentCompound.rotation.z = ag.yaw;

      if (isOccluded) {
        agentCompound.traverse((c) => {
          if ((c as THREE.Mesh).material) {
            const mat = (c as THREE.Mesh).material as THREE.Material;
            mat.transparent = true;
            mat.opacity = 0.35;
          }
        });
      }
      targetGroup.add(agentCompound);

      // Bounding Box colored by risk_level
      const l = ag.length || 2.4;
      const w = ag.width || 1.1;
      const h = ag.class_name === 'truck' ? 2.8 : ag.class_name === 'cattle' ? 1.48 : 1.5;
      const bboxGeo = new THREE.BoxGeometry(l, w, h);
      const bboxEdges = new THREE.EdgesGeometry(bboxGeo);

      const riskColor =
        model.telemetry.riskLevel === 'CRITICAL'
          ? 0xef4444
          : model.telemetry.riskLevel === 'HIGH'
          ? 0xf59e0b
          : 0x2dd4bf;

      const bboxMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0xffffff : riskColor,
        linewidth: isSelected ? 3 : 1.5,
      });
      const bboxMesh = new THREE.LineSegments(bboxEdges, bboxMat);
      bboxMesh.position.set(ag.x, ag.y, h / 2);
      bboxMesh.rotation.z = ag.yaw;
      targetGroup.add(bboxMesh);

      // Apollo Dreamview Perception HUD Tag Floating Above Agent
      const tagHeight = h + 0.65;
      const speed = Math.hypot(ag.v_x, ag.v_y);
      const isCritical = dist < 3.2;
      const tagSprite = createAgentTagSprite(ag.class_name || ag.id, dist, speed, isCritical);
      tagSprite.position.set(ag.x, ag.y, tagHeight);
      targetGroup.add(tagSprite);

      // ADAS Perception Target Reticle when within forward scanning zone
      if (showScanner && dist < 36.0) {
        const isCrit = dist < 2.5 || model.telemetry.riskLevel === 'CRITICAL';
        const reticle = createObstacleScanReticle(
          dist,
          ag.length ? Math.max(ag.length, ag.width) / 2 : 1.2,
          isCrit,
          ag.class_name || ag.id
        );
        reticle.position.set(ag.x, ag.y, 0);
        targetGroup.add(reticle);
      }

      // Multi-hypothesis prediction trajectories (dashed lines with weights)
      if (ag.prediction_hypotheses) {
        ag.prediction_hypotheses.forEach((hyp) => {
          if (!hyp.trajectory || hyp.trajectory.length === 0) return;
          const hypPts = [
            new THREE.Vector3(ag.x, ag.y, 0.1),
            ...hyp.trajectory.map((tp) => new THREE.Vector3(tp.x, tp.y, 0.1)),
          ];
          const hypGeo = new THREE.BufferGeometry().setFromPoints(hypPts);
          const hypMat = new THREE.LineDashedMaterial({
            color: 0xf59e0b,
            dashSize: 0.6,
            gapSize: 0.3,
            transparent: true,
            opacity: Math.max(0.3, hyp.weight),
          });
          const hypLine = new THREE.Line(hypGeo, hypMat);
          hypLine.computeLineDistances();
          targetGroup.add(hypLine);
        });
      }

      // Conformal prediction uncertainty envelopes (Dual-layer: soft disc + glowing boundary ring)
      if (ag.conformal_envelope && ag.conformal_envelope.length > 0) {
        ag.conformal_envelope.forEach((cone) => {
          const radius = cone.radius_m || 1.2;

          // Inner soft luminous disc
          const discGeo = new THREE.CircleGeometry(radius, 32);
          const discMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.14,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const disc = new THREE.Mesh(discGeo, discMat);
          disc.position.set(ag.x, ag.y, 0.03);
          targetGroup.add(disc);

          // Outer sharp glowing ring
          const ringGeo = new THREE.RingGeometry(Math.max(0.1, radius - 0.06), radius, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.position.set(ag.x, ag.y, 0.035);
          targetGroup.add(ringMesh);
        });
      }
    });

    // 4. Static Obstacle Perception Highlights (Potholes, Road Barriers, Stalls)
    if (showScanner && model.staticObstacles) {
      model.staticObstacles.forEach((obs) => {
        const obsDist = Math.hypot(obs.x - ego.x, obs.y - ego.y);
        if (obsDist < 36.0) {
          const isCrit = obsDist < 3.0;
          const reticle = createObstacleScanReticle(
            obsDist,
            (obs.length || 2.0) / 2,
            isCrit,
            obs.kind
          );
          reticle.position.set(obs.x, obs.y, 0);
          targetGroup.add(reticle);
        }
      });
    }

    // 5. Dynamic Safety Clearance Vector to Closest Obstacle (if within 8m)
    if (closestAgent && closestDist < 8.0) {
      const ca = closestAgent as typeof agents[0];
      const egoFrontX = ego.x + (ego.length / 2) * Math.cos(ego.yaw);
      const egoFrontY = ego.y + (ego.length / 2) * Math.sin(ego.yaw);
      const clearPts = [
        new THREE.Vector3(egoFrontX, egoFrontY, 0.3),
        new THREE.Vector3(ca.x, ca.y, 0.3),
      ];
      const clearGeo = new THREE.BufferGeometry().setFromPoints(clearPts);
      const clearMat = new THREE.LineDashedMaterial({
        color: closestDist < 3.0 ? 0xef4444 : 0xf59e0b,
        dashSize: 0.4,
        gapSize: 0.2,
        linewidth: 3,
      });
      const clearLine = new THREE.Line(clearGeo, clearMat);
      clearLine.computeLineDistances();
      targetGroup.add(clearLine);
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

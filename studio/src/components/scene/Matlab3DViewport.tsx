/**
 * High-Performance 3D Vehicle Simulation Viewport for MATLAB Validation Studio.
 * Centerpiece engineering workstation powered by Three.js.
 * 
 * Features:
 * - High-realism 3D autonomous passenger vehicle with metallic body, tinted glass cabin,
 *   LED projector headlights, rooftop LiDAR sensor pod, and rolling wheels.
 * - Dynamic front wheel steering linkage that pivots wheels by actual steering angle (pt.m_steer).
 * - Real asphalt road environment dynamically generated to match scenario geometry:
 *   - Continuous multi-lane highway corridor with dashed centerlines, solid white curbs,
 *     paved shoulders, gravel verges, station distance markers, and start/finish gates.
 *   - Curved and angled corridors aligned to scenario reference trajectory.
 *   - Straight test track with marked lane boundaries and safety run-off apron for Scenario H.
 * - 5 Glitch-free camera perspectives: Chase (fixed behind vehicle), Cockpit (driver eye view),
 *   Top-Down (overhead bird's-eye), Side (wheel inspection), and Free Orbit.
 * - Measured rendering FPS and frame time via high-resolution performance.now() delta.
 * - Responsive fullscreen support and unified compact simulation control bar.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Play, Pause, RotateCcw, Video, Layers, Sliders, Eye, Activity, Maximize2, Minimize2 } from 'lucide-react';

export interface ParityPoint {
  step: number;
  time: number;
  py_x: number;
  m_x: number;
  err_x: number;
  py_y: number;
  m_y: number;
  err_y: number;
  py_yaw: number;
  m_yaw: number;
  err_yaw_deg: number;
  py_steer: number;
  m_steer: number;
  py_v?: number;
  m_v?: number;
}

export type CameraViewMode = 'chase' | 'cockpit' | 'topdown' | 'side' | 'orbit';
export type RenderQualityMode = 'performance' | 'balanced' | 'high';

interface Matlab3DViewportProps {
  points: ParityPoint[];
  currentStep: number;
  onStepChange: (step: number) => void;
  isPlaying: boolean;
  onPlayPauseToggle: () => void;
  onReset: () => void;
  scenarioName: string;
}

// Procedural multi-frequency PBR asphalt texture generated in-memory
function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Dark asphalt base tone
  ctx.fillStyle = '#181b22';
  ctx.fillRect(0, 0, 512, 512);

  // Layer 1: Aggregate noise
  const imgData = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 26;
    imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + noise));
    imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + noise * 0.95));
    imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + noise * 0.9));
  }
  ctx.putImageData(imgData, 0, 0);

  // Layer 2: Subtle tire track wear sheen
  ctx.fillStyle = 'rgba(12, 14, 18, 0.45)';
  ctx.fillRect(80, 0, 110, 512);
  ctx.fillRect(322, 0, 110, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(24, 6);
  return texture;
}

// Procedural contact shadow texture
function createGroundShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 12, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

const groundShadowTex = typeof document !== 'undefined' ? createGroundShadowTexture() : null;

export const Matlab3DViewport: React.FC<Matlab3DViewportProps> = ({
  points,
  currentStep,
  onStepChange,
  isPlaying,
  onPlayPauseToggle,
  onReset,
  scenarioName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulation controls state
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('chase');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [qualityMode, setQualityMode] = useState<RenderQualityMode>('balanced');
  const [fps, setFps] = useState<number>(60);
  const [frameTimeMs, setFrameTimeMs] = useState<number>(16.6);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // References to keep Three.js animation loop fast and allocation-free
  const animFrameIdRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Three.js object handles
  const egoGroupRef = useRef<THREE.Group | null>(null);
  const frontLeftWheelRef = useRef<THREE.Group | null>(null);
  const frontRightWheelRef = useRef<THREE.Group | null>(null);
  const rearLeftWheelRef = useRef<THREE.Group | null>(null);
  const rearRightWheelRef = useRef<THREE.Group | null>(null);
  const wheelMeshesRef = useRef<THREE.Mesh[]>([]);
  const roadGroupRef = useRef<THREE.Group | null>(null);
  const pyPathLineRef = useRef<THREE.Line | null>(null);
  const mPathLineRef = useRef<THREE.Line | null>(null);

  // Step tracking for continuous playback loop
  const currentStepRef = useRef<number>(currentStep);
  currentStepRef.current = currentStep;
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  const cameraModeRef = useRef<CameraViewMode>(cameraMode);
  cameraModeRef.current = cameraMode;
  const pointsRef = useRef<ParityPoint[]>(points);
  pointsRef.current = points;

  // Active Telemetry at current step
  const activePt = points[currentStep] || points[0] || {
    step: 0,
    time: 0,
    py_x: 0,
    m_x: 0,
    err_x: 0,
    py_y: 0,
    m_y: 0,
    err_y: 0,
    py_yaw: 0,
    m_yaw: 0,
    err_yaw_deg: 0,
    py_steer: 0,
    m_steer: 0,
  };

  const speedKmh = useMemo(() => {
    if (points.length < 2) return 0;
    const v = activePt.m_v ?? activePt.py_v ?? 10.0;
    return (v * 3.6).toFixed(1);
  }, [activePt, points]);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Build Procedural Road Infrastructure matched to Scenario
  const buildRoadInfrastructure = useCallback((scene: THREE.Scene, pts: ParityPoint[]) => {
    if (roadGroupRef.current) {
      scene.remove(roadGroupRef.current);
      roadGroupRef.current = null;
    }

    const roadGroup = new THREE.Group();
    roadGroup.name = 'matlab_road_environment';

    const asphaltTex = createAsphaltTexture();
    const isScenarioH = scenarioName.includes('H') || scenarioName.includes('Reversal');
    const isCurved = pts.length > 10 && pts.some((p) => Math.abs(p.py_y) > 4.0 && !isScenarioH);

    // Calculate longitudinal extent
    let minX = -30.0;
    let maxX = 550.0;
    if (pts.length > 0) {
      const allX = pts.map((p) => p.py_x);
      minX = Math.min(-20.0, Math.min(...allX) - 20.0);
      maxX = Math.max(100.0, Math.max(...allX) + 40.0);
    }
    const roadLength = maxX - minX;
    const roadCenterX = (minX + maxX) / 2;

    const roadWidth = 9.0; // Two 4.5m lanes
    const shoulderWidth = 2.5;

    if (!isCurved) {
      // 1. Main Asphalt Surface
      const roadGeo = new THREE.PlaneGeometry(roadLength, roadWidth);
      const roadMat = new THREE.MeshStandardMaterial({
        map: asphaltTex,
        roughness: 0.82,
        metalness: 0.12,
      });
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.position.set(roadCenterX, 0, 0.02);
      roadMesh.receiveShadow = true;
      roadGroup.add(roadMesh);

      // 2. Unpaved Earth / Gravel Shoulders along Left & Right Verges
      const shoulderGeo = new THREE.PlaneGeometry(roadLength, shoulderWidth);
      const shoulderMat = new THREE.MeshStandardMaterial({
        color: 0x1c1917,
        roughness: 0.95,
        metalness: 0.05,
      });

      const leftShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
      leftShoulder.position.set(roadCenterX, roadWidth / 2 + shoulderWidth / 2, 0.015);
      leftShoulder.receiveShadow = true;
      roadGroup.add(leftShoulder);

      const rightShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
      rightShoulder.position.set(roadCenterX, -roadWidth / 2 - shoulderWidth / 2, 0.015);
      rightShoulder.receiveShadow = true;
      roadGroup.add(rightShoulder);

      // 3. For Scenario H: Wide Safety Run-off Apron
      if (isScenarioH) {
        const apronWidth = 35.0;
        const apronGeo = new THREE.PlaneGeometry(roadLength, apronWidth);
        const apronMat = new THREE.MeshStandardMaterial({
          color: 0x111622,
          roughness: 0.9,
          metalness: 0.1,
        });
        const apronMesh = new THREE.Mesh(apronGeo, apronMat);
        apronMesh.position.set(roadCenterX, 0, 0.01);
        apronMesh.receiveShadow = true;
        roadGroup.add(apronMesh);

        // Run-off hazard stripes along boundary
        const hazardGeo = new THREE.PlaneGeometry(roadLength, 0.4);
        const hazardMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        [-apronWidth / 2, apronWidth / 2].forEach((yOff) => {
          const hMesh = new THREE.Mesh(hazardGeo, hazardMat);
          hMesh.position.set(roadCenterX, yOff, 0.018);
          roadGroup.add(hMesh);
        });
      }

      // 4. Solid White Road Curbs / Edge Lines
      const curbGeo = new THREE.PlaneGeometry(roadLength, 0.22);
      const curbMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
      [-roadWidth / 2, roadWidth / 2].forEach((offsetY) => {
        const curb = new THREE.Mesh(curbGeo, curbMat);
        curb.position.set(roadCenterX, offsetY, 0.026);
        roadGroup.add(curb);
      });

      // 5. Center Dashed Line (White/Cyan 4m dash, 4m gap down Y = 0)
      const dashLength = 4.0;
      const gapLength = 4.0;
      const numDashes = Math.floor(roadLength / (dashLength + gapLength));
      const dashGeo = new THREE.PlaneGeometry(dashLength, 0.20);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
      for (let i = 0; i < numDashes; i++) {
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.position.set(minX + i * (dashLength + gapLength) + dashLength / 2, 0, 0.028);
        roadGroup.add(dash);
      }

      // 6. Station Distance Markers every 25m
      for (let x = 0; x <= maxX; x += 25) {
        const tickGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, -roadWidth / 2 - 0.2, 0.03),
          new THREE.Vector3(x, -roadWidth / 2 - 1.2, 0.03),
        ]);
        const tickLine = new THREE.Line(tickGeo, new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 2 }));
        roadGroup.add(tickLine);
      }

      // 7. Checkered Starting Line at X = 0 and Finish Gate at maxX - 20
      const startLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -roadWidth / 2, 0.035),
        new THREE.Vector3(0, roadWidth / 2, 0.035),
      ]);
      const startLine = new THREE.Line(startLineGeo, new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 }));
      roadGroup.add(startLine);

      const finishLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(maxX - 20, -roadWidth / 2, 0.035),
        new THREE.Vector3(maxX - 20, roadWidth / 2, 0.035),
      ]);
      const finishLine = new THREE.Line(finishLineGeo, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3 }));
      roadGroup.add(finishLine);
    } else {
      // Curved corridor: Build road mesh along reference points
      const leftBoundaryPts: THREE.Vector3[] = [];
      const rightBoundaryPts: THREE.Vector3[] = [];
      const halfW = roadWidth / 2;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        let yaw = p.py_yaw;
        if (i < pts.length - 1) {
          const dx = pts[i + 1].py_x - p.py_x;
          const dy = pts[i + 1].py_y - p.py_y;
          if (Math.hypot(dx, dy) > 0.01) yaw = Math.atan2(dy, dx);
        }
        const nx = -Math.sin(yaw);
        const ny = Math.cos(yaw);

        leftBoundaryPts.push(new THREE.Vector3(p.py_x + halfW * nx, p.py_y + halfW * ny, 0.025));
        rightBoundaryPts.push(new THREE.Vector3(p.py_x - halfW * nx, p.py_y - halfW * ny, 0.025));
      }

      // Build road polygon shape
      const shape = new THREE.Shape();
      if (leftBoundaryPts.length > 1) {
        shape.moveTo(leftBoundaryPts[0].x, leftBoundaryPts[0].y);
        for (let i = 1; i < leftBoundaryPts.length; i++) shape.lineTo(leftBoundaryPts[i].x, leftBoundaryPts[i].y);
        for (let i = rightBoundaryPts.length - 1; i >= 0; i--) shape.lineTo(rightBoundaryPts[i].x, rightBoundaryPts[i].y);
        shape.closePath();

        const roadGeo = new THREE.ShapeGeometry(shape);
        const roadMat = new THREE.MeshStandardMaterial({
          color: 0x181b22,
          roughness: 0.85,
          metalness: 0.12,
        });
        const roadMesh = new THREE.Mesh(roadGeo, roadMat);
        roadMesh.position.z = 0.02;
        roadMesh.receiveShadow = true;
        roadGroup.add(roadMesh);

        // Left curb
        const leftGeo = new THREE.BufferGeometry().setFromPoints(leftBoundaryPts);
        const curbMat = new THREE.LineBasicMaterial({ color: 0xf8fafc, linewidth: 3 });
        roadGroup.add(new THREE.Line(leftGeo, curbMat));

        // Right curb
        const rightGeo = new THREE.BufferGeometry().setFromPoints(rightBoundaryPts);
        roadGroup.add(new THREE.Line(rightGeo, curbMat));
      }
    }

    scene.add(roadGroup);
    roadGroupRef.current = roadGroup;
  }, [scenarioName]);

  // Build Trajectory Lines
  const updateTrajectoryLines = useCallback((scene: THREE.Scene, pts: ParityPoint[]) => {
    if (pyPathLineRef.current) scene.remove(pyPathLineRef.current);
    if (mPathLineRef.current) scene.remove(mPathLineRef.current);

    if (pts.length < 2) return;

    // Python Reference line (Cyan)
    const pyPoints = pts.map((p) => new THREE.Vector3(p.py_x, p.py_y, 0.06));
    const pyGeo = new THREE.BufferGeometry().setFromPoints(pyPoints);
    const pyMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 3,
      transparent: true,
      opacity: 0.92,
    });
    const pyLine = new THREE.Line(pyGeo, pyMat);
    pyLine.name = 'py_ref_trajectory';
    scene.add(pyLine);
    pyPathLineRef.current = pyLine;

    // Simulink Plant Output line (Violet Dashed)
    const mPoints = pts.map((p) => new THREE.Vector3(p.m_x, p.m_y, 0.07));
    const mGeo = new THREE.BufferGeometry().setFromPoints(mPoints);
    const mMat = new THREE.LineDashedMaterial({
      color: 0xa855f7,
      linewidth: 3,
      dashSize: 1.2,
      gapSize: 0.6,
      transparent: true,
      opacity: 0.95,
    });
    const mLine = new THREE.Line(mGeo, mMat);
    mLine.computeLineDistances();
    mLine.name = 'm_plant_trajectory';
    scene.add(mLine);
    mPathLineRef.current = mLine;
  }, []);

  // Initialize Three.js Scene, Camera, Lights, Road, Ego Vehicle
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.005);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    // 3. Renderer with high-performance settings
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: qualityMode !== 'performance',
        powerPreference: 'high-performance',
        precision: qualityMode === 'performance' ? 'mediump' : 'highp',
      });
    } catch (e) {
      console.warn('WebGL initialization fallback', e);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityMode === 'high' ? 2 : 1.5));
    renderer.shadowMap.enabled = qualityMode === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // 4. Orbit Controls (Used exclusively for 'orbit' mode)
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 2.0;
    controls.maxDistance = 180.0;
    controls.enabled = false;
    controlsRef.current = controls;

    // 5. Environmental Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xe0f2fe, 1.6);
    dirLight.position.set(40, 50, 70);
    dirLight.castShadow = qualityMode === 'high';
    if (dirLight.shadow) {
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 10;
      dirLight.shadow.camera.far = 250;
      dirLight.shadow.camera.left = -60;
      dirLight.shadow.camera.right = 60;
      dirLight.shadow.camera.top = 60;
      dirLight.shadow.camera.bottom = -60;
    }
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-30, -30, 25);
    scene.add(rimLight);

    // 6. Surrounding Dark Ground Plane & Spatial Grid
    const groundGeo = new THREE.PlaneGeometry(1600, 600);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x070b14,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(250, 0, -0.05);
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(600, 60, 0x1e293b, 0x0f172a);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.set(250, 0, -0.04);
    scene.add(gridHelper);

    // 7. Ego Autonomous Passenger Vehicle
    const egoGroup = new THREE.Group();
    egoGroup.name = 'ego_vehicle';

    const vehL = 4.65;
    const vehW = 1.90;
    const vehH = 1.52;

    // Paint Material: Metallic Slate Teal
    const paintMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      roughness: 0.22,
      metalness: 0.85,
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.2,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.05,
      metalness: 0.95,
      transparent: true,
      opacity: 0.75,
    });

    // 7a. Soft Ground Contact Shadow
    if (groundShadowTex) {
      const shadowGeo = new THREE.PlaneGeometry(vehL * 1.15, vehW * 1.25);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: groundShadowTex,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });
      const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.position.z = 0.015;
      egoGroup.add(shadowMesh);
    }

    // 7b. Lower Chassis & Aerodynamic Rocker Panels
    const chassisGeo = new THREE.BoxGeometry(vehL * 0.96, vehW * 0.94, vehH * 0.22);
    const chassis = new THREE.Mesh(chassisGeo, darkTrimMat);
    chassis.position.set(0, 0, vehH * 0.18);
    chassis.castShadow = true;
    egoGroup.add(chassis);

    // 7c. Main Sculpted Body Shell
    const bodyGeo = new THREE.BoxGeometry(vehL * 0.92, vehW * 0.88, vehH * 0.36);
    const body = new THREE.Mesh(bodyGeo, paintMat);
    body.position.set(0, 0, vehH * 0.42);
    body.castShadow = true;
    egoGroup.add(body);

    // 7d. Front Sloped Hood
    const hoodGeo = new THREE.BoxGeometry(vehL * 0.32, vehW * 0.84, vehH * 0.18);
    const hood = new THREE.Mesh(hoodGeo, paintMat);
    hood.position.set(vehL * 0.28, 0, vehH * 0.46);
    hood.rotation.y = 0.06;
    hood.castShadow = true;
    egoGroup.add(hood);

    // 7e. Front Bumper with Lower Grille & Radar Puck
    const bumperGeo = new THREE.BoxGeometry(vehL * 0.12, vehW * 0.86, vehH * 0.24);
    const bumper = new THREE.Mesh(bumperGeo, darkTrimMat);
    bumper.position.set(vehL * 0.45, 0, vehH * 0.22);
    egoGroup.add(bumper);

    const radarPuck = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.22, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.2, metalness: 0.9 })
    );
    radarPuck.position.set(vehL * 0.51, 0, vehH * 0.22);
    egoGroup.add(radarPuck);

    // 7f. Raked Greenhouse Cabin (Tinted Glass)
    const cabinGeo = new THREE.BoxGeometry(vehL * 0.54, vehW * 0.78, vehH * 0.44);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(-vehL * 0.05, 0, vehH * 0.76);
    cabin.castShadow = true;
    egoGroup.add(cabin);

    // Raked Windshield
    const windshieldGeo = new THREE.BoxGeometry(0.12, vehW * 0.74, vehH * 0.46);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(vehL * 0.21, 0, vehH * 0.75);
    windshield.rotation.y = -0.52;
    egoGroup.add(windshield);

    // Body-Colored Roof Panel
    const roofGeo = new THREE.BoxGeometry(vehL * 0.42, vehW * 0.74, 0.04);
    const roof = new THREE.Mesh(roofGeo, paintMat);
    roof.position.set(-vehL * 0.05, 0, vehH * 0.98);
    roof.castShadow = true;
    egoGroup.add(roof);

    // 7g. Autonomous Rooftop Sensor Pod (LiDAR Dome)
    const podGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.16, 20);
    const podMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.2 });
    const sensorPod = new THREE.Mesh(podGeo, podMat);
    sensorPod.rotation.x = Math.PI / 2;
    sensorPod.position.set(0, 0, vehH + 0.10);
    egoGroup.add(sensorPod);

    // 7h. Dual LED Projector Headlights
    [-vehW * 0.38, vehW * 0.38].forEach((offsetY) => {
      const hlMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.26, 0.10),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x38bdf8, emissiveIntensity: 1.5 })
      );
      hlMesh.position.set(vehL * 0.47, offsetY, vehH * 0.38);
      egoGroup.add(hlMesh);

      // Forward Light Beam Fan on Road
      const beamGeo = new THREE.ConeGeometry(3.5, 20, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.rotation.z = -Math.PI / 2;
      beam.position.set(vehL * 0.47 + 10.0, offsetY, 0.15);
      egoGroup.add(beam);
    });

    // Dual Rear LED Taillights
    [-vehW * 0.38, vehW * 0.38].forEach((offsetY) => {
      const tlMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.26, 0.09),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.8 })
      );
      tlMesh.position.set(-vehL * 0.46, offsetY, vehH * 0.42);
      egoGroup.add(tlMesh);
    });

    // 7i. 4 High-Realism Wheels with Front Steering Pivots
    const wheelRadius = vehH * 0.25; // 0.38m
    const wheelWidth = 0.24;
    const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.94, metalness: 0.05 });

    const rimRadius = wheelRadius * 0.68;
    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, wheelWidth * 1.02, 16);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.92 });

    const createdWheelMeshes: THREE.Mesh[] = [];

    const createWheelAssembly = () => {
      const pivotGroup = new THREE.Group();
      const rollingGroup = new THREE.Group();

      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      rollingGroup.add(tire);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rollingGroup.add(rim);

      pivotGroup.add(rollingGroup);
      createdWheelMeshes.push(tire);
      return { pivotGroup, rollingGroup };
    };

    const wheelBaseX = vehL * 0.29; // ~1.35m from center (2.70m wheelbase)
    const trackY = vehW * 0.46; // ~0.87m from center (1.74m track)

    const flAssembly = createWheelAssembly();
    flAssembly.pivotGroup.position.set(wheelBaseX, trackY, wheelRadius);
    egoGroup.add(flAssembly.pivotGroup);
    frontLeftWheelRef.current = flAssembly.pivotGroup;

    const frAssembly = createWheelAssembly();
    frAssembly.pivotGroup.position.set(wheelBaseX, -trackY, wheelRadius);
    egoGroup.add(frAssembly.pivotGroup);
    frontRightWheelRef.current = frAssembly.pivotGroup;

    const rlAssembly = createWheelAssembly();
    rlAssembly.pivotGroup.position.set(-wheelBaseX, trackY, wheelRadius);
    egoGroup.add(rlAssembly.pivotGroup);
    rearLeftWheelRef.current = rlAssembly.pivotGroup;

    const rrAssembly = createWheelAssembly();
    rrAssembly.pivotGroup.position.set(-wheelBaseX, -trackY, wheelRadius);
    egoGroup.add(rrAssembly.pivotGroup);
    rearRightWheelRef.current = rrAssembly.pivotGroup;

    wheelMeshesRef.current = createdWheelMeshes;

    scene.add(egoGroup);
    egoGroupRef.current = egoGroup;

    // Initial Road Infrastructure & Path Lines
    buildRoadInfrastructure(scene, pointsRef.current);
    updateTrajectoryLines(scene, pointsRef.current);

    // 8. Animation & Render Loop with Accurate Measured FPS
    let lastTime = performance.now();
    let frameCounter = 0;
    let fpsTimer = performance.now();
    let subStepAccumulator = 0;
    let rollingWheelAngle = 0;

    const animate = (now: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const deltaSec = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Real measured FPS & frame time computation
      frameCounter++;
      if (now - fpsTimer >= 500) {
        const measuredFps = Math.round((frameCounter * 1000) / (now - fpsTimer));
        const measuredFrameTime = Number((1000 / Math.max(1, measuredFps)).toFixed(1));
        setFps(measuredFps);
        setFrameTimeMs(measuredFrameTime);
        frameCounter = 0;
        fpsTimer = now;
      }

      // Continuous simulation step advancing when playing
      if (isPlayingRef.current && pointsRef.current.length > 0) {
        subStepAccumulator += deltaSec * playbackSpeedRef.current * 20; // 20 Hz simulation rate
        if (subStepAccumulator >= 1.0) {
          const stepsToAdvance = Math.floor(subStepAccumulator);
          subStepAccumulator -= stepsToAdvance;
          const nextStep = (currentStepRef.current + stepsToAdvance) % pointsRef.current.length;
          currentStepRef.current = nextStep;
          onStepChange(nextStep);
        }
      }

      // Update 3D Ego Vehicle Position & Heading
      const pts = pointsRef.current;
      const stepIdx = currentStepRef.current;
      const pt = pts[stepIdx] || pts[0];

      if (egoGroup && pt) {
        egoGroup.position.set(pt.m_x, pt.m_y, 0);
        egoGroup.rotation.z = pt.m_yaw;

        // Front Wheel Steering Angle deflection about Z
        if (frontLeftWheelRef.current && frontRightWheelRef.current) {
          frontLeftWheelRef.current.rotation.z = pt.m_steer;
          frontRightWheelRef.current.rotation.z = pt.m_steer;
        }

        // Rolling Wheel rotation proportional to forward velocity
        const v = pt.m_v ?? pt.py_v ?? 10.0;
        rollingWheelAngle += (v * deltaSec) / wheelRadius;
        wheelMeshesRef.current.forEach((m) => {
          m.rotation.y = rollingWheelAngle;
        });

        // Glitch-Free Camera Control
        const mode = cameraModeRef.current;
        const ctrls = controlsRef.current;

        if (mode === 'chase') {
          if (ctrls) ctrls.enabled = false;
          const chaseDist = 11.0;
          const chaseH = 4.2;
          const camX = pt.m_x - Math.cos(pt.m_yaw) * chaseDist;
          const camY = pt.m_y - Math.sin(pt.m_yaw) * chaseDist;
          camera.position.set(camX, camY, chaseH);
          camera.lookAt(pt.m_x + Math.cos(pt.m_yaw) * 6.0, pt.m_y + Math.sin(pt.m_yaw) * 6.0, 1.2);
        } else if (mode === 'cockpit') {
          if (ctrls) ctrls.enabled = false;
          const cockpitX = pt.m_x + Math.cos(pt.m_yaw) * 0.3;
          const cockpitY = pt.m_y + Math.sin(pt.m_yaw) * 0.3;
          camera.position.set(cockpitX, cockpitY, 1.35);
          camera.lookAt(pt.m_x + Math.cos(pt.m_yaw) * 25.0, pt.m_y + Math.sin(pt.m_yaw) * 25.0, 1.1);
        } else if (mode === 'topdown') {
          if (ctrls) ctrls.enabled = false;
          camera.position.set(pt.m_x + 6.0, pt.m_y, 35.0);
          camera.lookAt(pt.m_x + 6.0, pt.m_y, 0);
        } else if (mode === 'side') {
          if (ctrls) ctrls.enabled = false;
          const sideDist = 4.2;
          const sideX = pt.m_x - Math.sin(pt.m_yaw) * sideDist;
          const sideY = pt.m_y + Math.cos(pt.m_yaw) * sideDist;
          camera.position.set(sideX, sideY, 2.2);
          camera.lookAt(pt.m_x, pt.m_y, 0.8);
        } else if (mode === 'orbit') {
          if (ctrls) {
            ctrls.enabled = true;
            ctrls.target.set(pt.m_x, pt.m_y, 1.0);
            ctrls.update();
          }
        }
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // Handle Window Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      controls.dispose();
    };
  }, [qualityMode, buildRoadInfrastructure, updateTrajectoryLines]);

  // Update Trajectory lines & road when scenario or points change
  useEffect(() => {
    if (sceneRef.current) {
      buildRoadInfrastructure(sceneRef.current, points);
      updateTrajectoryLines(sceneRef.current, points);
    }
  }, [points, buildRoadInfrastructure, updateTrajectoryLines]);

  // Format timestamp helper
  const totalDuration = useMemo(() => {
    return (points[points.length - 1]?.time || 5.0).toFixed(2);
  }, [points]);

  const currentTime = useMemo(() => {
    return (activePt?.time || 0).toFixed(2);
  }, [activePt]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : '540px',
        borderRadius: isFullscreen ? '0' : '14px',
        overflow: 'hidden',
        border: isFullscreen ? 'none' : '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55)',
        background: '#060913',
      }}
    >
      {/* Three.js Canvas Element */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          outline: 'none',
        }}
      />

      {/* TOP-LEFT: Vehicle Dynamics & State Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '14px',
          left: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'rgba(9, 14, 26, 0.88)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            padding: '0.65rem 0.95rem',
            color: '#f8fafc',
            minWidth: '240px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Ego Vehicle Telemetry
            </span>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontFamily: 'monospace' }}>
              Step {currentStep} / {points.length || 100}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem 0.85rem', fontSize: '0.74rem' }}>
            <div>
              <span style={{ color: '#64748b' }}>Speed: </span>
              <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{speedKmh} km/h</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Steer (δ): </span>
              <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>{(activePt.m_steer * 57.2958).toFixed(1)}°</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Yaw (ψ): </span>
              <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>{(activePt.m_yaw * 57.2958).toFixed(1)}°</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Drift (‖e‖): </span>
              <strong style={{ color: activePt.err_x > 1.0 ? '#f59e0b' : '#10b981', fontFamily: 'monospace' }}>
                {Math.sqrt(activePt.err_x ** 2 + activePt.err_y ** 2).toFixed(3)} m
              </strong>
            </div>
          </div>
        </div>

        {/* Legend indicator */}
        <div
          style={{
            background: 'rgba(9, 14, 26, 0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            padding: '0.35rem 0.65rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            fontSize: '0.68rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '3px', background: '#38bdf8', borderRadius: '1px' }} />
            <span style={{ color: '#cbd5e1' }}>Python Ref Track</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '3px', background: '#a855f7', borderRadius: '1px', borderTop: '1px dashed' }} />
            <span style={{ color: '#cbd5e1' }}>Simulink SIL Plant</span>
          </div>
        </div>
      </div>

      {/* TOP-RIGHT: Real-time Performance Telemetry & Scenario Label */}
      <div
        style={{
          position: 'absolute',
          top: '14px',
          right: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '6px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'rgba(9, 14, 26, 0.88)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '0.45rem 0.75rem',
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            fontSize: '0.72rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Activity size={12} color="#10b981" />
            <span style={{ color: '#94a3b8' }}>Render FPS:</span>
            <strong style={{ color: fps >= 50 ? '#10b981' : '#f59e0b', fontFamily: 'monospace' }}>{fps}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ color: '#94a3b8' }}>Frame:</span>
            <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>{frameTimeMs} ms</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ color: '#94a3b8' }}>SIL:</span>
            <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>20 Hz</strong>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(9, 14, 26, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '6px',
            padding: '0.25rem 0.6rem',
            color: '#94a3b8',
            fontSize: '0.68rem',
            fontFamily: 'monospace',
          }}
        >
          {scenarioName}
        </div>
      </div>

      {/* BOTTOM: Unified Compact Simulation Control Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '14px',
          left: '16px',
          right: '16px',
          background: 'rgba(9, 14, 26, 0.94)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '10px',
          padding: '0.55rem 0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Play/Pause & Reset Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            onClick={onPlayPauseToggle}
            aria-label={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
            style={{
              background: isPlaying ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
              border: `1px solid ${isPlaying ? '#ef4444' : '#38bdf8'}`,
              color: isPlaying ? '#ef4444' : '#38bdf8',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={onReset}
            aria-label="Reset Simulation to Step 0"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              borderRadius: '6px',
              padding: '0.35rem 0.65rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>

        {/* Timeline Scrubber & Elapsed Time */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '0.75rem' }}>
          <input
            type="range"
            min={0}
            max={Math.max(0, points.length - 1)}
            value={currentStep}
            onChange={(e) => onStepChange(Number(e.target.value))}
            aria-label="Simulation Step Timeline"
            style={{
              flex: 1,
              height: '5px',
              borderRadius: '3px',
              background: 'rgba(255, 255, 255, 0.12)',
              accentColor: '#38bdf8',
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace', minWidth: '95px', textAlign: 'right' }}>
            {currentTime}s / {totalDuration}s
          </span>
        </div>

        {/* Playback Speed Multiplier */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem' }}>
          <span style={{ color: '#64748b' }}>Speed:</span>
          {[0.5, 1.0, 2.0].map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              style={{
                background: playbackSpeed === s ? '#38bdf8' : 'rgba(255, 255, 255, 0.05)',
                color: playbackSpeed === s ? '#090e1a' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.45rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Camera Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Video size={13} color="#94a3b8" />
          <select
            value={cameraMode}
            onChange={(e) => setCameraMode(e.target.value as CameraViewMode)}
            aria-label="Camera Perspective Selector"
            style={{
              background: '#070b14',
              color: '#f8fafc',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '5px',
              padding: '0.25rem 0.5rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="chase">Chase Cam</option>
            <option value="cockpit">Cockpit View</option>
            <option value="topdown">Top-Down Plan</option>
            <option value="side">Side Inspection</option>
            <option value="orbit">Free Orbit</option>
          </select>
        </div>

        {/* Quality Mode Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
          <span style={{ color: '#64748b' }}>Quality:</span>
          {(['performance', 'balanced', 'high'] as const).map((q) => (
            <button
              key={q}
              onClick={() => setQualityMode(q)}
              style={{
                background: qualityMode === q ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                color: qualityMode === q ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.4rem',
                fontSize: '0.65rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {q === 'performance' ? 'Perf' : q === 'balanced' ? 'Bal' : 'High'}
            </button>
          ))}
        </div>

        {/* Fullscreen Button */}
        <button
          onClick={handleToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#94a3b8',
            borderRadius: '5px',
            padding: '0.3rem 0.45rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </div>
  );
};

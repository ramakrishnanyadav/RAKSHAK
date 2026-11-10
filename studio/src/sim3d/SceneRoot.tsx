/**
 * SceneRoot.tsx - Three.js WebGL 3D Replay Root
 * 
 * Technical Requirements (Master Prompt v3):
 * - Three.js 0.160.0, PBR materials, soft directional shadows, fog, ACES tone mapping
 * - Quality tiers: High (2048 shadow, fog), Medium (1024 shadow), Low (no shadows)
 * - Auto-downgrade if frame times drop below 55 FPS sustained
 * - Viewport badges: "Rendered from simulation state, not a sensor image" and "REPLAY ONLY"
 * - Legend chips: Ego vehicle · Planned trajectory · Prediction · Critical agent · Scenery (Not simulated)
 * - 4 Camera modes: Bird's-eye, Chase, Cockpit, Orbit with prefers-reduced-motion support
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PlaybackClock, InterpolatedPose } from './Playback';
import { CameraController, CameraMode, checkPrefersReducedMotion } from './Cameras';
import { RunLog, WorldMap } from '../types/apath_log';
import { createEgoVehicleMesh, createAgentMesh, createAsphaltTexture } from '../components/scene/proceduralModels';
import { Eye, Camera, Shield, Check, Layers, AlertTriangle } from 'lucide-react';

export type QualityTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SceneRootProps {
  runLog: RunLog | null;
  playbackClock: PlaybackClock;
  selectedAgentId?: string | null;
  onSelectAgent?: (id: string | null) => void;
  plannerId?: string;
}

export const SceneRoot: React.FC<SceneRootProps> = ({
  runLog,
  playbackClock,
  selectedAgentId,
  onSelectAgent,
  plannerId = 'P3',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [qualityTier, setQualityTier] = useState<QualityTier>('HIGH');
  const [fps, setFps] = useState<number>(60);

  // Layer toggles (Three-Layer Viewport)
  const [layers, setLayers] = useState({
    environment: true,
    actors: true,
    overlays: true,
  });

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controllerRef = useRef<CameraController | null>(null);

  // Group references
  const worldGroupRef = useRef<THREE.Group>(new THREE.Group());
  const actorsGroupRef = useRef<THREE.Group>(new THREE.Group());
  const overlaysGroupRef = useRef<THREE.Group>(new THREE.Group());

  // Performance auto-downgrade monitor
  const frameTimesRef = useRef<number[]>([]);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080a);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.008);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.2, 500);
    camera.up.set(0, 0, 1); // Z-up standard coordinate system
    cameraRef.current = camera;

    const controller = new CameraController(camera, cameraMode);
    controllerRef.current = controller;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    dirLight.position.set(40, -30, 60);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Add layer groups
    scene.add(worldGroupRef.current);
    scene.add(actorsGroupRef.current);
    scene.add(overlaysGroupRef.current);

    // 5. Build static world infrastructure from world.road_boundaries
    buildWorldInfrastructure(worldGroupRef.current, runLog?.world);

    // 6. Animation loop
    let animId: number;
    let lastTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      const deltaMs = now - lastTime;
      lastTime = now;

      // Monitor frame times for auto-downgrade
      frameTimesRef.current.push(deltaMs);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
        const avgDelta = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        const currentFps = Math.round(1000 / Math.max(1, avgDelta));
        setFps(currentFps);

        // Auto-downgrade if FPS drops below 55 sustained
        if (currentFps < 52 && qualityTier === 'HIGH') {
          setQualityTier('MEDIUM');
          renderer.shadowMap.enabled = false;
        } else if (currentFps < 42 && qualityTier === 'MEDIUM') {
          setQualityTier('LOW');
          scene.fog = null;
        }
      }

      // Update dynamic actor meshes from playback clock interpolated state
      const egoPose = playbackClock.getInterpolatedEgoPose();
      const agents = playbackClock.getInterpolatedAgents();
      updateActors(actorsGroupRef.current, egoPose, agents, selectedAgentId, onSelectAgent);

      // Update camera
      let targetAgentPose: InterpolatedPose | null = null;
      if (selectedAgentId) {
        const found = agents.find((a) => a.agent.id === selectedAgentId);
        if (found) targetAgentPose = found.pose;
      }
      controller.update(egoPose, targetAgentPose);

      // Update engineering overlays
      const nearestFrame = playbackClock.getNearestFrame();
      updateOverlays(overlaysGroupRef.current, nearestFrame, egoPose);

      renderer.render(scene, camera);
    };

    animate();

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
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [runLog]);

  // Update camera mode when state changes
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setMode(cameraMode);
    }
  }, [cameraMode]);

  // Update layer visibilities
  useEffect(() => {
    worldGroupRef.current.visible = layers.environment;
    actorsGroupRef.current.visible = layers.actors;
    overlaysGroupRef.current.visible = layers.overlays;
  }, [layers]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#07080a',
        userSelect: 'none',
      }}
      role="region"
      aria-label="3D Mission Control Replay Viewport"
      onMouseDown={(e) => controllerRef.current?.handlePointerDown(e.nativeEvent)}
      onMouseMove={(e) => controllerRef.current?.handlePointerMove(e.nativeEvent)}
      onMouseUp={() => controllerRef.current?.handlePointerUp()}
      onWheel={(e) => controllerRef.current?.handleWheel(e.nativeEvent)}
    >
      {/* 1. TOP VIEWPORT BADGES */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: '3px 9px',
              backgroundColor: '#D97706',
              color: '#000000',
              fontWeight: 800,
              fontSize: '0.72rem',
              borderRadius: '4px',
              letterSpacing: '0.06em',
            }}
          >
            REPLAY ONLY
          </span>
          <span
            style={{
              padding: '3px 8px',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              color: '#94A3B8',
              border: '1px solid #334155',
              fontSize: '0.68rem',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}
          >
            {fps} FPS • {qualityTier} QUALITY
          </span>
        </div>

        <div
          style={{
            fontSize: '0.66rem',
            color: '#64748B',
            backgroundColor: 'rgba(11, 15, 25, 0.85)',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid #1E293B',
          }}
        >
          Rendered from simulation state, not a sensor image
        </div>
      </div>

      {/* 2. CAMERA MODE SELECTOR DOCK */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 4,
          borderRadius: 6,
          border: '1px solid #334155',
          zIndex: 10,
        }}
      >
        {(['chase', 'bird', 'cockpit', 'orbit'] as CameraMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setCameraMode(mode)}
            style={{
              padding: '4px 10px',
              fontSize: '0.72rem',
              fontWeight: cameraMode === mode ? 700 : 500,
              backgroundColor: cameraMode === mode ? '#2DD4BF' : 'transparent',
              color: cameraMode === mode ? '#0B0C0F' : '#94A3B8',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
            aria-pressed={cameraMode === mode}
          >
            {mode === 'bird' ? "Bird's-Eye" : mode}
          </button>
        ))}
      </div>

      {/* 3. THREE-LAYER TOGGLES & LEGEND CHIPS */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          zIndex: 10,
        }}
      >
        {/* Layer Visibility Toggles */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #334155',
            fontSize: '0.68rem',
            color: '#CBD5E1',
          }}
        >
          <Layers size={12} color="#2DD4BF" />
          <span style={{ fontWeight: 700, marginRight: 4 }}>Layers:</span>
          {(['environment', 'actors', 'overlays'] as const).map((layerKey) => (
            <button
              key={layerKey}
              onClick={() => setLayers((p) => ({ ...p, [layerKey]: !p[layerKey] }))}
              style={{
                padding: '2px 6px',
                fontSize: '0.65rem',
                borderRadius: 3,
                backgroundColor: layers[layerKey] ? 'rgba(45, 212, 191, 0.2)' : 'transparent',
                color: layers[layerKey] ? '#2DD4BF' : '#64748B',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {layerKey}
            </button>
          ))}
        </div>

        {/* Legend Chips */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid #334155',
            fontSize: '0.65rem',
            color: '#94A3B8',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, backgroundColor: '#0284C7', borderRadius: 2 }} />
            Ego Vehicle
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, backgroundColor: '#10B981', borderRadius: 2 }} />
            Planned Trajectory
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, backgroundColor: '#8B5CF6', borderRadius: 2 }} />
            Prediction Hypotheses
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: 2 }} />
            Critical Agent
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#64748B' }}>
            <span style={{ width: 8, height: 8, backgroundColor: '#334155', borderRadius: 2 }} />
            Scenery (Not simulated)
          </span>
        </div>
      </div>
    </div>
  );
};

// Helper: Build World Mesh strictly from road_boundaries
function buildWorldInfrastructure(group: THREE.Group, world?: WorldMap | null): void {
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
  if (!world || !world.road_boundaries || world.road_boundaries.length < 2) return;

  const left = world.road_boundaries.find((b) => b.side === 'left') || world.road_boundaries[0];
  const right = world.road_boundaries.find((b) => b.side === 'right') || world.road_boundaries[1];

  if (left && right && left.points.length > 1) {
    const shape = new THREE.Shape();
    const lPts = left.points;
    const rPts = right.points;

    shape.moveTo(lPts[0][0], lPts[0][1]);
    for (let i = 1; i < lPts.length; i++) {
      shape.lineTo(lPts[i][0], lPts[i][1]);
    }
    for (let i = rPts.length - 1; i >= 0; i--) {
      shape.lineTo(rPts[i][0], rPts[i][1]);
    }
    shape.closePath();

    const roadGeo = new THREE.ShapeGeometry(shape);
    const asphaltTex = createAsphaltTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.85,
      metalness: 0.1,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // Edge lines
    world.road_boundaries.forEach((b) => {
      const pts = b.points.map((p) => new THREE.Vector3(p[0], p[1], 0.03));
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 2 });
      group.add(new THREE.Line(lineGeo, lineMat));
    });
  }

  // Static obstacles
  if (world.static_obstacles) {
    world.static_obstacles.forEach((obs) => {
      const geo = new THREE.BoxGeometry(obs.length || 1.5, obs.width || 1.5, 0.4);
      const mat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(obs.x, obs.y, 0.2);
      m.castShadow = true;
      group.add(m);
    });
  }
}

// Helper: Update Dynamic Actors
function updateActors(
  group: THREE.Group,
  egoPose: InterpolatedPose | null,
  agents: { agent: any; pose: InterpolatedPose }[],
  selectedId?: string | null,
  onSelect?: (id: string | null) => void
): void {
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }

  // 1. Ego Vehicle
  if (egoPose) {
    const egoMesh = createEgoVehicleMesh(egoPose as any, true);
    egoMesh.position.set(egoPose.x, egoPose.y, 0.0);
    egoMesh.rotation.z = egoPose.yaw;
    group.add(egoMesh);
  }

  // 2. Dynamic Agents
  agents.forEach(({ agent, pose }) => {
    const isSelected = agent.id === selectedId;
    const mesh = createAgentMesh(agent);
    mesh.position.set(pose.x, pose.y, 0.0);
    mesh.rotation.z = pose.yaw;
    mesh.userData = { agentId: agent.id };
    group.add(mesh);
  });
}

// Helper: Update Overlays
function updateOverlays(group: THREE.Group, frame: any, egoPose: InterpolatedPose | null): void {
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
  if (!frame) return;

  // 1. Planned Trajectory Ribbon
  if (frame.planner_output && frame.planner_output.planned_trajectory) {
    const pts = frame.planner_output.planned_trajectory.map(
      (p: any) => new THREE.Vector3(p.x ?? p[0], p.y ?? p[1], 0.05)
    );
    if (pts.length > 1) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 });
      group.add(new THREE.Line(geo, mat));
    }
  }

  // 2. Prediction Polylines with Intent & Weight Opacity
  if (frame.agents) {
    frame.agents.forEach((ag: any) => {
      if (ag.prediction_hypotheses) {
        ag.prediction_hypotheses.forEach((hyp: any) => {
          if (hyp.trajectory && hyp.trajectory.length > 1) {
            const pts = hyp.trajectory.map((p: any) => new THREE.Vector3(p.x, p.y, 0.04));
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineDashedMaterial({
              color: 0x8b5cf6,
              opacity: Math.max(0.25, hyp.weight || 0.5),
              transparent: true,
              dashSize: 0.6,
              gapSize: 0.3,
            });
            const line = new THREE.Line(geo, mat);
            line.computeLineDistances();
            group.add(line);
          }
        });
      }

      // 3. Conformal Uncertainty Envelope Rings (called Prediction uncertainty envelope)
      if (ag.conformal_envelope && ag.conformal_envelope.radius_m) {
        const ringGeo = new THREE.RingGeometry(
          ag.conformal_envelope.radius_m - 0.05,
          ag.conformal_envelope.radius_m + 0.05,
          32
        );
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x8b5cf6,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(ag.x, ag.y, 0.03);
        group.add(ring);
      }
    });
  }
}

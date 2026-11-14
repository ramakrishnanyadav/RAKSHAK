import * as THREE from 'three';
import { AgentTrack, EgoState, StaticObstacle } from '../../types/apath_log';
import { getCachedCowGeometry } from './assetLoader';

/**
 * High-Realism Procedural 3D Models for ADAPTIVE-PATH Studio.
 * Apollo Dreamview / Control-Room Class Procedural Asset Library.
 * 
 * Technical Design & Coordinate System:
 * - Scene Coordinate System: +X = Forward, +Y = Lateral (Left), +Z = Vertical (Up).
 * - Three.js CylinderGeometry has default height along Y axis and circular face in X-Z plane.
 *   - Vehicle Wheels: Axle is along Y (lateral), circular face in X-Z. Default cylinder orientation is ALREADY along Y!
 *   - Animal / Human Legs & Road Posts: Stand vertically along Z. Rotate by +PI/2 around X!
 *   - Longitudinal Bodies (Torsos): Oriented along X. Rotate by +PI/2 around Z!
 * - High-definition PBR materials (roughness, metalness, clearcoat gloss).
 * - Organic bovine anatomical modeling: barrel torso, zebu cervicothoracic hump, dewlap, sculpted head, curved horns, vertical legs with cloven hooves, tail.
 * - Ground Contact Shadows: Soft blurred ambient occlusion contact discs beneath every actor.
 * - Zero external asset downloads; 100% locally computed Three.js geometry.
 */

// Procedural multi-frequency PBR asphalt texture generated in-memory
export function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  // Base dark asphalt tone
  ctx.fillStyle = '#1c1f26';
  ctx.fillRect(0, 0, 512, 512);

  // Layer 1: Aggregate noise and mineral speckles
  const imgData = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 28;
    imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + noise));
    imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + noise * 0.95));
    imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + noise * 0.9));
  }
  ctx.putImageData(imgData, 0, 0);

  // Layer 2: Subtle longitudinal tire track wear sheen
  ctx.fillStyle = 'rgba(15, 17, 22, 0.4)';
  ctx.fillRect(80, 0, 100, 512);
  ctx.fillRect(332, 0, 100, 512);

  // Layer 3: Fine asphalt aggregate micro-flecks
  ctx.fillStyle = 'rgba(210, 215, 225, 0.08)';
  for (let j = 0; j < 600; j++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const rrad = Math.random() * 1.5 + 0.5;
    ctx.beginPath();
    ctx.arc(rx, ry, rrad, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

// Procedural ground contact shadow texture (soft ambient occlusion)
function createGroundShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

const groundShadowTex = typeof document !== 'undefined' ? createGroundShadowTexture() : null;

// Reusable contact shadow generator
export function createContactShadowMesh(length: number, width: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(length * 1.15, width * 1.25);
  const mat = new THREE.MeshBasicMaterial({
    map: groundShadowTex,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = 0.015;
  return mesh;
}

// 1. High-Realism Autonomous Ego Vehicle (Apollo / Waymo Style SUV)
export function createEgoVehicleMesh(ego: EgoState, isP3: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ego_vehicle'; // Preserved for tests
  const l = ego.length || 4.4;
  const w = ego.width || 1.85;
  const h = 1.55;

  // Primary body paint: Metallic Teal for P3, Titanium Slate for B1
  const paintColor = isP3 ? 0x0f766e : 0x334155;
  const paintMat = new THREE.MeshStandardMaterial({
    color: paintColor,
    roughness: 0.18,
    metalness: 0.85,
  });

  // Dark matte trim / chassis bottom
  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.85,
    metalness: 0.2,
  });

  // Reflective tinted automotive glass
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.05,
    metalness: 0.95,
  });

  // 1. Contact shadow directly on asphalt
  group.add(createContactShadowMesh(l, w));

  // 2. Lower Chassis & Aerodynamic Rocker Panels
  const chassisGeo = new THREE.BoxGeometry(l * 0.96, w * 0.94, h * 0.22);
  const chassis = new THREE.Mesh(chassisGeo, darkTrimMat);
  chassis.position.set(0, 0, h * 0.18);
  chassis.castShadow = true;
  group.add(chassis);

  // 3. Main Sculpted Body Shell
  const bodyGeo = new THREE.BoxGeometry(l * 0.92, w * 0.88, h * 0.36);
  const body = new THREE.Mesh(bodyGeo, paintMat);
  body.position.set(0, 0, h * 0.42);
  body.castShadow = true;
  group.add(body);

  // 4. Front Sloped Hood
  const hoodL = l * 0.32;
  const hoodGeo = new THREE.BoxGeometry(hoodL, w * 0.84, h * 0.18);
  const hood = new THREE.Mesh(hoodGeo, paintMat);
  hood.position.set(l * 0.28, 0, h * 0.46);
  hood.rotation.y = 0.06;
  hood.castShadow = true;
  group.add(hood);

  // 5. Front Bumper with Lower Air Dam & Sensor Inset
  const bumperGeo = new THREE.BoxGeometry(l * 0.12, w * 0.86, h * 0.24);
  const bumper = new THREE.Mesh(bumperGeo, darkTrimMat);
  bumper.position.set(l * 0.45, 0, h * 0.22);
  group.add(bumper);

  // Front Radar Puck (Center of lower grille)
  const radarPuck = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.22, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.2, metalness: 0.9 })
  );
  radarPuck.position.set(l * 0.51, 0, h * 0.22);
  group.add(radarPuck);

  // 6. Raked Aerodynamic Greenhouse Cabin (Windshield, Side Windows, Rear Hatch)
  const cabinL = l * 0.54;
  const cabinW = w * 0.78;
  const cabinH = h * 0.44;
  const cabinGeo = new THREE.BoxGeometry(cabinL, cabinW, cabinH);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(-l * 0.05, 0, h * 0.76);
  cabin.castShadow = true;
  group.add(cabin);

  // Slanted Front Windshield Glass Inset
  const windshieldGeo = new THREE.BoxGeometry(0.12, cabinW * 0.94, cabinH * 1.08);
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(l * 0.21, 0, h * 0.75);
  windshield.rotation.y = -0.52; // Raked back 30 degrees
  group.add(windshield);

  // Slanted Rear Window Inset
  const rearWindowGeo = new THREE.BoxGeometry(0.12, cabinW * 0.92, cabinH * 1.04);
  const rearWindow = new THREE.Mesh(rearWindowGeo, glassMat);
  rearWindow.position.set(-l * 0.31, 0, h * 0.76);
  rearWindow.rotation.y = 0.48; // Raked forward 27 degrees
  group.add(rearWindow);

  // Body-Colored Roof Panel
  const roofGeo = new THREE.BoxGeometry(cabinL * 0.72, cabinW * 0.94, 0.04);
  const roof = new THREE.Mesh(roofGeo, paintMat);
  roof.position.set(-l * 0.05, 0, h * 0.98);
  roof.castShadow = true;
  group.add(roof);

  // 7. Four Upright Dual-Component Wheels (Matte Rubber Tire + 5-Spoke Alloy Rim)
  // Scene coordinate system: +X=Forward, +Y=Lateral, +Z=Up.
  // Three.js CylinderGeometry default orientation:
  // Circular face is in X-Z plane, height/axle is along Y.
  // This is ALREADY an upright rolling wheel! NO rotation needed!
  const wheelRadius = h * 0.25; // 0.39m
  const wheelWidth = 0.25;
  const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.94, metalness: 0.05 });

  const rimRadius = wheelRadius * 0.68;
  const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, wheelWidth * 1.02, 16);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.92 });

  // Wheel center positions: Z = wheelRadius puts tire bottom at Z = 0
  const wheelPositions = [
    [l * 0.29, w * 0.46, wheelRadius],
    [l * 0.29, -w * 0.46, wheelRadius],
    [-l * 0.29, w * 0.46, wheelRadius],
    [-l * 0.29, -w * 0.46, wheelRadius],
  ];

  const wheels: { fl?: THREE.Group; fr?: THREE.Group; rl?: THREE.Group; rr?: THREE.Group } = {};
  wheelPositions.forEach(([wx, wy, wz], i) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, wy, wz);
    wheelGroup.name = i === 0 ? 'wheel_fl' : i === 1 ? 'wheel_fr' : i === 2 ? 'wheel_rl' : 'wheel_rr';

    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    wheelGroup.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    wheelGroup.add(rim);

    if (i === 0) wheels.fl = wheelGroup;
    else if (i === 1) wheels.fr = wheelGroup;
    else if (i === 2) wheels.rl = wheelGroup;
    else wheels.rr = wheelGroup;

    group.add(wheelGroup);
  });
  group.userData.wheels = wheels;

  // 8. Dual LED Projector Headlights
  const lightGeo = new THREE.BoxGeometry(0.12, 0.28, 0.1);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.5,
    roughness: 0.1,
  });

  const hlLeft = new THREE.Mesh(lightGeo, lightMat);
  hlLeft.position.set(l * 0.46, w * 0.32, h * 0.44);
  group.add(hlLeft);

  const hlRight = new THREE.Mesh(lightGeo, lightMat);
  hlRight.position.set(l * 0.46, -w * 0.32, h * 0.44);
  group.add(hlRight);

  // 9. Continuous Rear Full-Width Dynamic LED Brake Lightbar
  const isBraking =
    (ego.acceleration || 0) < -0.3 ||
    ego.active_state === 'SLOW' ||
    ego.active_state === 'STOP' ||
    ego.active_state === 'EMERGENCY_BRAKE';
  const tailGeo = new THREE.BoxGeometry(0.08, w * 0.78, 0.07);
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: isBraking ? 0xff0000 : 0xdc2626,
    emissiveIntensity: isBraking ? 4.5 : 1.6,
    roughness: 0.2,
  });
  const tailLight = new THREE.Mesh(tailGeo, tailMat);
  tailLight.position.set(-l * 0.46, 0, h * 0.48);
  group.add(tailLight);

  // 10. Aerodynamic Side Mirrors & Turn Indicators (Active in BYPASS)
  const isBypassing = ego.active_state === 'BYPASS';
  const mirrorGeo = new THREE.BoxGeometry(0.14, 0.18, 0.09);
  const mirrorL = new THREE.Mesh(mirrorGeo, paintMat);
  mirrorL.position.set(l * 0.12, w * 0.48, h * 0.68);
  group.add(mirrorL);

  const mirrorR = new THREE.Mesh(mirrorGeo, paintMat);
  mirrorR.position.set(l * 0.12, -w * 0.48, h * 0.68);
  group.add(mirrorR);

  // Side Amber Turn Indicators (Blinking / Lit during Obstacle Bypass Maneuver)
  const indicatorMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: isBypassing ? 3.5 : 0.2,
  });
  const indL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), indicatorMat);
  indL.position.set(l * 0.12, w * 0.52, h * 0.65);
  group.add(indL);
  const indR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), indicatorMat);
  indR.position.set(l * 0.12, -w * 0.52, h * 0.65);
  group.add(indR);

  // 11. Autonomous Sensor Rig: Roof LiDAR & Camera Pod (Apollo Dreamview Style)
  const sensorRackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.8 });
  const rackBase = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.08), sensorRackMat);
  rackBase.position.set(-l * 0.05, 0, h * 1.02);
  group.add(rackBase);

  // Main 360 LiDAR Puck (Upright Cylinder along Z)
  const lidarGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 20);
  const lidarMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.2,
  });
  const lidar = new THREE.Mesh(lidarGeo, lidarMat);
  lidar.rotation.x = Math.PI / 2; // Rotate cylinder upright along Z
  lidar.position.set(-l * 0.05, 0, h * 1.14);
  lidar.castShadow = true;
  group.add(lidar);

  // LiDAR Glass Sensor Band: Teal for P3, Amber for B1
  const lidarGlassGeo = new THREE.CylinderGeometry(0.122, 0.122, 0.06, 20);
  const sensorGlowColor = isP3 ? 0x2dd4bf : 0xf59e0b;
  const lidarGlassMat = new THREE.MeshStandardMaterial({
    color: sensorGlowColor,
    emissive: sensorGlowColor,
    emissiveIntensity: 1.8,
    roughness: 0.1,
  });
  const lidarBand = new THREE.Mesh(lidarGlassGeo, lidarGlassMat);
  lidarBand.rotation.x = Math.PI / 2;
  lidarBand.position.set(-l * 0.05, 0, h * 1.14);
  group.add(lidarBand);

  return group;
}

// 2. High-Realism Indian Zebu Cattle (Bos indicus) with Articulated Limbs
export function createCattleMesh(ag: AgentTrack): THREE.Group {
  const group = new THREE.Group();
  group.name = 'indian_cattle_mesh';
  const l = ag.length || 2.4;
  const w = ag.width || 1.1;
  const h = 1.48;

  // Warm Indian bovine caramel-tan hide material
  const cowMat = new THREE.MeshStandardMaterial({
    color: 0x8a531e,
    roughness: 0.76,
    metalness: 0.04,
  });

  // Soft cream/fawn belly and throat undertone
  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0xb5804c,
    roughness: 0.8,
    metalness: 0.02,
  });

  const darkMuzzleMat = new THREE.MeshStandardMaterial({
    color: 0x242426,
    roughness: 0.85,
    metalness: 0.05,
  });

  const hornMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    roughness: 0.32,
    metalness: 0.08,
  });

  const hornTipMat = new THREE.MeshStandardMaterial({
    color: 0x292524,
    roughness: 0.4,
    metalness: 0.1,
  });

  const hoofMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.88,
    metalness: 0.15,
  });

  // 1. Soft ambient ground contact shadow on asphalt
  group.add(createContactShadowMesh(l * 1.15, w * 1.25));

  // 2. Contoured Barrel Torso (Anatomical ribcage & flanks)
  const torsoGeo = new THREE.CylinderGeometry(w * 0.44, w * 0.42, l * 0.65, 18);
  const torso = new THREE.Mesh(torsoGeo, cowMat);
  torso.rotation.z = Math.PI / 2; // Length along X
  torso.position.set(-l * 0.05, 0, h * 0.64);
  torso.scale.set(1.0, 0.94, 1.08); // Flattened laterally, arched vertically
  torso.castShadow = true;
  group.add(torso);

  // Soft underbelly contour
  const bellyGeo = new THREE.BoxGeometry(l * 0.58, w * 0.72, h * 0.22);
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.position.set(-l * 0.05, 0, h * 0.52);
  group.add(belly);

  // 3. Muscular Shoulder & Forequarter Girdle
  const shoulderGeo = new THREE.SphereGeometry(w * 0.46, 14, 14);
  const shoulders = new THREE.Mesh(shoulderGeo, cowMat);
  shoulders.position.set(l * 0.18, 0, h * 0.66);
  shoulders.scale.set(1.15, 0.94, 1.1);
  shoulders.castShadow = true;
  group.add(shoulders);

  // 4. Rounded Hindquarters & Rump
  const rumpGeo = new THREE.SphereGeometry(w * 0.44, 14, 14);
  const rump = new THREE.Mesh(rumpGeo, cowMat);
  rump.position.set(-l * 0.28, 0, h * 0.64);
  rump.scale.set(1.08, 0.92, 1.05);
  rump.castShadow = true;
  group.add(rump);

  // 5. Prominent Indian Zebu Cervicothoracic Hump (Bos indicus breed characteristic)
  const humpGroup = new THREE.Group();
  humpGroup.position.set(l * 0.15, 0, h * 0.98);
  const humpGeo = new THREE.SphereGeometry(w * 0.36, 16, 16);
  const hump = new THREE.Mesh(humpGeo, cowMat);
  hump.scale.set(0.92, 0.72, 1.35); // Arched apex
  hump.castShadow = true;
  humpGroup.add(hump);
  group.add(humpGroup);

  // 6. Pendulous Throat Dewlap (Loose folded brisket skin)
  const dewlapGeo = new THREE.BoxGeometry(l * 0.24, 0.06, h * 0.32);
  const dewlap = new THREE.Mesh(dewlapGeo, bellyMat);
  dewlap.position.set(l * 0.3, 0, h * 0.52);
  group.add(dewlap);

  // 7. Muscular Neck & Sculpted Bovine Head Assembly
  const headGroup = new THREE.Group();
  headGroup.name = 'cattle_head_assembly';
  headGroup.position.set(l * 0.42, 0, h * 0.82);

  // Muscular arched neck connecting chest to head
  const neckGeo = new THREE.CylinderGeometry(w * 0.3, w * 0.38, l * 0.28, 12);
  const neck = new THREE.Mesh(neckGeo, cowMat);
  neck.rotation.z = Math.PI / 2.8;
  neck.position.set(-l * 0.08, 0, -h * 0.06);
  headGroup.add(neck);

  // Cranium / Forehead with bony crest
  const craniumGeo = new THREE.BoxGeometry(l * 0.26, w * 0.46, h * 0.32);
  const cranium = new THREE.Mesh(craniumGeo, cowMat);
  cranium.rotation.y = -0.16;
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Tapered Muzzle & Nostrils
  const muzzleGeo = new THREE.BoxGeometry(l * 0.18, w * 0.34, h * 0.2);
  const muzzle = new THREE.Mesh(muzzleGeo, darkMuzzleMat);
  muzzle.position.set(l * 0.14, 0, -h * 0.08);
  headGroup.add(muzzle);

  // Nostrils
  const nostrilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
  const nostrilL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 6), nostrilMat);
  nostrilL.position.set(l * 0.22, w * 0.09, -h * 0.07);
  headGroup.add(nostrilL);
  const nostrilR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 6), nostrilMat);
  nostrilR.position.set(l * 0.22, -w * 0.09, -h * 0.07);
  headGroup.add(nostrilR);

  // Dark bovine eyes with glossy specular highlights
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.08, metalness: 0.95 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), eyeMat);
  eyeL.position.set(l * 0.05, w * 0.24, h * 0.05);
  headGroup.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), eyeMat);
  eyeR.position.set(l * 0.05, -w * 0.24, h * 0.05);
  headGroup.add(eyeR);

  // 8. Elegant Lyre-Shaped Curved Horns with Dark Tips
  [-1, 1].forEach((side) => {
    const hornGroup = new THREE.Group();
    hornGroup.position.set(-l * 0.02, side * w * 0.24, h * 0.22);
    hornGroup.rotation.set(-side * 0.32, 0.12, side * 0.42);

    const baseHorn = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.32, 12), hornMat);
    baseHorn.position.y = 0.14;
    hornGroup.add(baseHorn);

    const tipHorn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 10), hornTipMat);
    tipHorn.position.y = 0.34;
    hornGroup.add(tipHorn);

    headGroup.add(hornGroup);
  });

  // Drooping pendulous ears (outward & downward relaxed stance)
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.05), cowMat);
    ear.position.set(-l * 0.06, side * w * 0.28, h * 0.06);
    ear.rotation.set(side * 0.2, 0, side * 0.65);
    headGroup.add(ear);
  });

  group.add(headGroup);

  // 9. Four Articulated Legs (Upper shoulder/hip pivot, hock/knee, lower shank, cloven hoof)
  const legHeight = h * 0.54;
  const legRadius = 0.085;
  const upperGeo = new THREE.CylinderGeometry(legRadius * 1.05, legRadius * 0.85, legHeight * 0.52, 10);
  const lowerGeo = new THREE.CylinderGeometry(legRadius * 0.8, legRadius * 0.7, legHeight * 0.48, 10);
  const hoofGeo = new THREE.CylinderGeometry(legRadius * 0.72, legRadius * 0.88, 0.08, 10);

  function createArticulatedLeg(): THREE.Group {
    const legRoot = new THREE.Group();

    // Upper thigh / shoulder segment (pivots at top)
    const upperLeg = new THREE.Mesh(upperGeo, cowMat);
    upperLeg.rotation.x = Math.PI / 2; // Upright along Z
    upperLeg.position.z = -legHeight * 0.24;
    upperLeg.castShadow = true;
    legRoot.add(upperLeg);

    // Knee / Hock joint bulge
    const joint = new THREE.Mesh(new THREE.SphereGeometry(legRadius * 0.88, 8, 8), cowMat);
    joint.position.z = -legHeight * 0.5;
    legRoot.add(joint);

    // Lower shin / shank
    const lowerLeg = new THREE.Mesh(lowerGeo, cowMat);
    lowerLeg.rotation.x = Math.PI / 2;
    lowerLeg.position.z = -legHeight * 0.74;
    lowerLeg.castShadow = true;
    legRoot.add(lowerLeg);

    // Cloven dark hoof firmly contacting asphalt
    const hoof = new THREE.Mesh(hoofGeo, hoofMat);
    hoof.rotation.x = Math.PI / 2;
    hoof.position.z = -legHeight + 0.04;
    legRoot.add(hoof);

    return legRoot;
  }

  // Hip / Shoulder pivot positions (Z positioned at top of leg where it joins torso)
  const pivotZ = legHeight;
  const legFL = createArticulatedLeg();
  legFL.name = 'leg_FL';
  legFL.position.set(l * 0.18, w * 0.3, pivotZ);
  group.add(legFL);

  const legFR = createArticulatedLeg();
  legFR.name = 'leg_FR';
  legFR.position.set(l * 0.18, -w * 0.3, pivotZ);
  group.add(legFR);

  const legRL = createArticulatedLeg();
  legRL.name = 'leg_RL';
  legRL.position.set(-l * 0.26, w * 0.28, pivotZ);
  group.add(legRL);

  const legRR = createArticulatedLeg();
  legRR.name = 'leg_RR';
  legRR.position.set(-l * 0.26, -w * 0.28, pivotZ);
  group.add(legRR);

  // 10. Natural Tail with Dark Hair Switch
  const tail = new THREE.Group();
  tail.name = 'cattle_tail';
  tail.position.set(-l * 0.38, 0, h * 0.62);

  const tailStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, h * 0.48, 8), cowMat);
  tailStem.rotation.x = Math.PI / 2;
  tailStem.position.z = -h * 0.22;
  tail.add(tailStem);

  const tailSwitch = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), darkMuzzleMat);
  tailSwitch.rotation.x = -Math.PI / 2;
  tailSwitch.position.z = -h * 0.46;
  tail.add(tailSwitch);

  group.add(tail);

  // Attach named animation references for synchronized locomotion in Scene3DCanvas
  group.userData = {
    isCattle: true,
    legFL,
    legFR,
    legRL,
    legRR,
    headGroup,
    tail,
    dewlap,
  };

  return group;
}

// 3. High-Realism Heavy Truck (Indian Commercial Carrier)
export function createTruckMesh(ag: AgentTrack): THREE.Group {
  const group = new THREE.Group();
  const l = ag.length || 7.5;
  const w = ag.width || 2.4;
  const h = 2.85;

  const cabMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.35, metalness: 0.6 });
  const cargoMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.4 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x08111e, roughness: 0.08, metalness: 0.95 });

  group.add(createContactShadowMesh(l, w));

  // Forward Cab
  const cabL = l * 0.28;
  const cabGeo = new THREE.BoxGeometry(cabL, w * 0.96, h * 0.85);
  const cab = new THREE.Mesh(cabGeo, cabMat);
  cab.position.set(l * 0.34, 0, h * 0.52);
  cab.castShadow = true;
  group.add(cab);

  // Cab Windshield
  const wsGeo = new THREE.BoxGeometry(0.08, w * 0.86, h * 0.32);
  const ws = new THREE.Mesh(wsGeo, glassMat);
  ws.position.set(l * 0.485, 0, h * 0.68);
  group.add(ws);

  // Cargo Box Container
  const cargoL = l * 0.68;
  const cargoGeo = new THREE.BoxGeometry(cargoL, w, h * 0.95);
  const cargo = new THREE.Mesh(cargoGeo, cargoMat);
  cargo.position.set(-l * 0.14, 0, h * 0.58);
  cargo.castShadow = true;
  group.add(cargo);

  // 6 Upright Heavy Commercial Wheels (Axles along Y)
  const wheelRadius = 0.48;
  const wheelWidth = 0.32;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.92 });

  const wheelPositions = [
    [l * 0.34, w * 0.5, wheelRadius],
    [l * 0.34, -w * 0.5, wheelRadius],
    [-l * 0.12, w * 0.5, wheelRadius],
    [-l * 0.12, -w * 0.5, wheelRadius],
    [-l * 0.36, w * 0.5, wheelRadius],
    [-l * 0.36, -w * 0.5, wheelRadius],
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, wy, wz);
    // Cylinder height is along Y = axle orientation!
    wheel.castShadow = true;
    group.add(wheel);
  });

  return group;
}

// 4. Auto-Rickshaw (Classic Indian 3-Wheeler)
export function createAutoRickshawMesh(ag: AgentTrack): THREE.Group {
  const group = new THREE.Group();
  const l = ag.length || 2.6;
  const w = ag.width || 1.35;
  const h = 1.72;

  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.2 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75, metalness: 0.1 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x08111e, roughness: 0.08, metalness: 0.95 });

  group.add(createContactShadowMesh(l, w));

  // Lower Body Hull (Yellow)
  const lowerGeo = new THREE.BoxGeometry(l * 0.85, w, h * 0.38);
  const lower = new THREE.Mesh(lowerGeo, yellowMat);
  lower.position.set(-l * 0.04, 0, h * 0.32);
  lower.castShadow = true;
  group.add(lower);

  // Tapered Front Nose
  const noseGeo = new THREE.ConeGeometry(w * 0.44, l * 0.3, 4);
  const nose = new THREE.Mesh(noseGeo, yellowMat);
  nose.position.set(l * 0.4, 0, h * 0.38);
  nose.rotation.z = -Math.PI / 2;
  nose.castShadow = true;
  group.add(nose);

  // Dark Green Fabric Canopy
  const roofGeo = new THREE.BoxGeometry(l * 0.78, w * 0.96, h * 0.48);
  const roof = new THREE.Mesh(roofGeo, greenMat);
  roof.position.set(-l * 0.08, 0, h * 0.76);
  roof.castShadow = true;
  group.add(roof);

  // Windshield
  const wsGeo = new THREE.BoxGeometry(0.06, w * 0.82, h * 0.3);
  const ws = new THREE.Mesh(wsGeo, glassMat);
  ws.position.set(l * 0.28, 0, h * 0.65);
  group.add(ws);

  // Front Headlight (Central Round Lamp)
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16),
    new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfbbf24, emissiveIntensity: 1.0 })
  );
  lamp.position.set(l * 0.52, 0, h * 0.4);
  lamp.rotation.z = Math.PI / 2;
  group.add(lamp);

  // 3 Wheels (1 front center, 2 rear sides) - Axle along Y
  const wheelRadius = 0.22;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.16, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

  const fWheel = new THREE.Mesh(wheelGeo, wheelMat);
  fWheel.position.set(l * 0.42, 0, wheelRadius);
  fWheel.castShadow = true;
  group.add(fWheel);

  const rWheelL = new THREE.Mesh(wheelGeo, wheelMat);
  rWheelL.position.set(-l * 0.28, w * 0.48, wheelRadius);
  rWheelL.castShadow = true;
  group.add(rWheelL);

  const rWheelR = new THREE.Mesh(wheelGeo, wheelMat);
  rWheelR.position.set(-l * 0.28, -w * 0.48, wheelRadius);
  rWheelR.castShadow = true;
  group.add(rWheelR);

  return group;
}

// 5. Pedestrian (Upright Biped in Natural Stride)
export function createPedestrianMesh(ag: AgentTrack): THREE.Group {
  const group = new THREE.Group();
  const h = 1.76;
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 });
  const pantMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });

  group.add(createContactShadowMesh(0.6, 0.6));

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), skinMat);
  head.position.set(0, 0, h * 0.88);
  head.castShadow = true;
  group.add(head);

  // Torso (Shirt)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 0.62), shirtMat);
  torso.position.set(0, 0, h * 0.58);
  torso.castShadow = true;
  group.add(torso);

  // Legs (Standing Vertically along Z)
  const legGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.74, 8);
  const legL = new THREE.Mesh(legGeo, pantMat);
  legL.rotation.x = Math.PI / 2;
  legL.position.set(0.08, 0.14, 0.37);
  legL.castShadow = true;
  group.add(legL);

  const legR = new THREE.Mesh(legGeo, pantMat);
  legR.rotation.x = Math.PI / 2;
  legR.position.set(-0.08, -0.14, 0.37);
  legR.castShadow = true;
  group.add(legR);

  return group;
}

// 6. Two-Wheeler (Motorcycle / Scooter with Rider)
export function createTwoWheelerMesh(ag: AgentTrack): THREE.Group {
  const group = new THREE.Group();
  const l = ag.length || 1.95;
  const w = ag.width || 0.75;
  const h = 1.35;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2, metalness: 0.5 });

  group.add(createContactShadowMesh(l, w));

  // Frame Spine
  const frameGeo = new THREE.BoxGeometry(l * 0.75, 0.22, 0.35);
  const frame = new THREE.Mesh(frameGeo, bodyMat);
  frame.position.set(0, 0, 0.52);
  frame.castShadow = true;
  group.add(frame);

  // Rider Torso
  const riderTorso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.54), darkMat);
  riderTorso.position.set(-0.15, 0, 0.95);
  riderTorso.rotation.y = 0.15;
  riderTorso.castShadow = true;
  group.add(riderTorso);

  // Rider Helmet
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), helmetMat);
  helmet.position.set(-0.08, 0, 1.34);
  helmet.castShadow = true;
  group.add(helmet);

  // 2 Inline Wheels (Axle along Y)
  const wheelRadius = 0.3;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.12, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

  const fWheel = new THREE.Mesh(wheelGeo, wheelMat);
  fWheel.position.set(l * 0.42, 0, wheelRadius);
  fWheel.castShadow = true;
  group.add(fWheel);

  const rWheel = new THREE.Mesh(wheelGeo, wheelMat);
  rWheel.position.set(-l * 0.38, 0, wheelRadius);
  rWheel.castShadow = true;
  group.add(rWheel);

  return group;
}

// 7. Handcart / Vegetable Cart (Indian Market Street Actor)
export function createHandcartMesh(ag: AgentTrack): THREE.Group {
  const group = new THREE.Group();
  const l = ag.length || 2.1;
  const w = ag.width || 1.1;
  const h = 0.95;

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const produceMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 });

  group.add(createContactShadowMesh(l, w));

  // Wooden Tray Deck
  const deckGeo = new THREE.BoxGeometry(l * 0.88, w * 0.92, 0.14);
  const deck = new THREE.Mesh(deckGeo, woodMat);
  deck.position.set(0, 0, 0.55);
  deck.castShadow = true;
  group.add(deck);

  // Vegetable Piles
  const pileGeo = new THREE.SphereGeometry(w * 0.35, 8, 8);
  const pile = new THREE.Mesh(pileGeo, produceMat);
  pile.position.set(0, 0, 0.72);
  pile.scale.set(1.2, 0.9, 0.5);
  group.add(pile);

  // 2 Large Wooden Spoke Wheels (Axles along Y)
  const wheelRadius = 0.45;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.08, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });

  const wL = new THREE.Mesh(wheelGeo, wheelMat);
  wL.position.set(0, w * 0.52, wheelRadius);
  group.add(wL);

  const wR = new THREE.Mesh(wheelGeo, wheelMat);
  wR.position.set(0, -w * 0.52, wheelRadius);
  group.add(wR);

  return group;
}

// Realistic Roadside Scenery: Procedural Tree with Organic Trunk and Layered Foliage Canopy
export function createTreeMesh(
  type: 'deciduous' | 'pine' = 'deciduous',
  scale = 1.0
): THREE.Group {
  const group = new THREE.Group();
  group.name = `tree_${type}`;

  // Ground Contact Ambient Occlusion Disc
  const shadowGeo = new THREE.CircleGeometry(1.5 * scale, 16);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x05070a,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.z = 0.01;
  group.add(shadow);

  // Organic Trunk (bark material, vertically oriented along Z)
  const trunkHeight = 2.8 * scale;
  const trunkRadius = 0.22 * scale;
  const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.8, trunkRadius * 1.2, trunkHeight, 10);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3d2817,
    roughness: 0.9,
    metalness: 0.05,
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.rotation.x = Math.PI / 2; // Upright along Z
  trunk.position.set(0, 0, trunkHeight / 2);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // Canopy Geometry
  if (type === 'pine') {
    // 3 Stacked Conical Needle Tiers
    const pineColors = [0x14532d, 0x166534, 0x15803d];
    for (let i = 0; i < 3; i++) {
      const coneR = (1.6 - i * 0.35) * scale;
      const coneH = 2.2 * scale;
      const coneGeo = new THREE.ConeGeometry(coneR, coneH, 10);
      const coneMat = new THREE.MeshStandardMaterial({
        color: pineColors[i],
        roughness: 0.8,
        metalness: 0.05,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.rotation.x = Math.PI / 2; // Upright along Z
      cone.position.set(0, 0, trunkHeight + i * 1.1 * scale);
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);
    }
  } else {
    // Organic Deciduous Foliage Canopy (Multi-ellipsoid clusters for volume)
    const foliageColors = [0x15803d, 0x166534, 0x14532d, 0x1e3a1f];
    const foliageGeo = new THREE.DodecahedronGeometry(1.5 * scale, 1);
    
    // Main Center Crown
    const crownMat = new THREE.MeshStandardMaterial({
      color: foliageColors[0],
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });
    const crown = new THREE.Mesh(foliageGeo, crownMat);
    crown.scale.set(1.1, 1.0, 1.2);
    crown.position.set(0, 0, trunkHeight + 1.2 * scale);
    crown.castShadow = true;
    crown.receiveShadow = true;
    group.add(crown);

    // Lateral Offset Foliage Clumps
    const clumps = [
      { x: 0.6 * scale, y: 0.4 * scale, z: (trunkHeight + 0.8) * scale, s: 0.75, c: foliageColors[1] },
      { x: -0.5 * scale, y: -0.4 * scale, z: (trunkHeight + 0.9) * scale, s: 0.8, c: foliageColors[2] },
      { x: 0.1 * scale, y: -0.6 * scale, z: (trunkHeight + 1.4) * scale, s: 0.7, c: foliageColors[3] },
    ];
    clumps.forEach((cl) => {
      const cMat = new THREE.MeshStandardMaterial({
        color: cl.c,
        roughness: 0.85,
        flatShading: true,
      });
      const cMesh = new THREE.Mesh(foliageGeo, cMat);
      cMesh.scale.set(cl.s, cl.s * 0.9, cl.s);
      cMesh.position.set(cl.x, cl.y, cl.z);
      cMesh.castShadow = true;
      group.add(cMesh);
    });
  }

  return group;
}

// Ambient Background Traffic Vehicle for Parallel Scenery Lanes (SCENERY — NOT SIMULATED)
export function createSceneryTrafficVehicle(
  type: 'sedan' | 'suv' | 'truck' = 'sedan',
  bodyColorHex = 0x3b82f6
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'scenery_traffic_vehicle';

  const length = type === 'truck' ? 7.0 : 4.4;
  const width = type === 'truck' ? 2.3 : 1.85;
  const height = type === 'truck' ? 2.6 : 1.45;

  // Chassis
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColorHex,
    roughness: 0.35,
    metalness: 0.75,
  });
  const bodyGeo = new THREE.BoxGeometry(length, width, height * 0.55);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0, height * 0.35);
  body.castShadow = true;
  group.add(body);

  // Cabin / Greenhouse
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.9,
  });
  const cabinL = length * 0.55;
  const cabinW = width * 0.85;
  const cabinH = height * 0.5;
  const cabinGeo = new THREE.BoxGeometry(cabinL, cabinW, cabinH);
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(-length * 0.05, 0, height * 0.75);
  cabin.castShadow = true;
  group.add(cabin);

  // Wheels (axle along Y)
  const wheelRadius = height * 0.24;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.22, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const wheelOffsets = [
    { x: length * 0.3, y: width * 0.5 },
    { x: length * 0.3, y: -width * 0.5 },
    { x: -length * 0.3, y: width * 0.5 },
    { x: -length * 0.3, y: -width * 0.5 },
  ];
  wheelOffsets.forEach((wo) => {
    const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
    wMesh.position.set(wo.x, wo.y, wheelRadius);
    group.add(wMesh);
  });

  // Headlights (Warm White Glow)
  const lightGeo = new THREE.BoxGeometry(0.1, 0.22, 0.1);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 1.8,
  });
  const hlL = new THREE.Mesh(lightGeo, headMat);
  hlL.position.set(length * 0.5, width * 0.32, height * 0.35);
  group.add(hlL);
  const hlR = new THREE.Mesh(lightGeo, headMat);
  hlR.position.set(length * 0.5, -width * 0.32, height * 0.35);
  group.add(hlR);

  // Taillights (Red Glow)
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.6,
  });
  const tlL = new THREE.Mesh(lightGeo, tailMat);
  tlL.position.set(-length * 0.5, width * 0.32, height * 0.38);
  group.add(tlL);
  const tlR = new THREE.Mesh(lightGeo, tailMat);
  tlR.position.set(-length * 0.5, -width * 0.32, height * 0.38);
  group.add(tlR);

  return group;
}

// Master Factory: Route agent classification to appropriate procedural model
export function createAgentMesh(ag: AgentTrack): THREE.Group {
  const cls = (ag.class_name || '').toLowerCase();

  if (cls.includes('cattle') || cls.includes('cow') || cls.includes('animal')) {
    return createCattleMesh(ag);
  }
  if (cls.includes('truck') || cls.includes('bus') || cls.includes('heavy')) {
    return createTruckMesh(ag);
  }
  if (cls.includes('auto') || cls.includes('rickshaw') || cls.includes('bajaj')) {
    return createAutoRickshawMesh(ag);
  }
  if (cls.includes('pedestrian') || cls.includes('person') || cls.includes('walker')) {
    return createPedestrianMesh(ag);
  }
  if (cls.includes('two_wheeler') || cls.includes('motorcycle') || cls.includes('bike') || cls.includes('scooter')) {
    return createTwoWheelerMesh(ag);
  }
  if (cls.includes('cart') || cls.includes('handcart') || cls.includes('stall')) {
    return createHandcartMesh(ag);
  }

  // Fallback: Default Autonomous Vehicle
  return createEgoVehicleMesh(
    {
      x: ag.x,
      y: ag.y,
      yaw: ag.yaw,
      v: Math.hypot(ag.v_x, ag.v_y),
      steering: 0,
      acceleration: 0,
      jerk: 0,
      active_state: 'FOLLOW',
      length: ag.length || 4.2,
      width: ag.width || 1.8,
    },
    false
  );
}

/**
 * SCENERY BUILDINGS & ARCHITECTURAL ELEMENTS (SCENERY — NOT SIMULATED)
 * Exclusively outside drivable road corridor. Non-collidable.
 */
export function createRoadsideBuildingMesh(
  type: 'office' | 'warehouse' | 'shop',
  width = 8.0,
  length = 12.0,
  height = 10.0
): THREE.Group {
  const group = new THREE.Group();
  group.name = `building_${type}`;

  if (type === 'office') {
    // Modern Commercial / Tech Park Building
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.2,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      roughness: 0.15,
      metalness: 0.85,
    });

    // Main Structure
    const mainGeo = new THREE.BoxGeometry(length, width, height);
    const mainMesh = new THREE.Mesh(mainGeo, concreteMat);
    mainMesh.position.set(0, 0, height / 2);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    group.add(mainMesh);

    // Glowing Window Strips
    const floors = Math.floor(height / 2.6);
    for (let f = 1; f <= floors; f++) {
      const winGeo = new THREE.BoxGeometry(length * 0.9, width + 0.1, 0.9);
      const winMesh = new THREE.Mesh(winGeo, glassMat);
      winMesh.position.set(0, 0, f * 2.4 - 0.2);
      group.add(winMesh);
    }

    // Rooftop HVAC units / parapet
    const roofHvac = new THREE.Mesh(
      new THREE.BoxGeometry(length * 0.35, width * 0.35, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 })
    );
    roofHvac.position.set(length * 0.15, 0, height + 0.6);
    group.add(roofHvac);

  } else if (type === 'warehouse') {
    // Logistics Hub / Industrial Shed
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.6,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.7,
    });

    const bodyH = height * 0.65;
    const body = new THREE.Mesh(new THREE.BoxGeometry(length, width, bodyH), metalMat);
    body.position.set(0, 0, bodyH / 2);
    body.castShadow = true;
    group.add(body);

    // Corrugated Gabled Roof (triangular prism via cylinder or box angle)
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.6, width * 0.6, length, 3), roofMat);
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI;
    roof.position.set(0, 0, bodyH + (height * 0.35) / 2);
    roof.castShadow = true;
    group.add(roof);

    // Loading Bay Roller Doors
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 });
    for (let d = -1; d <= 1; d++) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, width * 0.22, bodyH * 0.7), doorMat);
      door.position.set(length * 0.51, d * (width * 0.3), (bodyH * 0.7) / 2);
      group.add(door);
    }

  } else {
    // Roadside Dhaba / Chai Stall
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 });

    const stallH = 3.2;
    const stall = new THREE.Mesh(new THREE.BoxGeometry(length, width, stallH), wallMat);
    stall.position.set(0, 0, stallH / 2);
    stall.castShadow = true;
    group.add(stall);

    // Striped Fabric Awning projecting forward
    const awning = new THREE.Mesh(new THREE.BoxGeometry(1.6, width * 1.1, 0.12), canopyMat);
    awning.rotation.y = 0.25;
    awning.position.set(length * 0.5 + 0.6, 0, stallH * 0.85);
    group.add(awning);
  }

  return group;
}

/**
 * HIGHWAY GANTRY SIGN (SCENERY — NOT SIMULATED)
 * Realistic overhead steel truss gantry spanning across highway with illuminated destination board.
 */
export function createHighwayGantryMesh(spanWidth = 18.0, clearanceHeight = 6.8): THREE.Group {
  const group = new THREE.Group();
  group.name = 'overhead_highway_gantry';

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.85 });
  const signBoardMat = new THREE.MeshStandardMaterial({
    color: 0x065f46, // Green highway sign
    roughness: 0.5,
    metalness: 0.2,
  });
  const textGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });

  // Vertical Support Columns (Left and Right outside roadway)
  const colRadius = 0.22;
  [-spanWidth / 2, spanWidth / 2].forEach((yPos) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(colRadius, colRadius * 1.2, clearanceHeight + 2.0, 12), steelMat);
    col.rotation.x = Math.PI / 2;
    col.position.set(0, yPos, (clearanceHeight + 2.0) / 2);
    col.castShadow = true;
    group.add(col);
  });

  // Horizontal Overhead Steel Truss Beams
  const trussH = 1.6;
  const beamTop = new THREE.Mesh(new THREE.BoxGeometry(0.35, spanWidth + 0.8, 0.2), steelMat);
  beamTop.position.set(0, 0, clearanceHeight + trussH);
  group.add(beamTop);

  const beamBottom = new THREE.Mesh(new THREE.BoxGeometry(0.35, spanWidth + 0.8, 0.2), steelMat);
  beamBottom.position.set(0, 0, clearanceHeight);
  group.add(beamBottom);

  // Highway Direction Sign Board (Green with white boundary)
  const signW = spanWidth * 0.65;
  const signH = 1.8;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.12, signW, signH), signBoardMat);
  sign.position.set(0.2, 0, clearanceHeight + trussH * 0.5);
  group.add(sign);

  // White Border around Sign
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.13, signW + 0.1, signH + 0.1), textGlowMat);
  border.position.set(0.19, 0, clearanceHeight + trussH * 0.5);
  group.add(border);

  // Simulated Glowing Highway Route Text Strips (NH-44 PUNE / HYDERABAD)
  const textStrip1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, signW * 0.75, 0.22), textGlowMat);
  textStrip1.position.set(0.22, 0, clearanceHeight + trussH * 0.65);
  group.add(textStrip1);

  const textStrip2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, signW * 0.55, 0.16), textGlowMat);
  textStrip2.position.set(0.22, 0, clearanceHeight + trussH * 0.35);
  group.add(textStrip2);

  return group;
}

/**
 * ICONIC INDIAN HIGHWAY MILESTONE (SCENERY — NOT SIMULATED)
 * Rounded yellow-top, white-base milestone marker with black lettering band.
 */
export function createIndianMilestoneMesh(km = 42): THREE.Group {
  const group = new THREE.Group();
  group.name = 'indian_milestone';

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 });
  const blackTextMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });

  const radius = 0.22;
  const height = 0.85;

  // White Lower Base Cylinder
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height * 0.65, 16), whiteMat);
  base.rotation.x = Math.PI / 2;
  base.position.set(0, 0, (height * 0.65) / 2);
  base.castShadow = true;
  group.add(base);

  // Yellow Curved Top Dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), yellowMat);
  dome.rotation.x = Math.PI / 2;
  dome.position.set(0, 0, height * 0.65);
  dome.castShadow = true;
  group.add(dome);

  // Milestone Number text strip
  const textBand = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, 0.14, 16), blackTextMat);
  textBand.rotation.x = Math.PI / 2;
  textBand.position.set(0, 0, height * 0.38);
  group.add(textBand);

  return group;
}

/**
 * HIGHWAY BILLBOARD DISPLAY (SCENERY — NOT SIMULATED)
 */
export function createHighwayBillboardMesh(width = 6.0, height = 3.5, poleHeight = 6.0): THREE.Group {
  const group = new THREE.Group();
  group.name = 'highway_billboard';

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.7 });
  const boardMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.3,
    roughness: 0.3,
  });

  // Support Pillar
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, poleHeight, 12), steelMat);
  pole.rotation.x = Math.PI / 2;
  pole.position.set(0, 0, poleHeight / 2);
  pole.castShadow = true;
  group.add(pole);

  // Billboard Panel
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.2, width, height), boardMat);
  board.position.set(0, 0, poleHeight + height / 2);
  board.castShadow = true;
  group.add(board);

  // Spotlight luminaires shining on billboard
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.6, width * 0.9, 0.08), steelMat);
  lightBar.position.set(0.6, 0, poleHeight + height + 0.2);
  group.add(lightBar);

  return group;
}

/**
 * HIGHWAY REGULATORY SPEED SIGN (SCENERY — NOT SIMULATED)
 * Circular sign with red border, white face, and black speed limit indicator.
 */
export function createHighwaySpeedSignMesh(speedLimit = 40): THREE.Group {
  const group = new THREE.Group();
  group.name = `speed_sign_${speedLimit}`;

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.6 });
  const redBorderMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
  const whiteFaceMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  const blackDigitMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });

  // Post
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6), poleMat);
  pole.rotation.x = Math.PI / 2;
  pole.position.set(0, 0, 1.3);
  group.add(pole);

  // Circular Signboard Backing
  const outerRing = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.03, 24), redBorderMat);
  outerRing.rotation.y = Math.PI / 2;
  outerRing.position.set(0, 0, 2.5);
  group.add(outerRing);

  // Inner White Disc
  const innerDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.034, 24), whiteFaceMat);
  innerDisc.rotation.y = Math.PI / 2;
  innerDisc.position.set(0, 0, 2.5);
  group.add(innerDisc);

  // Speed Numerals Center Emblem
  const digitMesh = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.22, 0.26), blackDigitMat);
  digitMesh.position.set(0.005, 0, 2.5);
  group.add(digitMesh);

  return group;
}

/**
 * REFLECTIVE TRAFFIC CONES CLUSTER (SCENERY — NOT SIMULATED)
 * Fluorescent orange traffic cones with micro-prismatic white reflective collars.
 */
export function createTrafficConesGroup(count = 4, spacing = 2.5): THREE.Group {
  const group = new THREE.Group();
  group.name = 'traffic_cones_group';

  const orangeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.35,
    metalness: 0.1,
    emissive: 0xea580c,
    emissiveIntensity: 0.25,
  });
  const reflectiveWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.3,
    emissive: 0xf8fafc,
    emissiveIntensity: 0.5,
  });
  const blackBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

  for (let i = 0; i < count; i++) {
    const cone = new THREE.Group();
    cone.position.set(i * spacing, 0, 0);

    // Square Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.04), blackBaseMat);
    base.position.set(0, 0, 0.02);
    cone.add(base);

    // Tapered Cone Body
    const coneBody = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.68, 16), orangeMat);
    coneBody.rotation.x = Math.PI / 2;
    coneBody.position.set(0, 0, 0.38);
    cone.add(coneBody);

    // Reflective Sleeve Collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.10, 0.18, 16), reflectiveWhiteMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0, 0.38);
    cone.add(collar);

    group.add(cone);
  }

  return group;
}

/**
 * HIGHWAY CRASH ATTENUATOR DRUMS (SCENERY — NOT SIMULATED)
 * Yellow impact-absorbing sand barrels with black hazard chevrons.
 */
export function createRoadsideDrumsMesh(count = 3): THREE.Group {
  const group = new THREE.Group();
  group.name = 'crash_attenuator_drums';

  const drumYellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4, metalness: 0.1 });
  const blackLidMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const hazardStripeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });

  for (let i = 0; i < count; i++) {
    const drum = new THREE.Group();
    drum.position.set(i * 1.1, 0, 0);

    // Main barrel body
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.35, 0.92, 16), drumYellowMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, 0.46);
    drum.add(barrel);

    // Black Top Lid
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.06, 16), blackLidMat);
    lid.rotation.x = Math.PI / 2;
    lid.position.set(0, 0, 0.93);
    drum.add(lid);

    // Black Center Hazard Stripe
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.382, 0.382, 0.22, 16), hazardStripeMat);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.set(0, 0, 0.46);
    drum.add(stripe);

    group.add(drum);
  }

  return group;
}

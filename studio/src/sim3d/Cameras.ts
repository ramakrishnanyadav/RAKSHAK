/**
 * Cameras.ts - Camera Controller with 4 Modes & Reduced-Motion Accessibility
 * 
 * Camera Modes:
 * 1. 'chase'   - Follows ego from behind and slightly above (-12m x, +6m z), oriented along yaw
 * 2. 'bird'    - Overhead top-down orthographic/high-perspective perspective (z = 45m)
 * 3. 'cockpit' - Inside vehicle cabin looking forward through windshield (+1.2m x, +1.2m z)
 * 4. 'orbit'   - Free 360-degree orbit around ego or selected agent with mouse drag
 * 
 * Strict WCAG Accessibility:
 * - Checks window.matchMedia('(prefers-reduced-motion: reduce)')
 * - If user prefers reduced motion, skips camera easing and cuts directly to target position.
 */

import * as THREE from 'three';
import { InterpolatedPose } from './Playback';

export type CameraMode = 'chase' | 'bird' | 'cockpit' | 'orbit';

export interface CameraTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export function checkPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private currentMode: CameraMode;
  private orbitAngles: { theta: number; phi: number; radius: number };
  private isOrbitDragging: boolean;
  private lastMousePos: { x: number; y: number };
  private prefersReducedMotion: boolean;

  constructor(camera: THREE.PerspectiveCamera, initialMode: CameraMode = 'chase') {
    this.camera = camera;
    this.currentMode = initialMode;
    this.orbitAngles = { theta: 0.5, phi: Math.PI / 4, radius: 24.0 };
    this.isOrbitDragging = false;
    this.lastMousePos = { x: 0, y: 0 };
    this.prefersReducedMotion = checkPrefersReducedMotion();
  }

  public setMode(mode: CameraMode): void {
    this.currentMode = mode;
  }

  public getMode(): CameraMode {
    return this.currentMode;
  }

  public setPrefersReducedMotion(value: boolean): void {
    this.prefersReducedMotion = value;
  }

  /**
   * Computes desired target position and lookAt point for the given ego/target pose.
   */
  public computeTarget(egoPose: InterpolatedPose | null, targetAgentPose?: InterpolatedPose | null): CameraTarget {
    const focusPose = targetAgentPose || egoPose || { x: 0, y: 0, z: 0, yaw: 0, length: 4.2, width: 1.8 };
    const { x, y, yaw } = focusPose;

    const targetPos = new THREE.Vector3();
    const lookAtPos = new THREE.Vector3(x, y, 0.5);

    switch (this.currentMode) {
      case 'chase': {
        // Behind ego along yaw vector: offset (-12m in heading direction, +6m height)
        const distBehind = 12.0;
        const height = 5.8;
        targetPos.set(
          x - distBehind * Math.cos(yaw),
          y - distBehind * Math.sin(yaw),
          height
        );
        lookAtPos.set(
          x + 10.0 * Math.cos(yaw),
          y + 10.0 * Math.sin(yaw),
          1.0
        );
        break;
      }

      case 'bird': {
        // Bird's-eye top-down view centered on vehicle
        targetPos.set(x + 5.0, y, 42.0);
        lookAtPos.set(x + 5.0, y, 0.0);
        break;
      }

      case 'cockpit': {
        // Driver eye-level perspective inside vehicle cabin
        const hoodOffset = 1.2;
        const eyeHeight = 1.25;
        targetPos.set(
          x + hoodOffset * Math.cos(yaw),
          y + hoodOffset * Math.sin(yaw),
          eyeHeight
        );
        lookAtPos.set(
          x + 35.0 * Math.cos(yaw),
          y + 35.0 * Math.sin(yaw),
          eyeHeight - 0.1
        );
        break;
      }

      case 'orbit': {
        // Spherical coordinates around target
        const { theta, phi, radius } = this.orbitAngles;
        targetPos.set(
          x + radius * Math.sin(phi) * Math.cos(theta),
          y + radius * Math.sin(phi) * Math.sin(theta),
          Math.max(1.5, radius * Math.cos(phi))
        );
        lookAtPos.set(x, y, 1.0);
        break;
      }
    }

    return { position: targetPos, lookAt: lookAtPos };
  }

  /**
   * Updates camera position and orientation each frame with exponential smoothing.
   */
  public update(egoPose: InterpolatedPose | null, targetAgentPose?: InterpolatedPose | null, dampingFactor: number = 0.08): void {
    const { position: targetPos, lookAt: targetLookAt } = this.computeTarget(egoPose, targetAgentPose);

    if (this.prefersReducedMotion) {
      // Instant transition without motion sickness trigger
      this.camera.position.copy(targetPos);
      this.camera.lookAt(targetLookAt);
    } else {
      // Eased exponential smoothing
      this.camera.position.lerp(targetPos, dampingFactor);
      const currentLookAt = new THREE.Vector3();
      this.camera.getWorldDirection(currentLookAt);
      currentLookAt.multiplyScalar(20.0).add(this.camera.position);
      currentLookAt.lerp(targetLookAt, dampingFactor);
      this.camera.lookAt(currentLookAt);
    }
  }

  // Pointer drag event handlers for orbit mode
  public handlePointerDown(e: MouseEvent | TouchEvent): void {
    if (this.currentMode !== 'orbit') return;
    this.isOrbitDragging = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    this.lastMousePos = { x: clientX, y: clientY };
  }

  public handlePointerMove(e: MouseEvent | TouchEvent): void {
    if (!this.isOrbitDragging || this.currentMode !== 'orbit') return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    const dx = clientX - this.lastMousePos.x;
    const dy = clientY - this.lastMousePos.y;

    this.orbitAngles.theta -= dx * 0.008;
    this.orbitAngles.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, this.orbitAngles.phi - dy * 0.008));
    this.lastMousePos = { x: clientX, y: clientY };
  }

  public handlePointerUp(): void {
    this.isOrbitDragging = false;
  }

  public handleWheel(e: WheelEvent): void {
    if (this.currentMode !== 'orbit') return;
    this.orbitAngles.radius = Math.max(5.0, Math.min(80.0, this.orbitAngles.radius + e.deltaY * 0.03));
  }
}


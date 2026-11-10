/**
 * PlaybackClock - Single Master Playback Engine for ADAPTIVE-PATH 3D Replay
 * 
 * Strict Technical Rules (Master Prompt v3):
 * 1. ONE playback clock drives 3D, charts, inspector and timeline in lockstep.
 * 2. 60 FPS interpolation between 10 Hz logged frames:
 *    - Linear interpolation for (x, y, z) position
 *    - Shortest-angle interpolation for yaw (eliminating 360-deg wrapping glitches)
 * 3. Never extrapolate beyond the last logged frame (t <= t_max).
 * 4. Numeric telemetry is strictly tied to the nearest logged frame (no invented numbers).
 */

import { Frame, RunLog, EgoState, AgentTrack } from '../types/apath_log';

export interface InterpolatedPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  v?: number;
  length: number;
  width: number;
  height?: number;
}

export interface PlaybackState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  speed: number;
  nearestFrameIndex: number;
  progressFraction: number;
  isEnd: boolean;
}

export type PlaybackListener = (state: PlaybackState) => void;

/**
 * Shortest-angle interpolation for yaw angle across [-pi, pi] or [0, 2pi].
 * Finds shortest arc between yaw0 and yaw1.
 */
export function interpolateYaw(yaw0: number, yaw1: number, alpha: number): number {
  let diff = (yaw1 - yaw0) % (2 * Math.PI);
  if (diff > Math.PI) {
    diff -= 2 * Math.PI;
  } else if (diff < -Math.PI) {
    diff += 2 * Math.PI;
  }
  return yaw0 + alpha * diff;
}

export class PlaybackClock {
  private frames: Frame[];
  private duration: number;
  private currentTime: number;
  private isPlaying: boolean;
  private speed: number;
  private listeners: Set<PlaybackListener>;
  private animFrameId: number | null;
  private lastWallTime: number | null;

  constructor(runLog?: RunLog | null) {
    this.frames = runLog?.frames || [];
    this.duration = this.frames.length > 0 ? this.frames[this.frames.length - 1].t : 0;
    this.currentTime = 0;
    this.isPlaying = false;
    this.speed = 1.0;
    this.listeners = new Set();
    this.animFrameId = null;
    this.lastWallTime = null;
  }

  public setRunLog(runLog: RunLog | null): void {
    const wasPlaying = this.isPlaying;
    this.pause();
    this.frames = runLog?.frames || [];
    this.duration = this.frames.length > 0 ? this.frames[this.frames.length - 1].t : 0;
    this.currentTime = 0;
    this.notify();
    if (wasPlaying && this.frames.length > 0) {
      this.play();
    }
  }

  public subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public getState(): PlaybackState {
    const nearestIdx = this.getNearestFrameIndex();
    return {
      currentTime: this.currentTime,
      duration: this.duration,
      isPlaying: this.isPlaying,
      speed: this.speed,
      nearestFrameIndex: nearestIdx,
      progressFraction: this.duration > 0 ? Math.min(1, this.currentTime / this.duration) : 0,
      isEnd: this.duration > 0 && this.currentTime >= this.duration,
    };
  }

  public play(): void {
    if (this.frames.length === 0) return;
    if (this.currentTime >= this.duration) {
      this.currentTime = 0;
    }
    this.isPlaying = true;
    this.lastWallTime = performance.now();
    this.tick();
    this.notify();
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.lastWallTime = null;
    this.notify();
  }

  public togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public setSpeed(speed: number): void {
    // Valid speeds: 0.25, 0.5, 1.0, 2.0, 4.0
    this.speed = Math.max(0.1, Math.min(8.0, speed));
    this.notify();
  }

  public seek(timeSeconds: number): void {
    // Strict clamp: [0, duration]
    this.currentTime = Math.max(0, Math.min(this.duration, timeSeconds));
    this.notify();
  }

  public seekToFrame(frameIndex: number): void {
    if (this.frames.length === 0) return;
    const idx = Math.max(0, Math.min(this.frames.length - 1, frameIndex));
    this.currentTime = this.frames[idx].t;
    this.notify();
  }

  public reset(): void {
    this.pause();
    this.currentTime = 0;
    this.notify();
  }

  /**
   * Technical Rule 3 & 4: Nearest logged frame index for all tabular/numeric telemetry.
   * Eliminates hallucinated numeric metrics between 10 Hz sample boundaries.
   */
  public getNearestFrameIndex(): number {
    if (this.frames.length === 0) return 0;
    if (this.currentTime <= 0) return 0;
    if (this.currentTime >= this.duration) return this.frames.length - 1;

    // Fast binary search or direct lookup since frames are 10 Hz (dt = 0.1s)
    let low = 0;
    let high = this.frames.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.frames[mid].t < this.currentTime) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const idx = Math.max(0, Math.min(this.frames.length - 1, low));
    const prev = Math.max(0, idx - 1);
    const d1 = Math.abs(this.frames[idx].t - this.currentTime);
    const d0 = Math.abs(this.frames[prev].t - this.currentTime);
    return d1 < d0 ? idx : prev;
  }

  public getNearestFrame(): Frame | null {
    if (this.frames.length === 0) return null;
    return this.frames[this.getNearestFrameIndex()];
  }

  /**
   * Technical Rule 2: 60 FPS Smooth Interpolation for 3D Visual Rendering
   * Finds bracketing frames (f0, f1) and computes alpha in [0, 1].
   */
  public getInterpolatedEgoPose(): InterpolatedPose | null {
    if (this.frames.length === 0) return null;
    if (this.frames.length === 1 || this.currentTime <= this.frames[0].t) {
      const f = this.frames[0].ego;
      return {
        x: f.x,
        y: f.y,
        z: 0.0,
        yaw: f.yaw,
        v: f.v,
        length: f.length || 4.2,
        width: f.width || 1.8,
      };
    }
    const last = this.frames[this.frames.length - 1].ego;
    if (this.currentTime >= this.duration) {
      return {
        x: last.x,
        y: last.y,
        z: 0.0,
        yaw: last.yaw,
        v: last.v,
        length: last.length || 4.2,
        width: last.width || 1.8,
      };
    }

    // Find bounding frames
    let f0Idx = 0;
    for (let i = 0; i < this.frames.length - 1; i++) {
      if (this.currentTime >= this.frames[i].t && this.currentTime <= this.frames[i + 1].t) {
        f0Idx = i;
        break;
      }
    }
    const f0 = this.frames[f0Idx];
    const f1 = this.frames[f0Idx + 1];
    const dt = f1.t - f0.t;
    const alpha = dt > 0 ? (this.currentTime - f0.t) / dt : 0;

    const ego0 = f0.ego;
    const ego1 = f1.ego;

    return {
      x: ego0.x + alpha * (ego1.x - ego0.x),
      y: ego0.y + alpha * (ego1.y - ego0.y),
      z: 0.0,
      yaw: interpolateYaw(ego0.yaw, ego1.yaw, alpha),
      v: ego0.v + alpha * ((ego1.v || 0) - ego0.v),
      length: ego0.length || 4.2,
      width: ego0.width || 1.8,
    };
  }

  /**
   * Interpolate all dynamic agents active at current time.
   */
  public getInterpolatedAgents(): { agent: AgentTrack; pose: InterpolatedPose }[] {
    if (this.frames.length === 0) return [];
    const nearestFrame = this.getNearestFrame();
    if (!nearestFrame) return [];

    // Base set of agents comes from the nearest logged frame (R1 Contract)
    const result: { agent: AgentTrack; pose: InterpolatedPose }[] = [];

    // Bracketing frames for interpolation
    let f0Idx = 0;
    for (let i = 0; i < this.frames.length - 1; i++) {
      if (this.currentTime >= this.frames[i].t && this.currentTime <= this.frames[i + 1].t) {
        f0Idx = i;
        break;
      }
    }
    const f0 = this.frames[f0Idx];
    const f1 = this.frames[f0Idx + 1] || f0;
    const dt = f1.t - f0.t;
    const alpha = dt > 0 ? Math.max(0, Math.min(1, (this.currentTime - f0.t) / dt)) : 0;

    const f1AgentsMap = new Map<string, AgentTrack>();
    f1.agents.forEach((a) => f1AgentsMap.set(a.id, a));

    f0.agents.forEach((a0) => {
      const a1 = f1AgentsMap.get(a0.id) || a0;
      result.push({
        agent: a0,
        pose: {
          x: a0.x + alpha * (a1.x - a0.x),
          y: a0.y + alpha * (a1.y - a0.y),
          z: 0.0,
          yaw: interpolateYaw(a0.yaw, a1.yaw, alpha),
          length: a0.length || 2.0,
          width: a0.width || 1.0,
        },
      });
    });

    return result;
  }

  private tick = (): void => {
    if (!this.isPlaying) return;

    const now = performance.now();
    if (this.lastWallTime !== null) {
      const wallDeltaSec = (now - this.lastWallTime) / 1000;
      this.currentTime += wallDeltaSec * this.speed;

      // Never extrapolate past end of simulation
      if (this.currentTime >= this.duration) {
        this.currentTime = this.duration;
        this.isPlaying = false;
        this.notify();
        return;
      }
    }
    this.lastWallTime = now;
    this.notify();
    this.animFrameId = requestAnimationFrame(this.tick);
  };

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }
}


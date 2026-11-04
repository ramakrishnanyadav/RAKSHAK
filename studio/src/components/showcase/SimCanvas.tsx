/**
 * SimCanvas - High-performance Top-Down Simulation Canvas
 * Camera follows ego vehicle, renders realistic Indian road users (cattle, rickshaws, carts, pedestrians),
 * sensor visibility cones, multi-hypothesis predictions, and conformal safety boundaries.
 */

import React, { useRef, useEffect } from 'react';
import { ShowcaseFrame } from './types';

interface SimCanvasProps {
  frame: ShowcaseFrame | undefined;
  variant: 'adaptive' | 'standard';
  showSensors: boolean;
  showPredictions: boolean;
  showRiskField: boolean;
  width?: number;
  height?: number;
}

const drawRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else if (typeof ctx.rect === 'function') {
    ctx.rect(x, y, w, h);
  } else if (typeof ctx.fillRect === 'function') {
    ctx.fillRect(x, y, w, h);
  }
};

export const SimCanvas: React.FC<SimCanvasProps> = ({
  frame,
  variant,
  showSensors,
  showPredictions,
  showRiskField,
  width = 640,
  height = 420,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, width, height);

    if (!frame || !frame.ego) {
      // Empty state
      ctx.fillStyle = '#4B5563';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for telemetry frame...', width / 2, height / 2);
      return;
    }

    const { ego, agents, planner_output } = frame;

    // Camera transform: Center view on ego, with ego pointing rightwards/forward
    // In our coordinate system, x is longitudinal (forward), y is lateral (left/right)
    // Scale: meters to pixels
    const scale = 14.0; // 1 meter = 14 pixels
    const cx = width * 0.35; // Put ego slightly to the left so lookahead is visible
    const cy = height * 0.5;

    ctx.save();
    ctx.translate(cx, cy);

    // Helper functions for coordinate conversion relative to ego
    const worldToCanvas = (wx: number, wy: number) => {
      const dx = wx - ego.x;
      const dy = wy - ego.y;
      return {
        x: dx * scale,
        y: -dy * scale, // Invert y because canvas y increases downwards
      };
    };

    // 1. Draw Road Environment
    // Draw road strip spanning longitudinal window
    const roadHalfWidth = 6.0; // 12m wide road
    const minX = -40;
    const maxX = 80;

    // Road asphalt
    ctx.fillStyle = '#14161C';
    ctx.fillRect(minX * scale, -roadHalfWidth * scale, (maxX - minX) * scale, roadHalfWidth * 2 * scale);

    // Road shoulder / curbs
    ctx.strokeStyle = '#262A36';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(minX * scale, -roadHalfWidth * scale);
    ctx.lineTo(maxX * scale, -roadHalfWidth * scale);
    ctx.moveTo(minX * scale, roadHalfWidth * scale);
    ctx.lineTo(maxX * scale, roadHalfWidth * scale);
    ctx.stroke();

    // Centerline (dashed white/amber)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.moveTo(minX * scale, 0);
    ctx.lineTo(maxX * scale, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Risk Field Heatmap (if enabled)
    if (showRiskField) {
      agents.forEach((ag) => {
        const { x, y } = worldToCanvas(ag.x, ag.y);
        const radius = (ag.length / 2 + 3.0) * scale;
        const grad = ctx.createRadialGradient(x, y, 2, x, y, radius);
        if (variant === 'adaptive') {
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.28)');
          grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.12)');
          grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
        } else {
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
          grad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 3. Sensor Perception Cones & Blind Spots (if enabled)
    if (showSensors) {
      // Camera + LiDAR sensor fan forward from ego
      ctx.save();
      ctx.rotate(-ego.yaw);

      // LiDAR 360 ring
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 35 * scale, 0, Math.PI * 2);
      ctx.stroke();

      // Forward Camera FOV (60 deg cone)
      const fovRad = Math.PI / 3;
      const fovDist = 45 * scale;
      const camGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, fovDist);
      camGrad.addColorStop(0, 'rgba(45, 212, 191, 0.14)');
      camGrad.addColorStop(0.7, 'rgba(45, 212, 191, 0.04)');
      camGrad.addColorStop(1, 'rgba(45, 212, 191, 0.0)');

      ctx.fillStyle = camGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, fovDist, -fovRad / 2, fovRad / 2);
      ctx.closePath();
      ctx.fill();

      // Radar long-range narrow beam (18 deg)
      const radarDist = 60 * scale;
      const radGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, radarDist);
      radGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
      radGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radarDist, -Math.PI / 20, Math.PI / 20);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // 4. Multi-Hypothesis Trajectory Predictions & Conformal Bounds (if enabled)
    if (showPredictions) {
      agents.forEach((ag) => {
        // Conformal safety envelope circles along time
        if (ag.conformal_envelope && ag.conformal_envelope.length > 0) {
          ctx.strokeStyle = variant === 'adaptive' ? 'rgba(45, 212, 191, 0.4)' : 'rgba(148, 163, 184, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);

          // Draw last conformal radius at prediction horizon
          const lastEnv = ag.conformal_envelope[Math.min(4, ag.conformal_envelope.length - 1)];
          const agCanvas = worldToCanvas(ag.x, ag.y);
          ctx.beginPath();
          ctx.arc(agCanvas.x, agCanvas.y, lastEnv.radius_m * scale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Hypotheses lines
        if (ag.prediction_hypotheses && ag.prediction_hypotheses.length > 0) {
          ag.prediction_hypotheses.forEach((hyp, hIdx) => {
            if (!hyp.trajectory || hyp.trajectory.length === 0) return;
            ctx.save();
            ctx.strokeStyle =
              hIdx === 0
                ? variant === 'adaptive'
                  ? 'rgba(45, 212, 191, 0.8)'
                  : 'rgba(239, 68, 68, 0.8)'
                : 'rgba(251, 191, 36, 0.5)';
            ctx.lineWidth = Math.max(1, hyp.weight * 2.5);
            ctx.setLineDash([4, 4]);

            ctx.beginPath();
            const start = worldToCanvas(ag.x, ag.y);
            ctx.moveTo(start.x, start.y);
            hyp.trajectory.forEach((pt) => {
              const cp = worldToCanvas(pt.x, pt.y);
              ctx.lineTo(cp.x, cp.y);
            });
            ctx.stroke();
            ctx.restore();
          });
        }
      });
    }

    // 5. Ego Planned Trajectory
    if (planner_output?.planned_trajectory && planner_output.planned_trajectory.length > 0) {
      ctx.save();
      ctx.strokeStyle = variant === 'adaptive' ? '#2DD4BF' : '#94A3B8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const p0 = worldToCanvas(ego.x, ego.y);
      ctx.moveTo(p0.x, p0.y);
      planner_output.planned_trajectory.forEach((pt) => {
        const cp = worldToCanvas(pt.x, pt.y);
        ctx.lineTo(cp.x, cp.y);
      });
      ctx.stroke();

      // Trajectory end marker
      const pLast = worldToCanvas(
        planner_output.planned_trajectory[planner_output.planned_trajectory.length - 1].x,
        planner_output.planned_trajectory[planner_output.planned_trajectory.length - 1].y
      );
      ctx.fillStyle = variant === 'adaptive' ? '#2DD4BF' : '#94A3B8';
      ctx.beginPath();
      ctx.arc(pLast.x, pLast.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Draw Agents / Road Users
    agents.forEach((ag) => {
      const { x, y } = worldToCanvas(ag.x, ag.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-ag.yaw);

      const agLen = ag.length * scale;
      const agWid = ag.width * scale;

      if (ag.is_occluded) {
        // Occluded indicator: dashed outline with warning eye
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(-agLen / 2, -agWid / 2, agLen, agWid);
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('OCCLUDED', 0, -agWid / 2 - 4);
      }

      // Distinct geometry per road user class
      switch (ag.class_name) {
        case 'cattle': {
          // Warm brown rounded body with cattle horns
          ctx.fillStyle = '#A16207'; // Ochre amber
          ctx.beginPath();
          drawRoundRect(ctx, -agLen / 2, -agWid / 2, agLen, agWid, 4);
          ctx.fill();
          ctx.strokeStyle = '#D97706';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Head & horns on right (forward in body frame)
          ctx.fillStyle = '#78350F';
          ctx.beginPath();
          ctx.arc(agLen / 2 - 2, 0, agWid / 2.2, 0, Math.PI * 2);
          ctx.fill();

          // White horns
          ctx.strokeStyle = '#F3F4F6';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(agLen / 2 - 2, -agWid / 2);
          ctx.lineTo(agLen / 2 + 4, -agWid / 2 - 3);
          ctx.moveTo(agLen / 2 - 2, agWid / 2);
          ctx.lineTo(agLen / 2 + 4, agWid / 2 + 3);
          ctx.stroke();
          break;
        }

        case 'auto_rickshaw': {
          // Indian auto-rickshaw: yellow hood, green cabin
          ctx.fillStyle = '#15803D'; // Green body
          ctx.beginPath();
          drawRoundRect(ctx, -agLen / 2, -agWid / 2, agLen * 0.65, agWid, 3);
          ctx.fill();

          ctx.fillStyle = '#EAB308'; // Yellow hood front
          ctx.beginPath();
          ctx.moveTo(agLen * 0.15, -agWid / 2);
          ctx.lineTo(agLen / 2, 0); // Tapered front nose (3-wheeler)
          ctx.lineTo(agLen * 0.15, agWid / 2);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#CA8A04';
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        }

        case 'handcart': {
          // Wooden cart: brown slats with wheels on sides
          ctx.fillStyle = '#92400E';
          ctx.fillRect(-agLen / 2, -agWid / 2, agLen, agWid);
          ctx.strokeStyle = '#FCD34D';
          ctx.lineWidth = 1;
          ctx.strokeRect(-agLen / 2, -agWid / 2, agLen, agWid);

          // Wheels
          ctx.fillStyle = '#1F2937';
          ctx.fillRect(-agLen * 0.1, -agWid / 2 - 2, agLen * 0.2, 2);
          ctx.fillRect(-agLen * 0.1, agWid / 2, agLen * 0.2, 2);
          break;
        }

        case 'pedestrian': {
          // Pedestrian: Circle body with shoulder line
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.arc(0, 0, agWid / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0284C7';
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        }

        case 'truck': {
          // Heavy truck: long container box with cab
          ctx.fillStyle = '#475569';
          ctx.fillRect(-agLen / 2, -agWid / 2, agLen * 0.75, agWid);
          ctx.fillStyle = '#334155'; // Front cab
          ctx.fillRect(agLen * 0.25, -agWid / 2, agLen * 0.25, agWid);
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 1;
          ctx.strokeRect(-agLen / 2, -agWid / 2, agLen, agWid);
          break;
        }

        default: {
          // General vehicle
          ctx.fillStyle = '#64748B';
          ctx.beginPath();
          drawRoundRect(ctx, -agLen / 2, -agWid / 2, agLen, agWid, 3);
          ctx.fill();
          break;
        }
      }

      // Class label above vehicle
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '8px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      const prettyClass = ag.class_name.replace('_', ' ');
      ctx.fillText(prettyClass, 0, -agWid / 2 - 3);

      ctx.restore();
    });

    // 7. Draw Ego Vehicle
    ctx.save();
    // Ego position in canvas coordinates is always (0, 0) relative to translated center
    ctx.rotate(-ego.yaw);

    const egoLen = ego.length * scale;
    const egoWid = ego.width * scale;

    // Body
    if (variant === 'adaptive') {
      ctx.fillStyle = '#2DD4BF'; // Teal accent
      ctx.shadowColor = 'rgba(45, 212, 191, 0.4)';
      ctx.shadowBlur = 12;
    } else {
      ctx.fillStyle = '#94A3B8'; // Slate baseline
      ctx.shadowColor = 'rgba(148, 163, 184, 0.2)';
      ctx.shadowBlur = 6;
    }

    ctx.beginPath();
    drawRoundRect(ctx, -egoLen / 2, -egoWid / 2, egoLen, egoWid, 5);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dark windshield / roof
    ctx.fillStyle = '#0B0F17';
    ctx.beginPath();
    drawRoundRect(ctx, -egoLen * 0.2, -egoWid * 0.38, egoLen * 0.45, egoWid * 0.76, 3);
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(egoLen / 2 - 1, -egoWid * 0.4, 2, egoWid * 0.2);
    ctx.fillRect(egoLen / 2 - 1, egoWid * 0.2, 2, egoWid * 0.2);

    // Front directional arrow
    ctx.strokeStyle = variant === 'adaptive' ? '#14B8A6' : '#64748B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(egoLen * 0.05, 0);
    ctx.lineTo(egoLen * 0.35, 0);
    ctx.lineTo(egoLen * 0.25, -egoWid * 0.15);
    ctx.moveTo(egoLen * 0.35, 0);
    ctx.lineTo(egoLen * 0.25, egoWid * 0.15);
    ctx.stroke();

    ctx.restore();

    // 8. Collision Alert Ring if frame has collision
    const isCollision = (frame.min_clearance_m <= 0.05 && frame.ego.v > 0.5) || frame.ego.active_state === 'EMERGENCY_BRAKE' && frame.caption.toLowerCase().includes('collided');
    if (isCollision) {
      ctx.save();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [frame, variant, showSensors, showPredictions, showRiskField, width, height]);

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: `${height}px`,
          display: 'block',
          background: '#090A0D',
        }}
      />
    </div>
  );
};

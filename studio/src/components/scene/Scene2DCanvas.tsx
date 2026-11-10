import React, { useEffect, useRef } from 'react';
import { SceneModel } from '../../adapters/sceneModelAdapter';

interface Scene2DCanvasProps {
  sceneModel: SceneModel;
  onSelectAgent?: (agentId: string | null) => void;
  selectedAgentId?: string | null;
  plannerId?: string;
}

export const Scene2DCanvas: React.FC<Scene2DCanvasProps> = ({
  sceneModel,
  onSelectAgent,
  selectedAgentId,
  plannerId = 'P3',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Viewport transform: center around ego.x
    const { ego, roadBoundaries, staticObstacles, agents, plannedTrajectory, bounds } = sceneModel;
    const effectiveBounds = bounds || (sceneModel as any).world?.bounds || { x_min: -10, x_max: 100, y_min: -6, y_max: 6 };
    const scale = 14; // pixels per meter
    const centerX = width * 0.35;
    const centerY = height * 0.5;

    // World to screen transform
    const toScreen = (wx: number, wy: number): [number, number] => {
      const sx = centerX + (wx - ego.x) * scale;
      const sy = centerY - wy * scale; // Invert y for screen coords
      return [sx, sy];
    };

    // 1. Clear background
    ctx.fillStyle = '#0B0C0F';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw ground grid
    ctx.strokeStyle = '#171B22';
    ctx.lineWidth = 1;
    const startGridX = Math.floor(ego.x - 30);
    const endGridX = Math.ceil(ego.x + 50);
    for (let gx = startGridX; gx <= endGridX; gx += 5) {
      const [sx] = toScreen(gx, 0);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }
    for (let gy = -15; gy <= 15; gy += 5) {
      const [, sy] = toScreen(ego.x, gy);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }

    // 3. Draw Road Boundaries and Road Surface
    if (roadBoundaries && roadBoundaries.length >= 2) {
      const leftBoundary = roadBoundaries.find((b) => b.side === 'left') || roadBoundaries[0];
      const rightBoundary = roadBoundaries.find((b) => b.side === 'right') || roadBoundaries[1];

      if (leftBoundary && rightBoundary && leftBoundary.points.length > 1) {
        ctx.fillStyle = '#1E2430';
        ctx.beginPath();
        const [firstLx, firstLy] = toScreen(leftBoundary.points[0][0], leftBoundary.points[0][1]);
        ctx.moveTo(firstLx, firstLy);
        for (let i = 1; i < leftBoundary.points.length; i++) {
          const [lx, ly] = toScreen(leftBoundary.points[i][0], leftBoundary.points[i][1]);
          ctx.lineTo(lx, ly);
        }
        for (let i = rightBoundary.points.length - 1; i >= 0; i--) {
          const [rx, ry] = toScreen(rightBoundary.points[i][0], rightBoundary.points[i][1]);
          ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.fill();
      }

      // Draw boundary edge lines
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      roadBoundaries.forEach((boundary) => {
        ctx.beginPath();
        boundary.points.forEach((pt, i) => {
          const [sx, sy] = toScreen(pt[0], pt[1]);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      });
    }

    // 4. CONFIG 4.70m scoring corridor (amber dashed line at y = +4.70 and y = -4.70)
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);

    [-4.70, 4.70].forEach((corridorY) => {
      const [x1, y1] = toScreen(effectiveBounds.x_min, corridorY);
      const [x2, y2] = toScreen(effectiveBounds.x_max, corridorY);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Label corridor
      ctx.fillStyle = '#F59E0B';
      ctx.font = '10px monospace';
      ctx.fillText(corridorY > 0 ? '+4.70m CONFIG SCORING LIMIT' : '-4.70m CONFIG SCORING LIMIT', 20, y1 + (corridorY > 0 ? -6 : 14));
    });

    // 5. Goal Line at x = 65.0m
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    const [gx1, gy1] = toScreen(65.0, -12.0);
    const [, gy2] = toScreen(65.0, 12.0);
    ctx.beginPath();
    ctx.moveTo(gx1, gy1);
    ctx.lineTo(gx1, gy2);
    ctx.stroke();

    ctx.fillStyle = '#06B6D4';
    ctx.font = '11px sans-serif';
    ctx.fillText('GOAL THRESHOLD (65.0m)', gx1 + 5, gy2 + 20);

    ctx.setLineDash([]); // Reset line dash

    // 6. Static Obstacles
    staticObstacles.forEach((obj) => {
      const [sx, sy] = toScreen(obj.x, obj.y);
      const sw = (obj.length || 2.0) * scale;
      const sh = (obj.width || 2.0) * scale;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-(obj.yaw || 0));

      let fillColor = '#D97706';
      if (obj.kind === 'pothole') fillColor = '#44403C';
      else if (obj.kind === 'barrier') fillColor = '#EF4444';
      else if (obj.kind === 'parked_vehicle') fillColor = '#64748B';

      ctx.fillStyle = fillColor;
      ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(-sw / 2, -sh / 2, sw, sh);

      ctx.restore();
    });

    // 7. Planned Trajectory Ribbon
    const isP3 = plannerId.toUpperCase().includes('P3');
    const egoColor = isP3 ? '#2DD4BF' : '#94A3B8';

    if (plannedTrajectory && plannedTrajectory.length > 1) {
      ctx.strokeStyle = egoColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      plannedTrajectory.forEach((p, idx) => {
        const [tx, ty] = toScreen(p.x, p.y);
        if (idx === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      });
      ctx.stroke();

      // Waypoint dots
      ctx.fillStyle = egoColor;
      plannedTrajectory.forEach((p) => {
        const [tx, ty] = toScreen(p.x, p.y);
        ctx.beginPath();
        ctx.arc(tx, ty, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 8. Dynamic Actors
    agents.forEach((ag) => {
      const [ax, ay] = toScreen(ag.x, ag.y);
      const al = (ag.length || 2.4) * scale;
      const aw = (ag.width || 1.1) * scale;
      const isSelected = ag.id === selectedAgentId;
      const isOccluded = ag.is_occluded;

      let agColor = '#F59E0B';
      if (ag.class_name === 'cattle') agColor = '#A16207';
      else if (ag.class_name === 'auto_rickshaw') agColor = '#EAB308';
      else if (ag.class_name === 'pedestrian') agColor = '#38BDF8';
      else if (ag.class_name === 'two_wheeler') agColor = '#A855F7';
      else if (ag.class_name === 'truck') agColor = '#EF4444';

      // Conformal prediction uncertainty envelopes
      if (ag.conformal_envelope && ag.conformal_envelope.length > 0) {
        ctx.strokeStyle = '#38BDF8';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.lineWidth = 1.5;
        ag.conformal_envelope.forEach((cone) => {
          const rPx = (cone.radius_m || 1.2) * scale;
          ctx.beginPath();
          ctx.arc(ax, ay, rPx, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }

      // Multi-hypothesis prediction trajectories
      if (ag.prediction_hypotheses) {
        ctx.strokeStyle = agColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ag.prediction_hypotheses.forEach((hyp) => {
          if (!hyp.trajectory || hyp.trajectory.length === 0) return;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          hyp.trajectory.forEach((tp) => {
            const [hx, hy] = toScreen(tp.x, tp.y);
            ctx.lineTo(hx, hy);
          });
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }

      // Actor body box
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(-ag.yaw);

      ctx.fillStyle = isSelected ? '#FFFFFF' : agColor;
      ctx.globalAlpha = isOccluded ? 0.35 : 1.0;
      ctx.fillRect(-al / 2, -aw / 2, al, aw);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(-al / 2, -aw / 2, al, aw);

      // Heading indicator triangle
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(al / 2, 0);
      ctx.lineTo(al / 2 - 4, -3);
      ctx.lineTo(al / 2 - 4, 3);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
      ctx.globalAlpha = 1.0;

      // Actor label
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${ag.id} (${ag.class_name})`, ax - 15, ay - aw - 4);
    });

    // 9. Ego Vehicle Body
    const [ex, ey] = toScreen(ego.x, ego.y);
    const el = (ego.length || 4.2) * scale;
    const ew = (ego.width || 1.8) * scale;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(-ego.yaw);

    ctx.fillStyle = egoColor;
    ctx.fillRect(-el / 2, -ew / 2, el, ew);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(-el / 2, -ew / 2, el, ew);

    // Windshield & lights
    ctx.fillStyle = '#0B0C0F';
    ctx.fillRect(-el * 0.1, -ew * 0.4, el * 0.25, ew * 0.8);
    ctx.fillStyle = '#FFFBEB';
    ctx.fillRect(el / 2 - 2, -ew * 0.4, 2, 4);
    ctx.fillRect(el / 2 - 2, ew * 0.4 - 4, 2, 4);

    ctx.restore();

  }, [sceneModel, selectedAgentId, plannerId]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSelectAgent) return;
    const canvas = canvasRef.current;
    if (!canvas) {
      onSelectAgent(null);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleFactorX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleFactorY = rect.height > 0 ? canvas.height / rect.height : 1;
    const clickSx = (e.clientX - rect.left) * scaleFactorX;
    const clickSy = (e.clientY - rect.top) * scaleFactorY;

    const width = canvas.width;
    const height = canvas.height;
    const scale = 14;
    const centerX = width * 0.35;
    const centerY = height * 0.5;

    let clickedId: string | null = null;
    for (const ag of sceneModel.agents) {
      const ax = centerX + (ag.x - sceneModel.ego.x) * scale;
      const ay = centerY - ag.y * scale;
      const dist = Math.hypot(clickSx - ax, clickSy - ay);
      if (dist <= 30) {
        clickedId = ag.id;
        break;
      }
    }
    onSelectAgent(clickedId);
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label="2D Planar Simulation Replay View"
      width={1280}
      height={640}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        backgroundColor: '#0B0C0F',
      }}
    />
  );
};


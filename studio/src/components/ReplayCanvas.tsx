/**
 * High-Performance Accessible 2D Simulation Replay Canvas.
 * Renders top-down world, dynamic traffic agents, conformal uncertainty cones,
 * calibrated risk field (with hatched patterns, never color alone), and ego trajectory.
 * Features an integrated visual interpretation legend and layer visibility controls.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RunLog, Frame, AgentTrack } from '../types/apath_log';

export interface CanvasLayerState {
  world: boolean;
  tracks: boolean;
  predictions: boolean;
  risk: boolean;
  plan: boolean;
}

interface ReplayCanvasProps {
  runLog: RunLog;
  currentFrameIndex: number;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  layers: CanvasLayerState;
  onToggleLayer?: (layerKey: keyof CanvasLayerState) => void;
  highContrast?: boolean;
  showLegend?: boolean;
}

export const ReplayCanvas: React.FC<ReplayCanvasProps> = ({
  runLog,
  currentFrameIndex,
  selectedAgentId,
  onSelectAgent,
  layers,
  onToggleLayer,
  highContrast = false,
  showLegend = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  // Cached transform helper for mouse click hit testing
  const transformRef = useRef<{
    scale: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
  }>({
    scale: 14,
    originX: 0,
    originY: 0,
    width: 800,
    height: 600,
  });

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const frame: Frame = runLog.frames[currentFrameIndex] || runLog.frames[0];
    if (!frame) {
      ctx.restore();
      return;
    }

    // Clear background
    ctx.fillStyle = highContrast ? '#000000' : '#07090e';
    ctx.fillRect(0, 0, width, height);

    // Camera transform: centered on ego vehicle with lookahead
    const egoX = frame.ego.x;
    const egoY = frame.ego.y;
    const scale = 14; // pixels per meter
    const originX = width * 0.35 - egoX * scale;
    const originY = height * 0.5 + egoY * scale;

    transformRef.current = { scale, originX, originY, width, height };

    const toCanvasX = (worldX: number) => originX + worldX * scale;
    const toCanvasY = (worldY: number) => originY - worldY * scale;

    const mathPi = Math.PI;

    // 1. LAYER: World Boundaries & Free Space (Non-lane based G2)
    if (layers.world && runLog.world) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = highContrast ? '#ffffff' : '#475569';
      ctx.setLineDash([]);

      runLog.world.road_boundaries.forEach((boundary) => {
        if (boundary.points.length < 2) return;
        ctx.beginPath();
        const start = boundary.points[0];
        ctx.moveTo(toCanvasX(start[0]), toCanvasY(start[1]));
        for (let i = 1; i < boundary.points.length; i++) {
          const pt = boundary.points[i];
          ctx.lineTo(toCanvasX(pt[0]), toCanvasY(pt[1]));
        }
        ctx.stroke();
      });

      // Spatial orientation grid (10m grid lines)
      ctx.strokeStyle = highContrast ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      const gridSize = 10 * scale;
      const startX = originX % gridSize;
      const startY = originY % gridSize;
      for (let x = startX; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = startY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Static Obstacles (Stalls, Potholes, Dividers)
      runLog.world.static_obstacles.forEach((obs) => {
        const cx = toCanvasX(obs.x);
        const cy = toCanvasY(obs.y);
        const w = obs.length * scale;
        const h = obs.width * scale;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-obs.yaw);

        if (obs.kind === 'pothole') {
          ctx.fillStyle = highContrast ? '#ffffff' : '#475569';
          ctx.beginPath();
          ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, 2 * mathPi);
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = highContrast ? '#222222' : '#1e293b';
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.strokeStyle = highContrast ? '#ffffff' : '#64748b';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = highContrast ? '#ffffff' : '#94a3b8';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(obs.kind, 0, 4);
        }
        ctx.restore();
      });
    }

    // 2. LAYER: Continuous Calibrated Risk Field (Hatched Pattern + Label + Color)
    if (layers.risk && frame.risk_field) {
      frame.agents.forEach((ag) => {
        const cx = toCanvasX(ag.x);
        const cy = toCanvasY(ag.y);
        const riskVal = frame.risk_field.ego_risk;
        const radius = 5.0 * scale;

        // Radial gradient
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
        if (highContrast) {
          grad.addColorStop(0, riskVal > 0.6 ? 'rgba(255, 51, 51, 0.6)' : 'rgba(255, 255, 0, 0.4)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          grad.addColorStop(0, riskVal > 0.6 ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.35)');
          grad.addColorStop(0.7, 'rgba(245, 158, 11, 0.1)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * mathPi);
        ctx.fill();

        // NON-COLOR HATCHING PATTERN for high risk zones (WCAG 2.2 AA non-color alone requirement)
        if (riskVal > 0.5) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.8, 0, 2 * mathPi);
          ctx.clip();
          ctx.strokeStyle = highContrast ? 'rgba(255,255,255,0.35)' : 'rgba(239,68,68,0.25)';
          ctx.lineWidth = 1.5;
          const hatchSpacing = 8;
          for (let hx = cx - radius; hx <= cx + radius; hx += hatchSpacing) {
            ctx.beginPath();
            ctx.moveTo(hx, cy - radius);
            ctx.lineTo(hx + radius, cy + radius);
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

    // 3. LAYER: Multi-Hypothesis Prediction Futures & Conformal Uncertainty Cones
    if (layers.predictions) {
      frame.agents.forEach((ag) => {
        // Conformal Uncertainty Cones (95% Coverage)
        if (ag.conformal_envelope && ag.conformal_envelope.length > 0) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);

          ag.conformal_envelope.forEach((cone) => {
            const agFutureX = ag.x + ag.v_x * cone.t_rel;
            const agFutureY = ag.y + ag.v_y * cone.t_rel;
            const fx = toCanvasX(agFutureX);
            const fy = toCanvasY(agFutureY);
            const rPx = cone.radius_m * scale;

            ctx.beginPath();
            ctx.arc(fx, fy, rPx, 0, 2 * mathPi);
            ctx.stroke();
            ctx.fill();
          });
          ctx.setLineDash([]);
        }

        // Multi-Hypothesis Future Paths
        ag.prediction_hypotheses.forEach((hyp) => {
          if (hyp.trajectory.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(toCanvasX(ag.x), toCanvasY(ag.y));
          hyp.trajectory.forEach((pt) => {
            ctx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y));
          });
          ctx.strokeStyle = `rgba(147, 197, 253, ${Math.max(0.25, hyp.weight * 0.7)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      });
    }

    // 4. LAYER: Planned Ego Path
    if (layers.plan && frame.planner_output.planned_trajectory.length > 0) {
      const plan = frame.planner_output.planned_trajectory;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(frame.ego.x), toCanvasY(frame.ego.y));
      plan.forEach((pt) => {
        ctx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y));
      });

      const isReplanned = frame.planner_output.replan_triggered;
      ctx.strokeStyle = isReplanned ? '#38bdf8' : '#10b981';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Waypoint beads
      plan.forEach((pt, i) => {
        if (i % 2 === 0) {
          ctx.fillStyle = isReplanned ? '#0284c7' : '#059669';
          ctx.beginPath();
          ctx.arc(toCanvasX(pt.x), toCanvasY(pt.y), 3, 0, 2 * mathPi);
          ctx.fill();
        }
      });
    }

    // 5. LAYER: Dynamic Traffic Agents (Tracks)
    if (layers.tracks) {
      frame.agents.forEach((ag) => {
        const cx = toCanvasX(ag.x);
        const cy = toCanvasY(ag.y);
        const w = ag.length * scale;
        const h = ag.width * scale;
        const isSelected = selectedAgentId === ag.id;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-ag.yaw);

        // Class colors
        let fillColor = '#f59e0b';
        if (ag.class_name === 'cattle') fillColor = '#d97706';
        else if (ag.class_name === 'pedestrian') fillColor = '#ec4899';
        else if (ag.class_name === 'two_wheeler') fillColor = '#8b5cf6';
        else if (ag.class_name === 'truck') fillColor = '#64748b';

        ctx.fillStyle = highContrast ? '#333333' : fillColor;
        ctx.fillRect(-w / 2, -h / 2, w, h);

        ctx.strokeStyle = isSelected ? (highContrast ? '#ffff00' : '#38bdf8') : (highContrast ? '#ffffff' : '#ffffff');
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.stroke();

        // Heading arrow (front direction indicator)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(w / 2 + 3, 0);
        ctx.lineTo(w / 2 - 3, -3);
        ctx.lineTo(w / 2 - 3, 3);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Selection ring
        if (isSelected) {
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(w, h) * 0.8, 0, 2 * mathPi);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Agent label
        ctx.fillStyle = highContrast ? '#ffffff' : '#f8fafc';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const speedKmh = (Math.hypot(ag.v_x, ag.v_y) * 3.6).toFixed(0);
        ctx.fillText(`${ag.class_name} #${ag.id} (${speedKmh} km/h)`, cx, cy - h / 2 - 6);
      });
    }

    // 6. Draw Ego Vehicle (Self-Driving Car)
    const egoCanvasX = toCanvasX(frame.ego.x);
    const egoCanvasY = toCanvasY(frame.ego.y);
    const egoW = frame.ego.length * scale;
    const egoH = frame.ego.width * scale;

    ctx.save();
    ctx.translate(egoCanvasX, egoCanvasY);
    ctx.rotate(-frame.ego.yaw);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-egoW / 2, -egoH / 2, egoW, egoH);
    ctx.strokeStyle = highContrast ? '#ffffff' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Windshield
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(egoW * 0.05, -egoH * 0.38, egoW * 0.25, egoH * 0.76);

    // Headlights
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(egoW / 2 - 1, -egoH / 2 + 2, 2, 3);
    ctx.fillRect(egoW / 2 - 1, egoH / 2 - 5, 2, 3);

    ctx.restore();

    // Ego badge
    ctx.fillStyle = highContrast ? '#00e5ff' : '#38bdf8';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`EGO [${frame.ego.active_state}]`, egoCanvasX, egoCanvasY - egoH / 2 - 8);

    ctx.restore();
  }, [runLog, currentFrameIndex, selectedAgentId, layers, highContrast]);

  useEffect(() => {
    let animationFrameId: number;
    const handleResize = () => {
      renderFrame();
    };

    window.addEventListener('resize', handleResize);
    renderFrame();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [renderFrame]);

  // Click on Canvas to select/deselect agent
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const { scale, originX, originY } = transformRef.current;
    const frame = runLog.frames[currentFrameIndex] || runLog.frames[0];
    if (!frame) return;

    let clickedAgentId: string | null = null;
    for (const ag of frame.agents) {
      const agX = originX + ag.x * scale;
      const agY = originY - ag.y * scale;
      const dist = Math.hypot(clickX - agX, clickY - agY);
      if (dist < Math.max(ag.length, ag.width) * scale * 0.8) {
        clickedAgentId = ag.id;
        break;
      }
    }

    onSelectAgent(clickedAgentId === selectedAgentId ? null : clickedAgentId);
  };

  const currentFrame = runLog.frames[currentFrameIndex] || runLog.frames[0];
  const egoSpeed = currentFrame ? (currentFrame.ego.v * 3.6).toFixed(1) : '0';
  const agentCount = currentFrame ? currentFrame.agents.length : 0;
  const timeSeconds = currentFrame ? currentFrame.t.toFixed(1) : '0.0';

  return (
    <div
      className="canvas-viewport"
      role="region"
      aria-label={`Simulation 2D replay viewport at time ${timeSeconds} seconds. Ego speed ${egoSpeed} km/h, ${agentCount} dynamic agents tracked.`}
      style={{
        position: 'relative',
        width: '100%',
        height: '480px',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--border-default)',
        background: '#07090e',
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        tabIndex={0}
        aria-label="Simulation canvas. Click to select agent. Use keyboard shortcuts Space to play, arrow keys to step."
      />

      {/* On-Canvas Visual Interpretation Legend */}
      {showLegend && (
        <div
          role="region"
          aria-label="Simulation visual legend"
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            zIndex: 10,
            maxWidth: isLegendOpen ? '380px' : 'auto',
            background: highContrast ? 'rgba(0, 0, 0, 0.94)' : 'rgba(11, 15, 25, 0.88)',
            border: '1px solid var(--border-default)',
            backdropFilter: 'blur(8px)',
            borderRadius: 'var(--radius-sm)',
            padding: isLegendOpen ? '0.65rem 0.85rem' : '0.35rem 0.6rem',
            color: '#ffffff',
            fontSize: '0.75rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            transition: 'all 0.15s ease',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              marginBottom: isLegendOpen ? '0.5rem' : '0',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: '0.75rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
              }}
            >
              Map Legend
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsLegendOpen(!isLegendOpen);
              }}
              aria-expanded={isLegendOpen}
              aria-label={isLegendOpen ? 'Collapse map legend' : 'Expand map legend'}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 4px',
              }}
            >
              {isLegendOpen ? 'Hide' : 'Show Legend'}
            </button>
          </div>

          {isLegendOpen && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.45rem 0.85rem',
                lineHeight: 1.25,
              }}
            >
              {/* 1. Self-Driving Vehicle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
                title="The autonomous ego car being tested"
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '10px',
                    background: '#0284c7',
                    border: '1.5px solid #38bdf8',
                    borderRadius: '1px',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                <span style={{ fontWeight: 600 }}>Self-Driving Car</span>
              </div>

              {/* 2. Planned Driving Route (Interactive Layer Toggle) */}
              <div
                role={onToggleLayer ? 'button' : undefined}
                tabIndex={onToggleLayer ? 0 : undefined}
                aria-label={onToggleLayer ? 'Toggle Planned Route visibility' : undefined}
                onClick={() => onToggleLayer && onToggleLayer('plan')}
                onKeyDown={(e) => {
                  if (onToggleLayer && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onToggleLayer('plan');
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: onToggleLayer ? 'pointer' : 'default',
                  opacity: layers.plan ? 1 : 0.4,
                }}
                title={onToggleLayer ? 'Click to toggle Planned Route visibility' : 'Car planned driving trajectory'}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    width: '14px',
                    height: '10px',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <span style={{ width: '14px', height: '3px', background: '#10b981', borderRadius: '1px' }} />
                </span>
                <span>Planned Route</span>
              </div>

              {/* 3. Moving Road Users (Interactive Layer Toggle) */}
              <div
                role={onToggleLayer ? 'button' : undefined}
                tabIndex={onToggleLayer ? 0 : undefined}
                aria-label={onToggleLayer ? 'Toggle Moving Traffic visibility' : undefined}
                onClick={() => onToggleLayer && onToggleLayer('tracks')}
                onKeyDown={(e) => {
                  if (onToggleLayer && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onToggleLayer('tracks');
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: onToggleLayer ? 'pointer' : 'default',
                  opacity: layers.tracks ? 1 : 0.4,
                }}
                title={onToggleLayer ? 'Click to toggle Moving Traffic visibility' : 'Cattle, rickshaws, pedestrians, trucks'}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '10px',
                    background: '#f59e0b',
                    border: '1px solid #ffffff',
                    borderRadius: '1px',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                <span>Moving Traffic</span>
              </div>

              {/* 4. Safety Margins (Interactive Layer Toggle) */}
              <div
                role={onToggleLayer ? 'button' : undefined}
                tabIndex={onToggleLayer ? 0 : undefined}
                aria-label={onToggleLayer ? 'Toggle Safety Margins visibility' : undefined}
                onClick={() => onToggleLayer && onToggleLayer('predictions')}
                onKeyDown={(e) => {
                  if (onToggleLayer && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onToggleLayer('predictions');
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: onToggleLayer ? 'pointer' : 'default',
                  opacity: layers.predictions ? 1 : 0.4,
                }}
                title={onToggleLayer ? 'Click to toggle Safety Margins visibility' : 'Conformal uncertainty buffer (95% coverage)'}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    border: '1.5px dashed #38bdf8',
                    background: 'rgba(56, 189, 248, 0.15)',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                <span>Safety Margins</span>
              </div>

              {/* 5. Collision Risk Area (Interactive Layer Toggle) */}
              <div
                role={onToggleLayer ? 'button' : undefined}
                tabIndex={onToggleLayer ? 0 : undefined}
                aria-label={onToggleLayer ? 'Toggle Hazard Risk Area visibility' : undefined}
                onClick={() => onToggleLayer && onToggleLayer('risk')}
                onKeyDown={(e) => {
                  if (onToggleLayer && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onToggleLayer('risk');
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: onToggleLayer ? 'pointer' : 'default',
                  opacity: layers.risk ? 1 : 0.4,
                }}
                title={onToggleLayer ? 'Click to toggle Collision Risk visibility' : 'Continuous danger field halo'}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.4)',
                    border: '1px solid #ef4444',
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(239, 68, 68, 0.8) 2px, rgba(239, 68, 68, 0.8) 4px)',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                <span>Hazard Risk Area</span>
              </div>

              {/* 6. Road Boundaries (Interactive Layer Toggle) */}
              <div
                role={onToggleLayer ? 'button' : undefined}
                tabIndex={onToggleLayer ? 0 : undefined}
                aria-label={onToggleLayer ? 'Toggle Road Edge / Shoulder visibility' : undefined}
                onClick={() => onToggleLayer && onToggleLayer('world')}
                onKeyDown={(e) => {
                  if (onToggleLayer && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onToggleLayer('world');
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: onToggleLayer ? 'pointer' : 'default',
                  opacity: layers.world ? 1 : 0.4,
                }}
                title={onToggleLayer ? 'Click to toggle Road Boundaries visibility' : 'Physical road edges and dirt shoulders'}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    width: '14px',
                    height: '10px',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <span style={{ width: '14px', height: '2.5px', background: '#64748b', borderRadius: '1px' }} />
                </span>
                <span>Road Edge / Shoulder</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

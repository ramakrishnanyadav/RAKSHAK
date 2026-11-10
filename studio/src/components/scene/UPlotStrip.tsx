import React, { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { RunLog } from '../../types/apath_log';

interface UPlotStripProps {
  runLog: RunLog | null;
  frameIndex: number;
  onScrub?: (index: number) => void;
  clearanceSidecar?: Record<number, number> | null;
}

export const UPlotStrip: React.FC<UPlotStripProps> = ({
  runLog,
  frameIndex,
  onScrub,
  clearanceSidecar,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const isProgrammaticRef = useRef<boolean>(false);

  useEffect(() => {
    if (!containerRef.current || !runLog || !runLog.frames || runLog.frames.length === 0) {
      return;
    }

    const frames = runLog.frames;
    const times = frames.map((f) => f.t);
    const speeds = frames.map((f) => f.ego.v * 3.6); // km/h
    const accels = frames.map((f) => f.ego.acceleration || 0);
    const jerks = frames.map((f) => f.ego.jerk || 0);
    const risks = frames.map((f) => f.risk_field?.ego_risk || 0);
    const clearances = frames.map((f, idx) => {
      if (clearanceSidecar && clearanceSidecar[idx] !== undefined) {
        return clearanceSidecar[idx];
      }
      return null;
    });

    const data: uPlot.AlignedData = [
      times,
      speeds,
      accels,
      jerks,
      risks,
      clearances as (number | null)[],
    ];

    const width = containerRef.current.clientWidth || 900;
    const height = 110;

    const opts: uPlot.Options = {
      width,
      height,
      cursor: {
        lock: false,
        sync: {
          key: 'sim-sync',
        },
      },
      legend: {
        show: true,
      },
      scales: {
        x: {
          time: false,
        },
      },
      axes: [
        {
          stroke: '#64748B',
          grid: { stroke: '#1E2430', width: 1 },
          ticks: { stroke: '#334155', width: 1 },
          values: (_u, vals) => vals.map((v) => `${v.toFixed(1)}s`),
        },
        {
          stroke: '#2DD4BF',
          grid: { stroke: '#1E2430', width: 1 },
          ticks: { stroke: '#334155', width: 1 },
          size: 40,
        },
      ],
      series: [
        {
          label: 'Time (s)',
          value: (_u, v) => (v != null ? `${v.toFixed(1)} s` : '—'),
        },
        {
          label: 'Speed (km/h)',
          stroke: '#2DD4BF',
          width: 1.5,
          value: (_u, v) => (v != null ? `${v.toFixed(1)} km/h` : '—'),
        },
        {
          label: 'Accel (m/s²)',
          stroke: '#38BDF8',
          width: 1.2,
          value: (_u, v) => (v != null ? `${v.toFixed(2)} m/s²` : '—'),
        },
        {
          label: 'Jerk (m/s³)',
          stroke: '#A855F7',
          width: 1.0,
          value: (_u, v) => (v != null ? `${v.toFixed(2)} m/s³` : '—'),
        },
        {
          label: 'Ego Risk',
          stroke: '#F59E0B',
          width: 1.5,
          value: (_u, v) => (v != null ? `${v.toFixed(3)}` : '—'),
        },
        {
          label: 'Gap (sidecar, m)',
          stroke: '#10B981',
          width: 1.2,
          dash: [4, 4],
          value: (_u, v) => (v != null ? `${v.toFixed(2)} m` : '—'),
        },
      ],
      hooks: {
        setCursor: [
          (u) => {
            if (isProgrammaticRef.current) return;
            if (u.cursor.idx != null && onScrub) {
              onScrub(u.cursor.idx);
            }
          },
        ],
      },
    };

    // Clean up prior chart instance
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const plot = new uPlot(opts, data, containerRef.current);
    chartRef.current = plot;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.setSize({
          width: containerRef.current.clientWidth || 900,
          height: 110,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [runLog, clearanceSidecar]);

  // Lock cursor to current frameIndex
  useEffect(() => {
    if (!chartRef.current || !runLog || !runLog.frames) return;
    if (frameIndex >= 0 && frameIndex < runLog.frames.length) {
      isProgrammaticRef.current = true;
      chartRef.current.setCursor({
        left: chartRef.current.valToPos(runLog.frames[frameIndex].t, 'x'),
        top: 0,
      });
      setTimeout(() => {
        isProgrammaticRef.current = false;
      }, 50);
    }
  }, [frameIndex, runLog]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        backgroundColor: '#0B0C0F',
        borderTop: '1px solid #1E2430',
        padding: '0.25rem 0.5rem',
        overflow: 'hidden',
      }}
    />
  );
};


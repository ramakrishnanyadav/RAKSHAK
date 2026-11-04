/**
 * TimelineScrubber - Shared Synchronized Replay Timeline
 * Supports play/pause, 0.5x / 1x / 2x speed, scrubbing, and frame step controls.
 */

import React from 'react';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';

interface TimelineScrubberProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onReset: () => void;
  onChangeSpeed: (speed: number) => void;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  currentTime,
  duration,
  isPlaying,
  playbackSpeed,
  onTogglePlay,
  onSeek,
  onReset,
  onChangeSpeed,
}) => {
  const safeDuration = duration > 0 ? duration : 1.0;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  return (
    <div
      style={{
        background: '#111318',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '0.875rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
      }}
    >
      {/* Slider Track */}
      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          aria-label="Simulation timeline scrubber"
          style={{
            width: '100%',
            appearance: 'none',
            background: `linear-gradient(to right, #2DD4BF ${progressPercent}%, rgba(255, 255, 255, 0.1) ${progressPercent}%)`,
            height: '6px',
            borderRadius: '3px',
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Control Actions & Time Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onTogglePlay}
            className="showcase-btn"
            aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
            style={{
              background: '#2DD4BF',
              color: '#090A0D',
              border: 'none',
              borderRadius: '6px',
              padding: '0.4rem 0.85rem',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
            }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={onReset}
            className="showcase-btn-ghost"
            aria-label="Restart timeline to 0s"
            style={{
              background: 'transparent',
              color: '#94A3B8',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '0.4rem 0.65rem',
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
          </button>

          {/* Speed Selector */}
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {[0.5, 1.0, 2.0].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangeSpeed(spd)}
                style={{
                  background: playbackSpeed === spd ? '#262A36' : 'transparent',
                  color: playbackSpeed === spd ? '#2DD4BF' : '#94A3B8',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          <span style={{ color: '#2DD4BF', fontWeight: 600 }}>{currentTime.toFixed(1)}s</span>
          <span style={{ color: '#64748B' }}>/</span>
          <span style={{ color: '#94A3B8' }}>{safeDuration.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
};

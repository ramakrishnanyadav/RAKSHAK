/**
 * Stage 4G.9: Premium Unified Header Bar.
 * Clean, compact, dark aesthetic with:
 * - Left: ADAPTIVE-PATH logo, SIH 2026 identifier, system status indicator
 * - Right: Simple Mode / Research Mode toggle, Fullscreen action, Help shortcut
 * 
 * Removed: Sign In, Language switcher, Theme switcher, Text scale stepper, and dead controls.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Sparkles,
  FlaskConical,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useSettings, PresentationMode } from '../context/SettingsContext';
import { useAnnouncer } from './LiveAnnouncer';

interface HeaderBarProps {
  onOpenKeyboardHelp: () => void;
  isBackendConnected: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onOpenKeyboardHelp,
  isBackendConnected,
}) => {
  const { presentationMode, setPresentationMode } = useSettings();
  const { announce } = useAnnouncer();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleSetMode = (mode: PresentationMode) => {
    setPresentationMode(mode);
    announce(
      mode === 'simple'
        ? 'Switched to Simple Mode: Streamlined autonomous driving view'
        : 'Switched to Research Mode: Full technical telemetry and model analysis enabled',
      'polite'
    );
  };

  return (
    <header
      role="banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        height: '54px',
        background: '#070a10',
        borderBottom: '1px solid rgba(56, 189, 248, 0.12)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.6)',
      }}
    >
      {/* Brand & System Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only"
          style={{
            position: 'absolute',
            top: '0.5rem',
            left: '0.5rem',
            background: '#38bdf8',
            color: '#07080a',
            padding: '0.5rem 1rem',
            zIndex: 9999,
            borderRadius: '6px',
            fontWeight: 700,
          }}
        >
          Skip to main content
        </a>

        <Link
          to="/app"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            textDecoration: 'none',
            color: 'inherit',
            cursor: 'pointer',
          }}
          title="Return to Studio Dashboard"
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 50%, #818cf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#07080a',
              fontWeight: 900,
              fontSize: '0.95rem',
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.35)',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            A
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontWeight: 900,
                  fontSize: '0.98rem',
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #38bdf8 60%, #818cf8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                ADAPTIVE-PATH
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: '#38bdf8',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  letterSpacing: '0.04em',
                }}
              >
                SIH 2026
              </span>
            </div>
            <div
              style={{
                fontSize: '0.68rem',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                marginTop: '1px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isBackendConnected ? '#10b981' : '#f59e0b',
                  boxShadow: isBackendConnected ? '0 0 6px #10b981' : '0 0 6px #f59e0b',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <span>{isBackendConnected ? 'Autonomy Engine Ready' : 'Offline Mode (Sample Runs)'}</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Right Toolbar: Presentation Mode, Fullscreen, Functional Help */}
      <div
        role="toolbar"
        aria-label="Application controls"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
        }}
      >
        {/* Simple Mode / Research Mode Segmented Control */}
        <div
          role="radiogroup"
          aria-label="Presentation level"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '8px',
            padding: '2px',
            gap: '2px',
          }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={presentationMode === 'simple'}
            onClick={() => handleSetMode('simple')}
            title="Simple Mode: Audience-friendly autonomous driving simulation and key vehicle results"
            aria-label="Simple Mode: Streamlined view"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.7rem',
              borderRadius: '6px',
              border: 'none',
              background: presentationMode === 'simple'
                ? 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)'
                : 'transparent',
              color: presentationMode === 'simple' ? '#07080a' : '#94a3b8',
              fontSize: '0.74rem',
              fontWeight: presentationMode === 'simple' ? 800 : 500,
              cursor: 'pointer',
              minHeight: '28px',
              transition: 'all 0.18s ease',
            }}
          >
            <Sparkles size={13} aria-hidden="true" />
            <span>Simple</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={presentationMode === 'research'}
            onClick={() => handleSetMode('research')}
            title="Research Mode: Technical telemetry, multi-planner benchmarks, signal analysis, and MATLAB validation"
            aria-label="Research Mode: Advanced technical engineering"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.7rem',
              borderRadius: '6px',
              border: 'none',
              background: presentationMode === 'research'
                ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)'
                : 'transparent',
              color: presentationMode === 'research' ? '#ffffff' : '#94a3b8',
              fontSize: '0.74rem',
              fontWeight: presentationMode === 'research' ? 800 : 500,
              cursor: 'pointer',
              minHeight: '28px',
              transition: 'all 0.18s ease',
            }}
          >
            <FlaskConical size={13} aria-hidden="true" />
            <span>Research</span>
          </button>
        </div>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* Keyboard Shortcuts / Functional Documentation Help */}
        <button
          onClick={onOpenKeyboardHelp}
          aria-label="Open keyboard shortcuts and quick guide (?)"
          title="Keyboard Shortcuts & Documentation (?)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <HelpCircle size={15} />
        </button>
      </div>
    </header>
  );
};

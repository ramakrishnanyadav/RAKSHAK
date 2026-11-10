/**
 * Studio Header Bar Component.
 * Contains accessibility controls, theme selector, language switcher,
 * text scaling, keyboard shortcut trigger, and user account status.
 * Responsive down to 320px viewport.
 */

import React from 'react';
import {
  Sun,
  Moon,
  Contrast,
  Type,
  HelpCircle,
  LogOut,
  User,
  Shield,
  Layers,
  Volume2,
  VolumeX,
  Sparkles,
  FlaskConical,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings, AppTheme, TextScale, PresentationMode } from '../context/SettingsContext';
import { useI18n, Language } from '../context/I18nContext';
import { useAnnouncer } from './LiveAnnouncer';

interface HeaderBarProps {
  onOpenKeyboardHelp: () => void;
  isBackendConnected: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onOpenKeyboardHelp,
  isBackendConnected,
}) => {
  const { user, isAuthenticated, isGuest, logout } = useAuth();
  const {
    theme,
    setTheme,
    textScale,
    setTextScale,
    audioAnnouncer,
    setAudioAnnouncer,
    presentationMode,
    setPresentationMode,
  } = useSettings();
  const { language, setLanguage, t } = useI18n();
  const { announce } = useAnnouncer();

  const handleSetMode = (mode: PresentationMode) => {
    setPresentationMode(mode);
    announce(
      mode === 'simple'
        ? 'Switched to Simple Mode: Streamlined plain-English view'
        : 'Switched to Research Mode: Full technical telemetry enabled',
      'polite'
    );
  };

  // Cycle themes: dark -> light -> high-contrast -> dark
  const handleCycleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('high-contrast');
    else setTheme('dark');
  };

  // Cycle text scale: 100 -> 125 -> 150 -> 175 -> 200 -> 100
  const handleCycleTextScale = () => {
    const scales: TextScale[] = [100, 125, 150, 175, 200];
    const currentIndex = scales.indexOf(textScale);
    const nextIndex = (currentIndex + 1) % scales.length;
    setTextScale(scales[nextIndex]);
  };

  return (
    <header
      role="banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        height: '56px',
        background: 'linear-gradient(90deg, #0b0f17 0%, #07080a 50%, #0b0f17 100%)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.14)',
        flexWrap: 'wrap',
        gap: '0.75rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Brand & Status */}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 50%, #818cf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#07080a',
              fontWeight: 900,
              fontSize: '1rem',
              boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)',
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
                  fontSize: '1rem',
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 60%, #34d399 100%)',
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
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  letterSpacing: '0.04em',
                }}
              >
                SIH2026
              </span>
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
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
              <span>{isBackendConnected ? 'Engine Online' : '14 Bundled Runs (Offline)'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accessibility & Preferences Toolbar */}
      <div
        role="toolbar"
        aria-label="Accessibility and display settings"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        {/* Mode Switcher Segmented Control */}
        <div
          role="radiogroup"
          aria-label="Presentation level"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(16, 22, 35, 0.6)',
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
            title="Simple Mode: Plain-English vehicle decisions and essentials for visitors and judges"
            aria-label="Simple Mode: Streamlined view for visitors and evaluators"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '6px',
              border: 'none',
              background: presentationMode === 'simple'
                ? 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)'
                : 'transparent',
              color: presentationMode === 'simple' ? '#07080a' : '#64748b',
              fontSize: '0.75rem',
              fontWeight: presentationMode === 'simple' ? 800 : 500,
              cursor: 'pointer',
              minHeight: 'var(--min-target-size)',
              transition: 'all 0.2s ease',
            }}
          >
            <Sparkles size={12} aria-hidden="true" />
            <span>{t('mode_simple')}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={presentationMode === 'research'}
            onClick={() => handleSetMode('research')}
            title="Research Mode: Full telemetry, 6 planners, conformal prediction cones, and validation provenance"
            aria-label="Research Mode: Advanced technical telemetry and evaluation"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '6px',
              border: 'none',
              background: presentationMode === 'research'
                ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)'
                : 'transparent',
              color: presentationMode === 'research' ? '#ffffff' : '#64748b',
              fontSize: '0.75rem',
              fontWeight: presentationMode === 'research' ? 800 : 500,
              cursor: 'pointer',
              minHeight: 'var(--min-target-size)',
              transition: 'all 0.2s ease',
            }}
          >
            <FlaskConical size={12} aria-hidden="true" />
            <span>{t('mode_research')}</span>
          </button>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'rgba(56, 189, 248, 0.15)' }} />

        {/* Language Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {(['en', 'hi', 'te'] as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              aria-pressed={language === lang}
              aria-label={`Switch language to ${lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Telugu'}`}
              style={{
                background: language === lang ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: language === lang ? '#38bdf8' : '#64748b',
                border: language === lang ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                borderRadius: '6px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.72rem',
                fontWeight: language === lang ? 700 : 500,
                cursor: 'pointer',
                minHeight: 'var(--min-target-size)',
                transition: 'all 0.15s ease',
              }}
            >
              {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिन्दी' : 'తె'}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '20px', background: 'rgba(56, 189, 248, 0.15)' }} />

        {/* Text Scale Stepper */}
        <button
          onClick={handleCycleTextScale}
          aria-label={`Cycle text size, current ${textScale}%`}
          title={`Text Scale: ${textScale}%`}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.25rem 0.55rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            minHeight: 'var(--min-target-size)',
          }}
        >
          <Type size={13} aria-hidden="true" />
          <span>{textScale}%</span>
        </button>

        {/* Theme Cycler */}
        <button
          onClick={handleCycleTheme}
          aria-label={`Cycle theme. Current theme is ${theme}`}
          title={`Theme: ${theme}`}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.25rem 0.55rem',
            fontSize: '0.72rem',
            minHeight: 'var(--min-target-size)',
          }}
        >
          {theme === 'dark' && <Moon size={13} aria-hidden="true" />}
          {theme === 'light' && <Sun size={13} aria-hidden="true" />}
          {theme === 'high-contrast' && <Contrast size={13} aria-hidden="true" />}
          <span style={{ textTransform: 'capitalize' }}>{theme}</span>
        </button>

        {/* Audio Speech Narration Toggle */}
        <button
          onClick={() => setAudioAnnouncer(!audioAnnouncer)}
          aria-pressed={audioAnnouncer}
          aria-label={`Toggle voice speech narration for replans. Currently ${audioAnnouncer ? 'enabled' : 'disabled'}`}
          title={`Voice Speech: ${audioAnnouncer ? 'On' : 'Off'} (M)`}
          className="btn-secondary"
          style={{
            padding: '0.25rem 0.45rem',
            minHeight: 'var(--min-target-size)',
            minWidth: 'var(--min-target-size)',
            color: audioAnnouncer ? '#14b8a6' : '#64748b',
          }}
        >
          {audioAnnouncer ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>

        {/* Keyboard Shortcut Modal */}
        <button
          onClick={onOpenKeyboardHelp}
          aria-label="Open keyboard shortcuts help dialog (?)"
          title="Keyboard Shortcuts (?)"
          className="btn-secondary"
          style={{
            padding: '0.25rem 0.45rem',
            minHeight: 'var(--min-target-size)',
            minWidth: 'var(--min-target-size)',
          }}
        >
          <HelpCircle size={15} />
        </button>

        <div style={{ width: '1px', height: '20px', background: 'rgba(56, 189, 248, 0.15)' }} />

        {/* User Account / Guest State */}
        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              {user?.role === 'admin' ? (
                <Shield size={13} color="#38bdf8" />
              ) : (
                <User size={13} />
              )}
              <span>{isGuest ? 'Guest' : user?.email.split('@')[0]}</span>
            </span>
            <button
              onClick={logout}
              aria-label="Sign out"
              title="Sign Out"
              className="btn-secondary"
              style={{
                padding: '0.25rem 0.45rem',
                minHeight: 'var(--min-target-size)',
              }}
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <a
            href="/login"
            className="btn-primary"
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.8rem',
              textDecoration: 'none',
              minHeight: 'var(--min-target-size)',
            }}
          >
            {t('login')}
          </a>
        )}
      </div>
    </header>
  );
};

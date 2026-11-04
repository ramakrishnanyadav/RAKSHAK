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
        padding: '0.65rem 1.25rem',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        flexWrap: 'wrap',
        gap: '0.75rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
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
            background: 'var(--accent-primary)',
            color: '#fff',
            padding: '0.5rem 1rem',
            zIndex: 9999,
            borderRadius: 'var(--radius-sm)',
          }}
        >
          Skip to main content
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #14b8a6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '1rem',
            }}
            aria-hidden="true"
          >
            A
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                }}
              >
                ADAPTIVE-PATH
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--accent-primary)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                SIH2026
              </span>
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: isBackendConnected ? 'var(--risk-low)' : 'var(--risk-medium)',
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
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
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
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: presentationMode === 'simple' ? 'var(--accent-primary)' : 'transparent',
              color: presentationMode === 'simple' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: presentationMode === 'simple' ? 700 : 500,
              cursor: 'pointer',
              minHeight: 'var(--min-target-size)',
            }}
          >
            <Sparkles size={13} aria-hidden="true" />
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
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: presentationMode === 'research' ? 'var(--accent-primary)' : 'transparent',
              color: presentationMode === 'research' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: presentationMode === 'research' ? 700 : 500,
              cursor: 'pointer',
              minHeight: 'var(--min-target-size)',
            }}
          >
            <FlaskConical size={13} aria-hidden="true" />
            <span>{t('mode_research')}</span>
          </button>
        </div>

        <div style={{ width: '1px', height: '18px', background: 'var(--border-default)' }} />

        {/* Language Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {(['en', 'hi', 'te'] as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              aria-pressed={language === lang}
              aria-label={`Switch language to ${lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Telugu'}`}
              style={{
                background: language === lang ? 'var(--bg-surface-elevated)' : 'transparent',
                color: language === lang ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: language === lang ? '1px solid var(--border-default)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: language === lang ? 700 : 500,
                cursor: 'pointer',
                minHeight: 'var(--min-target-size)',
              }}
            >
              {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिन्दी' : 'తెలుగు'}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '18px', background: 'var(--border-default)' }} />

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
            fontSize: '0.75rem',
            fontWeight: 700,
            minHeight: 'var(--min-target-size)',
          }}
        >
          <Type size={14} aria-hidden="true" />
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
            fontSize: '0.75rem',
            minHeight: 'var(--min-target-size)',
          }}
        >
          {theme === 'dark' && <Moon size={14} aria-hidden="true" />}
          {theme === 'light' && <Sun size={14} aria-hidden="true" />}
          {theme === 'high-contrast' && <Contrast size={14} aria-hidden="true" />}
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
            color: audioAnnouncer ? 'var(--accent-teal)' : 'var(--text-secondary)',
          }}
        >
          {audioAnnouncer ? <Volume2 size={16} /> : <VolumeX size={16} />}
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
          <HelpCircle size={16} />
        </button>

        <div style={{ width: '1px', height: '18px', background: 'var(--border-default)' }} />

        {/* User Account / Guest State */}
        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              {user?.role === 'admin' ? (
                <Shield size={14} color="var(--accent-primary)" />
              ) : (
                <User size={14} />
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
              <LogOut size={14} />
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

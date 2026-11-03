/**
 * Settings and Accessibility Context for ADAPTIVE-PATH Studio.
 * Enforces WCAG 2.2 AA / AAA requirements:
 * - Light, Dark, High-Contrast themes (AAA >= 7:1)
 * - Text scaling up to 200% without layout disruption
 * - Reduced motion preference sync
 * - Audio narration of telemetry and replan events
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'dark' | 'light' | 'high-contrast';
export type TextScale = 100 | 125 | 150 | 175 | 200;

interface SettingsState {
  theme: AppTheme;
  textScale: TextScale;
  reducedMotion: boolean;
  audioAnnouncer: boolean;
  defaultSpeed: number;
}

interface SettingsContextType extends SettingsState {
  setTheme: (theme: AppTheme) => void;
  setTextScale: (scale: TextScale) => void;
  setReducedMotion: (reduced: boolean) => void;
  setAudioAnnouncer: (enabled: boolean) => void;
  setDefaultSpeed: (speed: number) => void;
  resetDefaults: () => void;
}

const DEFAULT_SETTINGS: SettingsState = {
  theme: 'dark',
  textScale: 100,
  reducedMotion: false,
  audioAnnouncer: false,
  defaultSpeed: 1.0,
};

const SettingsContext = createContext<SettingsContextType>({
  ...DEFAULT_SETTINGS,
  setTheme: () => {},
  setTextScale: () => {},
  setReducedMotion: () => {},
  setAudioAnnouncer: () => {},
  setDefaultSpeed: () => {},
  resetDefaults: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const stored = localStorage.getItem('apath_settings');
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Use defaults
    }
    // Check system preference for reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return {
      ...DEFAULT_SETTINGS,
      reducedMotion: prefersReducedMotion,
    };
  });

  // Apply settings to DOM
  useEffect(() => {
    const { theme, textScale, reducedMotion } = settings;

    // Apply theme classes
    document.body.classList.remove('dark-theme', 'light-theme', 'high-contrast-theme');
    document.body.classList.add(`${theme}-theme`);

    // Apply text scale classes
    document.body.classList.remove(
      'text-scale-125',
      'text-scale-150',
      'text-scale-175',
      'text-scale-200'
    );
    if (textScale > 100) {
      document.body.classList.add(`text-scale-${textScale}`);
    }

    // Apply reduced motion class
    if (reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }

    try {
      localStorage.setItem('apath_settings', JSON.stringify(settings));
    } catch {
      // Storage unavailable
    }
  }, [settings]);

  const setTheme = (theme: AppTheme) => {
    setSettings((prev) => ({ ...prev, theme }));
  };

  const setTextScale = (textScale: TextScale) => {
    setSettings((prev) => ({ ...prev, textScale }));
  };

  const setReducedMotion = (reducedMotion: boolean) => {
    setSettings((prev) => ({ ...prev, reducedMotion }));
  };

  const setAudioAnnouncer = (audioAnnouncer: boolean) => {
    setSettings((prev) => ({ ...prev, audioAnnouncer }));
  };

  const setDefaultSpeed = (defaultSpeed: number) => {
    setSettings((prev) => ({ ...prev, defaultSpeed }));
  };

  const resetDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        setTheme,
        setTextScale,
        setReducedMotion,
        setAudioAnnouncer,
        setDefaultSpeed,
        resetDefaults,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

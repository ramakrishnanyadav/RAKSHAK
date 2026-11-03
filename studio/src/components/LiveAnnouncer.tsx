/**
 * Live Announcer Component and Hook.
 * Manages an aria-live="polite" and aria-live="assertive" region for screen readers.
 * Also hooks into Web Speech API for optional audible narration of critical telemetry events
 * (e.g. "Replanned at 12.4 s: cattle crossing, risk 0.82").
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';

interface AnnouncerContextType {
  announce: (message: string, priority?: 'polite' | 'assertive', speakAudio?: boolean) => void;
  lastAnnouncement: string;
}

const AnnouncerContext = createContext<AnnouncerContextType>({
  announce: () => {},
  lastAnnouncement: '',
});

export const AnnouncerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [politeMessage, setPoliteMessage] = useState<string>('');
  const [assertiveMessage, setAssertiveMessage] = useState<string>('');
  const [lastAnnouncement, setLastAnnouncement] = useState<string>('');
  const { audioAnnouncer } = useSettings();
  const lastSpokenRef = useRef<string>('');

  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite', speakAudio = false) => {
      if (!message || message === lastAnnouncement) return;
      setLastAnnouncement(message);

      if (priority === 'assertive') {
        setAssertiveMessage(message);
      } else {
        setPoliteMessage(message);
      }

      // Optional audible text-to-speech narration for blind researchers or hands-free operation
      if (
        (audioAnnouncer || speakAudio) &&
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        lastSpokenRef.current !== message
      ) {
        lastSpokenRef.current = message;
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.rate = 1.1;
          window.speechSynthesis.speak(utterance);
        } catch {
          // Speech synthesis unavailable or blocked
        }
      }
    },
    [audioAnnouncer, lastAnnouncement]
  );

  return (
    <AnnouncerContext.Provider value={{ announce, lastAnnouncement }}>
      {children}
      {/* Off-screen live regions for WCAG 2.2 AA Compliance */}
      <div
        id="a11y-announcer-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        id="a11y-announcer-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
};

export const useAnnouncer = (): AnnouncerContextType => useContext(AnnouncerContext);

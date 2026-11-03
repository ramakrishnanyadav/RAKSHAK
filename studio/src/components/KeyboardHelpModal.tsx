/**
 * Accessible Keyboard Shortcuts Modal.
 * Discloses all shortcuts for keyboard-only researchers and screen reader users.
 * Supports WCAG 2.2 AA Keyboard Operable guideline.
 */

import React, { useEffect, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keyCombo: string;
  action: string;
  context: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { keyCombo: 'Space', action: 'Toggle simulation playback (Play / Pause)', context: 'Replay Viewer' },
  { keyCombo: '← / →', action: 'Step backward / forward by 0.1s (1 frame)', context: 'Replay Viewer' },
  { keyCombo: 'Shift + ← / →', action: 'Jump backward / forward by 1.0s (10 frames)', context: 'Replay Viewer' },
  { keyCombo: 'Home', action: 'Reset timeline to start (0.0s)', context: 'Replay Viewer' },
  { keyCombo: '↑ / ↓', action: 'Cycle playback speed (0.25x ↔ 4.0x)', context: 'Replay Viewer' },
  { keyCombo: '1', action: 'Toggle Road & Driveable Boundaries layer', context: 'Canvas Layers' },
  { keyCombo: '2', action: 'Toggle Dynamic Agents / Tracks layer', context: 'Canvas Layers' },
  { keyCombo: '3', action: 'Toggle Conformal Prediction Cones layer', context: 'Canvas Layers' },
  { keyCombo: '4', action: 'Toggle Calibrated Risk Field layer', context: 'Canvas Layers' },
  { keyCombo: '5', action: 'Toggle Planned Ego Trajectory layer', context: 'Canvas Layers' },
  { keyCombo: 'T', action: 'Toggle between visual chart and accessible data table', context: 'Telemetry' },
  { keyCombo: 'M', action: 'Toggle audible speech narration for replans', context: 'Accessibility' },
  { keyCombo: '?', action: 'Open / close this keyboard shortcuts guide', context: 'Global' },
  { keyCombo: 'Esc', action: 'Close dialogs or clear selected agent', context: 'Global' },
  { keyCombo: 'Tab / Shift+Tab', action: 'Navigate interactive controls with visible focus ring', context: 'Global' },
];

export const KeyboardHelpModal: React.FC<KeyboardHelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement;
      // Focus close button on next tick
      setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        } else if (e.key === 'Tab') {
          // Trap focus inside modal (WCAG 2.4.3 Focus Order)
          if (!modalRef.current) return;
          const focusable = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        triggerElementRef.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-overlay)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '1.5rem',
          position: 'relative',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Keyboard size={22} color="var(--accent-primary)" />
            <h2 id="keyboard-shortcuts-title" style={{ margin: 0, fontSize: '1.25rem' }}>
              {t('keyboard_shortcuts')}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="btn-secondary"
            aria-label="Close keyboard shortcuts dialog"
            style={{
              padding: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 'var(--min-target-size)',
              minWidth: 'var(--min-target-size)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          ADAPTIVE-PATH Studio is fully operable without a mouse. Use the following documented
          keystrokes from any simulation screen:
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.85rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-default)', background: 'var(--bg-surface-elevated)' }}>
                <th scope="col" style={{ padding: '0.6rem 0.75rem', width: '28%' }}>
                  Key
                </th>
                <th scope="col" style={{ padding: '0.6rem 0.75rem' }}>
                  Action
                </th>
                <th scope="col" style={{ padding: '0.6rem 0.75rem', width: '25%' }}>
                  Context
                </th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map((item, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <td style={{ padding: '0.55rem 0.75rem' }}>
                    <kbd
                      style={{
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        display: 'inline-block',
                      }}
                    >
                      {item.keyCombo}
                    </kbd>
                  </td>
                  <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-primary)' }}>
                    {item.action}
                  </td>
                  <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-secondary)' }}>
                    {item.context}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ minHeight: 'var(--min-target-size)' }}
          >
            Got It (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsProvider, useSettings, usePresentationMode } from '../context/SettingsContext';
import { I18nProvider } from '../context/I18nContext';
import { HeaderBar } from '../components/HeaderBar';
import { AuthProvider } from '../context/AuthContext';
import { AnnouncerProvider } from '../components/LiveAnnouncer';

const TestModeConsumer: React.FC = () => {
  const { presentationMode, setPresentationMode, isSimple, isResearch } = usePresentationMode();
  return (
    <div>
      <span data-testid="mode-val">{presentationMode}</span>
      <span data-testid="is-simple">{isSimple ? 'true' : 'false'}</span>
      <span data-testid="is-research">{isResearch ? 'true' : 'false'}</span>
      <button onClick={() => setPresentationMode('research')}>Set Research</button>
      <button onClick={() => setPresentationMode('simple')}>Set Simple</button>
    </div>
  );
};

describe('Simple Mode and Research Mode Presentation Architecture', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
  });

  it('initializes with default simple mode and persists transitions', () => {
    render(
      <SettingsProvider>
        <TestModeConsumer />
      </SettingsProvider>
    );

    expect(screen.getByTestId('mode-val').textContent).toBe('simple');
    expect(screen.getByTestId('is-simple').textContent).toBe('true');
    expect(screen.getByTestId('is-research').textContent).toBe('false');
    expect(document.body.classList.contains('mode-simple')).toBe(true);

    // Switch to research
    fireEvent.click(screen.getByText('Set Research'));
    expect(screen.getByTestId('mode-val').textContent).toBe('research');
    expect(screen.getByTestId('is-simple').textContent).toBe('false');
    expect(screen.getByTestId('is-research').textContent).toBe('true');
    expect(document.body.classList.contains('mode-research')).toBe(true);
    expect(localStorage.getItem('apath_presentation_mode')).toBe('research');

    // Switch back to simple
    fireEvent.click(screen.getByText('Set Simple'));
    expect(screen.getByTestId('mode-val').textContent).toBe('simple');
    expect(screen.getByTestId('is-simple').textContent).toBe('true');
    expect(localStorage.getItem('apath_presentation_mode')).toBe('simple');
  });

  it('renders mode switch control in HeaderBar with accessible state', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <SettingsProvider>
            <I18nProvider>
              <AnnouncerProvider>
                <HeaderBar onOpenKeyboardHelp={() => {}} isBackendConnected={true} />
              </AnnouncerProvider>
            </I18nProvider>
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    const simpleBtn = screen.getByRole('radio', { name: /Simple Mode/i });
    const researchBtn = screen.getByRole('radio', { name: /Research Mode/i });

    expect(simpleBtn).not.toBeNull();
    expect(researchBtn).not.toBeNull();
    expect(simpleBtn.getAttribute('aria-checked')).toBe('true');
    expect(researchBtn.getAttribute('aria-checked')).toBe('false');

    // Click Research Mode
    fireEvent.click(researchBtn);
    expect(researchBtn.getAttribute('aria-checked')).toBe('true');
    expect(simpleBtn.getAttribute('aria-checked')).toBe('false');
  });
});

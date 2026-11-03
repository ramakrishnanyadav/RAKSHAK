/**
 * Component Tests for Internationalization (I18nContext).
 * Validates language switching across English, Hindi (हिन्दी), and Telugu (తెలుగు).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, useI18n } from '../context/I18nContext';

const TestConsumer: React.FC = () => {
  const { language, setLanguage, t } = useI18n();
  return (
    <div>
      <span data-testid="current-lang">{language}</span>
      <span data-testid="translated-title">{t('app_title')}</span>
      <span data-testid="translated-replan">{t('replan_count')}</span>
      <button onClick={() => setLanguage('hi')}>Switch to Hindi</button>
      <button onClick={() => setLanguage('te')}>Switch to Telugu</button>
      <button onClick={() => setLanguage('en')}>Switch to English</button>
    </div>
  );
};

describe('I18nContext', () => {
  it('translates strings into English by default', () => {
    render(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>
    );

    expect(screen.getByTestId('translated-title').textContent).toBe('ADAPTIVE-PATH Studio');
    expect(screen.getByTestId('translated-replan').textContent).toBe('Replans Triggered');
  });

  it('switches to Hindi and translates strings', () => {
    render(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>
    );

    fireEvent.click(screen.getByText('Switch to Hindi'));

    expect(screen.getByTestId('current-lang').textContent).toBe('hi');
    expect(screen.getByTestId('translated-title').textContent).toBe('अडैप्टिव-पाथ स्टूडियो');
    expect(screen.getByTestId('translated-replan').textContent).toBe('पुनर्निर्मित पथ');
  });

  it('switches to Telugu and translates strings', () => {
    render(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>
    );

    fireEvent.click(screen.getByText('Switch to Telugu'));

    expect(screen.getByTestId('current-lang').textContent).toBe('te');
    expect(screen.getByTestId('translated-title').textContent).toBe('అడాప్టివ్-పాత్ స్టూడియో');
    expect(screen.getByTestId('translated-replan').textContent).toBe('రీప్లాన్‌లు');
  });
});

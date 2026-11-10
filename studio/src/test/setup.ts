/**
 * Vitest Global Setup for ADAPTIVE-PATH Studio.
 * Mocks browser APIs (matchMedia, ResizeObserver, SpeechSynthesis, HTMLCanvasElement).
 */
import '@testing-library/jest-dom';

// Mock Path2D for jsdom / uPlot
if (typeof window !== 'undefined' && !window.Path2D) {
  class MockPath2D {
    moveTo() {}
    lineTo() {}
    closePath() {}
    bezierCurveTo() {}
    arc() {}
    quadraticCurveTo() {}
    rect() {}
  }
  (window as any).Path2D = MockPath2D;
  (globalThis as any).Path2D = MockPath2D;
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver;

// Mock SpeechSynthesis
const mockSpeechSynthesis = {
  speak: () => {},
  cancel: () => {},
  pause: () => {},
  resume: () => {},
  getVoices: () => [],
};
Object.defineProperty(window, 'speechSynthesis', {
  value: mockSpeechSynthesis,
  writable: true,
});

// Mock HTMLCanvasElement 2D context
HTMLCanvasElement.prototype.getContext = () => {
  return {
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: new Array(4) }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    clip: () => {},
    strokeRect: () => {},
    setLineDash: () => {},
    createRadialGradient: () => ({
      addColorStop: () => {},
    }),
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
  } as any;
};

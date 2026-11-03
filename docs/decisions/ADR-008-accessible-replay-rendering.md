# ADR-008: Accessible Replay Rendering Architecture (Canvas Layering & WCAG 2.2 AA)

- **Status**: Accepted
- **Date**: 2026-10-14
- **Deciders**: Principal Architect & Frontend Accessibility Lead

## Context
Rendering complex 2D autonomous driving simulations (world boundaries, multi-modal vehicle bounding boxes, multi-hypothesis future curves, conformal uncertainty cones, continuous risk fields, and dynamic path tentacles) at 60 fps is computationally demanding.
Simultaneously, the platform must achieve strict **WCAG 2.2 Level AA compliance**, presenting a significant challenge: an HTML5 `<canvas>` element is inherently a visual bitmap inaccessible to screen readers, keyboard-only users, and users with color vision deficiencies.

## Decision
We architect the replay engine with a dual **Visual Layering + Semantic DOM Shadow Tree**:

1. **Layered 2D Canvas Architecture**:
   - To maintain 60 fps without WebGL overhead or external heavy engines (e.g. Three.js), rendering is separated into distinct, toggleable passes:
     - `Pass 0: Static World Map` (cached in offscreen canvas: road bounds, potholes, stalls, barriers)
     - `Pass 1: Risk Field Heatmap / Contours` (superimposed potential field with opacity controls)
     - `Pass 2: Conformal Uncertainty Envelopes` (dashed bounds denoting 95% marginal coverage regions)
     - `Pass 3: Multi-Hypothesis Prediction Paths` (intent branches weighted by alpha transparency)
     - `Pass 4: Dynamic Agents` (oriented bounding boxes, heading arrows, class-specific symbols)
     - `Pass 5: Ego Autonomous Vehicle & Planned Polyline` (active behaviour state outline, waypoint beads)

2. **WCAG 2.2 AA Accessibility Accommodations**:
   - **Non-Color-Only Risk Cues**: Risk is never conveyed solely by red/green colors. High-risk and critical zones feature diagonal crosshatch/striped hazard patterns, explicit text badges (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and numerical values (`0.82`).
   - **Screen Reader Semantic Twin**:
     - The `<canvas>` is paired with a live region (`role="status" aria-live="polite"`).
     - Whenever a replan trigger fires, state transitions, or a near-miss occurs, a concise text narration is spoken: *"Replanned at 12.4s: cattle crossing detected in corridor, risk 0.82, switched to BYPASS"*.
   - **Full Keyboard Operability**:
     - `Space`: Play / Pause
     - `←` / `→`: Step backward / forward 0.1s
     - `Home` / `End`: Jump to start / end of simulation
     - `[` / `]`: Adjust playback speed (0.5x, 1x, 2x)
     - `L`: Cycle layer visibility
     - `?`: Accessible modal dialog listing all shortcuts
   - **High Contrast & Theme Modes**:
     - Standard Dark mode, Clean Light mode, and High-Contrast mode meeting WCAG AAA contrast ratios (>= 7:1 for text, >= 3:1 for graphical elements).
   - **Reduced Motion Support**:
     - Respects `prefers-reduced-motion` by disabling smooth camera panning interpolations and eliminating autoplay.

## Consequences
- The replay interface delivers steady 60 fps rendering on commodity laptops without dedicated GPUs.
- Assistive technology users can fully navigate, scrub, inspect, and understand complex autonomous driving simulation replays without vision or mouse input.

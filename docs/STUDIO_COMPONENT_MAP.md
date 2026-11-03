# ADAPTIVE-PATH Studio — Component Map & Reuse Assessment

**Date:** 2026-11-03  
**Auditor:** Senior React Engineer & Enterprise UX Architect  
**Branch:** `studio/ui-development`

This document maps all shared UI and domain components in `studio/src/components/`, assessing their reusability, required enhancements, and deprecation opportunities.

---

## 1. Component Inventory & Classification

| Component File | Role & Primary Responsibility | Accessibility (WCAG 2.2 AA) | Classification | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| **`ReplayCanvas.tsx`** | High-performance 2D HTML5 canvas simulation renderer. Draws road boundaries, vehicle chassis, obstacle tracks, conformal cones, risk potential fields, and planned trajectories. | Full keyboard pan/zoom support. Supports high-contrast color scheme. | **Reusable — Core** | **Enhance**: Add permanent on-canvas visual color legend (Blue Ego, Yellow Obstacles, Green Planned Path, Red Risk Buffer). Add speed vector arrows. |
| **`ReplayTimeline.tsx`** | Scrubber bar, playback controls (Play, Pause, Reset, Step $\pm 0.1\text{ s}$), playback speed selector ($0.25\times$ to $4.0\times$), and active time display. | Keyboard operable (Space = Play/Pause, Left/Right = Scrub). ARIA slider semantics. | **Reusable — Core** | **Enhance**: Add event markers along timeline (e.g., marker at $t=2.4\text{ s}$ showing "Braking initiated", marker at $t=5.1\text{ s}$ showing "Obstacle cleared"). |
| **`AccessibleTable.tsx`** | Accessible HTML table alternative for graphical charts and canvas visualizers. Includes `AccessibleRiskBadge`. | Meets WCAG 2.2 Level AA table guidelines with `caption`, `th scope`, and non-color text badges. | **Reusable — Core** | **Maintain & Reuse**: Standard table presentation across Dashboard, Compare, and Benchmark views. |
| **`DataTableToggle.tsx`** | Segmented control toggle allowing users to switch between visual graphical canvas/charts and accessible tabular representation. | Meets WCAG 2.2 Level AA requirements. Visual state announced via ARIA. | **Reusable — Core** | **Maintain & Reuse**: Standard accessibility toggle placed prominently above all data visualizations. |
| **`HeaderBar.tsx`** | Global application header. Hosts product title, theme selector (Light/Dark/High-Contrast), text scaling ($100\%$–$200\%$), language switcher (EN/HI/TE), and user profile status. | Touch targets $\ge 44\text{ px}$. Responsive down to $320\text{ px}$ mobile reflow. | **Reusable — Core** | **Enhance**: Clean up visual clutter. Replace raw "Backend Connected" indicator with friendly "Mode: Live Engine" / "Mode: Offline Demo". |
| **`NavigationRail.tsx`** | Side navigation bar with icon links to app workspaces. | Fully keyboard operable via Arrow and Tab navigation. Current active link announced. | **Requires Changes** | **Refactor**: Reorganize 9 sprawling links into the 4 primary workspaces: **Home**, **Simulate**, **Results**, and **Research**, with secondary Settings at bottom. |
| **`LiveAnnouncer.tsx`** | Screen-reader live region utility (`aria-live="polite"` / `"assertive"`). Announces route changes, playback states, and critical simulation events. | Fully compliant with WCAG 2.4.2, 2.4.3, 4.1.3. | **Reusable — Core** | **Maintain & Reuse**: Essential for blind and low-vision accessibility. |
| **`StatusState.tsx`** | Collection of skeleton loading cards, offline warning banners, empty states, and error boundary presentations. | Accessible SVG spinners with text equivalents and high-contrast borders. | **Reusable — Core** | **Enhance**: Improve offline helper message on simulation launch form. |
| **`KeyboardHelpModal.tsx`** | Modal dialog explaining global keyboard shortcuts (`?`, `Space`, `Left`, `Right`, `1`–`5` layer toggles). | Traps focus within dialog (`role="dialog"`). Closes on `Escape`. | **Reusable — Core** | **Maintain & Reuse**: Standardize across all workspaces. |

---

## 2. Context Providers & State Management

| Context | File | Responsibility | Quality Assessment |
| :--- | :--- | :--- | :--- |
| **`AuthContext.tsx`** | `studio/src/context/AuthContext.tsx` | Manages user session, JWT tokens, user profile, and instant guest login. | **Clean & Robust**: Instant guest mode works reliably for zero-friction evaluation. |
| **`I18nContext.tsx`** | `studio/src/context/I18nContext.tsx` | Provides multi-language translations (English, Hindi, Telugu). | **Clean & Robust**: Well-structured key-value dictionary. Needs plain-English copy overhaul for English keys. |
| **`SettingsContext.tsx`**| `studio/src/context/SettingsContext.tsx` | Manages active theme (`light`, `dark`, `high-contrast`), text scaling ($100\% \dots 200\%$), and audio announcements. | **Clean & Robust**: Interacts directly with CSS variables in `tokens.css`. |

---

## 3. Duplication & Deprecation Opportunities

1. **`studio/src/pages/Overview.tsx`**:
   - Redundant prototype file superseded by `Dashboard.tsx`.
   - *Recommendation*: Safely remove or deprecate to avoid routing confusion.
2. **Duplicated KPI Card Layouts**:
   - `Dashboard.tsx`, `Landing.tsx`, and `BenchmarkView.tsx` reimplement custom inline-flex metric cards with identical CSS tokens.
   - *Recommendation*: Create a reusable `<MetricCard title="..." value="..." subtitle="..." icon="..." />` component.
3. **Repeated Layer Toggle Pill Logic**:
   - `ReplayView.tsx` and `CompareView.tsx` duplicate canvas layer toggle buttons (`1: World`, `2: Tracks`, `3: Conformal`, `4: Risk`, `5: Path`).
   - *Recommendation*: Extract into a reusable `<LayerToggleBar layers={...} onToggle={...} />` component.

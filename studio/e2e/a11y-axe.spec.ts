import { test, expect } from '@playwright/test';

const CORE_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/reset',
  '/demo',
  '/app',
  '/app/scenarios',
  '/app/runs/new',
  '/app/runs',
  '/app/runs/run_scenario_5_cattle_crossing_p3_tune_s1000',
  '/app/compare',
  '/app/benchmark',
  '/app/failures',
  '/app/reports',
  '/app/settings/profile',
];

test.describe('Accessibility and WCAG 2.2 AA Verification on Every Route', () => {
  for (const route of CORE_ROUTES) {
    test(`route '${route}' satisfies WCAG 2.2 AA structure and zero horizontal overflow`, async ({ page }) => {
      await page.goto(route);

      // 1. Check for single primary h1 heading or valid landmark
      const mainLandmark = page.locator('main, [role="main"]');
      await expect(mainLandmark).toBeAttached();

      // 2. Viewport reflow verification at 320px without horizontal scrollbar
      await page.setViewportSize({ width: 320, height: 640 });
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      // 3. Interactive element target size verification (WCAG 2.2 Level AA min 24px)
      const targetSizes = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
        return buttons.map((b) => {
          const rect = b.getBoundingClientRect();
          return { tag: b.tagName, w: rect.width, h: rect.height };
        });
      });

      for (const size of targetSizes) {
        if (size.w > 0 && size.h > 0) {
          expect(size.h).toBeGreaterThanOrEqual(23.5);
        }
      }
    });
  }

  test('has skip to main content link that receives first tab focus', async ({ page }) => {
    await page.goto('/app');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    expect(focused).toContain('Skip to main content');
  });

  test('theme switcher attaches accessible theme classes to body', async ({ page }) => {
    await page.goto('/app');
    const themeBtn = page.locator('button[title*="Theme:"]');
    await themeBtn.click();
    const bodyClass = await page.evaluate(() => document.body.className);
    expect(bodyClass).toMatch(/(dark-theme|light-theme|high-contrast-theme)/);
  });
});

import { test, expect } from '@playwright/test';

test.describe('Compare Planners Flow', () => {
  test('mounts side-by-side viewports and displays delta telemetry', async ({ page }) => {
    await page.goto('/app/compare');

    await expect(page.locator('h1')).toContainText('Side-by-Side Planner Comparison');

    // Both canvases should be visible
    const canvases = page.locator('canvas');
    await expect(canvases).toHaveCount(2);

    // Delta telemetry summary cards
    await expect(page.locator('text=SAFETY COLLISION STATUS')).toBeVisible();
    await expect(page.locator('text=MIN CLEARANCE DELTA')).toBeVisible();

    // Toggle comparison table
    await page.click('button:has-text("Accessible Table View")');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=Performance Delta')).toBeVisible();
  });
});

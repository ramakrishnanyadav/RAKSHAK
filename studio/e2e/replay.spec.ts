import { test, expect } from '@playwright/test';

test.describe('Replay Viewer Flow', () => {
  test('synchronizes URL parameters on scrubbing and layer toggling', async ({ page }) => {
    await page.goto('/app/runs/run_scenario_5_cattle_crossing_p3_tune_s1000');

    // Wait for canvas to mount
    await expect(page.locator('canvas')).toBeVisible();

    // Toggle layer 3 (Conformal Cones)
    await page.click('text=3: Conformal Cones');

    // URL query string should reflect layers state
    expect(page.url()).toContain('layers=');

    // Toggle data table view
    await page.click('button:has-text("Accessible Table View")');
    await expect(page.locator('table')).toBeVisible();

    // Verify non-color risk badges present in table
    await expect(page.locator('.risk-badge')).toBeVisible();

    // Switch back to visual canvas
    await page.click('button:has-text("Visual Chart View")');
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('operates simulation via keyboard shortcuts', async ({ page }) => {
    await page.goto('/app/runs/run_scenario_5_cattle_crossing_p3_tune_s1000');

    // Press '?' to open keyboard shortcut modal
    await page.keyboard.press('?');
    await expect(page.locator('role=dialog')).toBeVisible();
    await expect(page.locator('text=Keyboard Shortcuts')).toBeVisible();

    // Press Escape to close modal
    await page.keyboard.press('Escape');
    await expect(page.locator('role=dialog')).not.toBeVisible();

    // Press Space to toggle play/pause
    await page.keyboard.press('Space');
    await expect(page.locator('text=Pause')).toBeVisible();
  });
});

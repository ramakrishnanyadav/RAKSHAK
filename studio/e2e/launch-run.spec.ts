import { test, expect } from '@playwright/test';

test.describe('Launch Run Console', () => {
  test('configures single simulation run and dispatches job', async ({ page }) => {
    await page.goto('/app/runs/new');

    await expect(page.locator('h1')).toContainText('Launch Simulation Run');

    // Select scenario and engine
    await page.selectOption('select#scenario-select', 'SCENARIO_5_CATTLE_CROSSING');
    await page.selectOption('select#planner-select', 'P3');

    // Submit form
    await page.click('button[type="submit"]');

    // Expect status message or redirect to run replay
    await expect(page.locator('role=status')).toBeVisible();
  });

  test('switches to batch ablation sweep mode', async ({ page }) => {
    await page.goto('/app/runs/new');

    // Select batch sweep
    await page.click('text=Batch Ablation Sweep');

    await expect(page.locator('text=START SEED')).toBeVisible();
    await expect(page.locator('text=END SEED')).toBeVisible();

    await page.click('button[type="submit"]');
    await expect(page.locator('role=status')).toContainText('Batch sweep');
  });
});

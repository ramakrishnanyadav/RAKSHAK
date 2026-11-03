import { test, expect } from '@playwright/test';

test.describe('Data and Report Export Flows', () => {
  test('exports simulation run telemetry as JSON document', async ({ page }) => {
    await page.goto('/app/runs/run_scenario_5_cattle_crossing_p3_tune_s1000');

    // Click Export Log button
    const exportBtn = page.locator('button:has-text("Export apath-log/v1")');
    if (await exportBtn.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportBtn.click(),
      ]);
      expect(download.suggestedFilename()).toContain('.json');
    } else {
      // Accessible download link check
      const downloadLink = page.locator('a[download*="log"]');
      await expect(downloadLink).toBeAttached();
    }
  });

  test('exports benchmark summary table and statistical report', async ({ page }) => {
    await page.goto('/app/reports');

    await expect(page.locator('h1')).toContainText('Research Validation Reports');

    // Verify Export Report button exists and is clickable
    const exportReportBtn = page.locator('button:has-text("Export Executive Summary")');
    await expect(exportReportBtn).toBeVisible();
    await exportReportBtn.click();

    // Verify export notification toast or status update
    await expect(page.locator('role=status')).toBeVisible();
  });
});

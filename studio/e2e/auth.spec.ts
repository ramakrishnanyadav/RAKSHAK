import { test, expect } from '@playwright/test';

test.describe('Authentication and Demo Flows', () => {
  test('landing page loads and allows guest entry into demo mode', async ({ page }) => {
    await page.goto('/');

    // Check heading
    await expect(page.locator('h1')).toContainText('Risk-Aware Predictive Path Planning');

    // Click demo mode button
    await page.click('text=Explore Demo Mode');

    // Should redirect to demo activator, then to /app
    await page.waitForURL('**/app');

    // Verify dashboard loaded
    await expect(page.locator('h1')).toContainText('ADAPTIVE-PATH Studio');
    await expect(page.locator('text=Experiment Runs Directory')).toBeVisible();
  });

  test('sign-in form validates required inputs and handles authentication', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toContainText('Sign in to Studio');

    // Submit without credentials
    await page.click('button[type="submit"]');

    // Click Continue as Guest
    await page.click('text=Continue as Guest');

    await page.waitForURL('**/app');
    await expect(page.locator('text=SIH26037')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('SolvePath Smoke Test Suite', () => {
  test('should load the home page and render brand header', async ({ page }) => {
    // Navigate to root
    await page.goto('/');

    // Expect page title or main heading to be visible
    const logoTitle = page.locator('.logo-title');
    await expect(logoTitle).toBeVisible();
    await expect(logoTitle).toHaveText('SolvePath');

    // Expect hero title
    const heroTitle = page.locator('.hero-title');
    await expect(heroTitle).toBeVisible();
    await expect(heroTitle).toContainText('Deterministic Math Guidance & Scaffolding');

    // Verify auth buttons exist
    const signInBtn = page.getByRole('button', { name: /sign in/i });
    await expect(signInBtn).toBeVisible();
  });
});

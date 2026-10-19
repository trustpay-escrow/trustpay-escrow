import { test, expect } from '@playwright/test';

test.describe('TrustPay Escrow End-to-End Navigation', () => {
  test('loads home page and renders wallet connect prompt', async ({ page }) => {
    await page.goto('/');

    // Check page title and primary brand heading
    await expect(page).toHaveTitle(/TrustPay/i);

    // Verify presence of Freighter wallet connection prompt
    const connectButton = page.getByRole('button', { name: /connect freighter/i });
    await expect(connectButton).toBeVisible();
  });

  test('navigates to projects discovery page', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/projects/);
  });
});

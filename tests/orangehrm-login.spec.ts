import 'dotenv/config';
import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://localhost';

if (!baseUrl) {

  throw new Error('BASE_URL environment variable is not defined');
}


test('OrangeHRM Login', async ({ page }) => {
  await page.goto(baseUrl);

  // Wait until username field is visible
  await page.locator('input[name="username"]').waitFor({
    state: 'visible',
    timeout: 30000,
  });

  await page.locator('input[name="username"]').fill('Admin');
  await page.locator('input[name="password"]').fill('admin123');

  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/dashboard/, {
    timeout: 30000,
  });

  await expect(page.getByRole('heading', { name: 'Dashboard' }))
    .toBeVisible();

  console.log('Login Successful');
});
import 'dotenv/config';
import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL;

// Check if the BASE_URL environment variable is defined
if (!baseUrl) {
  throw new Error('BASE_URL environment variable is not defined');
}

test('OrangeHRM Login', async ({ page }) => {

  // Open OrangeHRM application
  await page.goto(baseUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 100000,
  });

  // Allow the page to fully render on mobile devices
  await page.waitForTimeout(5000);

  // Capture login page screenshot
  await page.screenshot({
    path: 'test-results/login-page.png',
    fullPage: true,
  });

  // Locators
  const username = page.locator('input[name="username"]');
  const password = page.locator('input[name="password"]');
  const loginButton = page.locator('button[type="submit"]');

  // Wait for username field
  await username.waitFor({
    state: 'visible',
    timeout: 100000,
  });

  // Enter username
  await username.fill('Admin');

  // Enter password
  await password.fill('admin123');

  // Wait for login button
  await loginButton.waitFor({
    state: 'visible',
    timeout: 100000,
  });

  // Close mobile keyboard if it is open
  await page.keyboard.press('Escape');

  // Scroll login button into view
  await loginButton.scrollIntoViewIfNeeded();

  // Small wait for mobile UI to stabilize
  await page.waitForTimeout(1000);

  // Click login button
  // force:true helps when mobile overlays intercept the click
  await loginButton.click({
    force: true,
  });

  // Verify successful login
  await expect(page).toHaveURL(/dashboard/, {
    timeout: 100000,
  });
});
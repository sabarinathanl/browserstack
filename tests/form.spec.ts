import 'dotenv/config';
import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL;
if (!baseUrl) {
  throw new Error('BASE_URL environment variable is required');
}

test.setTimeout(60000);

test.describe('Automation Testing Practice form', () => {
  test('fills and submits the data entry form', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Automation Testing Practice/);

    await page.fill('#name', 'Sabari');
    await page.fill('#email', 'sabari@example.com');
    await page.fill('#phone', '9876543210');

    await page.check('#male');
    await page.check('#monday');
    await page.check('#friday');

    await page.selectOption('#country', 'india');
    await page.selectOption('#colors', ['red', 'blue']);

    await page.click('button.submit-btn');
    await expect(page.locator('#name')).toHaveValue('Sabari');
  });
});

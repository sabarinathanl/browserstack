import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 150000,

  use: {
    headless: true,
    screenshot: 'on',
    video: 'on',
  },
});
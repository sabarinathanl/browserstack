import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',

  use: {
    headless: true,
    screenshot: 'on',
    video: 'on',
  },
});
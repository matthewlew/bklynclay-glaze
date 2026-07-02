// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /pwa-preview\.spec\.js/ },
    {
      name: 'preview',
      testMatch: /pwa-preview\.spec\.js/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      // dev mode (5173) never registers a service worker — SW/cache/update
      // behavior can only be exercised against the real production build.
      command: 'npm run build && npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});

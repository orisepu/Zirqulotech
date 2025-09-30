import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for responsive testing
 * Tests the frontend across multiple viewports to ensure proper display
 *
 * Viewports tested:
 * - Mobile: iPhone SE (375x667)
 * - Tablet: iPad (768x1024)
 * - Desktop: Full HD (1920x1080)
 * - Large Desktop: QHD (2560x1440)
 * - Retina Desktop: MacBook Pro 16" (2880x1620)
 * - 4K: Ultra HD (3840x2160)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 375, height: 667 }
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad'],
        viewport: { width: 768, height: 1024 }
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'large-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2560, height: 1440 }
      },
    },
    {
      name: 'retina-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2880, height: 1620 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: '4k',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 3840, height: 2160 },
        deviceScaleFactor: 1.5,
      },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
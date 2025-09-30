import { test, expect } from '@playwright/test';

/**
 * Responsive E2E tests for critical pages
 *
 * These tests verify that pages render correctly across different viewport sizes
 * and that key UI elements are visible and properly laid out.
 *
 * Run with: pnpm test:responsive
 */

// Test utilities
const waitForPageLoad = async (page: any) => {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('body', { state: 'visible' });
};

const takeResponsiveScreenshot = async (page: any, name: string) => {
  const viewport = page.viewportSize();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  await page.screenshot({
    path: `e2e/screenshots/${name}-${viewport.width}x${viewport.height}-${timestamp}.png`,
    fullPage: true
  });
};

// Authentication helper (adjust based on your auth flow)
const login = async (page: any) => {
  // Skip if already logged in
  const isLoggedIn = await page.locator('[data-testid="user-menu"], [data-testid="dashboard"]').count() > 0;
  if (isLoggedIn) return;

  // Navigate to login page
  await page.goto('/login');
  await waitForPageLoad(page);

  // Fill credentials (use test credentials or env variables)
  const usernameInput = page.locator('input[name="username"], input[type="email"]').first();
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();

  if (await usernameInput.count() > 0) {
    await usernameInput.fill(process.env.PLAYWRIGHT_TEST_USERNAME || 'test@example.com');
    await passwordInput.fill(process.env.PLAYWRIGHT_TEST_PASSWORD || 'testpassword');

    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    await page.waitForURL(/dashboard|home/, { timeout: 10000 }).catch(() => {});
  }
};

test.describe('Responsive Layout Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Create screenshots directory
    await page.context().addInitScript(() => {
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(process.cwd(), 'e2e', 'screenshots');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }).catch(() => {});
  });

  test('Login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await waitForPageLoad(page);

    // Check that login form is visible
    await expect(page.locator('input[type="email"], input[name="username"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();

    // Check layout doesn't overflow
    const bodyOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });
    expect(bodyOverflow).toBe(false);
  });

  test('Dashboard renders without layout issues', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for main content
    await page.waitForSelector('body', { state: 'visible' });

    // Check no horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify key elements are present
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 768) {
      // Desktop/tablet: sidebar should be visible
      const hasSidebar = await page.locator('[role="navigation"], nav, aside').count() > 0;
      expect(hasSidebar).toBeTruthy();
    }
  });

  test('Opportunities table is responsive', async ({ page }) => {
    await page.goto('/oportunidades');
    await waitForPageLoad(page);

    // Wait for table or list to load
    await page.waitForSelector('table, [role="table"], [data-testid="opportunities-list"]', {
      timeout: 10000
    }).catch(() => {});

    // Check for overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow).toBe(false);

    // On mobile, table should be scrollable or converted to cards
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      const tableContainer = page.locator('table, [role="table"]').first();
      if (await tableContainer.count() > 0) {
        const isScrollable = await tableContainer.evaluate((el) => {
          const parent = el.parentElement;
          return parent ? parent.scrollWidth > parent.clientWidth : false;
        });
        // Either scrollable or using card layout
        const hasCards = await page.locator('[data-testid="opportunity-card"]').count() > 0;
        expect(isScrollable || hasCards).toBeTruthy();
      }
    }
  });

  test('Forms are usable on all viewports', async ({ page }) => {
    // Test client creation form
    await page.goto('/clientes/crear');
    await waitForPageLoad(page);

    // Check form inputs are visible and clickable
    const inputs = page.locator('input, select, textarea').all();
    const visibleInputs = await Promise.all(
      (await inputs).map(async (input) => await input.isVisible())
    );

    expect(visibleInputs.some(v => v)).toBe(true);

    // Check no overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('Navigation is accessible on all viewports', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    const viewport = page.viewportSize();

    if (viewport && viewport.width < 768) {
      // Mobile: check for hamburger menu
      const menuButton = page.locator('[aria-label*="menu"], [data-testid="menu-button"], button[aria-expanded]').first();
      const menuButtonExists = await menuButton.count() > 0;
      expect(menuButtonExists).toBeTruthy();
    } else {
      // Desktop/tablet: navigation should be visible
      const nav = page.locator('nav, [role="navigation"]').first();
      await expect(nav).toBeVisible();
    }
  });

  test('Device valuation form adapts to viewport', async ({ page }) => {
    await page.goto('/dispositivos/valorar');
    await waitForPageLoad(page);

    // Check for form elements
    const hasForm = await page.locator('form, [role="form"]').count() > 0;

    if (hasForm) {
      // Verify no horizontal scroll
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasOverflow).toBe(false);

      // Check that buttons are accessible
      const buttons = page.locator('button').all();
      const visibleButtons = await Promise.all(
        (await buttons).map(async (btn) => await btn.isVisible())
      );
      expect(visibleButtons.some(v => v)).toBe(true);
    }
  });

  test('Charts and dashboards render correctly', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    // Wait for charts to potentially load
    await page.waitForTimeout(2000);

    // Check for chart containers
    const chartContainers = page.locator('[class*="recharts"], [class*="chart"], svg').all();
    const chartsCount = (await chartContainers).length;

    if (chartsCount > 0) {
      // Verify charts don't cause overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasOverflow).toBe(false);
    }
  });

  test('Modals and dialogs are responsive', async ({ page }) => {
    await page.goto('/oportunidades');
    await waitForPageLoad(page);

    // Try to open a modal (adjust selector based on your UI)
    const createButton = page.locator('button').filter({ hasText: /crear|nuevo|new/i }).first();

    if (await createButton.count() > 0) {
      await createButton.click();

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"], .MuiDialog-root').first();
      await modal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      if (await modal.isVisible()) {
        // Check modal fits viewport
        const modalBox = await modal.boundingBox();
        const viewport = page.viewportSize();

        if (modalBox && viewport) {
          expect(modalBox.width).toBeLessThanOrEqual(viewport.width);
          expect(modalBox.height).toBeLessThanOrEqual(viewport.height);
        }
      }
    }
  });
});

test.describe('Visual Regression Tests', () => {
  test('Capture homepage across viewports @screenshot', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
    await takeResponsiveScreenshot(page, 'homepage');
  });

  test('Capture opportunities page across viewports @screenshot', async ({ page }) => {
    await page.goto('/oportunidades');
    await waitForPageLoad(page);
    await takeResponsiveScreenshot(page, 'opportunities');
  });

  test('Capture dashboard across viewports @screenshot', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000); // Wait for charts
    await takeResponsiveScreenshot(page, 'dashboard');
  });

  test('Capture clients page across viewports @screenshot', async ({ page }) => {
    await page.goto('/clientes');
    await waitForPageLoad(page);
    await takeResponsiveScreenshot(page, 'clients');
  });

  test('Capture profile page across viewports @screenshot', async ({ page }) => {
    await page.goto('/perfil');
    await waitForPageLoad(page);
    await takeResponsiveScreenshot(page, 'profile');
  });
});
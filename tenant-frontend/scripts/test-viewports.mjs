#!/usr/bin/env node
/**
 * Quick viewport testing script using Puppeteer
 *
 * Opens the development server in multiple viewport sizes side-by-side
 * Useful for rapid manual testing during development
 *
 * Usage:
 *   pnpm dev:viewports [url]
 *   pnpm dev:viewports /dashboard
 *   pnpm dev:viewports http://localhost:3000/oportunidades
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Viewport configurations
const VIEWPORTS = {
  mobile: { width: 375, height: 667, name: 'Mobile (iPhone SE)' },
  tablet: { width: 768, height: 1024, name: 'Tablet (iPad)' },
  desktop: { width: 1920, height: 1080, name: 'Desktop (Full HD)' },
  largeDesktop: { width: 2560, height: 1440, name: 'Large Desktop (QHD)' },
  retinaDesktop: { width: 2880, height: 1620, name: 'Retina (MacBook Pro 16")' },
  fourK: { width: 3840, height: 2160, name: '4K (Ultra HD)' },
};

// Get URL from args or use default
const args = process.argv.slice(2);
const urlPath = args[0] || '/';
const baseURL = urlPath.startsWith('http')
  ? urlPath
  : `http://localhost:3000${urlPath.startsWith('/') ? urlPath : '/' + urlPath}`;

console.log('🚀 Starting viewport testing...');
console.log(`📍 Testing URL: ${baseURL}\n`);

async function testViewport(viewport, index) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      `--window-size=${viewport.width},${viewport.height + 100}`, // +100 for browser chrome
      `--window-position=${index * 400},${index * 50}`, // Cascade windows
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
  });

  console.log(`✅ Opening ${viewport.name} (${viewport.width}x${viewport.height})`);

  try {
    await page.goto(baseURL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Inject viewport info overlay
    await page.evaluate((viewportInfo) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 12px;
        z-index: 999999;
        pointer-events: none;
      `;
      overlay.textContent = `${viewportInfo.name} - ${viewportInfo.width}x${viewportInfo.height}`;
      document.body.appendChild(overlay);
    }, viewport);

    // Check for overflow
    const hasOverflow = await page.evaluate(() => {
      const html = document.documentElement;
      return {
        horizontal: html.scrollWidth > html.clientWidth,
        vertical: html.scrollHeight > html.clientHeight,
        scrollWidth: html.scrollWidth,
        clientWidth: html.clientWidth,
      };
    });

    if (hasOverflow.horizontal) {
      console.warn(`⚠️  ${viewport.name}: Horizontal overflow detected! (${hasOverflow.scrollWidth}px > ${hasOverflow.clientWidth}px)`);
    }

  } catch (error) {
    console.error(`❌ Error loading ${viewport.name}:`, error.message);
  }

  return { browser, page };
}

async function captureScreenshots(instances) {
  const screenshotDir = join(__dirname, '..', 'e2e', 'screenshots', 'manual');

  console.log('\n📸 Capturing screenshots...');

  for (const { page, viewport } of instances) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `${viewport.name.toLowerCase().replace(/\s+/g, '-')}-${viewport.width}x${viewport.height}-${timestamp}.png`;
      const filepath = join(screenshotDir, filename);

      await page.screenshot({ path: filepath, fullPage: true });
      console.log(`  ✓ ${viewport.name}: ${filename}`);
    } catch (error) {
      console.error(`  ✗ ${viewport.name}:`, error.message);
    }
  }
}

async function main() {
  const instances = [];

  // Launch all viewports
  let index = 0;
  for (const viewport of Object.values(VIEWPORTS)) {
    const instance = await testViewport(viewport, index++);
    instances.push({ ...instance, viewport });
  }

  console.log('\n✨ All viewports opened!');
  console.log('📝 Commands:');
  console.log('  - Press Ctrl+C to close all browsers and exit');
  console.log('  - Manually close all browser windows to continue\n');

  // Wait for user input
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', async (key) => {
    // Ctrl+C
    if (key[0] === 3) {
      console.log('\n\n🛑 Closing all browsers...');
      for (const { browser } of instances) {
        await browser.close();
      }
      process.exit(0);
    }
    // 's' key for screenshots
    if (key.toString() === 's') {
      await captureScreenshots(instances);
    }
  });

  // Wait for all browsers to close
  await Promise.all(instances.map(({ browser }) =>
    browser.waitForTarget(() => false).catch(() => {})
  ));

  console.log('\n✅ All browsers closed. Exiting...');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
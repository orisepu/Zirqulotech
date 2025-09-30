#!/usr/bin/env node
/**
 * Screenshot capture script using Playwright
 * Works perfectly in SSH without GUI - ideal for remote development
 *
 * Usage:
 *   pnpm dev:screenshots [url]
 *   pnpm dev:screenshots /dashboard
 *   pnpm dev:screenshots http://localhost:3000/oportunidades
 */

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Viewport configurations matching playwright.config.ts
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667, label: 'Mobile (iPhone SE)' },
  { name: 'tablet', width: 768, height: 1024, label: 'Tablet (iPad)' },
  { name: 'desktop', width: 1920, height: 1080, label: 'Desktop (Full HD)' },
  { name: 'large-desktop', width: 2560, height: 1440, label: 'Large Desktop (QHD)' },
  { name: 'retina-desktop', width: 2880, height: 1620, label: 'Retina (MacBook Pro 16")' },
  { name: '4k', width: 3840, height: 2160, label: '4K (Ultra HD)' },
];

// Get URL from args or use default
const args = process.argv.slice(2);
const urlPath = args[0] || '/';
const baseURL = urlPath.startsWith('http')
  ? urlPath
  : `http://localhost:3000${urlPath.startsWith('/') ? urlPath : '/' + urlPath}`;

// Create output directory
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const outputDir = join(__dirname, '..', 'e2e', 'screenshots', 'manual', timestamp);

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

console.log('📸 Starting screenshot capture...');
console.log(`🌐 URL: ${baseURL}`);
console.log(`📁 Output: ${outputDir}\n`);

async function captureViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.name === 'retina-desktop' ? 2 : viewport.name === '4k' ? 1.5 : 1,
  });

  const page = await context.newPage();

  try {
    console.log(`📱 ${viewport.label} (${viewport.width}x${viewport.height})...`);

    // Navigate to page
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit for charts/animations
    await page.waitForTimeout(1000);

    // Check for horizontal overflow
    const overflowInfo = await page.evaluate(() => {
      const html = document.documentElement;
      const hasOverflow = html.scrollWidth > html.clientWidth;
      return {
        hasOverflow,
        scrollWidth: html.scrollWidth,
        clientWidth: html.clientWidth,
        overflowAmount: html.scrollWidth - html.clientWidth,
      };
    });

    // Get page title for filename
    const pageTitle = await page.title();
    const sanitizedTitle = pageTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    // Capture screenshot
    const filename = `${viewport.name}-${viewport.width}x${viewport.height}${sanitizedTitle ? '-' + sanitizedTitle : ''}.png`;
    const filepath = join(outputDir, filename);

    await page.screenshot({
      path: filepath,
      fullPage: true,
    });

    if (overflowInfo.hasOverflow) {
      console.log(`   ⚠️  Overflow detected: ${overflowInfo.overflowAmount}px (${overflowInfo.scrollWidth}px > ${overflowInfo.clientWidth}px)`);
    } else {
      console.log(`   ✅ No overflow`);
    }

    await context.close();

    return {
      viewport,
      filename,
      filepath,
      overflowInfo,
      pageTitle,
      success: true,
    };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    await context.close();

    return {
      viewport,
      error: error.message,
      success: false,
    };
  }
}

async function generateReport(results) {
  const successResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Responsive Screenshots - ${new Date().toLocaleString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f1419;
      color: #e6edf3;
      padding: 20px;
    }
    .header {
      background: #161b22;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      border: 1px solid #30363d;
    }
    h1 { font-size: 32px; margin-bottom: 10px; color: #58a6ff; }
    .meta { color: #8b949e; font-size: 14px; }
    .meta strong { color: #e6edf3; }
    .stats {
      display: flex;
      gap: 20px;
      margin: 20px 0;
      flex-wrap: wrap;
    }
    .stat {
      background: #0d1117;
      padding: 15px 20px;
      border-radius: 8px;
      border: 1px solid #30363d;
    }
    .stat-value {
      font-size: 28px;
      font-weight: bold;
      color: #58a6ff;
    }
    .stat-label {
      font-size: 12px;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 5px;
    }
    .warning { color: #f85149; }
    .success { color: #3fb950; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .card {
      background: #161b22;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #30363d;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .card.overflow {
      border-color: #f85149;
    }

    .card-header {
      padding: 20px;
      background: #0d1117;
      border-bottom: 1px solid #30363d;
    }
    .viewport-name {
      font-size: 18px;
      font-weight: 600;
      color: #e6edf3;
      margin-bottom: 8px;
    }
    .viewport-size {
      font-size: 14px;
      color: #8b949e;
      font-family: 'SF Mono', Monaco, monospace;
    }
    .overflow-badge {
      display: inline-block;
      background: #f851491a;
      color: #f85149;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
      border: 1px solid #f8514933;
    }
    .success-badge {
      display: inline-block;
      background: #3fb9501a;
      color: #3fb950;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
      border: 1px solid #3fb95033;
    }

    .screenshot {
      width: 100%;
      display: block;
      cursor: pointer;
      background: #0d1117;
    }

    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal.active { display: flex; }
    .modal img {
      max-width: 95%;
      max-height: 95%;
      border-radius: 8px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
    }
    .modal-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: #161b22;
      border: 1px solid #30363d;
      color: #e6edf3;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
    }
    .modal-close:hover { background: #21262d; }

    .error-card {
      background: #f851491a;
      border: 1px solid #f8514933;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .error-card h3 { color: #f85149; margin-bottom: 10px; }

    @media (max-width: 768px) {
      .grid { grid-template-columns: 1fr; }
      .stats { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📸 Responsive Screenshots</h1>
    <div class="meta">
      <strong>URL:</strong> ${baseURL}<br>
      <strong>Captured:</strong> ${new Date().toLocaleString()}<br>
      <strong>Output:</strong> ${outputDir}
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${successResults.length}</div>
        <div class="stat-label">Captured</div>
      </div>
      <div class="stat">
        <div class="stat-value">${VIEWPORTS.length}</div>
        <div class="stat-label">Viewports</div>
      </div>
      <div class="stat">
        <div class="stat-value ${successResults.filter(r => r.overflowInfo.hasOverflow).length > 0 ? 'warning' : 'success'}">
          ${successResults.filter(r => r.overflowInfo.hasOverflow).length}
        </div>
        <div class="stat-label">Overflow Issues</div>
      </div>
      ${failedResults.length > 0 ? `
      <div class="stat">
        <div class="stat-value warning">${failedResults.length}</div>
        <div class="stat-label">Failed</div>
      </div>
      ` : ''}
    </div>
  </div>

  ${failedResults.length > 0 ? `
  <div class="error-card">
    <h3>❌ Failed Captures</h3>
    ${failedResults.map(r => `
      <p><strong>${r.viewport.label}:</strong> ${r.error}</p>
    `).join('')}
  </div>
  ` : ''}

  <div class="grid">
    ${successResults.map(result => `
      <div class="card ${result.overflowInfo.hasOverflow ? 'overflow' : ''}">
        <div class="card-header">
          <div class="viewport-name">${result.viewport.label}</div>
          <div class="viewport-size">${result.viewport.width}x${result.viewport.height}</div>
          ${result.overflowInfo.hasOverflow
            ? `<div class="overflow-badge">⚠️ Overflow: +${result.overflowInfo.overflowAmount}px</div>`
            : `<div class="success-badge">✅ No Overflow</div>`
          }
        </div>
        <img
          src="${result.filename}"
          alt="${result.viewport.label}"
          class="screenshot"
          onclick="openModal('${result.filename}')"
        />
      </div>
    `).join('')}
  </div>

  <div class="modal" id="modal" onclick="closeModal()">
    <button class="modal-close" onclick="closeModal()">✕ Close</button>
    <img id="modal-img" src="" alt="Full size screenshot" />
  </div>

  <script>
    function openModal(src) {
      document.getElementById('modal').classList.add('active');
      document.getElementById('modal-img').src = src;
      event.stopPropagation();
    }
    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>
`;

  const reportPath = join(outputDir, 'index.html');
  writeFileSync(reportPath, html);
  console.log(`\n📄 Report generated: ${reportPath}`);
  console.log(`🌐 Open in browser: file://${reportPath}\n`);
}

async function main() {
  const browser = await chromium.launch({
    headless: true, // Works in SSH without GUI
  });

  const results = [];

  for (const viewport of VIEWPORTS) {
    const result = await captureViewport(browser, viewport);
    results.push(result);
  }

  await browser.close();

  // Generate HTML report
  await generateReport(results);

  // Summary
  const successful = results.filter(r => r.success).length;
  const withOverflow = results.filter(r => r.success && r.overflowInfo.hasOverflow).length;

  console.log('✅ Capture complete!');
  console.log(`📊 Summary: ${successful}/${VIEWPORTS.length} successful`);
  if (withOverflow > 0) {
    console.log(`⚠️  ${withOverflow} viewport(s) with overflow detected`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
#!/usr/bin/env node
/**
 * Generate HTML gallery from existing screenshots
 * Useful for creating reports from Playwright test screenshots
 *
 * Usage:
 *   pnpm test:responsive:gallery
 *   node scripts/generate-gallery.mjs [screenshots-dir]
 */

import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get screenshots directory from args or use default
const args = process.argv.slice(2);
const screenshotsDir = args[0] || join(__dirname, '..', 'e2e', 'screenshots');

if (!existsSync(screenshotsDir)) {
  console.error(`❌ Screenshots directory not found: ${screenshotsDir}`);
  console.log('💡 Run tests first: pnpm test:responsive');
  process.exit(1);
}

console.log('📸 Generating gallery from screenshots...');
console.log(`📁 Source: ${screenshotsDir}\n`);

// Parse screenshot filename to extract metadata
function parseScreenshotFilename(filename) {
  // Expected format: page-name-WIDTHxHEIGHT-timestamp.png
  // Example: dashboard-1920x1080-2025-01-15T10-30-00.png
  const match = filename.match(/^(.+?)-(\d+)x(\d+)-(.+)\.png$/);

  if (!match) {
    // Fallback for simple filenames
    return {
      page: filename.replace('.png', ''),
      width: null,
      height: null,
      timestamp: null,
      filename,
    };
  }

  return {
    page: match[1],
    width: parseInt(match[2]),
    height: parseInt(match[3]),
    timestamp: match[4],
    filename,
  };
}

// Group screenshots by page
function groupScreenshots(files) {
  const groups = {};

  files.forEach(file => {
    if (!file.endsWith('.png')) return;

    const metadata = parseScreenshotFilename(file);
    const { page } = metadata;

    if (!groups[page]) {
      groups[page] = [];
    }

    groups[page].push(metadata);
  });

  // Sort by width within each group
  Object.keys(groups).forEach(page => {
    groups[page].sort((a, b) => {
      if (a.width && b.width) return a.width - b.width;
      return a.filename.localeCompare(b.filename);
    });
  });

  return groups;
}

// Read all screenshots
const files = readdirSync(screenshotsDir).filter(file => {
  const fullPath = join(screenshotsDir, file);
  return statSync(fullPath).isFile();
});

if (files.length === 0) {
  console.error('❌ No screenshots found');
  console.log('💡 Run tests first: pnpm test:responsive');
  process.exit(1);
}

const groups = groupScreenshots(files);
const pageCount = Object.keys(groups).length;
const screenshotCount = files.filter(f => f.endsWith('.png')).length;

console.log(`📊 Found ${screenshotCount} screenshots across ${pageCount} pages\n`);

// Get viewport label from dimensions
function getViewportLabel(width, height) {
  const viewports = [
    { width: 375, height: 667, label: 'Mobile (iPhone SE)' },
    { width: 768, height: 1024, label: 'Tablet (iPad)' },
    { width: 1920, height: 1080, label: 'Desktop (Full HD)' },
    { width: 2560, height: 1440, label: 'Large Desktop (QHD)' },
    { width: 2880, height: 1620, label: 'Retina (MacBook Pro 16")' },
    { width: 3840, height: 2160, label: '4K (Ultra HD)' },
  ];

  const match = viewports.find(v => v.width === width && v.height === height);
  return match ? match.label : `${width}x${height}`;
}

// Generate HTML
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Responsive Screenshots Gallery</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      min-height: 100vh;
    }

    .container {
      max-width: 1600px;
      margin: 0 auto;
    }

    .header {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      margin-bottom: 40px;
      text-align: center;
    }
    h1 {
      font-size: 48px;
      color: #667eea;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #6b7280;
      font-size: 18px;
    }
    .stats {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin-top: 30px;
      flex-wrap: wrap;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 36px;
      font-weight: bold;
      color: #667eea;
    }
    .stat-label {
      font-size: 14px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 5px;
    }

    .page-section {
      background: white;
      border-radius: 20px;
      padding: 40px;
      margin-bottom: 40px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .page-title {
      font-size: 32px;
      color: #1f2937;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #667eea;
      text-transform: capitalize;
    }

    .screenshots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 30px;
    }

    .screenshot-card {
      background: #f9fafb;
      border-radius: 16px;
      overflow: hidden;
      border: 2px solid #e5e7eb;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    .screenshot-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 20px 40px rgba(102, 126, 234, 0.3);
      border-color: #667eea;
    }

    .screenshot-header {
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .viewport-label {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 5px;
    }
    .viewport-size {
      font-size: 14px;
      opacity: 0.9;
      font-family: 'SF Mono', Monaco, monospace;
    }

    .screenshot-image {
      width: 100%;
      display: block;
      background: white;
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
    .modal-content {
      max-width: 95vw;
      max-height: 95vh;
      position: relative;
    }
    .modal img {
      max-width: 100%;
      max-height: 95vh;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
    }
    .modal-close {
      position: absolute;
      top: -50px;
      right: 0;
      background: white;
      border: none;
      color: #667eea;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .modal-close:hover {
      background: #667eea;
      color: white;
      transform: scale(1.05);
    }

    .filter-bar {
      background: white;
      padding: 20px;
      border-radius: 16px;
      margin-bottom: 40px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .filter-btn {
      padding: 10px 20px;
      border: 2px solid #e5e7eb;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      color: #6b7280;
      transition: all 0.2s;
    }
    .filter-btn:hover {
      border-color: #667eea;
      color: #667eea;
    }
    .filter-btn.active {
      background: #667eea;
      border-color: #667eea;
      color: white;
    }

    @media (max-width: 768px) {
      .screenshots-grid {
        grid-template-columns: 1fr;
      }
      h1 { font-size: 32px; }
      .page-title { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📸 Responsive Screenshots Gallery</h1>
      <p class="subtitle">Generated ${new Date().toLocaleString()}</p>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${pageCount}</div>
          <div class="stat-label">Pages</div>
        </div>
        <div class="stat">
          <div class="stat-value">${screenshotCount}</div>
          <div class="stat-label">Screenshots</div>
        </div>
      </div>
    </div>

    <div class="filter-bar">
      <button class="filter-btn active" onclick="filterByViewport('all')">All Viewports</button>
      <button class="filter-btn" onclick="filterByViewport('mobile')">Mobile</button>
      <button class="filter-btn" onclick="filterByViewport('tablet')">Tablet</button>
      <button class="filter-btn" onclick="filterByViewport('desktop')">Desktop</button>
      <button class="filter-btn" onclick="filterByViewport('4k')">4K/Retina</button>
    </div>

    ${Object.entries(groups).map(([page, screenshots]) => `
      <div class="page-section">
        <h2 class="page-title">${page.replace(/-/g, ' ')}</h2>
        <div class="screenshots-grid">
          ${screenshots.map(screenshot => {
            const label = screenshot.width
              ? getViewportLabel(screenshot.width, screenshot.height)
              : screenshot.page;
            const sizeText = screenshot.width ? `${screenshot.width}x${screenshot.height}` : '';
            const viewportClass = screenshot.width <= 768 ? 'mobile' : screenshot.width <= 1920 ? 'desktop' : '4k';

            return `
              <div class="screenshot-card" data-viewport="${viewportClass}" onclick="openModal('${screenshot.filename}', '${label}', '${sizeText}')">
                <div class="screenshot-header">
                  <div class="viewport-label">${label}</div>
                  ${sizeText ? `<div class="viewport-size">${sizeText}</div>` : ''}
                </div>
                <img
                  src="${screenshot.filename}"
                  alt="${label}"
                  class="screenshot-image"
                  loading="lazy"
                />
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('')}
  </div>

  <div class="modal" id="modal" onclick="closeModal()">
    <div class="modal-content" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="closeModal()">✕ Close (ESC)</button>
      <img id="modal-img" src="" alt="Full size screenshot" />
    </div>
  </div>

  <script>
    let currentFilter = 'all';

    function openModal(src, label, size) {
      document.getElementById('modal').classList.add('active');
      const img = document.getElementById('modal-img');
      img.src = src;
      img.alt = label + ' - ' + size;
    }

    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }

    function filterByViewport(viewport) {
      currentFilter = viewport;

      // Update button states
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      event.target.classList.add('active');

      // Filter cards
      document.querySelectorAll('.screenshot-card').forEach(card => {
        if (viewport === 'all' || card.dataset.viewport === viewport) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>
`;

// Write gallery HTML
const outputPath = join(screenshotsDir, 'gallery.html');
writeFileSync(outputPath, html);

console.log('✅ Gallery generated successfully!');
console.log(`📄 Output: ${outputPath}`);
console.log(`🌐 Open in browser: file://${outputPath}\n`);

// Print summary
console.log('📊 Summary by page:');
Object.entries(groups).forEach(([page, screenshots]) => {
  console.log(`  ${page}: ${screenshots.length} screenshots`);
});

process.exit(0);
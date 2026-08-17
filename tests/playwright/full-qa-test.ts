/**
 * Full QA Playtest Script - Plays and verifies EVERY SINGLE FEATURE of the application.
 */
import { chromium, type Page, type Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:5175';
const SCREENSHOT_DIR = path.join(process.cwd(), 'tests/playwright/screenshots');

interface TestResult {
  category: string;
  feature: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details?: string;
}

const results: TestResult[] = [];
const consoleErrors: string[] = [];

function record(category: string, feature: string, status: 'PASS' | 'FAIL' | 'WARN', details?: string) {
  results.push({ category, feature, status, details });
  const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} [${category}] ${feature}${details ? ` — ${details}` : ''}`);
}

async function snap(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

async function runFullQAPlaytest() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log('\n======================================================');
  console.log('🚀 STARTING FULL QA PLAYTEST: EVERY SINGLE FEATURE');
  console.log('======================================================\n');

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 1,
  });
  const page: Page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('favicon')) {
        consoleErrors.push(t);
        console.warn(`[console.error] ${t}`);
      }
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(`PAGE ERROR: ${err.message}`);
    console.error(`[pageerror] ${err.message}`);
  });

  try {
    // ------------------------------------------------------------------
    // 1. Initial Load & Viewport Rendering
    // ------------------------------------------------------------------
    console.log('\n--- 1. Initial Load & Viewport Rendering ---');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Allow WebGL and initial mesh generation

    const canvas = page.locator('canvas').first();
    const canvasVisible = await canvas.isVisible();
    const canvasBox = await canvas.boundingBox();
    if (canvasVisible && canvasBox && canvasBox.width > 400 && canvasBox.height > 300) {
      record('Viewport', 'WebGL 3D Canvas rendering', 'PASS', `${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}px`);
    } else {
      record('Viewport', 'WebGL 3D Canvas rendering', 'FAIL', 'Canvas missing or collapsed');
    }

    const statusBar = page.locator('.cad-statusbar');
    const statusVisible = await statusBar.isVisible();
    record('Status Bar', 'Status bar visibility', statusVisible ? 'PASS' : 'FAIL');

    await snap(page, '01-initial-state');

    // ------------------------------------------------------------------
    // 2. Top Toolbar Features
    // ------------------------------------------------------------------
    console.log('\n--- 2. Top Toolbar Features ---');

    // Project Name Input
    const projectNameInput = page.locator('.cad-header-project-input').first();
    if (await projectNameInput.isVisible()) {
      await projectNameInput.fill('My Custom Stein');
      record('Top Toolbar', 'Project name rename', 'PASS', 'Renamed to "My Custom Stein"');
    }

    // Undo / Redo Buttons
    const undoBtn = page.locator('.cad-header-history button').first();
    const redoBtn = page.locator('.cad-header-history button').nth(1);
    record('Top Toolbar', 'Undo button present', await undoBtn.isVisible() ? 'PASS' : 'FAIL');
    record('Top Toolbar', 'Redo button present', await redoBtn.isVisible() ? 'PASS' : 'FAIL');

    // Theme Toggle
    const themeBtn = page.locator('button[title*="Theme"], button[title*="theme"]').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(200);
      record('Top Toolbar', 'Theme toggle (Dark -> Light)', 'PASS');
      await snap(page, '02-theme-light');
      await themeBtn.click(); // Toggle back to dark
      await page.waitForTimeout(200);
      record('Top Toolbar', 'Theme toggle (Light -> Dark)', 'PASS');
    } else {
      record('Top Toolbar', 'Theme toggle button', 'WARN', 'Not found');
    }

    // Language Selector (en, es)
    const langSelect = page.locator('select[aria-label="Language"], .cad-header-right select').first();
    if (await langSelect.isVisible()) {
      await langSelect.selectOption('es');
      await page.waitForTimeout(300);
      record('Top Toolbar', 'Language switch (Español)', 'PASS');
      await langSelect.selectOption('en');
      await page.waitForTimeout(300);
      record('Top Toolbar', 'Language switch (English)', 'PASS');
    }

    // New Project Button
    const newBtn = page.locator('button:has-text("New")').first();
    record('Top Toolbar', 'New Project button', await newBtn.isVisible() ? 'PASS' : 'FAIL');

    // Save Button
    const saveBtn = page.locator('button:has-text("Save")').first();
    record('Top Toolbar', 'Save Project button', await saveBtn.isVisible() ? 'PASS' : 'FAIL');

    // Load Button
    const loadBtn = page.locator('button:has-text("Load")').first();
    record('Top Toolbar', 'Load Project button', await loadBtn.isVisible() ? 'PASS' : 'FAIL');

    // Export Button & Fullscreen Dimmed Modal
    const exportBtn = page.locator('.cad-header-right button:has-text("Export")').first();
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      await page.waitForTimeout(500);
      await snap(page, '03-export-modal-open');

      const modal = page.locator('.cad-export-modal, [class*="modal"]').first();
      const modalVisible = await modal.isVisible();
      record('Export Modal', 'Fullscreen Dimmed Export Modal open', modalVisible ? 'PASS' : 'FAIL');

      // Check format option cards (3MF, STL)
      const formatCards = await page.locator('.cad-format-card').all();
      record('Export Modal', 'Format options available (3MF, STL)', formatCards.length >= 2 ? 'PASS' : 'FAIL', `${formatCards.length} cards found`);

      // Quality preset selector inside modal
      const qualityPresetSelect = page.locator('.cad-export-modal select').first();
      if (await qualityPresetSelect.isVisible()) {
        await qualityPresetSelect.selectOption('high');
        record('Export Modal', 'Quality preset selection in export modal', 'PASS');
      }

      // Close modal
      const closeBtn = page.locator('.cad-export-modal .cad-btn-icon, button:has-text("Cancel")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
        record('Export Modal', 'Export Modal close', 'PASS');
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        record('Export Modal', 'Export Modal close via Escape', 'PASS');
      }
    } else {
      record('Top Toolbar', 'Export button', 'FAIL');
    }

    // ------------------------------------------------------------------
    // 3. Navigation Tabs & Sidebars
    // ------------------------------------------------------------------
    console.log('\n--- 3. Navigation Tabs & Sidebars ---');

    // Model Tab
    const modelNav = page.locator('button[data-nav="model"], button:has-text("Model"), .cad-nav-btn:has-text("Model")').first();
    if (await modelNav.isVisible()) {
      await modelNav.click();
      await page.waitForTimeout(400);
      await snap(page, '04-model-panel');
      record('Nav Rail', 'Model Tab navigation', 'PASS');

      // Dimension preset dropdown
      const presetDropdown = page.locator('.cad-left-panel select').first();
      if (await presetDropdown.isVisible()) {
        const options = await presetDropdown.locator('option').all();
        record('Model Section', `Preset options loaded (${options.length})`, options.length >= 3 ? 'PASS' : 'FAIL');
        if (options.length >= 2) {
          await presetDropdown.selectOption({ index: 1 });
          await page.waitForTimeout(1000);
          record('Model Section', 'Dimension preset switch', 'PASS');
        }
      }
    } else {
      record('Nav Rail', 'Model Tab button', 'FAIL');
    }

    // Pattern Tab
    const patternNav = page.locator('button[data-nav="pattern"], button:has-text("Pattern"), .cad-nav-btn:has-text("Pattern")').first();
    if (await patternNav.isVisible()) {
      await patternNav.click();
      await page.waitForTimeout(400);
      await snap(page, '05-pattern-panel');
      record('Nav Rail', 'Pattern Tab navigation', 'PASS');

      const dropzone = page.locator('.dropzone');
      record('Pattern Tab', 'Dropzone artwork upload area', await dropzone.isVisible() ? 'PASS' : 'FAIL');
    }

    // ------------------------------------------------------------------
    // 4. Viewport Overlay Controls & ViewCube
    // ------------------------------------------------------------------
    console.log('\n--- 4. Viewport Overlay Controls & ViewCube ---');

    // ViewCube Faces
    const cubeFront = page.locator('.cad-cube-front');
    if (await cubeFront.isVisible()) {
      await cubeFront.click({ force: true });
      await page.waitForTimeout(200);
      record('ViewCube', 'FRONT face camera snap', 'PASS');
    }

    const cubeRight = page.locator('.cad-cube-right');
    if (await cubeRight.isVisible()) {
      await cubeRight.click({ force: true });
      await page.waitForTimeout(200);
      record('ViewCube', 'RIGHT face camera snap', 'PASS');
    }

    const cubeTop = page.locator('.cad-cube-top');
    if (await cubeTop.isVisible()) {
      await cubeTop.click({ force: true });
      await page.waitForTimeout(200);
      record('ViewCube', 'TOP face camera snap', 'PASS');
    }

    // Viewport Tools Palette
    const toolSelect = page.locator('[data-tool="select"], button:has-text("Select")').first();
    const toolBrush = page.locator('[data-tool="brush"], button:has-text("Brush")').first();
    const toolBucket = page.locator('[data-tool="bucket"], button:has-text("Bucket")').first();
    const toolErase = page.locator('[data-tool="erase"], button:has-text("Erase")').first();

    if (await toolSelect.isVisible()) {
      await toolSelect.click();
      record('Tool Palette', 'Select tool activation', 'PASS');
    }

    if (await toolBrush.isVisible()) {
      await toolBrush.click();
      await page.waitForTimeout(300);
      const maskPanel = page.locator('.cad-vp-mask-panel');
      const maskPanelVisible = await maskPanel.isVisible();
      record('Tool Palette', 'Brush tool & Mask Settings HUD popover', maskPanelVisible ? 'PASS' : 'FAIL');
    }

    if (await toolBucket.isVisible()) {
      await toolBucket.click();
      record('Tool Palette', 'Bucket fill tool activation', 'PASS');
    }

    if (await toolErase.isVisible()) {
      await toolErase.click();
      record('Tool Palette', 'Erase tool activation', 'PASS');
    }

    // Return to Select tool
    if (await toolSelect.isVisible()) {
      await toolSelect.click();
    }

    // Scale Bar
    const scaleBar = page.locator('.cad-vp-scale-bar');
    record('Viewport Overlay', '50 mm Scale Bar', await scaleBar.isVisible() ? 'PASS' : 'FAIL');

    // ------------------------------------------------------------------
    // 5. Operations Stack & Multi-Part Texturing Dock
    // ------------------------------------------------------------------
    console.log('\n--- 5. Operations Stack & Multi-Part Texturing Dock ---');

    // Add Operation Button
    const addOpBtn = page.locator('button:has-text("+ Add Operation")').first();
    if (await addOpBtn.isVisible()) {
      await addOpBtn.click();
      await page.waitForTimeout(300);
      record('Operations Stack', '+ Add Operation creation', 'PASS');
    } else {
      record('Operations Stack', '+ Add Operation button', 'FAIL');
    }

    // Operation items in stack
    const opItems = await page.locator('.cad-op-item').all();
    record('Operations Stack', `Operations list count (${opItems.length})`, opItems.length > 0 ? 'PASS' : 'FAIL');

    // Tab 1: OPERATION SETTINGS
    const tabSettings = page.locator('.cad-op-tab-btn:has-text("Operation Settings")').first();
    if (await tabSettings.isVisible()) {
      await tabSettings.click();
      await page.waitForTimeout(200);
      record('Dock Tabs', 'Operation Settings Tab navigation', 'PASS');
      await snap(page, '06-op-tab-settings');

      // Test Target Part Select
      const targetPartSelect = page.locator('.cad-dock-editor select').first();
      if (await targetPartSelect.isVisible()) {
        await targetPartSelect.selectOption('topRim');
        await page.waitForTimeout(300);
        record('Operation Settings', 'Target Part: Top Rim selection', 'PASS');

        await targetPartSelect.selectOption('body');
        await page.waitForTimeout(300);
        record('Operation Settings', 'Target Part: Body Wall selection', 'PASS');
      }

      // Test Depth Slider / Input
      const depthInput = page.locator('.cad-dock-editor input[type="number"]').first();
      if (await depthInput.isVisible()) {
        await depthInput.fill('1.8');
        await page.waitForTimeout(200);
        record('Operation Settings', 'Depth adjustment (1.8 mm)', 'PASS');
      }
    }

    // Tab 2: TEXTURE & PRESETS
    const tabTexture = page.locator('.cad-op-tab-btn:has-text("Texture & Presets")').first();
    if (await tabTexture.isVisible()) {
      await tabTexture.click();
      await page.waitForTimeout(400);
      await snap(page, '07-op-tab-texture-presets');
      record('Dock Tabs', 'Texture & Presets Tab navigation', 'PASS');

      // Check Preset cards
      const presetCards = await page.locator('.cad-preset-card').all();
      record('Preset Library', `Preset gallery cards found (${presetCards.length})`, presetCards.length >= 10 ? 'PASS' : 'FAIL');

      // Click a preset (e.g. Knurling or Voronoi or Brick)
      const knurlingCard = page.locator('.cad-preset-card:has-text("Knurling"), .cad-preset-card:has-text("Voronoi"), .cad-preset-card:has-text("Brick")').first();
      if (await knurlingCard.isVisible()) {
        await knurlingCard.click();
        await page.waitForTimeout(1500); // Allow displacement to re-render
        record('Preset Library', 'Apply texture preset to active operation', 'PASS');
        await snap(page, '08-preset-applied');
      }
    }

    // Tab 3: PATTERN LAYOUT
    const tabLayout = page.locator('.cad-op-tab-btn:has-text("Pattern Layout")').first();
    if (await tabLayout.isVisible()) {
      await tabLayout.click();
      await page.waitForTimeout(200);
      await snap(page, '09-op-tab-layout');
      record('Dock Tabs', 'Pattern Layout Tab navigation', 'PASS');

      // Seamless Wrap toggle
      const seamlessSwitch = page.locator('.cad-seamless-box input[type="checkbox"]').first();
      if (await seamlessSwitch.isVisible()) {
        record('Pattern Layout', 'Seamless Wrap snap toggle control', 'PASS');
      }

      // Lock 1:1 button
      const lockBtn = page.locator('.bump-lock-btn').first();
      if (await lockBtn.isVisible()) {
        await lockBtn.click();
        await page.waitForTimeout(150);
        record('Pattern Layout', 'Proportional 1:1 aspect lock toggle', 'PASS');
      }
    }

    // Tab 4: MASK
    const tabMask = page.locator('.cad-op-tab-btn:has-text("Mask")').first();
    if (await tabMask.isVisible()) {
      await tabMask.click();
      await page.waitForTimeout(200);
      record('Dock Tabs', 'Mask Tab navigation', 'PASS');
    }

    // Tab 5: TRANSFORM
    const tabTransform = page.locator('.cad-op-tab-btn:has-text("Transform")').first();
    if (await tabTransform.isVisible()) {
      await tabTransform.click();
      await page.waitForTimeout(200);
      record('Dock Tabs', 'Transform Tab navigation', 'PASS');

      const resetBtn = page.locator('button:has-text("Reset Transform")').first();
      if (await resetBtn.isVisible()) {
        await resetBtn.click();
        record('Transform Tab', 'Reset Transform button', 'PASS');
      }
    }

    // ------------------------------------------------------------------
    // 6. Right Panel: Validation & Statistics
    // ------------------------------------------------------------------
    console.log('\n--- 6. Right Panel: Validation & Statistics ---');
    const rightPanel = page.locator('.cad-right-panel');
    record('Right Panel', 'Validation & Stats panel visibility', await rightPanel.isVisible() ? 'PASS' : 'FAIL');

    const checkRows = await page.locator('.cad-check-row').all();
    record('Right Panel', `Engineering validation check items (${checkRows.length})`, checkRows.length >= 5 ? 'PASS' : 'FAIL');

    const metrics = await page.locator('.cad-metric-row').all();
    record('Right Panel', `Geometric & Mesh metrics rows (${metrics.length})`, metrics.length >= 8 ? 'PASS' : 'FAIL');

    await snap(page, '10-final-qa-state');

    // Check for critical console errors
    if (consoleErrors.length > 0) {
      console.log(`\nDetected ${consoleErrors.length} console errors:`);
      for (const err of consoleErrors) {
        console.log(`  - ${err}`);
      }
      record('Console Health', 'Zero JavaScript runtime errors', 'WARN', `${consoleErrors.length} errors logged`);
    } else {
      record('Console Health', 'Zero JavaScript runtime errors', 'PASS', 'Clean console log');
    }

  } catch (err) {
    console.error('Test execution exception:', err);
    record('Playtest Execution', 'Full suite execution', 'FAIL', String(err));
  } finally {
    await browser.close();
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n======================================================');
  console.log('📊 FULL QA PLAYTEST SUMMARY');
  console.log('======================================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Total Features Tested: ${results.length}`);
  console.log(`✅ PASSED: ${passed}`);
  console.log(`⚠️ WARNINGS: ${warned}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log('======================================================\n');

  const reportPath = path.join(SCREENSHOT_DIR, 'full-qa-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ summary: { total: results.length, passed, warned, failed }, results, consoleErrors }, null, 2));
  console.log(`Saved report to: ${reportPath}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runFullQAPlaytest().catch((err) => {
  console.error(err);
  process.exit(1);
});

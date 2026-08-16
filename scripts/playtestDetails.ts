import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'playtest-screenshots');
if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

async function runPlaytest() {
  console.log('🚀 Launching Playwright Chromium for Detailed Pattern Playtest...');
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1600, height: 1050 },
  });

  console.log('🌐 Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/');

  // Dismiss help overlay if present
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // If still present, click any dismiss button or modal backdrop
  const gotItBtn = page.locator('button:has-text("Got it"), button:has-text("Entendido"), .modal-backdrop button');
  if (await gotItBtn.count() > 0) {
    await gotItBtn.first().click().catch(() => {});
  }

  // 1. Initial baseline screenshot
  await page.screenshot({ path: join(OUT_DIR, '01_initial_state.png') });
  console.log('📸 01_initial_state.png');

  // 2. Select intricate built-in patterns
  console.log('🧪 Testing intricate pattern (Sci-Fi Panel)...');
  const sciFiBtn = page.locator('button.example:has-text("Sci-Fi")').first();
  if (await sciFiBtn.count() > 0) {
    await sciFiBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: join(OUT_DIR, '02_scifi_pattern_loaded.png') });
  console.log('📸 02_scifi_pattern_loaded.png');

  // 3. Test Quality Presets on intricate pattern
  const qualities = ['Standard', 'High', 'Ultra'];
  for (const q of qualities) {
    console.log(`🔍 Testing Quality Preset: ${q}...`);
    const qBtn = page.locator(`.segmented button:has-text("${q}"), label:has-text("${q}")`).first();
    if (await qBtn.count() > 0) {
      await qBtn.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: join(OUT_DIR, `03_quality_${q.toLowerCase()}.png`) });
    console.log(`📸 03_quality_${q.toLowerCase()}.png`);
  }

  // 4. Test Viewport Camera Angles & Close-ups
  console.log('🔎 Testing Camera Angles and Zoom Views...');
  const viewBtns = ['Front', 'Isometric', 'Top'];
  for (const v of viewBtns) {
    const btn = page.locator(`button:has-text("${v}")`).first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT_DIR, `04_camera_${v.toLowerCase()}.png`) });
      console.log(`📸 04_camera_${v.toLowerCase()}.png`);
    }
  }

  // 5. Test Shading & Inspection modes: Normals, Depth heatmap, Wireframe
  console.log('🎨 Testing Inspection Modes...');
  const modes = ['Normals', 'Depth heatmap', 'Wireframe', 'Solid'];
  for (const m of modes) {
    const btn = page.locator(`.segmented button:has-text("${m}"), button:has-text("${m}")`).first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT_DIR, `05_mode_${m.toLowerCase().replace(/\s+/g, '_')}.png`) });
      console.log(`📸 05_mode_${m.toLowerCase().replace(/\s+/g, '_')}.png`);
    }
  }

  // 6. Test Fine Diamond Knurl Pattern (ultra-high micro geometry)
  console.log('🧪 Testing micro-geometry pattern (Diamond Knurl)...');
  const knurlBtn = page.locator('button.example:has-text("Diamond")').first();
  if (await knurlBtn.count() > 0) {
    await knurlBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT_DIR, '06_diamond_knurl_ultra.png') });
    console.log('📸 06_diamond_knurl_ultra.png');
  }

  // 7. Extract real-time stats from the UI
  const statsText = await page.locator('.sidebar-right, .stats').allInnerTexts().catch(() => []);
  console.log('\n📊 Extracted Benchmark Metrics:\n', statsText.join('\n---\n'));

  await browser.close();
  console.log('\n🎉 Playtest completed successfully! All screenshots saved in:', OUT_DIR);
}

runPlaytest().catch((err) => {
  console.error('Playtest failed:', err);
  process.exit(1);
});

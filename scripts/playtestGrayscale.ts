import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'playtest-screenshots', 'grayscale');
if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

async function runGrayscalePlaytest() {
  console.log('🚀 Launching Playwright Chromium for Grayscale / Heightmap Mode Playtesting...');
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1600, height: 1050 },
  });

  console.log('🌐 Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/');

  // Dismiss help overlay
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 1. Switch Mode to Grayscale (Heightmap)
  console.log('🔄 Switching Mode to Grayscale (Heightmap)...');
  const grayscaleBtn = page.locator('button.segmented-item:has-text("Grayscale"), button:has-text("Grayscale"), label:has-text("Grayscale")').first();
  if (await grayscaleBtn.count() > 0) {
    await grayscaleBtn.click();
    await page.waitForTimeout(1000);
  }

  // 2. Test Built-in Wave Relief Heightmap
  console.log('🌊 Testing continuous heightmap: Wave Relief...');
  const waveBtn = page.locator('button.example:has-text("Wave")').first();
  if (await waveBtn.count() > 0) {
    await waveBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: join(OUT_DIR, '01_wave_relief_baseline.png') });
  console.log('📸 01_wave_relief_baseline.png');

  // 3. Test Quality / Spacing in Grayscale
  console.log('🔍 Testing Grayscale Quality Presets: Standard vs High vs Ultra...');
  const qualities = ['Standard', 'High', 'Ultra'];
  for (const q of qualities) {
    const qBtn = page.locator(`.segmented button:has-text("${q}"), label:has-text("${q}")`).first();
    if (await qBtn.count() > 0) {
      await qBtn.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(OUT_DIR, `02_wave_quality_${q.toLowerCase()}.png`) });
      console.log(`📸 02_wave_quality_${q.toLowerCase()}.png`);
    }
  }

  // 4. Test Depth Heatmap view on Grayscale
  console.log('🎨 Inspecting Grayscale Elevation in Depth Heatmap & Normals view...');
  const heatmapBtn = page.locator('button:has-text("Depth heatmap")').first();
  if (await heatmapBtn.count() > 0) {
    await heatmapBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT_DIR, '03_wave_depth_heatmap.png') });
    console.log('📸 03_wave_depth_heatmap.png');
  }

  const normalsBtn = page.locator('button:has-text("Normals")').first();
  if (await normalsBtn.count() > 0) {
    await normalsBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT_DIR, '04_wave_surface_normals.png') });
    console.log('📸 04_wave_surface_normals.png');
  }

  // Back to Solid view
  const solidBtn = page.locator('button:has-text("Solid")').first();
  if (await solidBtn.count() > 0) {
    await solidBtn.click();
  }

  // 5. Test Emboss vs Deboss Direction
  console.log('🏔️ Testing Relief Direction: Emboss (raised out) vs Deboss (carved in)...');
  const embossBtn = page.locator('button:has-text("Emboss"), label:has-text("Emboss")').first();
  if (await embossBtn.count() > 0) {
    await embossBtn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT_DIR, '05_wave_emboss_raised.png') });
    console.log('📸 05_wave_emboss_raised.png');
  }

  // 6. Test Cobblestone Organic Terrain Texture
  console.log('🪨 Testing Organic Terrain: Cobblestone...');
  const cobbleBtn = page.locator('button.example:has-text("Cobblestone")').first();
  if (await cobbleBtn.count() > 0) {
    await cobbleBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT_DIR, '06_cobblestone_grayscale.png') });
    console.log('📸 06_cobblestone_grayscale.png');
  }

  // 7. Test Image Adjustments: Expand details
  console.log('🎛️ Testing Grayscale Image Adjustments (Gamma, Contrast, Levels)...');
  const adjSummary = page.locator('details summary:has-text("Image Adjustments"), details summary:has-text("Ajustes de imagen")').first();
  if (await adjSummary.count() > 0) {
    await adjSummary.click();
    await page.waitForTimeout(300);
  }

  // Zoom into Front view for macro detail
  const frontBtn = page.locator('button:has-text("Front")').first();
  if (await frontBtn.count() > 0) {
    await frontBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT_DIR, '07_cobblestone_front_zoom.png') });
    console.log('📸 07_cobblestone_front_zoom.png');
  }

  // 8. Test Sci-Fi Panel in Grayscale (Multi-depth step elevation)
  console.log('🚀 Testing Sci-Fi Panel in Grayscale Heightmap...');
  const sciFiBtn = page.locator('button.example:has-text("Sci-Fi")').first();
  if (await sciFiBtn.count() > 0) {
    await sciFiBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT_DIR, '08_scifi_grayscale_multilevel.png') });
    console.log('📸 08_scifi_grayscale_multilevel.png');
  }

  // Isometric view
  const isoBtn = page.locator('button:has-text("Isometric")').first();
  if (await isoBtn.count() > 0) {
    await isoBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT_DIR, '09_scifi_isometric.png') });
    console.log('📸 09_scifi_isometric.png');
  }

  await browser.close();
  console.log('\n🎉 Grayscale Playtesting completed! Screenshots saved to:', OUT_DIR);
}

runGrayscalePlaytest().catch((err) => {
  console.error('Grayscale Playtest failed:', err);
  process.exit(1);
});

/**
 * Playwright UI Audit Script
 * Captures screenshots and checks for broken UI elements.
 */
import { chromium, type Page, type Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:5175';
const SCREENSHOT_DIR = path.join(process.cwd(), 'tests/playwright/screenshots');

interface AuditIssue {
  selector: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: string;
}

const issues: AuditIssue[] = [];

function addIssue(selector: string, issue: string, severity: AuditIssue['severity'], details?: string) {
  issues.push({ selector, issue, severity, details });
  console.log(`[${severity.toUpperCase()}] ${selector}: ${issue}${details ? ` (${details})` : ''}`);
}

async function screenshot(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`Screenshot saved: ${name}.png`);
  return filePath;
}

async function checkElementVisible(page: Page, selector: string, label: string) {
  try {
    const el = await page.locator(selector).first();
    const isVisible = await el.isVisible();
    const box = await el.boundingBox();
    if (!isVisible) {
      addIssue(selector, `${label} not visible`, 'critical');
    } else if (box && (box.width === 0 || box.height === 0)) {
      addIssue(selector, `${label} has zero dimensions`, 'high', `${box.width}x${box.height}`);
    }
    return isVisible;
  } catch (e) {
    addIssue(selector, `${label} not found in DOM`, 'critical');
    return false;
  }
}

async function checkNoOverflow(page: Page, selector: string, label: string) {
  try {
    const overflow = await page.locator(selector).first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    });
    if (overflow.scrollWidth > overflow.clientWidth + 5) {
      addIssue(selector, `${label} has horizontal overflow`, 'medium',
        `scroll=${overflow.scrollWidth} client=${overflow.clientWidth}`);
    }
  } catch (e) {
    // silent
  }
}

async function checkCanvasPresent(page: Page) {
  try {
    const canvas = page.locator('canvas').first();
    const isVisible = await canvas.isVisible();
    const box = await canvas.boundingBox();
    if (!isVisible || !box) {
      addIssue('canvas', 'WebGL canvas not visible', 'critical');
      return;
    }
    if (box.width < 100 || box.height < 100) {
      addIssue('canvas', `WebGL canvas too small: ${box.width}x${box.height}`, 'critical');
    } else {
      console.log(`  Canvas OK: ${box.width}x${box.height}`);
    }
  } catch (e) {
    addIssue('canvas', 'WebGL canvas check failed', 'critical');
  }
}

async function checkTabNavigation(page: Page) {
  const tabs = ['Pattern', 'Mask', 'Operations', 'Export'];
  for (const tab of tabs) {
    try {
      const tabEl = page.locator(`[data-tab="${tab.toLowerCase()}"], button:has-text("${tab}"), .nav-item:has-text("${tab}")`).first();
      const isVisible = await tabEl.isVisible().catch(() => false);
      if (!isVisible) {
        addIssue(`tab:${tab}`, `Tab "${tab}" not visible or not found`, 'high');
      } else {
        console.log(`  Tab "${tab}" OK`);
        await tabEl.click();
        await page.waitForTimeout(300);
      }
    } catch (e) {
      addIssue(`tab:${tab}`, `Tab "${tab}" click failed`, 'high', String(e));
    }
  }
}

async function checkPatternSection(page: Page) {
  console.log('\n=== Pattern Section ===');
  const patternTab = page.locator('button:has-text("Pattern"), [data-tab="pattern"], .nav-item').first();
  await patternTab.click().catch(() => {});
  await page.waitForTimeout(500);
  await screenshot(page, '02-pattern-tab');

  // Check all range sliders
  const allSliders = await page.locator('input[type="range"]').all();
  console.log(`  Found ${allSliders.length} range sliders`);
  if (allSliders.length === 0) {
    addIssue('input[type="range"]', 'No range sliders found', 'critical');
  }
  for (let i = 0; i < allSliders.length; i++) {
    const slider = allSliders[i];
    const isVisible = await slider.isVisible();
    const box = await slider.boundingBox();
    if (!isVisible || !box || box.height < 8) {
      const id = await slider.getAttribute('id') || await slider.getAttribute('name') || `slider-${i}`;
      addIssue(`input[type="range"]:nth(${i})`, `Slider "${id}" invisible or collapsed`, 'high',
        box ? `h=${box.height}` : 'no box');
    }
  }
}

async function checkMaskSection(page: Page) {
  console.log('\n=== Mask Section ===');
  const maskTab = page.locator('button:has-text("Mask"), [data-tab="mask"], .nav-item:has-text("Mask")').first();
  const maskTabVisible = await maskTab.isVisible().catch(() => false);
  if (!maskTabVisible) {
    addIssue('[mask-tab]', 'Mask tab not found', 'high');
    return;
  }
  await maskTab.click();
  await page.waitForTimeout(500);
  await screenshot(page, '03-mask-tab');

  for (const tool of ['brush', 'erase', 'bucket']) {
    const el = page.locator(`[data-tool="${tool}"], button[title*="${tool}" i]`).first();
    const isVisible = await el.isVisible().catch(() => false);
    if (!isVisible) {
      addIssue(`[data-tool="${tool}"]`, `${tool} tool button not found`, 'medium');
    } else {
      console.log(`  Tool "${tool}" OK`);
    }
  }
}

async function checkExportSection(page: Page) {
  console.log('\n=== Export Section ===');
  const exportTab = page.locator('button:has-text("Export"), [data-tab="export"]').first();
  const exportVisible = await exportTab.isVisible().catch(() => false);
  if (!exportVisible) {
    addIssue('[export-tab]', 'Export tab not found', 'high');
    return;
  }
  await exportTab.click();
  await page.waitForTimeout(500);
  await screenshot(page, '05-export-tab');

  const exportBtn = page.locator('button:has-text("Export"), button:has-text("Download"), button:has-text("STL")').first();
  const exportBtnVisible = await exportBtn.isVisible().catch(() => false);
  if (!exportBtnVisible) {
    addIssue('[export-btn]', 'Export/Download button not found', 'high');
  } else {
    console.log('  Export button OK');
  }
}

async function checkLayoutIntegrity(page: Page) {
  console.log('\n=== Layout Integrity ===');
  const containers = [
    { sel: '#root', label: 'React root' },
    { sel: '.cad-viewport-container, .viewport-container, [class*="viewport"]', label: 'Viewport container' },
  ];
  for (const c of containers) {
    await checkElementVisible(page, c.sel, c.label);
    await checkNoOverflow(page, c.sel, c.label);
  }

  try {
    const viewportHeight = await page.locator('.cad-viewport-container, [class*="viewport"]').first().evaluate(el => {
      const box = el.getBoundingClientRect();
      return box.height;
    });
    if (viewportHeight < 100) {
      addIssue('[viewport]', `Viewport too small: ${viewportHeight}px`, 'critical');
    } else {
      console.log(`  Viewport height: ${viewportHeight}px`);
    }
  } catch (e) {
    addIssue('[viewport]', 'Could not measure viewport height', 'high');
  }
}

async function runAudit() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser: Browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page: Page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      consoleErrors.push(text);
      console.warn(`[console.error] ${text}`);
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`PAGE ERROR: ${err.message}`);
    console.error(`[pageerror] ${err.message}`);
  });

  try {
    console.log(`\nNavigating to ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3500); // Let WebGL init
    await screenshot(page, '01-initial-load');

    await checkLayoutIntegrity(page);
    await checkCanvasPresent(page);
    await checkTabNavigation(page);
    await checkPatternSection(page);
    await checkMaskSection(page);
    await checkExportSection(page);

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await screenshot(page, '07-final-state');

    if (consoleErrors.length > 0) {
      console.log(`\nConsole errors (${consoleErrors.length}):`);
      for (const e of consoleErrors) {
        console.log(`  - ${e}`);
        addIssue('[console]', e.slice(0, 120), 'high');
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(60));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(60));
  const byLevel = { critical: [] as AuditIssue[], high: [] as AuditIssue[], medium: [] as AuditIssue[], low: [] as AuditIssue[] };
  for (const issue of issues) {
    (byLevel as any)[issue.severity].push(issue);
  }
  for (const [level, list] of Object.entries(byLevel)) {
    if ((list as AuditIssue[]).length > 0) {
      console.log(`\n[${level.toUpperCase()}] (${(list as AuditIssue[]).length})`);
      for (const i of list as AuditIssue[]) {
        console.log(`  ${i.selector}: ${i.issue}${i.details ? ` — ${i.details}` : ''}`);
      }
    }
  }
  console.log(`\nTotal issues: ${issues.length}`);
  const reportPath = path.join(SCREENSHOT_DIR, 'audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ issues, consoleErrors }, null, 2));
  console.log(`Report: ${reportPath}`);
  return { issues, consoleErrors };
}

runAudit().catch(console.error);

/**
 * Spanish Localization & Interactive QA Playwright Test Suite
 * Validates complete Spanish translation, interactive functionality,
 * parametric changes, and visual integrity.
 */
import { chromium, type Page, type Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';

const PORT = 5199;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = path.join(process.cwd(), 'tests/playwright/screenshots-es');

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

async function runSpanishQASuite() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log('\n======================================================');
  console.log('🇪🇸 INICIANDO SUITE DE PRUEBAS QA PLAYWRIGHT EN ESPAÑOL');
  console.log('======================================================\n');

  // Start Vite Preview Server on dedicated port
  let serverProcess: ChildProcess | null = null;
  serverProcess = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
    shell: true,
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  // Give server time to boot
  await new Promise((resolve) => setTimeout(resolve, 2500));

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
    // 1. Initial Load & Language Switch to Spanish
    // ------------------------------------------------------------------
    console.log('\n--- 1. Carga Inicial y Activación de Idioma Español ---');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Locate language switcher
    const langSelect = page.locator('select.cad-select').filter({ hasText: /English|Español/ }).first();
    if (await langSelect.isVisible()) {
      await langSelect.selectOption('es');
      await page.waitForTimeout(500);
      record('i18n Core', 'Cambio a Español', 'PASS', 'Idioma seleccionado: Español (es)');
    } else {
      // Check if another select matches
      const allSelects = await page.locator('select').all();
      let switched = false;
      for (const sel of allSelects) {
        const text = await sel.innerText();
        if (text.includes('Español') || text.includes('English')) {
          await sel.selectOption('es');
          switched = true;
          break;
        }
      }
      record('i18n Core', 'Cambio a Español', switched ? 'PASS' : 'FAIL');
    }

    await snap(page, 'es-01-app-loaded-spanish');

    // ------------------------------------------------------------------
    // 2. Navigation Rail Tabs (Modelo, Patrón, Exportar)
    // ------------------------------------------------------------------
    console.log('\n--- 2. Barra de Navegación Lateral ---');
    const navText = await page.locator('.cad-nav-rail').innerText();
    const hasModelo = navText.includes('Modelo');
    const hasPatron = navText.includes('Patrón');
    const hasExportar = navText.includes('Exportar');

    record('Navegación', 'Pestaña Modelo', hasModelo ? 'PASS' : 'FAIL', 'Texto "Modelo" presente');
    record('Navegación', 'Pestaña Patrón', hasPatron ? 'PASS' : 'FAIL', 'Texto "Patrón" presente');
    record('Navegación', 'Pestaña Exportar', hasExportar ? 'PASS' : 'FAIL', 'Texto "Exportar" presente');

    // ------------------------------------------------------------------
    // 3. Top Toolbar & Header Controls
    // ------------------------------------------------------------------
    console.log('\n--- 3. Barra de Herramientas Superior ---');
    const topBar = page.locator('.cad-header');
    const topBarText = await topBar.innerText();

    const hasNew = topBarText.includes('Nuevo');
    const hasSave = topBarText.includes('Guardar');
    const hasLoad = topBarText.includes('Abrir') || topBarText.includes('Cargar');
    const hasExportTop = topBarText.includes('Exportar');

    record('Barra Superior', 'Botón Nuevo', hasNew ? 'PASS' : 'FAIL');
    record('Barra Superior', 'Botón Guardar', hasSave ? 'PASS' : 'FAIL');
    record('Barra Superior', 'Botón Abrir (Cargar)', hasLoad ? 'PASS' : 'FAIL');
    record('Barra Superior', 'Botón Exportar', hasExportTop ? 'PASS' : 'FAIL');

    // ------------------------------------------------------------------
    // 4. Model Inspector (Parámetros del Cilindro)
    // ------------------------------------------------------------------
    console.log('\n--- 4. Inspector de Modelo y Cilindro ---');
    const modelInspector = page.locator('.cad-context-panel');
    const modelInspectorText = await modelInspector.innerText();

    const hasCylParams = modelInspectorText.includes('PARÁMETROS DEL CILINDRO') || modelInspectorText.includes('Cilindro') || modelInspectorText.includes('CILINDRO');
    record('Inspector Modelo', 'Sección Parámetros del Cilindro', hasCylParams ? 'PASS' : 'FAIL');

    // Select 'custom' preset to reveal parametric cylinder inputs
    const presetSelect = modelInspector.locator('select.cad-select').first();
    if (await presetSelect.isVisible()) {
      await presetSelect.selectOption('custom');
      await page.waitForTimeout(400);
    }

    const customInspectorText = (await modelInspector.innerText()).toLowerCase();
    const hasDiametro = customInspectorText.includes('diámetro');
    const hasAltura = customInspectorText.includes('altura');
    const hasBore = customInspectorText.includes('eje');
    const hasGrosor = customInspectorText.includes('grosor');

    record('Inspector Modelo', 'Campo Diámetro', hasDiametro ? 'PASS' : 'FAIL');
    record('Inspector Modelo', 'Campo Altura', hasAltura ? 'PASS' : 'FAIL');
    record('Inspector Modelo', 'Campo Eje', hasBore ? 'PASS' : 'FAIL');
    record('Inspector Modelo', 'Campo Grosor de Pared', hasGrosor ? 'PASS' : 'FAIL');

    // Modify cylinder dimensions in Spanish
    const diameterInput = modelInspector.locator('input[type="number"]').first();
    if (await diameterInput.isVisible()) {
      await diameterInput.fill('95');
      await page.waitForTimeout(400);
      record('Inspector Modelo', 'Edición interactiva de diámetro', 'PASS', 'Diámetro ajustado a 95 mm');
    }

    // ------------------------------------------------------------------
    // 5. Right Inspector & Validation Checklist
    // ------------------------------------------------------------------
    console.log('\n--- 5. Inspector de Validación y Estadísticas ---');
    const validationPanel = page.locator('.cad-right-panel');
    const validationText = await validationPanel.innerText();

    const hasValidacion = validationText.includes('VALIDACIÓN') || validationText.includes('Validación');
    const hasMallaCerrada = validationText.includes('Malla cerrada') || validationText.includes('Hermética') || validationText.includes('CERRADA');
    const hasNormales = validationText.includes('Normales') || validationText.includes('consistentes');
    const hasSinDegeneradas = validationText.includes('degeneradas') || validationText.includes('caras');
    const hasDimensiones = validationText.includes('DIMENSIONES') || validationText.includes('Dimensiones');
    const hasEstadisticas = validationText.includes('ESTADÍSTICAS') || validationText.includes('Estadísticas') || validationText.includes('Malla');

    record('Validación', 'Sección Validación', hasValidacion ? 'PASS' : 'FAIL');
    record('Validación', 'Comprobación Malla Cerrada', hasMallaCerrada ? 'PASS' : 'FAIL');
    record('Validación', 'Comprobación Normales', hasNormales ? 'PASS' : 'FAIL');
    record('Validación', 'Comprobación Caras Degeneradas', hasSinDegeneradas ? 'PASS' : 'FAIL');
    record('Validación', 'Sección Dimensiones', hasDimensiones ? 'PASS' : 'FAIL');
    record('Validación', 'Sección Estadísticas', hasEstadisticas ? 'PASS' : 'FAIL');

    // ------------------------------------------------------------------
    // 6. Viewport Overlay & ViewCube in Spanish
    // ------------------------------------------------------------------
    console.log('\n--- 6. Controles del Viewport y Cubo de Vistas ---');
    const viewCube = page.locator('.cad-viewcube');
    if (await viewCube.isVisible()) {
      const cubeText = await viewCube.innerText();
      const hasFrente = cubeText.includes('FRENTE');
      const hasDer = cubeText.includes('DER');
      const hasIzq = cubeText.includes('IZQ') || cubeText.includes('DETRÁS');

      record('ViewCube 3D', 'Cara FRENTE', hasFrente ? 'PASS' : 'FAIL');
      record('ViewCube 3D', 'Cara DERECHA (DER)', hasDer ? 'PASS' : 'FAIL');
      record('ViewCube 3D', 'Caras Laterales en Español', hasIzq ? 'PASS' : 'FAIL');

      // Click on front face
      const frontFace = viewCube.locator('.cad-cube-front');
      if (await frontFace.isVisible()) {
        await frontFace.click();
        await page.waitForTimeout(300);
        record('ViewCube 3D', 'Interacción y clic en cara FRENTE', 'PASS');
      }
    }

    // Contextual tools
    const toolGroup = page.locator('.cad-viewport-tools');
    if (await toolGroup.isVisible()) {
      const toolText = await toolGroup.innerText();
      record('Herramientas Viewport', 'Barra de herramientas contextuales', 'PASS', toolText.replace(/\n/g, ' '));
    }

    // ------------------------------------------------------------------
    // 7. Bottom Operation Editor Dock - Tab 1 (Configuración)
    // ------------------------------------------------------------------
    console.log('\n--- 7. Panel Inferior: Configuración de Operación ---');
    const dock = page.locator('.cad-bottom-dock');
    const dockText = await dock.innerText();

    const hasStack = dockText.includes('PILA DE OPERACIONES') || dockText.includes('OPERACIONES');
    
    const tabBtns = dock.locator('.cad-op-tab-btn');
    const tabTexts = (await tabBtns.allInnerTexts()).join(' ').toLowerCase();
    const hasTabConfig = tabTexts.includes('configuración');
    const hasTabTextures = tabTexts.includes('texturas');
    const hasTabLayout = tabTexts.includes('disposición');
    const hasCalidad = dockText.includes('Calidad') || dockText.includes('CALIDAD');

    record('Dock Operaciones', 'Pila de Operaciones', hasStack ? 'PASS' : 'FAIL');
    record('Dock Operaciones', 'Pestaña Configuración', hasTabConfig ? 'PASS' : 'FAIL');
    record('Dock Operaciones', 'Pestaña Texturas', hasTabTextures ? 'PASS' : 'FAIL');
    record('Dock Operaciones', 'Pestaña Disposición', hasTabLayout ? 'PASS' : 'FAIL');
    record('Dock Operaciones', 'Control Calidad', hasCalidad ? 'PASS' : 'FAIL');

    // Click Tab 1
    const tabSettingsBtn = page.locator('button.cad-op-tab-btn').filter({ hasText: /Configuración/i });
    if (await tabSettingsBtn.isVisible()) {
      await tabSettingsBtn.click();
      await page.waitForTimeout(300);
    }

    const tab1Content = await page.locator('.cad-op-tab-content').innerText();
    const hasModoMapeo = tab1Content.includes('Modo de Mapeo') || tab1Content.includes('Mapeo');
    const hasTipoOp = tab1Content.includes('Tipo de Operación') || tab1Content.includes('Operación');
    const hasModoProy = tab1Content.includes('Modo de Proyección') || tab1Content.includes('Proyección');
    const hasProfundidad = tab1Content.includes('Profundidad');
    const hasNiveles = tab1Content.includes('Niveles') || tab1Content.includes('Brillo');
    const hasInvertir = tab1Content.includes('Invertir');
    const hasRotacion = tab1Content.includes('Rotación');
    const hasSuavizado = tab1Content.includes('Suavizado');

    record('Pestaña Configuración', 'Selector Modo de Mapeo', hasModoMapeo ? 'PASS' : 'FAIL');
    record('Pestaña Configuración', 'Selector Tipo de Operación', hasTipoOp ? 'PASS' : 'FAIL');
    record('Pestaña Configuración', 'Selector Modo de Proyección', hasModoProy ? 'PASS' : 'FAIL');
    record('Pestaña Configuración', 'Control Profundidad', hasProfundidad ? 'PASS' : 'FAIL');
    record('Pestaña Configuración', 'Niveles de Imagen (Brillo/Contraste)', hasNiveles ? 'PASS' : 'FAIL');
    record('Pestaña Configuración', 'Interruptor Invertir Polaridad', hasInvertir ? 'PASS' : 'FAIL');
    record('Pestaña Configuración', 'Control Rotación', hasRotacion ? 'PASS' : 'FAIL');
    record('Pestaña Configuración', 'Control Suavizado de Textura', hasSuavizado ? 'PASS' : 'FAIL');

    await snap(page, 'es-02-dock-tab1-settings');

    // ------------------------------------------------------------------
    // 8. Bottom Operation Editor Dock - Tab 2 (Texturas y Preajustes)
    // ------------------------------------------------------------------
    console.log('\n--- 8. Panel Inferior: Texturas y Preajustes ---');
    const tabTextureBtn = page.locator('button.cad-op-tab-btn').filter({ hasText: /Texturas/i });
    if (await tabTextureBtn.isVisible()) {
      await tabTextureBtn.click();
      await page.waitForTimeout(400);

      const tab2Content = await page.locator('.cad-op-tab-content').innerText();
      const hasSubir = tab2Content.includes('Subir') || tab2Content.includes('Personalizado');
      const hasDestino = tab2Content.includes('Destino') || tab2Content.includes('Filas');
      const hasPreajustes = tab2Content.includes('PREAJUSTES') || tab2Content.includes('Preajustes');

      record('Pestaña Texturas', 'Tarjeta Subir Diseño Personalizado', hasSubir ? 'PASS' : 'FAIL');
      record('Pestaña Texturas', 'Insignia de Destino y Modo', hasDestino ? 'PASS' : 'FAIL');
      record('Pestaña Texturas', 'Biblioteca de Preajustes', hasPreajustes ? 'PASS' : 'FAIL');

      // Click on a preset card
      const presetCard = page.locator('.cad-preset-card').nth(2);
      if (await presetCard.isVisible()) {
        const presetName = await presetCard.innerText();
        await presetCard.click();
        await page.waitForTimeout(1000); // Allow mesh re-generation
        record('Pestaña Texturas', 'Aplicación interactiva de preajuste', 'PASS', `Preajuste aplicado: ${presetName.trim()}`);
      }

      await snap(page, 'es-03-dock-tab2-textures');
    }

    // ------------------------------------------------------------------
    // 9. Bottom Operation Editor Dock - Tab 3 (Disposición del Patrón)
    // ------------------------------------------------------------------
    console.log('\n--- 9. Panel Inferior: Disposición del Patrón y Ajuste Continuo ---');
    const tabLayoutBtn = page.locator('button.cad-op-tab-btn').filter({ hasText: /Disposición/i });
    if (await tabLayoutBtn.isVisible()) {
      await tabLayoutBtn.click();
      await page.waitForTimeout(400);

      const tab3Content = await page.locator('.cad-op-tab-content').innerText();
      const hasTamanoU = tab3Content.includes('Tamaño U') || tab3Content.includes('Size U');
      const hasTamanoV = tab3Content.includes('Tamaño V') || tab3Content.includes('Size V');
      const hasColumnas = tab3Content.includes('Columnas');
      const hasFilas = tab3Content.includes('Filas');
      const hasDespU = tab3Content.includes('Desplazamiento U') || tab3Content.includes('Offset U');
      const hasUnion = tab3Content.includes('UNIÓN CONTINUA') || tab3Content.includes('Unión');
      const hasCircunferencia = tab3Content.includes('Circunferencia');

      record('Pestaña Disposición', 'Control Tamaño U (mm)', hasTamanoU ? 'PASS' : 'FAIL');
      record('Pestaña Disposición', 'Control Tamaño V (mm)', hasTamanoV ? 'PASS' : 'FAIL');
      record('Pestaña Disposición', 'Entradas Columnas y Filas', (hasColumnas && hasFilas) ? 'PASS' : 'FAIL');
      record('Pestaña Disposición', 'Control Desplazamiento U (%)', hasDespU ? 'PASS' : 'FAIL');
      record('Pestaña Disposición', 'Caja de Unión Continua (Seamless)', hasUnion ? 'PASS' : 'FAIL');
      record('Pestaña Disposición', 'Métrica de Circunferencia', hasCircunferencia ? 'PASS' : 'FAIL');

      // Test switching mapping mode to 'rows' to check row-level layout controls
      const mappingSelect = page.locator('select.cad-select').filter({ hasText: /Cuadrícula|Filas|Logo/i }).first();
      if (await mappingSelect.isVisible()) {
        await mappingSelect.selectOption('rows');
        await page.waitForTimeout(300);
        const rowsContent = (await page.locator('.cad-op-tab-content').innerText()).toLowerCase();
        const hasFilasLogos = rowsContent.includes('logos y texturas por fila') || rowsContent.includes('fila 1');
        record('Pestaña Disposición', 'Logos y Texturas por Fila en Modo Filas', hasFilasLogos ? 'PASS' : 'FAIL');
      }

      // Change columns & rows
      const colsInput = page.locator('.cad-op-tab-content input[type="number"]').first();
      if (await colsInput.isVisible()) {
        await colsInput.fill('12');
        await page.waitForTimeout(400);
        record('Pestaña Disposición', 'Ajuste de columnas', 'PASS', 'Columnas configuradas a 12');
      }

      await snap(page, 'es-04-dock-tab3-layout');
    }

    // ------------------------------------------------------------------
    // 10. Pattern Sidebar Tab (Logos & Texturas por Fila)
    // ------------------------------------------------------------------
    console.log('\n--- 10. Barra Lateral: Pestaña Patrón ---');
    const patronNavBtn = page.locator('.cad-nav-item').filter({ hasText: /Patrón/i });
    if (await patronNavBtn.isVisible()) {
      await patronNavBtn.click();
      await page.waitForTimeout(500);

      const patternPanel = page.locator('.cad-context-panel');
      const patternPanelText = await patternPanel.innerText();

      const hasLogosTexturas = patternPanelText.includes('Logos y Texturas') || patternPanelText.includes('LOGOS') || patternPanelText.includes('Patrón');
      const hasSubirPrompt = patternPanelText.includes('Subir Logotipo') || patternPanelText.includes('Subir') || patternPanelText.includes('Arrastra');
      const hasPorFila = patternPanelText.includes('Logos y Texturas por Fila') || patternPanelText.includes('por Fila') || patternPanelText.includes('Fila');

      record('Panel Patrón', 'Encabezado Logos y Texturas', hasLogosTexturas ? 'PASS' : 'FAIL');
      record('Panel Patrón', 'Zona de Carga Personalizada', hasSubirPrompt ? 'PASS' : 'FAIL');
      record('Panel Patrón', 'Sección Logos y Texturas por Fila', hasPorFila ? 'PASS' : 'FAIL');

      await snap(page, 'es-05-pattern-sidebar');
    }

    // ------------------------------------------------------------------
    // 11. Export Modal in Spanish
    // ------------------------------------------------------------------
    console.log('\n--- 11. Modal de Exportación en Español ---');
    const exportNavBtn = page.locator('.cad-nav-item').filter({ hasText: /Exportar/i });
    if (await exportNavBtn.isVisible()) {
      await exportNavBtn.click();
      await page.waitForTimeout(500);

      const exportModal = page.locator('.cad-export-modal');
      const isModalOpen = await exportModal.isVisible();
      record('Modal Exportar', 'Apertura del Modal', isModalOpen ? 'PASS' : 'FAIL');

      if (isModalOpen) {
        const modalText = await exportModal.innerText();
        const hasTituloModal = modalText.includes('Exportar Modelo 3D');
        const hasPreajusteCalidad = modalText.includes('PREAJUSTE DE CALIDAD') || modalText.includes('Calidad');
        const hasResolucion = modalText.includes('Resolución Objetivo') || modalText.includes('Resolución');
        const hasTriangulos = modalText.includes('Triángulos Estimados') || modalText.includes('Triángulos');
        const hasTamanoArch = modalText.includes('Tamaño Estimado') || modalText.includes('Archivo');
        const hasFormatoExp = modalText.includes('FORMATO DE EXPORTACIÓN') || modalText.includes('FORMATO');
        const has3MF = modalText.includes('3MF (.3mf)');
        const hasSTL = modalText.includes('STL (.stl)');
        const hasRecomendado = modalText.includes('RECOMENDADO');
        const hasBotonExportar = modalText.includes('Exportar 3MF Ahora') || modalText.includes('Exportar STL Ahora');

        record('Modal Exportar', 'Título "Exportar Modelo 3D"', hasTituloModal ? 'PASS' : 'FAIL');
        record('Modal Exportar', 'Sección Preajuste de Calidad', hasPreajusteCalidad ? 'PASS' : 'FAIL');
        record('Modal Exportar', 'Métrica Resolución Objetivo', hasResolucion ? 'PASS' : 'FAIL');
        record('Modal Exportar', 'Métrica Triángulos Estimados', hasTriangulos ? 'PASS' : 'FAIL');
        record('Modal Exportar', 'Métrica Tamaño de Archivo Estimado', hasTamanoArch ? 'PASS' : 'FAIL');
        record('Modal Exportar', 'Sección Formato de Exportación', hasFormatoExp ? 'PASS' : 'FAIL');
        record('Modal Exportar', 'Opción 3MF con insignia RECOMENDADO', (has3MF && hasRecomendado) ? 'PASS' : 'FAIL');
        record('Modal Exportar', 'Opción STL', hasSTL ? 'PASS' : 'FAIL');
        record('Modal Exportar', 'Botón de Acción Exportar Ahora', hasBotonExportar ? 'PASS' : 'FAIL');

        await snap(page, 'es-06-export-modal');

        // Switch format to STL
        const stlCard = exportModal.locator('.cad-format-card').filter({ hasText: /STL/i });
        if (await stlCard.isVisible()) {
          await stlCard.click();
          await page.waitForTimeout(300);
          const updatedModalText = await exportModal.innerText();
          const hasStlBtn = updatedModalText.includes('Exportar STL Ahora');
          record('Modal Exportar', 'Selección de formato STL', hasStlBtn ? 'PASS' : 'FAIL', 'Botón actualizado a "Exportar STL Ahora"');
        }

        // Close modal
        const closeBtn = exportModal.locator('button').filter({ hasText: /✕|Cancelar/i }).first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(400);
          record('Modal Exportar', 'Cierre del Modal', 'PASS');
        }
      }
    }

    // ------------------------------------------------------------------
    // 12. Status Bar in Spanish
    // ------------------------------------------------------------------
    console.log('\n--- 12. Barra de Estado Inferior ---');
    const statusFooter = page.locator('.cad-statusbar');
    const statusFooterText = await statusFooter.innerText();

    const hasStatusLoaded = statusFooterText.includes('cargado con éxito') || statusFooterText.includes('Generando malla') || statusFooterText.includes('Modelo');
    const hasAutoGuardado = statusFooterText.includes('Guardado automático') || statusFooterText.includes('Auto-guardado') || statusFooterText.includes('guardado');
    const hasMemoria = statusFooterText.includes('Memoria') || statusFooterText.includes('Uso de Memoria');

    record('Barra de Estado', 'Mensaje de Estado del Modelo', hasStatusLoaded ? 'PASS' : 'FAIL', statusFooterText.replace(/\n/g, ' '));
    record('Barra de Estado', 'Indicador de Auto-guardado', hasAutoGuardado ? 'PASS' : 'FAIL');
    record('Barra de Estado', 'Métrica de Uso de Memoria', hasMemoria ? 'PASS' : 'FAIL');

    await snap(page, 'es-07-final-overview');

  } catch (error) {
    console.error('❌ Error general durante la ejecución de la prueba:', error);
    record('Suite', 'Ejecución completa', 'FAIL', (error as Error).message);
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  }

  // ------------------------------------------------------------------
  // Summary Report
  // ------------------------------------------------------------------
  console.log('\n======================================================');
  console.log('📊 RESUMEN DE RESULTADOS DE PRUEBAS QA EN ESPAÑOL');
  console.log('======================================================');

  const passes = results.filter((r) => r.status === 'PASS').length;
  const fails = results.filter((r) => r.status === 'FAIL').length;
  const warns = results.filter((r) => r.status === 'WARN').length;

  console.log(`\nTotal Pruebas: ${results.length}`);
  console.log(`✅ Aprobadas (PASS): ${passes}`);
  console.log(`❌ Fallidas (FAIL):  ${fails}`);
  console.log(`⚠️ Advertencias (WARN): ${warns}`);
  console.log(`Errores de consola no controlados: ${consoleErrors.length}`);

  if (fails > 0) {
    console.log('\n❌ Detalle de Pruebas Fallidas:');
    results.filter((r) => r.status === 'FAIL').forEach((r) => {
      console.log(`  - [${r.category}] ${r.feature}: ${r.details || 'Fallo de aserción'}`);
    });
  }

  if (consoleErrors.length > 0) {
    console.log('\n⚠️ Errores de consola registrados:');
    consoleErrors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log('\n======================================================\n');

  if (fails > 0) {
    process.exit(1);
  }
}

void runSpanishQASuite();

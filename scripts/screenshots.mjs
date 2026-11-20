// Screenshot untuk README + og-image (Playwright, server lokal port 8331).
// Usage: node scripts/screenshots.mjs  (server harus jalan: npm run serve)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:8331';
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

// --- Landing desktop (hero, viewport 1440x900) ---
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/');
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/landing-desktop.png' });
  await page.close();
}

// --- og-image 1200x630 (dari halaman asli, bukan placeholder) ---
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(BASE + '/');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'og-image.png' });
  await page.close();
}

// --- Landing mobile (hero, 390x844) ---
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE + '/');
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/landing-mobile.png' });
  await page.close();
}

// --- App: login demo + seed 1 dokumen siap, lalu dashboard + analisis ---
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/login.html');
  await page.evaluate(async () => {
    await window.RMAuth.register({ name: 'Uji Coba', email: 'uji@contoh.id', password: 'password123' });
    window.RMStore.addDoc({ title: 'Makalah Berantakan', fileName: 'makalah-berantakan.docx', status: 'siap', pages: 6, findingsCount: 3 });
    window.RMStore.logActivity('Dokumen "Makalah Berantakan" selesai diformat.');
  });
  await page.goto(BASE + '/app/');
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/app-dashboard.png' });

  // Halaman baru: unggah fixture asli lalu analisis (6 temuan)
  await page.goto(BASE + '/app/documents/new.html');
  await page.waitForTimeout(400);
  await page.locator('#docx-input').setInputFiles('e2e/fixtures/makalah-berantakan.docx');
  await page.locator('.finding', { timeout: 15000 }).first().waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/app-analysis.png' });

  // Mobile dashboard
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/app/');
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/app-mobile.png' });
  await page.close();
}

await browser.close();
console.log('screenshots done');

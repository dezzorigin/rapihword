// Video demo: walkthrough sistem lokal (Playwright video -> webm),
// lalu konversi ke mp4 dengan ffmpeg (lihat package.json: npm run make-video).
// Usage: node scripts/make-video.mjs   (server harus jalan: npm run serve)
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8331';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: 'docs/', size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();

// 1. Landing
await page.goto(BASE + '/');
await page.waitForTimeout(1500);
await page.mouse.wheel(0, 500);
await page.waitForTimeout(1200);
await page.mouse.wheel(0, 500);
await page.waitForTimeout(1200);
await page.goto(BASE + '/');
await page.waitForTimeout(800);

// 2. Daftar (UI asli) -> dashboard
await page.goto(BASE + '/register.html');
await page.waitForTimeout(600);
await page.locator('#reg-name').fill('Uji Coba');
await page.locator('#reg-email').fill('uji@contoh.id');
await page.locator('#reg-password').fill('password123');
await page.locator('#reg-password-confirm').fill('password123');
await page.waitForTimeout(400);
await page.locator('button[type="submit"]').click();
await page.waitForURL(/\/app\//);
await page.waitForTimeout(1200);

// 3. Dokumen baru: unggah fixture -> analisis -> terapkan format -> unduh
await page.goto(BASE + '/app/documents/new.html');
await page.waitForTimeout(600);
await page.locator('#docx-input').setInputFiles('e2e/fixtures/makalah-berantakan.docx');
await page.locator('.finding', { timeout: 15000 }).first().waitFor();
await page.waitForTimeout(1500);
await page.mouse.wheel(0, 400);
await page.waitForTimeout(800);
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.locator('#apply-format-btn').click(),
]);
await page.waitForTimeout(1500);
await download.saveAs('/tmp/rapimakalah-demo-download.docx');

// 4. Daftar dokumen: hasil muncul sebagai "Siap diunduh"
await page.goto(BASE + '/app/documents.html');
await page.waitForTimeout(1200);

await ctx.close();
await browser.close();
console.log('video webm direkam di docs/');

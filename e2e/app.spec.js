// e2e RapiMakalah — alur nyata: auth demo, upload DOCX -> analisis ->
// format -> unduh (hasil diverifikasi isi OOXML-nya), tempel teks,
// menulis, template, pengaturan. Desktop + mobile.
import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'e2e', 'fixtures', 'makalah-berantakan.docx');

async function readDocxXml(download) {
  const path = await download.path();
  const zip = await JSZip.loadAsync(readFileSync(path));
  return {
    xml: await zip.file('word/document.xml').async('string'),
    files: Object.keys(zip.files),
  };
}

async function seedLogin(page) {
  await page.goto('/login.html');
  await page.evaluate(async () => {
    await window.RMAuth.register({
      name: 'Uji Coba', email: 'uji@contoh.id', password: 'password123',
      institution: 'Universitas Contoh', major: 'Informatika',
    });
  });
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test.describe('landing publik', () => {
  test('hero + seksi utama tampil', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Rapikan format makalah tanpa mengorbankan isinya');
    await expect(page.locator('text=Mulai Gratis').first()).toBeVisible();
    await expect(page.locator('text=Spasi baris 1,0').first()).toBeVisible();
    await expect(page.locator('#masalah')).toBeVisible();
    await expect(page.locator('#fitur')).toBeVisible();
    await expect(page.locator('#alur')).toBeVisible();
    await expect(page.locator('#panduan')).toBeVisible();
    await expect(page.locator('#faq')).toBeVisible();
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image\.png/);
  });

  test('FAQ accordion membuka jawaban', async ({ page }) => {
    await page.goto('/');
    const first = page.locator('.faq-item').first();
    await first.locator('.faq-q').click();
    await expect(first.locator('.faq-a')).toBeVisible();
    await expect(first.locator('.faq-a')).toContainText('tidak digunakan untuk melatih model');
  });

  test('popup WhatsApp bisa dibuka dan ditutup', async ({ page }) => {
    await page.goto('/');
    await page.locator('.wa-float').click();
    await expect(page.locator('.wa-popup')).toBeVisible();
    await expect(page.locator('.wa-popup')).toContainText('Butuh bantuan');
    await page.locator('.wa-popup button', { hasText: 'Nanti saja' }).click();
    await expect(page.locator('.wa-popup')).not.toBeVisible();
  });

  test('mobile 390px tanpa overflow horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('auth demo', () => {
  test('daftar lalu masuk lalu keluar', async ({ page }) => {
    await page.goto('/register.html');
    await page.locator('#reg-name').fill('Uji Coba');
    await page.locator('#reg-email').fill('uji@contoh.id');
    await page.locator('#reg-password').fill('password123');
    await page.locator('#reg-password-confirm').fill('password123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\//);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // Keluar lewat menu akun
    await page.locator('.account-btn').click();
    await page.locator('.account-dropdown button', { hasText: 'Keluar' }).click();
    await expect(page).toHaveURL(/login\.html/);
  });

  test('login password salah menampilkan error', async ({ page }) => {
    await page.goto('/login.html');
    await page.evaluate(async () => {
      await window.RMAuth.register({ name: 'Uji Coba', email: 'uji@contoh.id', password: 'password123' });
      window.RMAuth.logout();
    });
    await page.goto('/login.html');
    await page.locator('#login-email').fill('uji@contoh.id');
    await page.locator('#login-password').fill('salah-salah');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('.form-alert')).toContainText('Kata sandi salah');
  });

  test('lupa password: minta kode lalu atur ulang dan masuk', async ({ page }) => {
    await page.goto('/login.html');
    await page.evaluate(async () => {
      await window.RMAuth.register({ name: 'Uji Coba', email: 'uji@contoh.id', password: 'password123' });
    });
    await page.goto('/forgot-password.html');
    await page.locator('#reset-email').fill('uji@contoh.id');
    await page.locator('#reset-request-btn').click();
    await expect(page.locator('#reset-code-display')).toBeVisible();
    const code = await page.locator('#reset-code-display').textContent();
    await page.locator('#reset-code').fill(code.trim());
    await page.locator('#reset-password').fill('passwordbaru1');
    await page.locator('#reset-password-confirm').fill('passwordbaru1');
    await page.locator('#reset-submit-btn').click();
    await expect(page.locator('.form-alert:visible')).toContainText('berhasil');
    // Sesi dari register di awal tes masih aktif -> keluar dulu agar /login.html tampil.
    await page.evaluate(() => window.RMAuth.logout());
    await page.goto('/login.html');
    await page.locator('#login-email').fill('uji@contoh.id');
    await page.locator('#login-password').fill('passwordbaru1');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\//);
  });

  test('halaman /app tanpa login mengarah ke login', async ({ page }) => {
    await page.goto('/app/');
    await expect(page).toHaveURL(/login\.html/);
  });
});

test.describe('dokumen: upload -> analisis -> format -> unduh', () => {
  test.beforeEach(async ({ page }) => { await seedLogin(page); });

  test('upload DOCX berantakan: temuan tampil, format diterapkan, hasil bisa diunduh', async ({ page }) => {
    await page.goto('/app/documents/new.html');
    await expect(page.locator('.pipeline')).toBeVisible();
    await page.locator('#docx-input').setInputFiles(FIXTURE);
    // Analisis selesai: temuan per seksi tampil
    await expect(page.locator('.finding')).toHaveCount(6, { timeout: 15000 });
    await expect(page.locator('.finding-section', { hasText: 'Kertas & margin' })).toBeVisible();
    await expect(page.locator('.finding', { hasText: 'Tidak sesuai' }).first()).toBeVisible();
    // Terapkan format
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('#apply-format-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const { xml, files } = await readDocxXml(download);
    // Hasil: margin 4-4-3-3 (2268/2268/1701/1701), TNR, spasi 1,5, TOC, Romawi+Arab
    expect(xml).toContain('w:top="2268"');
    expect(xml).toContain('w:left="2268"');
    expect(xml).toContain('w:bottom="1701"');
    expect(xml).toContain('Times New Roman');
    expect(xml).toContain('w:line="360"');
    expect(xml).toContain('TOC');
    expect(xml).toContain('w:fmt="lowerRoman"');
    expect(xml).toContain('w:fmt="decimal"');
    expect(xml).toContain('w:val="Heading1"');
    expect(files).toContain('word/footer1.xml');
    expect(files).toContain('word/footer2.xml');
    // Dokumen tersimpan di riwayat dengan status Siap diunduh
    await page.goto('/app/documents.html');
    await expect(page.locator('.doc-list')).toContainText('makalah-berantakan.docx');
    await expect(page.locator('.doc-list')).toContainText('Siap diunduh');
  });

  test('file bukan DOCX ditolak dengan pesan jelas', async ({ page }) => {
    await page.goto('/app/documents/new.html');
    await page.locator('#docx-input').setInputFiles({
      name: 'catatan.txt', mimeType: 'text/plain', buffer: Buffer.from('bukan docx'),
    });
    await expect(page.locator('#upload-error')).toBeVisible();
    await expect(page.locator('#upload-error')).toContainText('.docx');
  });

  test('tempel teks jadi .docx yang bisa diunduh', async ({ page }) => {
    await page.goto('/app/documents/new.html');
    await page.locator('.tabs button', { hasText: 'Tempel teks' }).click();
    await page.locator('#paste-text').fill('# Analisis Sistem Informasi\n\n## Pendahuluan\n\nSistem informasi akademik menjadi tulang punggung layanan kampus.');
    await expect(page.locator('#paste-create-btn')).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('#paste-create-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const { xml } = await readDocxXml(download);
    expect(xml).toContain('Analisis Sistem Informasi');
    expect(xml).toContain('w:val="Heading1"');
    expect(xml).toContain('TOC');
  });
});

test.describe('menulis, template, pengaturan', () => {
  test.beforeEach(async ({ page }) => { await seedLogin(page); });

  test('menulis: ketik lalu unduh .docx', async ({ page }) => {
    await page.goto('/app/writing.html');
    await page.locator('#writing-title').fill('Makalah Uji Tulis');
    await page.locator('#writing-text').fill('# Bab Uji\n\nIsi tulisan uji coba format.');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('#writing-download-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const { xml } = await readDocxXml(download);
    expect(xml).toContain('Makalah Uji Tulis');
    expect(xml).toContain('Isi tulisan uji coba format.');
  });

  test('template bawaan Makalah ada dan bisa diduplikat', async ({ page }) => {
    await page.goto('/app/templates.html');
    await expect(page.locator('.template-grid')).toContainText('Makalah');
    await expect(page.locator('.template-grid')).toContainText('4/4/3/3');
    await page.locator('.template-grid .template-card', { hasText: 'Makalah' }).locator('button', { hasText: 'Duplikat' }).click();
    await expect(page.locator('.template-grid')).toContainText('Makalah (salinan)');
  });

  test('pengaturan: ubah profil dan ubah password', async ({ page }) => {
    await page.goto('/app/settings.html');
    await page.locator('#profile-name').fill('Uji Coba Baru');
    await page.locator('#profile-save-btn').click();
    await expect(page.locator('#profile-alert')).toContainText('Profil tersimpan');
    await page.locator('#old-password').fill('password123');
    await page.locator('#new-password').fill('passwordbaru2');
    await page.locator('#new-password-confirm').fill('passwordbaru2');
    await page.locator('#change-password-btn').click();
    await expect(page.locator('#password-alert')).toContainText('Kata sandi diperbarui');
  });
});

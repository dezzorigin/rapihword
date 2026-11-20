// smoke.mjs — verifikasi folder repo (persis yang di-deploy ke Pages):
// file wajib ada + server lokal merespons halaman utama (200 + penanda).
// Hanya GET lokal.
import { existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

for (const f of [
  'index.html', 'login.html', 'register.html', 'forgot-password.html',
  'css/style.css', 'css/app.css',
  'js/auth.js', 'js/store.js', 'js/docx.js', 'js/app.js',
  'app/index.html', 'app/documents.html', 'app/documents/new.html',
  'app/writing.html', 'app/templates.html', 'app/settings.html',
  'vendor/jszip.min.js', 'og-image.png',
]) {
  if (!existsSync(join(ROOT, f))) failures.push(`${f} hilang`);
}
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

const PORT = 8393;
const srv = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = mkdtempSync(join(tmpdir(), 'rapimakalah-smoke-'));

async function check(path, needle, label) {
  const out = join(tmp, label.replace(/\W+/g, '_') + '.html');
  execFileSync('curl', ['-sS', '-o', out, '-w', '%{http_code}', `http://127.0.0.1:${PORT}${path}`], { stdio: 'pipe' });
  const body = readFileSync(out, 'utf-8');
  if (!body.includes(needle)) failures.push(`${path}: tidak mengandung ${label}`);
}

try {
  await wait(1500);
  await check('/', 'RapiMakalah', 'judul-landing');
  await check('/', 'Rapikan format makalah tanpa mengorbankan isinya', 'hero-landing');
  await check('/', 'og-image.png', 'og-image');
  await check('/login.html', 'Masuk ke RapiMakalah', 'judul-login');
  await check('/register.html', 'Buat akun gratis', 'judul-register');
  await check('/forgot-password.html', 'Atur ulang kata sandi', 'judul-forgot');
  await check('/app/', 'Dashboard', 'judul-dashboard');
  await check('/app/documents.html', 'Dokumen', 'judul-documents');
  await check('/app/documents/new.html', 'Dokumen baru', 'judul-documents-new');
  await check('/app/writing.html', 'Menulis', 'judul-writing');
  await check('/app/templates.html', 'Template', 'judul-templates');
  await check('/app/settings.html', 'Pengaturan', 'judul-settings');
  await check('/css/style.css', '--brand', 'token-palet');
  await check('/js/docx.js', 'applyFormat', 'fungsi-format');
  await check('/js/docx.js', 'buildDocxFromText', 'fungsi-tempel-teks');
  await check('/vendor/jszip.min.js', 'JSZip v3.10.1', 'jszip-vendored');
} finally {
  srv.kill();
}

if (failures.length > 0) {
  console.error('smoke GAGAL:');
  for (const m of failures) console.error(` - ${m}`);
  process.exit(1);
}
console.log('smoke OK');

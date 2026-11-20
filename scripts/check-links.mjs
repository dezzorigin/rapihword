// check-links.mjs — pemeriksaan statis (tanpa browser):
//   1. Tautan file lokal di README.md + CHANGELOG.md + DESIGN.md benar-benar ada.
//   2. Tautan lokal (href/src) di semua .html ada di disk.
//   3. File wajib ada.
// Keluar 1 bila ada satu saja temuan.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const fail = (msg) => failures.push(msg);

const mdFiles = ['README.md', 'CHANGELOG.md', 'DESIGN.md'];
for (const rel of mdFiles) {
  if (!existsSync(join(ROOT, rel))) continue;
  const content = readFileSync(join(ROOT, rel), 'utf-8');
  for (const m of content.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|#|data:)/.test(ref)) continue;
    const clean = ref.split(/[?#]/)[0];
    if (!clean) continue;
    const target = clean.startsWith('/')
      ? join(ROOT, clean.slice(1))
      : join(ROOT, dirname(rel), clean);
    if (!existsSync(target)) fail(`${rel}: tautan lokal hilang: ${ref}`);
  }
}

function walkHtml(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'test-results', 'playwright-report', '.git'].includes(e.name)) out.push(...walkHtml(p));
    } else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
for (const file of walkHtml(ROOT)) {
  const rel = file.slice(ROOT.length + 1);
  const html = readFileSync(file, 'utf-8');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|#|data:)/.test(ref)) continue;
    const clean = ref.split(/[?#]/)[0];
    if (!clean) continue;
    const base = dirname(rel) === '.' ? ROOT : join(ROOT, dirname(rel));
    // href root-relative (/app/...) -> dari ROOT; relatif -> dari direktori file.
    const target = clean.startsWith('/') ? join(ROOT, clean.slice(1)) : join(base, clean);
    if (!existsSync(target)) {
      fail(`${rel}: aset lokal hilang: ${ref}`);
    }
  }
}

for (const f of [
  'LICENSE', 'README.md', 'CHANGELOG.md', 'DESIGN.md',
  'index.html', 'login.html', 'register.html', 'forgot-password.html',
  'css/style.css', 'css/app.css',
  'js/auth.js', 'js/store.js', 'js/docx.js', 'js/app.js', 'js/landing.js', 'js/toast.js',
  'app/index.html', 'app/documents.html', 'app/documents/new.html',
  'app/writing.html', 'app/templates.html', 'app/settings.html',
  'vendor/jszip.min.js', 'og-image.png',
  'package.json', 'playwright.config.js', 'e2e/app.spec.js',
]) {
  if (!existsSync(join(ROOT, f))) fail(`file wajib hilang: ${f}`);
}

if (failures.length > 0) {
  console.error('check-links GAGAL:');
  for (const m of failures) console.error(` - ${m}`);
  process.exit(1);
}
console.log('check-links OK');

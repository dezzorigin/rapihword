// check-static.mjs — gate anti-slop P0 + penjaga kebersihan repo, dipakai
// `npm run validate` dan job `static-checks` di CI:
//   1. Tanpa gradient ungu/biru, tanpa headline gradient, tanpa font Inter /
//      Roboto / system font untuk semuanya, tanpa rounded-2xl/3xl +
//      shadow-lg di UI.
//   2. Tanpa emoji mentah sebagai ikon fungsi.
//   3. Tanpa file .env yang ter-commit; tanpa secret kasar (sk-/ghp_/token).
//   4. Tanpa sisa file uji lokal (test-engine.html, test-*.docx, run-engine-test.mjs).
// Keluar 1 bila ada satu saja temuan.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const failures = [];
const fail = (msg) => failures.push(msg);

const SRC_FILES = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'test-results', 'playwright-report'].includes(e.name)) walk(p);
    } else if (/\.(html|css|js|mjs)$/.test(e.name) && p !== SELF) {
      SRC_FILES.push(p);
    }
  }
};
walk(ROOT);

const P0_CHECKS = [
  [/linear-gradient\([^)]*(violet|purple|indigo|blue|#6366f1|#818cf8|#7d2ae8|#00c4cc)/i, 'gradient ungu/biru'],
  [/bg-clip-text/, 'headline gradient (bg-clip-text)'],
  [/\bfont-family:[^;]*\bInter\b/, 'font Inter'],
  [/\bfont-family:[^;]*\bRoboto\b/, 'font Roboto'],
  [/rounded-2xl|rounded-3xl/, 'rounded-2xl/3xl (radius template)'],
  [/shadow-lg|shadow-2xl/, 'shadow-lg/2xl di permukaan'],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'emoji mentah (kemungkinan ikon fungsi)'],
];
for (const file of SRC_FILES) {
  const raw = readFileSync(file, 'utf-8');
  const rel = file.slice(ROOT.length + 1);
  // Gate P0 menilai KODE, bukan komentar: buang komentar blok (/* */) dan
  // komentar baris (// ...) sebelum dicocokkan — kalau tidak, header yang
  // menyebut nama pola yang dilarang ikut tertangkap (false positive).
  const content = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  // Emoji diizinkan di string teks non-ikon? Tidak — P0 melarang semua emoji mentah.
  for (const [re, label] of P0_CHECKS) {
    if (re.test(content)) fail(`${rel}: ${label}`);
  }
  // Secret kasar
  if (/(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})/.test(content)) {
    fail(`${rel}: kemungkinan secret ter-commit`);
  }
}

for (const f of ['.env', '.env.local', 'test-engine.html', 'test-fixture.docx', 'test-formatted.docx', 'test-fromtext.docx', 'run-engine-test.mjs']) {
  if (existsSync(join(ROOT, f))) fail(`file tidak boleh ada di repo: ${f}`);
}

if (failures.length > 0) {
  console.error('check-static GAGAL:');
  for (const m of failures) console.error(` - ${m}`);
  process.exit(1);
}
console.log('check-static OK');

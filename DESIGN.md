# DESIGN.md — RapiMakalah (clone rapimakalah.my.id)

## Referensi
- **Sumber utama: situs live rapimakalah.my.id** (diobservasi 20 Nov 2026 via
  fetch teks + CSS bundle `/assets/index-DMEJk6Ty.css`): SPA React, palet
  slate + biru solid `#2563EB`, font Inter + JetBrains Mono, hero "Rapikan
  format makalah tanpa mengorbankan isinya.", kartu preview dokumen dengan
  chip temuan "Spasi baris 1,0 · seharusnya 1,5", alur 4 langkah, panduan
  4 kartu, CTA akhir.
- **Peta interior** `~/workspace/rapimakalah-clone/map.md` (19 Nov 2026,
  via browser, akun kosong): route publik + app, copy asli, inkonsistensi
  margin template (teks 4-3-3-3 vs chip 3/3/3/4).
- **DRIFT CATATAN:** landing live 20 Nov SUDAH BERUBAH dari peta 19 Nov
  (hero lama "Rapi, sesuai format. Selesai dalam hitungan menit." + alur
  3 langkah + FAQ sudah tidak muncul di live; sekarang hero baru + alur
  4 langkah + seksi Panduan). Clone ini mengikuti **versi live 20 Nov**
  (sumber terkini), dengan FAQ + popup WhatsApp dipertahankan dari peta
  sebagai pelengkap (konten FAQ ditulis dari pernyataan asli situs).
  Kalau Nabil mau hero lama, itu satu pertanyaan terbuka di laporan PR.
- Referensi rasa kedua: pola "document tool" yang bersih (Linear/Notion
  docs) — bukan Dribbble generik; produknya alat dokumen, jadi tampilannya
  meja kerja kertas, bukan landing SaaS ramai.

## Palet (6 warna bernama, dari palet asli situs — Tailwind slate/blue)
- **Kertas** `#FFFFFF` — permukaan utama kartu/dokumen.
- **Meja** `#F8FAFC` — latar halaman (slate-50 asli).
- **Tinta** `#0F172A` — teks utama (slate-900 asli).
- **Brand** `#2563EB` — SATU aksen biru solid untuk tombol/link utama.
  Tanpa gradient (P0). Dipakai hemat: CTA + link aktif + fokus.
- **Stempel Hijau** `#047857` — status "Sesuai" (emerald-700 asli).
- **Stempel Merah** `#B91C1C` — status "Tidak sesuai" (red-700).
- **Amber** `#92400E` + latar `#FFFBEB` — status "Perlu diperiksa".
- **Garis** `#E2E8F0` — border (slate-200 asli).
- **WA** `#25D366` — hanya tombol popup WhatsApp (warna asli WhatsApp).
- Larangan yang dipatuhi: tanpa gradient ungu/biru, tanpa headline
  gradient, tanpa Inter/Roboto (lihat Tipografi), tanpa grid 3 kartu
  simetris identik, tanpa emoji sebagai ikon (SVG stroke 1.5px, inline).

## Tipografi (2 keluarga)
- **Tampil** — `Source Sans 3` (Google Fonts), 700 untuk heading.
  Mengganti Inter asli karena P0 melarang Inter; rasanya tetap sans
  bersih yang sama.
- **Data** — `JetBrains Mono`, untuk angka/stat, nama file, dan chip
  temuan (dipakai situs asli juga). `font-variant-numeric: tabular-nums`
  di semua angka.
- Font dokumen HASIL (bukan UI): Times New Roman 12 — itu isi .docx,
  bukan font UI.

## Layout (satu kalimat)
Meja kerja kertas: latar Meja, kartu putih ber-border tipis, satu garis
aturan merah tipis di tepi kiri kartu preview dokumen — seperti kertas
bermargin.

## Detail khas (signature)
1. **Chip temuan** — `Spasi baris 1,0 → seharusnya 1,5` sebagai motif
   berulang (hero, hasil analisis, daftar dokumen): nilai ditemukan,
   panah, nilai diharapkan.
2. **Stempel status** — chip "Sesuai / Perlu diperiksa / Tidak sesuai"
   bergaya stempel (border 1.5px, huruf kapital kecil, sudut 4px).
3. **Garis margin merah** — garis vertikal `#B91C1C` 2px di kiri preview
   dokumen, meniru margin kertas.

## Beda dari repo sebelumnya (magernulis)
Palet (slate/biru terang vs ungu Canva + dark studio), tipografi
(sans bersih vs tulisan tangan), layout (meja kertas terang vs kanvas
gelap), radius (8–10px vs pill), detail khas (chip temuan vs kertas
tulisan tangan).

## Aturan format (SATU angka konsisten — keputusan clone)
- Margin **4-4-3-3 cm** (atas 4, kiri 4, bawah 3, kanan 3) — sesuai
  deskripsi meta + judul panduan di landing live ("Margin Makalah
  4-4-3-3"). Inkonsistensi asli (teks template 4-3-3-3 vs chip 3/3/3/4)
  diseragamkan ke 4-4-3-3 di SEMUA tempat clone dan dicatat di README.
- A4 (21 × 29,7 cm), Times New Roman 12 pt, spasi 1,5, heading BAB,
  penomoran Romawi (i, ii, iii) untuk bagian awal → Arab (1, 2, 3)
  untuk isi, cover tanpa nomor, daftar isi berupa field TOC.

## Struktur file
- `/` landing, `/login.html`, `/register.html`, `/forgot-password.html`
- `/app/` dashboard, `/app/documents.html`, `/app/documents/new.html`,
  `/app/writing.html`, `/app/templates.html`, `/app/settings.html`
- `/css/style.css` (publik + shared), `/css/app.css` (shell app)
- `/js/auth.js` (auth demo localStorage), `/js/store.js` (dokumen +
  template + aktivitas), `/js/docx.js` (mesin DOCX: JSZip + OOXML),
  `/js/app.js` (shell app: sidebar, guard, toast), `/js/landing.js`
- `/vendor/jszip.min.js` (JSZip v3.10.1, sha256
  acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e)

## Gate 7 sumbu (target ≥4/5 tiap sumbu — dinilai saat verifikasi)
1. anti-slop purity | 2. UX speed & 1-to-3 | 3. tipografi | 4. spacing &
   geometri (grid 8pt, radius 8–10px, padding kartu ≥16px) | 5. motion
   (<200ms, ease-out) | 6. a11y (focus ring, aria-label, semantik) |
   7. mobile 390px (tanpa overflow horizontal, target sentuh ≥44px).

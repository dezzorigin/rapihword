# CHANGELOG — RapiMakalah

## [Unreleased]

### Added
- Clone statis rapimakalah.my.id (tanpa backend): landing, login, register,
  forgot-password, dan aplikasi /app (dashboard, dokumen, dokumen baru,
  menulis, template, pengaturan).
- Auth demo lokal via localStorage (daftar/masuk/keluar, ubah password,
  hapus akun, reset password 2 langkah). Kata sandi hanya disimpan sebagai
  hash SHA-256. Bukan auth produksi.
- Mesin format DOCX yang benar-benar jalan di browser (JSZip + manipulasi
  document.xml): validasi signature ZIP + struktur OOXML, analisis
  paragraf per paragraf (6 seksi temuan), terapkan format A4, margin
  4-4-3-3, Times New Roman 12, spasi 1,5, heading BAB, penomoran Romawi
  (awal) → Arab (isi, mulai 1), cover tanpa nomor (titlePg), daftar isi
  berupa field TOC, footer dengan field PAGE nyata. Tempel-teks juga bisa
  jadi .docx (cover + TOC + section break + heading).
- Perbaikan dari aslinya: /forgot-password di situs asli 404 — di clone
  ini menjadi halaman reset yang berfungsi (demo: kode tampil di layar).
- Margin diseragamkan ke **4-4-3-3 cm** di semua tempat (inkonsistensi
  asli: teks template 4-3-3-3 vs chip 3/3/3/4; landing live menyebut
  4-4-3-3 di meta description + judul panduan).
- README (penjelasan + cara jalan + screenshot asli + video demo),
  OG 9 tag + `og-image.png` 1200×630 dari halaman asli, CI 4 job
  (static-checks, advisory-sweep, playwright-e2e, smoke).
- E2E Playwright 14 tes × desktop (1440×900) + mobile (390×844):
  landing, auth demo, lupa password, upload → analisis 6 temuan →
  format → unduh, tempel-teks → .docx, menulis, template, pengaturan.

### Fixed
- Topbar aplikasi mobile: tombol akun (Keluar) terdorong keluar layar
  (x=426 di viewport 390px) karena tombol Upload/Template ikut di baris
  yang sama — topbar kini membungkus 2 baris, menu akun tetap di baris 1.
- Judul + nama file dokumen menempel tanpa pemisah di dashboard dan daftar
  dokumen (`.doc-meta` kini kolom); label + deskripsi langkah pipeline
  menempel ("ValidasiPeriksa") — kini dua baris.
- Tombol "Mulai Gratis" di topbar landing mobile pecah jadi 2 baris —
  `.btn` kini `white-space: nowrap`.
- `scripts/check-links.mjs`: href root-relative (`/app/...`) kini
  diselesaikan dari root repo (sebelumnya salah jadi `app/app/...`).
- `scripts/check-static.mjs`: tidak lagi menandai dirinya sendiri dan
  komentar CSS yang menyebut pola terlarang (false positive).

### Notes
- Landing mengikuti versi live 20 Nov 2026 (hero "Rapikan format makalah
  tanpa mengorbankan isinya.", alur 4 langkah, seksi Panduan). Peta 19 Nov
  mencatat hero lama ("Rapi, sesuai format. Selesai dalam hitungan
  menit.", alur 3 langkah, FAQ) — hero lama sudah tidak muncul di live.
- Preview bersifat struktural; pagination dan nomor halaman TOC harus
  di-refresh di Microsoft Word (sesuai pernyataan situs asli).
- File dokumen hanya dipegang di memori tab (localStorage tidak muat file
  besar) — unduh hasil sebelum menutup tab.

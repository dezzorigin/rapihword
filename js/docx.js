/* RapihWord — mesin format DOCX (berjalan penuh di browser).
   Memakai JSZip (vendored) + DOMParser untuk memodifikasi OOXML asli:
   file .docx pengguna TIDAK dibangun ulang — document.xml-nya diubah
   langsung, isi/tabel/gambar/hyperlink dipertahankan.
   Aturan: A4, margin 4-4-3-3 cm, Times New Roman 12 pt, spasi 1,5,
   heading BAB, penomoran Romawi (awal) -> Arab (isi), daftar isi field TOC.
   Catatan jujur (sesuai situs asli): preview bersifat struktural;
   pagination dan nomor halaman TOC harus di-refresh di Microsoft Word. */
(function () {
  'use strict';
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';

  const RULES = {
    page: 'A4',
    pgSz: { w: 11906, h: 16838 },          // A4 dalam twips (1/20 pt)
    marginCm: { top: 4, left: 4, bottom: 3, right: 3 },
    pgMar: { top: 2268, left: 2268, bottom: 1701, right: 1701, header: 720, footer: 720, gutter: 0 },
    font: 'Times New Roman',
    sizePt: 12,
    sizeHalfPt: 24,
    lineSpacing: 1.5,
    lineVal: 360,                            // 1.5 x 240
    heading1: { sizePt: 14, sizeHalfPt: 28, bold: true },
    heading2: { sizePt: 12, sizeHalfPt: 24, bold: true },
  };
  const CM_TWIPS = 567; // 1 cm = 567 twips

  function el(doc, tag, attrs) {
    const e = doc.createElementNS(W, 'w:' + tag);
    if (attrs) for (const k of Object.keys(attrs)) e.setAttribute('w:' + k, String(attrs[k]));
    return e;
  }
  function relEl(doc, tag, attrs) {
    const e = doc.createElementNS(R, 'r:' + tag);
    if (attrs) for (const k of Object.keys(attrs)) e.setAttribute('r:' + k, String(attrs[k]));
    return e;
  }
  function textEl(doc, tag, text) {
    const e = doc.createElementNS(W, 'w:' + tag);
    e.textContent = text;
    return e;
  }
  function q(doc, tag) { return Array.from(doc.getElementsByTagNameNS(W, tag)); }
  function child(node, tag) {
    if (!node) return null;
    for (let i = 0; i < node.childNodes.length; i++) {
      const c = node.childNodes[i];
      if (c.nodeType === 1 && c.namespaceURI === W && c.localName === tag) return c;
    }
    return null;
  }
  function ensureChild(doc, node, tag) {
    let c = child(node, tag);
    if (!c) { c = el(doc, tag); node.appendChild(c); }
    return c;
  }
  function attr(node, name) { return node ? node.getAttribute('w:' + name) : null; }
  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML tidak valid');
    return doc;
  }
  function serialize(doc) { return new XMLSerializer().serializeToString(doc); }

  // ---------- Validasi ----------
  async function validateDocx(buf) {
    const errors = [];
    const bytes = new Uint8Array(buf);
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
      return { ok: false, errors: ['File bukan arsip ZIP (.docx). Tanda tangan file tidak cocok — file .doc lama atau PDF tidak bisa diproses.'] };
    }
    let zip;
    try { zip = await JSZip.loadAsync(buf); }
    catch (e) { return { ok: false, errors: ['Arsip ZIP rusak dan tidak bisa dibuka.'] }; }
    if (!zip.file('[Content_Types].xml')) errors.push('Struktur OOXML tidak lengkap: [Content_Types].xml tidak ditemukan.');
    if (!zip.file('word/document.xml')) errors.push('Struktur OOXML tidak lengkap: word/document.xml tidak ditemukan.');
    if (zip.file('word/document.xml')) {
      try { parseXml(await zip.file('word/document.xml').async('string')); }
      catch (e) { errors.push('word/document.xml rusak (XML tidak valid).'); }
    }
    return { ok: errors.length === 0, errors };
  }

  // ---------- Parsing ----------
  async function parseDocx(buf) {
    const zip = await JSZip.loadAsync(buf);
    const xmlText = await zip.file('word/document.xml').async('string');
    const doc = parseXml(xmlText);
    const stylesText = zip.file('word/styles.xml') ? await zip.file('word/styles.xml').async('string') : null;
    const stylesDoc = stylesText ? parseXml(stylesText) : null;
    const body = child(doc.documentElement, 'body');
    const paras = q(doc, 'p');
    const paragraphs = paras.map((p, index) => {
      const pPr = child(p, 'pPr');
      const pStyle = pPr ? attr(child(pPr, 'pStyle'), 'val') : null;
      const jc = pPr ? attr(child(pPr, 'jc'), 'val') : null;
      const spacing = pPr ? child(pPr, 'spacing') : null;
      const ind = pPr ? child(pPr, 'ind') : null;
      const runs = q(p, 'r').map(r => {
        const rPr = child(r, 'rPr');
        const rFonts = rPr ? child(rPr, 'rFonts') : null;
        const sz = rPr ? child(rPr, 'sz') : null;
        let text = '';
        q(r, 't').forEach(t => { text += t.textContent; });
        return {
          text,
          font: rFonts ? (attr(rFonts, 'ascii') || attr(rFonts, 'hAnsi')) : null,
          sizeHalfPt: sz ? parseInt(attr(sz, 'val') || '0', 10) : null,
          bold: !!(rPr && child(rPr, 'b')),
          italic: !!(rPr && child(rPr, 'i')),
        };
      });
      const text = runs.map(r => r.text).join('');
      return {
        index, node: p, text, pStyle, align: jc,
        line: spacing ? (spacing.getAttribute('w:line') ? parseInt(spacing.getAttribute('w:line'), 10) : null) : null,
        lineRule: spacing ? spacing.getAttribute('w:lineRule') : null,
        indentLeft: ind ? parseInt(ind.getAttribute('w:left') || '0', 10) : 0,
        runs,
      };
    });
    const sectPr = body ? child(body, 'sectPr') : null;
    let pgSz = null, pgMar = null, pgNumType = null, titlePg = false;
    if (sectPr) {
      const sz = child(sectPr, 'pgSz');
      if (sz) pgSz = { w: parseInt(attr(sz, 'w') || '0', 10), h: parseInt(attr(sz, 'h') || '0', 10) };
      const mar = child(sectPr, 'pgMar');
      if (mar) pgMar = {
        top: parseInt(attr(mar, 'top') || '0', 10), left: parseInt(attr(mar, 'left') || '0', 10),
        bottom: parseInt(attr(mar, 'bottom') || '0', 10), right: parseInt(attr(mar, 'right') || '0', 10),
      };
      const num = child(sectPr, 'pgNumType');
      if (num) pgNumType = { fmt: attr(num, 'fmt'), start: attr(num, 'start') };
      titlePg = !!child(sectPr, 'titlePg');
    }
    const hasToc = /TOC/i.test(xmlText);
    const babCount = paragraphs.filter(p => /^BAB\s+([IVXLCDM]+|\d+)/i.test(p.text.trim())).length;
    // Semua section (sectPr di body + di paragraph break) untuk analisis penomoran.
    const sectPrs = q(doc, 'sectPr').map(sp => {
      const num = child(sp, 'pgNumType');
      return { fmt: num ? attr(num, 'fmt') : null, start: num ? attr(num, 'start') : null, titlePg: !!child(sp, 'titlePg') };
    });
    return { zip, doc, body, paragraphs, sectPr, pgSz, pgMar, pgNumType, titlePg, hasToc, stylesDoc, babCount, sectPrs };
  }

  function isBab(text) { return /^BAB\s+([IVXLCDM]+|\d+)\b/i.test(text.trim()); }
  function isSubBab(text) { return /^\d+\.\d+\s+\S/.test(text.trim()); }
  function isFrontHeading(text) {
    return /^(KATA PENGANTAR|DAFTAR ISI|DAFTAR PUSTAKA|DAFTAR GAMBAR|DAFTAR TABEL|LAMPIRAN|ABSTRAK|ABSTRACT)\b/i.test(text.trim());
  }
  function estimatePages(paragraphs) {
    // Estimasi saja: ~26 baris efektif per halaman A4 (TNR 12, spasi 1,5).
    const lines = paragraphs.reduce((n, p) => n + Math.max(1, Math.ceil(p.text.length / 78)), 0);
    return Math.max(1, Math.ceil(lines / 26));
  }

  // ---------- Analisis ----------
  function analyzeDocx(parsed) {
    const findings = [];
    const paras = parsed.paragraphs.filter(p => p.text.trim().length > 0);
    const bodyParas = paras.filter(p => !isBab(p.text) && !isSubBab(p.text) && !isFrontHeading(p.text));

    // 1. Kertas & margin
    const pgOk = parsed.pgSz && parsed.pgSz.w === RULES.pgSz.w && parsed.pgSz.h === RULES.pgSz.h;
    const m = parsed.pgMar;
    const marOk = m && m.top === RULES.pgMar.top && m.left === RULES.pgMar.left &&
      m.bottom === RULES.pgMar.bottom && m.right === RULES.pgMar.right;
    const marFound = m
      ? `atas ${Math.round(m.top / CM_TWIPS)} / kiri ${Math.round(m.left / CM_TWIPS)} / bawah ${Math.round(m.bottom / CM_TWIPS)} / kanan ${Math.round(m.right / CM_TWIPS)} cm`
      : 'tidak ada pengaturan margin (sectPr kosong)';
    findings.push({
      section: 'Kertas & margin', title: 'Ukuran kertas A4 dan margin 4-4-3-3',
      status: pgOk && marOk ? 'ok' : (m ? 'bad' : 'warn'),
      found: `${pgOk ? 'A4' : 'bukan A4'} · ${marFound}`,
      expected: 'A4 (21 × 29,7 cm) · margin atas 4 / kiri 4 / bawah 3 / kanan 3 cm',
      detail: 'Margin diatur di Section Properties (sectPr > pgMar).',
    });

    // 2. Font & ukuran
    let fontRuns = 0, fontOkRuns = 0, sizeOkRuns = 0;
    bodyParas.forEach(p => p.runs.forEach(r => {
      if (!r.text.trim()) return;
      fontRuns++;
      if (r.font === RULES.font) fontOkRuns++;
      if (r.sizeHalfPt === RULES.sizeHalfPt) sizeOkRuns++;
    }));
    const fontPct = fontRuns ? Math.round((fontOkRuns / fontRuns) * 100) : 100;
    const sizePct = fontRuns ? Math.round((sizeOkRuns / fontRuns) * 100) : 100;
    findings.push({
      section: 'Font & ukuran', title: 'Times New Roman 12 pt di seluruh isi',
      status: fontPct === 100 && sizePct === 100 ? 'ok' : (fontPct < 50 || sizePct < 50 ? 'bad' : 'warn'),
      found: `${fontPct}% run memakai Times New Roman · ${sizePct}% berukuran 12 pt (${fontOkRuns}/${fontRuns} run)`,
      expected: '100% run Times New Roman 12 pt',
      detail: 'Font diterapkan per run (w:rFonts + w:sz).',
    });

    // 3. Spasi baris
    let spCount = 0, spOk = 0;
    bodyParas.forEach(p => {
      if (p.line != null) { spCount++; if (p.line === RULES.lineVal && p.lineRule !== 'exact') spOk++; }
    });
    const spPct = spCount ? Math.round((spOk / spCount) * 100) : 0;
    findings.push({
      section: 'Spasi baris', title: 'Spasi baris 1,5',
      status: spCount === 0 ? 'warn' : (spPct === 100 ? 'ok' : (spPct < 50 ? 'bad' : 'warn')),
      found: spCount === 0 ? 'tidak ada paragraf yang menyatakan spasi eksplisit' : `${spPct}% paragraf berspasi 1,5 (${spOk}/${spCount})`,
      expected: 'Spasi 1,5 (w:line 360, lineRule auto) di semua paragraf isi',
      detail: 'Paragraf tanpa atribut spasi memakai default style — akan diseragamkan.',
    });

    // 4. Heading & struktur
    const babParas = paras.filter(p => isBab(p.text));
    const babStyled = babParas.filter(p => p.pStyle === 'Heading1' || p.pStyle === 'Heading2').length;
    findings.push({
      section: 'Heading & struktur', title: 'Judul BAB memakai style Heading 1',
      status: babParas.length === 0 ? 'bad' : (babStyled === babParas.length ? 'ok' : 'warn'),
      found: babParas.length === 0
        ? 'tidak ada paragraf berpola "BAB ..." ditemukan'
        : `${babStyled}/${babParas.length} judul BAB sudah memakai style Heading`,
      expected: 'Setiap "BAB I/II/..." memakai Heading 1 (outline level 0)',
      detail: 'Heading dari style + outline level dipakai daftar isi otomatis.',
    });

    // 5. Penomoran halaman
    const sects = parsed.sectPrs || [];
    const hasRoman = sects.some(s => s.fmt === 'lowerRoman');
    const hasDecimal = sects.some(s => s.fmt === 'decimal' && s.start === '1');
    const hasTitlePg = sects.some(s => s.titlePg);
    const numStatus = hasRoman && hasDecimal && hasTitlePg ? 'ok' : (sects.length === 0 ? 'warn' : 'warn');
    const numFound = sects.length === 0
      ? 'tidak ada pgNumType (nomor halaman tidak diatur di sectPr)'
      : sects.map((s, i) => `section ${i + 1}: ${s.fmt || '(tanpa format)'}${s.start ? ` mulai ${s.start}` : ''}${s.titlePg ? ' + titlePg' : ''}`).join(' · ');
    findings.push({
      section: 'Penomoran halaman', title: 'Romawi di awal, Arab di isi, cover tanpa nomor',
      status: numStatus,
      found: numFound,
      expected: 'Section awal: Romawi kecil (i, ii, iii) + titlePg; section isi: Arab mulai 1',
      detail: 'Dibuat sebagai section break + field PAGE di footer.',
    });

    // 6. Daftar isi
    findings.push({
      section: 'Daftar isi', title: 'Daftar isi berupa field TOC',
      status: parsed.hasToc ? 'ok' : 'bad',
      found: parsed.hasToc ? 'field TOC ditemukan di dokumen' : 'tidak ada field TOC',
      expected: 'Field TOC (\\o "1-3") setelah halaman judul — diperbarui di Word',
      detail: 'TOC disisipkan sebagai field; nomor halaman diisi Word saat Update Field.',
    });

    const counts = {
      ok: findings.filter(f => f.status === 'ok').length,
      warn: findings.filter(f => f.status === 'warn').length,
      bad: findings.filter(f => f.status === 'bad').length,
    };
    return { findings, counts, pages: estimatePages(paras), paragraphs: paras.length, babCount: parsed.babCount };
  }

  // ---------- Penerapan format ----------
  function ensurePPr(doc, p) {
    let pPr = child(p, 'pPr');
    if (!pPr) { pPr = el(doc, 'pPr'); p.insertBefore(pPr, p.firstChild); }
    return pPr;
  }
  function setSpacing(doc, pPr, { line, before, after }) {
    let sp = child(pPr, 'spacing');
    if (!sp) { sp = el(doc, 'spacing'); pPr.appendChild(sp); }
    if (line != null) { sp.setAttribute('w:line', String(line)); sp.setAttribute('w:lineRule', 'auto'); }
    if (before != null) sp.setAttribute('w:before', String(before));
    if (after != null) sp.setAttribute('w:after', String(after));
  }
  function setRunFont(doc, r, { font, sizeHalfPt, bold }) {
    let rPr = child(r, 'rPr');
    if (!rPr) { rPr = el(doc, 'rPr'); r.insertBefore(rPr, r.firstChild); }
    let rf = child(rPr, 'rFonts');
    if (!rf) { rf = el(doc, 'rFonts'); rPr.appendChild(rf); }
    if (font) { rf.setAttribute('w:ascii', font); rf.setAttribute('w:hAnsi', font); rf.setAttribute('w:cs', font); }
    if (sizeHalfPt != null) {
      let sz = child(rPr, 'sz');
      if (!sz) { sz = el(doc, 'sz'); rPr.appendChild(sz); }
      sz.setAttribute('w:val', String(sizeHalfPt));
      let szCs = child(rPr, 'szCs');
      if (!szCs) { szCs = el(doc, 'szCs'); rPr.appendChild(szCs); }
      szCs.setAttribute('w:val', String(sizeHalfPt));
    }
    if (bold === true && !child(rPr, 'b')) rPr.appendChild(el(doc, 'b'));
    if (bold === false) { const b = child(rPr, 'b'); if (b) rPr.removeChild(b); }
  }
  function setPStyle(doc, p, style) {
    const pPr = ensurePPr(doc, p);
    let ps = child(pPr, 'pStyle');
    if (!ps) { ps = el(doc, 'pStyle'); pPr.insertBefore(ps, pPr.firstChild); }
    ps.setAttribute('w:val', style);
  }
  function setAlign(doc, p, val) {
    const pPr = ensurePPr(doc, p);
    let jc = child(pPr, 'jc');
    if (!jc) { jc = el(doc, 'jc'); pPr.appendChild(jc); }
    jc.setAttribute('w:val', val);
  }
  function setOutlineLvl(doc, p, lvl) {
    const pPr = ensurePPr(doc, p);
    let ol = child(pPr, 'outlineLvl');
    if (!ol) { ol = el(doc, 'outlineLvl'); pPr.appendChild(ol); }
    ol.setAttribute('w:val', String(lvl));
  }
  function setKeepNext(doc, p) {
    const pPr = ensurePPr(doc, p);
    if (!child(pPr, 'keepNext')) pPr.appendChild(el(doc, 'keepNext'));
  }

  function buildFooterXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>' +
      '<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr>' +
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r><w:t>1</w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';
  }

  function tocFieldParagraph(doc) {
    const p = el(doc, 'p');
    const pPr = el(doc, 'pPr');
    const ps = el(doc, 'pStyle'); ps.setAttribute('w:val', 'TOCHeading');
    pPr.appendChild(ps);
    p.appendChild(pPr);
    const mkRun = (fn) => { const r = el(doc, 'r'); fn(r); p.appendChild(r); return r; };
    mkRun(r => { const f = el(doc, 'fldChar'); f.setAttribute('w:fldCharType', 'begin'); r.appendChild(f); });
    mkRun(r => {
      const it = doc.createElementNS(W, 'w:instrText');
      it.setAttribute('xml:space', 'preserve');
      it.textContent = ' TOC \\o "1-3" \\h \\z \\u ';
      r.appendChild(it);
    });
    mkRun(r => { const f = el(doc, 'fldChar'); f.setAttribute('w:fldCharType', 'separate'); r.appendChild(f); });
    mkRun(r => {
      const t = textEl(doc, 't', 'Daftar isi — klik kanan lalu “Update Field” di Microsoft Word untuk mengisi nomor halaman.');
      r.appendChild(t);
    });
    mkRun(r => { const f = el(doc, 'fldChar'); f.setAttribute('w:fldCharType', 'end'); r.appendChild(f); });
    return p;
  }

  function headingParagraph(doc, text, level) {
    const p = el(doc, 'p');
    const pPr = el(doc, 'pPr');
    const ps = el(doc, 'pStyle'); ps.setAttribute('w:val', level === 1 ? 'Heading1' : 'Heading2');
    pPr.appendChild(ps);
    const ol = el(doc, 'outlineLvl'); ol.setAttribute('w:val', String(level - 1));
    pPr.appendChild(ol);
    p.appendChild(pPr);
    const r = el(doc, 'r');
    const rPr = el(doc, 'rPr');
    const rf = el(doc, 'rFonts');
    rf.setAttribute('w:ascii', RULES.font); rf.setAttribute('w:hAnsi', RULES.font); rf.setAttribute('w:cs', RULES.font);
    rPr.appendChild(rf);
    const sz = el(doc, 'sz'); sz.setAttribute('w:val', String(level === 1 ? RULES.heading1.sizeHalfPt : RULES.heading2.sizeHalfPt));
    rPr.appendChild(sz);
    rPr.appendChild(el(doc, 'b'));
    r.appendChild(rPr);
    r.appendChild(textEl(doc, 't', text));
    p.appendChild(r);
    return p;
  }

  // Judul BAB sering ditulis dua baris ("BAB I" lalu "PENDAHULUAN"): gabungkan
  // baris kedua (kapital semua, pendek) ke dalam paragraf BAB yang sama.
  function mergeBabTitles(doc) {
    const paras = q(doc, 'p');
    for (let i = 0; i < paras.length - 1; i++) {
      const t = (paras[i].textContent || '').trim();
      if (!isBab(t)) continue;
      const next = paras[i + 1];
      const nt = (next.textContent || '').trim();
      if (/^[A-Z][A-Z\s'’\-]{2,50}$/.test(nt) && !isFrontHeading(nt) && !isBab(nt)) {
        const runs = q(paras[i], 'r');
        const target = runs.length ? runs[runs.length - 1] : null;
        if (target) {
          const br = el(doc, 'br');
          target.appendChild(br);
          // Spasi di depan menjaga textContent "BAB I PENDAHULUAN" (tanpa
          // spasi, textContent jadi "BAB IPENDAHULUAN" dan deteksi BAB gagal).
          // Word menormalisasi spasi awal baris ini, jadi tampilannya tetap
          // "PENDAHULUAN" di baris kedua.
          const tt = textEl(doc, 't', ' ' + nt);
          target.appendChild(tt);
        }
        next.parentNode.removeChild(next);
        paras.splice(i + 1, 1);
      }
    }
  }

  async function applyFormat(buf, opts) {
    opts = opts || {};
    const zip = await JSZip.loadAsync(buf);
    const doc = parseXml(await zip.file('word/document.xml').async('string'));
    const body = child(doc.documentElement, 'body');
    mergeBabTitles(doc);
    const paras = q(doc, 'p');

    // --- 1. Bagi dokumen: bagian awal (sebelum BAB pertama) vs isi ---
    let firstBabIdx = -1;
    paras.forEach((p, i) => {
      const t = (p.textContent || '').trim();
      if (firstBabIdx < 0 && isBab(t)) firstBabIdx = i;
    });
    const hasFront = firstBabIdx > 0;

    // --- 2. Section break sebelum BAB pertama (section awal = Romawi) ---
    if (hasFront) {
      const breakP = el(doc, 'p');
      const pPr = el(doc, 'pPr');
      const sectPr = el(doc, 'sectPr');
      const pgSz = el(doc, 'pgSz');
      pgSz.setAttribute('w:w', String(RULES.pgSz.w)); pgSz.setAttribute('w:h', String(RULES.pgSz.h));
      sectPr.appendChild(pgSz);
      const pgMar = el(doc, 'pgMar');
      ['top', 'left', 'bottom', 'right', 'header', 'footer', 'gutter'].forEach(k =>
        pgMar.setAttribute('w:' + k, String(RULES.pgMar[k])));
      sectPr.appendChild(pgMar);
      const num = el(doc, 'pgNumType'); num.setAttribute('w:fmt', 'lowerRoman');
      sectPr.appendChild(num);
      sectPr.appendChild(el(doc, 'titlePg'));
      pPr.appendChild(sectPr);
      breakP.appendChild(pPr);
      body.insertBefore(breakP, paras[firstBabIdx]);
    }

    // --- 3. sectPr akhir dokumen (section isi = Arab mulai 1) ---
    let endSect = child(body, 'sectPr');
    if (!endSect) { endSect = el(doc, 'sectPr'); body.appendChild(endSect); }
    let pgSz = child(endSect, 'pgSz');
    if (!pgSz) { pgSz = el(doc, 'pgSz'); endSect.appendChild(pgSz); }
    pgSz.setAttribute('w:w', String(RULES.pgSz.w)); pgSz.setAttribute('w:h', String(RULES.pgSz.h));
    pgSz.setAttribute('w:orient', 'portrait');
    let pgMar = child(endSect, 'pgMar');
    if (!pgMar) { pgMar = el(doc, 'pgMar'); endSect.appendChild(pgMar); }
    ['top', 'left', 'bottom', 'right', 'header', 'footer', 'gutter'].forEach(k =>
      pgMar.setAttribute('w:' + k, String(RULES.pgMar[k])));
    let num = child(endSect, 'pgNumType');
    if (!num) { num = el(doc, 'pgNumType'); endSect.appendChild(num); }
    num.setAttribute('w:fmt', hasFront ? 'decimal' : 'lowerRoman');
    if (hasFront) num.setAttribute('w:start', '1');
    if (!child(endSect, 'titlePg') && !hasFront) endSect.appendChild(el(doc, 'titlePg'));

    // --- 4. Footer dengan field PAGE (footer1 = awal, footer2 = isi) ---
    const relsName = 'word/_rels/document.xml.rels';
    let relsDoc = null;
    if (zip.file(relsName)) relsDoc = parseXml(await zip.file(relsName).async('string'));
    else {
      relsDoc = parseXml('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
    }
    const relsRoot = relsDoc.documentElement;
    const existingIds = Array.from(relsRoot.childNodes)
      .filter(n => n.nodeType === 1)
      .map(n => n.getAttribute('Id') || '')
      .filter(id => /^rId\d+$/.test(id))
      .map(id => parseInt(id.slice(3), 10));
    let nextRid = (existingIds.length ? Math.max.apply(null, existingIds) : 0) + 1;
    const footerType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer';
    function addFooterRel(target) {
      const id = 'rId' + (nextRid++);
      const rel = relsDoc.createElementNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship');
      rel.setAttribute('Id', id);
      rel.setAttribute('Type', footerType);
      rel.setAttribute('Target', target);
      relsRoot.appendChild(rel);
      return id;
    }
    zip.file('word/footer1.xml', buildFooterXml());
    zip.file('word/footer2.xml', buildFooterXml());
    const ridF1 = addFooterRel('footer1.xml');
    const ridF2 = addFooterRel('footer2.xml');
    zip.file(relsName, serialize(relsDoc));
    // Content_Types overrides untuk footer
    let ctDoc;
    if (zip.file('[Content_Types].xml')) ctDoc = parseXml(await zip.file('[Content_Types].xml').async('string'));
    else ctDoc = parseXml('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
    const ctRoot = ctDoc.documentElement;
    const CTNS = 'http://schemas.openxmlformats.org/package/2006/content-types';
    ['footer1.xml', 'footer2.xml'].forEach(fn => {
      const part = '/word/' + fn;
      const exists = Array.from(ctRoot.childNodes).some(n =>
        n.nodeType === 1 && n.localName === 'Override' && n.getAttribute('PartName') === part);
      if (!exists) {
        const ov = ctDoc.createElementNS(CTNS, 'Override');
        ov.setAttribute('PartName', part);
        ov.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml');
        ctRoot.appendChild(ov);
      }
    });
    zip.file('[Content_Types].xml', serialize(ctDoc));
    // Pasang footerReference di kedua sectPr
    function setFooterRef(sectPrNode, rid) {
      if (!sectPrNode) return;
      const old = Array.from(sectPrNode.childNodes).filter(n =>
        n.nodeType === 1 && n.localName === 'footerReference');
      old.forEach(n => sectPrNode.removeChild(n));
      const fr = doc.createElementNS(W, 'w:footerReference');
      fr.setAttribute('w:type', 'default');
      fr.setAttributeNS(R, 'r:id', rid);
      sectPrNode.appendChild(fr);
    }
    if (hasFront) {
      // sectPr bagian awal ada di paragraph break yang baru disisipkan
      const breakParas = q(doc, 'p').filter(p => child(child(p, 'pPr'), 'sectPr'));
      if (breakParas.length) setFooterRef(child(child(breakParas[breakParas.length - 1], 'pPr'), 'sectPr'), ridF1);
    }
    setFooterRef(endSect, ridF2);

    // --- 5. Format tiap paragraf ---
    const allParas = q(doc, 'p');
    allParas.forEach((p, i) => {
      const text = (p.textContent || '').trim();
      if (!text) return;
      const isBreak = !!child(child(p, 'pPr'), 'sectPr');
      if (isBreak) return;
      const inFront = hasFront && i < firstBabIdx + 1; // +1 karena breakP disisipkan
      if (isBab(text)) {
        setPStyle(doc, p, 'Heading1');
        setOutlineLvl(doc, p, 0);
        setKeepNext(doc, p);
        setSpacing(doc, ensurePPr(doc, p), { line: RULES.lineVal, before: 240, after: 120 });
        q(p, 'r').forEach(r => setRunFont(doc, r, { font: RULES.font, sizeHalfPt: RULES.heading1.sizeHalfPt, bold: true }));
        return;
      }
      if (isSubBab(text)) {
        setPStyle(doc, p, 'Heading2');
        setOutlineLvl(doc, p, 1);
        setKeepNext(doc, p);
        setSpacing(doc, ensurePPr(doc, p), { line: RULES.lineVal, before: 200, after: 100 });
        q(p, 'r').forEach(r => setRunFont(doc, r, { font: RULES.font, sizeHalfPt: RULES.heading2.sizeHalfPt, bold: true }));
        return;
      }
      if (isFrontHeading(text)) {
        setPStyle(doc, p, 'Heading1');
        setOutlineLvl(doc, p, 0);
        setKeepNext(doc, p);
        setSpacing(doc, ensurePPr(doc, p), { line: RULES.lineVal, before: 240, after: 120 });
        q(p, 'r').forEach(r => setRunFont(doc, r, { font: RULES.font, sizeHalfPt: RULES.heading1.sizeHalfPt, bold: true }));
        return;
      }
      // Paragraf isi
      if (!child(ensurePPr(doc, p), 'pStyle')) setPStyle(doc, p, 'Normal');
      setSpacing(doc, ensurePPr(doc, p), { line: RULES.lineVal, before: 0, after: 0 });
      q(p, 'r').forEach(r => setRunFont(doc, r, { font: RULES.font, sizeHalfPt: RULES.sizeHalfPt }));
      if (!inFront) {
        const pPr = ensurePPr(doc, p);
        const jc = child(pPr, 'jc');
        const cur = jc ? jc.getAttribute('w:val') : null;
        if (!cur || cur === 'both' || cur === 'left') setAlign(doc, p, 'both');
      }
    });

    // --- 6. Sisipkan field TOC (setelah "DAFTAR ISI" bila ada; kalau tidak, setelah cover) ---
    const tocExists = /TOC/i.test(serialize(doc));
    if (!tocExists) {
      const afterIdx = allParas.findIndex(p => /^DAFTAR ISI\b/i.test((p.textContent || '').trim()));
      if (afterIdx >= 0) {
        // Heading DAFTAR ISI sudah ada — sisipkan hanya field TOC sesudahnya.
        const anchor = allParas[afterIdx];
        anchor.parentNode.insertBefore(tocFieldParagraph(doc), anchor.nextSibling);
      } else if (allParas.length > 0) {
        const anchor = allParas[0];
        const tocHeading = headingParagraph(doc, 'DAFTAR ISI', 1);
        const tocField = tocFieldParagraph(doc);
        const parent = anchor.parentNode;
        parent.insertBefore(tocHeading, anchor.nextSibling);
        parent.insertBefore(tocField, tocHeading.nextSibling);
      }
    }

    // --- 7. styles.xml: default font/spasi + Heading1/Heading2 ---
    await applyStyles(zip, doc);

    zip.file('word/document.xml', serialize(doc));
    return zip.generateAsync({ type: 'arraybuffer' });
  }

  async function applyStyles(zip, doc) {
    let stylesDoc = null;
    if (zip.file('word/styles.xml')) {
      stylesDoc = parseXml(await zip.file('word/styles.xml').async('string'));
    } else {
      stylesDoc = parseXml('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:styles>');
    }
    const root = stylesDoc.documentElement;
    const SNS = W;
    function styleById(id) {
      return Array.from(root.childNodes).find(n =>
        n.nodeType === 1 && n.localName === 'style' && n.getAttribute('w:styleId') === id) || null;
    }
    function ensureStyle(id, type, name, build) {
      let st = styleById(id);
      if (!st) {
        st = stylesDoc.createElementNS(SNS, 'w:style');
        st.setAttribute('w:type', type);
        st.setAttribute('w:styleId', id);
        const nm = stylesDoc.createElementNS(SNS, 'w:name');
        nm.setAttribute('w:val', name);
        st.appendChild(nm);
        root.appendChild(st);
      }
      build(st);
      return st;
    }
    function setStyleRun(st, sizeHalfPt, bold, color) {
      let rPr = child(st, 'rPr');
      if (!rPr) { rPr = stylesDoc.createElementNS(SNS, 'w:rPr'); st.appendChild(rPr); }
      let rf = child(rPr, 'rFonts');
      if (!rf) { rf = stylesDoc.createElementNS(SNS, 'w:rFonts'); rPr.appendChild(rf); }
      rf.setAttribute('w:ascii', RULES.font); rf.setAttribute('w:hAnsi', RULES.font); rf.setAttribute('w:cs', RULES.font);
      let sz = child(rPr, 'sz');
      if (!sz) { sz = stylesDoc.createElementNS(SNS, 'w:sz'); rPr.appendChild(sz); }
      sz.setAttribute('w:val', String(sizeHalfPt));
      if (bold && !child(rPr, 'b')) rPr.appendChild(stylesDoc.createElementNS(SNS, 'w:b'));
      if (color) {
        let c = child(rPr, 'color');
        if (!c) { c = stylesDoc.createElementNS(SNS, 'w:color'); rPr.appendChild(c); }
        c.setAttribute('w:val', color);
      }
    }
    function setStylePara(st, line, before, after, outlineLvl, keepNext) {
      let pPr = child(st, 'pPr');
      if (!pPr) { pPr = stylesDoc.createElementNS(SNS, 'w:pPr'); st.appendChild(pPr); }
      let sp = child(pPr, 'spacing');
      if (!sp) { sp = stylesDoc.createElementNS(SNS, 'w:spacing'); pPr.appendChild(sp); }
      sp.setAttribute('w:line', String(line)); sp.setAttribute('w:lineRule', 'auto');
      sp.setAttribute('w:before', String(before)); sp.setAttribute('w:after', String(after));
      if (outlineLvl != null) {
        let ol = child(pPr, 'outlineLvl');
        if (!ol) { ol = stylesDoc.createElementNS(SNS, 'w:outlineLvl'); pPr.appendChild(ol); }
        ol.setAttribute('w:val', String(outlineLvl));
      }
      if (keepNext && !child(pPr, 'keepNext')) pPr.appendChild(stylesDoc.createElementNS(SNS, 'w:keepNext'));
    }
    // docDefaults
    let dd = child(root, 'docDefaults');
    if (!dd) { dd = stylesDoc.createElementNS(SNS, 'w:docDefaults'); root.insertBefore(dd, root.firstChild); }
    let rDef = child(dd, 'rPrDefault');
    if (!rDef) { rDef = stylesDoc.createElementNS(SNS, 'w:rPrDefault'); dd.appendChild(rDef); }
    let rPrD = child(rDef, 'rPr');
    if (!rPrD) { rPrD = stylesDoc.createElementNS(SNS, 'w:rPr'); rDef.appendChild(rPrD); }
    let rfD = child(rPrD, 'rFonts');
    if (!rfD) { rfD = stylesDoc.createElementNS(SNS, 'w:rFonts'); rPrD.appendChild(rfD); }
    rfD.setAttribute('w:ascii', RULES.font); rfD.setAttribute('w:hAnsi', RULES.font); rfD.setAttribute('w:cs', RULES.font);
    let szD = child(rPrD, 'sz');
    if (!szD) { szD = stylesDoc.createElementNS(SNS, 'w:sz'); rPrD.appendChild(szD); }
    szD.setAttribute('w:val', String(RULES.sizeHalfPt));
    let pDef = child(dd, 'pPrDefault');
    if (!pDef) { pDef = stylesDoc.createElementNS(SNS, 'w:pPrDefault'); dd.appendChild(pDef); }
    let pPrD = child(pDef, 'pPr');
    if (!pPrD) { pPrD = stylesDoc.createElementNS(SNS, 'w:pPr'); pDef.appendChild(pPrD); }
    let spD = child(pPrD, 'spacing');
    if (!spD) { spD = stylesDoc.createElementNS(SNS, 'w:spacing'); pPrD.appendChild(spD); }
    spD.setAttribute('w:line', String(RULES.lineVal)); spD.setAttribute('w:lineRule', 'auto');
    // Normal
    ensureStyle('Normal', 'paragraph', 'Normal', st => {
      setStyleRun(st, RULES.sizeHalfPt, false);
      setStylePara(st, RULES.lineVal, 0, 0, null, false);
    });
    // Heading1 / Heading2
    ensureStyle('Heading1', 'paragraph', 'heading 1', st => {
      setStyleRun(st, RULES.heading1.sizeHalfPt, true);
      setStylePara(st, RULES.lineVal, 240, 120, 0, true);
    });
    ensureStyle('Heading2', 'paragraph', 'heading 2', st => {
      setStyleRun(st, RULES.heading2.sizeHalfPt, true);
      setStylePara(st, RULES.lineVal, 200, 100, 1, true);
    });
    // TOCHeading (agar field TOC tidak memakai font default lain)
    ensureStyle('TOCHeading', 'paragraph', 'TOC Heading', st => {
      setStyleRun(st, RULES.heading1.sizeHalfPt, true);
      setStylePara(st, RULES.lineVal, 240, 120, 0, true);
    });
    zip.file('word/styles.xml', serialize(stylesDoc));
  }

  // ---------- Tempel teks -> .docx baru ----------
  function textToBlocks(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    lines.forEach(raw => {
      const line = raw.trimEnd();
      const t = line.trim();
      if (t === '---' || t === '***') { blocks.push({ type: 'break' }); return; }
      if (/^#\s+/.test(t)) { blocks.push({ type: 'h1', text: t.replace(/^#\s+/, '') }); return; }
      if (/^##\s+/.test(t)) { blocks.push({ type: 'h2', text: t.replace(/^##\s+/, '') }); return; }
      if (/^(\d+\.\s+|[-*]\s+)/.test(t)) { blocks.push({ type: 'list', text: t }); return; }
      if (t === '') { blocks.push({ type: 'empty' }); return; }
      blocks.push({ type: 'p', text: t });
    });
    return blocks;
  }

  function buildMinimalPackage(doc) {
    const zip = new JSZip();
    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>' +
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>');
    zip.file('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>');
    zip.file('word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
      '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>' +
      '</Relationships>');
    zip.file('word/fontTable.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:font w:name="Times New Roman"><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font>' +
      '</w:fonts>');
    zip.file('word/footer1.xml', buildFooterXml());
    zip.file('word/footer2.xml', buildFooterXml());
    zip.file('docProps/core.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>RapihWord</dc:creator><dc:title>Dokumen RapihWord</dc:title></cp:coreProperties>');
    zip.file('docProps/app.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>RapihWord</Application></Properties>');
    zip.file('word/document.xml', serialize(doc));
    return zip;
  }

  async function buildDocxFromText(text, opts) {
    opts = opts || {};
    const blocks = textToBlocks(text);
    const nonEmpty = blocks.filter(b => b.text && b.text.trim());
    const title = opts.title || (nonEmpty.length ? nonEmpty[0].text : 'Dokumen Tanpa Judul');
    const doc = parseXml('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<w:body></w:body></w:document>');
    const body = child(doc.documentElement, 'body');

    function runPara(text, { style, align, sizeHalfPt, bold, spacing } = {}) {
      const p = el(doc, 'p');
      const pPr = el(doc, 'pPr');
      const ps = el(doc, 'pStyle');
      ps.setAttribute('w:val', style || 'Normal');
      pPr.appendChild(ps);
      if (align) {
        const jc = el(doc, 'jc'); jc.setAttribute('w:val', align);
        pPr.appendChild(jc);
      }
      const sp = el(doc, 'spacing');
      sp.setAttribute('w:line', String(spacing && spacing.line != null ? spacing.line : RULES.lineVal));
      sp.setAttribute('w:lineRule', 'auto');
      if (spacing && spacing.before != null) sp.setAttribute('w:before', String(spacing.before));
      if (spacing && spacing.after != null) sp.setAttribute('w:after', String(spacing.after));
      pPr.appendChild(sp);
      p.appendChild(pPr);
      const r = el(doc, 'r');
      const rPr = el(doc, 'rPr');
      const rf = el(doc, 'rFonts');
      rf.setAttribute('w:ascii', RULES.font); rf.setAttribute('w:hAnsi', RULES.font); rf.setAttribute('w:cs', RULES.font);
      rPr.appendChild(rf);
      const sz = el(doc, 'sz'); sz.setAttribute('w:val', String(sizeHalfPt || RULES.sizeHalfPt));
      rPr.appendChild(sz);
      if (bold) rPr.appendChild(el(doc, 'b'));
      r.appendChild(rPr);
      // Pecah teks panjang per 4000 karakter agar <w:t> tidak raksasa.
      const chunks = String(text).match(/[\s\S]{1,4000}/g) || [''];
      chunks.forEach((c, i) => {
        const rr = i === 0 ? r : el(doc, 'r');
        if (i > 0) { rr.appendChild(rPr.cloneNode(true)); p.appendChild(rr); }
        const t = textEl(doc, 't', c);
        if (/^\s|\s$/.test(c)) t.setAttribute('xml:space', 'preserve');
        rr.appendChild(t);
      });
      p.appendChild(r);
      return p;
    }

    // --- Cover ---
    body.appendChild(runPara(title, { align: 'center', sizeHalfPt: 32, bold: true, spacing: { before: 1440, after: 240 } }));
    body.appendChild(runPara('Makalah', { align: 'center', sizeHalfPt: RULES.sizeHalfPt, spacing: { after: 120 } }));
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    body.appendChild(runPara(dateStr, { align: 'center', sizeHalfPt: RULES.sizeHalfPt, spacing: { after: 0 } }));
    // Page break setelah cover
    const brP = el(doc, 'p');
    const brR = el(doc, 'r');
    const br = el(doc, 'br'); br.setAttribute('w:type', 'page');
    brR.appendChild(br); brP.appendChild(brR);
    body.appendChild(brP);
    // --- Daftar isi (field TOC) ---
    body.appendChild(headingParagraph(doc, 'DAFTAR ISI', 1));
    body.appendChild(tocFieldParagraph(doc));
    // --- Section break: bagian awal (Romawi) berakhir di sini ---
    const frontSectP = el(doc, 'p');
    const frontPPr = el(doc, 'pPr');
    const frontSect = el(doc, 'sectPr');
    const fSz = el(doc, 'pgSz');
    fSz.setAttribute('w:w', String(RULES.pgSz.w)); fSz.setAttribute('w:h', String(RULES.pgSz.h));
    frontSect.appendChild(fSz);
    const fMar = el(doc, 'pgMar');
    ['top', 'left', 'bottom', 'right', 'header', 'footer', 'gutter'].forEach(k =>
      fMar.setAttribute('w:' + k, String(RULES.pgMar[k])));
    frontSect.appendChild(fMar);
    const fNum = el(doc, 'pgNumType'); fNum.setAttribute('w:fmt', 'lowerRoman');
    frontSect.appendChild(fNum);
    frontSect.appendChild(el(doc, 'titlePg'));
    const fRef = doc.createElementNS(W, 'w:footerReference');
    fRef.setAttribute('w:type', 'default');
    fRef.setAttributeNS(R, 'r:id', 'rId3');
    frontSect.appendChild(fRef);
    frontPPr.appendChild(frontSect);
    frontSectP.appendChild(frontPPr);
    body.appendChild(frontSectP);
    // --- Isi ---
    let first = true;
    blocks.forEach(b => {
      if (b.type === 'break') {
        const p = el(doc, 'p');
        const r = el(doc, 'r');
        const brEl = el(doc, 'br'); brEl.setAttribute('w:type', 'page');
        r.appendChild(brEl); p.appendChild(r);
        body.appendChild(p);
        return;
      }
      if (b.type === 'empty') { body.appendChild(runPara('', {})); return; }
      if (b.type === 'h1') {
        first = false;
        body.appendChild(headingParagraph(doc, b.text, 1));
        return;
      }
      if (b.type === 'h2') {
        first = false;
        body.appendChild(headingParagraph(doc, b.text, 2));
        return;
      }
      if (b.type === 'list') {
        first = false;
        const p = runPara(b.text, {});
        const pPr = child(p, 'pPr');
        const ind = el(doc, 'ind');
        ind.setAttribute('w:left', '720'); ind.setAttribute('w:hanging', '360');
        pPr.appendChild(ind);
        body.appendChild(p);
        return;
      }
      // Paragraf isi; baris pertama yang dipakai cover tidak diulang
      if (first && nonEmpty.length > 1 && b.text === title) { first = false; return; }
      first = false;
      const p = runPara(b.text, {});
      setAlign(doc, p, 'both');
      body.appendChild(p);
    });
    // --- sectPr akhir (isi = Arab mulai 1) ---
    const endSect = el(doc, 'sectPr');
    const eSz = el(doc, 'pgSz');
    eSz.setAttribute('w:w', String(RULES.pgSz.w)); eSz.setAttribute('w:h', String(RULES.pgSz.h));
    eSz.setAttribute('w:orient', 'portrait');
    endSect.appendChild(eSz);
    const eMar = el(doc, 'pgMar');
    ['top', 'left', 'bottom', 'right', 'header', 'footer', 'gutter'].forEach(k =>
      eMar.setAttribute('w:' + k, String(RULES.pgMar[k])));
    endSect.appendChild(eMar);
    const eNum = el(doc, 'pgNumType');
    eNum.setAttribute('w:fmt', 'decimal'); eNum.setAttribute('w:start', '1');
    endSect.appendChild(eNum);
    const eRef = doc.createElementNS(W, 'w:footerReference');
    eRef.setAttribute('w:type', 'default');
    eRef.setAttributeNS(R, 'r:id', 'rId4');
    endSect.appendChild(eRef);
    body.appendChild(endSect);

    const zip = buildMinimalPackage(doc);
    await applyStyles(zip, doc);
    return zip.generateAsync({ type: 'arraybuffer' });
  }

  function download(buf, filename) {
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  window.RMDocx = {
    RULES, validateDocx, parseDocx, analyzeDocx, applyFormat,
    buildDocxFromText, textToBlocks, download, estimatePages,
    isBab, isSubBab, isFrontHeading,
  };
})();

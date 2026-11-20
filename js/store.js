/* RapiMakalah — penyimpanan demo lokal (localStorage + blob di memori).
   Metadata dokumen/template/aktivitas tersimpan di localStorage; isi file
   (.docx asli + hasil) hanya dipegang di memori tab (tidak muat di
   localStorage untuk file besar) — unduh hasil sebelum menutup tab. */
(function () {
  'use strict';
  const DOCS_KEY = 'rm-docs-v1';
  const ACT_KEY = 'rm-activity-v1';
  const TPL_KEY = 'rm-templates-v1';
  const DRAFTS_KEY = 'rm-drafts-v1';

  function read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function write(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function uid() {
    return 'doc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  const BUILTIN_TEMPLATE = {
    id: 'tpl-makalah',
    name: 'Makalah',
    builtin: true,
    paper: 'A4',
    marginCm: { top: 4, left: 4, bottom: 3, right: 3 },
    font: 'Times New Roman',
    sizePt: 12,
    lineSpacing: 1.5,
    numbering: 'Romawi → Arab',
    toc: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  };

  const RMStore = {
    _blobs: {}, // id -> { original: ArrayBuffer|null, result: ArrayBuffer|null }
    _uid: uid,
    fmtDate,

    listDocs() { return read(DOCS_KEY, []); },
    getDoc(id) { return read(DOCS_KEY, []).find(d => d.id === id) || null; },
    addDoc(doc) {
      const docs = read(DOCS_KEY, []);
      doc.id = doc.id || uid();
      doc.createdAt = doc.createdAt || new Date().toISOString();
      docs.unshift(doc);
      write(DOCS_KEY, docs);
      return doc;
    },
    updateDoc(id, patch) {
      const docs = read(DOCS_KEY, []);
      const i = docs.findIndex(d => d.id === id);
      if (i < 0) return null;
      docs[i] = Object.assign({}, docs[i], patch);
      write(DOCS_KEY, docs);
      return docs[i];
    },
    removeDoc(id) {
      write(DOCS_KEY, read(DOCS_KEY, []).filter(d => d.id !== id));
      delete this._blobs[id];
    },
    setBlob(id, kind, buf) {
      if (!this._blobs[id]) this._blobs[id] = {};
      this._blobs[id][kind] = buf;
    },
    getBlob(id, kind) { return (this._blobs[id] || {})[kind] || null; },
    stats() {
      const docs = read(DOCS_KEY, []);
      const done = docs.filter(d => d.status === 'siap').length;
      const pages = docs.reduce((n, d) => n + (d.pages || 0), 0);
      const findings = docs.reduce((n, d) => n + (d.findingsCount || 0), 0);
      return {
        total: docs.length, done, pages,
        avgFindings: docs.length ? Math.round((findings / docs.length) * 10) / 10 : 0,
      };
    },

    logActivity(text) {
      const acts = read(ACT_KEY, []);
      acts.unshift({ text, at: new Date().toISOString() });
      write(ACT_KEY, acts.slice(0, 30));
    },
    listActivity() { return read(ACT_KEY, []); },

    listTemplates() {
      const customs = read(TPL_KEY, []);
      return [Object.assign({}, BUILTIN_TEMPLATE)].concat(customs);
    },
    getTemplate(id) {
      return this.listTemplates().find(t => t.id === id) || null;
    },
    addTemplate(t) {
      const customs = read(TPL_KEY, []);
      t.id = t.id || uid();
      t.builtin = false;
      t.updatedAt = new Date().toISOString();
      customs.unshift(t);
      write(TPL_KEY, customs);
      return t;
    },
    duplicateTemplate(id) {
      const src = this.getTemplate(id);
      if (!src) return null;
      const copy = Object.assign({}, src, {
        id: uid(), name: src.name + ' (salinan)', builtin: false,
        updatedAt: new Date().toISOString(),
      });
      const customs = read(TPL_KEY, []);
      customs.unshift(copy);
      write(TPL_KEY, customs);
      return copy;
    },
    removeTemplate(id) {
      write(TPL_KEY, read(TPL_KEY, []).filter(t => t.id !== id));
    },

    listDrafts() { return read(DRAFTS_KEY, []); },
    saveDraft(draft) {
      const drafts = read(DRAFTS_KEY, []);
      draft.id = draft.id || uid();
      draft.updatedAt = new Date().toISOString();
      const i = drafts.findIndex(d => d.id === draft.id);
      if (i >= 0) drafts[i] = draft; else drafts.unshift(draft);
      write(DRAFTS_KEY, drafts.slice(0, 20));
      return draft;
    },
    removeDraft(id) { write(DRAFTS_KEY, read(DRAFTS_KEY, []).filter(d => d.id !== id)); },
  };

  window.RMStore = RMStore;
})();

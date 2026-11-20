/* RapihWord — toast helper (dipakai semua halaman publik).
   Menampilkan pesan singkat di .toast-wrap; tidak menduplikasi
   wadah maupun helper bila sudah ada. */
(function () {
  'use strict';
  if (window.RMToast) return;

  function ensureWrap() {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  window.RMToast = function (msg) {
    var wrap = ensureWrap();
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = String(msg == null ? '' : msg);
    wrap.appendChild(el);
    window.setTimeout(function () { el.remove(); }, 4000);
  };
})();

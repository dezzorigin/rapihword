/* RapihWord — interaksi landing publik:
   accordion FAQ, kartu panduan yang mengembang, popup WhatsApp. */
(function () {
  'use strict';

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    if (!q) return;
    q.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
    q.addEventListener('click', function () {
      var open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* ---------- Kartu panduan: kembangkan ringkasan inline ---------- */
  document.querySelectorAll('.guide-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var summary = btn.querySelector('.guide-summary');
      var more = btn.querySelector('.guide-more');
      var isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      if (summary) summary.hidden = isOpen;
      if (more) more.textContent = isOpen ? 'Baca ringkasan' : 'Tutup ringkasan';
    });
  });

  /* ---------- Popup WhatsApp ---------- */
  var floatBtn = document.querySelector('.wa-float');
  var popup = document.querySelector('.wa-popup');
  var dismissBtn = popup ? popup.querySelector('.wa-dismiss') : null;

  function dismissed() {
    try { return localStorage.getItem('rm-wa-dismissed') === '1'; }
    catch (e) { return false; }
  }

  function closePopup() {
    if (popup) popup.classList.remove('open');
    if (floatBtn) floatBtn.setAttribute('aria-expanded', 'false');
  }

  if (floatBtn && popup) {
    floatBtn.setAttribute('aria-expanded', 'false');
    floatBtn.addEventListener('click', function () {
      var open = popup.classList.toggle('open');
      floatBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', function () {
      try { localStorage.setItem('rm-wa-dismissed', '1'); } catch (e) {}
      closePopup();
    });
  }

  /* Tampilkan popup otomatis sekali setelah 6 detik, bila belum pernah ditutup. */
  if (popup && !dismissed()) {
    window.setTimeout(function () {
      if (!dismissed() && popup) {
        popup.classList.add('open');
        if (floatBtn) floatBtn.setAttribute('aria-expanded', 'true');
      }
    }, 6000);
  }
})();

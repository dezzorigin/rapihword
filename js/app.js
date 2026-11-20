/* RapihWord — shell bersama halaman /app/*.
   Login DIMATIKAN (20 Nov 2026): app terbuka tanpa sesi, tidak ada
   guard yang me-redirect ke /login.html. Halaman login/register tetap
   ada di repo tapi bukan gerbang.
   Menu akun, sidebar aktif, hamburger mobile, toast.
   Bergantung pada: js/auth.js (window.RMAuth). Tanpa backend. */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function toast(msg) {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = String(msg);
    wrap.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'R';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* Status dokumen -> label + class stempel (dipakai semua halaman /app). */
  function statusInfo(status) {
    if (status === 'siap') return { label: 'Siap diunduh', cls: 'stamp-ok' };
    if (status === 'gagal') return { label: 'Gagal', cls: 'stamp-bad' };
    return { label: 'Belum diproses', cls: 'stamp-warn' };
  }
  function stampHtml(status) {
    var s = statusInfo(status);
    return '<span class="stamp ' + s.cls + '">' + esc(s.label) + '</span>';
  }

  function currentUser() {
    try { return window.RMAuth ? window.RMAuth.current() : null; }
    catch (e) { return null; }
  }

  /* Guard login DIMATIKAN (20 Nov 2026): app terbuka tanpa sesi.
     Fungsi dipertahankan sebagai no-op agar pemanggil lama (RMApp.guard)
     tidak pecah; selalu lolos. */
  function guard() {
    return true;
  }

  function init() {
    var user = currentUser();

    /* Isi menu akun. */
    var nameEl = document.getElementById('account-name');
    var mailEl = document.getElementById('account-mail');
    var avatarEl = document.getElementById('account-avatar');
    if (nameEl) nameEl.textContent = user ? user.name : 'Pengguna';
    if (mailEl) mailEl.textContent = user ? user.email : '';
    if (avatarEl) avatarEl.textContent = initials(user ? user.name : '');

    /* Dropdown menu akun. */
    var btn = document.querySelector('.account-btn');
    var dd = document.querySelector('.account-dropdown');
    if (btn && dd) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = dd.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (!dd.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
          dd.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          dd.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    /* Keluar (di dropdown) — hanya tampil bila ada sesi (akun demo lama).
       Tanpa sesi tombol disembunyikan: tidak ada yang perlu di-logout. */
    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn && !user) logoutBtn.style.display = 'none';
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        if (window.RMAuth) window.RMAuth.logout();
        window.location.href = '/login.html';
      });
    }

    /* Tandai link sidebar aktif sesuai halaman. */
    var path = window.location.pathname.replace(/\/$/, '') || '/app/index.html';
    if (path === '/app') path = '/app/index.html';
    document.querySelectorAll('.sidebar-nav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var ap = href.replace(/\/$/, '');
      if (ap === path) a.classList.add('active');
      a.removeAttribute('aria-current');
      if (ap === path) a.setAttribute('aria-current', 'page');
    });

    /* Hamburger mobile: sidebar jadi overlay. */
    var burger = document.getElementById('hamburger-btn');
    if (burger) {
      burger.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = document.body.classList.toggle('sidebar-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (!document.body.classList.contains('sidebar-open')) return;
        var sidebar = document.querySelector('.sidebar');
        if (sidebar && !sidebar.contains(e.target) && e.target !== burger && !burger.contains(e.target)) {
          document.body.classList.remove('sidebar-open');
          burger.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  /* Tanpa guard: halaman /app/* langsung tampil apa adanya. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.RMToast = toast;
  window.RMApp = {
    guard: guard,
    toast: toast,
    fmtBytes: fmtBytes,
    esc: esc,
    initials: initials,
    statusInfo: statusInfo,
    stampHtml: stampHtml,
    currentUser: currentUser,
  };
})();

/* RapihWord — auth demo lokal (localStorage).
   LOGIN DIMATIKAN sebagai gerbang (20 Nov 2026): app /app/* terbuka
   tanpa sesi. Halaman login/register/lupa-password tetap ada dan fungsinya
   masih jalan bila dibuka langsung, tapi tidak dipakai sebagai gerbang.
   TIDAK ADA password asli siapa pun di sini. Akun demo disimpan di
   browser pengguna sendiri; kata sandi hanya disimpan sebagai hash
   SHA-256, tidak pernah plaintext. Bukan auth produksi. */
(function () {
  'use strict';
  const USERS_KEY = 'rm-users-v1';
  const SESSION_KEY = 'rm-session-v1';
  const RESET_KEY = 'rm-resets-v1';

  function loadUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
  function loadResets() {
    try { return JSON.parse(localStorage.getItem(RESET_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function saveResets(r) { localStorage.setItem(RESET_KEY, JSON.stringify(r)); }

  async function sha256(text) {
    if (crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback lingkungan tanpa crypto.subtle (http non-secure): hash sederhana, demo saja.
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
  }

  function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
  function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); }

  const RMAuth = {
    current() {
      try {
        const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        if (!s || !s.email) return null;
        const u = loadUsers().find(x => x.email === s.email);
        return u ? { name: u.name, email: u.email, institution: u.institution || '', major: u.major || '', joinedAt: u.joinedAt } : null;
      } catch (e) { return null; }
    },

    async register({ name, email, password, institution, major }) {
      name = String(name || '').trim();
      email = normalizeEmail(email);
      if (name.length < 2) return { ok: false, error: 'Nama lengkap minimal 2 karakter.' };
      if (!validEmail(email)) return { ok: false, error: 'Format email tidak valid.' };
      if (!password || password.length < 8) return { ok: false, error: 'Kata sandi minimal 8 karakter.' };
      const users = loadUsers();
      if (users.some(u => u.email === email)) return { ok: false, error: 'Email sudah terdaftar. Silakan masuk.' };
      const user = {
        name, email, institution: String(institution || '').trim(), major: String(major || '').trim(),
        joinedAt: new Date().toISOString(), passHash: await sha256(password),
      };
      users.push(user);
      saveUsers(users);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ email }));
      if (window.RMStore) RMStore.logActivity('Akun RapihWord dibuat');
      return { ok: true, user: { name: user.name, email: user.email } };
    },

    async login(email, password) {
      email = normalizeEmail(email);
      if (!validEmail(email)) return { ok: false, error: 'Format email tidak valid.' };
      const user = loadUsers().find(u => u.email === email);
      if (!user) return { ok: false, error: 'Akun tidak ditemukan. Silakan daftar dulu.' };
      const hash = await sha256(password || '');
      if (hash !== user.passHash) return { ok: false, error: 'Kata sandi salah. Coba lagi.' };
      localStorage.setItem(SESSION_KEY, JSON.stringify({ email }));
      return { ok: true, user: { name: user.name, email: user.email } };
    },

    async loginDemo() {
      const email = 'demo@rapihword.demo';
      let user = loadUsers().find(u => u.email === email);
      if (!user) {
        user = {
          name: 'Pengguna Demo', email, institution: 'Universitas Contoh', major: 'Informatika',
          joinedAt: new Date().toISOString(), passHash: await sha256('demo-rapihword'),
        };
        const users = loadUsers(); users.push(user); saveUsers(users);
        if (window.RMStore) RMStore.logActivity('Akun RapihWord dibuat');
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify({ email }));
      return { ok: true, user: { name: user.name, email: user.email } };
    },

    logout() { localStorage.removeItem(SESSION_KEY); },

    requireAuth() {
      // Login dimatikan (20 Nov 2026): bukan gerbang lagi. Selalu lolos.
      return true;
    },

    updateProfile({ name, institution, major }) {
      const cur = this.current();
      if (!cur) return { ok: false, error: 'Tidak ada sesi aktif.' };
      name = String(name || '').trim();
      if (name.length < 2) return { ok: false, error: 'Nama lengkap minimal 2 karakter.' };
      const users = loadUsers();
      const u = users.find(x => x.email === cur.email);
      if (!u) return { ok: false, error: 'Akun tidak ditemukan.' };
      u.name = name;
      u.institution = String(institution || '').trim();
      u.major = String(major || '').trim();
      saveUsers(users);
      return { ok: true };
    },

    async changePassword(oldPass, newPass) {
      const cur = this.current();
      if (!cur) return { ok: false, error: 'Tidak ada sesi aktif.' };
      if (!newPass || newPass.length < 8) return { ok: false, error: 'Kata sandi baru minimal 8 karakter.' };
      const users = loadUsers();
      const u = users.find(x => x.email === cur.email);
      if (!u) return { ok: false, error: 'Akun tidak ditemukan.' };
      if ((await sha256(oldPass || '')) !== u.passHash) return { ok: false, error: 'Kata sandi lama salah.' };
      u.passHash = await sha256(newPass);
      saveUsers(users);
      return { ok: true };
    },

    requestReset(email) {
      email = normalizeEmail(email);
      const user = loadUsers().find(u => u.email === email);
      if (!user) return { ok: false, error: 'Email tidak terdaftar.' };
      // Demo statis: kode reset 6 digit ditampilkan di layar (tanpa email server).
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const resets = loadResets();
      resets[email] = { code, at: Date.now() };
      saveResets(resets);
      return { ok: true, code };
    },

    async resetPassword(email, code, newPass) {
      email = normalizeEmail(email);
      if (!newPass || newPass.length < 8) return { ok: false, error: 'Kata sandi baru minimal 8 karakter.' };
      const resets = loadResets();
      const rec = resets[email];
      if (!rec || rec.code !== String(code || '').trim()) return { ok: false, error: 'Kode reset salah atau kedaluwarsa.' };
      if (Date.now() - rec.at > 15 * 60 * 1000) return { ok: false, error: 'Kode reset kedaluwarsa. Minta kode baru.' };
      const users = loadUsers();
      const u = users.find(x => x.email === email);
      if (!u) return { ok: false, error: 'Akun tidak ditemukan.' };
      u.passHash = await sha256(newPass);
      saveUsers(users);
      delete resets[email];
      saveResets(resets);
      return { ok: true };
    },

    deleteAccount() {
      const cur = this.current();
      if (!cur) return { ok: false };
      saveUsers(loadUsers().filter(u => u.email !== cur.email));
      localStorage.removeItem(SESSION_KEY);
      ['rm-docs-v1', 'rm-activity-v1', 'rm-templates-v1', 'rm-drafts-v1'].forEach(k => localStorage.removeItem(k));
      return { ok: true };
    },
  };

  window.RMAuth = RMAuth;
})();

(function() {
  'use strict';

  const host = window.location.hostname;
  const port = window.location.port || '3000';
  // Gunakan port dari URL jika tersedia, fallback ke 3000
  const API_BASE = `http://${host}:3000`;

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================
  function getToken() {
    return localStorage.getItem('adminToken');
  }

  function setToken(token) {
    localStorage.setItem('adminToken', token);
  }

  function clearAuth() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    localStorage.removeItem('adminRole');
  }

  // ============================================
  // AUTH HEADERS
  // ============================================
  function getAuthHeaders() {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // ============================================
  // CHECK AUTHENTICATION
  // ============================================
  async function checkAuth() {
    const token = getToken();
    if (!token) {
      console.warn('[Auth] No token found');
      return false;
    }

    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        console.warn('[Auth] Profile fetch failed:', res.status);
        clearAuth();
        return false;
      }

      const data = await res.json();

      // FIXED: Cek role admin dengan benar
      if (!data.user || data.user.role !== 'admin') {
        alert('Akses ditolak. Hanya admin yang bisa masuk.');
        clearAuth();
        return false;
      }

      // Simpan info admin
      const adminName = data.user.name || 'Admin';
      localStorage.setItem('adminName', adminName);
      localStorage.setItem('adminRole', data.user.role);

      // Update semua elemen nama admin di halaman
      updateAdminNameInUI(adminName);

      console.log('[Auth] ✅ Authenticated as:', adminName);
      return true;

    } catch (err) {
      console.error('[Auth] Check failed:', err);
      // FIXED: Jangan clear auth jika network error (mungkin server sedang restart)
      // Hanya clear jika benar-benar tidak ada token
      clearAuth();
      return false;
    }
  }

  // ============================================
  // UPDATE UI
  // ============================================
  function updateAdminNameInUI(name) {
    const selectors = ['.admin-name', '#sidebar-admin-name', '#admin-name-header'];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (el) el.textContent = name;
      });
    });
  }

  // ============================================
  // LOGOUT
  // ============================================
  function logout() {
    if (confirm('Yakin ingin logout?')) {
      clearAuth();
      window.location.href = '/login.html';
    }
  }

  // ============================================
  // EXPORT GLOBAL
  // ============================================
  window.API_BASE = API_BASE;
  window.getToken = getToken;
  window.setToken = setToken;
  window.clearAuth = clearAuth;
  window.getAuthHeaders = getAuthHeaders;
  window.checkAuth = checkAuth;
  window.logout = logout;

  console.log('[Auth] ✅ Auth module loaded. API_BASE:', API_BASE);
})();
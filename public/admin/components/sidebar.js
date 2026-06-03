(function() {
  'use strict';

  // ============================================
  // TOGGLE SIDEBAR (Mobile)
  // ============================================
  function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger-mobile');
  if (!sidebar) return;

  sidebar.classList.toggle('open');

  if (sidebar.classList.contains('open')) {
    if (hamburger) hamburger.style.display = 'none'; // ← sembunyikan
    let overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebar-overlay';
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 998; display: block;
      `;
      overlay.addEventListener('click', () => toggleSidebar());
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = 'block';
    }
  } else {
    if (hamburger) hamburger.style.display = 'flex'; // ← tampilkan kembali
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.style.display = 'none';
  }
}

  // ============================================
  // CLOSE SIDEBAR ON OUTSIDE CLICK (Mobile)
  // ============================================
  // FIXED: Dihapus karena sudah ditangani oleh overlay di atas
  // Mencegah double-trigger

  // ============================================
  // EXPORT GLOBAL
  // ============================================
  window.toggleSidebar = toggleSidebar;

  console.log('[Sidebar] ✅ Sidebar module loaded');
})();
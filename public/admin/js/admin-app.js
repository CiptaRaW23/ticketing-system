let currentPage       = 'monitoring';
let currentPageModule = null;

// ── Page loader ───────────────────────────────────────────────
async function loadPage(pageName) {
  console.log('[App] 📄 Loading:', pageName);
  currentPage = pageName;

  const container = document.getElementById('page-container');
  container.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> Memuat ${pageName}...</div>`;

  if (currentPageModule?.cleanup) {
    try { currentPageModule.cleanup(); } catch(e) {}
  }
  currentPageModule = null;

  try {
    const res = await fetch(`/admin/templates/${pageName}.html`);
    if (!res.ok) throw new Error(`Template "${pageName}" tidak ditemukan (${res.status})`);
    container.innerHTML = await res.text();

    // Update sidebar active state
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageName);
    });

    const mod = await import(`/admin/pages/${pageName}.js`);
    if (mod?.init) {
      mod.init();
      currentPageModule = mod;
    }

  } catch (err) {
    console.error('[App] ❌', err);
    container.innerHTML = `
      <div style="text-align:center;padding:80px 20px;color:var(--danger);">
        <i class="fas fa-exclamation-triangle" style="font-size:64px;opacity:.3;display:block;margin-bottom:20px;"></i>
        <p style="font-size:18px;font-weight:700;margin-bottom:8px;">Gagal Memuat Halaman</p>
        <p style="font-size:14px;opacity:.7;margin-bottom:24px;">${err.message}</p>
        <button onclick="loadPage('${pageName}')" class="btn btn-refresh">
          <i class="fas fa-sync-alt"></i> Coba Lagi
        </button>
      </div>`;
  }
}

function refreshCurrentPage() {
  if (currentPageModule?.refresh) {
    try { currentPageModule.refresh(); } catch(e) { loadPage(currentPage); }
  } else {
    loadPage(currentPage);
  }
}

// ── Notification ──────────────────────────────────────────────
let notifTimeout = null;
function showNotification(msg) {
  const notif = document.getElementById('notification');
  const text  = document.getElementById('notification-text');
  if (!notif) return;
  if (text) text.textContent = msg;
  notif.style.display = 'flex';
  notif.style.animation = 'none';
  void notif.offsetWidth;
  notif.style.animation = 'slideInRight 0.3s ease';
  document.getElementById('notif-sound')?.play().catch(() => {});
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => { notif.style.display = 'none'; }, 5000);
}

// ── Socket ────────────────────────────────────────────────────
function initSocket() {
  if (typeof io === 'undefined' || window._adminSocket?.connected) return;
  const socket = io(window.API_BASE, {
    transports: ['websocket', 'polling'],
    auth: { token: window.getToken() },
    reconnection: true,
    reconnectionAttempts: Infinity
  });
  socket.on('connect',       ()  => { console.log('[Socket] ✅', socket.id); socket.emit('joinAdminRoom'); });
  socket.on('disconnect',    (r) => console.warn('[Socket] ⚠️', r));
  socket.on('connect_error', (e) => console.error('[Socket] ❌', e.message));
  socket.on('newTicket',           t => { showNotification(`🎫 Ticket baru: ${t?.title||''}`); if (['monitoring','tickets'].includes(currentPage)) refreshCurrentPage(); });
  socket.on('ticketUpdated',       () => { if (['monitoring','tickets'].includes(currentPage)) refreshCurrentPage(); });
  socket.on('ticketHasNewMessage', d => showNotification(`💬 Pesan baru di Ticket #${d.ticketId}`));
  socket.on('assignmentRejected',  d => { showNotification(`⚠️ Teknisi menolak Ticket #${d.ticketId}`); if (['monitoring','tickets'].includes(currentPage)) refreshCurrentPage(); });
  socket.on('ticketNewPhoto',      d => { showNotification(`📸 Foto baru di Ticket #${d.ticketId}`); if (currentPage==='tickets') refreshCurrentPage(); });
  window._adminSocket = socket;
}

// ── Sidebar ───────────────────────────────────────────────────
function setupSidebar() {
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page && page !== currentPage) loadPage(page);
      if (window.innerWidth <= 992) {
        document.getElementById('sidebar')?.classList.remove('open');
        const ov = document.getElementById('sidebar-overlay');
        if (ov) ov.style.display = 'none';
        // ← tambahkan ini
        const hamburger = document.getElementById('hamburger-mobile');
        if (hamburger) hamburger.style.display = 'flex';
      }
    });
  });
}

// ── Boot ──────────────────────────────────────────────────────
async function initApp() {
  console.log('[App] 🚀 ISP Ticketing Admin Panel');
  // Tunggu library eksternal
  await new Promise(resolve => {
    let n = 0;
    const t = setInterval(() => {
      if (typeof io !== 'undefined' && typeof Chart !== 'undefined') { clearInterval(t); resolve(); }
      if (++n > 60) { clearInterval(t); resolve(); }
    }, 100);
  });
  const ok = await window.checkAuth();
  if (!ok) { window.location.href = '/login.html'; return; }
  initSocket();
  setupSidebar();
  document.getElementById('logout-btn')?.addEventListener('click', window.logout);
  loadPage('monitoring');
}

// ── Exports global ────────────────────────────────────────────
window.loadPage           = loadPage;
window.refreshCurrentPage = refreshCurrentPage;
window.showNotification   = showNotification;

document.addEventListener('DOMContentLoaded', initApp);
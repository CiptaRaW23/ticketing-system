export function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

export function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

export function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return 'Baru saja';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`;
  return formatDate(dateStr);
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

export function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function showNotif(msg) {
  if (window.showNotification) window.showNotification(msg);
  else alert(msg);
}

export function openModal(id)  { document.getElementById(id)?.classList.add('active'); }
export function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

export function setLoading(btn, loading, html) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading ? '<i class="fas fa-spinner fa-spin"></i> Memuat...' : html;
}

export function loadingRow(cols) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:60px;color:var(--gray);">
    <i class="fas fa-spinner fa-spin" style="font-size:40px;opacity:.3;display:block;margin-bottom:12px;"></i>
    Memuat data...
  </td></tr>`;
}

export function errorRow(cols, msg, retryCall) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:60px;color:var(--danger);">
    <i class="fas fa-exclamation-triangle" style="font-size:40px;opacity:.3;display:block;margin-bottom:12px;"></i>
    <p style="font-weight:600;margin-bottom:6px;">Gagal memuat data</p>
    <p style="opacity:.7;font-size:13px;margin-bottom:16px;">${msg}</p>
    <button onclick="${retryCall}" class="btn btn-refresh">
      <i class="fas fa-sync-alt"></i> Coba Lagi
    </button>
  </td></tr>`;
}

export function emptyRow(cols, icon, title, sub = '') {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:60px;color:var(--gray);">
    <i class="${icon}" style="font-size:48px;opacity:.2;display:block;margin-bottom:12px;"></i>
    <p style="font-size:15px;font-weight:500;">${title}</p>
    ${sub ? `<p style="font-size:13px;opacity:.7;margin-top:6px;">${sub}</p>` : ''}
  </td></tr>`;
}
import { escHtml, setEl, formatDate, showNotif, openModal, closeModal, setLoading, loadingRow, errorRow, emptyRow } from '../modules/helpers.js';
import { fetchAllTechnicians, fetchTickets, createCustomer, patchTechnician, deleteTechnician } from '../modules/api.js';

let allTechnicians = [];
let editingId      = null;

export function init() {
  console.log('[Technicians] 🚀 init');
  setupListeners();
  load();
}
export function cleanup() { allTechnicians = []; editingId = null; }
export const refresh = () => load();

// ── Data ──────────────────────────────────────────────────────
async function load() {
  document.getElementById('tech-tbody').innerHTML = loadingRow(10);

  try {
    const data = await fetchAllTechnicians();

    allTechnicians = (data.technicians || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    render(allTechnicians);
    updateStats(allTechnicians);

  } catch (e) {
    document.getElementById('tech-tbody').innerHTML =
      errorRow(10, e.message, 'window.TechniciansPage.refresh()');
  }
}

// ── Render ────────────────────────────────────────────────────
function render(list) {
  const tbody = document.getElementById('tech-tbody');
  if (!list.length) { tbody.innerHTML = emptyRow(10, 'fas fa-hard-hat', 'Belum ada teknisi terdaftar'); return; }
  tbody.innerHTML = list.map(t => {
    const badge = `<span class="tech-status-badge ${t.status}">
      <i class="fas fa-circle" style="font-size:8px;"></i> ${t.status === 'active' ? 'Aktif' : 'Nonaktif'}
    </span>`;
    const wColor = t.activeTickets >= 5 ? '#ef4444' : t.activeTickets >= 3 ? '#f59e0b' : '#10b981';
    const wPct   = Math.min((t.activeTickets / 5) * 100, 100);
    const wCell  = `<div style="display:flex;align-items:center;gap:8px;">
      <span style="font-weight:700;color:${wColor};font-size:15px;">${t.activeTickets}</span>
      <div class="workload-bar" style="flex:1;max-width:60px;">
        <div class="workload-bar-fill" style="width:${wPct}%;background:${wColor};"></div>
      </div>
    </div>`;
    return `
      <tr>
        <td><strong>#${t.id}</strong></td>
        <td><span style="font-weight:600;">${escHtml(t.name)}</span></td>
        <td><code style="background:var(--light);padding:2px 7px;border-radius:4px;font-size:12px;">${escHtml(t.username)}</code></td>
        <td>${t.phone ? `<a href="tel:${escHtml(t.phone)}" style="color:var(--info);">${escHtml(t.phone)}</a>` : '<span style="color:var(--gray);font-style:italic;">—</span>'}</td>
        <td>${t.email ? escHtml(t.email) : '<span style="color:var(--gray);font-style:italic;">—</span>'}</td>
        <td>${badge}</td>
        <td>${wCell}</td>
        <td><span style="font-weight:600;">${t.totalTickets || 0}</span></td>
        <td style="white-space:nowrap;font-size:12px;color:var(--gray);">${formatDate(t.createdAt)}</td>
        <td class="action-btns" style="flex-wrap:wrap;gap:4px;">
          <button class="btn-sm btn-view"   data-action="detail" data-id="${t.id}"><i class="fas fa-chart-bar"></i></button>
          <button class="btn-sm btn-edit"   data-action="edit"   data-id="${t.id}"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn-sm btn-delete" data-action="delete" data-id="${t.id}" data-name="${escHtml(t.name)}" data-active="${t.activeTickets}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`;
  }).join('');
  tbody.addEventListener('click', onTableClick);
}

function updateStats(list) {
  const active   = list.filter(t => t.status === 'active').length;
  const inactive = list.filter(t => t.status === 'inactive').length;
  const workload = list.reduce((s, t) => s + (t.activeTickets || 0), 0);
  setEl('tech-stat-total',    list.length);
  setEl('tech-stat-active',   active);
  setEl('tech-stat-inactive', inactive);
  setEl('tech-stat-workload', workload);
}

function filter() {
  const q  = (document.getElementById('tech-search')?.value || '').toLowerCase();
  const st = document.getElementById('tech-statusFilter')?.value || '';
  render(allTechnicians.filter(t => {
    const mq = !q || `${t.name} ${t.username} ${t.phone||''}`.toLowerCase().includes(q);
    return mq && (!st || t.status === st);
  }));
}

// ── Event handler table ───────────────────────────────────────
function onTableClick(e) {
  const btn = e.target.closest('[data-action]'); if (!btn) return;
  const { action, id, name, active } = btn.dataset;
  const numId = Number(id);
  if (action === 'detail') openDetail(numId);
  if (action === 'edit')   openEdit(numId);
  if (action === 'delete') doDelete(numId, name, Number(active));
}

// ── Modal Add ─────────────────────────────────────────────────
function openAdd() {
  ['tech-add-name','tech-add-username','tech-add-password','tech-add-phone','tech-add-email']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  setEl('tech-add-error', '');
  openModal('tech-addModal');
  document.getElementById('tech-add-name')?.focus();
}
function closeAdd() { closeModal('tech-addModal'); }
async function submitAdd() {
  const name = v('tech-add-name'), username = v('tech-add-username');
  const password = document.getElementById('tech-add-password')?.value || '';
  const phone = v('tech-add-phone'), email = v('tech-add-email');
  const err = document.getElementById('tech-add-error');
  const btn = document.getElementById('tech-addSubmitBtn');
  err.textContent = '';
  if (!name)            { err.textContent = '⚠️ Nama wajib diisi'; return; }
  if (!username)        { err.textContent = '⚠️ Username wajib diisi'; return; }
  if (!password)        { err.textContent = '⚠️ Password wajib diisi'; return; }
  if (password.length < 6) { err.textContent = '⚠️ Password minimal 6 karakter'; return; }
  setLoading(btn, true, '');
  try {
    await createCustomer({ name, username, password, phone: phone||undefined, email: email||undefined, role: 'technician' });
    closeAdd();
    showNotif(`✅ Teknisi ${name} berhasil ditambahkan`);
    await load();
  } catch (e) { err.textContent = `❌ ${e.message}`; }
  finally { setLoading(btn, false, '<i class="fas fa-save"></i> Simpan'); }
}

// ── Modal Edit ────────────────────────────────────────────────
function openEdit(id) {
  const tech = allTechnicians.find(t => t.id === id); if (!tech) return;
  editingId = id;
  setEl('tech-edit-id', id);
  document.getElementById('tech-edit-name').value   = tech.name;
  document.getElementById('tech-edit-phone').value  = tech.phone  || '';
  document.getElementById('tech-edit-email').value  = tech.email  || '';
  document.getElementById('tech-edit-password').value = '';
  document.getElementById('tech-edit-status').value = tech.status;
  setEl('tech-edit-error', '');
  openModal('tech-editModal');
  document.getElementById('tech-edit-name')?.focus();
}
function closeEdit() { closeModal('tech-editModal'); editingId = null; }
async function submitEdit() {
  const name   = v('tech-edit-name'), phone = v('tech-edit-phone'), email = v('tech-edit-email');
  const status = document.getElementById('tech-edit-status')?.value;
  const password = document.getElementById('tech-edit-password')?.value || '';
  const err    = document.getElementById('tech-edit-error');
  const btn    = document.getElementById('tech-editSubmitBtn');
  err.textContent = '';
  if (!name) { err.textContent = '⚠️ Nama wajib diisi'; return; }
  if (password && password.length < 6) {                                     
    err.textContent = '⚠️ Password minimal 6 karakter';                        
    return;                                                                     
  }
  setLoading(btn, true, '');
  try {
    const body = { name, phone: phone||null, email: email||null, status };
    if (password) body.password = password;                                       
    await patchTechnician(editingId, body);
    closeEdit();
    showNotif('✅ Data teknisi berhasil diperbarui');
    await load();
  } catch (e) { err.textContent = `❌ ${e.message}`; }
  finally { setLoading(btn, false, '<i class="fas fa-save"></i> Simpan Perubahan'); }
}

// ── Modal Detail ──────────────────────────────────────────────
async function openDetail(id) {
  const tech = allTechnicians.find(t => t.id === id); if (!tech) return;
  setEl('tech-detail-name', tech.name);
  document.getElementById('tech-detail-body').innerHTML = `
    <div style="text-align:center;padding:40px;color:var(--gray);">
      <i class="fas fa-spinner fa-spin" style="font-size:32px;opacity:.4;display:block;margin-bottom:10px;"></i>
      Memuat data...
    </div>`;
  openModal('tech-detailModal');
  try {
    const data   = await fetchTickets();
    const all    = Array.isArray(data) ? data : (data.tickets || []);
    const techTk = all.filter(t => t.currentTechnician?.id === id || t.assignments?.some(a => a.technician?.id === id));
    const active = techTk.filter(t => ['assigned','in-progress'].includes(t.status));
    const closed = techTk.filter(t => t.status === 'closed');
    const sColor = { open:'#f59e0b', assigned:'#fb923c', 'in-progress':'#8b5cf6', closed:'#10b981' };
    document.getElementById('tech-detail-body').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px;">
        <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:#1d4ed8;">${tech.activeTickets}</div>
          <div style="font-size:12px;color:#3b82f6;font-weight:600;margin-top:4px;">Tugas Aktif</div>
        </div>
        <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:#15803d;">${closed.length}</div>
          <div style="font-size:12px;color:#16a34a;font-weight:600;margin-top:4px;">Selesai</div>
        </div>
        <div style="background:linear-gradient(135deg,#faf5ff,#ede9fe);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:#6d28d9;">${tech.totalTickets || 0}</div>
          <div style="font-size:12px;color:#7c3aed;font-weight:600;margin-top:4px;">Total Assignment</div>
        </div>
      </div>
      <div style="background:var(--light);border-radius:10px;padding:14px 16px;margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Informasi Teknisi</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
          <div><span style="color:var(--gray);">Username:</span> <strong>${escHtml(tech.username)}</strong></div>
          <div><span style="color:var(--gray);">Status:</span> <span class="tech-status-badge ${tech.status}">${tech.status==='active'?'Aktif':'Nonaktif'}</span></div>
          <div><span style="color:var(--gray);">Phone:</span> <strong>${tech.phone||'—'}</strong></div>
          <div><span style="color:var(--gray);">Email:</span> <strong>${tech.email||'—'}</strong></div>
        </div>
      </div>
      ${active.length ? `
        <div style="font-size:13px;font-weight:700;color:var(--dark);margin-bottom:10px;">
          <i class="fas fa-tasks" style="color:var(--warning);"></i> Ticket Sedang Dikerjakan (${active.length})
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
          ${active.map(t => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:white;border:1px solid var(--border);border-radius:8px;">
              <div>
                <strong style="font-size:13px;">#${t.id} ${escHtml(t.title)}</strong>
                <div style="font-size:11px;color:var(--gray);margin-top:2px;"><i class="fas fa-user"></i> ${escHtml(t.user?.name||'Unknown')}</div>
              </div>
              <span style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:12px;background:${sColor[t.status]||'#94a3b8'}22;color:${sColor[t.status]||'#94a3b8'};">${t.status}</span>
            </div>`).join('')}
        </div>` : `<div style="text-align:center;padding:20px;color:var(--gray);font-size:13px;"><i class="fas fa-check-circle" style="color:#10b981;"></i> Tidak ada tugas aktif</div>`}
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
        <button class="btn btn-refresh" id="tech-closeDetailBtn2"><i class="fas fa-times"></i> Tutup</button>
        <button class="btn btn-success" onclick="document.getElementById('tech-detailModal').classList.remove('active');TechniciansPage._openEdit(${id})">
          <i class="fas fa-edit"></i> Edit Teknisi
        </button>
      </div>`;
    document.getElementById('tech-closeDetailBtn2')?.addEventListener('click', closeDetail);
  } catch (e) {
    document.getElementById('tech-detail-body').innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);">Gagal memuat: ${e.message}</div>`;
  }
}
function closeDetail() { closeModal('tech-detailModal'); }

// ── Delete ────────────────────────────────────────────────────
async function doDelete(id, name, activeTickets) {
  if (activeTickets > 0) {
    alert(`⚠️ Tidak bisa hapus "${name}".\n\nTeknisi masih menangani ${activeTickets} ticket aktif.\nReassign terlebih dahulu.`);
    return;
  }
  if (!confirm(`Hapus teknisi "${name}"?\nAksi ini tidak bisa dibatalkan.`)) return;
  try {
    await deleteTechnician(id);
    showNotif(`✅ Teknisi ${name} berhasil dihapus`);
    await load();
  } catch (e) { alert(`❌ ${e.message}`); }
}

// ── Listeners ─────────────────────────────────────────────────
function setupListeners() {
  document.getElementById('tech-search')       ?.addEventListener('input',  filter);
  document.getElementById('tech-statusFilter') ?.addEventListener('change', filter);
  document.getElementById('tech-refreshBtn')   ?.addEventListener('click',  load);
  document.getElementById('tech-openAddBtn')   ?.addEventListener('click',  openAdd);
  document.getElementById('tech-addSubmitBtn') ?.addEventListener('click',  submitAdd);
  document.getElementById('tech-closeAddBtn')  ?.addEventListener('click',  closeAdd);
  document.getElementById('tech-cancelAddBtn') ?.addEventListener('click',  closeAdd);
  document.getElementById('tech-addModal')     ?.addEventListener('click',  e => { if (e.target === e.currentTarget) closeAdd(); });
  document.getElementById('tech-editSubmitBtn')?.addEventListener('click',  submitEdit);
  document.getElementById('tech-closeEditBtn') ?.addEventListener('click',  closeEdit);
  document.getElementById('tech-cancelEditBtn')?.addEventListener('click',  closeEdit);
  document.getElementById('tech-editModal')    ?.addEventListener('click',  e => { if (e.target === e.currentTarget) closeEdit(); });
  document.getElementById('tech-closeDetailBtn')?.addEventListener('click', closeDetail);
  document.getElementById('tech-detailModal')   ?.addEventListener('click', e => { if (e.target === e.currentTarget) closeDetail(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeAdd(); closeEdit(); closeDetail(); } });
}

const v = id => document.getElementById(id)?.value.trim() || '';

window.TechniciansPage = { refresh, _openEdit: openEdit };
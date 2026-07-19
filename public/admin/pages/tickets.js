import { escHtml, setEl, timeAgo, formatDateTime, showNotif, openModal, closeModal, setLoading, loadingRow, errorRow, emptyRow } from '../modules/helpers.js';
import { fetchTickets, fetchTicket, fetchTechnicians, fetchTicketPhotos, patchTicket, assignTicket, confirmTicket } from '../modules/api.js';

const ST = [
  { v:'open',        l:'Open',        c:'st-open'        },
  { v:'assigned',    l:'Assigned',    c:'st-assigned'    },
  { v:'in-progress', l:'In Progress', c:'st-in-progress' },
  { v:'closed',      l:'Closed',      c:'st-closed'      },
];
const PR = [
  { v:'low',    l:'Low',    c:'pr-low'    },
  { v:'medium', l:'Medium', c:'pr-medium' },
  { v:'high',   l:'High',   c:'pr-high'   },
];
const stBadge = { 'st-open':'badge-warning','st-assigned':'badge-warning','st-in-progress':'badge-primary','st-closed':'badge-success' };
const prBadge = { 'pr-low':'badge-info','pr-medium':'badge-warning','pr-high':'badge-danger' };
const findSt  = v => ST.find(o => o.v === v) || ST[0];
const findPr  = v => PR.find(o => o.v === (v||'low')) || PR[0];

let allTickets     = [];
let filteredTickets = [];
let allTechnicians = [];
let selectedIds    = new Set();
let currentTicketId = null;
let assignTicketId  = null;

let currentPage = 1;
const pageSize = 10;

export function init() {
  console.log('[Tickets] 🚀 init');
  setupListeners();
  setupSocket();
  load();
}
export function cleanup() {
  allTickets = []; filteredTickets = []; allTechnicians = []; selectedIds.clear();
  currentTicketId = null; assignTicketId = null;
}
export const refresh = () => load();

// ── Data ──────────────────────────────────────────────────────
async function load() {
  document.getElementById('tkt-tbody').innerHTML = loadingRow(10);
  try {
    const data = await fetchTickets();
    allTickets = Array.isArray(data) ? data : (data.tickets || []);
    filteredTickets = [...allTickets];
    render(filteredTickets);
    renderPagination(filteredTickets.length);
    updateStats();
  } catch (e) {
    document.getElementById('tkt-tbody').innerHTML = errorRow(10, e.message, 'window.TicketsPage.refresh()');
  }
}

// ── Render ────────────────────────────────────────────────────
function render(list) {
  const tbody = document.getElementById('tkt-tbody');
  const start = (currentPage - 1) * pageSize;
  const end   = start + pageSize;
  const pageData = list.slice(start, end);
  if (!list.length) { tbody.innerHTML = emptyRow(10, 'fas fa-inbox', 'Tidak ada ticket'); return; }
  tbody.innerHTML = pageData.map(t => {
    const st = findSt(t.status); const pr = findPr(t.priority);
    const stOpts = ST.map(o => `<option value="${o.v}" ${t.status===o.v?'selected':''}>${o.l}</option>`).join('');
    const prOpts = PR.map(o => `<option value="${o.v}" ${(t.priority||'low')===o.v?'selected':''}>${o.l}</option>`).join('');
    const techName = t.currentTechnician?.name || t.assignments?.[0]?.technician?.name || null;
    const techHTML = techName
      ? `<span style="font-size:12px;"><i class="fas fa-hard-hat" style="color:var(--warning);"></i> ${escHtml(techName)}</span>`
      : `<span style="color:var(--gray);font-style:italic;font-size:12px;">—</span>`;
    const schedHTML = t.visitSchedule
      ? `<span style="font-size:11px;color:var(--info);white-space:nowrap;"><i class="fas fa-calendar-check"></i> ${new Date(t.visitSchedule.scheduledDate).toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</span>`
      : `<span style="color:var(--gray);font-style:italic;font-size:12px;">—</span>`;
    const photoBtn = t.photos?.length
      ? `<button class="btn-sm" style="background:#ede9fe;color:#5b21b6;" data-action="photos" data-id="${t.id}"><i class="fas fa-images"></i> ${t.photos.length}</button>`
      : '';
    const assignBtn = ['open','assigned'].includes(t.status)
      ? `<button class="btn-sm btn-edit" data-action="assign" data-id="${t.id}"><i class="fas fa-user-cog"></i> ${t.status==='assigned'?'Re-assign':'Tugaskan'}</button>`
      : '';
    return `
      <tr data-id="${t.id}">
        <td><input type="checkbox" class="tkt-chk" data-id="${t.id}"></td>
        <td><strong>${escHtml(t.ticketNumber || '#'+t.id)}</strong></td>
        <td>${escHtml(t.user?.name||'Unknown')}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(t.title)}">${escHtml(t.title)}</td>
        <td>
          <select class="tkt-status-dd ${st.c}" data-original="${t.status}" data-id="${t.id}" data-field="status">
            ${stOpts}
          </select>
        </td>
        <td>
          <select class="tkt-priority-dd ${pr.c}" data-original="${t.priority||'low'}" data-id="${t.id}" data-field="priority">
            ${prOpts}
          </select>
        </td>
        <td>${techHTML}</td>
        <td>${schedHTML}</td>
        <td style="white-space:nowrap;">${timeAgo(t.createdAt)}</td>
        <td class="action-btns" style="flex-wrap:wrap;gap:4px;">
          <button class="btn-sm btn-view"    data-action="detail" data-id="${t.id}"><i class="fas fa-eye"></i> Lihat</button>
          <button class="btn-sm btn-approve" data-action="chat"   data-id="${t.id}"><i class="fas fa-comment"></i> Chat</button>
          ${assignBtn}
          ${photoBtn}
        </td>
      </tr>`;
  }).join('');
  tbody.querySelectorAll('.tkt-chk').forEach(cb => cb.addEventListener('change', onCheck));
  tbody.querySelectorAll('select[data-field]').forEach(sel => sel.addEventListener('change', onQuickChange));
}

function renderPagination(totalItems) {
  const totalPages = Math.ceil(totalItems / pageSize);

  const pagination = document.getElementById('tkt-pagination');
  if (!pagination) return;

  pagination.innerHTML = Array.from(
    { length: totalPages },
    (_, i) => `
      <button
        class="page-btn ${currentPage === i + 1 ? 'active' : ''}"
        data-page="${i + 1}">
        ${i + 1}
      </button>
    `
  ).join('');

  const info = document.getElementById('tkt-page-info');
  if (info) {
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);

    info.textContent =
      `Showing ${start}-${end} of ${totalItems} tickets`;
  }
}

function updateStats() {
  const today = new Date().toDateString();
  setEl('tkt-stat-total',    allTickets.length);
  setEl('tkt-stat-open',     allTickets.filter(t => t.status==='open').length);
  setEl('tkt-stat-assigned', allTickets.filter(t => t.status==='assigned').length);
  setEl('tkt-stat-progress', allTickets.filter(t => t.status==='in-progress').length);
  setEl('tkt-stat-closed',   allTickets.filter(t => t.status==='closed' && new Date(t.updatedAt).toDateString()===today).length);
}

function filter() {
  const q  = (document.getElementById('tkt-search')?.value || '').toLowerCase();
  const st = document.getElementById('tkt-statusFilter')?.value || '';
  const pr = document.getElementById('tkt-priorityFilter')?.value || '';

  filteredTickets = allTickets.filter(t => {
    const mq = !q || `${t.id} ${t.title} ${t.user?.name || ''}`
      .toLowerCase()
      .includes(q);

    return mq &&
      (!st || t.status === st) &&
      (!pr || (t.priority || 'low') === pr);
  });

  currentPage = 1;

  render(filteredTickets);
  renderPagination(filteredTickets.length);
}

// ── Quick change status/priority ──────────────────────────────
async function onQuickChange(e) {
  const sel = e.target;
  const { id, field, original } = sel.dataset;
  const newV = sel.value; if (newV === original) return;
  const opts  = field === 'status' ? ST : PR;
  const label = opts.find(o => o.v === newV)?.l || newV;
  if (!confirm(`Ubah ${field==='status'?'status':'prioritas'} Ticket #${id} → "${label}"?`)) { sel.value = original; return; }
  try {
    await patchTicket(Number(id), { [field]: newV });
    sel.dataset.original = newV;
    opts.forEach(o => sel.classList.remove(o.c));
    sel.classList.add(opts.find(o => o.v===newV)?.c||'');
    await load();
  } catch (e) { alert(`Gagal: ${e.message}`); sel.value = original; }
}

// ── Bulk ──────────────────────────────────────────────────────
function updateBulkBtn() {
  const n   = selectedIds.size;
  const stV = document.getElementById('tkt-bulkStatus')?.value   || '';
  const prV = document.getElementById('tkt-bulkPriority')?.value || '';
  const btn = document.getElementById('tkt-bulkUpdateBtn');
  if (btn) { btn.innerHTML = `<i class="fas fa-sync-alt"></i> Update Selected (${n})`; btn.disabled = n===0||(!stV&&!prV); }
}
function onCheck(e) {
  if (e.target.checked) selectedIds.add(e.target.dataset.id);
  else selectedIds.delete(e.target.dataset.id);
  updateBulkBtn();
}
async function doBulkUpdate() {
  const stV = document.getElementById('tkt-bulkStatus')?.value   || '';
  const prV = document.getElementById('tkt-bulkPriority')?.value || '';
  if (!selectedIds.size || (!stV && !prV)) return;
  if (!confirm(`Update ${selectedIds.size} ticket?`)) return;
  const body = {}; if (stV) body.status = stV; if (prV) body.priority = prV;
  await Promise.all([...selectedIds].map(id => patchTicket(Number(id), body)));
  selectedIds.clear();
  document.getElementById('tkt-selectAll').checked = false;
  document.getElementById('tkt-bulkStatus').value  = '';
  document.getElementById('tkt-bulkPriority').value = '';
  updateBulkBtn();
  await load();
}

// ── Table click delegation ────────────────────────────────────
function onTableClick(e) {
  if (e.target.closest('select')) return;
  const btn = e.target.closest('[data-action]'); if (!btn) return;
  const { action, id } = btn.dataset;
  const numId = Number(id);
  if (action === 'detail') openDetail(numId);
  if (action === 'chat')   openChat(numId);
  if (action === 'assign') openAssign(numId);
  if (action === 'photos') openPhotos(numId);
}

// ── Modal Detail ──────────────────────────────────────────────
async function openDetail(id) {
  document.getElementById('tkt-detail-id').textContent = id;
  document.getElementById('tkt-detail-body').innerHTML = `<div style="text-align:center;padding:60px;color:var(--gray);"><i class="fas fa-spinner fa-spin" style="font-size:32px;opacity:.4;display:block;margin-bottom:10px;"></i></div>`;
  openModal('tkt-detailModal');
  try {
    const raw = await fetchTicket(id); const t = raw.ticket || raw;
    document.getElementById('tkt-detail-id').textContent = t.ticketNumber || id;
    const st = findSt(t.status); const pr = findPr(t.priority);
    const techName = t.currentTechnician?.name || t.assignments?.[0]?.technician?.name || null;
    const aStatus  = t.assignments?.[0]?.status || null;
    document.getElementById('tkt-detail-body').innerHTML = `
      <h3 style="font-size:16px;color:var(--dark);margin-bottom:12px;">${escHtml(t.title)}</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <span class="badge ${stBadge[st.c]||'badge-gray'}">${st.l}</span>
        <span class="badge ${prBadge[pr.c]||'badge-gray'}"><i class="fas fa-flag"></i> ${pr.l}</span>
      </div>
      <div style="background:var(--light);padding:14px;border-radius:10px;margin:12px 0;line-height:1.7;font-size:14px;">
        <strong style="display:block;margin-bottom:8px;"><i class="fas fa-align-left"></i> Deskripsi:</strong>${escHtml(t.description)}
      </div>
      <div>
        <div class="detail-row"><span class="detail-label"><i class="fas fa-user"></i> Customer</span><span class="detail-value">${escHtml(t.user?.name||'Unknown')}</span></div>
        <div class="detail-row"><span class="detail-label"><i class="fas fa-calendar"></i> Dibuat</span><span class="detail-value">${formatDateTime(t.createdAt)}</span></div>
        ${t.address?`<div class="detail-row"><span class="detail-label"><i class="fas fa-map-marker-alt"></i> Alamat</span><span class="detail-value">${escHtml(t.address)}</span></div>`:''}
        ${t.mapsLink?`<div class="detail-row"><span class="detail-label"><i class="fas fa-map"></i> Maps</span><span class="detail-value"><a href="${escHtml(t.mapsLink)}" target="_blank" rel="noopener" style="color:var(--info);">Buka Maps <i class="fas fa-external-link-alt"></i></a></span></div>`:''}
        ${techName?`<div class="detail-row"><span class="detail-label"><i class="fas fa-hard-hat"></i> Teknisi</span><span class="detail-value">${escHtml(techName)}${aStatus?` <span class="badge badge-${aStatus==='accepted'?'success':'warning'}">${aStatus}</span>`:''}</span></div>`:''}
        ${t.visitSchedule?`<div class="detail-row"><span class="detail-label"><i class="fas fa-calendar-alt"></i> Jadwal</span><span class="detail-value">${formatDateTime(t.visitSchedule.scheduledDate)}</span></div>`:''}
        ${t.photos?.length?`<div class="detail-row"><span class="detail-label"><i class="fas fa-images"></i> Foto Bukti</span><span class="detail-value"><button class="btn-sm" style="background:#ede9fe;color:#5b21b6;" onclick="document.getElementById('tkt-detailModal').classList.remove('active');" id="tkt-detail-photos-btn"><i class="fas fa-images"></i> Lihat ${t.photos.length} Foto</button></span></div>`:''}
        <div class="detail-row"><span class="detail-label"><i class="fas fa-comments"></i> Pesan</span><span class="detail-value">${t.messages?.length||0} pesan</span></div>
      </div>
      <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        ${t.technicianDone && t.status === 'in-progress' ? `
          <div style="width:100%;background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:13px;color:#92400e;">
            <i class="fas fa-clock"></i> <strong>Teknisi menandai ticket ini selesai.</strong>
            Verifikasi foto bukti lalu konfirmasi.
          </div>
          <button class="btn btn-success" id="tkt-detail-approve-btn" style="background:#10b981;">
            <i class="fas fa-check-circle"></i> Approve — Tandai Closed
          </button>
          <button class="btn btn-danger" id="tkt-detail-reject-btn">
            <i class="fas fa-times-circle"></i> Tolak — Lanjutkan Pengerjaan
          </button>
        ` : ''}
        ${['open','assigned'].includes(t.status)?`<button class="btn btn-success" id="tkt-detail-assign-btn"><i class="fas fa-user-cog"></i> Tugaskan Teknisi</button>`:''}
        <button class="btn btn-success" style="background:var(--info);" id="tkt-detail-chat-btn"><i class="fas fa-comment"></i> Buka Chat</button>
        <button class="btn btn-refresh" id="tkt-detail-close-btn"><i class="fas fa-times"></i> Tutup</button>
      </div>`;
    document.getElementById('tkt-detail-close-btn') ?.addEventListener('click', closeDetail);
    document.getElementById('tkt-detail-assign-btn')?.addEventListener('click', () => { closeDetail(); openAssign(t.id); });
    document.getElementById('tkt-detail-chat-btn')  ?.addEventListener('click', () => { closeDetail(); openChat(t.id); });
    document.getElementById('tkt-detail-photos-btn')?.addEventListener('click', () => { openPhotos(t.id); });
    document.getElementById('tkt-detail-approve-btn')?.addEventListener('click', async () => {
      if (!confirm('Approve ticket ini sebagai selesai?')) return;
      try {
        await confirmTicket(t.id, 'approve');
        closeDetail();
        showNotif('✅ Ticket berhasil dikonfirmasi selesai');
        await load();
      } catch (e) { alert(`❌ ${e.message}`); }
    });
    document.getElementById('tkt-detail-reject-btn')?.addEventListener('click', async () => {
      if (!confirm('Tolak dan kembalikan ke in-progress?')) return;
      try {
        await confirmTicket(t.id, 'reject');
        closeDetail();
        showNotif('↩️ Ticket dikembalikan ke teknisi');
        await load();
      } catch (e) { alert(`❌ ${e.message}`); }
    });
  } catch (e) { document.getElementById('tkt-detail-body').innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);">Gagal: ${e.message}</div>`; }
}
function closeDetail() { closeModal('tkt-detailModal'); }

// ── Modal Chat ────────────────────────────────────────────────
async function openChat(id) {
  try {
    const raw = await fetchTicket(id); const t = raw.ticket || raw;
    currentTicketId = t.id;
    setEl('tkt-chat-id', t.id);
    document.getElementById('tkt-chat-title').textContent = t.title;
    const st = findSt(t.status); const pr = findPr(t.priority);
    document.getElementById('tkt-chat-badges').innerHTML = `
      <span class="badge ${stBadge[st.c]||'badge-gray'}">${st.l}</span>
      <span class="badge ${prBadge[pr.c]||'badge-gray'}"><i class="fas fa-flag"></i> ${pr.l}</span>
      <span class="badge badge-info"><i class="fas fa-user"></i> ${escHtml(t.user?.name||'Unknown')}</span>`;
    renderMessages(t.messages || []);
    const s = window._adminSocket;
    if (s?.connected) s.emit('joinTicketRoom', t.id);
    openModal('tkt-chatModal');
    document.getElementById('tkt-message-input')?.focus();
  } catch (e) { alert(`Gagal buka chat: ${e.message}`); }
}
function closeChat() {
  closeModal('tkt-chatModal');
  const c = document.getElementById('tkt-chat-container'); if (c) c.innerHTML = '';
  const inp = document.getElementById('tkt-message-input'); if (inp) inp.value = '';
  currentTicketId = null;
}
function renderMessages(msgs) {
  const c = document.getElementById('tkt-chat-container'); if (!c) return;
  if (!msgs.length) { c.innerHTML = `<p style="text-align:center;color:var(--gray);padding:40px 0;"><i class="fas fa-comment-slash" style="font-size:36px;opacity:.3;display:block;margin-bottom:10px;"></i>Belum ada pesan.</p>`; return; }
  c.innerHTML = '';
  msgs.forEach(m => appendMsg(m));
  c.scrollTop = c.scrollHeight;
}
function appendMsg(msg) {
  const c = document.getElementById('tkt-chat-container'); if (!c) return;
  const p = c.querySelector('p'); if (p) c.innerHTML = '';
  const d = document.createElement('div');
  d.className = `tkt-msg ${msg.sender}`;
  if (msg.id) d.setAttribute('data-msgid', msg.id);
  const labels = { admin:'Admin', bot:'Bot', customer:'Customer' };
  d.innerHTML = `<strong>${labels[msg.sender]||msg.sender}</strong>${escHtml(msg.message)}<small>${new Date(msg.createdAt).toLocaleString('id-ID')}</small>`;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}
function sendMessage() {
  const inp = document.getElementById('tkt-message-input');
  const msg = inp?.value.trim(); if (!msg || !currentTicketId) return;
  const s = window._adminSocket;
  if (!s?.connected) { alert('Koneksi terputus. Refresh halaman.'); return; }
  s.emit('sendMessage', { ticketId: currentTicketId, message: msg, sender: 'admin' });
  inp.value = ''; inp.focus();
}

// ── Modal Assign ──────────────────────────────────────────────
async function openAssign(ticketId) {
  assignTicketId = ticketId;
  const ticket = allTickets.find(t => t.id === ticketId);
  setEl('tkt-assign-id', ticketId);
  document.getElementById('tkt-assign-title').textContent    = ticket?.title || '';
  document.getElementById('tkt-assign-customer').textContent = ticket?.user?.name ? `Customer: ${ticket.user.name}` : '';
  document.getElementById('tkt-assign-note').value           = '';
  document.getElementById('tkt-assign-date').value           = '';
  document.getElementById('tkt-assign-duration').value       = '';
  document.getElementById('tkt-assign-schedule-note').value  = '';
  setEl('tkt-assign-error', '');
  document.getElementById('tkt-assign-tech-info').style.display = 'none';
  try {
    const data = await fetchTechnicians();
    allTechnicians = data.technicians || [];
  } catch { allTechnicians = []; }
  const sel = document.getElementById('tkt-assign-tech-select');
  if (sel) {
    sel.innerHTML = allTechnicians.length
      ? '<option value="">-- Pilih Teknisi --</option>' + allTechnicians.map(t =>
          `<option value="${t.id}">${escHtml(t.name)}${t.phone?' ('+t.phone+')':''} — ${t.activeTickets} tugas aktif</option>`
        ).join('')
      : '<option value="">Tidak ada teknisi aktif</option>';
  }
  openModal('tkt-assignModal');
}
function closeAssign() { closeModal('tkt-assignModal'); assignTicketId = null; }
async function submitAssign() {
  const techId   = parseInt(document.getElementById('tkt-assign-tech-select')?.value || '0');
  const note     = document.getElementById('tkt-assign-note')?.value.trim();
  const schedDate= document.getElementById('tkt-assign-date')?.value;
  const duration = document.getElementById('tkt-assign-duration')?.value;
  const schedNote= document.getElementById('tkt-assign-schedule-note')?.value.trim();
  const err = document.getElementById('tkt-assign-error');
  const btn = document.getElementById('tkt-assignSubmitBtn');
  err.textContent = '';
  if (!techId) { err.textContent = '⚠️ Pilih teknisi terlebih dahulu!'; return; }
  setLoading(btn, true, '');
  try {
    const body = { technicianId: techId };
    if (note)      body.adminNote         = note;
    if (schedDate) body.scheduledDate     = schedDate;
    if (duration)  body.estimatedDuration = parseInt(duration);
    if (schedNote) body.scheduleNote      = schedNote;
    const data = await assignTicket(assignTicketId, body);
    closeAssign();
    showNotif(`✅ ${data.message}`);
    await load();
  } catch (e) { err.textContent = `❌ ${e.message}`; }
  finally { setLoading(btn, false, '<i class="fas fa-paper-plane"></i> Tugaskan Teknisi'); }
}

// ── Modal Photos ──────────────────────────────────────────────
async function openPhotos(ticketId) {
  setEl('tkt-photos-id', ticketId);
  const grid = document.getElementById('tkt-photos-grid');
  grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray);grid-column:1/-1;"><i class="fas fa-spinner fa-spin" style="font-size:32px;opacity:.4;display:block;margin-bottom:10px;"></i>Memuat foto...</div>`;
  openModal('tkt-photosModal');
  try {
    const data = await fetchTicketPhotos(ticketId);
    const photos = data.photos || [];
    if (!photos.length) { grid.innerHTML = `<div style="text-align:center;padding:60px;color:var(--gray);grid-column:1/-1;"><i class="fas fa-image" style="font-size:48px;opacity:.2;display:block;margin-bottom:12px;"></i>Belum ada foto bukti</div>`; return; }
    grid.innerHTML = photos.map(p => `
      <div class="photo-card" data-url="${window.API_BASE}${p.url}">
        <img src="${window.API_BASE}${p.url}" alt="${escHtml(p.caption||p.originalName)}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iI2YxZjVmOSIvPjwvc3ZnPg=='" />
        <div class="photo-info">
          <div style="font-weight:600;color:var(--dark);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(p.caption||p.originalName)}</div>
          <div style="color:var(--gray);"><i class="fas fa-user-cog"></i> ${escHtml(p.uploadedBy?.name||'Teknisi')}</div>
        </div>
      </div>`).join('');
    grid.querySelectorAll('.photo-card').forEach(card => {
      card.addEventListener('click', () => openLightbox(card.dataset.url));
    });
  } catch (e) { grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);grid-column:1/-1;">Gagal: ${e.message}</div>`; }
}
function closePhotos() { closeModal('tkt-photosModal'); }
function openLightbox(url) {
  const lb = document.getElementById('tkt-lightbox'); const img = document.getElementById('tkt-lightbox-img');
  if (lb && img) { img.src = url; lb.style.display = 'flex'; }
}

// ── Socket ────────────────────────────────────────────────────
function setupSocket() {
  const s = window._adminSocket; if (!s) return;
  s.on('newMessage', m => {
    if (m.ticketId === currentTicketId && !document.querySelector(`[data-msgid="${m.id}"]`)) appendMsg(m);
  });
  s.on('ticketUpdated', () => load());
  s.on('assignmentRejected', d => { showNotif(`⚠️ Teknisi menolak ticket #${d.ticketId}`); load(); });
  s.on('technicianRequestClose', d => {
    showNotif(`🔔 ${d.technicianName} tandai selesai Ticket #${d.ticketId} — Mohon konfirmasi!`);
    load();
  });
}

// ── Listeners ─────────────────────────────────────────────────
function setupListeners() {
  document.getElementById('tkt-search')        ?.addEventListener('input',  filter);
  document.getElementById('tkt-statusFilter')  ?.addEventListener('change', filter);
  document.getElementById('tkt-priorityFilter')?.addEventListener('change', filter);
  document.getElementById('tkt-refreshBtn')    ?.addEventListener('click',  load);
  document.getElementById('tkt-bulkStatus')    ?.addEventListener('change', updateBulkBtn);
  document.getElementById('tkt-bulkPriority')  ?.addEventListener('change', updateBulkBtn);
  document.getElementById('tkt-bulkUpdateBtn') ?.addEventListener('click',  doBulkUpdate);
  document.getElementById('tkt-selectAll')?.addEventListener('change', function() {
    document.querySelectorAll('.tkt-chk').forEach(cb => {
      cb.checked = this.checked;
      if (this.checked) selectedIds.add(cb.dataset.id); else selectedIds.delete(cb.dataset.id);
    });
    updateBulkBtn();
  });
  document.getElementById('tkt-tbody')
  ?.addEventListener('click', onTableClick);
  // Detail modal
  document.getElementById('tkt-closeDetailBtn')?.addEventListener('click', closeDetail);
  document.getElementById('tkt-detailModal')   ?.addEventListener('click', e => { if (e.target===e.currentTarget) closeDetail(); });
  // Chat modal
  document.getElementById('tkt-sendBtn')        ?.addEventListener('click',   sendMessage);
  document.getElementById('tkt-closeChatBtn')   ?.addEventListener('click',   closeChat);
  document.getElementById('tkt-closeChatBtn2')  ?.addEventListener('click',   closeChat);
  document.getElementById('tkt-chatModal')      ?.addEventListener('click',   e => { if (e.target===e.currentTarget) closeChat(); });
  document.getElementById('tkt-message-input')  ?.addEventListener('keypress',e => { if (e.key==='Enter') sendMessage(); });
  // Assign modal
  document.getElementById('tkt-assignSubmitBtn') ?.addEventListener('click', submitAssign);
  document.getElementById('tkt-closeAssignBtn')  ?.addEventListener('click', closeAssign);
  document.getElementById('tkt-cancelAssignBtn') ?.addEventListener('click', closeAssign);
  document.getElementById('tkt-assignModal')     ?.addEventListener('click', e => { if (e.target===e.currentTarget) closeAssign(); });
  document.getElementById('tkt-assign-tech-select')?.addEventListener('change', function() {
    const tech = allTechnicians.find(t => t.id === parseInt(this.value));
    const box  = document.getElementById('tkt-assign-tech-info');
    const txt  = document.getElementById('tkt-assign-tech-info-text');
    if (tech && box && txt) {
      box.style.display = 'block';
      txt.textContent = `${tech.name} menangani ${tech.activeTickets} ticket aktif.${tech.activeTickets>=3?' ⚠️ Beban cukup tinggi.':' ✅ Beban normal.'}`;
    } else if (box) box.style.display = 'none';
  });
  // Photos modal
  document.getElementById('tkt-closePhotosBtn')  ?.addEventListener('click', closePhotos);
  document.getElementById('tkt-closePhotosBtn2') ?.addEventListener('click', closePhotos);
  document.getElementById('tkt-photosModal')     ?.addEventListener('click', e => { if (e.target===e.currentTarget) closePhotos(); });
  document.getElementById('tkt-lightbox')        ?.addEventListener('click', () => { document.getElementById('tkt-lightbox').style.display='none'; });
  document.addEventListener('keydown', e => { if (e.key==='Escape') { closeDetail(); closeChat(); closeAssign(); closePhotos(); } });

  document.getElementById('tkt-pagination')
  ?.addEventListener('click', e => {
    const btn = e.target.closest('.page-btn');
    if (!btn) return;

    currentPage = Number(btn.dataset.page);

    render(filteredTickets);
    renderPagination(filteredTickets.length);
  });
}

window.TicketsPage = { refresh };
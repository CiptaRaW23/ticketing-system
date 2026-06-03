// pages/customers.js — Pelanggan Aktif + Registri + Import CSV

import {
  escHtml, setEl, formatDate, showNotif,
  openModal, closeModal, setLoading, loadingRow, errorRow, emptyRow
} from '../modules/helpers.js';
import { fetchCustomers, createCustomer, patchCustomer, deleteCustomer } from '../modules/api.js';

// ── State ─────────────────────────────────────────────────
let allCustomers  = [];
let allRegistry   = [];
let selectedIds   = new Set();
let editingId     = null;
let deleteTarget  = null;
let currentTab    = 'customers';
let csvParsedRows = [];   // baris CSV yang sudah diparse & divalidasi

export function init() {
  console.log('[Customers] 🚀 init');
  setupListeners();
  load();
  loadRegistry();
}

export function cleanup() {
  allCustomers = []; allRegistry = []; selectedIds.clear();
  editingId = null; deleteTarget = null; csvParsedRows = [];
}

export const refresh = () => { load(); loadRegistry(); };

// ═══════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════
window.switchTab = function(tab) {
  currentTab = tab;
  document.getElementById('panel-customers').style.display = tab === 'customers' ? '' : 'none';
  document.getElementById('panel-registry').style.display  = tab === 'registry'  ? '' : 'none';
  document.getElementById('tab-customers').classList.toggle('active', tab === 'customers');
  document.getElementById('tab-registry').classList.toggle('active',  tab === 'registry');

  // Bulk buttons hanya di tab pelanggan
  const bulkBtns = ['cust-bulkApproveBtn','cust-bulkDeactBtn','cust-openAddBtn'];
  bulkBtns.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = tab === 'customers' ? '' : 'none';
  });
};

// ═══════════════════════════════════════════════════════════
// PANEL 1: PELANGGAN AKTIF
// ═══════════════════════════════════════════════════════════

async function load() {
  document.getElementById('cust-tbody').innerHTML = loadingRow(9);
  try {
    allCustomers = await fetchCustomers();
    renderCustomers(allCustomers);
    updateCustomerStats();
  } catch (e) {
    document.getElementById('cust-tbody').innerHTML =
      errorRow(9, e.message, 'window.CustomersPage.refresh()');
  }
}

function renderCustomers(list) {
  const tbody = document.getElementById('cust-tbody');
  if (!list.length) {
    tbody.innerHTML = emptyRow(9, 'fas fa-users', 'Belum ada pelanggan terdaftar');
    return;
  }
  tbody.innerHTML = list.map(c => {
    const sCls = c.status === 'active' ? 'badge-success' : 'badge-danger';
    const sTxt = c.status === 'active' ? 'Aktif' : 'Nonaktif';
    const addr = c.address ? escHtml(c.address)
      : `<span style="color:var(--gray);font-style:italic;">–</span>`;
    const phone = c.phone ? escHtml(c.phone)
      : `<span style="color:var(--gray);font-style:italic;">–</span>`;
    const tBtn = c.status === 'inactive'
      ? `<button class="btn-sm btn-approve" data-action="activate"   data-id="${c.id}"><i class="fas fa-check"></i> Aktifkan</button>`
      : `<button class="btn-sm btn-edit"    data-action="deactivate" data-id="${c.id}"><i class="fas fa-ban"></i> Nonaktifkan</button>`;
    return `
      <tr>
        <td><input type="checkbox" class="cust-chk" data-id="${c.id}"></td>
        <td><strong>CUS-${c.id}</strong></td>
        <td>${escHtml(c.username)}</td>
        <td>${escHtml(c.name)}</td>
        <td>${phone}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
            title="${escHtml(c.address||'')}">${addr}</td>
        <td><span class="badge ${sCls}">${sTxt}</span></td>
        <td style="white-space:nowrap;">${formatDate(c.createdAt)}</td>
        <td class="action-btns">
          ${tBtn}
          <button class="btn-sm btn-edit"   data-action="edit"   data-id="${c.id}"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn-sm btn-delete" data-action="delete" data-id="${c.id}"
            data-name="${escHtml(c.name)}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
  }).join('');
  tbody.querySelectorAll('.cust-chk').forEach(cb => cb.addEventListener('change', onCheck));
  tbody.addEventListener('click', onTableClick);
}

function updateCustomerStats() {
  const a = allCustomers.filter(c => c.status === 'active').length;
  const i = allCustomers.filter(c => c.status === 'inactive').length;
  setEl('cust-stat-total',   allCustomers.length);
  setEl('cust-stat-active',  a);
  setEl('cust-stat-pending', 0);
  setEl('cust-stat-inactive', i);
}

function filterCustomers() {
  const q  = (document.getElementById('cust-search')?.value || '').toLowerCase();
  const st = document.getElementById('cust-statusFilter')?.value || '';
  renderCustomers(allCustomers.filter(c => {
    const mq = !q || `${c.id} ${c.username} ${c.name} ${c.phone||''} ${c.address||''}`.toLowerCase().includes(q);
    return mq && (!st || c.status === st);
  }));
}

// ── Bulk ──
function updateBulkBtns() {
  const n = selectedIds.size;
  const a = document.getElementById('cust-bulkApproveBtn');
  const d = document.getElementById('cust-bulkDeactBtn');
  if (a) { a.innerHTML = `<i class="fas fa-check-circle"></i> Aktifkan Selected (${n})`; a.disabled = n === 0; }
  if (d) { d.innerHTML = `<i class="fas fa-ban"></i> Nonaktifkan Selected (${n})`;       d.disabled = n === 0; }
}

async function bulkPatch(status, label) {
  if (!selectedIds.size || !confirm(`${label} ${selectedIds.size} pelanggan?`)) return;
  let ok = 0, fail = 0;
  await Promise.all([...selectedIds].map(id =>
    patchCustomer(id, { status }).then(() => ok++).catch(() => fail++)));
  selectedIds.clear();
  document.getElementById('cust-selectAll').checked = false;
  updateBulkBtns();
  showNotif(`✅ ${ok} pelanggan ${label}${fail ? `, ${fail} gagal` : ''}`);
  await load();
}

function onCheck(e) {
  if (e.target.checked) selectedIds.add(e.target.dataset.id);
  else selectedIds.delete(e.target.dataset.id);
  updateBulkBtns();
}

function onTableClick(e) {
  const btn = e.target.closest('[data-action]'); if (!btn) return;
  const { action, id, name } = btn.dataset;
  const numId = Number(id);
  if (action === 'activate')   doToggle(numId, 'active',   'diaktifkan');
  if (action === 'deactivate') doToggle(numId, 'inactive', 'dinonaktifkan');
  if (action === 'edit')       openEdit(numId);
  if (action === 'delete')     startDelete(numId, name);
}

async function doToggle(id, status, label) {
  if (!confirm(`${label === 'diaktifkan' ? 'Aktifkan' : 'Nonaktifkan'} customer CUS-${id}?`)) return;
  try {
    await patchCustomer(id, { status });
    showNotif(`✅ CUS-${id} berhasil ${label}`);
    await load();
  } catch (e) { alert(`❌ ${e.message}`); }
}

// ── Modal Add ──
function openAdd() {
  ['cust-new-username','cust-new-name','cust-new-phone','cust-new-password','cust-new-address']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  setEl('cust-add-error', '');
  openModal('cust-addModal');
  document.getElementById('cust-new-username')?.focus();
}
function closeAdd() { closeModal('cust-addModal'); }

async function submitAdd() {
  const username = v('cust-new-username'), name = v('cust-new-name');
  const phone    = v('cust-new-phone');
  const password = document.getElementById('cust-new-password')?.value || '';
  const address  = v('cust-new-address');
  const err = document.getElementById('cust-add-error');
  const btn = document.getElementById('cust-addSubmitBtn');
  err.textContent = '';
  if (!username || !name || !password) { err.textContent = '⚠️ Username, nama, dan password wajib!'; return; }
  if (password.length < 6)             { err.textContent = '⚠️ Password minimal 6 karakter!'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { err.textContent = '⚠️ Username hanya boleh huruf, angka, underscore!'; return; }
  setLoading(btn, true, '');
  try {
    await createCustomer({ username, name, phone: phone || undefined, password, address: address || null });
    closeAdd();
    showNotif(`✅ Pelanggan "${name}" berhasil ditambahkan!`);
    await load();
  } catch (e) { err.textContent = `❌ ${e.message}`; }
  finally { setLoading(btn, false, '<i class="fas fa-save"></i> Simpan Pelanggan'); }
}

// ── Modal Edit ──
function openEdit(id) {
  const c = allCustomers.find(x => x.id === id); if (!c) return;
  editingId = id;
  setEl('cust-edit-id', id);
  document.getElementById('cust-edit-name').value    = c.name    || '';
  document.getElementById('cust-edit-phone').value   = c.phone   || '';
  document.getElementById('cust-edit-address').value = c.address || '';
  document.getElementById('cust-edit-status').value  = c.status;
  document.getElementById('cust-edit-password').value = '';
  setEl('cust-edit-error', '');
  openModal('cust-editModal');
  document.getElementById('cust-edit-name')?.focus();
}
function closeEdit() { closeModal('cust-editModal'); editingId = null; }

async function submitEdit() {
  const name = v('cust-edit-name'), phone = v('cust-edit-phone'), address = v('cust-edit-address');
  const status   = document.getElementById('cust-edit-status')?.value;
  const password = document.getElementById('cust-edit-password')?.value || '';
  const err = document.getElementById('cust-edit-error');
  const btn = document.getElementById('cust-editSubmitBtn');
  err.textContent = '';
  if (!name) { err.textContent = '⚠️ Nama wajib diisi'; return; }
  if (password && password.length < 6) { err.textContent = '⚠️ Password minimal 6 karakter'; return; }
  setLoading(btn, true, '');
  try {
    const body = { name, phone: phone || null, address: address || null, status };
    if (password) body.password = password;
    await patchCustomer(editingId, body);
    closeEdit();
    showNotif('✅ Data pelanggan berhasil diperbarui');
    await load();
  } catch (e) { err.textContent = `❌ ${e.message}`; }
  finally { setLoading(btn, false, '<i class="fas fa-save"></i> Simpan Perubahan'); }
}

// ── Modal Delete ──
async function startDelete(id, name) {
  try {
    const data = await deleteCustomer(id, false);
    if (data.success) { showNotif(`✅ ${data.message}`); await load(); return; }
    if (data.requiresConfirmation) {
      deleteTarget = { id, name };
      setEl('cust-delete-warning', data.message);
      setEl('cust-delete-hint', `Nama yang harus diketik: "${name}"`);
      document.getElementById('cust-delete-input').value = '';
      const cb = document.getElementById('cust-deleteConfirmBtn');
      cb.disabled = true; cb.style.opacity = '.5';
      openModal('cust-deleteModal');
      document.getElementById('cust-delete-input')?.focus();
    }
  } catch (e) { alert(`❌ ${e.message}`); }
}
async function confirmDelete() {
  if (!deleteTarget) return;
  const btn = document.getElementById('cust-deleteConfirmBtn');
  setLoading(btn, true, '');
  try {
    const data = await deleteCustomer(deleteTarget.id, true);
    closeDeleteModal();
    showNotif(`✅ ${data.message}`);
    await load();
  } catch (e) {
    alert(`❌ ${e.message}`);
    setLoading(btn, false, '<i class="fas fa-trash"></i> Hapus Permanen');
  }
}
function closeDeleteModal() {
  closeModal('cust-deleteModal'); deleteTarget = null;
  const inp = document.getElementById('cust-delete-input');
  if (inp) inp.value = '';
  const cb = document.getElementById('cust-deleteConfirmBtn');
  if (cb) { cb.disabled = true; cb.style.opacity = '.5'; }
}

// ═══════════════════════════════════════════════════════════
// PANEL 2: REGISTRI PELANGGAN
// ═══════════════════════════════════════════════════════════

async function loadRegistry() {
  document.getElementById('reg-tbody').innerHTML = loadingRow(8);
  try {
    const b = () => window.API_BASE;
    const h = () => window.getAuthHeaders();
    const res  = await fetch(`${b()}/api/admin/customer-registry`, { headers: h(), cache: 'no-cache' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    allRegistry = data.registry || [];
    renderRegistry(allRegistry);
    updateRegistryStats();
    // Badge di tab
    const unused = allRegistry.filter(r => !r.isUsed).length;
    setEl('registry-count-badge', allRegistry.length);
  } catch (e) {
    document.getElementById('reg-tbody').innerHTML =
      errorRow(8, e.message, 'window.CustomersPage.refresh()');
  }
}

function renderRegistry(list) {
  const tbody = document.getElementById('reg-tbody');
  if (!list.length) {
    tbody.innerHTML = emptyRow(8, 'fas fa-list-alt',
      'Belum ada data registri',
      'Import CSV atau tambah manual untuk mulai');
    return;
  }
  tbody.innerHTML = list.map(r => {
    const badge = r.isUsed
      ? `<span class="reg-status-used"><i class="fas fa-check-circle" style="font-size:10px;"></i> Sudah Daftar</span>`
      : `<span class="reg-status-unused"><i class="fas fa-clock" style="font-size:10px;"></i> Belum Daftar</span>`;
    const addr   = r.address ? escHtml(r.address) : `<span style="color:var(--gray);font-style:italic;">–</span>`;
    const usedAt = r.usedAt  ? formatDate(r.usedAt) : `<span style="color:var(--gray);">–</span>`;
    return `
      <tr>
        <td><strong>#${r.id}</strong></td>
        <td>${escHtml(r.name)}</td>
        <td>
          <code style="background:var(--light);padding:2px 7px;border-radius:4px;font-size:12px;">
            ${escHtml(r.phone)}
          </code>
        </td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${addr}</td>
        <td>${badge}</td>
        <td style="white-space:nowrap;font-size:12px;">${formatDate(r.importedAt)}</td>
        <td style="white-space:nowrap;font-size:12px;">${usedAt}</td>
        <td class="action-btns">
          ${!r.isUsed ? `
            <button class="btn-sm btn-edit"   data-raction="edit-reg"   data-rid="${r.id}">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn-sm btn-delete" data-raction="delete-reg" data-rid="${r.id}"
              data-rname="${escHtml(r.name)}">
              <i class="fas fa-trash"></i>
            </button>
          ` : `<span style="color:var(--gray);font-size:12px;font-style:italic;">–</span>`}
        </td>
      </tr>`;
  }).join('');
  tbody.addEventListener('click', onRegistryTableClick);
}

function updateRegistryStats() {
  const used   = allRegistry.filter(r => r.isUsed).length;
  const unused = allRegistry.filter(r => !r.isUsed).length;
  setEl('reg-stat-total',  allRegistry.length);
  setEl('reg-stat-used',   used);
  setEl('reg-stat-unused', unused);
}

function filterRegistry() {
  const q  = (document.getElementById('reg-search')?.value || '').toLowerCase();
  const st = document.getElementById('reg-statusFilter')?.value || '';
  renderRegistry(allRegistry.filter(r => {
    const mq = !q || `${r.name} ${r.phone} ${r.address||''}`.toLowerCase().includes(q);
    const ms = !st || (st === 'used' ? r.isUsed : !r.isUsed);
    return mq && ms;
  }));
}

function onRegistryTableClick(e) {
  const btn = e.target.closest('[data-raction]'); if (!btn) return;
  const { raction, rid, rname } = btn.dataset;
  if (raction === 'edit-reg')   openEditRegistry(Number(rid));
  if (raction === 'delete-reg') deleteRegistry(Number(rid), rname);
}

async function deleteRegistry(id, name) {
  if (!confirm(`Hapus registri "${name}" dari whitelist?\nPelanggan tidak bisa daftar lagi dengan no. HP ini.`)) return;
  try {
    const b = () => window.API_BASE;
    const h = () => window.getAuthHeaders();
    const res = await fetch(`${b()}/api/admin/customer-registry/${id}`, { method: 'DELETE', headers: h() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showNotif(`✅ Registri "${name}" berhasil dihapus`);
    await loadRegistry();
  } catch (e) { alert(`❌ ${e.message}`); }
}

function openEditRegistry(id) {
  const r = allRegistry.find(x => x.id === id); if (!r) return;
  document.getElementById('reg-add-name').value    = r.name    || '';
  document.getElementById('reg-add-phone').value   = r.phone   || '';
  document.getElementById('reg-add-address').value = r.address || '';
  document.getElementById('reg-add-note').value    = r.note    || '';
  setEl('reg-add-error', '');
  openModal('reg-addModal');
  // Tandai sebagai edit
  document.getElementById('reg-addModal').dataset.editId = id;
  document.getElementById('reg-addSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Update';
}

// ── Modal Add Registry ──
function openAddRegistry() {
  ['reg-add-name','reg-add-phone','reg-add-address','reg-add-note']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  setEl('reg-add-error', '');
  delete document.getElementById('reg-addModal').dataset.editId;
  document.getElementById('reg-addSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Simpan';
  openModal('reg-addModal');
  document.getElementById('reg-add-name')?.focus();
}
function closeAddRegistry() { closeModal('reg-addModal'); }

async function submitAddRegistry() {
  const name    = v('reg-add-name'), phone = v('reg-add-phone');
  const address = v('reg-add-address'), note = v('reg-add-note');
  const err = document.getElementById('reg-add-error');
  const btn = document.getElementById('reg-addSubmitBtn');
  err.textContent = '';
  if (!name)  { err.textContent = '⚠️ Nama wajib diisi'; return; }
  if (!phone) { err.textContent = '⚠️ No. HP wajib diisi'; return; }
  if (!/^[0-9+\s-]+$/.test(phone)) { err.textContent = '⚠️ Format nomor HP tidak valid'; return; }

  const editId = document.getElementById('reg-addModal').dataset.editId;
  const isEdit = !!editId;
  const b = () => window.API_BASE;
  const h = () => window.getAuthHeaders();
  setLoading(btn, true, '');
  try {
    const url    = isEdit ? `${b()}/api/admin/customer-registry/${editId}` : `${b()}/api/admin/customer-registry`;
    const method = isEdit ? 'PATCH' : 'POST';
    const res    = await fetch(url, {
      method, headers: { ...h(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, address: address || null, note: note || null })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    closeAddRegistry();
    showNotif(isEdit ? '✅ Data registri diperbarui' : `✅ Registri "${name}" berhasil ditambahkan`);
    await loadRegistry();
  } catch (e) { err.textContent = `❌ ${e.message}`; }
  finally { setLoading(btn, false, '<i class="fas fa-save"></i> Simpan'); }
}

// ═══════════════════════════════════════════════════════════
// IMPORT CSV
// ═══════════════════════════════════════════════════════════

function openImport() {
  clearCsvFile();
  setEl('reg-import-error', '');
  document.getElementById('reg-importResult').style.display = 'none';
  document.getElementById('reg-importProgress').style.display = 'none';
  openModal('reg-importModal');
}
function closeImport() { closeModal('reg-importModal'); clearCsvFile(); }

window.clearCsvFile = function() {
  document.getElementById('reg-csvFile').value       = '';
  document.getElementById('reg-filePreview').style.display  = 'none';
  document.getElementById('reg-previewTable').style.display = 'none';
  document.getElementById('reg-csvErrors').style.display    = 'none';
  document.getElementById('reg-importResult').style.display = 'none';
  document.getElementById('reg-submitImportBtn').disabled   = true;
  csvParsedRows = [];
};

window.handleCsvDrop = function(e) {
  e.preventDefault();
  document.getElementById('reg-dropzone').style.borderColor = 'var(--border)';
  document.getElementById('reg-dropzone').style.background  = 'transparent';
  const file = e.dataTransfer.files[0];
  if (file) processCsvFile(file);
};

function processCsvFile(file) {
  if (!file.name.endsWith('.csv')) {
    setEl('reg-import-error', '⚠️ Hanya file .csv yang diterima');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    setEl('reg-import-error', '⚠️ Ukuran file maksimal 2MB');
    return;
  }

  // Tampilkan info file
  document.getElementById('reg-filePreview').style.display = '';
  setEl('reg-fileName', file.name);
  setEl('reg-fileSize', `(${(file.size / 1024).toFixed(1)} KB)`);
  setEl('reg-import-error', '');

  const reader = new FileReader();
  reader.onload = (ev) => parseCsv(ev.target.result);
  reader.readAsText(file);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    setEl('reg-import-error', '⚠️ File CSV kosong atau hanya ada header');
    return;
  }

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/['"]/g, ''));
  const nameIdx    = header.indexOf('name');
  const phoneIdx   = header.indexOf('phone');
  const addressIdx = header.indexOf('address');

  if (nameIdx === -1 || phoneIdx === -1) {
    setEl('reg-import-error', '⚠️ Header CSV harus mengandung kolom "name" dan "phone"');
    return;
  }

  const rows      = [];
  const errors    = [];
  const seenPhone = new Set();

  for (let i = 1; i < Math.min(lines.length, 501); i++) {
    const cols    = splitCsvLine(lines[i]);
    const name    = (cols[nameIdx]    || '').trim().replace(/^['"]+|['"]+$/g, '');
    const phone   = (cols[phoneIdx]   || '').trim().replace(/^['"]+|['"]+$/g, '').replace(/[\s-]/g, '');
    const address = (cols[addressIdx] || '').trim().replace(/^['"]+|['"]+$/g, '');

    let status = 'valid';
    if (!name)                                    { status = 'invalid'; errors.push(`Baris ${i}: Nama kosong`); }
    else if (!phone)                              { status = 'invalid'; errors.push(`Baris ${i}: No. HP kosong`); }
    else if (!/^[0-9+]{9,15}$/.test(phone))      { status = 'invalid'; errors.push(`Baris ${i}: Format no. HP tidak valid (${phone})`); }
    else if (seenPhone.has(phone))                { status = 'dup';     errors.push(`Baris ${i}: No. HP duplikat dalam file (${phone})`); }

    if (phone) seenPhone.add(phone);
    rows.push({ name, phone, address, status, line: i });
  }

  csvParsedRows = rows.filter(r => r.status === 'valid');

  // Tampilkan preview tabel
  const tbody = document.getElementById('reg-previewBody');
  tbody.innerHTML = rows.slice(0, 20).map(r => {
    const cls = r.status === 'valid' ? 'csv-row-valid' : r.status === 'dup' ? 'csv-row-dup' : 'csv-row-invalid';
    const ico = r.status === 'valid' ? '✅' : r.status === 'dup' ? '⚠️' : '❌';
    return `<tr class="${cls}">
      <td>${r.line}</td>
      <td>${escHtml(r.name)}</td>
      <td>${escHtml(r.phone)}</td>
      <td>${escHtml(r.address)}</td>
      <td>${ico} ${r.status}</td>
    </tr>`;
  }).join('');
  if (rows.length > 20) {
    tbody.innerHTML += `<tr><td colspan="5" style="text-align:center;color:var(--gray);padding:8px;">
      ... dan ${rows.length - 20} baris lainnya</td></tr>`;
  }
  document.getElementById('reg-previewTable').style.display = '';

  // Tampilkan errors
  if (errors.length) {
    document.getElementById('reg-csvErrors').style.display = '';
    document.getElementById('reg-csvErrors').innerHTML =
      `<strong>⚠️ ${errors.length} baris bermasalah (akan diskip):</strong><br>` +
      errors.slice(0, 10).map(e => `• ${e}`).join('<br>') +
      (errors.length > 10 ? `<br>• ... dan ${errors.length - 10} lainnya` : '');
  }

  // Enable tombol import jika ada data valid
  document.getElementById('reg-submitImportBtn').disabled = csvParsedRows.length === 0;
  if (csvParsedRows.length === 0) {
    setEl('reg-import-error', '⚠️ Tidak ada data valid yang bisa diimport');
  } else {
    setEl('reg-import-error', `✅ ${csvParsedRows.length} data siap diimport`);
    document.getElementById('reg-import-error').style.color = 'var(--success)';
  }
}

// Helper: split CSV line dengan benar (handle quoted commas)
function splitCsvLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

async function submitImport() {
  if (!csvParsedRows.length) return;
  const btn  = document.getElementById('reg-submitImportBtn');
  const prog = document.getElementById('reg-importProgress');
  const bar  = document.getElementById('reg-progressBar');
  const pTxt = document.getElementById('reg-progressText');
  const errEl = document.getElementById('reg-import-error');

  setLoading(btn, true, '');
  prog.style.display = '';
  errEl.textContent  = '';
  errEl.style.color  = 'var(--danger)';

  const total = csvParsedRows.length;
  let ok = 0, dup = 0, fail = 0;

  // Kirim dalam batch ke API
  try {
    const b = () => window.API_BASE;
    const h = () => window.getAuthHeaders();

    // Kirim semua sekaligus ke endpoint batch
    const res = await fetch(`${b()}/api/admin/customer-registry/import`, {
      method : 'POST',
      headers: { ...h(), 'Content-Type': 'application/json' },
      body   : JSON.stringify({ rows: csvParsedRows })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    ok   = data.imported || 0;
    dup  = data.updated  || 0;
    fail = data.failed   || 0;

    // Animasi progress sampai 100%
    let p = 0;
    const timer = setInterval(() => {
      p = Math.min(p + 5, 100);
      bar.style.width  = p + '%';
      pTxt.textContent = p + '%';
      if (p >= 100) clearInterval(timer);
    }, 30);

    await new Promise(r => setTimeout(r, 700));

  } catch (e) {
    // Fallback: kirim satu per satu jika endpoint batch tidak ada
    for (let i = 0; i < csvParsedRows.length; i++) {
      const row = csvParsedRows[i];
      try {
        const b = () => window.API_BASE;
        const h = () => window.getAuthHeaders();
        const res = await fetch(`${b()}/api/admin/customer-registry`, {
          method : 'POST',
          headers: { ...h(), 'Content-Type': 'application/json' },
          body   : JSON.stringify({ name: row.name, phone: row.phone, address: row.address || null })
        });
        const d = await res.json();
        if (res.status === 409) dup++;         // duplicate
        else if (!res.ok) { fail++; }
        else ok++;
      } catch { fail++; }

      // Update progress
      const pct = Math.round(((i + 1) / total) * 100);
      bar.style.width  = pct + '%';
      pTxt.textContent = pct + '%';
    }
  }

  // Tampilkan hasil
  const resultEl = document.getElementById('reg-importResult');
  resultEl.style.display = '';
  resultEl.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;">
      <div style="text-align:center;padding:12px;background:#d1fae5;border-radius:8px;">
        <div style="font-size:22px;font-weight:800;color:#065f46;">${ok}</div>
        <div style="font-size:11px;color:#065f46;font-weight:600;">Berhasil Import</div>
      </div>
      <div style="text-align:center;padding:12px;background:#fef3c7;border-radius:8px;">
        <div style="font-size:22px;font-weight:800;color:#92400e;">${dup}</div>
        <div style="font-size:11px;color:#92400e;font-weight:600;">Duplikat (diupdate)</div>
      </div>
      <div style="text-align:center;padding:12px;background:#fee2e2;border-radius:8px;">
        <div style="font-size:22px;font-weight:800;color:#991b1b;">${fail}</div>
        <div style="font-size:11px;color:#991b1b;font-weight:600;">Gagal</div>
      </div>
    </div>`;

  showNotif(`✅ Import selesai: ${ok} berhasil, ${dup} diupdate, ${fail} gagal`);
  await loadRegistry();

  setLoading(btn, false, '<i class="fas fa-upload"></i> Import Lagi');
  btn.disabled = true;
}

// ── Download Template CSV ──
function downloadTemplate() {
  const csv = 'name,phone,address\nBudi Santoso,081234567890,Jl. Mawar No.1 Madiun\nSiti Rahayu,082345678901,Jl. Melati No.2 Madiun\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'template_pelanggan.csv';
  a.click(); URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════
// LISTENERS
// ═══════════════════════════════════════════════════════════

function setupListeners() {
  // ── Tab ──
  // (switchTab sudah global)

  // ── Panel Pelanggan ──
  document.getElementById('cust-search')       ?.addEventListener('input',  filterCustomers);
  document.getElementById('cust-statusFilter') ?.addEventListener('change', filterCustomers);
  document.getElementById('cust-refreshBtn')   ?.addEventListener('click',  load);
  document.getElementById('cust-openAddBtn')   ?.addEventListener('click',  openAdd);
  document.getElementById('cust-addSubmitBtn') ?.addEventListener('click',  submitAdd);
  document.getElementById('cust-closeAddBtn')  ?.addEventListener('click',  closeAdd);
  document.getElementById('cust-addModal')     ?.addEventListener('click',  e => { if (e.target === e.currentTarget) closeAdd(); });
  document.getElementById('cust-editSubmitBtn')?.addEventListener('click',  submitEdit);
  document.getElementById('cust-closeEditBtn') ?.addEventListener('click',  closeEdit);
  document.getElementById('cust-cancelEditBtn')?.addEventListener('click',  closeEdit);
  document.getElementById('cust-editModal')    ?.addEventListener('click',  e => { if (e.target === e.currentTarget) closeEdit(); });
  document.getElementById('cust-deleteConfirmBtn')?.addEventListener('click', confirmDelete);
  document.getElementById('cust-closeDeleteBtn')  ?.addEventListener('click', closeDeleteModal);
  document.getElementById('cust-cancelDeleteBtn') ?.addEventListener('click', closeDeleteModal);
  document.getElementById('cust-deleteModal')     ?.addEventListener('click', e => { if (e.target === e.currentTarget) closeDeleteModal(); });
  document.getElementById('cust-delete-input')    ?.addEventListener('input', function() {
    const cb = document.getElementById('cust-deleteConfirmBtn');
    const ok = this.value.trim().toLowerCase() === deleteTarget?.name?.toLowerCase();
    if (cb) { cb.disabled = !ok; cb.style.opacity = ok ? '1' : '.5'; }
  });
  document.getElementById('cust-selectAll')?.addEventListener('change', function() {
    document.querySelectorAll('.cust-chk').forEach(cb => {
      cb.checked = this.checked;
      if (this.checked) selectedIds.add(cb.dataset.id);
      else selectedIds.delete(cb.dataset.id);
    });
    updateBulkBtns();
  });
  document.getElementById('cust-bulkApproveBtn')?.addEventListener('click', () => bulkPatch('active',   'Aktifkan'));
  document.getElementById('cust-bulkDeactBtn')  ?.addEventListener('click', () => bulkPatch('inactive', 'Nonaktifkan'));

  // ── Panel Registri ──
  document.getElementById('reg-search')       ?.addEventListener('input',  filterRegistry);
  document.getElementById('reg-statusFilter') ?.addEventListener('change', filterRegistry);
  document.getElementById('reg-refreshBtn')   ?.addEventListener('click',  loadRegistry);
  document.getElementById('reg-openAddBtn')   ?.addEventListener('click',  openAddRegistry);
  document.getElementById('reg-closeAddBtn')  ?.addEventListener('click',  closeAddRegistry);
  document.getElementById('reg-cancelAddBtn') ?.addEventListener('click',  closeAddRegistry);
  document.getElementById('reg-addModal')     ?.addEventListener('click',  e => { if (e.target === e.currentTarget) closeAddRegistry(); });
  document.getElementById('reg-addSubmitBtn') ?.addEventListener('click',  submitAddRegistry);

  // ── Import CSV ──
  document.getElementById('reg-importBtn')         ?.addEventListener('click',  openImport);
  document.getElementById('reg-closeImportBtn')    ?.addEventListener('click',  closeImport);
  document.getElementById('reg-cancelImportBtn')   ?.addEventListener('click',  closeImport);
  document.getElementById('reg-submitImportBtn')   ?.addEventListener('click',  submitImport);
  document.getElementById('reg-importModal')       ?.addEventListener('click',  e => { if (e.target === e.currentTarget) closeImport(); });
  document.getElementById('reg-downloadTemplate')  ?.addEventListener('click',  e => { e.preventDefault(); downloadTemplate(); });
  document.getElementById('reg-csvFile')?.addEventListener('change', function() {
    if (this.files[0]) processCsvFile(this.files[0]);
  });

  // ── Global escape ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAdd(); closeEdit(); closeDeleteModal();
      closeAddRegistry(); closeImport();
    }
  });
}

const v = id => document.getElementById(id)?.value.trim() || '';

window.CustomersPage = { refresh };
// pages/monitoring.js
import { escHtml, setEl, timeAgo, showNotif } from '../modules/helpers.js';
import { fetchTickets, fetchCustomers, fetchTechnicians } from '../modules/api.js';

let trendChart    = null;
let pieChart      = null;
let cachedTickets = [];
let trendPeriod   = 7;

export function init() {
  console.log('[Monitoring] 🚀 init');
  initCharts();
  setupListeners();
  load();
}

export function cleanup() {
  destroyCharts();
  cachedTickets = [];
}

export const refresh = () => load();

// ── Charts ────────────────────────────────────────────────────
function destroyCharts() {
  if (trendChart) { try { trendChart.destroy(); } catch(e){} trendChart = null; }
  if (pieChart)   { try { pieChart.destroy();   } catch(e){} pieChart   = null; }
}

function initCharts() {
  destroyCharts();

  const trendEl = document.getElementById('mon-trendChart');
  if (trendEl) {
    trendChart = new Chart(trendEl.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Ticket Masuk',
            data: [], borderColor: '#667eea',
            backgroundColor: 'rgba(102,126,234,0.12)',
            tension: 0.4, fill: true,
            pointBackgroundColor: '#667eea', pointBorderColor: '#fff',
            pointBorderWidth: 2, pointRadius: 5
          },
          {
            label: 'Ticket Closed',
            data: [], borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.12)',
            tension: 0.4, fill: true,
            pointBackgroundColor: '#10b981', pointBorderColor: '#fff',
            pointBorderWidth: 2, pointRadius: 5
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position:'top', labels:{ usePointStyle:true, padding:16, font:{ size:13, weight:'600' } } },
          tooltip: { backgroundColor:'rgba(15,23,42,.9)', padding:12, cornerRadius:8 }
        },
        scales: {
          y: { beginAtZero:true, ticks:{ precision:0 }, grid:{ color:'rgba(0,0,0,.04)' } },
          x: { grid:{ display:false } }
        }
      }
    });
  }

  const pieEl = document.getElementById('mon-pieChart');
  if (pieEl) {
    pieChart = new Chart(pieEl.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Open', 'Assigned', 'In Progress', 'Closed'],
        datasets: [{ data: [0,0,0,0], backgroundColor: ['#f59e0b','#fb923c','#8b5cf6','#10b981'], borderWidth: 0, hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position:'bottom', labels:{ padding:16, usePointStyle:true, font:{ size:13 } } },
          tooltip: {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a,b)=>a+b, 0);
                const pct   = total > 0 ? ((ctx.parsed/total)*100).toFixed(1) : '0';
                return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }
}

// ── Data ──────────────────────────────────────────────────────
async function load() {
  try {
    const [ticketsRes, customersRes, techRes] = await Promise.all([
      fetchTickets(),
      fetchCustomers().catch(() => []),
      fetchTechnicians().catch(() => ({ technicians: [] }))
    ]);

    cachedTickets = Array.isArray(ticketsRes) ? ticketsRes : (ticketsRes.tickets || []);
    const customers    = Array.isArray(customersRes) ? customersRes : (customersRes.customers || []);
    const technicians  = techRes.technicians || [];

    updateStats(cachedTickets, customers, technicians);
    updateCharts(cachedTickets, trendPeriod);
    renderRecentTickets(cachedTickets);
  } catch (e) {
    console.error('[Monitoring] ❌', e);
    const tbody = document.getElementById('mon-recent-tbody');
    if (tbody) tbody.innerHTML = `
      <tr><td colspan="7" style="text-align:center;padding:60px;color:var(--danger);">
        <i class="fas fa-exclamation-triangle" style="font-size:48px;opacity:.3;display:block;margin-bottom:12px;"></i>
        <p style="font-weight:600;">Gagal memuat data</p>
        <p style="opacity:.7;font-size:13px;margin:8px 0 16px;">${e.message}</p>
        <button onclick="window.MonitoringPage.refresh()" class="btn btn-refresh"><i class="fas fa-sync-alt"></i> Coba Lagi</button>
      </td></tr>`;
  }
}

// ── Stats ─────────────────────────────────────────────────────
function updateStats(tickets, customers, technicians) {
  const open      = tickets.filter(t => t.status==='open').length;
  const assigned  = tickets.filter(t => t.status==='assigned').length;
  const inProg    = tickets.filter(t => t.status==='in-progress').length;
  const closed    = tickets.filter(t => t.status==='closed').length;
  const inactive  = customers.filter(c => c.status==='inactive').length;
  const totalPhotos = tickets.reduce((s,t) => s + (t.photos?.length||0), 0);
  setEl('mon-stat-total',    tickets.length);
  setEl('mon-stat-open',     open);
  setEl('mon-stat-assigned', assigned);
  setEl('mon-stat-inprogress', inProg);
  setEl('mon-stat-closed',   closed);
  setEl('mon-stat-inactive', inactive);
  setEl('mon-stat-tech',     technicians.length);
  setEl('mon-stat-photos',   totalPhotos);
}

// ── Charts ────────────────────────────────────────────────────
function updateCharts(tickets, days) {
  const labels = [], ticketCounts = [], resolvedCounts = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    const dayLabel = days <= 7
      ? ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()]
      : `${d.getDate()}/${d.getMonth()+1}`;
    labels.push(dayLabel);
    const dayTk = tickets.filter(t => new Date(t.createdAt).toDateString() === dateStr);
    ticketCounts.push(dayTk.length);
    resolvedCounts.push(dayTk.filter(t => t.status==='closed').length);
  }
  if (trendChart) {
    trendChart.data.labels              = labels;
    trendChart.data.datasets[0].data    = ticketCounts;
    trendChart.data.datasets[1].data    = resolvedCounts;
    trendChart.update();
  }
  if (pieChart) {
    pieChart.data.datasets[0].data = [
      tickets.filter(t=>t.status==='open').length,
      tickets.filter(t=>t.status==='assigned').length,
      tickets.filter(t=>t.status==='in-progress').length,
      tickets.filter(t=>t.status==='closed').length,
    ];
    pieChart.update();
  }
}

// ── Recent tickets table ──────────────────────────────────────
function renderRecentTickets(tickets) {
  const tbody = document.getElementById('mon-recent-tbody'); if (!tbody) return;
  const recent = [...tickets].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,10);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:60px;color:var(--gray);"><i class="fas fa-inbox" style="font-size:48px;opacity:.2;display:block;margin-bottom:12px;"></i>Belum ada ticket</td></tr>`;
    return;
  }
  const stMap = {
    'open':        { cls:'badge-warning', text:'Open' },
    'assigned':    { cls:'badge-warning', text:'Assigned', style:'background:#ffedd5;color:#9a3412;' },
    'in-progress': { cls:'badge-primary', text:'In Progress' },
    'closed':      { cls:'badge-success', text:'Closed' }
  };
  const prMap = { 'high':'badge-danger','medium':'badge-warning','low':'badge-info' };
  tbody.innerHTML = recent.map(t => {
    const st      = stMap[t.status] || { cls:'badge-gray', text: t.status };
    const prioCls = prMap[(t.priority||'low').toLowerCase()] || 'badge-info';
    const techName = t.currentTechnician?.name || t.assignments?.[0]?.technician?.name || null;
    const techHTML = techName
      ? `<span style="font-size:12px;"><i class="fas fa-hard-hat" style="color:var(--warning);"></i> ${escHtml(techName)}</span>`
      : `<span style="color:var(--gray);font-style:italic;font-size:12px;">—</span>`;
    return `
      <tr>
        <td><strong>${t.ticketNumber || '#' + t.id}</strong></td>
        <td>${escHtml(t.user?.name||'Unknown')}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(t.title)}">${escHtml(t.title)}</td>
        <td><span class="badge ${prioCls}">${capitalize(t.priority||'low')}</span></td>
        <td><span class="badge ${st.cls}" ${st.style?`style="${st.style}"`:''}">${st.text}</span></td>
        <td>${techHTML}</td>
        <td style="white-space:nowrap;">${timeAgo(t.createdAt)}</td>
      </tr>`;
  }).join('');
}

// ── Listeners ─────────────────────────────────────────────────
function setupListeners() {
  document.getElementById('mon-refreshBtn')?.addEventListener('click', load);
  document.getElementById('mon-trendPeriod')?.addEventListener('change', function() {
    trendPeriod = parseInt(this.value);
    if (cachedTickets.length) updateCharts(cachedTickets, trendPeriod);
  });
}

const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

window.MonitoringPage = { refresh };
const b = () => window.API_BASE;
const h = () => window.getAuthHeaders();

async function req(path, opts = {}) {
  const { headers: extraHeaders, ...restOpts } = opts;
  const res = await fetch(`${b()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...h(),
      ...extraHeaders
    },
    ...restOpts
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Customers ─────────────────────────────────────────────────
export const fetchCustomers       = ()         => req('/api/customers', { cache: 'no-cache' });
export const patchCustomer        = (id, body) => req(`/api/customers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const createCustomer = (body) => req('/api/admin/customers', { method: 'POST', body: JSON.stringify(body) });
export const deleteCustomer       = (id, confirm = false) =>
  req(`/api/customers/${id}${confirm ? '?confirmDelete=true' : ''}`, { method: 'DELETE' });

// ── Technicians ───────────────────────────────────────────────
export const fetchTechnicians     = ()         => req('/api/technicians',     { cache: 'no-cache' });
export const fetchAllTechnicians  = ()         => req('/api/technicians/all', { cache: 'no-cache' });
export const patchTechnician      = (id, body) => req(`/api/technicians/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteTechnician     = (id)       => req(`/api/technicians/${id}`, { method: 'DELETE' });

// ── Tickets ───────────────────────────────────────────────────
export const fetchTickets         = ()         => req('/api/tickets',         { cache: 'no-cache' });
export const fetchTicket          = (id)       => req(`/api/tickets/${id}`);
export const patchTicket          = (id, body) => req(`/api/tickets/${id}`,   { method: 'PATCH', body: JSON.stringify(body) });
export const assignTicket         = (id, body) => req(`/api/tickets/${id}/assign`, { method: 'POST', body: JSON.stringify(body) });
export const fetchTicketPhotos    = (id)       => req(`/api/tickets/${id}/photos`);
export const confirmTicket        = (id, action) => req(`/api/tickets/${id}/confirm`, { method: 'POST', body: JSON.stringify({ action }) });
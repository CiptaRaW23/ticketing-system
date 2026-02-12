// auth.js - Authentication helper functions

const host = window.location.hostname;
const API_BASE = `http://${host}:3000`;

// Get token from localStorage
function getToken() {
  return localStorage.getItem('adminToken');
}

// Get authorization headers
function getAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Check if user is authenticated
async function checkAuth() {
  const token = getToken();
  if (!token) {
    return false;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/user/profile`, {
      headers: getAuthHeaders()
    });
    
    if (!res.ok) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminName');
      return false;
    }
    
    const data = await res.json();
    
    if (data.user.role !== 'admin') {
      alert('Akses ditolak. Hanya admin yang bisa masuk.');
      localStorage.clear();
      return false;
    }
    
    // Update admin name in UI
    const adminName = data.user.name || 'Admin';
    localStorage.setItem('adminName', adminName);
    
    const nameElements = document.querySelectorAll('.admin-name, #sidebar-admin-name, #admin-name-header');
    nameElements.forEach(el => {
      if (el) el.textContent = adminName;
    });
    
    return true;
  } catch (err) {
    console.error('Auth check failed:', err);
    localStorage.clear();
    return false;
  }
}

// Logout function
function logout() {
  if (confirm('Yakin ingin logout?')) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    window.location.href = '/login.html';
  }
}

// Export functions to window for global access
window.getToken = getToken;
window.getAuthHeaders = getAuthHeaders;
window.checkAuth = checkAuth;
window.logout = logout;
window.API_BASE = API_BASE;
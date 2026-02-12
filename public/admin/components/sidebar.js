// sidebar.js - Sidebar functionality

// Toggle sidebar on mobile
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

// Close sidebar when clicking outside (mobile only)
document.addEventListener('click', function(event) {
  if (window.innerWidth <= 992) {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger-mobile');
    
    if (sidebar.classList.contains('open') && 
        !sidebar.contains(event.target) && 
        !hamburger.contains(event.target)) {
      sidebar.classList.remove('open');
    }
  }
});

// Export to window
window.toggleSidebar = toggleSidebar;
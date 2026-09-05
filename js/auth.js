/**
 * HoraPix - Authentication & Route Guard Helpers
 */

const Auth = {
  getToken() {
    return localStorage.getItem('horapix_token');
  },

  getUser() {
    const user = localStorage.getItem('horapix_user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  saveSession(token, user) {
    localStorage.setItem('horapix_token', token);
    localStorage.setItem('horapix_user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('horapix_token');
    localStorage.removeItem('horapix_user');
    window.location.href = 'login.html';
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
    }
  },

  requireAdmin() {
    this.requireAuth();
    const user = this.getUser();
    if (user && user.role !== 'admin') {
      window.location.href = 'dashboard.html';
    }
  }
};

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}
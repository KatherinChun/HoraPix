/**
 * HoraPix - API Client Module
 * Centralized service to handle FastAPI endpoints communication
 */

const API_BASE_URL = 'http://localhost:8000/api'; // Adjust base URL as needed

const API = {
  // Helper for fetch options
  getHeaders(isJSON = true) {
    const headers = {};
    if (isJSON) headers['Content-Type'] = 'application/json';
    const token = localStorage.getItem('horapix_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultHeaders = this.getHeaders(options.isJSON ?? true);
    
    const config = {
      ...options,
      headers: { ...defaultHeaders, ...options.headers }
    };

    try {
      const response = await fetch(url, config);
      if (response.status === 401) {
        // Unauthorized - Clear token and redirect to login
        localStorage.removeItem('horapix_token');
        localStorage.removeItem('horapix_user');
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = 'login.html';
        }
        throw new Error('Sesión expirada');
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Ocurrió un error en la solicitud');
      }
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  // Auth Endpoints
  auth: {
    login: (credentials) => API.request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (userData) => API.request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    getProfile: () => API.request('/auth/me', { method: 'GET' })
  },

  // Citas (Appointments) Endpoints
  citas: {
    getAll: (params = '') => API.request(`/citas/${params ? '?' + params : ''}`, { method: 'GET' }),
    getByUser: () => API.request('/citas/mis-citas', { method: 'GET' }),
    create: (citaData) => API.request('/citas/', { method: 'POST', body: JSON.stringify(citaData) }),
    updateStatus: (id, status) => API.request(`/citas/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    cancel: (id) => API.request(`/citas/${id}/cancelar`, { method: 'POST' })
  },

  // Public / Services Endpoints
  publico: {
    getServicios: () => API.request('/publico/servicios', { method: 'GET' }),
    getDisponibilidad: (fecha, servicioId) => API.request(`/publico/disponibilidad?fecha=${fecha}&servicio_id=${servicioId}`, { method: 'GET' }),
    crearCitaPublica: (datos) => API.request('/publico/agendar', { method: 'POST', body: JSON.stringify(datos) })
  },

  // Admin & Reports
  reportes: {
    getResumen: () => API.request('/reportes/resumen', { method: 'GET' }),
    getClientes: () => API.request('/clientes/', { method: 'GET' })
  }
};
import axios from 'axios';

// In production (Render), the frontend and backend are on SEPARATE domains.
// VITE_API_URL must be set in the build environment, or we detect production and use the known URL.
function resolveBackendUrl() {
  // 1. If VITE_API_URL is explicitly set, always use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 2. In production on Render: frontend is crash-sense-web, backend is crash-sense-api
  if (typeof window !== 'undefined' && window.location.hostname.includes('crash-sense-web')) {
    return 'https://crash-sense-api.onrender.com';
  }

  // 3. Local development: use relative paths (same origin via Vite proxy or same server)
  return '';
}

export const backendUrl = resolveBackendUrl();
const api = axios.create({ baseURL: backendUrl ? `${backendUrl}/api` : '/api' });

export const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  // If no backendUrl (local dev), use relative path
  if (!backendUrl) return `/${cleanPath}`;
  return `${backendUrl}/${cleanPath}`;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crashsense_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('crashsense_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

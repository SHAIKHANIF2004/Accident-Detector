import axios from 'axios';

// In production, set VITE_API_URL to the backend's public URL (e.g. Railway, Vercel, etc.)
// In local dev, leave it unset — Vite proxy handles /api and /socket.io requests.
function resolveBackendUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Local development: use relative paths (Vite proxy forwards to localhost:5000)
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

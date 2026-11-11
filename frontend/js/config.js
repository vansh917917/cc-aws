/**
 * Frontend Configuration for Student File Management System
 * 
 * Supports:
 * - Localhost development (defaults to http://localhost:5000/api)
 * - AWS Load Balancer deployment (automatically routes to /api on the same host)
 * - Manual override in the UI via the API Connection button
 */

function resolveDefaultApiBase() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    if (window.location.protocol.startsWith('http')) {
      // If served via Nginx behind an ALB or on an EC2 instance, /api routes directly
      if (window.location.port !== '5500' && window.location.port !== '3000' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return `${window.location.origin}/api`;
      }
    }
  }
  return 'http://localhost:5000/api';
}

const DEFAULT_API_BASE = resolveDefaultApiBase();

window.APP_CONFIG = {
  getApiBaseUrl() {
    const saved = localStorage.getItem('STUDENT_FILES_API_BASE');
    if (saved && saved.trim() !== '') {
      return saved.trim().replace(/\/+$/, '');
    }
    return (window.__API_BASE_URL__ || resolveDefaultApiBase()).replace(/\/+$/, '');
  },

  setApiBaseUrl(url) {
    if (!url || url.trim() === '') {
      localStorage.removeItem('STUDENT_FILES_API_BASE');
    } else {
      localStorage.setItem('STUDENT_FILES_API_BASE', url.trim().replace(/\/+$/, ''));
    }
  },

  resetApiBaseUrl() {
    localStorage.removeItem('STUDENT_FILES_API_BASE');
  },

  defaultUrl: DEFAULT_API_BASE
};

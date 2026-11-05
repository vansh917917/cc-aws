/**
 * Frontend Configuration for Student File Management System
 * 
 * When deploying to AWS:
 * - Update DEFAULT_API_BASE to your Backend EC2 instance public IP or DNS.
 *   Example: 'http://54.210.120.45:5000/api' or 'https://api.yourdomain.com/api'
 * - In local development: 'http://localhost:5000/api'
 * 
 * Note: You can also override the API URL directly in the UI via the
 * "API Endpoint" settings button without modifying this file.
 */

const DEFAULT_API_BASE = 'http://localhost:5000/api';

window.APP_CONFIG = {
  // Return user-overridden URL from browser storage or the configured default
  getApiBaseUrl() {
    const saved = localStorage.getItem('STUDENT_FILES_API_BASE');
    if (saved && saved.trim() !== '') {
      return saved.trim().replace(/\/+$/, '');
    }
    return (window.__API_BASE_URL__ || DEFAULT_API_BASE).replace(/\/+$/, '');
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

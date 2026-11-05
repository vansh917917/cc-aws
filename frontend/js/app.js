/**
 * Student File Management System - Frontend Application Logic
 * Vanilla JavaScript implementation communicating with the Express REST API
 */

(function () {
  'use strict';

  // State
  const state = {
    files: [],
    stagedFile: null,
    uploadXhr: null,
    deleteTarget: null,
    isOnline: false,
    maxFileSizeMb: 15
  };

  // Blocked extensions matching backend security filters
  const BLOCKED_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.sh', '.bash', '.bin',
    '.msi', '.vbs', '.scr', '.pif', '.application',
    '.gadget', '.hta', '.cpl', '.msc', '.jar'
  ];

  // DOM Elements
  const elements = {
    // Topbar & Sidebar Status
    sidebarStatusDot: document.getElementById('sidebar-status-dot'),
    sidebarStatusText: document.getElementById('sidebar-status-text'),
    sidebarDriverText: document.getElementById('sidebar-driver-text'),
    topbarApiUrl: document.getElementById('topbar-api-url'),
    refreshBtn: document.getElementById('refresh-btn'),
    openSettingsBtn: document.getElementById('open-settings-btn'),

    // Metrics
    metricTotalFiles: document.getElementById('metric-total-files'),
    metricTotalSize: document.getElementById('metric-total-size'),
    metricStorageDriver: document.getElementById('metric-storage-driver'),
    metricBackendStatus: document.getElementById('metric-backend-status'),

    // Upload
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('file-input'),
    dropzoneEmptyState: document.getElementById('dropzone-empty-state'),
    stagedFileBox: document.getElementById('staged-file-box'),
    stagedFileName: document.getElementById('staged-file-name'),
    stagedFileMeta: document.getElementById('staged-file-meta'),
    stagedFileIcon: document.getElementById('staged-file-icon'),
    removeFileBtn: document.getElementById('remove-file-btn'),
    uploadBtn: document.getElementById('upload-btn'),
    cancelUploadBtn: document.getElementById('cancel-upload-btn'),
    progressContainer: document.getElementById('upload-progress-container'),
    progressBar: document.getElementById('upload-progress-bar'),
    progressStatus: document.getElementById('upload-progress-status'),
    progressPercent: document.getElementById('upload-progress-percent'),

    // Files Table & Search
    filesTable: document.getElementById('files-table'),
    filesTableBody: document.getElementById('files-table-body'),
    fileSearchInput: document.getElementById('file-search-input'),
    filesCountSubtitle: document.getElementById('files-count-subtitle'),
    emptyState: document.getElementById('empty-state'),
    emptySearchState: document.getElementById('empty-search-state'),

    // Modals
    deleteModal: document.getElementById('delete-modal'),
    deleteTargetFilename: document.getElementById('delete-target-filename'),
    confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
    cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
    cancelDeleteX: document.getElementById('cancel-delete-x'),

    settingsModal: document.getElementById('settings-modal'),
    settingsApiInput: document.getElementById('settings-api-input'),
    saveApiBtn: document.getElementById('save-api-btn'),
    resetApiBtn: document.getElementById('reset-api-btn'),
    cancelSettingsX: document.getElementById('cancel-settings-x'),

    toastContainer: document.getElementById('toast-container')
  };

  // Helper: Format bytes to human readable string
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Helper: Format ISO date string
  function formatDate(isoString) {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  }

  // Helper: Determine file badge label from extension
  function getExtensionBadge(filename) {
    if (!filename || !filename.includes('.')) return 'FILE';
    const ext = filename.split('.').pop().toUpperCase();
    return ext.length > 5 ? ext.substring(0, 4) : ext;
  }

  // Toast Notification System
  function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close" type="button" aria-label="Dismiss">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 4500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Check Backend Health
  async function checkBackendHealth() {
    const baseUrl = window.APP_CONFIG.getApiBaseUrl();
    elements.topbarApiUrl.textContent = baseUrl;

    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      state.isOnline = true;

      elements.sidebarStatusDot.className = 'status-dot connected';
      elements.sidebarStatusText.textContent = 'Connected';
      elements.metricBackendStatus.textContent = 'Online';
      elements.metricBackendStatus.style.color = 'var(--color-success)';

      const driver = data.storage?.driver ? data.storage.driver.toUpperCase() : 'LOCAL';
      elements.sidebarDriverText.textContent = `Driver: ${driver}`;
      elements.metricStorageDriver.textContent = driver;

      if (driver === 'S3') {
        elements.metricStorageDriver.style.color = '#d97706';
      } else {
        elements.metricStorageDriver.style.color = 'var(--color-primary)';
      }
    } catch (err) {
      state.isOnline = false;
      elements.sidebarStatusDot.className = 'status-dot disconnected';
      elements.sidebarStatusText.textContent = 'Disconnected';
      elements.sidebarDriverText.textContent = 'Driver: Unknown';
      elements.metricBackendStatus.textContent = 'Offline';
      elements.metricBackendStatus.style.color = 'var(--color-danger)';
      elements.metricStorageDriver.textContent = 'UNKNOWN';
    }
  }

  // Load Files from REST API
  async function fetchFiles() {
    const baseUrl = window.APP_CONFIG.getApiBaseUrl();

    try {
      const res = await fetch(`${baseUrl}/files`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error ${res.status}`);
      }

      const response = await res.json();
      if (response.success && response.data) {
        state.files = response.data.files || [];
        elements.metricTotalFiles.textContent = response.data.totalFiles ?? state.files.length;
        elements.metricTotalSize.textContent = formatBytes(response.data.totalSizeBytes ?? 0);

        if (response.data.storage?.driver) {
          const driver = response.data.storage.driver.toUpperCase();
          elements.metricStorageDriver.textContent = driver;
        }

        renderFilesTable();
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
      showToast('Connection Error', `Failed to load files from backend: ${err.message}`, 'error');
    }
  }

  // Render Table Rows
  function renderFilesTable() {
    const query = (elements.fileSearchInput.value || '').trim().toLowerCase();
    const filtered = state.files.filter((file) => {
      const name = (file.name || '').toLowerCase();
      const ext = (file.extension || '').toLowerCase();
      return name.includes(query) || ext.includes(query);
    });

    elements.filesTableBody.innerHTML = '';

    if (state.files.length === 0) {
      elements.filesTable.classList.add('hidden');
      elements.emptyState.classList.remove('hidden');
      elements.emptySearchState.classList.add('hidden');
      elements.filesCountSubtitle.textContent = 'No files stored yet';
      return;
    }

    if (filtered.length === 0) {
      elements.filesTable.classList.add('hidden');
      elements.emptyState.classList.add('hidden');
      elements.emptySearchState.classList.remove('hidden');
      elements.filesCountSubtitle.textContent = '0 files matching filter';
      return;
    }

    elements.filesTable.classList.remove('hidden');
    elements.emptyState.classList.add('hidden');
    elements.emptySearchState.classList.add('hidden');
    elements.filesCountSubtitle.textContent = `Showing ${filtered.length} of ${state.files.length} files`;

    filtered.forEach((file) => {
      const tr = document.createElement('tr');
      const badge = getExtensionBadge(file.name);
      const baseUrl = window.APP_CONFIG.getApiBaseUrl();
      const downloadUrl = `${baseUrl}/files/${encodeURIComponent(file.key)}/download`;

      tr.innerHTML = `
        <td class="file-name-cell">
          <span class="file-badge">${escapeHtml(badge)}</span>
          <span class="file-primary-name">${escapeHtml(file.name)}</span>
        </td>
        <td><code>${escapeHtml(file.extension || '-')}</code></td>
        <td>${formatBytes(file.size)}</td>
        <td class="td-date">${formatDate(file.uploadedAt)}</td>
        <td>
          <div class="table-action-group">
            <a href="${downloadUrl}" class="btn-table-action" download title="Download file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Download</span>
            </a>
            <button class="btn-table-action btn-table-delete" data-key="${escapeHtml(file.key)}" data-name="${escapeHtml(file.name)}" type="button" title="Delete file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <span>Delete</span>
            </button>
          </div>
        </td>
      `;

      const deleteBtn = tr.querySelector('.btn-table-delete');
      deleteBtn.addEventListener('click', () => {
        openDeleteModal(file.key, file.name);
      });

      elements.filesTableBody.appendChild(tr);
    });
  }

  // File Staging & Validation
  function handleSelectedFile(file) {
    if (!file) return;

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      showToast('Validation Error', `Executable and script files (${ext}) are not allowed`, 'error');
      clearStagedFile();
      return;
    }

    const maxBytes = state.maxFileSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      showToast('Validation Error', `File size exceeds the ${state.maxFileSizeMb} MB limit`, 'error');
      clearStagedFile();
      return;
    }

    state.stagedFile = file;
    elements.stagedFileName.textContent = file.name;
    elements.stagedFileMeta.textContent = `${formatBytes(file.size)} • ${file.type || 'Binary'}`;
    elements.stagedFileIcon.textContent = getExtensionBadge(file.name);

    elements.dropzoneEmptyState.classList.add('hidden');
    elements.stagedFileBox.classList.remove('hidden');
    elements.uploadBtn.disabled = false;
  }

  function clearStagedFile() {
    state.stagedFile = null;
    elements.fileInput.value = '';
    elements.dropzoneEmptyState.classList.remove('hidden');
    elements.stagedFileBox.classList.add('hidden');
    elements.uploadBtn.disabled = true;
    resetProgress();
  }

  function resetProgress() {
    elements.progressContainer.classList.add('hidden');
    elements.progressBar.style.width = '0%';
    elements.progressPercent.textContent = '0%';
    elements.cancelUploadBtn.classList.add('hidden');
  }

  // Upload Execution via XMLHttpRequest (for accurate progress events)
  function uploadStagedFile() {
    if (!state.stagedFile) return;

    const baseUrl = window.APP_CONFIG.getApiBaseUrl();
    const formData = new FormData();
    formData.append('file', state.stagedFile);

    const xhr = new XMLHttpRequest();
    state.uploadXhr = xhr;

    // Show progress UI
    elements.progressContainer.classList.remove('hidden');
    elements.cancelUploadBtn.classList.remove('hidden');
    elements.uploadBtn.disabled = true;
    elements.progressStatus.textContent = 'Uploading file...';

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        elements.progressBar.style.width = `${percent}%`;
        elements.progressPercent.textContent = `${percent}%`;
        if (percent === 100) {
          elements.progressStatus.textContent = 'Processing storage...';
        }
      }
    });

    xhr.addEventListener('load', () => {
      state.uploadXhr = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        showToast('Success', 'File uploaded successfully', 'success');
        clearStagedFile();
        fetchFiles();
      } else {
        let msg = `Server returned status ${xhr.status}`;
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.message) msg = res.message;
        } catch {}
        showToast('Upload Failed', msg, 'error');
        resetProgress();
        elements.uploadBtn.disabled = false;
      }
    });

    xhr.addEventListener('error', () => {
      state.uploadXhr = null;
      showToast('Network Error', 'Upload failed due to network error or CORS restriction', 'error');
      resetProgress();
      elements.uploadBtn.disabled = false;
    });

    xhr.addEventListener('abort', () => {
      state.uploadXhr = null;
      showToast('Cancelled', 'File upload was cancelled', 'info');
      resetProgress();
      elements.uploadBtn.disabled = false;
    });

    xhr.open('POST', `${baseUrl}/files`);
    xhr.send(formData);
  }

  // Delete Modal Operations
  function openDeleteModal(key, filename) {
    state.deleteTarget = { key, filename };
    elements.deleteTargetFilename.textContent = filename;
    elements.deleteModal.classList.remove('hidden');
  }

  function closeDeleteModal() {
    state.deleteTarget = null;
    elements.deleteModal.classList.add('hidden');
  }

  async function executeDelete() {
    if (!state.deleteTarget) return;
    const { key, filename } = state.deleteTarget;
    const baseUrl = window.APP_CONFIG.getApiBaseUrl();

    elements.confirmDeleteBtn.disabled = true;
    elements.confirmDeleteBtn.textContent = 'Deleting...';

    try {
      const res = await fetch(`${baseUrl}/files/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }

      showToast('Deleted', `File "${filename}" was deleted successfully`, 'success');
      closeDeleteModal();
      await fetchFiles();
    } catch (err) {
      showToast('Delete Failed', err.message, 'error');
    } finally {
      elements.confirmDeleteBtn.disabled = false;
      elements.confirmDeleteBtn.textContent = 'Delete File';
    }
  }

  // API Settings Modal
  function openSettingsModal() {
    elements.settingsApiInput.value = window.APP_CONFIG.getApiBaseUrl();
    elements.settingsModal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    elements.settingsModal.classList.add('hidden');
  }

  function saveSettings() {
    const inputVal = elements.settingsApiInput.value.trim();
    if (!inputVal) {
      window.APP_CONFIG.resetApiBaseUrl();
    } else {
      window.APP_CONFIG.setApiBaseUrl(inputVal);
    }
    closeSettingsModal();
    showToast('Settings Saved', `Connecting to: ${window.APP_CONFIG.getApiBaseUrl()}`, 'info');
    checkBackendHealth();
    fetchFiles();
  }

  function resetSettings() {
    window.APP_CONFIG.resetApiBaseUrl();
    elements.settingsApiInput.value = window.APP_CONFIG.defaultUrl;
    closeSettingsModal();
    showToast('Settings Reset', `Reverted to default: ${window.APP_CONFIG.defaultUrl}`, 'info');
    checkBackendHealth();
    fetchFiles();
  }

  // Event Listeners Setup
  function initEventListeners() {
    // Dropzone click & drag
    elements.dropzone.addEventListener('click', (e) => {
      if (e.target.closest('#remove-file-btn')) return;
      elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleSelectedFile(e.target.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      elements.dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      elements.dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropzone.classList.remove('dragover');
      });
    });

    elements.dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleSelectedFile(e.dataTransfer.files[0]);
      }
    });

    elements.removeFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearStagedFile();
    });

    // Upload & Cancel
    elements.uploadBtn.addEventListener('click', uploadStagedFile);
    elements.cancelUploadBtn.addEventListener('click', () => {
      if (state.uploadXhr) {
        state.uploadXhr.abort();
      }
    });

    // Search filter
    elements.fileSearchInput.addEventListener('input', renderFilesTable);

    // Refresh button
    elements.refreshBtn.addEventListener('click', async () => {
      const icon = elements.refreshBtn.querySelector('.refresh-icon');
      if (icon) icon.classList.add('spinning');
      await Promise.all([checkBackendHealth(), fetchFiles()]);
      if (icon) icon.classList.remove('spinning');
    });

    // Delete modal buttons
    elements.confirmDeleteBtn.addEventListener('click', executeDelete);
    elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    elements.cancelDeleteX.addEventListener('click', closeDeleteModal);

    // Settings modal buttons
    elements.openSettingsBtn.addEventListener('click', openSettingsModal);
    elements.saveApiBtn.addEventListener('click', saveSettings);
    elements.resetApiBtn.addEventListener('click', resetSettings);
    elements.cancelSettingsX.addEventListener('click', closeSettingsModal);

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDeleteModal();
        closeSettingsModal();
      }
    });

    // Sidebar navigation clicks
    document.querySelectorAll('.sidebar-nav .nav-item').forEach((link) => {
      link.addEventListener('click', (e) => {
        document.querySelectorAll('.sidebar-nav .nav-item').forEach((l) => l.classList.remove('active'));
        link.classList.add('active');

        const tab = link.getAttribute('data-tab');
        if (tab === 'upload') {
          document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth' });
        } else if (tab === 'files') {
          document.getElementById('files-section').scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  // App Initialization
  async function init() {
    initEventListeners();
    await checkBackendHealth();
    await fetchFiles();

    // Periodic health check every 20 seconds
    setInterval(checkBackendHealth, 20000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

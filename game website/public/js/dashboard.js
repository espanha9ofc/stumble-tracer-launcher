/* ═══════════════════════════════════════════════════
   Stumble Tracer — ADMIN DASHBOARD JS v2.0
   Fixed scope bugs, proper toast, news management
   ═══════════════════════════════════════════════════ */

// ─── Toast System (Global Scope) ───
function showToast(type, msg) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span> ${msg}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function resolveAssetUrl(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : url;
}

function formatDurationMinutes(totalSeconds) {
  return `${Math.max(0, Math.round((Number(totalSeconds) || 0) / 60))} mins`;
}

function renderOverviewPlayers(devices = []) {
  const container = document.getElementById('analytics-table-container');
  if (!container) return;

  if (!devices.length) {
    container.innerHTML = '<p class="text-muted">No player telemetry available yet.</p>';
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Player</th>
          <th>Playtime</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${devices.slice(0, 5).map((player) => `
          <tr>
            <td>${player.username || 'Anonymous'}</td>
            <td>${formatDurationMinutes(player.totalPlayTime)}</td>
            <td><span class="status-badge ${player.isOnline ? 'online' : 'offline'}">${player.isOnline ? 'Online' : 'Offline'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('adminToken');
  const adminNameEl = document.getElementById('admin-name');
  if (adminNameEl) adminNameEl.textContent = localStorage.getItem('adminName') || 'Master Admin';

  // C6 fix: Validate token before loading dashboard
  if (token) {
    try {
      const checkRes = await fetch('/api/analytics', {
        headers: { 'x-auth-token': token }
      });
      if (checkRes.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminName');
        window.location.href = '/?error=session_expired';
        return;
      }
    } catch (e) {
      console.warn('Token validation failed, proceeding anyway');
    }
  }

  // Tab switching
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');

  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      try {
        e.preventDefault();
        const tabId = link.dataset.tab;
        if (!tabId) return;

        tabLinks.forEach(l => l.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        link.classList.add('active');
        const tabEl = document.getElementById(`tab-${tabId}`);
        if (tabEl) {
          tabEl.classList.add('active');
          if (tabId === 'analytics') loadAnalytics();
          if (tabId === 'files') loadStats();
        }
      } catch (err) {
        console.error('Tab switch error:', err);
      }
    });
  });

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminName');
      window.location.href = '/';
    });
  }

  // File input feedback
  setupFileInput('game-file', 'zone-game');
  setupFileInput('dll-file', 'zone-dll');

  // Load all data
  loadStats();
  loadGlobalConfig();
  loadGallery();
  loadAnalytics();
  loadNewsList();

  // Button Listeners (Robust Safety Wrap)
  const attachListener = (id, fn, arg = null) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', async (e) => {
        try {
            e.preventDefault();
            console.log(`[ACTION] Button clicked: ${id}`);
            arg ? await fn(arg) : await fn();
        } catch (err) {
            console.error(`[CRITICAL] Error in listener ${id}:`, err);
            showToast('error', 'UI Logic Error. Check Console.');
            // Attempt to reset button state if it's an upload button
            if (id && id.includes('upload')) {
                el.disabled = false;
                el.textContent = id.includes('game') ? 'Push Game Update' : 'Push DLL Patch';
                const prog = document.getElementById(id.includes('game') ? 'game-progress' : 'dll-progress');
                if (prog) prog.style.display = 'none';
            }
        }
    });
  };

  attachListener('btn-upload-game', uploadGame);
  attachListener('btn-upload-dll', uploadDll);
  attachListener('btn-save-config', saveGlobalConfig);
  attachListener('btn-upload-logo', openBrandingUpload, 'logo');
  attachListener('btn-upload-banner', openBrandingUpload, 'banner');
  attachListener('btn-post-news', postNews);
  attachListener('btn-add-screenshot', openMediaUpload, 'screenshot');
  attachListener('btn-upload-media', openMediaUpload, 'gallery');
  attachListener('btn-purge', purgeStorage);

  // Socket.IO
  try {
    const socket = io();
    socket.on('stats:update', (data) => {
      if (data.activePlayers !== undefined) {
        const el = document.getElementById('stat-active');
        if (el) el.textContent = data.activePlayers;
      }
    });

    socket.on('connect', () => {
      const badge = document.getElementById('connection-status');
      if (badge) { badge.className = 'connection-badge online'; badge.textContent = '● Online'; }
    });

    socket.on('disconnect', () => {
      const badge = document.getElementById('connection-status');
      if (badge) { badge.className = 'connection-badge offline'; badge.textContent = '● Offline'; }
    });
  } catch (err) {
    console.error('Socket error:', err);
  }
});

// ─── File Input UI Feedback ───
function setupFileInput(inputId, zoneId) {
  const input = document.getElementById(inputId);
  const zone = document.getElementById(zoneId);
  if (!input || !zone) return;

  input.addEventListener('change', (e) => {
    if (e.target.files.length) {
      const textEl = zone.querySelector('.upload-zone-text');
      if (textEl) textEl.textContent = `Selected: ${e.target.files[0].name}`;
      zone.classList.add('has-file');
    }
  });
}

// ═══════════════ STATS ═══════════════
async function loadStats() {
  try {
    const res = await fetch('/api/version?_t=' + Date.now());
    if (!res.ok) throw new Error('Stats unavailable');
    const data = await res.json();
    const gameV = document.getElementById('stat-game-version');
    const dllV = document.getElementById('stat-dll-version');
    if (gameV) gameV.textContent = data.version || '0.0.0';
    if (dllV) dllV.textContent = data.dll_version || '0.0.0';

    // Update Center UI labels
    const formatDt = (iso) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No upload data';
    const hGameV = document.getElementById('hosted-game-v');
    const hGameD = document.getElementById('hosted-game-date');
    if (hGameV) hGameV.textContent = `v${data.version || '0.0.0'}`;
    if (hGameD) hGameD.textContent = formatDt(data.game_updated);

    const hDllV = document.getElementById('hosted-dll-v');
    const hDllD = document.getElementById('hosted-dll-date');
    if (hDllV) hDllV.textContent = `v${data.dll_version || '0.0.0'}`;
    if (hDllD) hDllD.textContent = formatDt(data.dll_updated);
  } catch (e) {
    console.warn('Stats load error:', e.message);
    const dashErr = (id) => { const el = document.getElementById(id); if (el) el.textContent = 'Error'; };
    ['stat-game-version', 'stat-dll-version', 'hosted-game-v', 'hosted-dll-v'].forEach(dashErr);
  }
}

// ═══════════════ GLOBAL CONFIG ═══════════════
async function loadGlobalConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Failed to load config');
    const data = await res.json();
    if (data) {
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      setVal('config-status', data.serverStatus || 'online');
      setVal('config-notice', data.noticeText);
      setVal('config-discord', data.discordUrl);
      setVal('config-youtube', data.youtubeUrl);
      setVal('config-facebook', data.facebookUrl);
    }
  } catch (e) {
    console.warn('Config load failed:', e.message);
    showToast('warning', 'Using default server configuration');
  }
}

async function saveGlobalConfig() {
  const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  
  const config = {
    serverStatus: getVal('config-status'),
    noticeText: getVal('config-notice'),
    discordUrl: getVal('config-discord'),
    youtubeUrl: getVal('config-youtube'),
    facebookUrl: getVal('config-facebook')
  };

  try {
    const res = await fetch('/api/config/global', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': localStorage.getItem('adminToken')
      },
      body: JSON.stringify(config)
    });

    if (res.ok) {
      showToast('success', 'Global Settings Saved!');
    } else {
      showToast('error', 'Failed to save settings');
    }
  } catch (e) {
    showToast('error', 'Network error');
  }
}

// ═══════════════ NEWS ═══════════════
async function postNews() {
  const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  const file = document.getElementById('news-image-input')?.files[0];
  
  if (!getVal('news-title') || !getVal('news-content')) {
    return showToast('error', 'Title and Content are required');
  }

  const formData = new FormData();
  formData.append('category', getVal('news-category'));
  formData.append('title', getVal('news-title'));
  formData.append('excerpt', getVal('news-excerpt'));
  formData.append('content', getVal('news-content'));
  if (file) formData.append('image', file);

  try {
    showToast('info', 'Publishing...');
    const res = await fetch('/api/news', {
      method: 'POST',
      headers: {
        'x-auth-token': localStorage.getItem('adminToken')
      },
      body: formData
    });

    if (res.ok) {
      showToast('success', 'Published successfully!');
      ['news-title', 'news-excerpt', 'news-content', 'news-image-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      loadNewsList();
    }
  } catch (e) {
    showToast('error', 'Post failed');
  }
}

// ─── Branding Uploads (Logo/Banner) ───
function openBrandingUpload(type) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = type === 'logo' ? 'image/png' : 'image/jpeg,image/png';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append(type, file);

    showToast('info', `Uploading ${type}...`);
    try {
      const res = await fetch(`/api/branding/upload-${type}`, {
        method: 'POST',
        headers: { 'x-auth-token': localStorage.getItem('adminToken') },
        body: formData
      });
      if (res.ok) {
        showToast('success', `${type.charAt(0).toUpperCase() + type.slice(1)} updated!`);
      } else {
        showToast('error', 'Upload failed');
      }
    } catch (e) {
      showToast('error', 'Network error');
    }
  };
  input.click();
}

async function loadNewsList() {
  try {
    const res = await fetch('/api/news');
    if (!res.ok) throw new Error('News unavailable');
    const list = await res.json();
    const container = document.getElementById('news-list');
    if (!container) return;

    if (!list.length) {
      container.innerHTML = '<p class="text-muted">No articles published yet.</p>';
      return;
    }

    container.innerHTML = list.map(item => `
      <div class="news-item">
        <div class="news-item-info">
          <div class="news-item-title">${item.title}</div>
          <div class="news-item-meta">
            <span class="news-item-badge">${item.category?.replace('_', ' ') || 'news'}</span>
            <span>${new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
        <button class="icon-btn danger" onclick="deleteNews('${item._id}')" title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `).join('');
  } catch (err) {
    console.warn('Failed to load news:', err.message);
    const container = document.getElementById('news-list');
    if (container) container.innerHTML = '<p class="text-mini">News temporarily unavailable</p>';
  }
}

async function deleteNews(id) {
  if (!confirm('Delete this article?')) return;
  try {
    await fetch(`/api/news/${id}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': localStorage.getItem('adminToken') }
    });
    showToast('success', 'Article deleted');
    loadNewsList();
  } catch (err) {
    showToast('error', 'Delete failed');
  }
}

async function uploadGame() {
  const file = document.getElementById('game-file')?.files[0];
  const version = document.getElementById('game-version-input')?.value;
  
  console.log('[UPLOAD] Starting game upload process...');
  if (!file || !version) {
    console.warn('[UPLOAD] Validation failed: File or Version missing');
    showToast('error', 'Select file and enter version');
    alert('Please select a Game file and enter a Version number.');
    return;
  }

  const formData = new FormData();
  formData.append('game', file);
  formData.append('version', version);
  console.log('[UPLOAD] FormData prepared for Game. Version:', version, 'File:', file.name);

  const btn = document.getElementById('btn-upload-game');
  const progContainer = document.getElementById('game-progress');
  const progBar = document.getElementById('game-progress-bar');
  const progText = document.getElementById('game-progress-text');

  btn.disabled = true;
  btn.textContent = 'Uploading...';
  progContainer.style.display = 'block';
  progBar.style.width = '0%';
  progText.textContent = '0%';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/files/upload-game');
  xhr.setRequestHeader('x-auth-token', localStorage.getItem('adminToken'));

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progBar.style.width = percent + '%';
      progText.textContent = percent + '%';
      if (percent === 100) {
        btn.textContent = 'Processing...';
        const label = progContainer.querySelector('span');
        if (label) label.textContent = 'Finishing Upload... (Don\'t close)';
      }
    }
  };

  xhr.onload = () => {
    console.log('[UPLOAD] XHR loaded with status:', xhr.status);
    btn.disabled = false;
    if (xhr.status >= 200 && xhr.status < 300) {
      showToast('success', 'Game Update Pushed!');
      document.getElementById('game-file').value = '';
      document.getElementById('game-version-input').value = '';
      document.getElementById('zone-game').classList.remove('has-file');
      const textEl = document.getElementById('zone-game').querySelector('.upload-zone-text');
      if (textEl) textEl.textContent = 'Click to select Stumble Tracer.zip';
      loadStats();
      setTimeout(() => {
        progContainer.style.display = 'none';
        btn.textContent = 'Push Game Update';
      }, 1500);
    } else {
      console.error('[UPLOAD] Game upload failed. Response:', xhr.responseText);
      progContainer.style.display = 'none';
      btn.textContent = 'Push Game Update';
      let errMsg = 'Upload failed';
      try {
        const resp = JSON.parse(xhr.responseText);
        if (resp.msg) errMsg = resp.msg;
      } catch(e) {}
      showToast('error', errMsg);
    }
  };

  xhr.onerror = () => {
    btn.disabled = false;
    btn.textContent = 'Push Game Update';
    progContainer.style.display = 'none';
    showToast('error', 'Network error during upload');
    alert('Network error during upload');
  };

  xhr.send(formData);
}

async function uploadDll() {
  const file = document.getElementById('dll-file')?.files[0];
  const version = document.getElementById('dll-version-input')?.value;

  console.log('[UPLOAD] Starting DLL upload process...');
  if (!file || !version) {
    console.warn('[UPLOAD] Validation failed: File or Version missing');
    showToast('error', 'Select file and enter version');
    alert('Please select a DLL file and enter a Version number.');
    return;
  }

  const formData = new FormData();
  formData.append('dll', file);
  formData.append('version', version);
  console.log('[UPLOAD] FormData prepared for DLL. Version:', version, 'File:', file.name);

  const btn = document.getElementById('btn-upload-dll');
  const progContainer = document.getElementById('dll-progress');
  const progBar = document.getElementById('dll-progress-bar');
  const progText = document.getElementById('dll-progress-text');

  btn.disabled = true;
  btn.textContent = 'Uploading...';
  progContainer.style.display = 'block';
  progBar.style.width = '0%';
  progText.textContent = '0%';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/files/upload-dll');
  xhr.setRequestHeader('x-auth-token', localStorage.getItem('adminToken'));

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progBar.style.width = percent + '%';
      progText.textContent = percent + '%';
      if (percent === 100) {
        btn.textContent = 'Processing...';
        const label = progContainer.querySelector('span');
        if (label) label.textContent = 'Finishing Upload...';
      }
    }
  };

  xhr.onload = () => {
    console.log('[UPLOAD] XHR loaded with status:', xhr.status);
    btn.disabled = false;
    if (xhr.status >= 200 && xhr.status < 300) {
      showToast('success', 'DLL Patch Pushed!');
      document.getElementById('dll-file').value = '';
      document.getElementById('dll-version-input').value = '';
      document.getElementById('zone-dll').classList.remove('has-file');
      const textEl = document.getElementById('zone-dll').querySelector('.upload-zone-text');
      if (textEl) textEl.textContent = 'Click to select mod.dll';
      loadStats();
      setTimeout(() => {
        progContainer.style.display = 'none';
        btn.textContent = 'Push DLL Patch';
      }, 1500);
    } else {
      console.error('[UPLOAD] DLL upload failed. Response:', xhr.responseText);
      progContainer.style.display = 'none';
      btn.textContent = 'Push DLL Patch';
      let errMsg = 'Upload failed';
      try {
        const resp = JSON.parse(xhr.responseText);
        if (resp.msg) errMsg = resp.msg;
      } catch(e) {}
      showToast('error', errMsg);
    }
  };

  xhr.onerror = () => {
    btn.disabled = false;
    btn.textContent = 'Push DLL Patch';
    progContainer.style.display = 'none';
    showToast('error', 'Network error during upload');
    alert('Network error during upload');
  };

  xhr.send(formData);
}

// ═══════════════ MEDIA GALLERY ═══════════════
// ═══════════════ MEDIA GALLERY ═══════════════
async function loadGallery() {
  try {
    const res = await fetch('/api/media');
    if (!res.ok) throw new Error('Media unavailable');
    const list = await res.json();
    
    const galleryContainer = document.getElementById('media-list');
    const screenshotContainer = document.getElementById('screenshot-list');
    
    // Separate by category
    const screenshots = list.filter(m => m.category === 'screenshot');
    const galleryItems = list.filter(m => m.category !== 'screenshot');

    const renderItems = (items, container, emptyMsg) => {
        if (!container) return;
        if (!items.length) {
            container.innerHTML = `<p class="text-muted">${emptyMsg}</p>`;
            return;
        }
        container.innerHTML = items.map(item => `
            <div class="media-card">
              ${item.type === 'video'
                ? `<video src="${resolveAssetUrl(item.url)}" class="media-card-img" muted playsinline preload="metadata"></video>`
                : `<img src="${resolveAssetUrl(item.url)}" class="media-card-img" alt="${item.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22130%22%3E%3Crect fill=%22%23111%22 width=%22200%22 height=%22130%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23555%22 dy=%22.3em%22%3ENo Preview%3C/text%3E%3C/svg%3E'">`}
              <div class="media-card-body">
                <span class="media-card-title">${item.title}</span>
                <button class="icon-btn danger" onclick="deleteMedia('${item._id}')" title="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
        `).join('');
    };

    renderItems(screenshots, screenshotContainer, 'No official screenshots uploaded yet.');
    renderItems(galleryItems, galleryContainer, 'No community media uploaded yet.');

  } catch (err) {
    console.warn('Failed to load media lists:', err.message);
    ['media-list', 'screenshot-list'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p class="text-mini">Gallery temporarily offline</p>';
    });
  }
}

function openMediaUpload(category = 'gallery') {
  const title = prompt(`Enter ${category === 'screenshot' ? 'Screenshot' : 'Media'} Title:`);
  if (!title) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('title', title);
    formData.append('media', file);
    formData.append('type', file.type.startsWith('video') ? 'video' : 'image');
    formData.append('category', category);

    showToast('info', `Uploading ${category}...`);
    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'x-auth-token': localStorage.getItem('adminToken') },
        body: formData
      });
      if (res.ok) {
        showToast('success', `${category.charAt(0).toUpperCase() + category.slice(1)} Uploaded!`);
        loadGallery();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', data.msg || 'Upload failed');
      }
    } catch (err) {
      showToast('error', 'Upload failed');
    }
  };
  input.click();
}

async function deleteMedia(id) {
  if (!confirm('Delete this item?')) return;
  try {
    const res = await fetch(`/api/media/${id}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': localStorage.getItem('adminToken') }
    });
    if (res.ok) {
      showToast('success', 'Deleted successfully');
      loadGallery();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast('error', data.msg || 'Delete failed');
    }
  } catch (err) {
    showToast('error', 'Delete failed');
  }
}

// ═══════════════ ANALYTICS ═══════════════
let growthChart, activeHoursChart;

async function loadAnalytics() {
    try {
        const res = await fetch('/api/analytics', {
            headers: { 'x-auth-token': localStorage.getItem('adminToken') }
        });
        if (!res.ok) throw new Error('Analytics failed');
        const data = await res.json();

        // 1. Update Metric Cards
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl('ana-total-players', data.totalPlayers || 0);
        setEl('ana-total-hours', `${data.totalHours || 0}h`);
        setEl('ana-dap', data.dap || 0);
        setEl('stat-playtime', `${data.totalHours || 0}h`);
        
        // Live players from Overview stat (duplicated for consistency)
        const live = document.getElementById('stat-active')?.textContent || '0';
        setEl('ana-live-players', live);
        renderOverviewPlayers(data.devices || []);

        // 2. Charts
        if (data.history && data.history.length > 0) {
            renderGrowthChart(data.history);
            renderActiveHoursChart(data.history);
        }

        // 3. Top Players List
        const container = document.getElementById('top-players-container');
        if (container) {
            if (!data.devices || data.devices.length === 0) {
                container.innerHTML = '<p class="text-muted">No playtime data recorded yet.</p>';
            } else {
                container.innerHTML = `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Position</th>
                                <th>Name / HWID</th>
                                <th>Total Time</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.devices.map((d, index) => `
                                <tr>
                                    <td>#${index + 1}</td>
                                    <td>
                                        <div style="display: flex; flex-direction: column;">
                                            <span style="font-weight: 500;">${d.username || 'Anonymous'}</span>
                                            <span style="font-size: 10px; color: var(--text-muted);" class="mono">${d.hwid}</span>
                                        </div>
                                    </td>
                                    <td>${formatDurationMinutes(d.totalPlayTime)}</td>
                                    <td><span class="status-badge ${d.isOnline ? 'online' : 'offline'}">${d.isOnline ? 'Online' : 'Offline'}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        }
    } catch (err) {
        console.error('Failed to load advanced analytics:', err);
    }
}

function renderGrowthChart(history) {
    const ctx = document.getElementById('growthChart')?.getContext('2d');
    if (!ctx) return;

    if (growthChart) growthChart.destroy();

    const labels = history.map(h => new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const data = history.map(h => h.newPlayers || 0);

    growthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'New Registrations',
                data: data,
                borderColor: '#00f2ff',
                backgroundColor: 'rgba(0, 242, 255, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#888' } }
            }
        }
    });
}

function renderActiveHoursChart(history) {
    const ctx = document.getElementById('activeHoursChart')?.getContext('2d');
    if (!ctx) return;

    if (activeHoursChart) activeHoursChart.destroy();

    const labels = history.map(h => new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const data = history.map(h => h.peakOnline || 0);

    activeHoursChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Peak Concurrent',
                data: data,
                backgroundColor: '#7000ff',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#888' } }
            }
        }
    });
}

async function purgeStorage() {
  if (!confirm('⚠️ CRITICAL WARNING: This will delete ALL hosted Game ZIPs and Mod DLLs from your database storage. This should only be done to clear "Ghost" files and fix storage bloat. You will need to re-upload your game files immediately after. Proceed?')) return;
  
  if (!confirm('FINAL CONFIRMATION: Are you absolutely sure? This cannot be undone.')) return;

  const btn = document.getElementById('btn-purge');
  const originalText = btn.textContent;
  
  try {
    btn.disabled = true;
    btn.textContent = 'Purging Storage...';
    
    const res = await fetch('/api/files/purge', {
      method: 'POST',
      headers: {
        'x-auth-token': localStorage.getItem('adminToken')
      }
    });

    const data = await res.json();
    
    if (res.ok) {
      showToast('success', 'Storage Purged Successfully');
      loadStats(); // Reload to show 0.0.0 versions
    } else {
      showToast('error', data.msg || 'Purge failed');
    }
  } catch (err) {
    console.error('Purge error:', err);
    showToast('error', 'Network error during purge');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

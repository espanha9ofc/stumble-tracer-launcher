/* ═══════════════════════════════════════════════════
   Stumble Tracer LAUNCHER — APP.JS
   Main application controller, router, and page logic
   ═══════════════════════════════════════════════════ */

// ─── State ───
const state = {
  currentPage: 'home',
  gameInstalled: false,
  gameRunning: false,
  gameVersion: null,
  updateAvailable: false,
  isDownloading: false,
  settings: {},
  playStartTime: null,
  currentAvatarIndex: 0,
  sliderInterval: null,
  heroSlides: [],
  heroCurrentSlide: 0,
  homeScreenshots: [],
  screenshotRefreshInterval: null,
  screenshotSignature: null,
  screenshotLastLoadedAt: 0,
  dependencySnapshot: null,
  dependencyLastCheckedAt: 0,
  lightboxIndex: 0,
  notifications: [],
  notificationDropdownOpen: false
};

// ═══════════════ NOTIFICATION CENTER ═══════════════
const NOTIFICATION_ICONS = {
  update: '📦',
  news: '📰',
  system: '⚙️',
  social: '👥',
  achievement: '🏆',
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌'
};

const MAX_NOTIFICATIONS = 50;

function loadNotifications() {
  try {
    const saved = localStorage.getItem('sp_notifications');
    state.notifications = saved ? JSON.parse(saved) : [];
  } catch (e) {
    state.notifications = [];
  }
}

function saveNotifications() {
  try {
    localStorage.setItem('sp_notifications', JSON.stringify(state.notifications));
  } catch (e) { /* ignore */ }
}

function addNotification({ type = 'info', title = '', message = '', persistent = false }) {
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const notification = {
    id,
    type,
    title,
    message,
    persistent,
    read: false,
    createdAt: new Date().toISOString()
  };

  state.notifications.unshift(notification);

  // Trim to max
  if (state.notifications.length > MAX_NOTIFICATIONS) {
    state.notifications = state.notifications.slice(0, MAX_NOTIFICATIONS);
  }

  saveNotifications();
  renderNotifications();
  updateNotificationBadge();

  return id;
}

function removeNotification(id) {
  state.notifications = state.notifications.filter(n => n.id !== id);
  saveNotifications();
  renderNotifications();
  updateNotificationBadge();
}

function markNotificationRead(id) {
  const notif = state.notifications.find(n => n.id === id);
  if (notif && !notif.read) {
    notif.read = true;
    saveNotifications();
    renderNotifications();
    updateNotificationBadge();
  }
}

function markAllNotificationsRead() {
  state.notifications.forEach(n => { n.read = true; });
  saveNotifications();
  renderNotifications();
  updateNotificationBadge();
}

function clearAllNotifications() {
  state.notifications = [];
  saveNotifications();
  renderNotifications();
  updateNotificationBadge();
}

function getUnreadCount() {
  return state.notifications.filter(n => !n.read).length;
}

function updateNotificationBadge() {
  const badge = document.getElementById('notification-badge');
  const count = getUnreadCount();
  if (badge) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count === 0);
  }
}

function renderNotifications() {
  const list = document.getElementById('notification-list');
  if (!list) return;

  if (state.notifications.length === 0) {
    list.innerHTML = `
      <div class="notification-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <p>No notifications yet</p>
        <span>Updates, news, and alerts will appear here.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = state.notifications.map(n => {
    const icon = NOTIFICATION_ICONS[n.type] || NOTIFICATION_ICONS.info;
    const timeStr = formatRelativeTime(n.createdAt);
    const unreadClass = n.read ? '' : ' unread';
    return `
      <div class="notification-item${unreadClass}" data-notif-id="${n.id}">
        <div class="notification-icon type-${n.type}">${icon}</div>
        <div class="notification-body">
          <div class="notification-title">${escapeHtml(n.title)}</div>
          <div class="notification-message">${escapeHtml(n.message)}</div>
          <div class="notification-time">${timeStr}</div>
        </div>
        <button class="notification-dismiss" data-dismiss-id="${n.id}" title="Dismiss">&times;</button>
      </div>
    `;
  }).join('');

  // Attach click listeners
  list.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.notification-dismiss')) return;
      const id = item.dataset.notifId;
      markNotificationRead(id);
    });
  });

  list.querySelectorAll('.notification-dismiss').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.dismissId;
      removeNotification(id);
    });
  });
}

function escapeHtml(text = '') {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toggleNotificationDropdown() {
  const dropdown = document.getElementById('notification-dropdown');
  const bell = document.getElementById('notification-bell');
  if (!dropdown || !bell) return;

  state.notificationDropdownOpen = !state.notificationDropdownOpen;

  if (state.notificationDropdownOpen) {
    dropdown.classList.remove('hidden');
    bell.classList.add('active');
    renderNotifications();
  } else {
    dropdown.classList.add('hidden');
    bell.classList.remove('active');
  }
}

function closeNotificationDropdown() {
  const dropdown = document.getElementById('notification-dropdown');
  const bell = document.getElementById('notification-bell');
  if (dropdown) dropdown.classList.add('hidden');
  if (bell) bell.classList.remove('active');
  state.notificationDropdownOpen = false;
}

function initNotificationCenter() {
  loadNotifications();
  renderNotifications();
  updateNotificationBadge();

  const bell = document.getElementById('notification-bell');
  if (bell) {
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotificationDropdown();
    });
  }

  const markReadBtn = document.getElementById('notification-mark-read');
  if (markReadBtn) {
    markReadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      markAllNotificationsRead();
    });
  }

  const clearAllBtn = document.getElementById('notification-clear-all');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearAllNotifications();
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const center = document.getElementById('notification-center');
    if (center && !center.contains(e.target)) {
      closeNotificationDropdown();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.notificationDropdownOpen) {
      closeNotificationDropdown();
    }
  });
}

const HOME_SCREENSHOT_REFRESH_MS = 30000;
const HOME_SCREENSHOT_STALE_MS = 10000;
const DEPENDENCY_CACHE_MS = 60000;

const AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Max',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia'
];

// ─── API Bridge ───
const API = window.launcherAPI;
const REMOTE_BASE_URL = 'https://sg-prime-game-launcher.onrender.com';

function buildRemoteUrl(resourcePath = '') {
  if (!resourcePath) return REMOTE_BASE_URL;
  if (/^https?:\/\//i.test(resourcePath)) return resourcePath;
  return `${REMOTE_BASE_URL}${resourcePath.startsWith('/') ? '' : '/'}${resourcePath}`;
}

function resolveMediaUrl(resourcePath = '') {
  if (!resourcePath) return 'assets/images/banner.jpg';
  if (/^https?:\/\//i.test(resourcePath)) return resourcePath;
  if (/^(assets\/|\.\/assets\/)/i.test(resourcePath)) return resourcePath.replace(/^\.\//, '');
  return buildRemoteUrl(resourcePath);
}

async function fetchRemoteJson(resourcePath, options) {
  const response = await fetch(buildRemoteUrl(resourcePath), options);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

function getAvatarUrl(avatar) {
  if (!avatar) return AVATARS[0];
  if (/^https?:\/\//i.test(avatar)) return avatar;

  const match = /^avatar(\d+)$/i.exec(avatar);
  if (match) {
    const index = Math.max(0, Math.min(AVATARS.length - 1, Number(match[1]) - 1));
    return AVATARS[index];
  }

  const numericIndex = Number(avatar);
  if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < AVATARS.length) {
    return AVATARS[numericIndex];
  }

  return AVATARS[0];
}

function getAvatarIdFromIndex(index) {
  return `avatar${index + 1}`;
}

function setImageSource(id, src) {
  const image = document.getElementById(id);
  if (image && src) image.src = src;
}

function setTextContent(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatRelativeTime(dateValue) {
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return '--';

  const diff = Math.max(0, Date.now() - timestamp);
  if (diff < 45000) return 'Just now';

  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(diff / 86400000);
  if (days < 7) return `${days}d ago`;

  return formatDate(dateValue);
}

function formatPathPreview(path = '') {
  if (!path) return '--';
  return path.length > 42 ? `${path.slice(0, 20)}...${path.slice(-16)}` : path;
}

function titleCase(value = '') {
  return String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPageDisplayName(page = state.currentPage) {
  const labels = {
    home: 'Home',
    setup: 'Setup',
    settings: 'Settings',
    profile: 'Profile',
    leaderboard: 'Rankings',
    media: 'Media'
  };
  return labels[page] || titleCase(page || 'Home');
}

function getLatestSession(sessions = []) {
  if (!Array.isArray(sessions) || !sessions.length) return null;
  return sessions.reduce((latest, session) => {
    const latestTime = new Date(latest?.endTime || latest?.startTime || 0).getTime();
    const nextTime = new Date(session?.endTime || session?.startTime || 0).getTime();
    return nextTime > latestTime ? session : latest;
  }, null);
}

function syncInstallActions() {
  const displayMode = state.gameInstalled ? 'flex' : 'none';
  const repairRow = document.getElementById('settings-repair-row');
  const uninstallRow = document.getElementById('settings-uninstall-row');

  if (repairRow) repairRow.style.display = displayMode;
  if (uninstallRow) uninstallRow.style.display = displayMode;
}

function updateIdentityAvatarPreview() {
  setImageSource('id-setup-avatar', getAvatarUrl(getAvatarIdFromIndex(state.currentAvatarIndex)));
}

function getDependencyStatusLabel(deps = null) {
  if (!deps) return 'Could not verify requirements';
  const missing = getMissingDependencies(deps);
  return missing.length ? `Missing ${missing.join(' + ')}` : 'VC++ and .NET ready';
}

function getDependencyCompactLabel(deps = null) {
  if (!deps) return 'System Check';
  return getMissingDependencies(deps).length ? 'Requirements Needed' : 'System Ready';
}

function setSetupCheckState(key, stateName = 'pending', message = '') {
  const item = document.getElementById(`setup-check-${key}`);
  if (!item) return;

  item.classList.remove('is-pending', 'is-active', 'is-success', 'is-warning', 'is-error');
  item.classList.add(`is-${stateName}`);

  const copyEl = document.getElementById(`setup-check-${key}-copy`);
  if (copyEl && message) copyEl.textContent = message;
}

function updateSetupSummary(screenNum = 1) {
  const content = {
    1: {
      title: 'Prepare Your Desktop',
      copy: 'A guided install that keeps setup, requirements, and download status clear from start to finish.'
    },
    2: {
      title: 'Choose A Clean Install Path',
      copy: 'Select your folder and let the launcher verify the Windows runtimes before any download begins.'
    },
    3: {
      title: 'Delivery In Progress',
      copy: 'Packages are being streamed, verified, and prepared for a smooth first launch.'
    },
    4: {
      title: 'Everything Is Ready',
      copy: 'Game files, dependencies, and launcher state are all synced for your first session.'
    }
  }[screenNum] || {};

  setTextContent('setup-summary-title', content.title || 'Prepare Your Desktop');
  setTextContent('setup-summary-copy', content.copy || '');
}

function updateSetupSteps(screenNum = 1) {
  document.querySelectorAll('.setup-step[data-setup-step]').forEach((stepEl) => {
    const stepNum = Number(stepEl.dataset.setupStep);
    stepEl.classList.toggle('active', stepNum === screenNum);
    stepEl.classList.toggle('is-complete', stepNum < screenNum);
  });
}

function updateSetupInstallPreview(dir = '') {
  const resolvedDir = dir || state.settings.installDirectory || '';
  setTextContent('setup-dir-preview', resolvedDir ? formatPathPreview(resolvedDir) : 'Waiting for location');
  setSetupCheckState('storage', resolvedDir ? 'success' : 'pending', resolvedDir ? resolvedDir : 'Waiting for folder selection');
}

function resetSetupPanels() {
  updateSetupSummary(1);
  updateSetupSteps(1);
  updateSetupInstallPreview(state.settings.installDirectory || '');
  setTextContent('setup-requirement-summary', 'Checking system dependencies');
  setTextContent('setup-download-stage', 'Secure desktop download');
  setTextContent('setup-download-hint', 'Connecting to servers');
  setTextContent('setup-finish-install', 'Game files are ready');
  setTextContent('setup-finish-deps', 'VC++ and .NET confirmed');
  setSetupCheckState('vcredist', 'pending', 'Pending system check');
  setSetupCheckState('dotnet', 'pending', 'Pending system check');
  setSetupCheckState('download', 'pending', 'Waiting for installation to begin');
}

function syncSetupDependencyIndicators(deps = null) {
  if (!deps) {
    setSetupCheckState('vcredist', 'active', 'Checking Microsoft runtime');
    setSetupCheckState('dotnet', 'active', 'Checking desktop runtime');
    return;
  }

  setSetupCheckState(
    'vcredist',
    deps.vcRedist ? 'success' : 'error',
    deps.vcRedist ? 'Visual C++ Redistributable is ready' : 'Visual C++ Redistributable is required'
  );
  setSetupCheckState(
    'dotnet',
    deps.dotNet ? 'success' : 'error',
    deps.dotNet ? '.NET Desktop Runtime is ready' : '.NET Desktop Runtime is required'
  );
  setTextContent('setup-requirement-summary', deps.allGood ? 'Requirements ready' : getMissingDependencies(deps).join(' and '));
}

function updateRefreshLabels() {
  const label = state.screenshotLastLoadedAt
    ? `Synced ${formatRelativeTime(state.screenshotLastLoadedAt)}`
    : 'Waiting for sync';

  setTextContent('home-refresh-state', label);
  setTextContent('home-refresh-pill', label);
}

async function getDependencySnapshot(force = false) {
  const stillFresh = !force
    && state.dependencySnapshot
    && Date.now() - state.dependencyLastCheckedAt < DEPENDENCY_CACHE_MS;

  if (stillFresh) return state.dependencySnapshot;

  try {
    const deps = await API.deps.check();
    state.dependencySnapshot = deps;
    state.dependencyLastCheckedAt = Date.now();
    return deps;
  } catch (err) {
    console.warn('Dependency snapshot failed:', err);
    return null;
  }
}

let refreshTimeout = null;

async function refreshLauncherSurfaces(forceDeps = false) {
  // If we already have a refresh queued, and it's not a forced one, skip
  if (refreshTimeout && !forceDeps) return;

  // If forced, clear the existing timeout to run immediately
  if (forceDeps && refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }

  // Use a short delay to debounce multiple rapid calls
  if (!forceDeps) {
    refreshTimeout = setTimeout(() => {
      _executeRefresh(false);
      refreshTimeout = null;
    }, 100);
    return;
  }

  await _executeRefresh(forceDeps);
}

async function _executeRefresh(forceDeps = false) {
  const installPath = state.settings.installDirectory || '--';
  const launchVersion = state.gameVersion ||
    document.getElementById('nav-version')?.textContent?.replace(/^Version\s+/i, '').replace(/^v/i, '') || '--';

  const modeText = state.gameRunning
    ? 'Game is active'
    : state.isDownloading
      ? 'Download in progress'
      : state.updateAvailable
        ? 'Update ready to install'
        : state.gameInstalled
          ? 'Ready to play'
          : 'Ready to install';

  const themeLabel = titleCase(state.settings.theme || 'Sapphire');
  const languageLabel = (state.settings.language || 'en').toUpperCase();
  const installState = state.gameInstalled ? 'Installed' : 'Download required';
  const repairTitle = state.gameInstalled ? 'Protect the install' : 'Open setup flow';
  const repairCopy = state.gameInstalled
    ? 'Re-download broken or missing core files.'
    : 'Jump into setup and prepare the game for first launch.';
  const pageLabel = getPageDisplayName(state.currentPage);

  setTextContent('home-install-path', formatPathPreview(installPath));
  setTextContent('home-mode-state', modeText);
  setTextContent('hero-mode-copy', state.gameInstalled ? 'Desktop-ready control surface' : 'Premium onboarding and install flow');
  setTextContent('hero-ready-copy', state.gameInstalled ? 'Updates, setup, and play stay in sync' : 'Everything is staged for a clean first install');
  setTextContent('home-repair-title', repairTitle);
  setTextContent('home-repair-copy', repairCopy);

  setTextContent('settings-overview-install', installState);
  setTextContent('settings-overview-path', installPath);
  setTextContent('settings-overview-version', launchVersion === '--' ? '--' : `Version ${launchVersion}`);
  setTextContent('settings-overview-prefs', `${themeLabel} theme`);
  setTextContent('settings-overview-theme', `${languageLabel} language - ${state.settings.autoUpdate ? 'Auto-update on' : 'Auto-update off'}`);
  setTextContent('titlebar-active-page', pageLabel);
  setTextContent('titlebar-availability', modeText);

  const navVersion = document.getElementById('nav-version');
  if (navVersion) navVersion.textContent = launchVersion === '--' ? '--' : `Version ${launchVersion}`;

  updateRefreshLabels();

  const deps = await getDependencySnapshot(forceDeps);
  const dependencyLabel = getDependencyStatusLabel(deps);
  setTextContent('home-dependency-state', dependencyLabel);
  setTextContent('settings-overview-deps', dependencyLabel);
}

function updateProfileSummary(player = {}, sessions = []) {
  const username = player.username || state.settings.username || 'Anonymous';
  const avatar = player.avatar || state.settings.avatar || 'avatar1';
  const totalPlayTime = Number(player.totalPlayTime || 0);
  const joinedAt = player.joinedAt || player.createdAt;
  const sessionCount = Array.isArray(sessions) ? sessions.length : 0;
  const latestSession = getLatestSession(sessions);
  const latestSessionValue = latestSession?.endTime || latestSession?.startTime;

  state.settings.username = username;
  state.settings.avatar = avatar;

  document.getElementById('prof-name').textContent = username;
  document.getElementById('prof-joined').textContent = joinedAt
    ? `Joined: ${formatDate(joinedAt)}`
    : 'Joined: --';
  document.getElementById('prof-total-time').textContent = formatPlaytime(totalPlayTime);
  document.getElementById('prof-session-count').textContent = `${sessionCount}`;
  document.getElementById('prof-last-session').textContent = player.isOnline
    ? 'Live now'
    : (latestSessionValue ? formatRelativeTime(latestSessionValue) : 'No runs');
  document.getElementById('home-total-time').textContent = formatPlaytime(totalPlayTime);
  document.getElementById('prof-online-dot').className = `status-dot ${player.isOnline ? 'online' : ''}`;

  setImageSource('prof-avatar', getAvatarUrl(avatar));
  updateIdentityAvatarPreview();
}

function renderSessionHistory(sessions = []) {
  const list = document.getElementById('history-list');
  if (!list) return;

  if (!Array.isArray(sessions) || sessions.length === 0) {
    list.innerHTML = '<p class="text-muted">No session history yet.</p>';
    return;
  }

  list.innerHTML = sessions.map((session) => {
    const startedAt = session.startTime ? formatDateTime(session.startTime) : 'Unknown start';
    const endedAt = session.endTime ? formatDateTime(session.endTime) : 'Session still active';
    const duration = formatPlaytime(session.duration || 0);

    return `
      <div class="news-card">
        <h3 class="news-card-title">${startedAt}</h3>
        <div class="news-card-date">${endedAt}</div>
        <p class="news-card-excerpt">Session length: ${duration}</p>
      </div>
    `;
  }).join('');
}

// ═══════════════ INITIALIZATION ═══════════════ 
document.addEventListener('DOMContentLoaded', async () => {
  initTitlebar();
  initNavigation();
  initNotificationCenter();
  initEventListeners();

  await loadInitialData();

  startHomeScreenshotAutoRefresh();
  applyTranslations();
  await checkFirstRun();
  await checkIdentity();
});

// Language is now set from Settings page only — no popup on first launch

function t(key) {
  const lang = state.settings.language || 'en';
  return (window.translations && window.translations[lang] && window.translations[lang][key]) || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-t]').forEach(el => {
    const key = el.dataset.t;
    el.textContent = t(key);
  });

  // Update dynamic elements
  updatePlayButton(state.gameRunning ? 'RUNNING' : (state.gameInstalled ? 'PLAY' : 'INSTALL'));
}


async function loadInitialData() {
  try {
    // Load settings
    state.settings = await API.settings.getAll();

    // Check game status
    state.gameInstalled = await API.game.isInstalled();

    // Get game info
    if (state.gameInstalled) {
      const info = await API.game.getInfo();
      state.gameVersion = info.version;
      updateHomeUI(info);
    } else {
      updateHomeUI(null);
    }

    // Load version
    const localVersion = await API.updates.getLocalVersion();
    if (localVersion && localVersion.version !== '0.0.0') {
      document.getElementById('nav-version').textContent = `Version ${localVersion.version}`;
      document.getElementById('home-version').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        Version: ${localVersion.version}
      `;
    }

    // Load settings UI
    applySettingsToUI();
    syncInstallActions();
    state.currentAvatarIndex = Math.max(0, AVATARS.findIndex(url => url === getAvatarUrl(state.settings.avatar)));
    updateIdentityAvatarPreview();
    setImageSource('prof-avatar', getAvatarUrl(state.settings.avatar));

    // Theme loading
    if (state.settings.theme) {
      document.body.className = `theme-${state.settings.theme}`;
    }

    // Sound effects init
    if (typeof SoundManager !== 'undefined') {
      SoundManager.setEnabled(state.settings.soundEffects !== false);
    }

    // Connect to live stats
    initSocket();

    // Fetch remote config for social URLs (H5 fix)
    try {
      const remoteConfig = await fetchRemoteJson('/api/config');
      if (remoteConfig) {
        state.settings.discordUrl = remoteConfig.discordUrl;
        state.settings.youtubeUrl = remoteConfig.youtubeUrl;
        if (remoteConfig.serverStatus) {
          const isOnline = remoteConfig.serverStatus === 'online';
          updateHomeStatus(isOnline ? 'Server Online' : 'Maintenance', isOnline ? 'ready' : 'updating');
        }
      }
    } catch (e) { }

    // Load Home Screenshots (non-blocking — shows local banner instantly)
    loadHomeScreenshots();

    // Connect to live stats

    // Load news, patch notes, gallery (non-blocking for faster UI)
    // Refresh version display (Safe check)
    const navVer = document.getElementById('nav-version');
    if (navVer) {
      try {
        const ver = await API.updates.getLocalVersion();
        navVer.textContent = `v${ver.version}`;
      } catch (e) { }
    }

    // Boot sequential modules with independent error boundaries
    await safeRun('Surface Refresh', () => refreshLauncherSurfaces(true));
    await safeRun('News', loadNews);
    await safeRun('Patch Notes', loadPatchNotes);
    await safeRun('Gallery', loadGallery);
    await safeRun('Socket', initSocket);

    // Non-critical background tasks
    setTimeout(() => {
      safeRun('Connectivity', checkConnectivity);
      if (state.settings.autoUpdate && state.gameInstalled) {
        checkForUpdates(true).catch(() => { });
      }
    }, 2000);

  } catch (err) {
    console.error('CRITICAL: Launcher Init Failed:', err);
    showToast('error', 'Initialization Error', 'The launcher encountered a problem during startup. Some features may be limited.');
  }
}

/**
 * Run a function with an error boundary
 */
async function safeRun(label, fn) {
  try {
    const result = fn();
    if (result instanceof Promise) return await result;
    return result;
  } catch (err) {
    console.warn(`Module [${label}] failed:`, err);
  }
}

async function checkFirstRun() {
  if (!state.gameInstalled && state.settings.firstRun) {
    navigateTo('setup');
    runSetup(); // Initialize the multi-page wizard automatically
    await API.settings.set('firstRun', false);
    state.settings.firstRun = false;
  } else if (!state.settings.tutorialSeen) {
    showTutorial();
  }
}

// ═══════════════ TITLEBAR ═══════════════
function initTitlebar() {
  document.getElementById('btn-minimize').addEventListener('click', () => API.window.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => API.window.maximize());
  document.getElementById('btn-close').addEventListener('click', () => API.window.close());
}

// ═══════════════ NAVIGATION ═══════════════
function initNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateTo(page);
    });
  });
}

// Page order for determining slide direction (iOS-style)
const PAGE_ORDER = ['home', 'settings', 'profile', 'leaderboard', 'media', 'setup'];

function navigateTo(page) {
  const currentActive = document.querySelector('.page.active');
  const targetPage = document.getElementById(`page-${page}`);

  // Skip if already on this page
  if (currentActive && currentActive.id === `page-${page}`) return;

  // Play page transition sound
  SoundManager.playTransition();

  // Determine slide direction (iOS-style: forward = slide left, back = slide right)
  const currentIndex = PAGE_ORDER.indexOf(state.currentPage);
  const targetIndex = PAGE_ORDER.indexOf(page);
  const isGoingBack = targetIndex >= 0 && currentIndex >= 0 && targetIndex < currentIndex;

  if (currentActive) {
    // Clean up any previous transition classes
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-from-right', 'slide-in-from-left', 'page-leaving', 'page-back');
    });

    currentActive.classList.remove('active');
    currentActive.classList.add('page-leaving');
    if (isGoingBack) currentActive.classList.add('page-back');

    if (targetPage) {
      if (isGoingBack) targetPage.classList.add('page-back');
      targetPage.classList.add('active');
    }

    // Only respond to animationend on the page element itself, not children
    const onAnimEnd = (e) => {
      if (e.target !== currentActive) return;
      currentActive.classList.remove('page-leaving', 'page-back');
      currentActive.removeEventListener('animationend', onAnimEnd);
    };
    currentActive.addEventListener('animationend', onAnimEnd);

    // Safety fallback — longer than animation duration to avoid premature removal
    setTimeout(() => {
      currentActive.classList.remove('page-leaving', 'page-back');
      currentActive.removeEventListener('animationend', onAnimEnd);
    }, 500);
  } else {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active', 'page-back'));
    if (targetPage) {
      targetPage.classList.add('active');
    }
  }

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (activeLink) activeLink.classList.add('active');

  if (page !== 'home') {
    closeScreenshotLightbox();
  }

  state.currentPage = page;

  // Delay surface refresh until after transition to prevent flash
  const refreshDelay = currentActive ? 400 : 0;
  setTimeout(() => {
    refreshLauncherSurfaces();
  }, refreshDelay);

  if (page === 'home') {
    refreshHomeScreenshotsIfNeeded();
  }

  // Page-specific actions (delayed to sync with transition)
  const actionDelay = currentActive ? 400 : 0;
  setTimeout(() => {
    if (page === 'settings') refreshSettingsUI();
    if (page === 'profile') loadMyProfile();
    if (page === 'leaderboard') loadLeaderboard();
  }, actionDelay);
}

// ═══════════════ EVENT LISTENERS ═══════════════
async function handleHomeActionClick(action) {
  switch (action) {
    case 'updates':
      await checkForUpdates();
      break;
    case 'repair':
      if (state.gameInstalled) {
        await handleRepair();
      } else {
        navigateTo('setup');
        runSetup();
      }
      break;
    case 'folder':
      API.settings.openInstallDir();
      break;
    case 'settings':
      navigateTo('settings');
      break;
    default:
      break;
  }
}

function updateScreenshotLightbox(index = state.heroCurrentSlide) {
  if (!Array.isArray(state.homeScreenshots) || state.homeScreenshots.length === 0) return;

  const nextIndex = ((Number(index) || 0) + state.homeScreenshots.length) % state.homeScreenshots.length;
  const item = state.homeScreenshots[nextIndex];
  state.lightboxIndex = nextIndex;

  const image = document.getElementById('lightbox-image');
  if (image) image.src = resolveMediaUrl(item.url);
  setTextContent('lightbox-count', `${nextIndex + 1} / ${state.homeScreenshots.length}`);
  setTextContent('lightbox-title', item.title || `Screenshot ${nextIndex + 1}`);
  setTextContent('lightbox-date', `Added ${formatDate(item.createdAt || Date.now())}`);
}

function openScreenshotLightbox(index = state.heroCurrentSlide) {
  if (!Array.isArray(state.homeScreenshots) || state.homeScreenshots.length === 0) {
    showToast('info', 'No Screenshots Yet', 'Official screenshots will appear here once they are uploaded.');
    return;
  }

  const overlay = document.getElementById('screenshot-lightbox');
  if (!overlay) return;

  setHeroSlide(index);
  updateScreenshotLightbox(index);
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeScreenshotLightbox() {
  const overlay = document.getElementById('screenshot-lightbox');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function stepScreenshotLightbox(direction = 1) {
  if (!Array.isArray(state.homeScreenshots) || state.homeScreenshots.length === 0) return;
  const nextIndex = state.lightboxIndex + direction;
  setHeroSlide(nextIndex);
  updateScreenshotLightbox(nextIndex);
}

function initEventListeners() {
  // ─── Play Button ───
  document.getElementById('btn-play')?.addEventListener('click', handlePlayClick);
  document.getElementById('hero-open-lightbox')?.addEventListener('click', () => openScreenshotLightbox());
  document.getElementById('hero-open-gallery')?.addEventListener('click', () => navigateTo('media'));
  document.getElementById('hero-slider')?.addEventListener('click', () => openScreenshotLightbox());

  document.querySelectorAll('[data-home-action]').forEach((actionBtn) => {
    actionBtn.addEventListener('click', () => handleHomeActionClick(actionBtn.dataset.homeAction));
  });

  const lightbox = document.getElementById('screenshot-lightbox');
  if (lightbox) {
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeScreenshotLightbox();
    });
  }
  document.getElementById('lightbox-close')?.addEventListener('click', closeScreenshotLightbox);
  document.getElementById('lightbox-prev')?.addEventListener('click', () => stepScreenshotLightbox(-1));
  document.getElementById('lightbox-next')?.addEventListener('click', () => stepScreenshotLightbox(1));

  document.addEventListener('keydown', (event) => {
    const lb = document.getElementById('screenshot-lightbox');
    if (!lb || lb.classList.contains('hidden')) return;
    if (event.key === 'Escape') closeScreenshotLightbox();
    if (event.key === 'ArrowLeft') stepScreenshotLightbox(-1);
    if (event.key === 'ArrowRight') stepScreenshotLightbox(1);
  });

  // ─── Settings Actions ───
  document.getElementById('settings-repair-btn')?.addEventListener('click', handleRepair);
  document.getElementById('settings-uninstall-btn')?.addEventListener('click', handleUninstall);

  // ─── Setup ───
  document.getElementById('setup-browse-btn')?.addEventListener('click', handleSetupBrowse);

  // ─── Settings ───
  document.getElementById('settings-change-dir')?.addEventListener('click', handleChangeDir);
  document.getElementById('settings-open-dir')?.addEventListener('click', () => API?.settings?.openInstallDir());
  document.getElementById('settings-clear-cache')?.addEventListener('click', handleClearCache);

  // ─── Settings Sidebar Navigation ───
  document.querySelectorAll('.settings-nav-item').forEach(navItem => {
    navItem.addEventListener('click', () => {
      const section = navItem.dataset.settingsSection;
      if (!section) return;

      // Update nav active state
      document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
      navItem.classList.add('active');

      // Show target section, hide others
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      const targetSection = document.getElementById(`settings-section-${section}`);
      if (targetSection) targetSection.classList.add('active');
    });
  });

  // ─── Settings Toggles ───
  const toggleIds = [
    'setting-autoUpdate', 'setting-backgroundDownload', 'setting-discordRPC',
    'setting-launchOnStartup', 'setting-minimizeToTray', 'setting-minimizeOnLaunch', 
    'setting-soundEffects', 'setting-enableOverlay'
  ];
  toggleIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const key = id.replace('setting-', '');
      el.addEventListener('change', async () => {
        await API.settings.set(key, el.checked);
        state.settings[key] = el.checked;

        // Play toggle sound for all toggles
        SoundManager.playToggle(el.checked);

        // Sound effects toggle — special handling
        if (key === 'soundEffects') {
          SoundManager.setEnabled(el.checked);
          return;
        }

        // H3 fix: Wire startup toggle to Windows Registry
        if (key === 'launchOnStartup') {
          await API.settings.setStartup(el.checked);
        }

        showToast('success', 'Settings Updated', `${key} has been ${el.checked ? 'enabled' : 'disabled'}`);
        refreshLauncherSurfaces();
      });
    }
  });

  // ─── Theme Selector ───
  const themeEl = document.getElementById('setting-theme');
  if (themeEl) {
    themeEl.addEventListener('change', async () => {
      const theme = themeEl.value;
      document.body.className = `theme-${theme}`;
      await API.settings.set('theme', theme);
      state.settings.theme = theme;
      showToast('success', 'Theme Updated', `Switched to ${theme} theme`);
      refreshLauncherSurfaces();
    });
  }

  // ─── Language Selector (from Settings page) ───
  const langEl = document.getElementById('setting-language');
  if (langEl) {
    langEl.addEventListener('change', async () => {
      const lang = langEl.value;
      await API.settings.set('language', lang);
      state.settings.language = lang;
      applyTranslations();
      showToast('success', 'Language Updated', `Language changed to ${lang.toUpperCase()}`);
      refreshLauncherSurfaces();
    });
  }

  // ─── Social Links (H5 fix — use openExternal from preload) ───
  const discordLink = document.getElementById('link-discord');
  if (discordLink) discordLink.onclick = (e) => {
    e.preventDefault();
    const url = state.settings.discordUrl || '#';
    if (url && url !== '#') API.window.openExternal(url);
  };
  const youtubeLink = document.getElementById('link-youtube');
  if (youtubeLink) youtubeLink.onclick = (e) => {
    e.preventDefault();
    const url = state.settings.youtubeUrl || '#';
    if (url && url !== '#') API.window.openExternal(url);
  };

  // ─── IPC Event Listeners ───
  if (API.on) {
    API.on('download:progress', (data) => {
      updateDownloadProgress(data);
    });

    // নিরাপত্তা গার্ড: সরাসরি গেম ওপেন করলে সতর্কবার্তা দেখাবে
    API.on('game:unauthorized', (data) => {
      showToast('error', t('security_alert'), t('unauthorized_msg'));
    });

    API.on('install:progress', (data) => {
      updateInstallProgress(data);
    });

    API.on('install:complete', (data) => {
      state.isDownloading = false;
      state.gameInstalled = true;
      updatePlayButton('PLAY');
      hideDownloadProgress();
      SoundManager.playSuccess();
      showToast('success', 'Installation Complete!', data.message || 'Game is ready to play');
      addNotification({ type: 'success', title: 'Installation Complete', message: 'Stumble Tracer is installed and ready to play!' });

      // Update settings elements
      const repairRow = document.getElementById('settings-repair-row');
      const uninstallRow = document.getElementById('settings-uninstall-row');
      if (repairRow) repairRow.style.display = 'flex';
      if (uninstallRow) uninstallRow.style.display = 'flex';
    });

    API.on('install:error', (data) => {
      state.isDownloading = false;
      updatePlayButton('RETRY');
      hideDownloadProgress();
      SoundManager.playError();
      showToast('error', 'Installation Failed', data.message || 'An error occurred');
      addNotification({ type: 'error', title: 'Installation Failed', message: data.message || 'An error occurred during installation' });
    });

    API.on('game:status', (data) => {
      switch (data.status) {
        case 'launching':
          state.gameRunning = true;
          updatePlayButton('RUNNING');
          document.getElementById('play-status-text').textContent = 'Game is launching...';
          break;
        case 'running':
          state.gameRunning = true;
          updatePlayButton('RUNNING');
          document.getElementById('play-status-text').textContent = 'Game is running';
          break;
        case 'closed':
          state.gameRunning = false;
          updatePlayButton('PLAY');
          document.getElementById('play-status-text').textContent = '';
          SoundManager.playShutdown();
          showToast('info', 'Game Closed', 'Stumble Tracer has been closed');
          if (state.socket) {
            state.socket.emit('game:stopped');
            if (state.playStartTime) {
              const duration = Math.round((Date.now() - state.playStartTime) / 1000);
              state.socket.emit('stats:playtime', { hwid: state.hwid, duration });
              state.playStartTime = null;
            }
          }
          break;
        case 'error':
          state.gameRunning = false;
          updatePlayButton('PLAY');
          showToast('error', 'Game Error', data.message || 'Game encountered an error');
          if (state.socket) state.socket.emit('game:stopped');
          break;
      }

      refreshLauncherSurfaces();
    });

    API.on('toast:show', (data) => {
      showToast(data.type, data.title, data.message);
    });

    // ─── Launcher Update Listener ───
    API.on('update:status', (data) => {
      if (data.type === 'launcher') {
        updateLauncherUpdateUI(data);
      }
    });
  }
}

/**
 * Update the launcher update notification bar
 */
function updateLauncherUpdateUI(data) {
  const bar = document.getElementById('launcher-update-bar');
  const text = document.getElementById('update-bar-text');
  const progress = document.getElementById('update-bar-progress');
  const fill = document.getElementById('update-bar-fill');
  const btn = document.getElementById('update-bar-btn');

  if (!bar || !text || !progress || !fill || !btn) return;

  switch (data.status) {
    case 'available':
      bar.classList.remove('hidden');
      text.textContent = `Update available (v${data.version})`;
      progress.classList.add('hidden');
      btn.textContent = 'DOWNLOADING...';
      btn.style.display = 'block';
      btn.disabled = true;
      break;
    case 'downloading':
      bar.classList.remove('hidden');
      text.textContent = `Downloading update... ${Math.round(data.percent || 0)}%`;
      progress.classList.remove('hidden');
      fill.style.width = `${data.percent || 0}%`;
      btn.textContent = 'DOWNLOADING...';
      btn.style.display = 'block';
      btn.disabled = true;
      break;
    case 'ready':
      bar.classList.remove('hidden');
      text.textContent = `Version ${data.version} ready to install`;
      progress.classList.add('hidden');
      btn.textContent = 'RESTART TO UPDATE';
      btn.style.display = 'block';
      btn.disabled = false;

      btn.onclick = async () => {
        btn.textContent = 'RESTARTING...';
        btn.disabled = true;
        try {
          await API.updates.installLauncher();
        } catch (err) {
          console.error('Failed to install launcher update:', err);
          showToast('error', 'Update Failed', 'Could not restart launcher to update.');
        }
      };
      break;
    default:
      bar.classList.add('hidden');
      break;
  }
}

// ═══════════════ PLAY BUTTON LOGIC ═══════════════
async function handlePlayClick() {
  const btn = document.getElementById('btn-play');
  const btnText = btn.querySelector('.play-btn-text');
  const playStatusText = document.getElementById('play-status-text');

  if (state.gameRunning) {
    showToast('info', 'Already Running', 'Stumble Tracer is already running');
    SoundManager.playClick();
    return;
  }

  if (state.isDownloading) return;

  // H1 fix: If update is pending and user clicks UPDATE, trigger download
  if (state.updateAvailable && state.pendingUpdateInfo) {
    await downloadUpdate(state.pendingUpdateInfo);
    state.pendingUpdateInfo = null;
    return;
  }

  if (!state.gameInstalled) {
    // Navigate to setup for first-time install
    navigateTo('setup');
    runSetup();
    return;
  }

  // Handle RETRY state
  if (btnText.textContent === 'RETRY') {
    if (state.gameInstalled) {
      await checkForUpdates();
    } else {
      navigateTo('setup');
      runSetup();
    }
    return;
  }

  try {
    updatePlayButton('CHECKING');
    const deps = await ensureSystemDependencies((message) => {
      if (playStatusText) playStatusText.textContent = message;
    });

    if (!deps.allGood) {
      const missing = getMissingDependencies(deps).join(' and ');
      updatePlayButton('PLAY');
      if (playStatusText) playStatusText.textContent = `Install ${missing} to launch the game.`;
      showToast('error', 'Missing Requirements', `${missing} is required to launch the game.`);
      return;
    }

    const updateInfo = await API.updates.check();

    if (updateInfo.hasUpdate || updateInfo.hasDllUpdate) {
      state.updateAvailable = true;
      state.pendingUpdateInfo = updateInfo; // Store for manual trigger

      // Show UPDATE button
      updatePlayButton('UPDATE');
      document.getElementById('play-status-text').textContent = 'Update available!';
      showToast('info', 'Update Available', `New version ${updateInfo.remoteVersion?.version || ''} available`);

      // Auto-update if enabled, otherwise let user click UPDATE to trigger
      if (state.settings.autoUpdate) {
        await downloadUpdate(updateInfo);
      }
      return;
    }

    // All good - launch game
    updatePlayButton('LAUNCHING');
    document.getElementById('play-status-text').textContent = 'Launching...';
    SoundManager.playLaunch();

    const result = await API.game.launch();
    if (result.success) {
      state.playStartTime = Date.now();
      if (!state.hwid) state.hwid = await API.analytics.getHWID();
      if (state.socket) state.socket.emit('game:started', { hwid: state.hwid });
    } else {
      const isIntegrityError = result.error && result.error.includes('INTEGRITY_FAILED');

      if (isIntegrityError) {
        const missingList = result.error.replace('INTEGRITY_FAILED:', '').trim();
        showToast('error', 'Corruption Detected', `Missing: ${missingList}`, 8000, {
          label: 'Repair Now',
          callback: () => handleRepair()
        });
      } else {
        showToast('error', 'Launch Failed', result.error);
      }

      updatePlayButton('PLAY');
      document.getElementById('play-status-text').textContent = '';
    }
  } catch (err) {
    console.error('Play error:', err);
    updatePlayButton('PLAY');
    document.getElementById('play-status-text').textContent = '';
    showToast('error', 'Error', 'Failed to launch game');
  }
}

function updatePlayButton(status) {
  const btn = document.getElementById('btn-play');
  const btnText = btn.querySelector('.play-btn-text');

  // Remove all state classes
  btn.classList.remove('installing', 'updating', 'error');

  switch (status) {
    case 'PLAY':
      btnText.textContent = t('play') || 'PLAY';
      break;
    case 'INSTALL':
      btnText.textContent = t('install') || 'INSTALL';
      break;
    case 'DOWNLOAD':
      btnText.textContent = 'DOWNLOAD';
      break;
    case 'CHECKING':
      btnText.textContent = '...';
      break;
    case 'UPDATE':
      btnText.textContent = t('update') || 'UPDATE';
      btn.classList.add('updating');
      break;
    case 'DOWNLOADING':
      btnText.textContent = t('downloading') || 'DOWNLOADING';
      btn.classList.add('installing');
      break;
    case 'EXTRACTING':
      btnText.textContent = t('extracting') || 'EXTRACTING';
      btn.classList.add('installing');
      break;
    case 'LAUNCHING':
      btnText.textContent = t('launching') || '...';
      btn.classList.add('installing');
      break;
    case 'RUNNING':
      btnText.textContent = t('running') || 'RUNNING';
      btn.classList.add('installing');
      break;
    case 'RETRY':
      btnText.textContent = 'RETRY';
      btn.classList.add('error');
      break;
  }
}

function getMissingDependencies(deps = {}) {
  const missing = [];
  if (!deps.vcRedist) missing.push('Visual C++ Redistributable');
  if (!deps.dotNet) missing.push('.NET Desktop Runtime');
  return missing;
}

function setSetupDependencyStatus(message, tone = 'info') {
  const statusEl = document.getElementById('step2-status');
  if (!statusEl) return;

  setTextContent('setup-requirement-summary', message);
  if (tone === 'success') {
    setSetupCheckState('vcredist', 'success', 'Visual C++ Redistributable is ready');
    setSetupCheckState('dotnet', 'success', '.NET Desktop Runtime is ready');
  } else if (tone === 'error') {
    setSetupCheckState('vcredist', 'warning', 'Could not verify Visual C++');
    setSetupCheckState('dotnet', 'warning', 'Could not verify .NET runtime');
  } else {
    setSetupCheckState('vcredist', 'active', 'Checking Microsoft runtime');
    setSetupCheckState('dotnet', 'active', 'Checking desktop runtime');
  }

  const toneClass = {
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-danger'
  }[tone] || '';

  if (tone === 'success' || tone === 'error') {
    statusEl.innerHTML = `<span class="${toneClass}">${message}</span>`;
    return;
  }

  statusEl.innerHTML = `<span class="spinner"></span> <span class="${toneClass}">${message}</span>`;
}

async function ensureSystemDependencies(onStatus) {
  if (onStatus) onStatus('Checking system dependencies...', 'info');

  const deps = await API.deps.check();
  if (deps.allGood) {
    if (onStatus) onStatus('System is fully optimized.', 'success');
    return deps;
  }

  const missing = getMissingDependencies(deps);
  if (onStatus) onStatus(`Installing missing components: ${missing.join(' and ')}...`, 'warning');

  let progressHandler;

  try {
    if (onStatus) {
      progressHandler = API.on('deps:progress', (data) => {
        if (data?.stage) onStatus(data.stage, 'warning');
      });
    }

    const installResult = await API.deps.install();
    const finalDeps = installResult && typeof installResult.allGood === 'boolean'
      ? installResult
      : await API.deps.check();

    if (finalDeps.allGood) {
      if (onStatus) onStatus('Required components installed.', 'success');
      return finalDeps;
    }

    const remaining = getMissingDependencies(finalDeps);
    if (onStatus) onStatus(`Missing required components: ${remaining.join(' and ')}.`, 'error');
    return finalDeps;
  } finally {
    if (progressHandler) progressHandler();
  }
}

// ═══════════════ UPDATE SYSTEM ═══════════════
async function checkForUpdates(silent = false) {
  try {
    const updateInfo = await API.updates.check();

    if (updateInfo.hasUpdate || updateInfo.hasDllUpdate) {
      state.updateAvailable = true;
      updateHomeStatus('Update Available', 'updating');

      if (!silent) {
        showToast('info', 'Update Available',
          `Version ${updateInfo.remoteVersion?.version || 'new'} is available`);
        addNotification({ type: 'update', title: 'Update Available', message: `Version ${updateInfo.remoteVersion?.version || 'new'} is ready to install` });
      }

      if (state.settings.autoUpdate) {
        await downloadUpdate(updateInfo);
      }
    } else {
      if (!silent) {
        showToast('success', 'Up to Date', 'You have the latest version');
      }
      state.updateAvailable = false;
      state.pendingUpdateInfo = null;
      updateHomeStatus('Ready to Play', 'ready');
    }
    refreshLauncherSurfaces();
  } catch (err) {
    if (!silent) {
      showToast('error', 'Update Check Failed', err.message || 'Could not check for updates');
    }
    refreshLauncherSurfaces();
  }
}

async function downloadUpdate(updateInfo) {
  state.isDownloading = true;
  if (API.power) API.power.block();
  updatePlayButton('DOWNLOADING');
  showDownloadProgress();

  try {
    const result = await API.updates.download();
    if (result.success) {
      state.isDownloading = false;
      state.updateAvailable = false;
      hideDownloadProgress();
      updatePlayButton('PLAY');
      updateHomeStatus('Ready to Play', 'ready');
      showToast('success', 'Updated!', 'Game has been updated to the latest version');

      // Refresh version display
      const ver = await API.updates.getLocalVersion();
      document.getElementById('nav-version').textContent = `v${ver.version}`;
      refreshLauncherSurfaces(true);
    }
  } catch (err) {
    state.isDownloading = false;
    hideDownloadProgress();
    document.getElementById('play-status-text').textContent = `Error: ${err.message}`;
    updatePlayButton('RETRY');
    showToast('error', 'Update Failed', err.message);
    refreshLauncherSurfaces();
  } finally {
    if (API.power) API.power.unblock();
  }
}

// ═══════════════ DOWNLOAD PROGRESS ═══════════════
function showDownloadProgress() {
  document.getElementById('download-progress').classList.remove('hidden');
}

function hideDownloadProgress() {
  document.getElementById('download-progress').classList.add('hidden');
}

function updateDownloadProgress(data) {
  document.getElementById('progress-fill').style.width = `${data.percent}%`;
  document.getElementById('progress-details').textContent = `${data.percent}%`;

  if (data.speed) {
    const speedMB = (data.speed / (1024 * 1024)).toFixed(1);
    document.getElementById('progress-speed').textContent = `${speedMB} MB/s`;
  }

  if (data.eta) {
    const mins = Math.floor(data.eta / 60);
    const secs = data.eta % 60;
    document.getElementById('progress-eta').textContent = `ETA: ${mins}m ${secs}s`;
  }

  if (data.total) {
    const dlMB = (data.downloaded / (1024 * 1024)).toFixed(1);
    const totalMB = (data.total / (1024 * 1024)).toFixed(1);
    document.getElementById('progress-label').textContent = `Downloading... ${dlMB} / ${totalMB} MB`;
  }
}

function updateInstallProgress(data) {
  if (data.stage === 'extracting') {
    document.getElementById('progress-label').textContent = data.message || 'Extracting...';
    document.getElementById('progress-fill').style.width = `${data.percent}%`;
    document.getElementById('progress-details').textContent = `${data.percent}%`;
  }
}

// ═══════════════ HOME UI ═══════════════
function updateHomeUI(info) {
  if (info) {
    if (info.version) {
      document.getElementById('home-version').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        Version: ${info.version}
      `;
    }
    updateHomeStatus(info.isRunning ? 'Running' : 'Ready to Play', info.isRunning ? 'updating' : 'ready');
  }

  if (!state.gameInstalled) {
    updatePlayButton('DOWNLOAD');
    updateHomeStatus('Not Installed', 'error');
  }

  syncInstallActions();
  refreshLauncherSurfaces();
}

function updateHomeStatus(text, type = 'ready') {
  const statusEl = document.getElementById('home-status');
  statusEl.className = `meta-badge status-${type}`;
  statusEl.innerHTML = `<span class="status-dot"></span><span id="server-status-text">${text}</span>`;
}

// ═══════════════ NEWS & PATCH NOTES ═══════════════
async function loadNews() {
  try {
    const list = await API.news.get();
    const safeList = Array.isArray(list) ? list : [];
    const news = safeList.filter(i => i.category !== 'patch_notes');
    const container = document.getElementById('news-container');
    if (!container) return;

    container.innerHTML = news.map((item, idx) => `
      <div class="news-card" style="animation-delay: ${idx * 50}ms" onclick="showNewsDetail('${item._id || item.id || ''}')">
        <h3 class="news-card-title">${item.title}</h3>
        <div class="news-card-date">${formatDate(item.date)}</div>
        <p class="news-card-excerpt">${item.excerpt}</p>
      </div>
    `).join('') || '<p class="text-muted">No news available.</p>';
    staggerCards(container);
  } catch (err) {
    console.error('Failed to load news:', err);
  }
}

async function loadPatchNotes() {
  try {
    const list = await API.news.get();
    const safeList = Array.isArray(list) ? list : [];
    const patches = safeList.filter(i => i.category === 'patch_notes');
    const container = document.getElementById('patch-notes-container');
    if (!container) return;

    container.innerHTML = patches.map((item, idx) => `
      <div class="news-card patch-card" style="animation-delay: ${idx * 50}ms">
        <div class="news-card-date">${formatDate(item.date)}</div>
        <h3 class="news-card-title">${item.title}</h3>
        <p class="news-card-excerpt">${item.excerpt}</p>
      </div>
    `).join('') || '<p class="text-muted">No patches recently.</p>';
    staggerCards(container);
  } catch (err) {
    console.error('Failed to load patch notes:', err);
  }
}

function initSocket() {
  try {
    // Port 3000 is our admin server
    const socket = io('https://sg-prime-game-launcher.onrender.com');
    state.socket = socket;

    socket.on('connect', async () => {
      console.log('Connected to Stumble Tracer Central');
      const connEl = document.getElementById('nav-connection');
      if (connEl) {
        connEl.innerHTML = '● Online';
        connEl.className = 'nav-connection online';
      }

      // Identify this player once connected
      if (!state.hwid) state.hwid = await API.analytics.getHWID();
      if (state.settings.username) {
        socket.emit('player:identify', { hwid: state.hwid });
      }
    });

    socket.on('disconnect', () => {
      const connEl = document.getElementById('nav-connection');
      if (connEl) {
        connEl.innerHTML = '● Offline';
        connEl.className = 'nav-connection offline';
      }
    });

    socket.on('stats:update', (data) => {
      if (data.activePlayers !== undefined) {
        // Update main UI with animation
        const el = document.getElementById('player-count');
        if (typeof animateCounter === 'function' && el) {
          animateCounter(el, data.activePlayers);
        } else if (el) {
          el.textContent = data.activePlayers;
        }

        // Relay to Overlay
        if (API.send) {
          API.send('overlay:relay', { channel: 'overlay:online', data: { count: data.activePlayers } });
        }
      }
    });

    // Listen for remote config updates
    socket.on('config:update', (data) => {
      if (data.serverStatus) {
        const isOnline = data.serverStatus === 'online';
        updateHomeStatus(isOnline ? 'Server Online' : 'Maintenance', isOnline ? 'ready' : 'updating');
      }
    });

    // Listen for specific Admin Broadcasts
    socket.on('admin:alert', (data) => {
      console.log('Admin Broadcast Received:', data);
      if (API.send) {
        API.send('overlay:relay', { channel: 'overlay:alert', data: { message: data.message } });
      }
      showToast('info', 'Admin Broadcast', data.message);
    });

  } catch (err) {
    console.error('Socket init error:', err);
  }
}

async function loadGallery() {
  try {
    const list = await fetchRemoteJson('/api/media');
    const safeList = Array.isArray(list) ? list.filter(item => item.category !== 'screenshot') : [];
    const containers = [
      document.getElementById('launcher-media-grid'),
      document.getElementById('launcher-media-grid-page')
    ].filter(Boolean);
    if (!containers.length) return;

    const markup = safeList.map(item => `
      <div class="news-card media-card" onclick="viewMedia('${item.url}')">
        <div class="media-preview" style="height: 150px; background: url('${resolveMediaUrl(item.url)}') center/cover no-repeat; border-radius: 8px; margin-bottom: 10px;">
          ${item.type === 'video' ? '<div class="play-overlay">▶</div>' : ''}
        </div>
        <h3 class="news-card-title">${item.title}</h3>
      </div>
    `).join('') || '<p class="text-muted">No community media items yet.</p>';

    containers.forEach((container) => {
      container.innerHTML = markup;
    });
  } catch (err) {
    console.error('Failed to load launcher gallery:', err);
  }
}

function viewMedia(url) {
  API.window.openExternal(resolveMediaUrl(url));
}

function showNewsDetail(id) {
  showToast('info', 'News', 'Full article view coming soon!');
}

// ═══════════════ TUTORIAL LOGIC ═══════════════
function showTutorial() {
  const overlay = document.getElementById('tutorial-overlay');
  const slides = document.querySelectorAll('.tut-slide');
  const dots = document.querySelectorAll('.tut-dot');
  const nextBtn = document.getElementById('tut-next-btn');
  let currentSlide = 0;

  if (!overlay) return;
  overlay.classList.remove('hidden');

  const updateSlide = () => {
    slides.forEach((s, idx) => {
      s.classList.toggle('active', idx === currentSlide);
    });
    dots.forEach((d, idx) => {
      d.classList.toggle('active', idx === currentSlide);
    });
    if (currentSlide === slides.length - 1) {
      nextBtn.textContent = 'Get Started';
    } else {
      nextBtn.textContent = 'Next';
    }
  };

  nextBtn.onclick = async () => {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
      updateSlide();
    } else {
      overlay.classList.add('hidden');
      await API.settings.set('tutorialSeen', true);
      state.settings.tutorialSeen = true;
    }
  };

  updateSlide();
}

// ═══════════════ REPAIR & UNINSTALL ═══════════════
async function handleRepair() {
  showToast('info', 'Repairing...', 'Re-downloading game files');
  updatePlayButton('DOWNLOADING');
  showDownloadProgress();

  try {
    const result = await API.game.repair();
    if (result.success) {
      showToast('success', 'Repair Complete', 'Game files have been restored');
    }
  } catch (err) {
    showToast('error', 'Repair Failed', err.message);
  }

  updatePlayButton('PLAY');
  hideDownloadProgress();
  refreshLauncherSurfaces(true);
}

async function handleUninstall() {
  if (!confirm('Are you sure you want to uninstall Stumble Tracer? This will delete all game files.')) return;

  try {
    const result = await API.game.uninstall();
    if (result.success) {
      state.gameInstalled = false;
      updatePlayButton('DOWNLOAD');
      updateHomeStatus('Not Installed', 'error');
      showToast('success', 'Uninstalled', 'Stumble Tracer has been removed');
      syncInstallActions();
      await refreshLauncherSurfaces(true);
    }
  } catch (err) {
    showToast('error', 'Uninstall Failed', err.message);
  }
}

// ═══════════════ SETUP WIZARD ═══════════════
async function showSetupScreen(screenNum) {
  const screens = document.querySelectorAll('.setup-screen');
  updateSetupSteps(screenNum);
  updateSetupSummary(screenNum);
  screens.forEach((s, idx) => {
    s.classList.remove('active');
    s.classList.add('hidden');
    if (idx + 1 === screenNum) {
      s.classList.remove('hidden');
      // small delay to let display:block kick in before opacity transition
      setTimeout(() => s.classList.add('active'), 50);
    }
  });
}

function runSetupLegacy() {
  // Initiated when user clicks DOWNLOAD on home page
  showSetupScreen(1);

  // Binding screen 1 -> 2
  const next1 = document.getElementById('setup-btn-next-1');
  if (next1) {
    next1.onclick = async () => {
      showSetupScreen(2);

      // Load directory
      const settings = await API.settings.getAll();
      document.getElementById('setup-install-dir').value = settings.installDirectory;

      // Background dependency check
      document.getElementById('step2-status').innerHTML = '<span class="spinner"></span> Checking system dependencies...';
      try {
        const deps = await API.deps.check();
        if (deps.allGood) {
          document.getElementById('step2-status').innerHTML = '<span class="text-success">✓ System is fully optimized.</span>';
        } else {
          document.getElementById('step2-status').innerHTML = '<span class="text-warning">⚙ Installing missing components...</span>';
          await API.deps.install();
          document.getElementById('step2-status').innerHTML = '<span class="text-success">✓ Required components installed.</span>';
        }
      } catch (err) {
        document.getElementById('step2-status').innerHTML = '<span class="text-warning">⚠ Could not check dependencies.</span>';
      }

      // Enable DOWNLOAD button for screen 2
      const next2 = document.getElementById('setup-btn-next-2');
      next2.disabled = false;
      next2.onclick = async () => {
        await startGameDownload();
      };
    };
  }
}

function runSetup() {
  showSetupScreen(1);
  resetSetupPanels();

  const next1 = document.getElementById('setup-btn-next-1');
  const next2 = document.getElementById('setup-btn-next-2');
  const next2Text = next2?.querySelector('.play-btn-text');

  const prepareSetupDownload = async () => {
    showSetupScreen(2);

    const settings = await API.settings.getAll();
    document.getElementById('setup-install-dir').value = settings.installDirectory;
    updateSetupInstallPreview(settings.installDirectory);

    if (next2) next2.disabled = true;
    if (next2Text) next2Text.textContent = 'Checking...';
    syncSetupDependencyIndicators();

    try {
      const deps = await ensureSystemDependencies(setSetupDependencyStatus);
      syncSetupDependencyIndicators(deps);

      if (!deps.allGood) {
        const missing = getMissingDependencies(deps).join(' and ');
        if (next2) next2.disabled = false;
        if (next2Text) next2Text.textContent = 'Recheck Requirements';
        if (next2) next2.onclick = prepareSetupDownload;
        showToast('error', 'Requirements Needed', `${missing} is required before downloading the game.`);
        return;
      }

      if (next2) next2.disabled = false;
      if (next2Text) next2Text.textContent = 'Download';
      if (next2) {
        next2.onclick = async () => {
          await startGameDownload();
        };
      }
    } catch (err) {
      setSetupDependencyStatus('Could not check dependencies.', 'error');
      if (next2) next2.disabled = false;
      if (next2Text) next2Text.textContent = 'Retry Check';
      if (next2) next2.onclick = prepareSetupDownload;
      showToast('error', 'Dependency Check Failed', err.message || 'Could not verify required system components.');
    }
  };

  if (next1) {
    next1.onclick = prepareSetupDownload;
  }
}

async function startGameDownload() {
  showSetupScreen(3);
  document.getElementById('setup-progress-text').textContent = 'Connecting to servers...';
  setTextContent('setup-download-hint', 'Connecting to servers');
  setTextContent('setup-download-stage', 'Secure desktop download');
  setSetupCheckState('download', 'active', 'Downloading secure package');

  const progressHandler = API.on('download:progress', (data) => {
    document.getElementById('setup-progress-fill').style.width = `${data.percent}%`;
    document.getElementById('setup-progress-percent').textContent = `${data.percent}%`;
    const dlMB = (data.downloaded / (1024 * 1024)).toFixed(1);
    const totalMB = (data.total / (1024 * 1024)).toFixed(1);
    document.getElementById('setup-progress-text').textContent = `${dlMB} MB / ${totalMB} MB`;
    setTextContent('setup-download-hint', `${data.percent}% complete`);
    setTextContent('setup-download-stage', `${dlMB} / ${totalMB} MB`);
  });

  try {
    const result = await API.game.install();
    if (result && !result.success) {
      throw new Error(result.error || 'Unknown installation error');
    }

    document.getElementById('setup-progress-fill').style.width = '100%';
    document.getElementById('setup-progress-percent').textContent = '100%';
    document.getElementById('setup-progress-text').textContent = 'Installation Complete!';
    setTextContent('setup-download-hint', 'Package delivered and verified');
    setTextContent('setup-download-stage', 'Ready to launch');
    state.gameInstalled = true;
    syncInstallActions();
    await refreshLauncherSurfaces(true);
    setSetupCheckState('download', 'success', 'Game package installed successfully');
    setTextContent('setup-finish-install', 'Game files are ready');
    setTextContent('setup-finish-deps', getDependencyStatusLabel(state.dependencySnapshot));

    setTimeout(() => {
      showSetupScreen(4);
    }, 1000);

  } catch (err) {
    document.getElementById('setup-progress-text').innerHTML = `<span class="text-danger">Failed: ${err.message}</span>`;
    document.getElementById('setup-progress-percent').textContent = '⚠️';

    setTextContent('setup-download-hint', 'Download failed');
    setTextContent('setup-download-stage', 'Retry required');
    setSetupCheckState('download', 'error', err.message || 'Download failed');
    showToast('error', 'Setup Failed', err.message);

    // Show a retry button on setup screen
    const next2 = document.getElementById('setup-btn-next-2');
    if (next2) {
      const next2RetryText = next2.querySelector('.play-btn-text');
      if (next2RetryText) {
        next2RetryText.textContent = 'Retry Download';
      } else {
        next2.textContent = 'Retry Download';
      }
      next2.disabled = false;
      showSetupScreen(2);
    }
  }

  if (progressHandler) progressHandler();

  // Binding screen 4 -> completion
  const finishBtn = document.getElementById('setup-btn-finish');
  if (finishBtn) {
    finishBtn.onclick = () => {
      updatePlayButton('PLAY');
      updateHomeUI(null);
      navigateTo('home');

      if (!state.settings.username) {
        setTimeout(() => checkIdentity(), 250);
      } else if (!state.settings.tutorialSeen) {
        setTimeout(showTutorial, 500);
      }
    };
  }
}

async function handleSetupBrowse() {
  let dir = await API.settings.selectInstallDir();
  if (dir) {
    document.getElementById('setup-install-dir').value = dir;
    await API.settings.set('installDirectory', dir);
    state.settings.installDirectory = dir;
    updateSetupInstallPreview(dir);
    refreshLauncherSurfaces();
  }
}

// ═══════════════ SETTINGS ═══════════════
function applySettingsToUI() {
  const s = state.settings;
  const setChecked = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };

  setChecked('setting-autoUpdate', s.autoUpdate);
  setChecked('setting-backgroundDownload', s.backgroundDownload);
  setChecked('setting-discordRPC', s.discordRPC);
  setChecked('setting-launchOnStartup', s.launchOnStartup);
  setChecked('setting-minimizeToTray', s.minimizeToTray);
  setChecked('setting-minimizeOnLaunch', s.minimizeOnLaunch);
  setChecked('setting-enableOverlay', s.enableOverlay);
  setChecked('setting-soundEffects', s.soundEffects !== false);

  // Set select dropdowns
  const themeEl = document.getElementById('setting-theme');
  if (themeEl && s.theme) themeEl.value = s.theme;
  const langEl = document.getElementById('setting-language');
  if (langEl && s.language) langEl.value = s.language;

  document.getElementById('settings-install-path').textContent = s.installDirectory || '--';
}

async function refreshSettingsUI() {
  state.settings = await API.settings.getAll();
  applySettingsToUI();
  await refreshLauncherSurfaces(true);
}

async function handleChangeDir() {
  let dir = await API.settings.selectInstallDir();
  if (dir) {
    // Prevent installing directly to root of a drive by enforcing a Stumble Tracer folder
    if (!dir.endsWith('Stumble Tracer') && !dir.endsWith('Stumble Tracer\\')) {
      const separator = dir.endsWith('\\') || dir.endsWith('/') ? '' : '\\';
      dir = dir + separator + 'Stumble Tracer';
    }
    await API.settings.set('installDirectory', dir);
    state.settings.installDirectory = dir;
    document.getElementById('settings-install-path').textContent = dir;
    await refreshLauncherSurfaces();
    showToast('success', 'Directory Changed', `Install path set to: ${dir}`);
  }
}

async function handleClearCache() {
  if (!confirm('Clear all cached files?')) return;

  const result = await API.settings.clearCache();
  if (result.success) {
    showToast('success', 'Cache Cleared', 'Temporary files have been removed');
  } else {
    showToast('error', 'Failed', result.error || 'Could not clear cache');
  }
}

// ═══════════════ CONNECTIVITY ═══════════════
async function checkConnectivity() {
  try {
    const online = API.network?.check ? await API.network.check() : navigator.onLine;
    const connEl = document.getElementById('nav-connection');
    connEl.className = `nav-connection ${online ? 'online' : 'offline'}`;
    setTimeout(() => {
      connEl.innerHTML = online ? '&bull; Connected' : '&bull; Offline';
    }, 0);
    connEl.textContent = online ? '● Connected' : '● Offline';
  } catch {
    // Ignore
  }
}

// ═══════════════ TOAST SYSTEM ═══════════════
function showToast(type, title, message, duration = 4000, action = null) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let actionHtml = '';
  if (action && action.label && action.callback) {
    actionHtml = `<button class="toast-action" id="toast-action-btn">${action.label}</button>`;
  }

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
      ${actionHtml}
    </div>
    <button class="toast-close" onclick="this.parentElement.classList.add('removing'); setTimeout(() => this.parentElement.remove(), 300)">×</button>
  `;

  if (action && action.callback) {
    const btn = toast.querySelector('#toast-action-btn');
    if (btn) {
      btn.onclick = () => {
        action.callback();
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
      };
    }
  }

  container.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

// ═══════════════ UTILITIES ═══════════════
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function formatPlaytime(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  if (seconds < 3600) {
    return `${Math.max(1, Math.round(seconds / 60) || 0)}m`;
  }

  const hours = seconds / 3600;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)}h`;
}

function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

async function checkIdentity() {
  try {
    if (!state.hwid) state.hwid = await API.analytics.getHWID();
  } catch (err) {
    console.warn('Failed to get HWID:', err);
    return;
  }

  const overlay = document.getElementById('identity-overlay');
  const saveBtn = document.getElementById('id-btn-save');
  const prevBtn = document.getElementById('id-prev-avatar');
  const nextBtn = document.getElementById('id-next-avatar');
  const nameInput = document.getElementById('id-setup-name');

  const avatarMatch = /^avatar(\d+)$/i.exec(state.settings.avatar || 'avatar1');
  state.currentAvatarIndex = avatarMatch ? Math.max(0, Math.min(AVATARS.length - 1, Number(avatarMatch[1]) - 1)) : 0;
  updateIdentityAvatarPreview();
  setImageSource('prof-avatar', getAvatarUrl(state.settings.avatar));

  if (prevBtn) {
    prevBtn.onclick = () => {
      state.currentAvatarIndex = (state.currentAvatarIndex - 1 + AVATARS.length) % AVATARS.length;
      updateIdentityAvatarPreview();
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      state.currentAvatarIndex = (state.currentAvatarIndex + 1) % AVATARS.length;
      updateIdentityAvatarPreview();
    };
  }

  if (saveBtn) saveBtn.onclick = saveIdentity;

  if (state.settings.username) {
    updateProfileSummary({
      username: state.settings.username,
      avatar: state.settings.avatar,
      totalPlayTime: 0
    });
  }

  if (!state.gameInstalled) {
    if (overlay) overlay.classList.add('hidden');
    return;
  }

  try {
    const profileData = await fetchRemoteJson(`/api/players/profile/${encodeURIComponent(state.hwid)}`);
    if (profileData?.player) {
      updateProfileSummary(profileData.player, profileData.sessions || []);
      renderSessionHistory(profileData.sessions || []);
      if (overlay) overlay.classList.add('hidden');

      if (profileData.player.username && profileData.player.username !== state.settings.username) {
        state.settings.username = profileData.player.username;
        await API.settings.set('username', profileData.player.username);
      }

      if (profileData.player.avatar && profileData.player.avatar !== state.settings.avatar) {
        state.settings.avatar = profileData.player.avatar;
        await API.settings.set('avatar', profileData.player.avatar);
      }
      return;
    }
  } catch (err) {
    console.warn('Remote profile lookup failed:', err);
  }

  renderSessionHistory([]);
  updateProfileSummary({
    username: state.settings.username || 'Anonymous',
    avatar: state.settings.avatar || 'avatar1',
    totalPlayTime: 0
  });

  if (overlay) {
    overlay.classList.toggle('hidden', !!state.settings.username);
  }

  if (nameInput) {
    nameInput.value = state.settings.username || '';
  }
}

async function saveIdentity() {
  const nameInput = document.getElementById('id-setup-name');
  const overlay = document.getElementById('identity-overlay');
  const username = nameInput?.value?.trim();

  if (!username) {
    showToast('warning', 'Username Required', 'Please choose a username first.');
    return;
  }

  const avatarId = getAvatarIdFromIndex(state.currentAvatarIndex);

  try {
    await API.settings.set('username', username);
    await API.settings.set('avatar', avatarId);
    state.settings.username = username;
    state.settings.avatar = avatarId;

    updateProfileSummary({
      username,
      avatar: avatarId,
      totalPlayTime: 0
    });
    renderSessionHistory([]);

    if (overlay) overlay.classList.add('hidden');

    if (state.hwid) {
      try {
        await fetchRemoteJson('/api/players/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hwid: state.hwid,
            username,
            avatar: avatarId
          })
        });
      } catch (err) {
        console.warn('Remote identity sync failed:', err);
      }

      if (state.socket) {
        state.socket.emit('player:identify', { hwid: state.hwid });
      }
    }

    if (!state.settings.tutorialSeen && state.gameInstalled) {
      setTimeout(showTutorial, 250);
    }

    showToast('success', 'Profile Saved', 'Your player identity is now ready.');
  } catch (err) {
    showToast('error', 'Save Failed', err.message || 'Could not save your identity.');
  }
}

async function loadMyProfile() {
  if (!state.hwid) {
    try {
      state.hwid = await API.analytics.getHWID();
    } catch (err) {
      console.warn('Failed to get HWID for profile:', err);
    }
  }

  if (!state.hwid) {
    renderSessionHistory([]);
    updateProfileSummary({
      username: state.settings.username || 'Anonymous',
      avatar: state.settings.avatar || 'avatar1',
      totalPlayTime: 0
    });
    return;
  }

  try {
    const data = await fetchRemoteJson(`/api/players/profile/${encodeURIComponent(state.hwid)}`);
    updateProfileSummary(data.player || {}, data.sessions || []);
    renderSessionHistory(data.sessions || []);
  } catch (err) {
    console.warn('Profile load failed:', err);
    renderSessionHistory([]);
    updateProfileSummary({
      username: state.settings.username || 'Anonymous',
      avatar: state.settings.avatar || 'avatar1',
      totalPlayTime: 0
    });
  }
}

async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-container');
  if (!container) return;

  try {
    const list = await fetchRemoteJson('/api/players/leaderboard');
    const safeList = Array.isArray(list) ? list : [];

    if (!safeList.length) {
      container.innerHTML = '<p class="text-muted">No leaderboard data yet.</p>';
      return;
    }

    const podiumPlayers = safeList.slice(0, 3);
    const podiumOrder = podiumPlayers.length === 3 ? [1, 0, 2] : podiumPlayers.map((_, index) => index);
    const podiumMarkup = podiumOrder.map((podiumIndex) => {
      const player = podiumPlayers[podiumIndex];
      const rank = podiumIndex + 1;
      const isMe = player?.hwid && state.hwid ? player.hwid === state.hwid : player?.username === state.settings.username;

      return `
        <article class="podium-card rank-${rank} ${isMe ? 'is-me' : ''}">
          <span class="podium-rank">#${rank}</span>
          <div class="podium-avatar-shell">
            <img class="podium-avatar" src="${getAvatarUrl(player?.avatar)}" alt="${player?.username || 'Anonymous'}">
            <span class="status-dot ${player?.isOnline ? 'online' : 'offline'}"></span>
          </div>
          <strong class="podium-name">${player?.username || 'Anonymous'}</strong>
          <span class="podium-time">${formatPlaytime(player?.totalPlayTime || 0)}</span>
          <span class="podium-status">${player?.isOnline ? 'Online now' : 'Offline'}</span>
        </article>
      `;
    }).join('');

    const remainder = safeList.slice(3).map((player, index) => {
      const rank = index + 4;
      const isMe = player?.hwid && state.hwid ? player.hwid === state.hwid : player?.username === state.settings.username;

      return `
        <article class="leaderboard-item ${isMe ? 'is-me' : ''}">
          <div class="lb-rank">#${rank}</div>
          <div class="lb-avatar-wrapper">
            <img class="lb-avatar" src="${getAvatarUrl(player?.avatar)}" alt="${player?.username || 'Anonymous'}">
            <span class="status-dot ${player?.isOnline ? 'online' : 'offline'}"></span>
          </div>
          <div class="lb-info">
            <div class="lb-name">${player?.username || 'Anonymous'}</div>
            <div class="lb-time">Total playtime ${formatPlaytime(player?.totalPlayTime || 0)}</div>
          </div>
          <div class="lb-action">${player?.isOnline ? 'Online' : 'Offline'}</div>
        </article>
      `;
    }).join('');

    container.innerHTML = `
      <div class="leaderboard-podium">
        ${podiumMarkup}
      </div>
      ${remainder ? `<div class="leaderboard-list">${remainder}</div>` : ''}
    `;
  } catch (err) {
    console.warn('Leaderboard load failed:', err);
    container.innerHTML = '<p class="text-muted">Leaderboard is unavailable right now.</p>';
  }
}
// ═══════════════ HERO SLIDER ═══════════════
async function loadHomeScreenshots() {
  try {
    const res = await fetch(buildRemoteUrl('/api/media?category=screenshot'));
    const screenshots = await res.json();
    const safeScreenshots = Array.isArray(screenshots) ? screenshots : [];
    const signature = safeScreenshots.map((item) => `${item._id || item.url || ''}:${item.createdAt || ''}`).join('|');

    if (state.screenshotSignature !== null && signature === state.screenshotSignature) {
      state.screenshotLastLoadedAt = Date.now();
      updateRefreshLabels();
      return;
    }

    state.screenshotSignature = signature;
    state.screenshotLastLoadedAt = Date.now();
    updateRefreshLabels();

    if (safeScreenshots.length > 0) {
      initHeroSlider(safeScreenshots);
    } else {
      const slider = document.getElementById('hero-slider');
      if (slider) {
        slider.innerHTML = '';
        if (state.sliderInterval) {
          clearInterval(state.sliderInterval);
          state.sliderInterval = null;
        }
        slider.innerHTML = `<div class="slider-img active" style="background-image: url('${resolveMediaUrl('assets/images/banner.jpg')}');"></div>`;
      }
      state.heroSlides = [];
      state.homeScreenshots = [];
      state.heroCurrentSlide = 0;
      updateScreenshotSummary(0);
      updateHeroSpotlight(null);
      renderHomeScreenshotGrid([]);
      closeScreenshotLightbox();
    }
  } catch (err) {
    console.error('Failed to load screenshots:', err);
  }
}

function refreshHomeScreenshotsIfNeeded(force = false) {
  if (state.currentPage !== 'home') return;
  if (!force && Date.now() - state.screenshotLastLoadedAt < HOME_SCREENSHOT_STALE_MS) return;
  loadHomeScreenshots();
}

function startHomeScreenshotAutoRefresh() {
  if (state.screenshotRefreshInterval) {
    clearInterval(state.screenshotRefreshInterval);
  }

  window.addEventListener('focus', () => refreshHomeScreenshotsIfNeeded());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshHomeScreenshotsIfNeeded();
  });

  state.screenshotRefreshInterval = setInterval(() => {
    if (document.hidden || state.currentPage !== 'home') return;
    loadHomeScreenshots();
  }, HOME_SCREENSHOT_REFRESH_MS);
}

function updateScreenshotSummary(count) {
  const summaryText = `${count} ${count === 1 ? 'visual' : 'visuals'}`;
  const heroCount = document.getElementById('hero-screenshot-count');
  const badge = document.getElementById('home-screenshot-count-badge');
  if (heroCount) heroCount.textContent = summaryText;
  if (badge) badge.textContent = summaryText;
}

function updateHeroSpotlight(item, index = 0, total = 0) {
  const titleEl = document.getElementById('hero-active-screenshot-title');
  const metaEl = document.getElementById('hero-active-screenshot-meta');
  const openBtn = document.getElementById('hero-open-lightbox');
  if (!titleEl || !metaEl) return;

  if (!item) {
    titleEl.textContent = 'Official visuals';
    metaEl.textContent = 'Upload screenshots from the panel and they will appear here.';
    if (openBtn) openBtn.disabled = true;
    return;
  }

  titleEl.textContent = item.title || `Screenshot ${index + 1}`;
  metaEl.textContent = `${index + 1} of ${total} in focus - ${formatRelativeTime(item.createdAt || Date.now())}`;
  if (openBtn) openBtn.disabled = false;
}

function renderHomeScreenshotGrid(screenshots = []) {
  const container = document.getElementById('home-screenshot-grid');
  if (!container) return;

  if (!Array.isArray(screenshots) || screenshots.length === 0) {
    container.innerHTML = `
      <button class="screenshot-card placeholder-card" type="button">
        <span class="placeholder-card-label">No official screenshots uploaded yet.</span>
      </button>
    `;
    return;
  }

  container.innerHTML = screenshots.map((item, index) => `
    <button class="screenshot-card ${index === 0 ? 'is-active' : ''}" type="button" data-index="${index}">
      <div class="screenshot-card-image" style="background-image: url('${resolveMediaUrl(item.url)}')"></div>
      <div class="screenshot-card-body">
        <div>
          <div class="screenshot-card-title">${item.title || `Screenshot ${index + 1}`}</div>
        </div>
        <span class="screenshot-card-meta">${formatDate(item.createdAt || Date.now())}</span>
      </div>
    </button>
  `).join('');

  container.querySelectorAll('.screenshot-card[data-index]').forEach((card) => {
    card.addEventListener('click', () => {
      const index = Number(card.dataset.index);
      setHeroSlide(index);
    });
    card.addEventListener('dblclick', () => {
      const index = Number(card.dataset.index);
      openScreenshotLightbox(index);
    });
  });
}

function setHeroSlide(index) {
  if (!Array.isArray(state.heroSlides) || state.heroSlides.length === 0) return;
  const nextIndex = ((Number(index) || 0) + state.heroSlides.length) % state.heroSlides.length;
  state.heroCurrentSlide = nextIndex;

  state.heroSlides.forEach((slide, slideIndex) => {
    slide.classList.toggle('active', slideIndex === nextIndex);
  });

  document.querySelectorAll('#home-screenshot-grid .screenshot-card[data-index]').forEach((card) => {
    card.classList.toggle('is-active', Number(card.dataset.index) === nextIndex);
  });

  updateScreenshotSummary(state.homeScreenshots.length);
  updateHeroSpotlight(state.homeScreenshots[nextIndex], nextIndex, state.homeScreenshots.length);
  if (!document.getElementById('screenshot-lightbox')?.classList.contains('hidden')) {
    updateScreenshotLightbox(nextIndex);
  }
}

function initHeroSlider(screenshots) {
  const container = document.getElementById('hero-slider');
  if (!container) return;

  container.innerHTML = '';
  if (state.sliderInterval) clearInterval(state.sliderInterval);
  state.homeScreenshots = screenshots;

  // Preload all images in background for smooth transitions
  screenshots.forEach((s) => {
    const img = new Image();
    img.src = resolveMediaUrl(s.url);
  });

  state.heroSlides = screenshots.map((s, idx) => {
    const div = document.createElement('div');
    div.className = `slider-img ${idx === 0 ? 'active' : ''}`;
    div.style.backgroundImage = `url('${resolveMediaUrl(s.url)}')`;
    container.appendChild(div);
    return div;
  });

  renderHomeScreenshotGrid(screenshots);
  setHeroSlide(0);

  if (state.heroSlides.length <= 1) return;

  state.sliderInterval = setInterval(() => {
    setHeroSlide(state.heroCurrentSlide + 1);
  }, 6000);
}

// ═══════════════ CARD STAGGER ANIMATION ═══════════════
function staggerCards(container) {
  if (!container) return;
  const cards = container.querySelectorAll('.news-card');
  cards.forEach((card, i) => {
    card.classList.add('animate-in');
    card.style.animationDelay = `${i * 60}ms`;
  });
}

// ═══════════════ PARALLAX HERO BANNER ═══════════════
function initParallax() {
  const heroBanner = document.querySelector('.hero-banner');
  const heroSlider = document.getElementById('hero-slider');
  if (!heroBanner || !heroSlider) return;

  heroBanner.addEventListener('mousemove', (e) => {
    const rect = heroBanner.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    heroSlider.style.transform = `scale(1.05) translate(${x * -12}px, ${y * -8}px)`;
  });

  heroBanner.addEventListener('mouseleave', () => {
    heroSlider.style.transform = 'scale(1) translate(0, 0)';
  });
}

// ═══════════════ ANIMATED COUNTER ═══════════════
function animateCounter(element, targetValue, duration = 800) {
  if (!element) return;

  const startValue = parseInt(element.textContent) || 0;
  if (startValue === targetValue) return;

  const startTime = performance.now();
  element.classList.add('animate-counter');

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(startValue + (targetValue - startValue) * eased);

    element.textContent = currentValue;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = targetValue;
      element.classList.add('bump');
      setTimeout(() => element.classList.remove('bump'), 200);
    }
  }

  requestAnimationFrame(update);
}


// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => console.error('Bootstrap failed:', err));
  setTimeout(initParallax, 500);
});

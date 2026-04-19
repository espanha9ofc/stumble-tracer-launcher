/* ═══════════════════════════════════════════════════
   Stumble Tracer — DYNAMIC ISLAND OVERLAY JS
   iPhone 14 Pro-inspired floating island controller
   ═══════════════════════════════════════════════════ */

// ──── Elements ────
const timerEl = document.getElementById('timer');
const cpuEl = document.getElementById('stat-cpu');
const ramEl = document.getElementById('stat-ram');
const fpsEl = document.getElementById('stat-fps');
const onlineEl = document.getElementById('stat-online');
const tickerArea = document.getElementById('pill-ticker');
const tickerText = document.getElementById('ticker-text');
const btnOpenLauncher = document.getElementById('btn-open-launcher');
const island = document.getElementById('dynamic-island');

// ──── State ────
let lastTime = performance.now();
let frames = 0;
let currentFps = 0;

// ──── FPS Counter (High Precision) ────
function updateFps() {
  frames++;
  const now = performance.now();
  if (now >= lastTime + 1000) {
    currentFps = Math.round((frames * 1000) / (now - lastTime));
    if (fpsEl) fpsEl.textContent = currentFps;
    frames = 0;
    lastTime = now;
  }
  requestAnimationFrame(updateFps);
}
requestAnimationFrame(updateFps);

// ──── Formatting Utilities ────
function formatSeconds(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ──── Ticker / Alert Logic ────
let tickerTimeout = null;

function showAlert(message) {
  if (!tickerArea || !tickerText || !island) return;

  // Set content
  tickerText.textContent = message;

  // Expand with spring animation
  island.classList.add('has-alert');
  tickerArea.classList.remove('collapsed');
  tickerArea.classList.add('expanded');

  // Auto-collapse after 15 seconds
  if (tickerTimeout) clearTimeout(tickerTimeout);
  tickerTimeout = setTimeout(() => {
    tickerArea.classList.remove('expanded');
    tickerArea.classList.add('collapsed');
    island.classList.remove('has-alert');
  }, 15000);
}

// ──── IPC Listeners ────
if (window.launcherAPI && window.launcherAPI.on) {
  window.launcherAPI.on('overlay:data', (data) => {
    if (timerEl) timerEl.textContent = formatSeconds(data.sessionSeconds);

    // Performance Metrics
    if (data.metrics) {
      if (cpuEl) cpuEl.textContent = `${data.metrics.cpuPerc}%`;
      if (ramEl) ramEl.textContent = `${(data.metrics.ramMb / 1024).toFixed(1)}GB`;
    }
  });

  // Listen for admin broadcasts
  window.launcherAPI.on('overlay:alert', (data) => {
    if (data && data.message) {
      showAlert(data.message);
    }
  });

  // Listen for global player count
  window.launcherAPI.on('overlay:online', (data) => {
    if (onlineEl) onlineEl.textContent = data.count || '--';
  });
}

// ── Quick Actions ──
if (btnOpenLauncher) {
  btnOpenLauncher.onclick = () => {
    window.launcherAPI.send('overlay:open-launcher');
  };
}

// TEST: Trigger fake alert on load for visual check
setTimeout(() => showAlert("Welcome to Stumble Tracer!"), 2000);
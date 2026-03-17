// Default settings
const DEFAULTS = {
  // YouTube toggles
  blockYoutube: false,
  hideRecommendations: false,
  forceSubscriptions: false,
  hideBreakingNews: false,
  hideSidebar: false,
  hideComments: false,
  thumbnailMode: 'show', // show | blur | hide
  hideUpNext: false,
  hideShorts: false,
  hideTrending: false,
  hideEndCards: false,
  hideNotifications: false,
  hideChat: false,
  hideCounts: false,
  removeColors: false,
  // Settings
  pauseEnabled: false,
  pauseDuration: 5,
  scheduleEnabled: false,
  scheduleFrom: '09:00',
  scheduleUntil: '17:00',
  pauseDays: [],
  watchTimeReminder: false,
  watchTimeMinutes: 30,
  dailyLimitEnabled: false,
  dailyLimitMinutes: 60,
  redirectEnabled: false,
  redirectUrl: '',
  lockPassword: '',
  isLocked: false
};

let settings = { ...DEFAULTS };

// Load settings from storage
async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  settings = { ...DEFAULTS, ...stored };
  applySettingsToUI();
}

// Save a specific setting
function saveSetting(key, value) {
  settings[key] = value;
  chrome.storage.sync.set({ [key]: value });
  // Notify content scripts
  chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'settingsUpdated', settings }).catch(() => {});
    });
  });
  // Notify background
  chrome.runtime.sendMessage({ type: 'settingsUpdated', settings }).catch(() => {});
}

// Apply settings to UI controls
function applySettingsToUI() {
  // YouTube toggles
  const toggleMap = {
    blockYoutube: 'blockYoutube',
    hideRecommendations: 'hideRecommendations',
    forceSubscriptions: 'forceSubscriptions',
    hideBreakingNews: 'hideBreakingNews',
    hideSidebar: 'hideSidebar',
    hideComments: 'hideComments',
    hideUpNext: 'hideUpNext',
    hideShorts: 'hideShorts',
    hideTrending: 'hideTrending',
    hideEndCards: 'hideEndCards',
    hideNotifications: 'hideNotifications',
    hideChat: 'hideChat',
    hideCounts: 'hideCounts',
    removeColors: 'removeColors'
  };

  for (const [settingKey, elementId] of Object.entries(toggleMap)) {
    const el = document.getElementById(elementId);
    if (el) el.checked = !!settings[settingKey];
  }

  // Thumbnail buttons
  document.querySelectorAll('.btn-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === settings.thumbnailMode);
  });

  // Settings page
  document.getElementById('pauseEnabled').checked = settings.pauseEnabled;
  document.getElementById('pauseDuration').value = settings.pauseDuration;
  document.getElementById('scheduleEnabled').checked = settings.scheduleEnabled;
  document.getElementById('scheduleFrom').value = settings.scheduleFrom;
  document.getElementById('scheduleUntil').value = settings.scheduleUntil;
  document.getElementById('redirectEnabled').checked = settings.redirectEnabled;
  document.getElementById('redirectUrl').value = settings.redirectUrl || '';
  document.getElementById('watchTimeReminder').checked = settings.watchTimeReminder;
  document.getElementById('watchTimeMinutes').value = settings.watchTimeMinutes;
  document.getElementById('dailyLimitEnabled').checked = settings.dailyLimitEnabled;
  document.getElementById('dailyLimitMinutes').value = settings.dailyLimitMinutes;

  // Days
  const days = settings.pauseDays || [];
  for (let i = 0; i < 7; i++) {
    const el = document.querySelector(`.day-check input[value="${i}"]`);
    if (el) el.checked = days.includes(i);
  }

  // Lock state
  if (settings.isLocked) {
    showLockScreen();
  }
}

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
  });
});

// YouTube toggle handlers
const toggleIds = [
  'blockYoutube', 'hideRecommendations', 'forceSubscriptions',
  'hideBreakingNews', 'hideSidebar', 'hideComments',
  'hideUpNext', 'hideShorts', 'hideTrending',
  'hideEndCards', 'hideNotifications', 'hideChat', 'hideCounts',
  'removeColors'
];

toggleIds.forEach(id => {
  document.getElementById(id).addEventListener('change', (e) => {
    saveSetting(id, e.target.checked);
  });
});

// Thumbnail mode buttons
document.querySelectorAll('.btn-option').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    saveSetting('thumbnailMode', btn.dataset.value);
  });
});

// Settings page handlers
document.getElementById('pauseEnabled').addEventListener('change', (e) => {
  saveSetting('pauseEnabled', e.target.checked);
  if (e.target.checked) {
    const mins = parseInt(document.getElementById('pauseDuration').value);
    chrome.runtime.sendMessage({ type: 'startPause', minutes: mins });
  } else {
    chrome.runtime.sendMessage({ type: 'stopPause' });
  }
});

document.getElementById('pauseDuration').addEventListener('change', (e) => {
  saveSetting('pauseDuration', parseInt(e.target.value));
});

document.getElementById('scheduleEnabled').addEventListener('change', (e) => {
  saveSetting('scheduleEnabled', e.target.checked);
});

document.getElementById('scheduleFrom').addEventListener('change', (e) => {
  saveSetting('scheduleFrom', e.target.value);
});

document.getElementById('scheduleUntil').addEventListener('change', (e) => {
  saveSetting('scheduleUntil', e.target.value);
});

// Days
document.querySelectorAll('.day-check input').forEach(cb => {
  cb.addEventListener('change', () => {
    const days = [];
    document.querySelectorAll('.day-check input:checked').forEach(el => {
      days.push(parseInt(el.value));
    });
    saveSetting('pauseDays', days);
  });
});

// Watch time reminder
document.getElementById('watchTimeReminder').addEventListener('change', (e) => {
  saveSetting('watchTimeReminder', e.target.checked);
});

document.getElementById('watchTimeMinutes').addEventListener('change', (e) => {
  saveSetting('watchTimeMinutes', parseInt(e.target.value));
});

// Daily limit
document.getElementById('dailyLimitEnabled').addEventListener('change', (e) => {
  saveSetting('dailyLimitEnabled', e.target.checked);
});

document.getElementById('dailyLimitMinutes').addEventListener('change', (e) => {
  saveSetting('dailyLimitMinutes', parseInt(e.target.value));
});

document.getElementById('redirectEnabled').addEventListener('change', (e) => {
  saveSetting('redirectEnabled', e.target.checked);
});

document.getElementById('redirectUrl').addEventListener('change', (e) => {
  saveSetting('redirectUrl', e.target.value);
});

// Lock settings
document.getElementById('lockBtn').addEventListener('click', () => {
  const pwd = document.getElementById('lockPassword').value.trim();
  if (!pwd) return;
  saveSetting('lockPassword', pwd);
  saveSetting('isLocked', true);
  showLockScreen();
});

function showLockScreen() {
  const overlay = document.createElement('div');
  overlay.className = 'locked-overlay';
  overlay.innerHTML = `
    <div class="lock-icon">🔒</div>
    <p>Settings are locked</p>
    <input type="password" id="unlockInput" placeholder="Enter password">
    <button id="unlockBtn">Unlock</button>
  `;
  document.body.appendChild(overlay);

  document.getElementById('unlockBtn').addEventListener('click', () => {
    const input = document.getElementById('unlockInput').value;
    if (input === settings.lockPassword) {
      saveSetting('isLocked', false);
      overlay.remove();
    } else {
      document.getElementById('unlockInput').value = '';
      document.getElementById('unlockInput').placeholder = 'Wrong password';
    }
  });

  // Allow Enter key to submit
  document.getElementById('unlockInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('unlockBtn').click();
    }
  });
}

// Init
loadSettings();

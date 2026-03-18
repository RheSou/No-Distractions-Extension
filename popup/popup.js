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
  // Blocked sites
  blockedSites: [],
  frictionPassword: '',
  childLockEnabled: false,
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

  // Show version from manifest
  const manifest = chrome.runtime.getManifest();
  document.getElementById('aboutVersion').textContent =
    `No Distractions - Productivity Helper v${manifest.version}`;
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
  const watchSelect = document.getElementById('watchTimeMinutes');
  const watchPresets = ['15', '30', '45', '60', '120', '180', '240'];
  if (watchPresets.includes(String(settings.watchTimeMinutes))) {
    watchSelect.value = settings.watchTimeMinutes;
    document.getElementById('watchTimeCustom').style.display = 'none';
  } else {
    watchSelect.value = 'custom';
    document.getElementById('watchTimeCustom').style.display = 'flex';
    document.getElementById('watchTimeHours').value = Math.floor(settings.watchTimeMinutes / 60);
    document.getElementById('watchTimeCustomMinutes').value = settings.watchTimeMinutes % 60;
  }

  document.getElementById('dailyLimitEnabled').checked = settings.dailyLimitEnabled;
  const dailySelect = document.getElementById('dailyLimitMinutes');
  const dailyPresets = ['15', '30', '60', '120', '180', '240', '360', '480'];
  if (dailyPresets.includes(String(settings.dailyLimitMinutes))) {
    dailySelect.value = settings.dailyLimitMinutes;
    document.getElementById('dailyLimitCustom').style.display = 'none';
  } else {
    dailySelect.value = 'custom';
    document.getElementById('dailyLimitCustom').style.display = 'flex';
    document.getElementById('dailyLimitHours').value = Math.floor(settings.dailyLimitMinutes / 60);
    document.getElementById('dailyLimitCustomMinutes').value = settings.dailyLimitMinutes % 60;
  }

  // Days
  const days = settings.pauseDays || [];
  for (let i = 0; i < 7; i++) {
    const el = document.querySelector(`.day-check input[value="${i}"]`);
    if (el) el.checked = days.includes(i);
  }

  // Blocked sites
  document.getElementById('frictionPassword').value = settings.frictionPassword || '';
  document.getElementById('childLockEnabled').checked = !!settings.childLockEnabled;
  renderBlockedSites();
  renderQuickAddGrid();

  // Child lock - must come before regular lock check
  if (settings.childLockEnabled && settings.frictionPassword) {
    showChildLockScreen();
    return; // Don't show settings lock on top of child lock
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
  if (e.target.value === 'custom') {
    document.getElementById('watchTimeCustom').style.display = 'flex';
  } else {
    document.getElementById('watchTimeCustom').style.display = 'none';
    saveSetting('watchTimeMinutes', parseInt(e.target.value));
  }
});

function saveCustomWatchTime() {
  const h = parseInt(document.getElementById('watchTimeHours').value) || 0;
  const m = parseInt(document.getElementById('watchTimeCustomMinutes').value) || 0;
  const total = h * 60 + m;
  if (total > 0) {
    saveSetting('watchTimeMinutes', total);
  }
}

document.getElementById('watchTimeHours').addEventListener('input', saveCustomWatchTime);
document.getElementById('watchTimeCustomMinutes').addEventListener('input', saveCustomWatchTime);

// Daily limit
document.getElementById('dailyLimitEnabled').addEventListener('change', (e) => {
  saveSetting('dailyLimitEnabled', e.target.checked);
});

document.getElementById('dailyLimitMinutes').addEventListener('change', (e) => {
  if (e.target.value === 'custom') {
    document.getElementById('dailyLimitCustom').style.display = 'flex';
  } else {
    document.getElementById('dailyLimitCustom').style.display = 'none';
    saveSetting('dailyLimitMinutes', parseInt(e.target.value));
  }
});

function saveCustomDailyLimit() {
  const h = parseInt(document.getElementById('dailyLimitHours').value) || 0;
  const m = parseInt(document.getElementById('dailyLimitCustomMinutes').value) || 0;
  const total = h * 60 + m;
  if (total > 0) {
    saveSetting('dailyLimitMinutes', total);
  }
}

document.getElementById('dailyLimitHours').addEventListener('input', saveCustomDailyLimit);
document.getElementById('dailyLimitCustomMinutes').addEventListener('input', saveCustomDailyLimit);

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

// ============================================================
// COMMON SITES FOR QUICK-ADD
// ============================================================

const COMMON_SITES = [
  { domain: 'facebook.com', name: 'Facebook' },
  { domain: 'instagram.com', name: 'Instagram' },
  { domain: 'twitter.com', name: 'Twitter / X' },
  { domain: 'x.com', name: 'X.com' },
  { domain: 'tiktok.com', name: 'TikTok' },
  { domain: 'reddit.com', name: 'Reddit' },
  { domain: 'snapchat.com', name: 'Snapchat' },
  { domain: 'pinterest.com', name: 'Pinterest' },
  { domain: 'tumblr.com', name: 'Tumblr' },
  { domain: 'discord.com', name: 'Discord' },
  { domain: 'twitch.tv', name: 'Twitch' },
  { domain: 'netflix.com', name: 'Netflix' },
  { domain: 'hulu.com', name: 'Hulu' },
  { domain: 'disneyplus.com', name: 'Disney+' },
  { domain: 'amazon.com', name: 'Amazon' },
  { domain: 'ebay.com', name: 'eBay' },
  { domain: 'linkedin.com', name: 'LinkedIn' },
  { domain: 'threads.net', name: 'Threads' },
];

function renderQuickAddGrid() {
  const grid = document.getElementById('quickAddGrid');
  const sites = settings.blockedSites || [];

  grid.innerHTML = COMMON_SITES.map(site => {
    const isActive = sites.includes(site.domain);
    return `
      <label class="quick-add-item ${isActive ? 'active' : ''}" data-domain="${site.domain}">
        <input type="checkbox" ${isActive ? 'checked' : ''}>
        <div class="quick-add-check"></div>
        <span class="quick-add-name">${site.name}</span>
      </label>
    `;
  }).join('');

  grid.querySelectorAll('.quick-add-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const domain = item.dataset.domain;
      const cb = item.querySelector('input');
      const sites = settings.blockedSites || [];

      if (sites.includes(domain)) {
        // Remove
        const updated = sites.filter(s => s !== domain);
        saveSetting('blockedSites', updated);
      } else {
        // Add
        sites.push(domain);
        saveSetting('blockedSites', sites);
      }
      renderQuickAddGrid();
      renderBlockedSites();
    });
  });
}

// ============================================================
// CHILD LOCK
// ============================================================

document.getElementById('childLockEnabled').addEventListener('change', (e) => {
  if (e.target.checked && !settings.frictionPassword) {
    e.target.checked = false;
    // Flash the password field to hint that they need to set one first
    const pwdInput = document.getElementById('frictionPassword');
    pwdInput.style.borderColor = '#ef4444';
    pwdInput.placeholder = 'Set a password first!';
    setTimeout(() => {
      pwdInput.style.borderColor = '';
      pwdInput.placeholder = 'Set a password';
    }, 2000);
    return;
  }
  saveSetting('childLockEnabled', e.target.checked);
});

function showChildLockScreen() {
  // Remove any existing child lock overlay
  const existing = document.querySelector('.child-lock-overlay');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.className = 'locked-overlay child-lock-overlay';
  overlay.innerHTML = `
    <div class="lock-icon">🔒</div>
    <p><strong>Extension is locked</strong></p>
    <p style="font-size: 11px; color: #9CA3AF; margin-top: -4px;">Enter the password to change settings</p>
    <input type="password" id="childLockInput" placeholder="Enter password">
    <button id="childLockUnlockBtn">Unlock</button>
  `;
  document.body.appendChild(overlay);

  document.getElementById('childLockUnlockBtn').addEventListener('click', () => {
    const input = document.getElementById('childLockInput').value;
    if (input === settings.frictionPassword) {
      overlay.remove();
    } else {
      document.getElementById('childLockInput').value = '';
      document.getElementById('childLockInput').placeholder = 'Wrong password';
    }
  });

  document.getElementById('childLockInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('childLockUnlockBtn').click();
    }
  });
}

// ============================================================
// BLOCKED SITES MANAGEMENT
// ============================================================

function renderBlockedSites() {
  const list = document.getElementById('blockedSitesList');
  const sites = settings.blockedSites || [];

  if (sites.length === 0) {
    list.innerHTML = '<div class="empty-state">No sites blocked yet. Add one above.</div>';
    return;
  }

  list.innerHTML = sites.map(site => `
    <div class="blocked-site-item" data-site="${site}">
      <span class="site-domain">${site}</span>
      <button class="remove-site-btn" title="Remove">&times;</button>
    </div>
  `).join('');

  list.querySelectorAll('.remove-site-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const site = btn.parentElement.dataset.site;
      const updated = (settings.blockedSites || []).filter(s => s !== site);
      saveSetting('blockedSites', updated);
      renderBlockedSites();
      renderQuickAddGrid();
    });
  });
}

// Normalize domain input: strip protocol, www, trailing slashes, paths
function normalizeDomain(input) {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/^www\./, '');
  domain = domain.replace(/\/.*$/, '');
  return domain;
}

document.getElementById('addSiteBtn').addEventListener('click', () => {
  const input = document.getElementById('newSiteInput');
  const domain = normalizeDomain(input.value);
  if (!domain || !domain.includes('.')) return;

  const sites = settings.blockedSites || [];
  if (sites.includes(domain)) {
    input.value = '';
    return;
  }

  sites.push(domain);
  saveSetting('blockedSites', sites);
  input.value = '';
  renderBlockedSites();
});

document.getElementById('newSiteInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addSiteBtn').click();
  }
});

// Friction password
document.getElementById('saveFrictionPassword').addEventListener('click', () => {
  const pwd = document.getElementById('frictionPassword').value.trim();
  if (!pwd) return;
  saveSetting('frictionPassword', pwd);
  // Show saved confirmation
  const btn = document.getElementById('saveFrictionPassword');
  const original = btn.textContent;
  btn.textContent = 'Saved!';
  btn.style.background = '#10b981';
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = '';
  }, 1500);
});

// Init
loadSettings();

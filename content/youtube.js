// YouTube content script - applies distraction-hiding rules

const CLASS_MAP = {
  blockYoutube: 'nd-blocked',
  hideRecommendations: 'nd-hide-recommendations',
  hideBreakingNews: 'nd-hide-breaking-news',
  hideSidebar: 'nd-hide-sidebar',
  hideComments: 'nd-hide-comments',
  hideUpNext: 'nd-hide-upnext',
  hideShorts: 'nd-hide-shorts',
  hideTrending: 'nd-hide-trending',
  removeColors: 'nd-grayscale',
  hideEndCards: 'nd-hide-endcards',
  hideNotifications: 'nd-hide-notifications',
  hideChat: 'nd-hide-chat',
  hideCounts: 'nd-hide-counts'
};

let currentSettings = {};
let watchTimeInterval = null;
let sessionStartTime = null;
let reminderDismissed = false;

function applySettings(settings) {
  currentSettings = settings;

  // Apply toggle-based classes
  for (const [key, className] of Object.entries(CLASS_MAP)) {
    document.body.classList.toggle(className, !!settings[key]);
  }

  // Thumbnail mode
  document.body.classList.remove('nd-blur-thumbnails', 'nd-hide-thumbnails');
  if (settings.thumbnailMode === 'blur') {
    document.body.classList.add('nd-blur-thumbnails');
  } else if (settings.thumbnailMode === 'hide') {
    document.body.classList.add('nd-hide-thumbnails');
  }

  // Force redirect to subscriptions
  if (settings.forceSubscriptions) {
    handleSubscriptionRedirect();
  }

  // Disable autoplay when hideUpNext is on
  if (settings.hideUpNext) {
    disableAutoplay();
  }

  // Redirect Shorts URLs to regular video
  if (settings.hideShorts) {
    redirectShortsToWatch();
  }

  // Watch time reminder
  handleWatchTimeReminder(settings);

  // Daily time limit
  handleDailyLimit(settings);
}

// ============================================================
// AUTOPLAY DISABLE
// YouTube's autoplay toggle is in the player settings.
// We need to find and disable it via the DOM.
// ============================================================
function disableAutoplay() {
  // Method 1: Click the autoplay toggle if it's enabled
  const autoplayButton = document.querySelector('.ytp-autonav-toggle-button');
  if (autoplayButton) {
    const isOn = autoplayButton.getAttribute('aria-checked') === 'true';
    if (isOn) {
      autoplayButton.click();
    }
  }

  // Method 2: Intercept the video ending to prevent autoplay
  const video = document.querySelector('video.html5-main-video');
  if (video && !video._ndAutoplayBlocked) {
    video._ndAutoplayBlocked = true;
    video.addEventListener('ended', () => {
      if (!currentSettings.hideUpNext) return;
      // Pause any autoplay attempt after a short delay
      setTimeout(() => {
        const nextVideo = document.querySelector('video.html5-main-video');
        if (nextVideo && !nextVideo.paused) {
          // Check if URL changed (autoplay happened)
          nextVideo.pause();
        }
      }, 500);
    });
  }
}

// Keep checking autoplay toggle - YouTube recreates it on navigation
function autoplayWatcher() {
  if (!currentSettings.hideUpNext) return;
  const btn = document.querySelector('.ytp-autonav-toggle-button');
  if (btn && btn.getAttribute('aria-checked') === 'true') {
    btn.click();
  }
}

// ============================================================
// SHORTS REDIRECT - if user navigates to /shorts/xxx, redirect
// to /watch?v=xxx so they watch it as a normal video
// ============================================================
function redirectShortsToWatch() {
  const path = window.location.pathname;
  const shortsMatch = path.match(/^\/shorts\/(.+)/);
  if (shortsMatch) {
    const videoId = shortsMatch[1];
    window.location.replace(`https://www.youtube.com/watch?v=${videoId}`);
  }
}

// ============================================================
// SUBSCRIPTION REDIRECT
// ============================================================
function handleSubscriptionRedirect() {
  const path = window.location.pathname;
  if (path === '/' || path === '' || path === '/feed/trending' || path === '/feed/explore') {
    window.location.replace('https://www.youtube.com/feed/subscriptions');
  }
}

// ============================================================
// WATCH TIME REMINDER
// Shows a banner after X minutes of continuous YouTube use
// ============================================================
function handleWatchTimeReminder(settings) {
  if (!settings.watchTimeReminder || !settings.watchTimeMinutes) {
    removeReminder();
    if (watchTimeInterval) {
      clearInterval(watchTimeInterval);
      watchTimeInterval = null;
    }
    return;
  }

  if (!sessionStartTime) {
    sessionStartTime = Date.now();
  }

  if (!watchTimeInterval) {
    watchTimeInterval = setInterval(() => {
      if (reminderDismissed) return;
      const elapsed = (Date.now() - sessionStartTime) / 1000 / 60;
      if (elapsed >= currentSettings.watchTimeMinutes) {
        showReminder(Math.floor(elapsed));
      }
    }, 30000); // Check every 30s
  }
}

function showReminder(mins) {
  if (document.getElementById('nd-time-reminder')) return;
  const banner = document.createElement('div');
  banner.id = 'nd-time-reminder';
  banner.innerHTML = `
    <span>You've been on YouTube for ${mins} minutes. Time for a break?</span>
    <button id="nd-reminder-dismiss">Dismiss</button>
  `;
  document.body.prepend(banner);
  document.getElementById('nd-reminder-dismiss').addEventListener('click', () => {
    banner.remove();
    reminderDismissed = true;
    // Reset - remind again after another interval
    sessionStartTime = Date.now();
    setTimeout(() => { reminderDismissed = false; }, 60000);
  });
}

function removeReminder() {
  const el = document.getElementById('nd-time-reminder');
  if (el) el.remove();
}

// ============================================================
// DAILY TIME LIMIT
// Track total YouTube time per day, block when limit reached
// ============================================================
function handleDailyLimit(settings) {
  if (!settings.dailyLimitEnabled || !settings.dailyLimitMinutes) return;

  const today = new Date().toDateString();

  chrome.storage.local.get(['dailyWatchTime', 'dailyWatchDate'], (data) => {
    let watchTime = 0;
    if (data.dailyWatchDate === today) {
      watchTime = data.dailyWatchTime || 0;
    } else {
      // New day - reset
      chrome.storage.local.set({ dailyWatchTime: 0, dailyWatchDate: today });
    }

    if (watchTime >= settings.dailyLimitMinutes) {
      showDailyLimitOverlay(settings.dailyLimitMinutes);
      return;
    }

    // Increment watch time every minute
    if (!window._ndDailyInterval) {
      window._ndDailyInterval = setInterval(() => {
        chrome.storage.local.get(['dailyWatchTime', 'dailyWatchDate'], (d) => {
          const now = new Date().toDateString();
          let time = 0;
          if (d.dailyWatchDate === now) {
            time = (d.dailyWatchTime || 0) + 1;
          }
          chrome.storage.local.set({ dailyWatchTime: time, dailyWatchDate: now });

          if (currentSettings.dailyLimitEnabled && time >= currentSettings.dailyLimitMinutes) {
            showDailyLimitOverlay(currentSettings.dailyLimitMinutes);
            clearInterval(window._ndDailyInterval);
            window._ndDailyInterval = null;
          }
        });
      }, 60000); // every minute
    }
  });
}

function showDailyLimitOverlay(limitMins) {
  if (document.getElementById('nd-daily-limit-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'nd-daily-limit-overlay';
  overlay.innerHTML = `
    <h1>Daily Limit Reached</h1>
    <p>You've used your ${limitMins}-minute daily YouTube allowance.</p>
    <p style="margin-top: 8px; font-size: 14px; color: #9CA3AF;">Come back tomorrow, or adjust in the extension settings.</p>
  `;
  document.body.appendChild(overlay);
}

// ============================================================
// PAUSE CHECK
// ============================================================
function isPaused(settings) {
  if (settings.pauseEnabled) return true;

  if (settings.scheduleEnabled) {
    const now = new Date();
    const day = now.getDay();
    const pauseDays = settings.pauseDays || [];

    if (pauseDays.length === 0 || pauseDays.includes(day)) {
      const timeNow = now.getHours() * 60 + now.getMinutes();
      const [fromH, fromM] = (settings.scheduleFrom || '09:00').split(':').map(Number);
      const [untilH, untilM] = (settings.scheduleUntil || '17:00').split(':').map(Number);
      const fromMins = fromH * 60 + fromM;
      const untilMins = untilH * 60 + untilM;

      if (timeNow >= fromMins && timeNow < untilMins) {
        return true;
      }
    }
  }

  return false;
}

function clearAllEffects() {
  document.body.className = document.body.className
    .split(' ')
    .filter(c => !c.startsWith('nd-'))
    .join(' ');
  removeReminder();
  const limitOverlay = document.getElementById('nd-daily-limit-overlay');
  if (limitOverlay) limitOverlay.remove();
}

// ============================================================
// INIT & LISTENERS
// ============================================================
async function init() {
  const settings = await chrome.storage.sync.get(null);

  if (isPaused(settings)) {
    clearAllEffects();
    return;
  }

  applySettings(settings);

  // Run autoplay watcher a few times after page load to catch YouTube rebuilding the toggle
  setTimeout(autoplayWatcher, 1000);
  setTimeout(autoplayWatcher, 3000);
  setTimeout(autoplayWatcher, 5000);
}

// Listen for settings updates from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'settingsUpdated') {
    if (isPaused(msg.settings)) {
      clearAllEffects();
      return;
    }
    applySettings(msg.settings);
  }
});

// Run when DOM is ready
if (document.body) {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}

// YouTube uses SPA navigation - re-apply on URL changes
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    reminderDismissed = false;
    init();
  }

  // Continuously enforce autoplay off
  if (currentSettings.hideUpNext) {
    autoplayWatcher();
  }
});

const startObserver = () => {
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
};

if (document.body) {
  startObserver();
} else {
  document.addEventListener('DOMContentLoaded', startObserver);
}

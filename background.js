// Background service worker - handles blocking, redirecting, pause timers, and site gating

// Listen for pause timer
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'startPause') {
    chrome.alarms.create('pauseEnd', { delayInMinutes: msg.minutes });
    chrome.storage.sync.set({ pauseEnabled: true });
  } else if (msg.type === 'stopPause') {
    chrome.alarms.clear('pauseEnd');
    chrome.storage.sync.set({ pauseEnabled: false });
    notifyTabs();
  } else if (msg.type === 'siteUnlocked') {
    // Track unlocked sites per tab so we don't re-gate after SPA navigation
    if (sender.tab) {
      unlockedTabs.add(sender.tab.id);
      gatedTabs.delete(sender.tab.id);
    }
  }
});

// Track tabs that have been unlocked (user typed the password)
const unlockedTabs = new Set();

// Track tabs that already have a gate injected (prevents multiple injections per load)
const gatedTabs = new Set();

// Clean up when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  unlockedTabs.delete(tabId);
  gatedTabs.delete(tabId);
});

// When pause alarm fires, disable pause
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pauseEnd') {
    chrome.storage.sync.set({ pauseEnabled: false }, () => {
      notifyTabs();
    });
  }
});

// Handle tab navigation for blocking, redirecting, and site gating
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return;
  if (!tab.url) return;

  const settings = await chrome.storage.sync.get(null);

  // Check custom blocked sites first (before YouTube-specific logic)
  const blockedSites = settings.blockedSites || [];
  if (blockedSites.length > 0) {
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname.replace(/^www\./, '');
      const isBlocked = blockedSites.some(site => {
        return hostname === site || hostname.endsWith('.' + site);
      });

      if (isBlocked) {
        // Skip if already unlocked or already gated
        if (unlockedTabs.has(tabId) || gatedTabs.has(tabId)) return;

        // Mark as gated before injecting to prevent duplicate injections
        gatedTabs.add(tabId);

        // Inject the site gate overlay
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content/site-gate.js']
          });
        } catch (e) {
          // Script injection can fail on some pages (chrome://, etc.) - remove gated state
          gatedTabs.delete(tabId);
        }
        return;
      } else {
        // Navigated to a non-blocked site — clear gated/unlocked state
        gatedTabs.delete(tabId);
        unlockedTabs.delete(tabId);
      }
    } catch (e) {
      // Invalid URL - ignore
    }
  }

  // YouTube-specific logic
  if (!tab.url.includes('youtube.com')) return;

  // Don't block if paused
  if (isPaused(settings)) return;

  // Redirect to custom URL if enabled
  if (settings.redirectEnabled && settings.redirectUrl) {
    const redirectUrl = settings.redirectUrl.startsWith('http')
      ? settings.redirectUrl
      : 'https://' + settings.redirectUrl;
    chrome.tabs.update(tabId, { url: redirectUrl });
    return;
  }

  // Block YouTube completely
  if (settings.blockYoutube) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL('blocked.html')
    });
  }
});

// Reset gated/unlocked state when navigating to a new page
chrome.webNavigation?.onCommitted?.addListener((details) => {
  if (details.frameId !== 0) return; // Only main frame
  // Clear gated state so the gate can be re-injected on the new page
  gatedTabs.delete(details.tabId);
});

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

function notifyTabs() {
  chrome.storage.sync.get(null, (settings) => {
    chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'settingsUpdated', settings }).catch(() => {});
      });
    });
  });
}

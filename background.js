// Background service worker - handles blocking, redirecting, and pause timers

// Listen for pause timer
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'startPause') {
    chrome.alarms.create('pauseEnd', { delayInMinutes: msg.minutes });
    chrome.storage.sync.set({ pauseEnabled: true });
  } else if (msg.type === 'stopPause') {
    chrome.alarms.clear('pauseEnd');
    chrome.storage.sync.set({ pauseEnabled: false });
    notifyTabs();
  }
});

// When pause alarm fires, disable pause
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pauseEnd') {
    chrome.storage.sync.set({ pauseEnabled: false }, () => {
      notifyTabs();
    });
  }
});

// Handle tab navigation for blocking and redirecting
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return;
  if (!tab.url || !tab.url.includes('youtube.com')) return;

  const settings = await chrome.storage.sync.get(null);

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

// Tab-wide sleep timer — fades the volume of every <video> and <audio>
// element on the page from the user's current level down to silent over a
// configurable fade window, holds silent for an optional period, then pauses
// playback. Works on any site (YouTube, Twitch, Kick, Netflix, etc.) because
// streaming sites all play through HTML5 media elements.

let cachedSettings = null;
let tickInterval = null;
let activeSessionId = 0;
let baseVolumes = new WeakMap();

function getMediaElements() {
  return document.querySelectorAll('video, audio');
}

function applyFactor(factor) {
  const clamped = Math.max(0, Math.min(1, factor));
  for (const el of getMediaElements()) {
    if (!baseVolumes.has(el)) {
      // Capture the user's current volume the first time we see this element
      // so the fade starts where they were rather than jumping to 100%.
      baseVolumes.set(el, el.volume > 0 ? el.volume : 1);
    }
    const base = baseVolumes.get(el);
    try {
      el.volume = base * clamped;
      if (clamped === 0) el.muted = true;
    } catch (e) { /* some elements reject writes; ignore */ }
  }
}

function pauseAllMedia() {
  for (const el of getMediaElements()) {
    try { el.pause(); } catch (e) {}
  }
}

function tick() {
  const s = cachedSettings;
  if (!s || !s.sleepTimerEnabled || !s.sleepTimerStartedAt) {
    stopTimer();
    return;
  }

  const fadeMs = (parseInt(s.sleepFadeMinutes) || 0) * 60000;
  const silentMs = (parseInt(s.sleepSilentMinutes) || 0) * 60000;
  const elapsed = Date.now() - s.sleepTimerStartedAt;

  if (elapsed < fadeMs) {
    applyFactor(1 - elapsed / fadeMs);
  } else if (elapsed < fadeMs + silentMs) {
    applyFactor(0);
  } else {
    applyFactor(0);
    pauseAllMedia();
    chrome.storage.sync.set({ sleepTimerEnabled: false, sleepTimerStartedAt: 0 });
    stopTimer();
  }
}

function startTimer() {
  const s = cachedSettings;
  if (!s) return;

  // New timer session — reset captured base volumes so we re-anchor on the
  // current user volume.
  if (activeSessionId !== s.sleepTimerStartedAt) {
    activeSessionId = s.sleepTimerStartedAt;
    baseVolumes = new WeakMap();
  }

  tick();
  if (!tickInterval) {
    tickInterval = setInterval(tick, 1000);
  }
}

function stopTimer() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  activeSessionId = 0;
}

function refresh() {
  chrome.storage.sync.get(
    ['sleepTimerEnabled', 'sleepTimerStartedAt', 'sleepFadeMinutes', 'sleepSilentMinutes'],
    (s) => {
      cachedSettings = s;
      if (s.sleepTimerEnabled && s.sleepTimerStartedAt) {
        startTimer();
      } else {
        stopTimer();
      }
    }
  );
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (
    changes.sleepTimerEnabled !== undefined ||
    changes.sleepTimerStartedAt !== undefined ||
    changes.sleepFadeMinutes !== undefined ||
    changes.sleepSilentMinutes !== undefined
  ) {
    refresh();
  }
});

refresh();

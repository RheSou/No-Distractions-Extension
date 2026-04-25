// Tab-wide sleep timer.
//
// Uses the Web Audio API (the same technique as volume-booster extensions)
// to intercept audio from every <video> and <audio> element on the page and
// route it through a GainNode. This gives true tab-level volume control —
// the site can't override it because the audio is now leaving via our gain
// stage, not the element's default output.
//
// As the timer counts down, the gain fades from 1.0 to 0.0 over the fade
// window, holds at 0 for the silent window, then pauses every media
// element on the page.

let cachedSettings = null;
let tickInterval = null;
let activeSessionId = 0;
let audioCtx = null;
const gainNodes = new WeakMap();        // HTMLMediaElement -> GainNode
const wrappedElements = new WeakSet();  // elements we've already attempted to wrap

function ensureAudioContext() {
  if (audioCtx) return audioCtx;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  } catch (e) {
    audioCtx = null;
  }
  return audioCtx;
}

function getMediaElements() {
  return document.querySelectorAll('video, audio');
}

// Lazily route a media element through a GainNode the first time we touch it.
// createMediaElementSource can only be called once per element — if anything
// else (the site itself, another extension) already wrapped it, this throws
// and we fall back to el.volume.
function getGain(el) {
  if (gainNodes.has(el)) return gainNodes.get(el);
  if (wrappedElements.has(el)) return null;
  wrappedElements.add(el);

  const ctx = ensureAudioContext();
  if (!ctx) return null;

  try {
    const source = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(ctx.destination);
    gainNodes.set(el, gain);
    return gain;
  } catch (e) {
    return null;
  }
}

function applyFactor(factor) {
  const clamped = Math.max(0, Math.min(1, factor));
  for (const el of getMediaElements()) {
    const gain = getGain(el);
    if (gain) {
      // Smooth ramp avoids audible clicks when the value changes
      try {
        const ctx = audioCtx;
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setTargetAtTime(clamped, ctx.currentTime, 0.05);
      } catch (e) {
        gain.gain.value = clamped;
      }
    } else {
      // Fallback for elements we couldn't wrap (e.g., already wrapped, CORS).
      try { el.volume = clamped; } catch (e) {}
      if (clamped === 0) {
        try { el.muted = true; } catch (e) {}
      }
    }
  }

  // Browser autoplay policy: AudioContext starts suspended until a user
  // gesture. If media is already playing, the page already had a gesture
  // and resume() succeeds.
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function restoreFullVolume() {
  for (const el of getMediaElements()) {
    const gain = gainNodes.get(el);
    if (gain) {
      try {
        gain.gain.cancelScheduledValues(audioCtx.currentTime);
        gain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.05);
      } catch (e) {
        gain.gain.value = 1;
      }
    }
    // Undo the .volume / .muted fallback path too
    try { el.muted = false; } catch (e) {}
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
  if (fadeMs + silentMs <= 0) {
    chrome.storage.sync.set({ sleepTimerEnabled: false, sleepTimerStartedAt: 0 });
    stopTimer();
    return;
  }

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

  if (activeSessionId !== s.sleepTimerStartedAt) {
    activeSessionId = s.sleepTimerStartedAt;
  }

  tick();
  if (!tickInterval) {
    // Tick frequently enough to feel like a smooth fade
    tickInterval = setInterval(tick, 500);
  }
}

function stopTimer() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  activeSessionId = 0;
  // Hand audio back to the site at full volume
  restoreFullVolume();
}

function refresh() {
  chrome.storage.sync.get(
    {
      sleepTimerEnabled: false,
      sleepTimerStartedAt: 0,
      sleepFadeMinutes: 120,
      sleepSilentMinutes: 0
    },
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

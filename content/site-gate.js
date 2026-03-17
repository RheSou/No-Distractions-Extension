// Site gate content script - shows a password friction overlay on blocked sites
// Injected programmatically by background.js when visiting a blocked site

(async function () {
  // Don't inject twice
  if (document.getElementById('nd-site-gate-overlay')) return;

  const settings = await chrome.storage.sync.get(['frictionPassword', 'blockedSites']);
  const password = settings.frictionPassword || '';
  const blockedSites = settings.blockedSites || [];

  // Verify this site is actually blocked
  const hostname = window.location.hostname.replace(/^www\./, '');
  const isBlocked = blockedSites.some(site => {
    return hostname === site || hostname.endsWith('.' + site);
  });
  if (!isBlocked) return;

  // Create full-page overlay
  const overlay = document.createElement('div');
  overlay.id = 'nd-site-gate-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(255, 255, 255, 0.97);
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const siteName = hostname;
  const hasPassword = password.length > 0;

  overlay.innerHTML = `
    <div style="text-align: center; max-width: 420px; padding: 40px;">
      <div style="font-size: 56px; margin-bottom: 20px;">&#9888;</div>
      <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 12px; font-weight: 600;">
        Hold on — do you really need this?
      </h1>
      <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin-bottom: 8px;">
        You've blocked <strong style="color: #333;">${siteName}</strong> to help you stay focused.
      </p>
      <p style="font-size: 14px; color: #9CA3AF; margin-bottom: 28px;">
        ${hasPassword
          ? 'Type your password below to continue. This friction is intentional.'
          : 'Set a friction password in the extension to add an extra barrier.'}
      </p>
      ${hasPassword ? `
        <input type="password" id="nd-gate-password" placeholder="Type password to continue"
          style="
            padding: 10px 16px;
            border: 2px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            width: 260px;
            text-align: center;
            outline: none;
            margin-bottom: 12px;
            transition: border-color 0.2s;
          ">
        <div id="nd-gate-error" style="color: #ef4444; font-size: 13px; min-height: 20px; margin-bottom: 12px;"></div>
        <button id="nd-gate-submit" style="
          padding: 10px 32px;
          background: #1a73e8;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s;
          margin-right: 8px;
        ">Continue</button>
      ` : `
        <button id="nd-gate-submit" style="
          padding: 10px 32px;
          background: #1a73e8;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s;
          margin-right: 8px;
        ">Continue Anyway</button>
      `}
      <button id="nd-gate-goback" style="
        padding: 10px 32px;
        background: #f3f4f6;
        color: #333;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.15s;
      ">Go Back</button>
    </div>
  `;

  // Wait for body to be available
  function inject() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));
    } else {
      document.body.appendChild(overlay);
    }
  }
  inject();

  // Prevent scrolling behind overlay
  document.documentElement.style.overflow = 'hidden';

  // Event handlers
  const submitBtn = overlay.querySelector('#nd-gate-submit');
  const goBackBtn = overlay.querySelector('#nd-gate-goback');
  const passwordInput = overlay.querySelector('#nd-gate-password');
  const errorDiv = overlay.querySelector('#nd-gate-error');

  function unlock() {
    overlay.remove();
    document.documentElement.style.overflow = '';
    // Notify background that this tab is unlocked
    chrome.runtime.sendMessage({ type: 'siteUnlocked' });
  }

  submitBtn.addEventListener('click', () => {
    if (hasPassword) {
      const input = passwordInput.value;
      if (input === password) {
        unlock();
      } else {
        passwordInput.value = '';
        errorDiv.textContent = 'Wrong password. Try again.';
        passwordInput.style.borderColor = '#ef4444';
        setTimeout(() => {
          passwordInput.style.borderColor = '#d1d5db';
        }, 1500);
      }
    } else {
      unlock();
    }
  });

  goBackBtn.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  });

  if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitBtn.click();
      }
    });
    // Auto-focus the password input
    setTimeout(() => passwordInput.focus(), 100);
  }
})();

# No Distractions – YouTube Focus Extension

A Chrome extension that removes distractions from YouTube so you can stay focused and control your viewing habits.

![Chrome](https://img.shields.io/badge/Chrome-Manifest%20v3-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

### Distraction Controls

| Feature | Description |
|---|---|
| **Block YouTube** | Completely blocks access with a static page |
| **Hide Recommendations** | Removes the home page feed |
| **Force Redirect to Subscriptions** | Auto-redirects home/trending/explore to your subscriptions |
| **Hide Breaking News** | Removes news shelves from feeds |
| **Hide Sidebar** | Removes "Up Next" and related videos on the watch page |
| **Hide Comments** | Removes the entire comment section |
| **Blur / Hide Thumbnails** | Three modes: Show, Blur (25px), or completely Hide |
| **Hide Up Next / Disable Autoplay** | Removes end-screen suggestions and stops autoplay |
| **Hide Shorts** | Removes Shorts from all feeds and redirects `/shorts/` URLs to regular videos |
| **Hide Trending / Explore** | Removes Trending and Explore navigation items |
| **Hide End Cards / Annotations** | Removes in-video cards and annotations |
| **Hide Notification Badge** | Removes the notification count |
| **Hide Live Chat** | Hides live chat on streams |
| **Hide View / Like Counts** | Hides view counts, like counts, and subscriber counts |
| **Remove Colors (Grayscale)** | Converts the YouTube interface to grayscale (video player excluded) |

### Time Management

- **Pause Timer** – Temporarily disable the extension for 5 / 15 / 30 / 60 / 120 minutes
- **Scheduled Pause** – Set a daily time range and days of the week when the extension pauses automatically (e.g. weekdays 9am–5pm)
- **Watch Time Reminder** – Get a banner reminder after 15 / 30 / 45 / 60 / 120 minutes of continuous watching
- **Daily Time Limit** – Set a hard cap of 15 / 30 / 60 / 120 / 180 minutes per day; a full-screen overlay blocks YouTube when the limit is reached

### Other

- **Custom Redirect** – Redirect YouTube to any URL of your choice
- **Lock Settings** – Password-protect your settings so they can't be changed without the password

## Installation

### From source (developer mode)

1. Clone this repository:
   ```
   git clone https://github.com/RheSou/No-Distractions-Extension.git
   ```
2. Open `chrome://extensions` in Chrome (or any Chromium-based browser)
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the cloned folder

The extension icon will appear in your toolbar. Click it to open the settings popup.

## Browser Compatibility

Works on any Chromium-based browser that supports Manifest V3:

- Google Chrome
- Microsoft Edge
- Brave
- Vivaldi
- Opera

## Project Structure

```
├── manifest.json          # Extension manifest (v3)
├── background.js          # Service worker – pause timers, tab blocking/redirects
├── blocked.html           # Page shown when YouTube is fully blocked
├── content/
│   ├── youtube.js         # Content script – applies settings to YouTube pages
│   └── youtube.css        # CSS rules for hiding/blurring UI elements
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup logic and settings management
│   └── popup.css          # Popup styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## How It Works

1. **Background service worker** monitors tab navigation. If YouTube is blocked or a redirect is configured, it intercepts immediately.
2. **Content script** runs on every YouTube page, reads settings from `chrome.storage.sync`, and toggles CSS classes on `<body>` to show/hide elements.
3. A `MutationObserver` handles YouTube's SPA navigation so settings persist across page transitions.
4. Watch time and daily limits are tracked in `chrome.storage.local` and reset automatically.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Open a pull request

## License

MIT

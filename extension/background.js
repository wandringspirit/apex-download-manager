const BRIDGE_URL = 'http://127.0.0.1:48911';

const DEFAULT_EXTENSIONS = [
  'exe', 'zip', 'rar', '7z', 'iso', 'msi', 'bin', 'tar', 'gz', 'bz2', 'xz', 
  'apk', 'dmg', 'mp4', 'mkv', 'avi', 'mov', 'mp3', 'flac', 'wav', 'pdf', 
  'epub', 'torrent', 'pkg', 'deb', 'rpm'
];

// Initialize default settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['autoCatch', 'extensions'], (res) => {
    if (res.autoCatch === undefined) {
      chrome.storage.local.set({ autoCatch: true });
    }
    if (!res.extensions) {
      chrome.storage.local.set({ extensions: DEFAULT_EXTENSIONS });
    }
  });

  // Setup context menus
  chrome.contextMenus.create({
    id: 'adm-download-link',
    title: 'Download with Apex Download Manager',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'adm-download-media',
    title: 'Download Media with Apex Download Manager',
    contexts: ['video', 'audio', 'image']
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let targetUrl = '';
  if (info.menuItemId === 'adm-download-link' && info.linkUrl) {
    targetUrl = info.linkUrl;
  } else if (info.menuItemId === 'adm-download-media' && (info.srcUrl || info.linkUrl)) {
    targetUrl = info.srcUrl || info.linkUrl;
  }

  if (targetUrl) {
    await sendToADM({ url: targetUrl, referrer: tab ? tab.url : '' });
  }
});

// Helper: Check if ADM desktop application is running
async function isADMAvailable() {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/status`, { method: 'GET', signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Helper: Send download to ADM desktop app
async function sendToADM(payload) {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error('[ADM Extension] Failed to send download to desktop:', err);
    return null;
  }
}

// Signature IDM Feature: Auto-intercept browser downloads
chrome.downloads.onCreated.addListener(async (item) => {
  const { autoCatch = true, extensions = DEFAULT_EXTENSIONS } = await chrome.storage.local.get(['autoCatch', 'extensions']);
  if (!autoCatch) return;

  const url = item.finalUrl || item.url || '';
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;

  // Extract file extension from filename or url
  let ext = '';
  if (item.filename) {
    ext = item.filename.split('.').pop().toLowerCase();
  } else {
    try {
      const pathname = new URL(url).pathname;
      ext = pathname.split('.').pop().toLowerCase();
    } catch (e) {}
  }

  // If extension matches our intercept list
  if (extensions.includes(ext)) {
    const isOnline = await isADMAvailable();
    if (!isOnline) {
      console.log('[ADM Extension] ADM Desktop is not running, letting browser handle download');
      return;
    }

    // Cancel browser native download
    try {
      chrome.downloads.cancel(item.id, () => {
        chrome.downloads.erase({ id: item.id }, () => {});
      });
    } catch (e) {}

    // Forward to ADM Desktop
    console.log(`[ADM Extension] Intercepted download: ${url}`);
    await sendToADM({
      url,
      fileName: item.filename ? item.filename.split(/[\\/]/).pop() : '',
      referrer: item.referrer || ''
    });
  }
});

// Helper: Export session cookies for video extraction bypass (Netscape format)
async function syncCookiesToADM(domain) {
  try {
    if (!chrome.cookies) return;
    const cookies = await chrome.cookies.getAll({ domain });
    if (!cookies || cookies.length === 0) return;
    const lines = ['# Netscape HTTP Cookie File'];
    for (const c of cookies) {
      const flag = c.domain.startsWith('.') ? 'TRUE' : 'FALSE';
      const secure = c.secure ? 'TRUE' : 'FALSE';
      const expiry = c.expirationDate ? Math.round(c.expirationDate) : 0;
      lines.push(`${c.domain}\t${flag}\t${c.path}\t${secure}\t${expiry}\t${c.name}\t${c.value}`);
    }
    await fetch(`${BRIDGE_URL}/api/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookies: lines.join('\n') })
    });
  } catch (e) {
    // Silent fail if cookies API is restricted
  }
}

// Listen for messages from content scripts (e.g. Video Grabber button)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_ADM_STATUS') {
    isADMAvailable().then(status => sendResponse({ online: status }));
    return true;
  }

  if (message.type === 'GRAB_MEDIA') {
    if (message.url && (message.url.includes('youtube.com') || message.url.includes('youtu.be'))) {
      syncCookiesToADM('.youtube.com');
    }
    sendToADM({
      url: message.url,
      fileName: message.fileName || '',
      referrer: sender.tab ? sender.tab.url : ''
    }).then(result => {
      sendResponse({ success: !!result, result });
    });
    return true;
  }
});

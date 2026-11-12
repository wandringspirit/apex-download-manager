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

// Mime type fallback map when URL path lacks a file extension (e.g. Google Drive /download URLs)
const MIME_EXT_MAP = {
  'video/mp4': 'mp4',
  'video/x-matroska': 'mkv',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'audio/mpeg': 'mp3',
  'audio/flac': 'flac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/vnd.rar': 'rar',
  'application/x-7z-compressed': '7z',
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
  'application/x-msdownload': 'exe',
  'application/vnd.microsoft.portable-executable': 'exe',
  'application/vnd.android.package-archive': 'apk',
  'application/x-iso9660-image': 'iso',
  'application/x-bittorrent': 'torrent'
};

function extractExtension(item, url) {
  if (item && item.filename) {
    const cleanName = item.filename.replace(/\.crdownload$/i, '').split(/[\\/]/).pop() || '';
    const dotIdx = cleanName.lastIndexOf('.');
    if (dotIdx > 0 && dotIdx < cleanName.length - 1) {
      return cleanName.slice(dotIdx + 1).toLowerCase();
    }
  }
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split('/').filter(Boolean).pop() || '';
    const dotIdx = base.lastIndexOf('.');
    if (dotIdx > 0 && dotIdx < base.length - 1) {
      return base.slice(dotIdx + 1).toLowerCase();
    }
  } catch (e) {}
  if (item && item.mime) {
    const cleanMime = item.mime.split(';')[0].trim().toLowerCase();
    if (MIME_EXT_MAP[cleanMime]) return MIME_EXT_MAP[cleanMime];
  }
  return '';
}

async function buildRequestHeaders(url, referrer) {
  const headers = {};
  if (referrer && /^https?:/i.test(referrer)) {
    headers['Referer'] = referrer;
  }
  try {
    if (chrome.cookies && /^https?:/i.test(url)) {
      const cookies = await chrome.cookies.getAll({ url });
      if (cookies && cookies.length > 0) {
        headers['Cookie'] = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      }
    }
  } catch (e) {}
  return headers;
}

// Helper: Check if ADM desktop application is running
async function isADMAvailable(timeoutMs = 1500) {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/status`, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Helper: Send download to ADM desktop app (auto-attaches session cookies & referer)
async function sendToADM(payload) {
  try {
    const enriched = { ...payload };
    if (enriched.url && /^https?:/i.test(enriched.url) && !enriched.headers) {
      const reqHeaders = await buildRequestHeaders(enriched.url, enriched.referrer || '');
      if (Object.keys(reqHeaders).length > 0) {
        enriched.headers = reqHeaders;
      }
    }
    const res = await fetch(`${BRIDGE_URL}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enriched),
      signal: AbortSignal.timeout(10000)
    });
    return await res.json();
  } catch (err) {
    console.error('[ADM Extension] Failed to send download to desktop:', err);
    return null;
  }
}

// Track downloads already processed so onDeterminingFilename/onCreated never double-fire
const handledDownloadIds = new Set();

// Signature IDM Feature: Auto-intercept browser downloads AFTER Content-Disposition & MIME resolution
// (Fixes Google Drive /download and signed CDN URLs whose path lacks a file extension during onCreated)
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const url = item.finalUrl || item.url || '';
  if (!url || url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('chrome')) {
    return false;
  }

  let finished = false;
  const safeSuggest = () => {
    if (finished) return;
    finished = true;
    try { suggest(); } catch (e) {}
  };

  (async () => {
    try {
      if (handledDownloadIds.has(item.id)) return;

      const { autoCatch = true, extensions = DEFAULT_EXTENSIONS } = await chrome.storage.local.get(['autoCatch', 'extensions']);
      if (!autoCatch) return;

      const ext = extractExtension(item, url);
      if (!ext || !extensions.includes(ext)) return;

      const isOnline = await isADMAvailable(800);
      if (!isOnline) {
        console.log('[ADM Extension] ADM Desktop is not running, letting browser handle download');
        return;
      }

      handledDownloadIds.add(item.id);
      setTimeout(() => handledDownloadIds.delete(item.id), 30000);

      const fileName = item.filename ? item.filename.replace(/\.crdownload$/i, '').split(/[\\/]/).pop() : '';
      const headers = await buildRequestHeaders(url, item.referrer || '');

      console.log(`[ADM Extension] Intercepted download (${fileName || ext}): ${url}`);
      const result = await sendToADM({
        url,
        fileName,
        referrer: item.referrer || '',
        headers
      });

      if (result && result.success) {
        try {
          chrome.downloads.cancel(item.id, () => {
            void chrome.runtime.lastError;
            chrome.downloads.erase({ id: item.id }, () => {
              void chrome.runtime.lastError;
            });
          });
        } catch (e) {}
      }
    } catch (err) {
      console.error('[ADM Extension] Intercept error:', err);
    } finally {
      safeSuggest();
    }
  })();

  return true;
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
    if (message.url && (message.url.includes('terabox') || message.url.includes('1024tera') || message.url.includes('nephobox'))) {
      syncCookiesToADM('.terabox.com');
      syncCookiesToADM('.1024tera.com');
      syncCookiesToADM('.terabox.app');
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

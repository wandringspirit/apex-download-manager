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

// =========================================================================
// Real-Time Network Stream Sniffer (HLS .m3u8, DASH .mpd, Video Segments)
// =========================================================================
const detectedStreamsByTab = new Map(); // tabId -> Array<StreamEntry>

function isAdOrTrackerUrl(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  const adKeywords = [
    'googleads', 'doubleclick', 'analytics', 'facebook.net', 'adnxs',
    'scorecardresearch', 'taboola', 'outbrain', 'popads', 'adservice',
    'adsystem', 'googlesyndication', 'hotjar', 'clarity.ms', 'segment.io'
  ];
  return adKeywords.some(k => lower.includes(k));
}

function detectStreamType(url, contentType = '') {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.split('#')[0];
  const lower = cleanUrl.toLowerCase();
  const cType = (contentType || '').toLowerCase();

  // HLS stream (.m3u8 or HLS content types)
  if (
    /\.m3u8(\?|$)/i.test(cleanUrl) ||
    lower.includes('/m3u8') ||
    lower.includes('/hls/') ||
    cType.includes('application/vnd.apple.mpegurl') ||
    cType.includes('application/x-mpegurl') ||
    cType.includes('audio/x-mpegurl')
  ) {
    let quality = 'Auto';
    if (lower.includes('1080')) quality = '1080p FHD';
    else if (lower.includes('720')) quality = '720p HD';
    else if (lower.includes('480')) quality = '480p SD';
    else if (lower.includes('360')) quality = '360p';
    return { type: 'HLS', label: 'HLS Stream (.m3u8)', quality, isPlaylist: true };
  }

  // DASH stream (.mpd)
  if (/\.mpd(\?|$)/i.test(cleanUrl) || cType.includes('application/dash+xml')) {
    return { type: 'DASH', label: 'DASH Manifest (.mpd)', quality: 'Auto', isPlaylist: true };
  }

  // Direct video file streams
  if (
    /\.(mp4|webm|mkv|mov)(\?|$)/i.test(cleanUrl) ||
    cType.startsWith('video/')
  ) {
    if (cType.includes('mp2t') || lower.endsWith('.ts')) return null; // Skip individual TS chunks to avoid spamming 1000 items
    const ext = (cleanUrl.split('.').pop().split('?')[0] || 'MP4').toUpperCase();
    return { type: 'DIRECT', label: `${ext} Video`, quality: 'Direct', isPlaylist: false };
  }

  return null;
}

function recordDetectedStream(tabId, url, typeInfo, headers = {}) {
  if (!tabId || tabId < 0 || !url || isAdOrTrackerUrl(url)) return;

  if (!detectedStreamsByTab.has(tabId)) {
    detectedStreamsByTab.set(tabId, []);
  }
  const streamList = detectedStreamsByTab.get(tabId);

  // Deduplicate: If URL already captured, merge any new headers
  const existing = streamList.find(s => s.url === url);
  if (existing) {
    if (headers && Object.keys(headers).length > 0) {
      existing.headers = { ...existing.headers, ...headers };
    }
    return;
  }

  // Generate clean candidate title
  let candidateTitle = '';
  try {
    const u = new URL(url);
    const lastSeg = u.pathname.split('/').filter(Boolean).pop() || '';
    candidateTitle = decodeURIComponent(lastSeg.split('?')[0]);
  } catch (_) {}

  const streamEntry = {
    id: Math.random().toString(36).substring(2, 9),
    tabId,
    url,
    title: candidateTitle || `${typeInfo.type}_Video`,
    type: typeInfo.type,
    label: typeInfo.label,
    quality: typeInfo.quality,
    isPlaylist: typeInfo.isPlaylist,
    headers: headers || {},
    timestamp: Date.now()
  };

  if (streamList.length >= 20) {
    streamList.shift();
  }
  streamList.push(streamEntry);

  // Update extension action badge on this tab
  try {
    if (chrome.action) {
      chrome.action.setBadgeText({ tabId, text: String(streamList.length) });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#0284c7' });
    }
  } catch (_) {}

  // Broadcast to all frames in the tab
  try {
    chrome.tabs.sendMessage(tabId, {
      type: 'STREAM_DETECTED',
      stream: streamEntry
    }, () => {
      void chrome.runtime.lastError;
    });
  } catch (_) {}
}

// =========================================================================
// Real-Time Subtitle Sniffer (.vtt / .srt / .ass -> Auto-Converted to .srt)
// =========================================================================
const detectedSubtitlesByTab = new Map(); // tabId -> Array<SubtitleEntry>

function inferSubtitleLanguage(url) {
  const lower = String(url || '').toLowerCase();
  const langMap = [
    [/\b(english|eng|en[-_.]us|en[-_.]gb)\b|\/en[-_.]/i, 'English'],
    [/\b(japanese|jpn|ja)\b|\/ja[-_.]/i, 'Japanese'],
    [/\b(spanish|spa|esp|es[-_.])/i, 'Spanish'],
    [/\b(french|fre|fra|fr[-_.])/i, 'French'],
    [/\b(german|ger|deu|de[-_.])/i, 'German'],
    [/\b(arabic|ara|ar[-_.])/i, 'Arabic'],
    [/\b(hindi|hin|hi[-_.])/i, 'Hindi'],
    [/\b(portuguese|por|pt[-_.])/i, 'Portuguese'],
    [/\b(italian|ita|it[-_.])/i, 'Italian'],
    [/\b(russian|rus|ru[-_.])/i, 'Russian'],
    [/\b(korean|kor|ko[-_.])/i, 'Korean'],
    [/\b(chinese|chi|zho|zh[-_.])/i, 'Chinese'],
    [/\b(indonesian|ind|id[-_.])/i, 'Indonesian']
  ];
  for (const [regex, name] of langMap) {
    if (regex.test(lower)) return name;
  }
  return 'Subtitles';
}

function detectSubtitleTrack(url, contentType = '') {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.split('#')[0];
  const lower = cleanUrl.toLowerCase();
  const cType = (contentType || '').toLowerCase();

  // Exclude player seekbar preview thumbnails / sprite sheets (.vtt)
  if (/(thumb|thumbnail|sprite|preview|trickplay|storyboard|chapter|\.bif)/i.test(lower)) {
    return null;
  }

  const extMatch = cleanUrl.match(/\.(vtt|srt|ass|ssa)(\?|$)/i);
  const isSubMime =
    cType.includes('text/vtt') ||
    cType.includes('application/x-subrip') ||
    cType.includes('text/srt');

  if (!extMatch && !isSubMime) return null;

  const format = extMatch ? extMatch[1].toUpperCase() : (cType.includes('vtt') ? 'VTT' : 'SRT');
  const language = inferSubtitleLanguage(cleanUrl);
  return { format, language };
}

function recordDetectedSubtitle(tabId, url, subInfo, headers = {}) {
  if (!tabId || tabId < 0 || !url || isAdOrTrackerUrl(url)) return;

  if (!detectedSubtitlesByTab.has(tabId)) {
    detectedSubtitlesByTab.set(tabId, []);
  }
  const subList = detectedSubtitlesByTab.get(tabId);

  const existing = subList.find(s => s.url === url);
  if (existing) {
    if (headers && Object.keys(headers).length > 0) {
      existing.headers = { ...existing.headers, ...headers };
    }
    return;
  }

  let candidateTitle = '';
  try {
    const u = new URL(url);
    candidateTitle = decodeURIComponent((u.pathname.split('/').filter(Boolean).pop() || '').split('?')[0]);
  } catch (_) {}

  const subEntry = {
    id: Math.random().toString(36).substring(2, 9),
    tabId,
    url,
    title: candidateTitle || `${subInfo.language}.srt`,
    language: subInfo.language,
    format: subInfo.format,
    headers: headers || {},
    timestamp: Date.now()
  };

  if (subList.length >= 20) subList.shift();
  subList.push(subEntry);

  try {
    chrome.tabs.sendMessage(tabId, {
      type: 'SUBTITLE_DETECTED',
      subtitle: subEntry
    }, () => {
      void chrome.runtime.lastError;
    });
  } catch (_) {}
}

if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
  try {
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        if (!details || details.tabId < 0) return;
        const headers = {};
        if (details.initiator) {
          headers['Origin'] = details.initiator;
          headers['Referer'] = details.initiator + '/';
        }
        const typeInfo = detectStreamType(details.url);
        if (typeInfo) {
          recordDetectedStream(details.tabId, details.url, typeInfo, headers);
        }
        const subInfo = detectSubtitleTrack(details.url);
        if (subInfo) {
          recordDetectedSubtitle(details.tabId, details.url, subInfo, headers);
        }
      },
      { urls: ['<all_urls>'] }
    );
  } catch (err) {
    console.warn('[ADM Extension] webRequest.onBeforeRequest failed:', err);
  }
}

if (chrome.webRequest && chrome.webRequest.onBeforeSendHeaders) {
  try {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        if (!details || details.tabId < 0) return;
        const streamList = detectedStreamsByTab.get(details.tabId) || [];
        const subList = detectedSubtitlesByTab.get(details.tabId) || [];
        const entry = streamList.find(s => s.url === details.url) || subList.find(s => s.url === details.url);
        if (entry && details.requestHeaders) {
          entry.headers = entry.headers || {};
          for (const h of details.requestHeaders) {
            const name = h.name.toLowerCase();
            if (['referer', 'origin', 'user-agent', 'cookie'].includes(name)) {
              entry.headers[h.name] = h.value;
            }
          }
        }
      },
      { urls: ['<all_urls>'] },
      ['requestHeaders']
    );
  } catch (err) {
    console.warn('[ADM Extension] webRequest.onBeforeSendHeaders failed:', err);
  }
}

if (chrome.webRequest && chrome.webRequest.onHeadersReceived) {
  try {
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        if (!details || details.tabId < 0) return;
        let cType = '';
        if (details.responseHeaders) {
          const ctHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
          if (ctHeader && ctHeader.value) cType = ctHeader.value;
        }
        const typeInfo = detectStreamType(details.url, cType);
        if (typeInfo) {
          recordDetectedStream(details.tabId, details.url, typeInfo);
        }
        const subInfo = detectSubtitleTrack(details.url, cType);
        if (subInfo) {
          recordDetectedSubtitle(details.tabId, details.url, subInfo);
        }
      },
      { urls: ['<all_urls>'] },
      ['responseHeaders']
    );
  } catch (err) {
    console.warn('[ADM Extension] webRequest.onHeadersReceived failed:', err);
  }
}

// Clean up streams & subtitles when tabs close or navigate
if (chrome.tabs) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    detectedStreamsByTab.delete(tabId);
    detectedSubtitlesByTab.delete(tabId);
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' && changeInfo.url) {
      detectedStreamsByTab.delete(tabId);
      detectedSubtitlesByTab.delete(tabId);
      try {
        if (chrome.action) chrome.action.setBadgeText({ tabId, text: '' });
      } catch (_) {}
    }
  });
}

function pickBestSubtitleForTab(tabId) {
  const subs = (tabId && detectedSubtitlesByTab.get(tabId)) || [];
  if (subs.length === 0) return null;
  const english = subs.find(s => /eng|^en\b/i.test(String(s.language || s.url || '')));
  return english || subs[subs.length - 1];
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_ADM_STATUS') {
    isADMAvailable().then(status => sendResponse({ online: status }));
    return true;
  }

  if (message.type === 'GET_DETECTED_STREAMS') {
    const tabId = message.tabId || (sender && sender.tab ? sender.tab.id : null);
    sendResponse({
      streams: (tabId && detectedStreamsByTab.get(tabId)) || [],
      subtitles: (tabId && detectedSubtitlesByTab.get(tabId)) || []
    });
    return true;
  }

  if (message.type === 'DOWNLOAD_DETECTED_STREAM') {
    (async () => {
      let headers = message.headers || {};
      if (message.url && (!headers || Object.keys(headers).length === 0)) {
        headers = await buildRequestHeaders(message.url, message.referrer || '');
      }
      const tabId = message.tabId || (sender && sender.tab ? sender.tab.id : null);
      const autoSub = message.subtitleUrl ? null : pickBestSubtitleForTab(tabId);
      const subtitleUrl = message.subtitleUrl || (autoSub ? autoSub.url : '');
      const subtitleHeaders = message.subtitleHeaders || (autoSub ? autoSub.headers : undefined);
      const subtitleLang = message.subtitleLang || (autoSub ? autoSub.language : '');

      const result = await sendToADM({
        url: message.url,
        fileName: message.fileName || '',
        referrer: message.referrer || '',
        headers,
        subtitleUrl: subtitleUrl || undefined,
        subtitleHeaders,
        subtitleLang: subtitleLang || undefined
      });
      sendResponse({ success: !!result, hasSubtitle: !!subtitleUrl, result });
    })();
    return true;
  }

  if (message.type === 'DOWNLOAD_SUBTITLE') {
    (async () => {
      let headers = message.headers || {};
      const ref = message.referrer || (sender && sender.tab ? sender.tab.url : '');
      if (message.url && (!headers || Object.keys(headers).length === 0)) {
        headers = await buildRequestHeaders(message.url, ref);
      }
      let resolvedFileName = message.fileName || '';
      if (sender && sender.frameId > 0 && sender.tab && sender.tab.title) {
        const cleanTabTitle = sender.tab.title.replace(/[\\/:*?"<>|]/g, '').trim();
        if (cleanTabTitle) {
          resolvedFileName = `${cleanTabTitle}.srt`;
        }
      }
      const result = await sendToADM({
        url: message.url,
        fileName: resolvedFileName,
        referrer: ref,
        convertToSrt: true,
        headers
      });
      sendResponse({ success: !!result, result });
    })();
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
    // Prefer the top-level tab title when the grabber button was clicked inside a cross-origin embed iframe
    let resolvedFileName = message.fileName || '';
    if (sender && sender.frameId > 0 && sender.tab && sender.tab.title) {
      const cleanTabTitle = sender.tab.title.replace(/[\\/:*?"<>|]/g, '').trim();
      if (cleanTabTitle) {
        resolvedFileName = message.quality === 'subtitle' ? `${cleanTabTitle}.srt` : `${cleanTabTitle}.mp4`;
      }
    }

    // Automatically bundle any detected subtitle track with video downloads so VLC opens subtitles automatically
    const wantsVideoWithSubs = message.quality !== 'audio' && message.quality !== 'subtitle';
    const tabId = sender && sender.tab ? sender.tab.id : null;
    const autoSub = wantsVideoWithSubs && !message.subtitleUrl ? pickBestSubtitleForTab(tabId) : null;
    const subtitleUrl = wantsVideoWithSubs ? (message.subtitleUrl || (autoSub ? autoSub.url : '')) : '';
    const subtitleHeaders = wantsVideoWithSubs ? (message.subtitleHeaders || (autoSub ? autoSub.headers : undefined)) : undefined;
    const subtitleLang = wantsVideoWithSubs ? (message.subtitleLang || (autoSub ? autoSub.language : '')) : '';

    sendToADM({
      url: message.url,
      fileName: resolvedFileName,
      quality: message.quality,
      convertToSrt: message.quality === 'subtitle' && !message.url.includes('youtube.com') && !message.url.includes('youtu.be'),
      referrer: sender.tab ? sender.tab.url : '',
      headers: message.headers && typeof message.headers === 'object' ? message.headers : undefined,
      subtitleUrl: subtitleUrl || undefined,
      subtitleHeaders,
      subtitleLang: subtitleLang || undefined
    }).then(result => {
      sendResponse({ success: !!result, hasSubtitle: !!subtitleUrl, result });
    });
    return true;
  }
});

const BRIDGE_URL = 'http://127.0.0.1:48911';

const statusPill = document.getElementById('statusPill');
const statusText = document.getElementById('statusText');
const autoCatchToggle = document.getElementById('autoCatchToggle');
const urlInput = document.getElementById('urlInput');
const sendBtn = document.getElementById('sendBtn');

// Load stored settings
chrome.storage.local.get(['autoCatch'], (res) => {
  autoCatchToggle.checked = res.autoCatch !== false;
});

autoCatchToggle.addEventListener('change', () => {
  chrome.storage.local.set({ autoCatch: autoCatchToggle.checked });
});

// Check ADM desktop health
async function checkStatus() {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/status`, { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      statusPill.className = 'status-pill status-online';
      statusText.textContent = 'ADM Online';
    } else {
      throw new Error();
    }
  } catch (e) {
    statusPill.className = 'status-pill status-offline';
    statusText.textContent = 'ADM Offline';
  }
}

checkStatus();

// Send URL to desktop
sendBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) return;

  sendBtn.textContent = 'Sending...';
  try {
    const res = await fetch(`${BRIDGE_URL}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (data.success) {
      sendBtn.textContent = 'Sent Successfully!';
      urlInput.value = '';
      setTimeout(() => sendBtn.textContent = 'Send to ADM', 2000);
    } else {
      sendBtn.textContent = 'Failed';
      setTimeout(() => sendBtn.textContent = 'Send to ADM', 2000);
    }
  } catch (e) {
    sendBtn.textContent = 'ADM Offline';
    setTimeout(() => sendBtn.textContent = 'Send to ADM', 2000);
  }
});

// Query and display detected video streams & subtitles for the active tab
const detectedSection = document.getElementById('detectedStreamsSection');
const detectedList = document.getElementById('detectedList');
const detectedCountBadge = document.getElementById('detectedCountBadge');
const detectedSubSection = document.getElementById('detectedSubtitlesSection');
const detectedSubList = document.getElementById('detectedSubList');
const detectedSubCountBadge = document.getElementById('detectedSubCountBadge');

function loadDetectedStreams() {
  if (!chrome.tabs || !chrome.tabs.query) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    const tab = tabs[0];

    chrome.runtime.sendMessage({ type: 'GET_DETECTED_STREAMS', tabId: tab.id }, (response) => {
      if (chrome.runtime.lastError || !response) {
        if (detectedSection) detectedSection.style.display = 'none';
        if (detectedSubSection) detectedSubSection.style.display = 'none';
        return;
      }

      const streams = Array.isArray(response.streams) ? response.streams : [];
      const subtitles = Array.isArray(response.subtitles) ? response.subtitles : [];

      if (streams.length === 0) {
        if (detectedSection) detectedSection.style.display = 'none';
      } else {
        if (detectedSection) detectedSection.style.display = 'block';
        if (detectedCountBadge) detectedCountBadge.textContent = String(streams.length);
        if (detectedList) detectedList.innerHTML = '';

        streams.forEach((stream) => {
          const card = document.createElement('div');
          card.className = 'detected-card';

          let displayTitle = tab.title ? tab.title.replace(/[\\/:*?"<>|]/g, '').trim() : stream.title;
          if (!displayTitle) displayTitle = 'Video Stream';

          const isHls = stream.type === 'HLS';
          const badgeClass = isHls ? 'badge-hls' : 'badge-quality';

          card.innerHTML = `
            <div class="detected-card-top">
              <div class="detected-name" title="${displayTitle}">${displayTitle}</div>
              <div class="detected-badges">
                <span class="badge-pill ${badgeClass}">${stream.type}</span>
                <span class="badge-pill badge-quality">${stream.quality || 'HD'}</span>
              </div>
            </div>
            <button class="btn-download-stream" type="button">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download in ADM
            </button>
          `;

          const downloadBtn = card.querySelector('.btn-download-stream');
          downloadBtn.addEventListener('click', () => {
            downloadBtn.disabled = true;
            downloadBtn.textContent = 'Sending to ADM...';

            const autoSub = subtitles.find(s => /eng|^en\b/i.test(String(s.language || s.url || ''))) || subtitles[subtitles.length - 1];
            chrome.runtime.sendMessage({
              type: 'DOWNLOAD_DETECTED_STREAM',
              tabId: tab.id,
              url: stream.url,
              fileName: `${displayTitle}.mp4`,
              referrer: tab.url,
              headers: stream.headers || {},
              subtitleUrl: autoSub ? autoSub.url : undefined,
              subtitleHeaders: autoSub ? autoSub.headers : undefined,
              subtitleLang: autoSub ? autoSub.language : undefined
            }, (res) => {
              if (res && res.success) {
                downloadBtn.className = 'btn-download-stream success';
                downloadBtn.textContent = res.hasSubtitle ? '✓ Sent to ADM (+SRT)!' : '✓ Sent to ADM!';
                setTimeout(() => {
                  downloadBtn.className = 'btn-download-stream';
                  downloadBtn.textContent = 'Download in ADM';
                  downloadBtn.disabled = false;
                }, 2500);
              } else {
                downloadBtn.textContent = 'Failed';
                setTimeout(() => {
                  downloadBtn.textContent = 'Download in ADM';
                  downloadBtn.disabled = false;
                }, 2000);
              }
            });
          });

          if (detectedList) detectedList.appendChild(card);
        });
      }

      if (subtitles.length === 0) {
        if (detectedSubSection) detectedSubSection.style.display = 'none';
      } else {
        if (detectedSubSection) detectedSubSection.style.display = 'block';
        if (detectedSubCountBadge) detectedSubCountBadge.textContent = String(subtitles.length);
        if (detectedSubList) detectedSubList.innerHTML = '';

        subtitles.forEach((sub) => {
          const card = document.createElement('div');
          card.className = 'detected-card';

          const cleanTabTitle = tab.title ? tab.title.replace(/[\\/:*?"<>|]/g, '').trim() : '';
          const langSuffix = sub.language && sub.language !== 'Subtitles' && sub.language !== 'English' ? `.${sub.language}` : '';
          const srtFileName = `${cleanTabTitle || 'Subtitles'}${langSuffix}.srt`;

          card.innerHTML = `
            <div class="detected-card-top">
              <div class="detected-name" title="${srtFileName}">${sub.language || 'Subtitles'} (${sub.title || sub.format})</div>
              <div class="detected-badges">
                <span class="badge-pill badge-srt">SRT</span>
              </div>
            </div>
            <button class="btn-download-stream" style="background: linear-gradient(135deg, #d97706, #b45309);" type="button">
              Download .SRT
            </button>
          `;

          const subBtn = card.querySelector('.btn-download-stream');
          subBtn.addEventListener('click', () => {
            subBtn.disabled = true;
            subBtn.textContent = 'Converting to .SRT...';

            chrome.runtime.sendMessage({
              type: 'DOWNLOAD_SUBTITLE',
              url: sub.url,
              fileName: srtFileName,
              referrer: tab.url,
              headers: sub.headers || {}
            }, (res) => {
              if (res && res.success) {
                subBtn.className = 'btn-download-stream success';
                subBtn.style.background = '#059669';
                subBtn.textContent = '✓ .SRT Saved in ADM!';
                setTimeout(() => {
                  subBtn.className = 'btn-download-stream';
                  subBtn.style.background = 'linear-gradient(135deg, #d97706, #b45309)';
                  subBtn.textContent = 'Download .SRT';
                  subBtn.disabled = false;
                }, 2500);
              } else {
                subBtn.textContent = 'Failed';
                setTimeout(() => {
                  subBtn.textContent = 'Download .SRT';
                  subBtn.disabled = false;
                }, 2000);
              }
            });
          });

          if (detectedSubList) detectedSubList.appendChild(card);
        });
      }
    });
  });
}

loadDetectedStreams();

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

// Query and display detected video streams for the active tab
const detectedSection = document.getElementById('detectedStreamsSection');
const detectedList = document.getElementById('detectedList');
const detectedCountBadge = document.getElementById('detectedCountBadge');

function loadDetectedStreams() {
  if (!chrome.tabs || !chrome.tabs.query) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    const tab = tabs[0];

    chrome.runtime.sendMessage({ type: 'GET_DETECTED_STREAMS', tabId: tab.id }, (response) => {
      if (chrome.runtime.lastError || !response || !response.streams || response.streams.length === 0) {
        if (detectedSection) detectedSection.style.display = 'none';
        return;
      }

      const streams = response.streams;
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

          chrome.runtime.sendMessage({
            type: 'DOWNLOAD_DETECTED_STREAM',
            url: stream.url,
            fileName: `${displayTitle}.mp4`,
            referrer: tab.url,
            headers: stream.headers || {}
          }, (res) => {
            if (res && res.success) {
              downloadBtn.className = 'btn-download-stream success';
              downloadBtn.textContent = '✓ Sent to ADM!';
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
    });
  });
}

loadDetectedStreams();

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

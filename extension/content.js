// Video Grabber - Authentic IDM-style floating download badge on web players
(() => {
  const processedMedia = new WeakSet();

  function findTopPlayerContainer(mediaElement) {
    let cur = mediaElement.parentElement;
    let candidate = cur || document.body;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const cls = (typeof cur.className === 'string' ? cur.className : '').toLowerCase();
      const id = (cur.id || '').toLowerCase();
      if (
        cls.includes('player') || cls.includes('video-container') || cls.includes('media-container') ||
        cls.includes('html5-video') || id.includes('player') || id.includes('movie_player')
      ) {
        candidate = cur;
      }
      cur = cur.parentElement;
    }
    return candidate;
  }

  function createFloatingDownloadButton(mediaElement) {
    if (processedMedia.has(mediaElement)) return;
    processedMedia.add(mediaElement);

    const panel = document.createElement('div');
    panel.className = 'adm-idm-grabber-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Apex Download Manager Video Grabber');

    panel.innerHTML = `
      <div class="adm-idm-btn-main" role="button" tabindex="0" title="Download this video with Apex Download Manager">
        <div class="adm-idm-icon-wrapper">
          <svg class="adm-idm-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4"/>
            <path d="M5 21h14"/>
          </svg>
        </div>
        <span class="adm-idm-label">Download this video</span>
        <svg class="adm-idm-chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" title="Video options">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      <div class="adm-idm-divider"></div>

      <div class="adm-idm-btn-close" role="button" tabindex="0" title="Dismiss">
        <svg class="adm-idm-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>

      <!-- Modern Quality Dropdown -->
      <div class="adm-idm-dropdown">
        <div class="adm-idm-dropdown-header">
          <span class="adm-idm-dot"></span>
          <span>Apex Download Manager</span>
        </div>
        <div class="adm-idm-dropdown-item" data-quality="best">
          <div class="adm-idm-dropdown-left">
            <span>Best Available</span>
          </div>
          <span class="adm-idm-badge adm-badge-fhd">1080p FHD</span>
        </div>
        <div class="adm-idm-dropdown-item" data-quality="720p">
          <div class="adm-idm-dropdown-left">
            <span>High Definition</span>
          </div>
          <span class="adm-idm-badge adm-badge-hd">720p HD</span>
        </div>
        <div class="adm-idm-dropdown-item" data-quality="480p">
          <div class="adm-idm-dropdown-left">
            <span>Standard Definition</span>
          </div>
          <span class="adm-idm-badge adm-badge-sd">480p SD</span>
        </div>
        <div class="adm-idm-dropdown-item" data-quality="audio">
          <div class="adm-idm-dropdown-left">
            <span>Audio Only</span>
          </div>
          <span class="adm-idm-badge adm-badge-audio">MP3 Audio</span>
        </div>
      </div>
    `;

    const mainBtn = panel.querySelector('.adm-idm-btn-main');
    const chevron = panel.querySelector('.adm-idm-chevron-svg');
    const closeBtn = panel.querySelector('.adm-idm-btn-close');
    const dropdown = panel.querySelector('.adm-idm-dropdown');
    const label = panel.querySelector('.adm-idm-label');

    const triggerDownload = (quality = 'best', e = null) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      }

      dropdown.classList.remove('adm-idm-dropdown-open');
      if (label) label.textContent = 'Sending...';

      const pageTitle = document.title.replace(/[\\/:*?"<>|]/g, '').trim() || 'video';
      let targetUrl = mediaElement.currentSrc || mediaElement.src || window.location.href;
      if (window.location.hostname.includes('youtube.com') || window.location.hostname.includes('youtu.be') || targetUrl.startsWith('blob:')) {
        targetUrl = window.location.href;
      }

      const payload = {
        type: 'GRAB_MEDIA',
        url: targetUrl,
        fileName: `${pageTitle}.mp4`,
        quality
      };

      const handleSuccess = () => {
        panel.classList.remove('adm-idm-error');
        panel.classList.add('adm-idm-success');
        if (label) label.textContent = 'Sent to ADM!';
        setTimeout(() => {
          panel.classList.remove('adm-idm-success');
          if (label) label.textContent = 'Download this video';
        }, 3000);
      };

      const handleError = () => {
        panel.classList.remove('adm-idm-success');
        panel.classList.add('adm-idm-error');
        if (label) label.textContent = 'ADM Offline';
        setTimeout(() => {
          panel.classList.remove('adm-idm-error');
          if (label) label.textContent = 'Download this video';
        }, 3000);
      };

      // Primary: Send via chrome.runtime
      let sentViaRuntime = false;
      try {
        if (chrome && chrome.runtime && chrome.runtime.id) {
          sentViaRuntime = true;
          chrome.runtime.sendMessage(payload, (res) => {
            if (chrome.runtime.lastError || !res || !res.success) {
              fallbackDirectPost(targetUrl, `${pageTitle}.mp4`, handleSuccess, handleError);
            } else {
              handleSuccess();
            }
          });
        }
      } catch (err) {
        sentViaRuntime = false;
      }

      if (!sentViaRuntime) {
        fallbackDirectPost(targetUrl, `${pageTitle}.mp4`, handleSuccess, handleError);
      }
    };

    function fallbackDirectPost(url, fileName, onSuccess, onError) {
      fetch('http://127.0.0.1:48911/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, fileName, referrer: window.location.href })
      })
      .then(res => res.json())
      .then(data => {
        if (data && (data.success || data.id)) {
          onSuccess();
        } else {
          onError();
        }
      })
      .catch(() => onError());
    }

    // Toggle dropdown on chevron click
    chevron.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle('adm-idm-dropdown-open');
      chevron.classList.toggle('adm-chevron-open');
    }, true);

    // Main button triggers download
    mainBtn.addEventListener('click', (e) => {
      if (e.target === chevron || chevron.contains(e.target)) return;
      triggerDownload('best', e);
    }, true);

    // Dropdown item selection
    panel.querySelectorAll('.adm-idm-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const quality = item.getAttribute('data-quality') || 'best';
        chevron.classList.remove('adm-chevron-open');
        triggerDownload(quality, e);
      }, true);
    });

    // Close / Dismiss button
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      panel.style.display = 'none';
    }, true);

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target)) {
        dropdown.classList.remove('adm-idm-dropdown-open');
        chevron.classList.remove('adm-chevron-open');
      }
    });

    // Prevent player click stealing
    panel.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }, true);
    panel.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }, true);

    const playerContainer = findTopPlayerContainer(mediaElement);
    if (getComputedStyle(playerContainer).position === 'static') {
      playerContainer.style.position = 'relative';
    }

    playerContainer.appendChild(panel);
  }

  // Scan for existing media tags
  function scanMedia() {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
      if (v.offsetWidth > 80 || v.offsetHeight > 80 || v.autoplay || v.controls || !v.paused) {
        createFloatingDownloadButton(v);
      }
    });
  }

  // Observe DOM for dynamic video player insertions
  const observer = new MutationObserver(() => {
    scanMedia();
  });

  observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

  setInterval(scanMedia, 2000);
  setTimeout(scanMedia, 500);
})();

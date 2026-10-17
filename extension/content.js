// Video Grabber - Authentic IDM-style floating download badge on web players
(() => {
  // Finds the exact active player container (never walks past the actual video player wrapper)
  function findBestPlayerContainer(mediaElement) {
    if (!mediaElement) return document.body;

    // 1. YouTube specialized player (movie_player is the persistent player instance)
    const ytPlayer = document.getElementById('movie_player') || 
                     mediaElement.closest('#movie_player') || 
                     mediaElement.closest('.html5-video-player');
    if (ytPlayer) return ytPlayer;

    // 2. Specialized web video players (VideoJS, JWPlayer, Plyr, Vimeo, Twitter, etc.)
    const playerWrapper = mediaElement.closest(
      '.video-js, .jwplayer, .plyr, .vjs-tech, [data-player], [class*="player"], [id*="player"]'
    );
    if (playerWrapper && playerWrapper !== document.body && playerWrapper !== document.documentElement) {
      return playerWrapper;
    }

    // 3. Direct parent container
    return mediaElement.parentElement || document.body;
  }

  function createFloatingDownloadButton(mediaElement, container) {
    // If user explicitly dismissed button for this video element, respect choice
    if (mediaElement._adm_dismissed) return;

    // Create panel
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
      mediaElement._adm_dismissed = true;
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

    // Ensure container positioning
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    // Attach to DOM and associate with mediaElement
    container.appendChild(panel);
    mediaElement._adm_panel = panel;
  }

  // Ensures button is attached and persists even across video playback start & player DOM re-renders
  function ensureButtonForMedia(mediaElement) {
    if (!mediaElement || !document.contains(mediaElement)) return;
    if (mediaElement._adm_dismissed) return;

    // Filter out tiny audio elements or miniature preview icons
    const rect = mediaElement.getBoundingClientRect();
    const isVisible = rect.width > 120 && rect.height > 80;
    if (!isVisible && !mediaElement.autoplay && mediaElement.paused && !mediaElement.controls) {
      return;
    }

    // Find best container (prioritizes #movie_player)
    const container = findBestPlayerContainer(mediaElement);
    if (!container) return;

    // If panel already exists and is actively in the DOM
    if (mediaElement._adm_panel && document.contains(mediaElement._adm_panel)) {
      // If container changed (e.g. from outer wrapper to movie_player when player activated)
      if (mediaElement._adm_panel.parentElement !== container) {
        container.appendChild(mediaElement._adm_panel);
      }
      return;
    }

    // If panel was created previously but detached by YouTube/player re-render: re-append it!
    if (mediaElement._adm_panel) {
      container.appendChild(mediaElement._adm_panel);
      return;
    }

    // Fresh creation
    createFloatingDownloadButton(mediaElement, container);
  }

  // Scan all media elements on page
  function scanMedia() {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
      ensureButtonForMedia(v);
    });
  }

  // Listen to video playback events (fires right when video finishes loading and starts playing)
  ['playing', 'play', 'loadeddata', 'canplay', 'loadedmetadata'].forEach(eventName => {
    document.addEventListener(eventName, (e) => {
      if (e.target && e.target.tagName === 'VIDEO') {
        ensureButtonForMedia(e.target);
      }
    }, true);
  });

  // YouTube SPA navigation events (when switching videos without page reload)
  window.addEventListener('yt-navigate-finish', () => {
    setTimeout(scanMedia, 300);
    setTimeout(scanMedia, 1000);
    setTimeout(scanMedia, 2500);
  });
  window.addEventListener('spfdone', scanMedia);

  // Dynamic DOM observation
  const observer = new MutationObserver(() => {
    scanMedia();
  });
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

  // Periodic heartbeat ensuring persistent visibility
  setInterval(scanMedia, 1500);
  setTimeout(scanMedia, 500);
  setTimeout(scanMedia, 1500);
})();

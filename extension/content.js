// Video Grabber - Authentic IDM-style floating download badge on web players
(() => {
  // Finds the exact active player container (never walks past the actual video player wrapper)
  function findBestPlayerContainer(mediaElement) {
    if (!mediaElement) return document.body;

    // 1. YouTube specialized player (only if mediaElement is inside YouTube's player)
    const ytPlayerWrapper = mediaElement.closest('#movie_player, .html5-video-player, ytd-player, #player');
    if (ytPlayerWrapper) {
      return document.getElementById('movie_player') || ytPlayerWrapper;
    }

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
    if (!container) return;

    // If user explicitly dismissed button for this media, container, or URL, respect choice
    const pageKey = window.location.pathname + window.location.search;
    if (mediaElement._adm_dismissed || container._adm_dismissed || window._adm_dismissed_url === window.location.href) {
      return;
    }
    try {
      if (sessionStorage.getItem('adm_dismissed_' + pageKey) === '1') return;
    } catch (_) {}

    // Strict deduplication: NEVER allow more than one grabber panel inside the same container
    if (container.querySelector('.adm-idm-grabber-panel')) {
      return;
    }

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

    // Close / Dismiss button handler (bulletproof dismissal)
    let isDismissed = false;
    const handleDismiss = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      }
      if (isDismissed) return;
      isDismissed = true;

      mediaElement._adm_dismissed = true;
      if (container) container._adm_dismissed = true;
      window._adm_dismissed_url = window.location.href;
      try {
        sessionStorage.setItem('adm_dismissed_' + (window.location.pathname + window.location.search), '1');
      } catch (_) {}

      // Remove panel and any duplicate panels immediately
      panel.style.display = 'none';
      if (panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
      if (container) {
        const allPanels = container.querySelectorAll('.adm-idm-grabber-panel');
        allPanels.forEach(p => {
          try { p.parentNode.removeChild(p); } catch (_) {}
        });
      }
    };

    // Prevent player click events on close button
    closeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }, true);
    closeBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }, true);

    // Bind multiple dismissal triggers for zero-latency response
    closeBtn.addEventListener('click', handleDismiss, true);
    closeBtn.addEventListener('pointerup', handleDismiss, true);
    closeBtn.addEventListener('mouseup', handleDismiss, true);

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
    
    // Check if dismissed
    const pageKey = window.location.pathname + window.location.search;
    if (mediaElement._adm_dismissed || window._adm_dismissed_url === window.location.href) return;
    try {
      if (sessionStorage.getItem('adm_dismissed_' + pageKey) === '1') return;
    } catch (_) {}

    // Filter out tiny audio elements or miniature preview icons
    const rect = mediaElement.getBoundingClientRect();
    const isVisible = rect.width > 160 && rect.height > 90;
    if (!isVisible && !mediaElement.autoplay && mediaElement.paused && !mediaElement.controls) {
      return;
    }

    // Find best container (prioritizes #movie_player)
    const container = findBestPlayerContainer(mediaElement);
    if (!container || container._adm_dismissed) return;

    // Strict single panel per container
    if (container.querySelector('.adm-idm-grabber-panel')) {
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
    if (window._adm_dismissed_url && window._adm_dismissed_url !== window.location.href) {
      window._adm_dismissed_url = null;
    }
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

  // =========================================================================
  // TeraBox Direct Multi-Socket Download Bypass Interceptor
  // =========================================================================
  const isTerabox = [
    'terabox.com', '1024tera.com', 'teraboxapp.com', 'terabox.app',
    '1024terabox.com', 'freeterabox.com', 'nephobox.com', '4funbox.com',
    'mirrobox.com', 'dubox.com'
  ].some(d => window.location.hostname.includes(d));

  if (isTerabox) {
    console.log('[ADM] TeraBox Direct Multi-Socket Interceptor activated.');

    // 0. Auto-Catch: directly add to downloads as soon as TeraBox share URL is opened in Chrome
    const isSharePage = window.location.pathname.includes('/s/') || 
                        window.location.search.includes('surl=') || 
                        window.location.pathname.includes('/sharing/');

    if (isSharePage) {
      const pageKey = 'adm_tb_auto_caught_' + (window.location.pathname + window.location.search);
      if (!sessionStorage.getItem(pageKey)) {
        sessionStorage.setItem(pageKey, '1');

        // Create elegant floating status banner
        const banner = document.createElement('div');
        banner.className = 'adm-idm-grabber-panel';
        banner.style.cssText = 'position:fixed;top:18px;right:18px;z-index:2147483647;background:linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.96));border:1px solid #00f0ff;box-shadow:0 10px 30px rgba(0,240,255,0.25);color:#fff;padding:12px 18px;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;gap:12px;user-select:none;transition:all 0.3s ease;';
        banner.innerHTML = `
          <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#0284c7,#00f0ff);display:flex;align-items:center;justify-content:center;color:#000;font-weight:900;font-size:14px;box-shadow:0 0 10px rgba(0,240,255,0.5);">⚡</div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <div style="font-weight:700;font-size:13px;color:#f1f5f9;">Apex Download Manager: TeraBox Link Detected</div>
            <div style="font-size:11.5px;color:#94a3b8;">Adding to 32-socket accelerated download...</div>
          </div>
          <div class="adm-tb-close-banner" style="margin-left:8px;cursor:pointer;color:#64748b;font-weight:700;font-size:14px;" title="Dismiss">&times;</div>
        `;
        
        const closeX = banner.querySelector('.adm-tb-close-banner');
        if (closeX) {
          closeX.onclick = (e) => {
            e.stopPropagation();
            banner.remove();
          };
        }

        (document.body || document.documentElement).appendChild(banner);

        if (chrome && chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage({
            type: 'GRAB_MEDIA',
            url: window.location.href,
            fileName: document.title.replace(/[\\/:*?"<>|]/g, '').trim() || 'TeraBox_File'
          }, (res) => {
            if (res && res.success) {
              banner.style.borderColor = '#10b981';
              banner.style.boxShadow = '0 10px 30px rgba(16,185,129,0.25)';
              banner.innerHTML = `
                <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#059669,#10b981);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px;box-shadow:0 0 10px rgba(16,185,129,0.5);">&#10003;</div>
                <div style="display:flex;flex-direction:column;gap:2px;">
                  <div style="font-weight:700;font-size:13px;color:#a7f3d0;">Direct Download Started in ADM!</div>
                  <div style="font-size:11.5px;color:#94a3b8;">32 parallel sockets active. You can safely close this tab.</div>
                </div>
              `;
              setTimeout(() => {
                banner.style.opacity = '0';
                setTimeout(() => banner.remove(), 400);
              }, 4500);
            }
          });
        }
      }
    }

    const fileMap = new Map();

    // 1. Intercept fetch/XHR to extract direct dlink from TeraBox API responses
    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = async function(...args) {
        const res = await originalFetch.apply(this, args);
        try {
          const clone = res.clone();
          const urlStr = String(args[0] || '');
          if (urlStr.includes('/list') || urlStr.includes('/share') || urlStr.includes('/membership')) {
            clone.json().then(data => {
              if (data && Array.isArray(data.list)) {
                for (const item of data.list) {
                  const name = item.server_filename || item.filename || '';
                  const dlink = item.dlink || '';
                  const size = item.size || 0;
                  if (name && dlink) {
                    fileMap.set(name, { name, dlink, size });
                    if (item.fs_id) fileMap.set(String(item.fs_id), { name, dlink, size });
                  }
                }
              }
            }).catch(() => {});
          }
        } catch (e) {}
        return res;
      };
    }

    // 2. Intercept clicks on TeraBox's download buttons to bypass mandatory app prompt
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.download-btn, [class*="download"], [data-fun="download"], button[title*="Download"], .wp-s-core-header-tool__item');
      if (!btn) return;

      // Find checked or selected file items
      const selected = document.querySelectorAll('.file-item-listmode.checked, .file-item.selected, .wp-s-pan-table__body-row.is-checked, [class*="is-checked"], [class*="selected"]');
      let targetFile = null;

      if (selected.length > 0) {
        for (const row of selected) {
          const text = row.textContent || '';
          for (const [name, info] of fileMap.entries()) {
            if (text.includes(name)) {
              targetFile = info;
              break;
            }
          }
          if (targetFile) break;
        }
      }

      if (!targetFile && fileMap.size > 0) {
        targetFile = fileMap.values().next().value;
      }

      if (targetFile && targetFile.dlink) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (chrome && chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage({
            type: 'GRAB_MEDIA',
            url: targetFile.dlink,
            fileName: targetFile.name,
            totalBytes: targetFile.size
          });

          // Show floating visual indicator
          const toast = document.createElement('div');
          toast.className = 'adm-idm-grabber-panel';
          toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;background:#13161c;border:1px solid #3b82f6;color:#fff;padding:12px 18px;border-radius:8px;font-family:sans-serif;box-shadow:0 10px 25px rgba(0,0,0,0.5);display:flex;align-items:center;gap:10px;';
          toast.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;"></span><span><strong>Apex Download Manager:</strong> Downloading <strong>${targetFile.name}</strong> with 32 parallel threads...</span>`;
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 4000);
        }
      }
    }, true);
  }
})();

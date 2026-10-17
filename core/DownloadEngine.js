import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { URL } from 'url';

export class DownloadTask extends EventEmitter {
  constructor(options) {
    super();
    this.id = options.id || Math.random().toString(36).substring(2, 10);
    this.url = options.url;
    this.savePath = options.savePath || path.join(os.homedir(), 'Downloads');
    this.fileName = options.fileName || '';
    this.maxConnections = options.maxConnections || 32;
    this.category = options.category || 'General';
    this.status = 'idle'; // 'idle' | 'probing' | 'downloading' | 'paused' | 'completed' | 'error'
    this.totalBytes = 0;
    this.downloadedBytes = options.downloadedBytes || 0;
    this.speed = 0; // bytes/sec
    this.peakSpeed = options.peakSpeed || 0;
    this.avgSpeed = options.avgSpeed || 0;
    this.speedSamples = options.speedSamples || [];
    this.totalSpeedSum = 0;
    this.speedSampleCount = 0;
    this.eta = 0; // seconds
    this.resumable = false;
    this.eTag = '';
    this.lastModified = '';
    this.segments = []; // [{ id, start, end, current, active, completed }]
    this.activeRequests = [];
    this.fileDescriptor = null;
    this.speedHistory = [];
    this.speedTimer = null;
    this.metaPath = '';
    this.error = null;
    this.throttledReason = options.throttledReason || null;
    this.last429Time = 0;
    this.headers = options.headers || {};
    this.createdAt = options.createdAt || new Date().toISOString();
  }

  getFilePath() {
    return path.join(this.savePath, this.fileName);
  }

  getIncompleteFilePath() {
    return path.join(this.savePath, `${this.fileName}.adm_download`);
  }

  getMetaPath() {
    return path.join(this.savePath, `.${this.fileName}.adm.json`);
  }

  updateDownloadedBytes() {
    if (this.segments && this.segments.length > 0) {
      const sum = this.segments.reduce((acc, s) => {
        const segDownloaded = Math.max(0, s.current - s.start);
        const segTotal = Math.max(0, s.end - s.start + 1);
        return acc + Math.min(segTotal, segDownloaded);
      }, 0);
      this.downloadedBytes = this.totalBytes > 0 ? Math.min(this.totalBytes, sum) : sum;
    }
  }

  async probe() {
    this.status = 'probing';
    this.emit('status', this.status);

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(this.url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        ...this.headers,
        'Range': 'bytes=0-0'
      };

      const req = client.request(this.url, { method: 'GET', headers }, (res) => {
        // Handle redirect
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.url = new URL(res.headers.location, this.url).href;
          res.destroy();
          return this.probe().then(resolve).catch(reject);
        }

        // Extract filename if not set
        if (!this.fileName) {
          const disposition = res.headers['content-disposition'];
          if (disposition && disposition.includes('filename=')) {
            const match = disposition.match(/filename=["']?([^"';]+)["']?/);
            if (match && match[1]) {
              this.fileName = decodeURIComponent(match[1].trim());
            }
          }
          if (!this.fileName) {
            const cleanPath = parsedUrl.pathname.split('/').filter(Boolean).pop() || 'download.bin';
            this.fileName = decodeURIComponent(cleanPath.split('?')[0]);
          }
        }

        // Auto categorize
        this.category = this.detectCategory(this.fileName);

        this.eTag = res.headers['etag'] || '';
        this.lastModified = res.headers['last-modified'] || '';

        // Check if server supports range requests (Status 206)
        if (res.statusCode === 206) {
          this.resumable = true;
          const contentRange = res.headers['content-range'];
          if (contentRange) {
            const match = contentRange.match(/\/(\d+)/);
            if (match && match[1]) {
              this.totalBytes = parseInt(match[1], 10);
            }
          }
        } else {
          this.resumable = false;
          const len = res.headers['content-length'];
          if (len) this.totalBytes = parseInt(len, 10);
        }

        res.destroy();
        resolve({
          fileName: this.fileName,
          totalBytes: this.totalBytes,
          resumable: this.resumable,
          category: this.category
        });
      });

      req.on('error', (err) => {
        this.error = err.message;
        this.status = 'error';
        this.emit('error', err);
        reject(err);
      });

      req.end();
    });
  }

  detectCategory(filename) {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts'];
    const musicExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'];
    const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'epub'];
    const progExts = ['exe', 'msi', 'dmg', 'pkg', 'apk', 'iso', 'bin', 'deb', 'rpm'];
    const zipExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'];

    if (videoExts.includes(ext)) return 'Video';
    if (musicExts.includes(ext)) return 'Music';
    if (docExts.includes(ext)) return 'Documents';
    if (progExts.includes(ext)) return 'Programs';
    if (zipExts.includes(ext)) return 'Compressed';
    return 'General';
  }

  async start() {
    if (this.status === 'downloading') return;

    if (!this.totalBytes || !this.fileName) {
      await this.probe();
    }

    if (!fs.existsSync(this.savePath)) {
      fs.mkdirSync(this.savePath, { recursive: true });
    }

    const incompletePath = this.getIncompleteFilePath();
    const filePath = this.getFilePath();
    this.metaPath = this.getMetaPath();

    // Check if resuming from saved journal
    if (fs.existsSync(this.metaPath) && this.resumable) {
      try {
        const meta = JSON.parse(fs.readFileSync(this.metaPath, 'utf8'));
        if (meta.totalBytes === this.totalBytes && meta.segments && meta.segments.length > 0) {
          this.segments = meta.segments;
        }
      } catch (e) {
        // Invalid meta, start fresh
      }
    }

    // Initialize segments if not loaded
    if (this.segments.length === 0) {
      if (this.resumable && this.totalBytes > 0) {
        const numSegments = Math.min(this.maxConnections, Math.max(1, Math.floor(this.totalBytes / (512 * 1024))));
        const chunkSize = Math.floor(this.totalBytes / numSegments);

        this.segments = [];
        for (let i = 0; i < numSegments; i++) {
          const start = i * chunkSize;
          const end = (i === numSegments - 1) ? this.totalBytes - 1 : (start + chunkSize - 1);
          this.segments.push({
            id: i,
            start,
            end,
            current: start,
            completed: false,
            active: false
          });
        }
      } else {
        // Single connection fallback
        this.segments = [{
          id: 0,
          start: 0,
          end: this.totalBytes ? this.totalBytes - 1 : 0,
          current: 0,
          completed: false,
          active: false
        }];
      }
    }

    this.updateDownloadedBytes();

    // Allocate / open file: write to incomplete file (.adm_download) to prevent media players or user from moving partial files
    let targetPath = incompletePath;
    if (!fs.existsSync(incompletePath)) {
      if (fs.existsSync(filePath)) {
        try { fs.renameSync(filePath, incompletePath); } catch (e) { targetPath = filePath; }
      }
    }

    if (!fs.existsSync(targetPath)) {
      this.fileDescriptor = fs.openSync(targetPath, 'w+');
      if (this.totalBytes > 0) {
        try {
          fs.ftruncateSync(this.fileDescriptor, this.totalBytes);
        } catch (e) {
          // Pre-allocation not strictly required if filesystem doesn't support ftruncate
        }
      }
    } else {
      this.fileDescriptor = fs.openSync(targetPath, 'r+');
    }

    this.status = 'downloading';
    this.emit('status', this.status);

    this.startSpeedMeter();

    if (this.resumable && this.segments.length > 1) {
      this.segments.forEach(seg => {
        if (!seg.completed && seg.current <= seg.end) {
          this.downloadSegment(seg);
        }
      });
    } else {
      this.downloadSingleStream();
    }
  }

  downloadSegment(segment) {
    if (this.status !== 'downloading' || segment.completed || segment.current > segment.end) return;

    segment.active = true;
    const parsedUrl = new URL(this.url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      ...this.headers,
      'Range': `bytes=${segment.current}-${segment.end}`
    };

    const req = client.request(this.url, { method: 'GET', headers }, (res) => {
      // Adaptive 429 / 503 Auto-Throttle Step-Down
      if (res.statusCode === 429 || res.statusCode === 503) {
        segment.active = false;
        req.destroy();
        this.handleRateLimitStepDown(res.statusCode, segment);
        return;
      }

      // Range check: Sub-segments MUST receive HTTP 206 Partial Content.
      // If server sends 200 OK, it is streaming the whole file from byte 0, which would corrupt file offsets!
      if (res.statusCode !== 206) {
        if (segment.start > 0 || segment.end < this.totalBytes - 1) {
          console.warn(`[ADM] Server returned HTTP ${res.statusCode} instead of 206 for range ${segment.start}-${segment.end}. Aborting segment.`);
          segment.active = false;
          req.destroy();
          return;
        }
      }

      res.on('data', (chunk) => {
        if (this.status !== 'downloading' || !this.fileDescriptor) {
          req.destroy();
          return;
        }

        // Verify active file still exists (detect if user moved or deleted file externally)
        const incFile = this.getIncompleteFilePath();
        const mainFile = this.getFilePath();
        if (!fs.existsSync(incFile) && !fs.existsSync(mainFile)) {
          req.destroy();
          this.pause();
          this.error = 'Download file was moved or deleted externally';
          this.emit('error', new Error(this.error));
          return;
        }

        try {
          fs.writeSync(this.fileDescriptor, chunk, 0, chunk.length, segment.current);
          segment.current += chunk.length;
          this.updateDownloadedBytes();
          this.speedHistory.push({ time: Date.now(), bytes: chunk.length });
          this.emitProgress();
        } catch (err) {
          req.destroy();
          this.emit('error', err);
        }
      });

      res.on('end', () => {
        segment.active = false;
        if (segment.current > segment.end) {
          segment.completed = true;
        }

        // Dynamic re-splitting: if this connection finished, steal work from the largest remaining segment!
        this.checkDynamicResegment();
        this.checkCompletion();
      });

      res.on('error', () => {
        segment.active = false;
        if (this.status === 'downloading') {
          // Re-attempt chunk after brief backoff
          setTimeout(() => this.downloadSegment(segment), 1500);
        }
      });
    });

    req.on('error', () => {
      segment.active = false;
      if (this.status === 'downloading') {
        setTimeout(() => this.downloadSegment(segment), 1500);
      }
    });

    this.activeRequests.push(req);
    req.end();
  }

  // Adaptive 429 Step-Down: Auto-decreases thread concurrency when server rate limits or throttles
  handleRateLimitStepDown(triggerCode, segment) {
    const now = Date.now();
    if (now - this.last429Time < 2000) {
      setTimeout(() => {
        if (this.status === 'downloading' && !segment.completed) {
          this.downloadSegment(segment);
        }
      }, 2500);
      return;
    }
    this.last429Time = now;

    let newTarget = 32;
    if (this.maxConnections > 48) newTarget = 48;
    else if (this.maxConnections > 32) newTarget = 32;
    else if (this.maxConnections > 16) newTarget = 16;
    else if (this.maxConnections > 8) newTarget = 8;
    else if (this.maxConnections > 4) newTarget = 4;
    else newTarget = Math.max(1, this.maxConnections - 1);

    this.throttledReason = `Server Rate Limit (HTTP ${triggerCode}) - Auto-throttled to ${newTarget} threads`;
    console.warn(`[ADM Auto-Throttle] ${this.throttledReason}`);

    this.setConcurrency(newTarget);

    // Exponential backoff cooldown (2 seconds) to let server token bucket drain
    setTimeout(() => {
      if (this.status === 'downloading' && !segment.completed) {
        this.downloadSegment(segment);
      }
    }, 2000);
  }

  // Signature IDM Feature: Dynamic Re-segmentation
  checkDynamicResegment() {
    if (this.status !== 'downloading' || !this.resumable) return;

    // Find incomplete segments
    const unfinished = this.segments.filter(s => !s.completed && s.active);
    if (unfinished.length === 0) return;

    // Find the segment with the largest remaining byte distance
    let largest = null;
    let maxRemaining = 0;
    for (const s of unfinished) {
      const remaining = s.end - s.current;
      if (remaining > maxRemaining) {
        maxRemaining = remaining;
        largest = s;
      }
    }

    // If remaining is larger than 2MB, split it and use idle thread
    const MIN_SPLIT_SIZE = 2 * 1024 * 1024;
    if (largest && maxRemaining > MIN_SPLIT_SIZE && this.segments.length < this.maxConnections) {
      const midPoint = largest.current + Math.floor(maxRemaining / 2);
      const originalEnd = largest.end;

      // Adjust original segment boundary
      largest.end = midPoint - 1;

      // Create new segment for the upper half
      const newSeg = {
        id: this.segments.length,
        start: midPoint,
        end: originalEnd,
        current: midPoint,
        completed: false,
        active: false
      };

      this.segments.push(newSeg);
      this.downloadSegment(newSeg);
    }
  }

  // On-the-fly dynamic concurrency adjustment (slider / presets)
  setConcurrency(newCount) {
    const target = Math.max(1, Math.min(64, parseInt(newCount, 10) || 32));
    this.maxConnections = target;

    if (this.status !== 'downloading' || !this.resumable) {
      this.emitProgress();
      return;
    }

    const currentActive = this.segments.filter(s => s.active && !s.completed).length;

    if (target > currentActive) {
      // Scale UP: dynamically split the largest incomplete segments in real-time
      let toAdd = target - currentActive;
      while (toAdd > 0) {
        let largest = null;
        let maxRem = 0;
        for (const s of this.segments) {
          if (s.active && !s.completed) {
            const rem = s.end - s.current;
            if (rem > maxRem && rem >= 512 * 1024) { // At least 512KB to split
              maxRem = rem;
              largest = s;
            }
          }
        }

        if (!largest) break;

        const originalEnd = largest.end;
        const midPoint = largest.current + Math.floor(maxRem / 2);
        largest.end = midPoint - 1;

        const newSeg = {
          id: this.segments.length,
          start: midPoint,
          end: originalEnd,
          current: midPoint,
          completed: false,
          active: false
        };

        this.segments.push(newSeg);
        this.downloadSegment(newSeg);
        toAdd--;
      }
    } else if (target < currentActive) {
      // Scale DOWN: gracefully close excess active requests
      let excess = currentActive - target;
      for (let i = this.activeRequests.length - 1; i >= 0 && excess > 0; i--) {
        const req = this.activeRequests[i];
        if (req && !req.destroyed) {
          try {
            req.destroy();
            excess--;
          } catch (e) {}
        }
      }
    }

    this.saveMeta();
    this.emitProgress();
  }

  downloadSingleStream() {
    const parsedUrl = new URL(this.url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      ...this.headers
    };

    const req = client.request(this.url, { method: 'GET', headers }, (res) => {
      res.on('data', (chunk) => {
        if (this.status !== 'downloading' || !this.fileDescriptor) {
          req.destroy();
          return;
        }

        // Verify active file still exists
        const incFile = this.getIncompleteFilePath();
        const mainFile = this.getFilePath();
        if (!fs.existsSync(incFile) && !fs.existsSync(mainFile)) {
          req.destroy();
          this.pause();
          this.error = 'Download file was moved or deleted externally';
          this.emit('error', new Error(this.error));
          return;
        }

        try {
          fs.writeSync(this.fileDescriptor, chunk, 0, chunk.length, this.segments[0].current);
          this.segments[0].current += chunk.length;
          this.updateDownloadedBytes();
          this.speedHistory.push({ time: Date.now(), bytes: chunk.length });
          this.emitProgress();
        } catch (err) {
          req.destroy();
          this.emit('error', err);
        }
      });

      res.on('end', () => {
        this.segments[0].completed = true;
        this.checkCompletion();
      });

      res.on('error', (err) => {
        this.emit('error', err);
      });
    });

    req.on('error', (err) => {
      this.emit('error', err);
    });

    this.activeRequests.push(req);
    req.end();
  }

  pause() {
    if (this.status !== 'downloading') return;

    this.status = 'paused';
    this.stopSpeedMeter();

    // Abort all in-flight network requests
    this.activeRequests.forEach(req => {
      try { req.destroy(); } catch (e) {}
    });
    this.activeRequests = [];

    // Close file descriptor
    if (this.fileDescriptor) {
      try { fs.closeSync(this.fileDescriptor); } catch (e) {}
      this.fileDescriptor = null;
    }

    // Save resume journal
    this.saveMeta();
    this.emit('status', this.status);
  }

  saveMeta() {
    try {
      const meta = {
        id: this.id,
        url: this.url,
        fileName: this.fileName,
        totalBytes: this.totalBytes,
        resumable: this.resumable,
        eTag: this.eTag,
        lastModified: this.lastModified,
        segments: this.segments
      };
      fs.writeFileSync(this.getMetaPath(), JSON.stringify(meta, null, 2), 'utf8');
    } catch (e) {}
  }

  saveMetadata() {
    return this.saveMeta();
  }

  checkCompletion() {
    this.updateDownloadedBytes();
    const isAllComplete = this.segments.every(s => s.completed || s.current > s.end);
    if (isAllComplete || (this.totalBytes > 0 && this.downloadedBytes >= this.totalBytes)) {
      this.status = 'completed';
      this.stopSpeedMeter();

      if (this.fileDescriptor) {
        try { fs.closeSync(this.fileDescriptor); } catch (e) {}
        this.fileDescriptor = null;
      }

      // Rename from .adm_download to final clean filename
      const incPath = this.getIncompleteFilePath();
      const finalPath = this.getFilePath();
      if (fs.existsSync(incPath)) {
        try {
          if (fs.existsSync(finalPath)) {
            try { fs.unlinkSync(finalPath); } catch (e) {}
          }
          fs.renameSync(incPath, finalPath);
        } catch (e) {
          console.error('[ADM] Error finalizing completed file:', e);
        }
      }

      // Remove resume journal upon successful completion
      const mp1 = this.getMetaPath();
      if (fs.existsSync(mp1)) {
        try { fs.unlinkSync(mp1); } catch (e) {}
      }
      if (this.metaPath && fs.existsSync(this.metaPath) && this.metaPath !== mp1) {
        try { fs.unlinkSync(this.metaPath); } catch (e) {}
      }

      this.downloadedBytes = this.totalBytes || this.downloadedBytes;
      this.emit('status', this.status);
      this.emit('complete', {
        id: this.id,
        filePath: finalPath,
        totalBytes: this.totalBytes || this.downloadedBytes
      });
    }
  }

  startSpeedMeter() {
    this.stopSpeedMeter();
    this.speedTimer = setInterval(() => {
      const now = Date.now();
      // Keep entries from the last 1 second
      this.speedHistory = this.speedHistory.filter(entry => now - entry.time <= 1000);
      const bytesInLastSecond = this.speedHistory.reduce((sum, entry) => sum + entry.bytes, 0);
      this.speed = bytesInLastSecond;

      if (this.speed > this.peakSpeed) {
        this.peakSpeed = this.speed;
      }
      if (this.speed > 0) {
        this.totalSpeedSum += this.speed;
        this.speedSampleCount++;
        this.avgSpeed = Math.round(this.totalSpeedSum / this.speedSampleCount);
      }

      // Record per-interval telemetry sample (up to 600 points)
      this.speedSamples.push(this.speed);
      if (this.speedSamples.length > 600) {
        this.speedSamples.shift();
      }

      if (this.speed > 0 && this.totalBytes > this.downloadedBytes) {
        this.eta = Math.ceil((this.totalBytes - this.downloadedBytes) / this.speed);
      } else {
        this.eta = 0;
      }

      this.emitProgress();
    }, 500);
  }

  stopSpeedMeter() {
    if (this.speedTimer) {
      clearInterval(this.speedTimer);
      this.speedTimer = null;
    }
    this.speed = 0;
  }

  emitProgress() {
    this.updateDownloadedBytes();
    let percent = 0;
    if (this.totalBytes > 0) {
      percent = Math.min(100, Math.max(0, (this.downloadedBytes / this.totalBytes) * 100));
    }
    this.emit('progress', {
      id: this.id,
      downloadedBytes: this.downloadedBytes,
      totalBytes: this.totalBytes,
      percent: Number(percent.toFixed(1)),
      speed: this.speed,
      peakSpeed: this.peakSpeed,
      avgSpeed: this.avgSpeed,
      speedSamples: this.speedSamples,
      eta: this.eta,
      maxConnections: this.maxConnections,
      throttledReason: this.throttledReason,
      segments: this.segments.map(s => ({
        id: s.id,
        start: s.start,
        end: s.end,
        current: s.current,
        percent: s.end > s.start ? Math.min(100, Math.round(((s.current - s.start) / (s.end - s.start)) * 100)) : 100,
        active: s.active,
        completed: s.completed
      }))
    });
  }

  toJSON() {
    this.updateDownloadedBytes();
    const percent = this.totalBytes > 0 ? Math.min(100, Math.max(0, (this.downloadedBytes / this.totalBytes) * 100)) : 0;
    return {
      id: this.id,
      url: this.url,
      fileName: this.fileName,
      savePath: this.savePath,
      filePath: this.getFilePath(),
      category: this.category,
      status: this.status,
      totalBytes: this.totalBytes,
      downloadedBytes: this.downloadedBytes,
      percent: Number(percent.toFixed(1)),
      speed: this.speed,
      peakSpeed: this.peakSpeed,
      avgSpeed: this.avgSpeed,
      speedSamples: this.speedSamples,
      eta: this.eta,
      resumable: this.resumable,
      maxConnections: this.maxConnections,
      throttledReason: this.throttledReason,
      segments: this.segments,
      createdAt: this.createdAt
    };
  }
}


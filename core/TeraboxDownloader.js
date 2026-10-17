import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { DownloadTask } from './DownloadEngine.js';

export class TeraboxDownloader extends EventEmitter {
  constructor(options = {}) {
    super();
    this.id = options.id || Math.random().toString(36).substring(2, 10);
    this.originalUrl = options.url || '';
    this.url = options.url || '';
    this.fileName = options.fileName || 'TeraBox_Download';
    this.savePath = options.savePath || path.join(os.homedir(), 'Downloads');
    this.category = options.category || 'General';
    this.maxConnections = options.maxConnections || 32;
    this.status = 'idle'; // 'idle' | 'probing' | 'downloading' | 'paused' | 'completed' | 'error'
    this.totalBytes = options.totalBytes || 0;
    this.downloadedBytes = options.downloadedBytes || 0;
    this.percent = options.percent || 0;
    this.speed = 0;
    this.peakSpeed = options.peakSpeed || 0;
    this.avgSpeed = options.avgSpeed || 0;
    this.speedSamples = options.speedSamples || [];
    this.eta = 0;
    this.resumable = true;
    this.error = null;
    this.segments = options.segments || [];
    this.engine = null;
    this.resolvedDlink = null;
    this.createdAt = options.createdAt || new Date().toISOString();
  }

  static isTeraboxUrl(url = '') {
    if (!url) return false;
    const lower = url.toLowerCase();
    const domains = [
      'terabox.com', '1024tera.com', 'teraboxapp.com', '1024terabox.com',
      'terabox.app', 'freeterabox.com', 'nephobox.com', '4funbox.com',
      'mirrobox.com', 'momerybox.com', 'tibibox.com', 'dubox.com',
      'terafileshare.com', 'teralinkshare.com'
    ];
    return domains.some(d => lower.includes(d));
  }

  getFilePath() {
    if (this.engine) return this.engine.getFilePath();
    return path.join(this.savePath, this.fileName);
  }

  getMetaPath() {
    if (this.engine) return this.engine.getMetaPath();
    return path.join(this.savePath, `.${this.fileName}.adm.json`);
  }

  async resolveDirectLink() {
    this.status = 'probing';
    this.emit('status', this.status);

    // If it's already a direct CDN link from TeraBox
    if (this.originalUrl.includes('/file/') || this.originalUrl.includes('dlink') || this.originalUrl.includes('cdn.')) {
      this.resolvedDlink = this.originalUrl;
      return { download_link: this.resolvedDlink, file_name: this.fileName };
    }

    // Method 1: Resolve via Python terabox_resolver.py
    try {
      const result = await this.resolveViaPython(this.originalUrl);
      if (result && result.download_link) {
        this.resolvedDlink = result.download_link;
        if (result.file_name) this.fileName = result.file_name;
        if (result.size_bytes) this.totalBytes = result.size_bytes;
        return result;
      }
    } catch (e) {
      console.warn('[TeraboxDownloader] Python resolver warning:', e.message);
    }

    // Method 2: Public High-Availability Gateway Fallback
    try {
      const publicResult = await this.resolveViaPublicApi(this.originalUrl);
      if (publicResult && publicResult.download_link) {
        this.resolvedDlink = publicResult.download_link;
        if (publicResult.file_name) this.fileName = publicResult.file_name;
        if (publicResult.size_bytes) this.totalBytes = publicResult.size_bytes;
        return publicResult;
      }
    } catch (e) {
      console.warn('[TeraboxDownloader] Public API fallback warning:', e.message);
    }

    throw new Error('Unable to extract direct download link from TeraBox. Please ensure link is active or paste direct link.');
  }

  resolveViaPython(url) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'core', 'terabox_resolver.py');
      const proc = spawn('python', [scriptPath, url]);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', chunk => stdout += chunk);
      proc.stderr.on('data', chunk => stderr += chunk);

      proc.on('close', (code) => {
        try {
          // Parse JSON from output
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            if (data.download_link) {
              return resolve(data);
            }
            if (data.error) {
              return reject(new Error(data.error));
            }
          }
          reject(new Error(stderr || 'Python resolver returned invalid output'));
        } catch (e) {
          reject(e);
        }
      });

      proc.on('error', reject);
    });
  }

  async resolveViaPublicApi(url) {
    // Queries lightweight public parsing proxies
    const apis = [
      `https://teraboxapi.com/api?url=${encodeURIComponent(url)}`,
      `https://terabox-dl.qtcloud.workers.dev/api/get-info?url=${encodeURIComponent(url)}`
    ];

    for (const api of apis) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(api, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        clearTimeout(timeout);
        if (res.ok) {
          const json = await res.json();
          if (json.download_link || json.direct_download || json.dlink) {
            return {
              download_link: json.download_link || json.direct_download || json.dlink,
              file_name: json.file_name || json.server_filename || this.fileName,
              size_bytes: json.size_bytes || json.size || 0
            };
          }
        }
      } catch (e) {}
    }
    return null;
  }

  async start() {
    if (this.status === 'downloading') return;

    try {
      if (!this.resolvedDlink) {
        await this.resolveDirectLink();
      }

      if (!this.resolvedDlink) {
        throw new Error('TeraBox direct CDN link could not be resolved.');
      }

      // Initialize high-speed multi-socket DownloadEngine with TeraBox CDN headers
      this.engine = new DownloadTask({
        id: this.id,
        url: this.resolvedDlink,
        fileName: this.fileName,
        savePath: this.savePath,
        category: this.category,
        maxConnections: this.maxConnections || 32,
        headers: {
          'Referer': 'https://www.terabox.app/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      // Forward all events
      this.engine.on('progress', (data) => {
        this.downloadedBytes = data.downloadedBytes;
        this.totalBytes = data.totalBytes;
        this.percent = data.percent;
        this.speed = data.speed;
        this.peakSpeed = data.peakSpeed;
        this.avgSpeed = data.avgSpeed;
        this.speedSamples = data.speedSamples;
        this.eta = data.eta;
        this.segments = data.segments;
        this.emit('progress', this.toJSON());
      });

      this.engine.on('status', (status) => {
        this.status = status;
        this.emit('status', status);
      });

      this.engine.on('complete', (data) => {
        this.status = 'completed';
        this.percent = 100;
        this.speed = 0;
        this.emit('status', 'completed');
        this.emit('complete', { id: this.id, filePath: this.getFilePath() });
      });

      this.engine.on('error', (err) => {
        this.status = 'error';
        this.error = err.message;
        this.emit('status', 'error');
        this.emit('error', err);
      });

      await this.engine.start();
    } catch (err) {
      this.status = 'error';
      this.error = err.message;
      this.emit('status', 'error');
      this.emit('error', err);
    }
  }

  pause() {
    if (this.engine) {
      this.engine.pause();
    } else {
      this.status = 'paused';
      this.emit('status', 'paused');
    }
  }

  resume() {
    if (this.engine) {
      this.engine.resume();
    } else {
      this.start();
    }
  }

  setConcurrency(count) {
    this.maxConnections = Math.max(1, Math.min(64, count));
    if (this.engine) {
      this.engine.setConcurrency(this.maxConnections);
    }
  }

  toJSON() {
    if (this.engine) {
      const data = this.engine.toJSON();
      data.url = this.originalUrl;
      return data;
    }

    return {
      id: this.id,
      url: this.originalUrl,
      fileName: this.fileName,
      savePath: this.savePath,
      filePath: this.getFilePath(),
      category: this.category,
      status: this.status,
      totalBytes: this.totalBytes,
      downloadedBytes: this.downloadedBytes,
      percent: this.percent,
      speed: this.speed,
      peakSpeed: this.peakSpeed,
      avgSpeed: this.avgSpeed,
      speedSamples: this.speedSamples,
      eta: this.eta,
      maxConnections: this.maxConnections || 32,
      resumable: this.resumable,
      error: this.error,
      segments: this.segments,
      createdAt: this.createdAt
    };
  }
}

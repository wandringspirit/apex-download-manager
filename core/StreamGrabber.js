import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { URL } from 'url';
import { execFile } from 'child_process';

// Shared Cloudflare/Google DoH cache so ISP-blocked CDNs (e.g. tiktokcdn.com) resolve once and stream at full speed
const dohCache = new Map(); // hostname -> { ip, expiresAt }
const dohPreferredHosts = new Set(); // hostnames that failed system DNS/connect

export function stripFakeImageHeader(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 600) return buf;
  // Already starts with raw MPEG-TS sync byte (0x47)
  if (buf[0] === 0x47 && buf[188] === 0x47) return buf;
  // Leave fragmented MP4 (fMP4) boxes untouched
  const boxTag = buf.subarray(4, 8).toString('ascii');
  if (boxTag === 'ftyp' || boxTag === 'styp' || boxTag === 'moof') return buf;

  // Scan up to 4KB for 4 consecutive 188-byte MPEG-TS packet sync markers (0x47)
  const limit = Math.min(4096, buf.length - 565);
  for (let i = 1; i < limit; i++) {
    if (
      buf[i] === 0x47 &&
      buf[i + 188] === 0x47 &&
      buf[i + 376] === 0x47 &&
      buf[i + 564] === 0x47
    ) {
      return buf.subarray(i);
    }
  }
  return buf;
}

async function queryDoHProvider(endpointUrl, hostname) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      endpointUrl,
      {
        headers: {
          Accept: 'application/dns-json',
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 5000
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`DoH HTTP ${res.statusCode}`));
        }
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            const aRecord = (json.Answer || []).find((a) => a.type === 1 && a.data);
            if (aRecord && aRecord.data) {
              resolve({ ip: aRecord.data, ttl: Math.max(60, Math.min(600, aRecord.TTL || 300)) });
            } else {
              reject(new Error(`No A record for ${hostname}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('DoH timeout')));
    req.on('error', reject);
  });
}

export async function resolveViaDoH(hostname) {
  const cached = dohCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ip;
  }

  const providers = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
    `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`
  ];

  let lastErr = null;
  for (const url of providers) {
    try {
      const { ip, ttl } = await queryDoHProvider(url, hostname);
      dohCache.set(hostname, { ip, expiresAt: Date.now() + ttl * 1000 });
      return ip;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`DoH resolution failed for ${hostname}`);
}

export class HlsStreamGrabber extends EventEmitter {
  constructor(options) {
    super();
    this.id = options.id || Math.random().toString(36).substring(2, 10);
    this.playlistUrl = options.url;
    this.savePath = options.savePath || path.join(os.homedir(), 'Downloads');
    this.fileName = this.sanitizeFileName(options.fileName || `Stream_${Date.now()}.mp4`);
    if (!path.extname(this.fileName)) {
      this.fileName += '.mp4';
    }
    this.category = options.category || 'Video';
    this.status = 'idle'; // 'idle' | 'parsing' | 'downloading' | 'merging' | 'completed' | 'paused' | 'error'
    this.segments = []; // array of URLs
    this.totalSegments = 0;
    this.downloadedSegments = 0;
    this.failedSegments = 0;
    this.downloadedBytes = 0;
    this.totalBytes = 0;
    this.speed = 0;
    this.peakSpeed = 0;
    this.avgSpeed = 0;
    this.speedSamples = [];
    this.speedHistory = [];
    this.totalSpeedSum = 0;
    this.speedSampleCount = 0;
    this.speedTimer = null;
    this.eta = 0;
    this.concurrency = options.concurrency || 8;
    this.activeWorkers = 0;
    this.tempDir = path.join(this.savePath, `.temp_${this.id}`);
    this.isCancelled = false;
    this.isPaused = false;
    this.error = null;
    this.headers = options.headers || {};
    this.createdAt = options.createdAt || new Date().toISOString();
  }

  sanitizeFileName(name) {
    const base = path.basename(String(name || '').trim());
    const cleaned = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
    return cleaned || `Stream_${Date.now()}.mp4`;
  }

  getFilePath() {
    return path.join(this.savePath, this.fileName);
  }

  getMetaPath() {
    return path.join(this.savePath, `.${this.fileName}.adm.json`);
  }

  buildHeaders(targetUrl) {
    const defaultHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: '*/*'
    };
    return { ...defaultHeaders, ...this.headers };
  }

  requestRaw(url, { useDoH = false, timeoutMs = 12000, redirectCount = 0, onChunk = null } = {}) {
    return new Promise(async (resolve, reject) => {
      if (redirectCount > 5) {
        return reject(new Error('Too many redirects'));
      }

      let parsed;
      try {
        parsed = new URL(url);
      } catch (e) {
        return reject(new Error(`Invalid URL: ${url}`));
      }

      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;
      const headers = this.buildHeaders(url);

      let connectHost = parsed.hostname;
      if (useDoH && isHttps) {
        try {
          connectHost = await resolveViaDoH(parsed.hostname);
          headers.Host = parsed.host;
        } catch (err) {
          return reject(err);
        }
      }

      const reqOptions = {
        hostname: connectHost,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers,
        timeout: timeoutMs
      };
      if (isHttps && connectHost !== parsed.hostname) {
        reqOptions.servername = parsed.hostname;
      }

      const req = client.request(reqOptions, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, url).href;
          res.resume();
          return this.requestRaw(nextUrl, {
            useDoH: dohPreferredHosts.has(new URL(nextUrl).hostname),
            timeoutMs,
            redirectCount: redirectCount + 1,
            onChunk
          })
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} fetching ${parsed.hostname}`));
        }

        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
          if (onChunk) onChunk(chunk.length);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });

      req.on('timeout', () => {
        req.destroy(new Error(`ETIMEDOUT connecting to ${parsed.hostname}`));
      });
      req.on('error', reject);
      req.end();
    });
  }

  async fetchWithDoHFallback(url, { timeoutMs = 12000, onChunk = null } = {}) {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const isHttps = parsed.protocol === 'https:';

    if (isHttps && dohPreferredHosts.has(host)) {
      return this.requestRaw(url, { useDoH: true, timeoutMs, onChunk });
    }

    try {
      return await this.requestRaw(url, { useDoH: false, timeoutMs: Math.min(timeoutMs, 8000), onChunk });
    } catch (err) {
      const msg = String(err && err.message || '');
      const isNetworkOrDnsFailure =
        /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|timeout/i.test(msg) ||
        ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(err && err.code);

      if (isHttps && isNetworkOrDnsFailure) {
        dohPreferredHosts.add(host);
        return this.requestRaw(url, { useDoH: true, timeoutMs, onChunk });
      }
      throw err;
    }
  }

  async fetchText(url) {
    const buf = await this.fetchWithDoHFallback(url, { timeoutMs: 12000 });
    return buf.toString('utf8');
  }

  async parse() {
    this.status = 'parsing';
    this.emit('status', this.status);

    const content = await this.fetchText(this.playlistUrl);
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // Check if master playlist: pick highest bandwidth variant if multiple exist
    const variants = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/i);
        const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
        const nextLine = lines[i + 1];
        if (nextLine && !nextLine.startsWith('#')) {
          variants.push({ bw, uri: nextLine });
        }
      }
    }

    if (variants.length > 0) {
      variants.sort((a, b) => b.bw - a.bw);
      const variantUrl = new URL(variants[0].uri, this.playlistUrl).href;
      return this.parseMediaPlaylist(variantUrl);
    }

    const fallbackVariant = lines.find((l) => !l.startsWith('#') && l.includes('.m3u8'));
    if (fallbackVariant) {
      const variantUrl = new URL(fallbackVariant, this.playlistUrl).href;
      return this.parseMediaPlaylist(variantUrl);
    }

    return this.extractSegments(lines, this.playlistUrl);
  }

  async parseMediaPlaylist(mediaUrl) {
    const content = await this.fetchText(mediaUrl);
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return this.extractSegments(lines, mediaUrl);
  }

  extractSegments(lines, baseUrl) {
    this.segments = [];
    for (const line of lines) {
      if (!line.startsWith('#')) {
        const segUrl = new URL(line, baseUrl).href;
        this.segments.push(segUrl);
      }
    }
    this.totalSegments = this.segments.length;
    return this.segments;
  }

  startSpeedMeter() {
    this.stopSpeedMeter();
    this.speedTimer = setInterval(() => {
      const now = Date.now();
      this.speedHistory = this.speedHistory.filter((entry) => now - entry.time <= 1000);
      this.speed = this.speedHistory.reduce((sum, entry) => sum + entry.bytes, 0);

      if (this.speed > this.peakSpeed) this.peakSpeed = this.speed;
      if (this.speed > 0) {
        this.totalSpeedSum += this.speed;
        this.speedSampleCount++;
        this.avgSpeed = Math.round(this.totalSpeedSum / this.speedSampleCount);
      }
      this.speedSamples.push(this.speed);
      if (this.speedSamples.length > 600) this.speedSamples.shift();

      if (this.downloadedSegments > 0 && this.totalSegments > this.downloadedSegments && this.speed > 0) {
        const avgSegBytes = this.downloadedBytes / this.downloadedSegments;
        const remainingBytes = avgSegBytes * (this.totalSegments - this.downloadedSegments);
        this.totalBytes = Math.round(avgSegBytes * this.totalSegments);
        this.eta = Math.ceil(remainingBytes / this.speed);
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
    const percent =
      this.totalSegments > 0
        ? Math.min(100, Number(((this.downloadedSegments / this.totalSegments) * 100).toFixed(1)))
        : 0;
    this.emit('progress', {
      id: this.id,
      percent,
      downloadedSegments: this.downloadedSegments,
      totalSegments: this.totalSegments,
      downloadedBytes: this.downloadedBytes,
      totalBytes: this.totalBytes || this.downloadedBytes,
      speed: this.speed,
      peakSpeed: this.peakSpeed,
      avgSpeed: this.avgSpeed,
      speedSamples: this.speedSamples,
      eta: this.eta,
      maxConnections: this.concurrency
    });
  }

  async start() {
    if (this.status === 'downloading') return;
    this.isCancelled = false;
    this.isPaused = false;
    this.error = null;

    try {
      if (this.segments.length === 0) {
        await this.parse();
      }
    } catch (err) {
      this.status = 'error';
      this.error = `Failed to parse HLS playlist: ${err.message}`;
      this.emit('error', new Error(this.error));
      this.emit('status', this.status);
      return;
    }

    if (this.segments.length === 0) {
      this.status = 'error';
      this.error = 'No video segments found in HLS playlist';
      this.emit('error', new Error(this.error));
      this.emit('status', this.status);
      return;
    }

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    this.status = 'downloading';
    this.emit('status', this.status);
    this.startSpeedMeter();

    let nextIndex = 0;
    let mergeStarted = false;

    const downloadNext = async () => {
      if (this.isCancelled || this.isPaused) return;
      if (nextIndex >= this.segments.length) {
        if (this.activeWorkers === 0 && !mergeStarted) {
          mergeStarted = true;
          await this.mergeSegments();
        }
        return;
      }

      const index = nextIndex++;
      const segUrl = this.segments[index];
      const partPath = path.join(this.tempDir, `part_${String(index).padStart(6, '0')}.ts`);

      // Skip already-downloaded segment if resuming from pause
      if (fs.existsSync(partPath)) {
        try {
          const stat = fs.statSync(partPath);
          if (stat.size > 0) {
            this.downloadedSegments++;
            this.emitProgress();
            return downloadNext();
          }
        } catch (_) {}
      }

      this.activeWorkers++;
      try {
        await this.downloadSegmentWithRetry(segUrl, partPath, 3);
        this.downloadedSegments++;
        this.emitProgress();
      } catch (err) {
        this.failedSegments++;
        console.warn(`[ADM HLS] Segment ${index} failed after retries:`, err.message);
      } finally {
        this.activeWorkers--;
        downloadNext();
      }
    };

    // Launch worker pool
    const poolSize = Math.min(this.concurrency, this.segments.length);
    for (let i = 0; i < poolSize; i++) {
      downloadNext();
    }
  }

  async downloadSegmentWithRetry(url, dest, maxAttempts = 3) {
    let lastErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (this.isCancelled || this.isPaused) throw new Error('Cancelled');
      try {
        await this.downloadSegmentFile(url, dest);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 400));
        }
      }
    }
    throw lastErr;
  }

  async downloadSegmentFile(url, dest) {
    const rawBuf = await this.fetchWithDoHFallback(url, {
      timeoutMs: 15000,
      onChunk: (byteLen) => {
        this.downloadedBytes += byteLen;
        this.speedHistory.push({ time: Date.now(), bytes: byteLen });
      }
    });

    if (!rawBuf || rawBuf.length === 0) {
      throw new Error('Empty segment received');
    }

    const cleanBuf = stripFakeImageHeader(rawBuf);
    await fs.promises.writeFile(dest, cleanBuf);
  }

  async mergeSegments() {
    this.stopSpeedMeter();

    if (this.downloadedSegments === 0) {
      this.status = 'error';
      this.error = 'All HLS segments failed to download';
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      } catch (_) {}
      this.emit('error', new Error(this.error));
      this.emit('status', this.status);
      return;
    }

    this.status = 'merging';
    this.emit('status', this.status);

    const finalPath = path.join(this.savePath, this.fileName);
    const tempTsPath = path.join(this.tempDir, `merged_raw_${Date.now()}.ts`);

    try {
      const writeStream = fs.createWriteStream(tempTsPath);
      await new Promise((resolve, reject) => {
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);

        for (let i = 0; i < this.totalSegments; i++) {
          const partPath = path.join(this.tempDir, `part_${String(i).padStart(6, '0')}.ts`);
          if (fs.existsSync(partPath)) {
            const data = fs.readFileSync(partPath);
            writeStream.write(data);
          }
        }
        writeStream.end();
      });

      const finalizeSuccess = () => {
        try {
          fs.rmSync(this.tempDir, { recursive: true, force: true });
        } catch (_) {}

        if (fs.existsSync(finalPath)) {
          try {
            const stat = fs.statSync(finalPath);
            this.totalBytes = stat.size;
            this.downloadedBytes = stat.size;
          } catch (_) {}
        }

        this.status = 'completed';
        this.emit('status', this.status);
        this.emit('complete', { id: this.id, filePath: finalPath, totalBytes: this.totalBytes });
      };

      execFile(
        'ffmpeg',
        ['-y', '-i', tempTsPath, '-c', 'copy', '-movflags', '+faststart', finalPath],
        { windowsHide: true },
        (err) => {
          if (!err && fs.existsSync(finalPath) && fs.statSync(finalPath).size > 0) {
            try {
              fs.unlinkSync(tempTsPath);
            } catch (_) {}
            finalizeSuccess();
          } else {
            // Direct fallback if ffmpeg is missing or failed
            try {
              if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
              fs.renameSync(tempTsPath, finalPath);
            } catch (_) {}
            finalizeSuccess();
          }
        }
      );
    } catch (err) {
      this.status = 'error';
      this.error = `Failed to merge HLS segments: ${err.message}`;
      this.emit('error', new Error(this.error));
      this.emit('status', this.status);
    }
  }

  pause() {
    this.isPaused = true;
    this.stopSpeedMeter();
    this.status = 'paused';
    this.emit('status', this.status);
  }

  cancel() {
    this.isCancelled = true;
    this.stopSpeedMeter();
    this.status = 'paused';
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    } catch (_) {}
    this.emit('status', this.status);
  }

  setConcurrency(newCount) {
    this.concurrency = Math.max(1, Math.min(64, parseInt(newCount, 10) || 8));
  }

  toJSON() {
    const percent =
      this.totalSegments > 0
        ? Math.min(100, Number(((this.downloadedSegments / this.totalSegments) * 100).toFixed(1)))
        : 0;
    return {
      id: this.id,
      url: this.playlistUrl,
      fileName: this.fileName,
      savePath: this.savePath,
      filePath: this.getFilePath(),
      category: this.category,
      status: this.status,
      error: this.error,
      totalBytes: this.totalBytes || this.downloadedBytes,
      downloadedBytes: this.downloadedBytes,
      percent,
      speed: this.speed,
      peakSpeed: this.peakSpeed,
      avgSpeed: this.avgSpeed,
      speedSamples: this.speedSamples,
      eta: this.eta,
      resumable: true,
      maxConnections: this.concurrency,
      totalSegments: this.totalSegments,
      downloadedSegments: this.downloadedSegments,
      createdAt: this.createdAt
    };
  }
}

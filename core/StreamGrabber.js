import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { URL } from 'url';

export class HlsStreamGrabber extends EventEmitter {
  constructor(options) {
    super();
    this.id = options.id || Math.random().toString(36).substring(2, 10);
    this.playlistUrl = options.url;
    this.savePath = options.savePath || path.join(os.homedir(), 'Downloads');
    this.fileName = options.fileName || `Stream_${Date.now()}.mp4`;
    this.status = 'idle'; // 'idle' | 'parsing' | 'downloading' | 'merging' | 'completed' | 'error'
    this.segments = []; // array of URLs
    this.totalSegments = 0;
    this.downloadedSegments = 0;
    this.downloadedBytes = 0;
    this.concurrency = options.concurrency || 8;
    this.activeWorkers = 0;
    this.tempDir = path.join(this.savePath, `.temp_${this.id}`);
    this.isCancelled = false;
  }

  async fetchText(url) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.fetchText(new URL(res.headers.location, url).href).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  async parse() {
    this.status = 'parsing';
    this.emit('status', this.status);

    const content = await this.fetchText(this.playlistUrl);
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

    // Check if master playlist
    const variantMatch = lines.find(l => !l.startsWith('#') && (l.includes('.m3u8') || l.endsWith('.m3u8')));
    if (variantMatch) {
      // Pick first (usually highest quality) or best stream
      const variantUrl = new URL(variantMatch, this.playlistUrl).href;
      return this.parseMediaPlaylist(variantUrl);
    }

    return this.extractSegments(lines, this.playlistUrl);
  }

  async parseMediaPlaylist(mediaUrl) {
    const content = await this.fetchText(mediaUrl);
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
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

  async start() {
    if (this.status === 'downloading') return;
    this.status = 'downloading';
    this.emit('status', this.status);

    if (this.segments.length === 0) {
      await this.parse();
    }

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    let nextIndex = 0;
    const downloadNext = async () => {
      if (this.isCancelled) return;
      if (nextIndex >= this.segments.length) {
        if (this.activeWorkers === 0) {
          await this.mergeSegments();
        }
        return;
      }

      const index = nextIndex++;
      const segUrl = this.segments[index];
      const partPath = path.join(this.tempDir, `part_${String(index).padStart(6, '0')}.ts`);

      this.activeWorkers++;
      try {
        await this.downloadSegmentFile(segUrl, partPath);
        this.downloadedSegments++;
        const percent = Number(((this.downloadedSegments / this.totalSegments) * 100).toFixed(1));
        this.emit('progress', {
          id: this.id,
          percent,
          downloadedSegments: this.downloadedSegments,
          totalSegments: this.totalSegments,
          downloadedBytes: this.downloadedBytes
        });
      } catch (err) {
        // Retry once
        try {
          await this.downloadSegmentFile(segUrl, partPath);
        } catch (e) {}
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

  async downloadSegmentFile(url, dest) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const fileStream = fs.createWriteStream(dest);

      client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        res.pipe(fileStream);
        res.on('data', chunk => this.downloadedBytes += chunk.length);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
  }

  async mergeSegments() {
    this.status = 'merging';
    this.emit('status', this.status);

    const finalPath = path.join(this.savePath, this.fileName);
    const writeStream = fs.createWriteStream(finalPath);

    for (let i = 0; i < this.totalSegments; i++) {
      const partPath = path.join(this.tempDir, `part_${String(i).padStart(6, '0')}.ts`);
      if (fs.existsSync(partPath)) {
        const data = fs.readFileSync(partPath);
        writeStream.write(data);
      }
    }

    writeStream.end();

    writeStream.on('finish', () => {
      // Clean temp dir
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      } catch (e) {}

      this.status = 'completed';
      this.emit('status', this.status);
      this.emit('complete', { id: this.id, filePath: finalPath });
    });
  }

  cancel() {
    this.isCancelled = true;
    this.status = 'paused';
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    } catch (e) {}
    this.emit('status', this.status);
  }

  setConcurrency(newCount) {
    this.concurrency = Math.max(1, Math.min(64, parseInt(newCount, 10) || 8));
  }
}


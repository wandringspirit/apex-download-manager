import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUNDLED_BIN_DIR = path.resolve(__dirname, '..', 'bin');

export class YoutubeDownloader extends EventEmitter {
  constructor(options) {
    super();
    this.id = options.id || Math.random().toString(36).substring(2, 10);
    this.url = options.url;
    this.savePath = options.savePath || path.join(os.homedir(), 'Downloads');
    this.fileName = options.fileName || 'YouTube_Video.mp4';
    this.category = 'Video';
    this.status = 'idle'; // 'idle' | 'probing' | 'downloading' | 'completed' | 'error' | 'paused'
    this.totalBytes = 0;
    this.downloadedBytes = 0;
    this.percent = 0;
    this.speed = 0;
    this.peakSpeed = options.peakSpeed || 0;
    this.avgSpeed = options.avgSpeed || 0;
    this.speedSamples = options.speedSamples || [];
    this.totalSpeedSum = 0;
    this.speedSampleCount = 0;
    this.eta = 0;
    this.resumable = true;
    this.maxConnections = options.maxConnections || 32;
    this.segments = [];
    this.process = null;
    this.createdAt = options.createdAt || new Date().toISOString();
  }

  getFilePath() {
    return path.join(this.savePath, this.fileName);
  }

  async probe() {
    this.status = 'probing';
    this.emit('status', this.status);

    return new Promise((resolve) => {
      // Query title and metadata using yt-dlp json dump
      const proc = spawn('python', ['-m', 'yt_dlp', '--js-runtimes', 'node', '--dump-json', '--no-playlist', this.url]);
      let stdout = '';

      proc.stdout.on('data', chunk => stdout += chunk);

      proc.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const info = JSON.parse(stdout);
            const title = info.title ? info.title.replace(/[\\/:*?"<>|]/g, '').trim() : 'YouTube_Video';
            this.fileName = `${title}.mp4`;
            this.totalBytes = info.filesize || info.filesize_approx || 0;
          } catch (e) {}
        }
        resolve({ fileName: this.fileName, totalBytes: this.totalBytes });
      });

      proc.on('error', () => {
        resolve({ fileName: this.fileName, totalBytes: this.totalBytes });
      });
    });
  }

  async start() {
    if (this.status === 'downloading') return;

    if (!fs.existsSync(this.savePath)) {
      fs.mkdirSync(this.savePath, { recursive: true });
    }

    this.status = 'downloading';
    this.emit('status', this.status);

    // Command to download best progressive mp4 or best available format
    const outputTemplate = path.join(this.savePath, '%(title)s.%(ext)s');

    // Multi-threaded fragment acceleration args with YouTube throttle bypass
    const args = [
      '-m', 'yt_dlp',
      '--js-runtimes', 'node',
      '--extractor-args', 'youtube:player_client=android,ios,web',
      '--http-chunk-size', '10M',
      '--buffer-size', '16M',
      '--newline',
      '--no-playlist',
      '-N', '32', // 32 concurrent connection threads (Max Saturation)!
      '-f', 'bestvideo+bestaudio/best',
      '--merge-output-format', 'mp4'
    ];

    const ffmpegExe = path.join(BUNDLED_BIN_DIR, 'ffmpeg.exe');
    if (fs.existsSync(ffmpegExe)) {
      args.push('--ffmpeg-location', BUNDLED_BIN_DIR);
    }

    args.push('-o', outputTemplate, this.url);

    this.process = spawn('python', args);

    this.process.stdout.on('data', (data) => {
      const line = data.toString();

      // Parse yt-dlp progress output: [download]  45.2% of  120.50MiB at  8.50MiB/s ETA 00:08
      const percentMatch = line.match(/(\d+\.?\d*)%/);
      if (percentMatch) {
        this.percent = parseFloat(percentMatch[1]);
      }

      // Parse total file size
      const sizeMatch = line.match(/of\s+~?\s*([0-9.]+\s*[KMG]i?B)/i);
      if (sizeMatch) {
        this.totalBytes = this.parseSize(sizeMatch[1]);
        if (this.totalBytes > 0 && this.percent > 0) {
          this.downloadedBytes = Math.round((this.totalBytes * this.percent) / 100);
        }
      }

      const speedMatch = line.match(/at\s+([0-9.]+[KMG]i?B\/s)/i);
      if (speedMatch) {
        this.speed = this.parseSpeed(speedMatch[1]);
        if (this.speed > this.peakSpeed) this.peakSpeed = this.speed;
        if (this.speed > 0) {
          this.totalSpeedSum += this.speed;
          this.speedSampleCount++;
          this.avgSpeed = Math.round(this.totalSpeedSum / this.speedSampleCount);
          this.speedSamples.push(this.speed);
          if (this.speedSamples.length > 600) this.speedSamples.shift();
        }
      }

      const etaMatch = line.match(/ETA\s+(\d+):(\d+)/);
      if (etaMatch) {
        this.eta = parseInt(etaMatch[1], 10) * 60 + parseInt(etaMatch[2], 10);
      }

      const destMatch = line.match(/\[download\] Destination: (.+)/);
      if (destMatch && destMatch[1]) {
        this.fileName = path.basename(destMatch[1].trim());
      }

      this.emitProgress();
    });

    this.process.stderr.on('data', () => {});

    this.process.on('close', (code) => {
      this.process = null;
      if (code === 0) {
        this.status = 'completed';
        this.percent = 100;
        this.speed = 0;
        this.eta = 0;

        // Verify and attach exact file size from disk
        try {
          const directPath = this.getFilePath();
          if (fs.existsSync(directPath)) {
            const stat = fs.statSync(directPath);
            this.totalBytes = stat.size;
            this.downloadedBytes = stat.size;
          } else {
            // Find newly written file with matching title
            const files = fs.readdirSync(this.savePath);
            const baseName = this.fileName.replace(/\.[^/.]+$/, "");
            const match = files.find(f => f.includes(baseName));
            if (match) {
              this.fileName = match;
              const stat = fs.statSync(path.join(this.savePath, match));
              this.totalBytes = stat.size;
              this.downloadedBytes = stat.size;
            }
          }
        } catch (e) {}

        this.emitProgress();
        this.emit('status', this.status);
        this.emit('complete', { id: this.id, filePath: this.getFilePath() });
      } else if (this.status !== 'paused') {
        this.status = 'error';
        this.emit('status', this.status);
      }
    });
  }

  parseSize(str) {
    const num = parseFloat(str);
    if (/G/i.test(str)) return Math.round(num * 1024 * 1024 * 1024);
    if (/M/i.test(str)) return Math.round(num * 1024 * 1024);
    if (/K/i.test(str)) return Math.round(num * 1024);
    return Math.round(num);
  }

  parseSpeed(str) {
    const num = parseFloat(str);
    if (/G/i.test(str)) return num * 1024 * 1024 * 1024;
    if (/M/i.test(str)) return num * 1024 * 1024;
    if (/K/i.test(str)) return num * 1024;
    return num;
  }

  pause() {
    if (this.process) {
      this.status = 'paused';
      this.process.kill('SIGTERM');
      this.process = null;
      this.emit('status', this.status);
    }
  }

  emitProgress() {
    const downloaded = this.totalBytes ? Math.round((this.totalBytes * this.percent) / 100) : 0;
    const numSegments = Math.max(1, this.maxConnections || 32);
    const total = this.totalBytes || 100;
    const chunkSize = Math.max(1, Math.floor(total / numSegments));
    
    const segments = Array.from({ length: numSegments }, (_, i) => {
      const segStart = i * chunkSize;
      const segEnd = (i === numSegments - 1) ? total - 1 : (segStart + chunkSize - 1);
      let segCurrent = segStart;
      let completed = false;
      let active = false;

      if (this.percent >= 100 || this.status === 'completed') {
        segCurrent = segEnd + 1;
        completed = true;
      } else if (downloaded >= segEnd) {
        segCurrent = segEnd + 1;
        completed = true;
      } else if (downloaded > segStart) {
        segCurrent = Math.min(segEnd, downloaded);
        active = this.status === 'downloading';
      }

      return {
        id: i,
        start: segStart,
        end: segEnd,
        current: segCurrent,
        active,
        completed
      };
    });

    this.emit('progress', {
      id: this.id,
      downloadedBytes: downloaded,
      totalBytes: this.totalBytes,
      percent: this.percent,
      speed: this.speed,
      peakSpeed: this.peakSpeed,
      avgSpeed: this.avgSpeed,
      speedSamples: this.speedSamples,
      eta: this.eta,
      maxConnections: this.maxConnections || 32,
      segments
    });
  }

  toJSON() {
    const numSegments = Math.max(1, this.maxConnections || 32);
    const total = this.totalBytes || 100;
    const chunkSize = Math.max(1, Math.floor(total / numSegments));
    const segments = Array.from({ length: numSegments }, (_, i) => {
      const segStart = i * chunkSize;
      const segEnd = (i === numSegments - 1) ? total - 1 : (segStart + chunkSize - 1);
      const isDone = this.percent >= 100 || this.status === 'completed';
      return {
        id: i,
        start: segStart,
        end: segEnd,
        current: isDone ? segEnd + 1 : segStart,
        active: false,
        completed: isDone
      };
    });

    return {
      id: this.id,
      url: this.url,
      fileName: this.fileName,
      savePath: this.savePath,
      filePath: this.getFilePath(),
      category: 'Video',
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
      resumable: true,
      segments,
      createdAt: this.createdAt
    };
  }

  setConcurrency(newCount) {
    this.maxConnections = Math.max(1, Math.min(64, parseInt(newCount, 10) || 32));
    this.emitProgress();
  }
}



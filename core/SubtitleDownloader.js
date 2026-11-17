import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { URL } from 'url';
import { execFile } from 'child_process';
import { resolveViaDoH } from './StreamGrabber.js';

function normalizeVttTime(raw) {
  const clean = String(raw || '').trim().replace(',', '.');
  const parts = clean.split(':');
  let h = '00', m = '00', sMs = '00.000';
  if (parts.length === 3) {
    [h, m, sMs] = parts;
  } else if (parts.length === 2) {
    [m, sMs] = parts;
  } else {
    return null;
  }
  const [sec, msRaw = '000'] = sMs.split('.');
  const hh = String(parseInt(h, 10) || 0).padStart(2, '0');
  const mm = String(parseInt(m, 10) || 0).padStart(2, '0');
  const ss = String(parseInt(sec, 10) || 0).padStart(2, '0');
  const ms = msRaw.padEnd(3, '0').slice(0, 3);
  return `${hh}:${mm}:${ss},${ms}`;
}

export function vttToSrt(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return '';
  const cleaned = rawContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // If already standard SRT (no WEBVTT header and uses comma timestamps), return normalized SRT
  if (!/^\s*WEBVTT/i.test(cleaned) && /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(cleaned)) {
    return cleaned.trim().replace(/\n/g, '\r\n') + '\r\n';
  }

  const blocks = cleaned.split(/\n{2,}/);
  const cues = [];
  let index = 1;

  for (const rawBlock of blocks) {
    const lines = rawBlock.split('\n').map(l => l.trimEnd());
    if (lines.length === 0) continue;

    const first = lines[0].trim();
    if (!first || /^WEBVTT/i.test(first) || /^(NOTE|STYLE|REGION)\b/i.test(first)) {
      continue;
    }

    // Locate the timing line (may be line 0 or line 1 if cue identifier precedes it)
    const timingIdx = lines.findIndex(l => l.includes('-->'));
    if (timingIdx === -1) continue;

    const timingLine = lines[timingIdx];
    const match = timingLine.match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
    if (!match) continue;

    const start = normalizeVttTime(match[1]);
    const end = normalizeVttTime(match[2]);
    if (!start || !end) continue;

    const textLines = lines
      .slice(timingIdx + 1)
      .map(l =>
        l
          // Remove VTT class/voice/ruby tags like <c.color>, <v Speaker>, <00:01:02.000> while keeping <i>/<b>/<u>
          .replace(/<\/?(?:c(?:\.[^>\s]+)?|v(?:\s+[^>]*)?|lang(?:\s+[^>]*)?|ruby|rt)\b[^>]*>/gi, '')
          .replace(/<\d{1,2}:\d{2}(?::\d{2})?\.\d{3}>/g, '')
          .trim()
      )
      .filter(Boolean);

    if (textLines.length === 0) continue;

    cues.push(`${index}\r\n${start} --> ${end}\r\n${textLines.join('\r\n')}`);
    index++;
  }

  return cues.join('\r\n\r\n') + (cues.length > 0 ? '\r\n' : '');
}

export class SubtitleDownloader extends EventEmitter {
  constructor(options) {
    super();
    this.id = options.id || Math.random().toString(36).substring(2, 10);
    this.url = options.url;
    this.savePath = options.savePath || path.join(os.homedir(), 'Downloads');
    this.fileName = this.ensureSrtFileName(options.fileName || `Subtitles_${Date.now()}.srt`);
    this.category = 'Documents';
    this.status = 'idle';
    this.totalBytes = 0;
    this.downloadedBytes = 0;
    this.speed = 0;
    this.peakSpeed = 0;
    this.avgSpeed = 0;
    this.speedSamples = [];
    this.eta = 0;
    this.resumable = false;
    this.maxConnections = 1;
    this.error = null;
    this.headers = options.headers || {};
    this.createdAt = options.createdAt || new Date().toISOString();
  }

  ensureSrtFileName(name) {
    const base = path.basename(String(name || '').trim()).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
    const withoutExt = base.replace(/\.(mp4|mkv|webm|mov|avi|vtt|srt|ass|ssa)$/i, '');
    return `${withoutExt || 'Subtitles'}.srt`;
  }

  getFilePath() {
    return path.join(this.savePath, this.fileName);
  }

  getMetaPath() {
    return path.join(this.savePath, `.${this.fileName}.adm.json`);
  }

  requestText(url, { useDoH = false, redirectCount = 0 } = {}) {
    return new Promise(async (resolve, reject) => {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));
      let parsed;
      try {
        parsed = new URL(url);
      } catch (e) {
        return reject(new Error(`Invalid subtitle URL: ${url}`));
      }

      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
        ...this.headers
      };

      let connectHost = parsed.hostname;
      if (useDoH && isHttps) {
        connectHost = await resolveViaDoH(parsed.hostname);
        headers.Host = parsed.host;
      }

      const reqOpts = {
        hostname: connectHost,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers,
        timeout: 10000
      };
      if (isHttps && connectHost !== parsed.hostname) {
        reqOpts.servername = parsed.hostname;
      }

      const req = client.request(reqOpts, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, url).href;
          res.resume();
          return this.requestText(nextUrl, { useDoH: false, redirectCount: redirectCount + 1 })
            .then(resolve)
            .catch(reject);
        }
        if (res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} downloading subtitle`));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      });

      req.on('timeout', () => req.destroy(new Error('Subtitle download timeout')));
      req.on('error', reject);
      req.end();
    });
  }

  async fetchSubtitleText() {
    try {
      return await this.requestText(this.url, { useDoH: false });
    } catch (err) {
      const isNetworkErr = /timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND/i.test(String(err.message || err.code || ''));
      if (isNetworkErr && this.url.startsWith('https://')) {
        return await this.requestText(this.url, { useDoH: true });
      }
      throw err;
    }
  }

  async start() {
    if (this.status === 'downloading') return;
    this.status = 'downloading';
    this.error = null;
    this.emit('status', this.status);

    try {
      if (!fs.existsSync(this.savePath)) {
        fs.mkdirSync(this.savePath, { recursive: true });
      }

      const rawText = await this.fetchSubtitleText();
      if (!rawText || rawText.trim().length === 0) {
        throw new Error('Subtitle file was empty');
      }

      const finalPath = this.getFilePath();
      const isAss = /\.(ass|ssa)(\?|$)/i.test(this.url) || /^\[Script Info\]/i.test(rawText.trim());

      if (isAss) {
        const tempAss = path.join(os.tmpdir(), `adm_sub_${this.id}.ass`);
        await fs.promises.writeFile(tempAss, rawText, 'utf8');
        await new Promise((resolve) => {
          execFile('ffmpeg', ['-y', '-i', tempAss, finalPath], { windowsHide: true }, async (err) => {
            try { fs.unlinkSync(tempAss); } catch (_) {}
            if (err || !fs.existsSync(finalPath)) {
              // Fallback: write raw text if ffmpeg conversion fails
              await fs.promises.writeFile(finalPath, rawText, 'utf8');
            }
            resolve();
          });
        });
      } else {
        const srtContent = vttToSrt(rawText);
        await fs.promises.writeFile(finalPath, srtContent || rawText, 'utf8');
      }

      const stat = fs.statSync(finalPath);
      this.totalBytes = stat.size;
      this.downloadedBytes = stat.size;
      this.status = 'completed';

      this.emit('progress', {
        id: this.id,
        downloadedBytes: this.downloadedBytes,
        totalBytes: this.totalBytes,
        percent: 100,
        speed: this.totalBytes,
        eta: 0
      });
      this.emit('status', this.status);
      this.emit('complete', { id: this.id, filePath: finalPath, totalBytes: this.totalBytes });
    } catch (err) {
      this.status = 'error';
      this.error = err.message;
      this.emit('error', err);
      this.emit('status', this.status);
    }
  }

  pause() {
    if (this.status === 'downloading') {
      this.status = 'paused';
      this.emit('status', this.status);
    }
  }

  toJSON() {
    const percent = this.status === 'completed' ? 100 : 0;
    return {
      id: this.id,
      url: this.url,
      fileName: this.fileName,
      savePath: this.savePath,
      filePath: this.getFilePath(),
      category: this.category,
      status: this.status,
      error: this.error,
      totalBytes: this.totalBytes,
      downloadedBytes: this.downloadedBytes,
      percent,
      speed: this.speed,
      peakSpeed: this.peakSpeed,
      avgSpeed: this.avgSpeed,
      speedSamples: this.speedSamples,
      eta: this.eta,
      resumable: false,
      maxConnections: 1,
      createdAt: this.createdAt
    };
  }
}

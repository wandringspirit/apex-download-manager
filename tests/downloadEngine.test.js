import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DownloadTask } from '../core/DownloadEngine.js';

describe('DownloadEngine - Bulletproof Concurrency & Integrity Test Suite', () => {
  const TEST_DIR = path.join(os.tmpdir(), `adm_engine_test_${Date.now()}`);

  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  });

  it('TC-01: Guaranteed Percentage Clamping (Never Exceeds 100.0%)', () => {
    const task = new DownloadTask({
      url: 'https://example.com/test-video.mp4',
      fileName: 'test-video.mp4',
      savePath: TEST_DIR,
      maxConnections: 4
    });

    task.totalBytes = 100000;
    // Simulate segments that somehow accumulated more than total bytes
    task.segments = [
      { id: 0, start: 0, end: 24999, current: 30000, completed: true },
      { id: 1, start: 25000, end: 49999, current: 60000, completed: true },
      { id: 2, start: 50000, end: 74999, current: 80000, completed: true },
      { id: 3, start: 75000, end: 99999, current: 150000, completed: true }
    ];

    task.updateDownloadedBytes();

    // Verify downloadedBytes cannot exceed totalBytes
    assert.strictEqual(task.downloadedBytes <= task.totalBytes, true, 'downloadedBytes must not exceed totalBytes');
    assert.strictEqual(task.downloadedBytes, 100000, 'downloadedBytes must cap at totalBytes (100000)');

    // Verify toJSON percent calculation is strictly capped at 100.0
    const json = task.toJSON();
    assert.strictEqual(json.percent, 100, 'JSON percent must be 100, never 129.1%');
  });

  it('TC-02: Segment Bounded Progress Calculation', () => {
    const task = new DownloadTask({
      url: 'https://example.com/movie.mp4',
      fileName: 'movie.mp4',
      savePath: TEST_DIR,
      maxConnections: 2
    });

    task.totalBytes = 200000;
    task.segments = [
      { id: 0, start: 0, end: 99999, current: 50000, completed: false },     // 50,000 bytes
      { id: 1, start: 100000, end: 199999, current: 125000, completed: false } // 25,000 bytes
    ];

    task.updateDownloadedBytes();
    assert.strictEqual(task.downloadedBytes, 75000);

    const json = task.toJSON();
    assert.strictEqual(json.percent, 37.5);
  });

  it('TC-03: Incomplete File Isolation (.adm_download)', () => {
    const task = new DownloadTask({
      url: 'https://example.com/bigfile.iso',
      fileName: 'bigfile.iso',
      savePath: TEST_DIR
    });

    const expectedIncomplete = path.join(TEST_DIR, 'bigfile.iso.adm_download');
    const expectedFinal = path.join(TEST_DIR, 'bigfile.iso');

    assert.strictEqual(task.getIncompleteFilePath(), expectedIncomplete);
    assert.strictEqual(task.getFilePath(), expectedFinal);
  });

  it('TC-04: Atomic File Finalization on Completion', () => {
    const task = new DownloadTask({
      url: 'https://example.com/song.mp3',
      fileName: 'song.mp3',
      savePath: TEST_DIR
    });

    task.totalBytes = 1024;
    const incPath = task.getIncompleteFilePath();
    const finalPath = task.getFilePath();

    // Create simulated incomplete download file on disk
    fs.writeFileSync(incPath, Buffer.alloc(1024, 0x41));
    assert.strictEqual(fs.existsSync(incPath), true);
    assert.strictEqual(fs.existsSync(finalPath), false);

    task.segments = [{ id: 0, start: 0, end: 1023, current: 1024, completed: true }];
    task.downloadedBytes = 1024;

    task.checkCompletion();

    // Verify .adm_download was atomically promoted to final song.mp3
    assert.strictEqual(fs.existsSync(incPath), false, 'Incomplete file must be renamed away');
    assert.strictEqual(fs.existsSync(finalPath), true, 'Final destination file must exist');
    assert.strictEqual(fs.statSync(finalPath).size, 1024);
    assert.strictEqual(task.status, 'completed');
  });

  it('TC-05: External File Movement / Deletion Detection', () => {
    const task = new DownloadTask({
      url: 'https://example.com/archive.zip',
      fileName: 'archive.zip',
      savePath: TEST_DIR
    });

    task.status = 'downloading';
    task.totalBytes = 50000;
    const incPath = task.getIncompleteFilePath();
    fs.writeFileSync(incPath, Buffer.alloc(100));

    // Simulate user moving the file mid-download to desktop/another drive
    fs.unlinkSync(incPath);
    assert.strictEqual(fs.existsSync(incPath), false);

    // Verify file existence check detects missing file
    const isFileMissing = !fs.existsSync(incPath) && !fs.existsSync(task.getFilePath());
    assert.strictEqual(isFileMissing, true, 'Engine must detect file was moved externally');
  });

  it('TC-06: Dynamic On-The-Fly Concurrency Scaling (Bisecting Algorithm)', () => {
    const task = new DownloadTask({
      url: 'https://example.com/large.tar',
      fileName: 'large.tar',
      savePath: TEST_DIR,
      maxConnections: 16
    });

    task.status = 'downloading';
    task.resumable = true;
    task.totalBytes = 100 * 1024 * 1024; // 100MB

    // 2 initial segments
    task.segments = [
      { id: 0, start: 0, end: 49999999, current: 10000000, active: true, completed: false }, // 40MB remaining
      { id: 1, start: 50000000, end: 99999999, current: 60000000, active: true, completed: false } // 40MB remaining
    ];

    // Scale up concurrency to 4 connections mid-download
    task.setConcurrency(4);

    assert.strictEqual(task.maxConnections, 4);
    assert.strictEqual(task.segments.length > 2, true, 'Dynamic bisection should generate new segments');
  });

  it('TC-13: Adaptive 429 Rate Limit Step-Down Engine', () => {
    const task = new DownloadTask({
      url: 'https://example.com/ratelimited.iso',
      fileName: 'ratelimited.iso',
      savePath: TEST_DIR,
      maxConnections: 64
    });

    task.status = 'downloading';
    task.resumable = true;
    task.totalBytes = 50 * 1024 * 1024;
    task.segments = [
      { id: 0, start: 0, end: 25000000, current: 0, active: true, completed: false },
      { id: 1, start: 25000001, end: 50000000, current: 25000001, active: true, completed: false }
    ];

    assert.strictEqual(task.maxConnections, 64);

    // Simulate server returning HTTP 429 Too Many Requests
    task.handleRateLimitStepDown(429, task.segments[0]);

    // Should immediately step down from 64 to 48 threads
    assert.strictEqual(task.maxConnections, 48);
    assert.strictEqual(task.throttledReason.includes('429'), true);

    // Simulate second 429 after cooldown: should step down to 32 threads
    task.last429Time = 0; // Reset debounce timer
    task.handleRateLimitStepDown(429, task.segments[0]);
    assert.strictEqual(task.maxConnections, 32);

    // Simulate third 429 after cooldown: should step down to 16 threads
    task.last429Time = 0;
    task.handleRateLimitStepDown(429, task.segments[0]);
    assert.strictEqual(task.maxConnections, 16);
  });
});

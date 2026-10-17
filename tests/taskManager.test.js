import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TaskManager } from '../core/TaskManager.js';

describe('TaskManager - Lifecycle & Residual Cleanup Test Suite', () => {
  const TEST_DIR = path.join(os.tmpdir(), `adm_task_test_${Date.now()}`);
  const STATE_FILE = path.join(TEST_DIR, 'test_downloads.json');
  let taskManager;

  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    taskManager = new TaskManager({
      storagePath: STATE_FILE,
      maxConcurrent: 2
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch (e) {}
  });

  it('TC-07: Task Registration and State Persistence', async () => {
    const task = await taskManager.addTask({
      url: 'https://example.com/test-doc.pdf',
      fileName: 'test-doc.pdf',
      savePath: TEST_DIR,
      autoStart: false
    });

    assert.strictEqual(taskManager.downloads.has(task.id), true);
    assert.strictEqual(task.fileName, 'test-doc.pdf');
    assert.strictEqual(task.category, 'Documents');

    // Verify persisted state file on disk
    assert.strictEqual(fs.existsSync(STATE_FILE), true);
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].id, task.id);
  });

  it('TC-08: Complete Purge of Residual Files on Delete', async () => {
    const task = await taskManager.addTask({
      url: 'https://example.com/sample-file.zip',
      fileName: 'sample-file.zip',
      savePath: TEST_DIR,
      autoStart: false
    });

    // Create residual files on disk simulating partial downloads
    const metaFile = path.join(TEST_DIR, `.${task.fileName}.adm.json`);
    const incFile = path.join(TEST_DIR, `${task.fileName}.adm_download`);
    const finalFile = path.join(TEST_DIR, task.fileName);

    fs.writeFileSync(metaFile, JSON.stringify({ id: task.id }));
    fs.writeFileSync(incFile, Buffer.alloc(512));
    fs.writeFileSync(finalFile, Buffer.alloc(1024));

    assert.strictEqual(fs.existsSync(metaFile), true);
    assert.strictEqual(fs.existsSync(incFile), true);
    assert.strictEqual(fs.existsSync(finalFile), true);

    // Delete task WITH deleteFile: true
    taskManager.deleteTask(task.id, true);

    // Verify ALL residual files are completely gone from disk
    assert.strictEqual(fs.existsSync(metaFile), false, 'Metadata .adm.json must be deleted');
    assert.strictEqual(fs.existsSync(incFile), false, 'Incomplete .adm_download must be deleted');
    assert.strictEqual(fs.existsSync(finalFile), false, 'Final target file must be deleted when deleteFile=true');
    assert.strictEqual(taskManager.downloads.has(task.id), false);
  });

  it('TC-09: Residual Meta Purged Even When deleteFile is False', async () => {
    const task = await taskManager.addTask({
      url: 'https://example.com/kept-file.iso',
      fileName: 'kept-file.iso',
      savePath: TEST_DIR,
      autoStart: false
    });

    const metaFile = path.join(TEST_DIR, `.${task.fileName}.adm.json`);
    const incFile = path.join(TEST_DIR, `${task.fileName}.adm_download`);
    const finalFile = path.join(TEST_DIR, task.fileName);

    fs.writeFileSync(metaFile, JSON.stringify({ id: task.id }));
    fs.writeFileSync(incFile, Buffer.alloc(256));
    fs.writeFileSync(finalFile, Buffer.alloc(1024));

    // Delete task WITHOUT deleting completed file (deleteFile: false)
    taskManager.deleteTask(task.id, false);

    // Metadata & incomplete artifacts must still be purged, but final file preserved
    assert.strictEqual(fs.existsSync(metaFile), false, 'Metadata .adm.json must always be cleaned up');
    assert.strictEqual(fs.existsSync(incFile), false, 'Incomplete buffer must always be cleaned up');
    assert.strictEqual(fs.existsSync(finalFile), true, 'User completed file must be kept');
  });

  it('TC-10: Concurrency API Dispatch', async () => {
    const task = await taskManager.addTask({
      url: 'https://example.com/stream.bin',
      fileName: 'stream.bin',
      savePath: TEST_DIR,
      autoStart: false
    });

    taskManager.setTaskConcurrency(task.id, 64);
    assert.strictEqual(task.maxConnections, 64);

    taskManager.setTaskConcurrency(task.id, 8);
    assert.strictEqual(task.maxConnections, 8);
  });
});

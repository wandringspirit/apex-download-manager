import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import os from 'os';
import { TeraboxDownloader } from '../core/TeraboxDownloader.js';
import { TaskManager } from '../core/TaskManager.js';

describe('TeraboxDownloader - High-Speed Bypass & Multi-Socket Engine', () => {

  it('TC-17: Accurately identifies all TeraBox mirror domains', () => {
    const validDomains = [
      'https://www.terabox.com/s/1abc123xyz',
      'https://1024tera.com/s/1abc123xyz',
      'https://teraboxapp.com/s/1abc123xyz',
      'https://terabox.app/s/1abc123xyz',
      'https://freeterabox.com/s/1abc123xyz',
      'https://1024terabox.com/s/1abc123xyz',
      'https://nephobox.com/s/1abc123xyz',
      'https://4funbox.com/s/1abc123xyz',
      'https://mirrobox.com/s/1abc123xyz',
      'https://dubox.com/s/1abc123xyz'
    ];

    for (const url of validDomains) {
      assert.strictEqual(
        TeraboxDownloader.isTeraboxUrl(url), 
        true, 
        `Expected ${url} to be identified as TeraBox URL`
      );
    }

    const invalidDomains = [
      'https://www.google.com/file.zip',
      'https://github.com/wandringspirit/repo/archive.zip',
      'https://youtube.com/watch?v=12345'
    ];

    for (const url of invalidDomains) {
      assert.strictEqual(
        TeraboxDownloader.isTeraboxUrl(url), 
        false, 
        `Expected ${url} to NOT be identified as TeraBox URL`
      );
    }
  });

  it('TC-18: Properly sets up multi-socket concurrency and default parameters', () => {
    const tb = new TeraboxDownloader({
      url: 'https://1024tera.com/s/1example',
      fileName: 'Antigravity.exe',
      maxConnections: 32
    });

    assert.strictEqual(tb.maxConnections, 32);
    assert.strictEqual(tb.fileName, 'Antigravity.exe');
    assert.strictEqual(tb.status, 'idle');
    assert.strictEqual(tb.resumable, true);

    const json = tb.toJSON();
    assert.strictEqual(json.fileName, 'Antigravity.exe');
    assert.strictEqual(json.maxConnections, 32);
  });

  it('TC-19: TaskManager automatically routes TeraBox links to TeraboxDownloader', async () => {
    const tm = new TaskManager({ storagePath: path.join(os.tmpdir(), `.adm_test_tb_${Date.now()}.json`) });
    
    const task = await tm.addTask({
      url: 'https://1024tera.com/s/1testshare',
      fileName: 'Antigravity.exe',
      autoStart: false
    });

    assert(task instanceof TeraboxDownloader, 'Task should be an instance of TeraboxDownloader');
    assert.strictEqual(task.fileName, 'Antigravity.exe');
  });

});

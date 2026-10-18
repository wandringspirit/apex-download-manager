import path from 'path';
import { fileURLToPath } from 'url';
import { TaskManager } from './core/TaskManager.js';
import { BridgeServer } from './core/BridgeServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('========================================================');
console.log('       APEX DOWNLOAD MANAGER (ADM) - CORE ENGINE        ');
console.log('========================================================');

const taskManager = new TaskManager({
  storagePath: path.join(__dirname, '.adm_tasks.json'),
  maxConcurrent: 5
});

const bridgeServer = new BridgeServer(taskManager, 48911);
bridgeServer.start();

console.log('[ADM] Acceleration Engine initialized.');
console.log('[ADM] Local Bridge listening on http://127.0.0.1:48911');
console.log('[ADM] Ready to intercept Chrome & Edge downloads and video streams.');

// Global resilience handlers to ensure server never crashes from malformed inputs or connection drops
process.on('uncaughtException', (err) => {
  console.error('[ADM Core Error] Uncaught exception safely handled:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ADM Core Error] Unhandled rejection safely handled:', reason);
});


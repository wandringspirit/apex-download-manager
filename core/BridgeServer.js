import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class BridgeServer {
  constructor(taskManager, port = 48911) {
    this.taskManager = taskManager;
    this.port = port;
    this.httpServer = null;
    this.wss = null;
    this.clients = new Set();
  }

  start() {
    this.httpServer = http.createServer((req, res) => {
      // Enable CORS for Chrome Extensions and web clients
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const parsedUrl = new URL(req.url, `http://localhost:${this.port}`);

      // Health check endpoint with dynamic host paths
      if (req.method === 'GET' && parsedUrl.pathname === '/api/status') {
        const homedir = os.homedir();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          name: 'Apex Download Manager Bridge',
          version: '1.0.0',
          activeTasks: this.taskManager.getAllTasks().length,
          extensionPath: path.resolve(process.cwd(), 'extension'),
          downloadsPath: path.join(homedir, 'Downloads'),
          appDir: process.cwd()
        }));
        return;
      }

      // Open Extension Folder Endpoint
      if (req.method === 'POST' && parsedUrl.pathname === '/api/open-extension-folder') {
        const extDir = path.resolve(process.cwd(), 'extension');
        exec(`explorer.exe "${extDir}"`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, path: extDir }));
        return;
      }

      // Add download endpoint (called by browser extension when catching a download)
      if (req.method === 'POST' && (parsedUrl.pathname === '/api/download' || parsedUrl.pathname === '/download')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            if (!data.url) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Missing download URL' }));
            }

            const task = await this.taskManager.addTask({
              url: data.url,
              fileName: data.fileName || '',
              savePath: data.savePath,
              category: data.category,
              autoStart: data.autoStart !== false
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              id: task.id,
              message: 'Download caught successfully by Apex Download Manager',
              task: task.toJSON ? task.toJSON() : task
            }));

            this.broadcast({
              type: 'DOWNLOAD_CAUGHT',
              task: task.toJSON ? task.toJSON() : task
            });
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // Open Folder Endpoint
      if (req.method === 'POST' && parsedUrl.pathname === '/api/open-folder') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { id } = JSON.parse(body);
            this.handleClientAction({ type: 'OPEN_FOLDER', id });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Open File Endpoint
      if (req.method === 'POST' && parsedUrl.pathname === '/api/open-file') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { id } = JSON.parse(body);
            this.handleClientAction({ type: 'OPEN_FILE', id });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Open With Endpoint
      if (req.method === 'POST' && parsedUrl.pathname === '/api/open-with') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { id } = JSON.parse(body);
            this.handleClientAction({ type: 'OPEN_WITH', id });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Delete / Remove Download Endpoint
      if (req.method === 'POST' && (parsedUrl.pathname === '/api/delete' || parsedUrl.pathname === '/api/remove')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { id, deleteFile } = JSON.parse(body);
            this.handleClientAction({ type: 'DELETE_DOWNLOAD', id, deleteFile: !!deleteFile });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Set Concurrency Endpoint
      if (req.method === 'POST' && (parsedUrl.pathname === '/api/set-concurrency' || parsedUrl.pathname === '/api/concurrency')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { id, count } = JSON.parse(body);
            this.handleClientAction({ type: 'SET_CONCURRENCY', id, count });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, count }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Rename task endpoint
      if (req.method === 'POST' && parsedUrl.pathname === '/api/rename') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { id, newName } = JSON.parse(body);
            const success = this.taskManager.renameTask(id, newName);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Set Queue Status endpoint
      if (req.method === 'POST' && parsedUrl.pathname === '/api/queue-status') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { id, inQueue } = JSON.parse(body);
            const success = this.taskManager.setTaskQueueStatus(id, inQueue);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Set Max Concurrent downloads
      if (req.method === 'POST' && parsedUrl.pathname === '/api/set-max-concurrent') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { maxConcurrent } = JSON.parse(body);
            const success = this.taskManager.setMaxConcurrent(maxConcurrent);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Open Default Downloads folder
      if (req.method === 'POST' && parsedUrl.pathname === '/api/open-default-folder') {
        const dDir = path.join(os.homedir(), 'Downloads');
        const p = spawn('explorer.exe', [dDir], { detached: true, stdio: 'ignore' });
        p.unref();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, path: dDir }));
        return;
      }
      // List all downloads
      if (req.method === 'GET' && parsedUrl.pathname === '/api/tasks') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.taskManager.getAllTasks()));
        return;
      }

      // Serve static frontend UI from dist if available
      import('fs').then(fs => {
        import('path').then(path => {
          let filePath = path.join(process.cwd(), 'dist', parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
          if (!fs.existsSync(filePath)) {
            filePath = path.join(process.cwd(), 'dist', 'index.html');
          }
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            const mimeTypes = {
              '.html': 'text/html',
              '.js': 'text/javascript',
              '.css': 'text/css',
              '.svg': 'image/svg+xml',
              '.png': 'image/png'
            };
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            return fs.createReadStream(filePath).pipe(res);
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        });
      });
    });

    // Setup WebSocket Server for real-time bi-directional telemetry
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      // Send initial task list
      ws.send(JSON.stringify({
        type: 'INIT_STATE',
        tasks: this.taskManager.getAllTasks()
      }));

      ws.on('message', async (message) => {
        try {
          const action = JSON.parse(message);
          this.handleClientAction(action, ws);
        } catch (e) {
          console.error('Invalid WebSocket message received:', e);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });

    // Wire task manager events to broadcast
    this.taskManager.on('task:progress', (data) => {
      this.broadcast({ type: 'TASK_PROGRESS', data });
    });

    this.taskManager.on('task:status', (data) => {
      this.broadcast({ type: 'TASK_STATUS', data });
    });

    this.taskManager.on('task:complete', (data) => {
      this.broadcast({ type: 'TASK_COMPLETE', data });
    });

    this.taskManager.on('task:added', (data) => {
      this.broadcast({ type: 'TASK_ADDED', task: data });
    });

    this.taskManager.on('task:deleted', (data) => {
      this.broadcast({ type: 'TASK_DELETED', data });
    });

    this.httpServer.listen(this.port, '127.0.0.1', () => {
      console.log(`[BridgeServer] Apex Download Manager Bridge running on http://127.0.0.1:${this.port}`);
    });
  }

  resolveTaskPath(task) {
    const saveDir = (task && task.savePath && fs.existsSync(task.savePath))
      ? task.savePath
      : path.join(os.homedir(), 'Downloads');

    if (!task) return { filePath: null, saveDir, exists: false };

    let direct = task.getFilePath ? task.getFilePath() : (task.filePath || (task.fileName ? path.join(saveDir, task.fileName) : null));
    if (direct && fs.existsSync(direct)) {
      return { filePath: path.resolve(direct), saveDir, exists: true };
    }

    if (fs.existsSync(saveDir)) {
      try {
        const files = fs.readdirSync(saveDir);
        const baseName = (task.fileName || '').replace(/\.[^/.]+$/, '').trim();
        if (baseName) {
          let match = files.find(f => f.includes(baseName));
          if (!match) {
            const keywords = baseName.replace(/[^a-zA-Z0-9]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
            if (keywords.length > 0) {
              match = files.find(f => {
                const lower = f.toLowerCase();
                return keywords.some(k => lower.includes(k.toLowerCase()));
              });
            }
          }
          if (match) {
            return { filePath: path.resolve(path.join(saveDir, match)), saveDir, exists: true };
          }
        }
      } catch (e) {}
    }

    return { filePath: direct ? path.resolve(direct) : null, saveDir, exists: false };
  }

  handleClientAction(action, ws) {
    switch (action.type) {
      case 'ADD_DOWNLOAD':
        this.taskManager.addTask(action.payload);
        break;
      case 'START_DOWNLOAD':
        this.taskManager.startTask(action.id);
        break;
      case 'PAUSE_DOWNLOAD':
        this.taskManager.pauseTask(action.id);
        break;
      case 'PAUSE_ALL':
        this.taskManager.pauseAll();
        break;
      case 'RESUME_ALL':
        this.taskManager.resumeAll();
        break;
      case 'DELETE_DOWNLOAD':
        this.taskManager.deleteTask(action.id, action.deleteFile);
        break;
      case 'OPEN_FILE': {
        const task = this.taskManager.downloads.get(action.id);
        const { filePath, saveDir, exists } = this.resolveTaskPath(task);
        if (exists && filePath) {
          const p = spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process -FilePath '${filePath.replace(/'/g, "''")}'`], { detached: true, stdio: 'ignore' });
          p.unref();
        } else {
          const p = spawn('explorer.exe', [saveDir], { detached: true, stdio: 'ignore' });
          p.unref();
        }
        break;
      }
      case 'OPEN_WITH': {
        const task = this.taskManager.downloads.get(action.id);
        const { filePath, saveDir, exists } = this.resolveTaskPath(task);
        if (exists && filePath) {
          const p = spawn('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', filePath], { detached: true, stdio: 'ignore' });
          p.unref();
        } else {
          const p = spawn('explorer.exe', [saveDir], { detached: true, stdio: 'ignore' });
          p.unref();
        }
        break;
      }
      case 'OPEN_FOLDER': {
        const task = this.taskManager.downloads.get(action.id);
        const { filePath, saveDir, exists } = this.resolveTaskPath(task);
        if (exists && filePath) {
          const p = spawn('explorer.exe', [`/select,${filePath}`], { detached: true, stdio: 'ignore' });
          p.unref();
        } else {
          const p = spawn('explorer.exe', [saveDir], { detached: true, stdio: 'ignore' });
          p.unref();
        }
        break;
      }
      case 'SET_CONCURRENCY':
        this.taskManager.setTaskConcurrency(action.id, action.count);
        break;
      case 'REDOWNLOAD': {
        const task = this.taskManager.downloads.get(action.id);
        if (task) {
          const url = task.url;
          const fileName = task.fileName;
          this.taskManager.deleteTask(action.id, false);
          this.taskManager.addTask({ url, fileName, autoStart: true });
        }
        break;
      }
      case 'RENAME_TASK':
        this.taskManager.renameTask(action.id, action.newName);
        break;
      case 'SET_QUEUE_STATUS':
        this.taskManager.setTaskQueueStatus(action.id, action.inQueue);
        break;
      case 'SET_MAX_CONCURRENT':
        this.taskManager.setMaxConcurrent(action.maxConcurrent);
        break;
      case 'OPEN_DEFAULT_FOLDER': {
        const dDir = path.join(os.homedir(), 'Downloads');
        const p = spawn('explorer.exe', [dDir], { detached: true, stdio: 'ignore' });
        p.unref();
        break;
      }
      default:
        break;
    }
  }

  broadcast(message) {
    const raw = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  }

  stop() {
    if (this.wss) this.wss.close();
    if (this.httpServer) this.httpServer.close();
  }
}

import { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { TaskManager } from '../core/TaskManager.js';
import { BridgeServer } from '../core/BridgeServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let tray = null;
let taskManager = null;
let bridgeServer = null;

// Ensure single instance lock so old processes don't stack up invisibly
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'extension', 'icons', 'icon128.png');
  const appIcon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null;

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 880,
    minHeight: 560,
    title: 'Apex Download Manager (IDM Pro Edition)',
    icon: appIcon,
    frame: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Load direct from local dist bundle for instantaneous startup, with HTTP fallback
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL('http://127.0.0.1:48911');
  }

  // Keyboard shortcut handlers for F5 (Reload) and F12 (DevTools)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.reload();
      event.preventDefault();
    }
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

// Initialize Backend Engine & Bridge Server if not already running
app.whenReady().then(async () => {
  try {
    const res = await fetch('http://127.0.0.1:48911/api/status', { signal: AbortSignal.timeout(1000) });
    if (!res.ok) throw new Error();
  } catch (e) {
    taskManager = new TaskManager({
      storagePath: path.join(__dirname, '..', '.adm_tasks.json'),
      maxConcurrent: 5
    });

    bridgeServer = new BridgeServer(taskManager, 48911);
    bridgeServer.start();
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  app.quit();
});

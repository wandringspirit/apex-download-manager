import { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain } from 'electron';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { TaskManager } from '../core/TaskManager.js';
import { BridgeServer } from '../core/BridgeServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const startHidden = process.argv.includes('--hidden') || process.argv.includes('--tray');

// Prevent transient network/filesystem stream errors from crashing the Electron desktop app
process.on('uncaughtException', (err) => {
  console.error('[ADM Main] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[ADM Main] Unhandled promise rejection:', reason);
});

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
    showMainWindow();
  });
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow(false);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return tray;
  const icoPath = path.join(__dirname, '..', 'extension', 'icons', 'icon.ico');
  const png48 = path.join(__dirname, '..', 'extension', 'icons', 'icon48.png');
  const png128 = path.join(__dirname, '..', 'extension', 'icons', 'icon128.png');
  const resolvedIcon = [icoPath, png48, png128].find((p) => fs.existsSync(p));
  if (!resolvedIcon) return null;

  const trayIcon = nativeImage.createFromPath(resolvedIcon);
  tray = new Tray(trayIcon);
  tray.setToolTip('Apex Download Manager (Online on port 48911)');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Apex Download Manager', click: () => showMainWindow() },
    {
      label: 'Open Downloads Folder',
      click: () => {
        shell.openPath(path.join(os.homedir(), 'Downloads'));
      }
    },
    { type: 'separator' },
    {
      label: 'Quit ADM (Stops Auto-Catch)',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
  return tray;
}

function createWindow(hidden = false) {
  const iconPath = path.join(__dirname, '..', 'extension', 'icons', 'icon128.png');
  const appIcon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null;

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 880,
    minHeight: 560,
    show: !hidden,
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

  // Hide to Windows system tray on window close so port 48911 stays online for browser auto-catch
  mainWindow.on('close', (event) => {
    if (!app.isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
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

  createTray();
  createWindow(startHidden);

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (app.isQuitting || !tray) {
    app.quit();
  }
});

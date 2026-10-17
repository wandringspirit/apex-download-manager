# Installation & Setup Guide

This guide covers the prerequisites, setup instructions, desktop environment integration, and browser extension deployment for **Apex Download Manager (ADM)** on Windows.

---

## 1. System Requirements

- **Operating System**: Windows 10 or Windows 11 (x64)
- **Node.js**: v18.0.0 or later (LTS recommended)
- **Browser**: Google Chrome, Microsoft Edge, Brave, or any Chromium-based browser (Manifest V3 support)
- **Disk Space**: ~250MB for application files and dependencies

---

## 2. Desktop Application Setup

### Step 1: Clone Repository & Install Dependencies
Open PowerShell or Windows Terminal:
```powershell
git clone https://github.com/wandringspirit/apex-download-manager.git
cd apex-download-manager
npm install
```

### Step 2: Build the Production Frontend
Compile the React 18 user interface using Vite:
```powershell
npm run build
```
This generates the optimized, production assets in `dist/`.

### Step 3: Create Windows Desktop Shortcut (Optional but Recommended)
To create a native Windows desktop shortcut with a high-resolution icon:
```powershell
powershell -ExecutionPolicy Bypass -File .\create-shortcut.ps1
```
This script creates an **Apex Download Manager** shortcut directly on your desktop that launches the background bridge daemon and opens the Electron window cleanly.

---

## 3. Chrome / Edge Extension Installation

The extension enables automatic download interception and floating video stream detection on sites like YouTube, Vimeo, and direct video hosts.

### Step 1: Open Extension Management
- **Google Chrome**: In the address bar, type `chrome://extensions` and press <kbd>Enter</kbd>.
- **Microsoft Edge**: In the address bar, type `edge://extensions` and press <kbd>Enter</kbd>.

### Step 2: Enable Developer Mode
In the top-right corner of the Extensions page, toggle the **Developer mode** switch to **ON**.

### Step 3: Load Unpacked Extension
1. Click the **Load unpacked** button (top-left).
2. Browse to the ADM project directory and select the `extension` folder:
   ```
   C:\Projects\apex-download-manager\extension
   ```
3. Click **Select Folder**.

### Step 4: Verify Extension Status
- The **Apex Download Manager (IDM Pro)** icon will appear in your browser toolbar.
- Click the icon to view extension status:
  - You should see `Bridge Status: Connected (Port 48911)` with a green indicator.

---

## 4. Running the Application

### Option A: Via NPM Scripts
In your terminal:
```powershell
# Starts the background Bridge Server (:48911) + launches Electron window
npm start
```

### Option B: Running Bridge Server Standalone
If you prefer running the background engine as a continuous service without the Electron UI:
```powershell
node server.js
```
The UI can be loaded in any browser at `http://localhost:5173` during dev mode or via the Electron shell.

---

## 5. Troubleshooting & Diagnostics

### Issue 1: Port `48911` Already in Use (`EADDRINUSE`)
If another background daemon is running:
```powershell
# Find process holding port 48911
Get-NetTCPConnection -LocalPort 48911 -ErrorAction SilentlyContinue | Select-Object OwningProcess

# Terminate stale instance
Stop-Process -Id <ProcessId> -Force
```

### Issue 2: Extension Shows "Bridge Offline"
1. Verify that `node server.js` is running.
2. Ensure Windows Defender Firewall has not blocked local loopback (`127.0.0.1`) connections for Node.js.
3. Open `http://127.0.0.1:48911/api/status` in your browser. It should respond with:
   ```json
   {"status":"online","version":"6.42.0","activeDownloads":0}
   ```

### Issue 3: Electron Process Stacking in System Tray
ADM includes a single-instance lock (`app.requestSingleInstanceLock()`). If you accidentally launch multiple instances, the secondary instances will automatically transfer focus to the primary window and terminate immediately.

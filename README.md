# Apex Download Manager (ADM) 6.42 Pro

> **High-Throughput Multi-Connection Download Accelerator & Video Stream Grabber**  
> An open-source, precision-engineered alternative to Internet Download Manager (IDM) with zero ads, real-time transfer telemetry, adaptive HTTP 429 throttling, and full Chrome/Edge browser integration.

---

## ⚡ Key Highlights

- **1–64 Dynamic Bisecting Range Engine**: Slices large files into up to 64 concurrent HTTP/1.1 range segments with zero-copy direct positional file writes (`fs.write`).
- **Real-Time Speed Oscilloscope & Segment Telemetry**: High-density SVG telemetry monitor plotting 200-sample live transfer curves with hairline crosshair metrics.
- **Adaptive HTTP 429 Step-Down Guard**: Detects rate-limited server sockets and dynamically scales thread allocation (e.g. 64 → 48 → 32 → 16) without failing downloads.
- **On-The-Fly Concurrency Slider**: Adjust active thread count during a live download with immediate socket bisecting and no restart required.
- **Manifest V3 Browser Sniffer**: Intercepts browser downloads and floating video player streams (MP4, M3U8, HLS, DASH, TS) with resolution quality badges.
- **Off-Peak Scheduler & Queue Automation**: Automated off-peak queue processing with time window enforcement, sequential concurrency limits, and auto-sleep.
- **Precision Obsidian UI System**: Engineered to Linear/Datadog design standards with calm cobalt blue accents, hairline borders, and `tabular-nums` stability.

---

## 🏛️ Architecture Overview

```mermaid
graph TD
    Browser[Chrome / Edge Browser] -->|Manifest V3 webRequest / DOM Sniffer| Ext[Apex Extension]
    Ext -->|HTTP POST :48911 / WebSocket| Bridge[BridgeServer :48911]
    
    subgraph Core Engine
        Bridge -->|JSON-RPC Events| TM[TaskManager]
        TM -->|Orchestrates| DE[DownloadEngine]
        DE -->|Parallel Sockets 1-64| Remote[Remote HTTP/HTTPS Server]
        DE -->|Zero-Copy Absolute Offset| Disk[Local Storage (.adm_download)]
    end
    
    subgraph UI & Desktop Shell
        Electron[Electron Main Process] -->|Single Instance Lock| Window[BrowserWindow]
        Window -->|Vite / React 18| UI[Precision Instrumentation UI]
        UI -->|WebSocket RPC| Bridge
        UI -->|Speed Curve Telemetry| Oscilloscope[Segment & Speed Visualizer]
    end
```

---

## 📚 Complete Documentation Suite

All system documentation is organized within the [`/docs`](./docs) directory:

| Document | Description |
| :--- | :--- |
| **[Architecture & Engine Internals](./docs/ARCHITECTURE.md)** | Deep-dive into bisecting algorithms, zero-copy I/O, 429 step-down, and Manifest V3 sniffer. |
| **[Installation & Setup Guide](./docs/INSTALLATION.md)** | Prerequisites, background service launch, desktop shortcut, and browser extension install. |
| **[API & Protocol Reference](./docs/API_REFERENCE.md)** | Full specification for WebSocket events, REST endpoints, and internal engine classes. |
| **[User Manual & Features](./docs/USER_GUIDE.md)** | Comprehensive feature walkthrough, shortcuts cheat sheet, scheduler, and queue operations. |
| **[Verification & Testing Suite](./docs/TESTING.md)** | 13 automated test suites covering concurrency, file isolation, atomic commit, and rate limits. |
| **[UI Design System & Tokens](./docs/DESIGN.md)** | Visual design tokens, obsidian surfaces, typography scale, and anti-AI-slop design rules. |

---

## 🚀 Quick Start

### 1. Installation
```bash
git clone https://github.com/wandringspirit/apex-download-manager.git
cd apex-download-manager
npm install
npm run build
```

### 2. Launch
```bash
# Start Bridge Server + Electron Desktop App
npm start
```
Or double-click the desktop shortcut created via `powershell -ExecutionPolicy Bypass -File ./create-shortcut.ps1`.

### 3. Chrome / Edge Extension
1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select `C:\Projects\apex-download-manager\extension`.

---

## 🧪 Testing

Run the native Node.js test suite:
```bash
npm test
```
All 13 test suites execute in < 3 seconds with zero external test runners.

---

## 📄 License
Apex Download Manager is open-source under the [MIT License](LICENSE).

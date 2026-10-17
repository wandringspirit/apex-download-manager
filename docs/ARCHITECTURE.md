# Architecture & Engine Internals

This document provides a comprehensive technical overview of the architecture, algorithms, concurrency models, and network protocols powering **Apex Download Manager (ADM) 6.42 Pro**.

---

## 1. System Topology & Process Boundaries

Apex Download Manager operates across four distinct execution environments communicating over standardized IPC and WebSocket protocols:

```mermaid
flowchart TD
    subgraph Browser["Chrome / Edge Browser (Chromium)"]
        CS["Content Script (content.js)<br/>Floating Grabber Badge & DOM Observer"]
        BG["Extension Service Worker (background.js)<br/>chrome.webRequest & chrome.downloads Listener"]
        CS -->|chrome.runtime.sendMessage| BG
    end

    subgraph Host["Host Operating System (Windows 10/11 x64)"]
        subgraph Bridge["Bridge Daemon (server.js / BridgeServer.js)"]
            WS["WebSocket Server (:48911)"]
            REST["HTTP REST API (:48911)"]
            TM["TaskManager<br/>State Manager & Scheduler"]
            DE["DownloadEngine<br/>Dynamic Bisecting Sockets"]
            WS --- TM
            REST --- TM
            TM --- DE
        end

        subgraph DesktopShell["Electron Desktop Client (electron/main.js)"]
            EMain["Electron Main Process<br/>Single Instance Lock & Window Chrome"]
            Renderer["Electron Renderer (dist/index.html)<br/>React 18 + Vite UI"]
            EMain -->|Loads local bundle| Renderer
        end

        Disk[("Local Storage<br/>~\\Downloads")]
    end

    BG -->|HTTP POST /api/download| REST
    Renderer <-->|WebSocket JSON-RPC ws://127.0.0.1:48911| WS
    DE -->|Zero-Copy fs.write at absolute offset| Disk
    DE -->|Parallel Sockets 1-64 HTTP/1.1 Range| RemoteServer["Remote Content Distribution Network"]
```

### Process Isolation Rationale
- **Bridge Independence**: The `BridgeServer` operates as an independent headless Node.js daemon. If the Electron UI window is closed or refreshed (<kbd>Ctrl+R</kbd>), background downloads continue uninterrupted at full line rate.
- **Single Instance Enforcement**: `electron/main.js` acquires `app.requestSingleInstanceLock()`. Secondary launches focus the primary window and exit immediately, eliminating socket conflicts on port `48911`.

---

## 2. Dynamic Bisecting Range Segmentation Algorithm

Standard download managers allocate a fixed number of segments upfront. If one connection stalls or encounters a slower server thread, the overall download is bottlenecked.

ADM utilizes a **Dynamic Range Bisecting Algorithm**:

```mermaid
sequenceDiagram
    participant TM as TaskManager
    participant DE as DownloadEngine
    participant S1 as Socket #1 (0-50MB)
    participant S2 as Socket #2 (50-100MB)
    participant Disk as Local File (.adm_download)

    TM->>DE: startDownload(concurrency: 2)
    DE->>S1: GET Range: bytes=0-52428799
    DE->>S2: GET Range: bytes=52428800-104857599
    
    Note over S1,S2: Both sockets writing to file concurrently
    S1->>Disk: fs.write(fd, chunk, offset)
    S2->>Disk: fs.write(fd, chunk, offset)

    Note over S1: S1 finishes early at 52.4MB
    DE->>DE: Detect S2 has 30MB remaining
    DE->>DE: Bisect S2 remaining range into S2a (50-65MB) & S3 (65-100MB)
    DE->>S2: Truncate current socket boundary
    DE->>S1: Re-spawn as Socket #3: GET Range: bytes=68157440-104857599
```

### Algorithm Steps:
1. **Probe Phase**: Issues an HTTP `HEAD` request to verify:
   - Server returns `Accept-Ranges: bytes`.
   - Extract exact `Content-Length`.
   - Extract canonical file name from `Content-Disposition` or URL pathname.
2. **Initial Partition**: The file of length $L$ is divided into $N$ equal continuous segments:
   $$\text{Range}_i = \left[ i \cdot \left\lfloor\frac{L}{N}\right\rfloor, (i+1) \cdot \left\lfloor\frac{L}{N}\right\rfloor - 1 \right]$$
3. **Dynamic Bisecting During Runtime**:
   - Every 500ms, the engine surveys active sockets.
   - If user adjusts the thread slider from $M \to K$ ($K > M$), or an idle socket finishes early, the engine locates the active socket with the largest remaining byte delta.
   - The unread portion of that segment is bisected at midpoint $\text{mid} = \text{current} + \lfloor(\text{end} - \text{current}) / 2\rfloor$.
   - A new socket is spawned for $[\text{mid} + 1, \text{end}]$, saturating high-bandwidth connections up to 64 parallel threads.

---

## 3. Zero-Copy Positional Disk I/O

Traditional downloaders write chunks to separate temporary files on disk (e.g. `part1.tmp`, `part2.tmp`) and concatenate them at completion. For a 50GB file, concatenation takes minutes and causes severe disk I/O thrashing.

ADM implements **Zero-Copy Direct Positional Writes**:
1. At task inception, ADM creates a single `.adm_download` target file.
2. It expands or seeks directly to the target length using `fs.open(path, 'w+')`.
3. Incoming TCP network buffers are written directly to their absolute position in the file using positional `fs.write`:
   ```javascript
   fs.write(fileDescriptor, buffer, 0, buffer.length, absoluteByteOffset, callback);
   ```
4. **Zero Reassembly Time**: When all segments reach 100%, the file is already 100% assembled. ADM simply closes the descriptor and executes an atomic `fs.rename` to the final filename.

---

## 4. Adaptive HTTP 429 Step-Down Throttle State Machine

Aggressive multi-threaded downloads risk triggering CDN rate limits (`HTTP 429 Too Many Requests` or `HTTP 503 Service Unavailable`). 

ADM incorporates an automatic step-down state machine:

```mermaid
stateDiagram-v2
    [*] --> HighThroughput: Initial (32 or 64 Threads)
    HighThroughput --> Stable: All Sockets 206 Partial Content
    
    HighThroughput --> Throttled: HTTP 429 / 503 Detected
    Stable --> Throttled: HTTP 429 / 503 Detected
    
    state Throttled {
        StepDown48: Throttle to 48 Threads + 500ms Backoff
        StepDown32: Throttle to 32 Threads + 1000ms Backoff
        StepDown16: Throttle to 16 Threads + 2000ms Backoff
        StepDown8: Throttle to 8 Threads + 4000ms Backoff
        
        StepDown48 --> StepDown32: Subsequent 429
        StepDown32 --> StepDown16: Subsequent 429
        StepDown16 --> StepDown8: Subsequent 429
    }
    
    Throttled --> Stable: Consecutive 200 Successes (Zero Errors)
```

- **Safety Guarantee**: In restrictive environments (e.g., Cloudflare WAF, Akamai Bot Manager), ADM steps down socket concurrency automatically without terminating or corrupting the download.

---

## 5. Manifest V3 Video Sniffer & Stream Detection

The browser extension integrates via Chrome's Manifest V3 standard without running legacy background pages.

### Capture Pipeline:
1. **Network Header Sniffing (`chrome.webRequest`)**:
   - Listens on `onHeadersReceived` for mime-types matching `video/*`, `audio/*`, `application/x-mpegURL`, `application/vnd.apple.mpegurl`, and `application/dash+xml`.
   - Filters out small video fragments (< 1.5MB) to avoid catching ad tracking pixels.
2. **DOM Video Observer (`content.js`)**:
   - Injects a `MutationObserver` inspecting `video` and `audio` elements.
   - Extracts current `.currentSrc` or child `source` URLs.
   - Matches regex patterns for 1080p, 720p, 480p, and audio tracks.
3. **Frosted Glass Floating Pill**:
   - Renders a shadow-DOM isolated button directly on video player overlays (YouTube, Vimeo, Twitter, direct streams).
   - Clicking sends an IPC message to `background.js`, which issues a REST POST to `http://127.0.0.1:48911/api/download`.

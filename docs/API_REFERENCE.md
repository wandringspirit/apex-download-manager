# API & Protocol Reference

This document specifies the internal and external communication interfaces for **Apex Download Manager (ADM) 6.42 Pro**, covering the local HTTP REST API, the WebSocket RPC protocol, and core JavaScript engine interfaces.

---

## 1. Local HTTP REST API (`http://127.0.0.1:48911`)

The Bridge Server exposes local loopback REST endpoints used by the browser extension and shell utilities.

### `GET /api/status`
Returns daemon health, version, download folder, and extension directory paths.
- **Request**: `GET http://127.0.0.1:48911/api/status`
- **Response**:
  ```json
  {
    "status": "online",
    "version": "6.42.0",
    "activeDownloads": 1,
    "extensionPath": "C:\\Projects\\apex-download-manager\\extension",
    "downloadsPath": "C:\\Users\\User\\Downloads"
  }
  ```

---

### `POST /api/download`
Adds a new download caught by the browser extension or external script.
- **Request Body**:
  ```json
  {
    "url": "https://example.com/archive.zip",
    "fileName": "archive.zip",
    "category": "Compressed",
    "maxConnections": 32,
    "autoStart": true,
    "headers": {
      "User-Agent": "Mozilla/5.0 ...",
      "Referer": "https://example.com"
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "taskId": "task_1729182391000",
    "message": "Download task queued"
  }
  ```

---

### `POST /api/open-file`
Opens the downloaded file using the Windows default file association handler (`child_process.execFile`).
- **Request Body**: `{ "id": "task_1729182391000" }`
- **Response**: `{ "success": true }`

---

### `POST /api/open-folder`
Opens the target folder in Windows File Explorer and highlights the file (`explorer.exe /select,"<path>"`).
- **Request Body**: `{ "id": "task_1729182391000" }`
- **Response**: `{ "success": true }`

---

### `POST /api/set-concurrency`
Adjusts the parallel socket thread count for an active download on the fly.
- **Request Body**: `{ "id": "task_1729182391000", "count": 64 }`
- **Response**: `{ "success": true, "maxConnections": 64 }`

---

## 2. WebSocket Real-Time RPC Protocol (`ws://127.0.0.1:48911`)

The Electron UI communicates with the core engine over a low-latency persistent WebSocket connection.

### Server $\to$ Client Broadcast Events

#### `INIT_STATE`
Emitted immediately upon client socket connection. Transmits the full state array of registered tasks:
```json
{
  "type": "INIT_STATE",
  "tasks": [
    {
      "id": "task_1",
      "url": "https://releases.ubuntu.com/24.04/ubuntu-24.04-desktop-amd64.iso",
      "fileName": "ubuntu-24.04-desktop-amd64.iso",
      "status": "downloading",
      "totalBytes": 6050512896,
      "downloadedBytes": 2722730803,
      "speed": 45875200,
      "avgSpeed": 41943040,
      "peakSpeed": 52428800,
      "eta": 72,
      "percent": 45.0,
      "maxConnections": 32,
      "speedSamples": [41000000, 43500000, 45875200],
      "segments": [
        { "id": 0, "start": 0, "end": 189078528, "current": 189078528, "completed": true },
        { "id": 1, "start": 189078529, "end": 378157056, "current": 250000000, "completed": false }
      ]
    }
  ]
}
```

#### `TASK_UPDATED`
Broadcast at 100ms intervals during active transfer. Contains telemetry deltas:
```json
{
  "type": "TASK_UPDATED",
  "task": {
    "id": "task_1",
    "downloadedBytes": 2800000000,
    "speed": 47185920,
    "percent": 46.2,
    "eta": 68
  }
}
```

---

### Client $\to$ Server Command Messages

#### `ADD_TASK`
```json
{
  "type": "ADD_TASK",
  "url": "https://example.com/file.iso",
  "fileName": "file.iso",
  "maxConnections": 32,
  "autoStart": true
}
```

#### `SET_CONCURRENCY`
```json
{
  "type": "SET_CONCURRENCY",
  "id": "task_1",
  "count": 64
}
```

#### `START_QUEUE` / `STOP_QUEUE`
Starts or halts sequential queue processing:
```json
{
  "type": "START_QUEUE"
}
```

---

## 3. Core Engine Classes (`/core`)

### `TaskManager` (`core/TaskManager.js`)
Manages task lifecycles, scheduling queues, persistence to disk, and task prioritization.
- `addTask(options)`: Instantiates a task, probes server headers, and registers in memory.
- `pauseTask(id)`: Gracefully terminates active sockets and saves state to `.adm_tasks.json`.
- `resumeTask(id)`: Reads existing byte boundaries and re-spawns sockets.
- `deleteTask(id, deleteFile = false)`: Terminates sockets, deletes `.adm_meta`, and optionally deletes target file.
- `setTaskConcurrency(id, count)`: Dispatches dynamic socket re-allocation to `DownloadEngine`.

### `DownloadEngine` (`core/DownloadEngine.js`)
Low-level multi-threaded network engine handling socket ranges, buffer writing, and 429 backoff.
- `start()`: Initializes descriptors and triggers socket workers.
- `setConcurrency(newCount)`: Executes on-the-fly range bisecting without stopping active sockets.
- `handleRateLimit(socketId)`: Triggers automatic 429 step-down throttling.
- `writePositional(fd, buffer, offset)`: Zero-copy direct positional write.

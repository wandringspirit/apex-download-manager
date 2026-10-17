# User Manual & Feature Guide

This guide covers all user-facing features, keyboard shortcuts, queue workflows, and visual instrumentation in **Apex Download Manager (ADM) 6.42 Pro**.

---

## 1. Adding & Capturing Downloads

### Method A: Manual URL Entry
1. Press <kbd>Ctrl + N</kbd> or click **Add URL** in the top toolbar.
2. Paste any direct HTTP/HTTPS download link (e.g., ISO, ZIP, MP4, installer).
3. (Optional) Provide a custom file name or leave blank for automatic server header detection.
4. Select desired acceleration sockets:
   - **8 Safe**: Best for strict or low-bandwidth servers.
   - **16 Balanced**: Recommended for standard websites.
   - **32 Default**: Full multi-threaded line saturation for high-speed CDNs.
   - **64 Maximum**: Maximum throughput for multi-gigabit fiber connections.
5. Click **Download Now** to start immediately, or **Add to Queue** to defer.

### Method B: Browser Extension Auto-Catch
- Once the Chrome/Edge extension is loaded, any file download triggered in your browser is automatically intercepted and handed over to ADM.
- Floating video badge: When viewing videos on YouTube, Vimeo, or web video players, a sleek frosted glass badge appears in the corner with available resolutions (`1080p FHD`, `720p HD`, `MP3 Audio`). Click any stream quality to download immediately with full 64-thread acceleration.

---

## 2. Speed Telemetry & Segment Oscilloscope

ADM features an integrated precision oscilloscope plotting your real-time transfer speed curve and range sockets:

- **Opening the Inspector**:
  - Click on any download in the table to display the **Native Bottom Inspector Pane**.
  - Double-click any row or press <kbd>Alt + Enter</kbd> to open the full-screen Inspector Modal.
  - Or click the **Speed Chart** button in the top toolbar.

### Telemetry Readings:
- **CURRENT RATE**: Instantaneous transfer speed calculated over the last 1-second rolling window.
- **PEAK TRANSFER RATE**: The maximum sustained speed achieved during this download session.
- **AVERAGE RATE**: Global mean throughput across all completed and active range partitions.
- **TIME REMAINING**: Real-time dynamically calculated ETA based on remaining unread bytes.
- **Oscilloscope Waveform**: Displays the last 200 speed telemetry samples. Hover anywhere on the chart to inspect exact historical transfer rates at that point in time.

### On-The-Fly Concurrency Slider:
- Drag the **Parallel Sockets** slider during a live download to adjust thread allocation from 1 to 64 sockets on the fly.
- Sockets are dynamically bisected without terminating or restarting the download.

---

## 3. Off-Peak Scheduler & Queue Automation

Automate your downloads during off-peak ISP hours (e.g., midnight to 6 AM):

1. Click **Scheduler** in the top toolbar.
2. In the **Schedule Timers** tab:
   - Toggle **Automated Background Scheduler** to ON.
   - Set **Start queue at** time (e.g., `02:00`).
   - Set **Stop queue at** time (e.g., `06:00`).
   - Choose **Download simultaneous files** (1 file for strict sequential download, up to 10 files).
   - Choose **When queue processing finishes**:
     - *Keep running*: Leaves ADM open.
     - *Exit ADM*: Gracefully terminates the application.
     - *Sleep Computer*: Puts Windows to sleep once all downloads complete.
3. In the **Files in Queue** tab:
   - Review pending queue order.
   - Add paused or idle downloads to the queue with one click.
4. Click **Save & Apply**.

---

## 4. Context Menu & Task Management

Right-click any row in the download table to access precision management actions:
- **Transfer Speed & Telemetry (<kbd>Alt+Enter</kbd>)**: Opens oscilloscope inspector.
- **Open File**: Launches the completed file in its default Windows app.
- **Open With...**: Choose a specific application to open the file.
- **Open Folder**: Opens Windows Explorer and selects the target file.
- **Resume / Pause**: Controls active network workers.
- **Redownload**: Clears existing file residues and restarts from byte 0.
- **Rename**: Safely renames the download and updates disk files.
- **Add to Queue / Remove from Queue**: Toggles queue membership.
- **Delete (<kbd>Del</kbd>)**: Removes task metadata and optionally deletes the downloaded file.

---

## 5. Keyboard Shortcuts Reference

| Shortcut | Function | Context |
| :--- | :--- | :--- |
| <kbd>Ctrl + N</kbd> | Add new download URL | Global |
| <kbd>Alt + Enter</kbd> | Open Speed Chart & Properties Inspector | Download Selected |
| <kbd>Delete</kbd> | Delete selected download | Download Selected |
| <kbd>Ctrl + S</kbd> | Start main download queue | Global |
| <kbd>Ctrl + R</kbd> / <kbd>F5</kbd> | Hot-reload desktop interface | Global |
| <kbd>F12</kbd> | Toggle Developer Tools console | Global |

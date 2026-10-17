# Changelog: Apex Download Manager (ADM)

All notable changes and architectural releases of the Apex Download Manager project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [6.42.0] - 2026-10-17

### 🎨 Precision Instrument UI Overhaul (Anti-"AI Slop" Refactor)
- **Eliminated Rainbow Arcade Palette**: Removed 9 random pastel/neon colors (cyan, magenta, lime, purple) across toolbars, tables, and modal cards.
- **Adopted Precision Obsidian Design Tokens**:
  - Deep canvas base (`#0b0d11`) with elevated neutral surfaces (`#101218`, `#13161c`, `#161922`).
  - Subtle hairline borders (`rgba(255,255,255,0.06)` to `rgba(255,255,255,0.1)`).
  - Single calm cobalt blue accent (`#3b82f6`) for active interactive elements and focus rings.
- **Fixed Percentage Formatting Bug**: Resolved bug in download header where completed or initialized downloads displayed missing percentage strings (`242.89 MB of 242.89 MB • %`). Implemented memoized `percentStr` providing guaranteed tabular decimal precision (`100.0%`).
- **Removed Gimmicky Emojis & Animations**: Stripped away all emojis (`⚡`, `🚀`, `🔥`, `Ultra Turbo Warp`) and removed distracting `animate-ping` dots on static toolbar buttons.
- **Re-engineered Speed Oscilloscope**: Converted the speed visualizer into an SVG waveform monitor with subtle dashed gridlines, tabular axis ticks, and hover crosshair with exact byte/speed labels.
- **Refined Download Table**:
  - Replaced plain text status with hairline micro progress bars (1.5px cobalt bar) and tabular percentages for downloading tasks.
  - Added semantic status dot indicators for Complete (emerald), Paused (amber), Queued (slate), and Error (rose).
  - Cohesive monochrome Lucide icons (`Video`, `Archive`, `Package`, `FileText`, `File`) with `stroke-[1.75]`.
- **Added Native Window Status Bar**: Pinned a native instrument footer bar displaying live bridge status (`127.0.0.1:48911`), active/queued/completed counts, total throughput in real-time tabular numbers, and socket capacity.
- **Standardized Modals**: Updated `AddDownloadModal`, `SchedulerModal`, `SettingsModal`, `AboutModal`, and `ShareModal` to match the obsidian surface system.
- **Architectural Overhaul of Inspector Tabs (Speed Chart vs. Segments)**:
  - Fixed issue where both tabs displayed identical static controls (4 telemetry boxes, progress bar, parallel socket slider) while pushing the actual chart and segments off-screen below the fold.
  - Separated views into dedicated hero panels:
    - **Speed Chart Tab**: Full-height Transfer Rate Waveform Oscilloscope with live SVG curves, dashed gridlines, timeline labels, and interactive mouse-hover inspection crosshairs.
    - **Segments Tab**: Concurrency control bar (slider + 8/16/32/64 presets), IDM-style master file memory map, and multi-socket worker cards grid.
  - Added dynamic multi-socket segment synthesis in `YoutubeDownloader.js` and `SegmentVisualizer.tsx` ensuring multi-thread partition visualization across all downloads.
  - **Fixed 64 Concurrency Revert Bug**: Resolved race condition where selecting 64 sockets immediately reverted back to 1. Replaced unsafe `task.segments.length` fallback in React lifecycle with persistent `useRef` tracking, optimistic local state updates in `App.tsx`, and state persistence in `TaskManager.loadState()`.

### 🚀 Acceleration Engine & Core Architecture
- **64-Thread Dynamic Bisecting Range Engine**:
  - Increased maximum parallel socket allocation from 32 to 64 concurrent HTTP range streams.
  - Slices remaining byte spans on the fly without stopping active downloads.
  - Direct positional disk writes (`fs.write` with absolute file offset) bypassing memory accumulation.
- **Adaptive HTTP 429 Rate-Limit Step-Down**:
  - Automatically intercepts HTTP 429 Too Many Requests responses from restrictive CDNs.
  - Progressively throttles active socket counts (64 → 48 → 32 → 16) with exponential backoff until the download stabilizes.
- **Atomic File Finalization**:
  - Isolated file writes to `.adm_download` and state metadata to `.adm_meta`.
  - Atomically renames incomplete downloads to target file names only upon complete SHA/byte verification.
- **Zero-Residue File Deletion**:
  - Fixed residual metadata leaks when deleting cancelled or completed downloads.

### 🔌 Desktop Shell & Extension Integration
- **Electron Single-Instance Lock**: Added `app.requestSingleInstanceLock()` preventing orphaned invisible Electron processes from stacking in the Windows system tray.
- **Native Window Exit on Close**: Fixed background hanging on window close (`mainWindow.on('closed', () => app.quit())`).
- **Hot-Reload Keyboard Handlers**: Registered global <kbd>F5</kbd> / <kbd>Ctrl+R</kbd> page reloader and <kbd>F12</kbd> DevTools toggle.
- **Manifest V3 Video Grabber Badge**:
  - Redesigned floating badge from retro Windows XP style to modern dark frosted glass (`rgba(15,23,42,0.94)`, `backdrop-filter: blur(14px)`).
  - Added resolution quality tags (`1080p FHD`, `720p HD`, `480p SD`, `MP3 Audio`).
  - **YouTube DOM Persistence & Self-Healing**: Fixed issue where YouTube wipes `#movie_player` innerHTML upon transitioning from buffering to `playing`/`loadeddata`. Implemented reactive event listeners and self-healing attachment logic.
  - **Automated DOM Mutation Tests**: Added TC-14 (`#movie_player` container boundary isolation), TC-15 (DOM re-render detachment self-healing), and TC-16 (user dismissal lifecycle).

---

## [6.41.0] - 2026-10-15

### Added
- Automated off-peak background scheduler with customizable time windows.
- Queue prioritization and sequential concurrency limits (1–10 concurrent queue tasks).
- Automatic post-queue system action (Keep running, Exit ADM, Sleep computer).
- Right-click context menu options: Open Folder, Open With, Rename, Redownload, Properties.
- Native WebSocket RPC bridge server running on port `48911`.

---

## [6.40.0] - 2026-10-12

### Added
- Initial Electron desktop packaging and local bridge integration.
- Manifest V3 Chrome/Edge extension with download interception.
- Basic multi-connection HTTP range download engine with chunk reassembly.
- Categories sidebar with sub-folder filtering (Compressed, Documents, Music, Programs, Video).

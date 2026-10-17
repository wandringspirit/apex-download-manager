# Apex Download Manager (ADM) — Design System (`DESIGN.md`)

## 1. Who We Design For
- **Power Users & Developers**: Download large datasets, ISOs, videos, and multi-gigabyte archives. They want high-density data, precise bandwidth metrics, zero cartoonish AI gimmicks, and fast, predictable controls.
- **Classic IDM Immigrants**: Users who love IDM's legendary 32/64-thread speed and reliability, but despise 1990s Windows XP bloatware and paid trial nags.
- **Context**: Often open alongside code editors, browsers, and terminal windows in dark workspaces.

## 2. Core Principles
1. **Precision Network Instrument, Not a Neon Arcade**:
   - Zero childish emojis (`🔥`, `⚡`, `🚀`), zero glowing neon dropshadows, zero garish rainbow gradients.
   - Quiet, authoritative, engineered: deep neutral dark charcoal, subtle 1px hairline borders, calm cobalt blue accent.
2. **Tabular Numerals & High-Density Hierarchy**:
   - Every number (speed, bytes, ETA, percentage) uses `tabular-nums` so columns never twitch.
   - Clean micro-type hierarchy (10px / 11px / 12px / 14px / 18px).
3. **Calm Chrome, Content First**:
   - Subtle 1px structural separation (`rgba(255, 255, 255, 0.08)`).
   - Speed chart resembles Windows Task Manager / Grafana: precise dotted gridlines, subtle area fill, clean single-hue stroke.
4. **Honest, Plain-English Engineering Terms**:
   - Use "Concurrency: 32 Threads", "Direct Offset I/O", "Rate Limited (HTTP 429 Step-Down)", never "Ultra Turbo Warp".

---

## 3. Visual Tokens

| Token | Dark Value | Usage |
|---|---|---|
| `--bg-canvas` | `#0b0d11` | Application background / window base |
| `--bg-surface` | `#13161c` | Table header, cards, modals, sidebars |
| `--bg-surface-hover`| `#1b1f27` | Row hover, button hover |
| `--bg-surface-active`| `#232834` | Selected item, active toggle |
| `--border-subtle` | `rgba(255, 255, 255, 0.07)` | Dividers, table gridlines |
| `--border-focus` | `rgba(59, 130, 246, 0.45)` | Keyboard focus rings, active inputs |
| `--text-primary` | `#f1f5f9` | File names, primary values, headings |
| `--text-secondary` | `#94a3b8` | Metadata, labels, table subheaders |
| `--text-tertiary` | `#64748b` | Disabled items, timestamp captions |
| `--accent-cobalt` | `#3b82f6` | Active tab, primary button, progress bar |
| `--accent-surface` | `rgba(59, 130, 246, 0.10)` | Active button surface |
| `--status-success` | `#10b981` | Complete status badge, 100% indicator |
| `--status-warning` | `#f59e0b` | Paused status, rate-limited alert |
| `--status-error` | `#ef4444` | Connection failure, abort |

---

## 4. Component Rules
- **Toolbar & Titlebar**: Compact 28px titlebar + 42px toolbar with muted neutral icons (`stroke-width="1.75"`). Clean, aligned, Windows 11 Fluent style.
- **Table**: Compact 24px rows, clear sorting, monospace tabular numbers, smooth subtle row hover.
- **Speed Inspector & Modal**:
  - Top header: File name, file size, exact percentage (e.g. `100.0%` or `45.1%`), quiet tabs.
  - Metrics Grid: 4 clean, flush cards with quiet borders, 10px uppercase labels, 18px clean semibold values (never neon pink/purple).
  - Telemetry Chart: Minimalist line chart with 4 horizontal dashed gridlines, tabular axis labels, and tooltip crosshair.
  - Concurrency Slider: Clean native-feel range input with clean pill selectors `[ 8 ] [ 16 ] [ 32 ] [ 64 ]`.

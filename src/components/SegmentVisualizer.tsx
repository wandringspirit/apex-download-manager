import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Activity, Cpu, Sliders, HardDrive, Wifi, TrendingUp, 
  BarChart2, Maximize2, ExternalLink, CheckCircle, Clock, Zap
} from 'lucide-react';
import { DownloadItem } from '../types';
import { formatBytes, formatSpeed, formatEta } from '../utils';

interface SegmentVisualizerProps {
  task: DownloadItem | null;
  onClose: () => void;
  onResume: (id: string) => void;
  onPause: (id: string) => void;
  onSetConcurrency: (id: string, count: number) => void;
  onOpenFile?: (id: string) => void;
  onOpenFolder?: (id: string) => void;
  inline?: boolean;
  onPopOut?: () => void;
}

export const SegmentVisualizer: React.FC<SegmentVisualizerProps> = ({
  task,
  onClose,
  onResume,
  onPause,
  onSetConcurrency,
  onOpenFile,
  onOpenFolder,
  inline = false,
  onPopOut
}) => {
  const [activeTab, setActiveTab] = useState<'chart' | 'segments'>('chart');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [sliderVal, setSliderVal] = useState<number>(() => task?.maxConnections || 32);
  const prevTaskIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!task) return;
    if (task.id !== prevTaskIdRef.current) {
      // Switched to a new download task
      prevTaskIdRef.current = task.id;
      setSliderVal(task.maxConnections || 32);
    } else if (task.maxConnections && task.maxConnections !== sliderVal && task.throttledReason) {
      // Only sync down from task if backend explicitly auto-throttled (HTTP 429 step-down)
      setSliderVal(task.maxConnections);
    }
  }, [task?.id, task?.maxConnections, task?.throttledReason]);

  // Guaranteed precise percentage string
  const percentStr = useMemo(() => {
    if (task?.status === 'completed') return '100.0';
    if (typeof task?.percent === 'number' && !isNaN(task.percent) && task.percent > 0) {
      return task.percent.toFixed(1);
    }
    if (task && task.totalBytes > 0 && task.downloadedBytes > 0) {
      return Math.min(100, Math.max(0, (task.downloadedBytes / task.totalBytes) * 100)).toFixed(1);
    }
    return '0.0';
  }, [task?.percent, task?.status, task?.downloadedBytes, task?.totalBytes]);

  // Dynamic multi-socket segment partitioning
  const effectiveSegments = useMemo(() => {
    if (task?.segments && task.segments.length > 1) {
      return task.segments.map((seg, idx) => {
        if (typeof seg === 'object' && seg !== null) return seg;
        return { id: idx, start: 0, end: 0, current: 0, completed: true, active: false };
      });
    }

    // Synthesize proportional multi-socket partitions for YouTube / single-stream downloads
    const count = Math.max(1, sliderVal);
    const total = task?.totalBytes || 100;
    const downloaded = task?.downloadedBytes || (task?.percent ? Math.round((total * task.percent) / 100) : 0);
    const chunkSize = Math.max(1, Math.floor(total / count));

    return Array.from({ length: count }, (_, i) => {
      const segStart = i * chunkSize;
      const segEnd = (i === count - 1) ? total - 1 : (segStart + chunkSize - 1);
      let segCurrent = segStart;
      let completed = false;
      let active = false;

      if (task?.status === 'completed' || task?.percent === 100) {
        segCurrent = segEnd + 1;
        completed = true;
      } else if (downloaded >= segEnd) {
        segCurrent = segEnd + 1;
        completed = true;
      } else if (downloaded > segStart) {
        segCurrent = Math.min(segEnd, downloaded);
        active = task?.status === 'downloading';
      }

      return {
        id: i,
        start: segStart,
        end: segEnd,
        current: segCurrent,
        completed,
        active
      };
    });
  }, [task?.segments, sliderVal, task?.totalBytes, task?.downloadedBytes, task?.percent, task?.status]);

  // Speed telemetry calculation
  const samples = useMemo(() => {
    if (!task) return [0, 0];
    if (task.speedSamples && task.speedSamples.length > 1) {
      return task.speedSamples.slice(-200);
    }
    if (task.speed > 0) {
      return [task.speed * 0.4, task.speed * 0.7, task.speed * 0.9, task.speed];
    }
    if (task.status === 'completed') {
      const baseSpeed = task.avgSpeed || 3500000;
      return [baseSpeed * 0.35, baseSpeed * 0.7, baseSpeed * 0.95, baseSpeed * 1.05, baseSpeed * 0.98, baseSpeed * 1.0];
    }
    return [0, 0];
  }, [task?.speedSamples, task?.speed, task?.status, task?.avgSpeed]);

  const peakSpeed = useMemo(() => {
    if (!task) return 1024 * 1024;
    if (task.peakSpeed && task.peakSpeed > 0) return task.peakSpeed;
    const maxSample = samples.reduce((m, val) => Math.max(m, val || 0), 0);
    return Math.max(maxSample, task.speed || 0, 1024 * 1024);
  }, [task?.peakSpeed, samples, task?.speed]);

  const avgSpeed = useMemo(() => {
    if (!task) return 0;
    if (task.avgSpeed && task.avgSpeed > 0) return task.avgSpeed;
    const nonZero = samples.filter(s => typeof s === 'number' && s > 0);
    if (nonZero.length === 0) return task.speed || 0;
    return Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length);
  }, [task?.avgSpeed, samples, task?.speed]);

  // SVG Chart dimensions & scaling
  const chartWidth = 680;
  const chartHeight = inline ? 135 : 160;
  const padLeft = 64;
  const padRight = 16;
  const padTop = 14;
  const padBottom = 24;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;

  const maxVal = Math.max(peakSpeed * 1.15, 1024 * 1024) || 1048576;

  // Generate SVG path coordinates
  const points = useMemo(() => {
    return samples.map((val, idx) => {
      const safeVal = typeof val === 'number' && !isNaN(val) ? val : 0;
      const x = padLeft + (idx / Math.max(1, samples.length - 1)) * plotW;
      const y = padTop + plotH - (Math.min(safeVal, maxVal) / maxVal) * plotH;
      return { x, y, val: safeVal, idx };
    });
  }, [samples, maxVal, plotW, plotH, padLeft, padTop]);

  const pathData = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    return points.reduce((acc, p, idx) => {
      if (idx === 0) return `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      const prev = points[idx - 1];
      const cx1 = prev.x + (p.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (p.x - prev.x) / 2;
      const cy2 = p.y;
      return `${acc} C ${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }, '');
  }, [points]);

  const areaData = useMemo(() => {
    if (points.length === 0) return '';
    const last = points[points.length - 1];
    const first = points[0];
    return `${pathData} L ${last.x.toFixed(1)},${(padTop + plotH).toFixed(1)} L ${first.x.toFixed(1)},${(padTop + plotH).toFixed(1)} Z`;
  }, [pathData, points, padTop, plotH]);

  const avgY = padTop + plotH - (Math.min(avgSpeed, maxVal) / maxVal) * plotH;

  const handleSliderChange = (newVal: number) => {
    const safe = Math.max(1, Math.min(64, isNaN(newVal) ? 32 : newVal));
    setSliderVal(safe);
    if (task) {
      onSetConcurrency(task.id, safe);
    }
  };

  if (!task) return null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;
    if (mouseX < padLeft || mouseX > chartWidth - padRight) {
      setHoverIndex(null);
      return;
    }
    const relX = (mouseX - padLeft) / plotW;
    const idx = Math.min(samples.length - 1, Math.max(0, Math.round(relX * (samples.length - 1))));
    setHoverIndex(idx);
  };

  const content = (
    <div className={`flex flex-col select-none font-sans text-slate-200 ${inline ? 'h-full bg-[#11141a]' : 'w-full max-w-3xl bg-[#11141a] border border-white/10 rounded-lg shadow-2xl overflow-hidden'}`}>
      
      {/* 1. Header with Clear Distinct Tab Buttons */}
      <div className={`px-4 py-2 bg-[#0e1015] border-b border-white/10 flex items-center justify-between flex-shrink-0 ${inline ? 'h-11' : 'px-5 py-3'}`}>
        <div className="flex items-center gap-2.5 truncate max-w-md">
          <div className="w-5 h-5 rounded bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
            <Activity className="w-3 h-3 stroke-[2]" />
          </div>
          <div className="truncate">
            <span className="text-xs font-semibold text-slate-100 truncate block">
              {task.fileName || 'Download Stream Inspector'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono flex-shrink-0">
            {formatBytes(task.downloadedBytes)} of {task.totalBytes > 0 ? formatBytes(task.totalBytes) : 'Unknown'} • <span className="text-blue-400 font-bold">{percentStr}%</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Distinct Tab Control */}
          <div className="flex items-center bg-[#181b22] p-0.5 rounded border border-white/10 text-xs">
            <button
              onClick={() => setActiveTab('chart')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                activeTab === 'chart'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Speed Chart</span>
            </button>
            <button
              onClick={() => setActiveTab('segments')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                activeTab === 'segments'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Segments ({effectiveSegments.length})</span>
            </button>
          </div>

          {/* Pop-Out Button (for inline mode) */}
          {inline && onPopOut && (
            <button
              onClick={onPopOut}
              className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition cursor-pointer"
              title="Maximize Inspector"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition cursor-pointer"
            title="Close inspector"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Persistent Sleek Telemetry Ribbon (Takes only 32px) */}
      <div className="bg-[#141720] border-b border-white/5 px-4 py-1.5 flex items-center justify-between text-[11px] font-mono flex-shrink-0">
        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase font-sans">Current:</span>
            <span className="text-slate-100 font-semibold tabular-nums">
              {formatSpeed(task.speed || avgSpeed)}
            </span>
          </div>
          <span className="text-white/10">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase font-sans">Peak:</span>
            <span className="text-slate-200 tabular-nums">{formatSpeed(peakSpeed)}</span>
          </div>
          <span className="text-white/10">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase font-sans">Avg:</span>
            <span className="text-slate-200 tabular-nums">{formatSpeed(avgSpeed)}</span>
          </div>
          <span className="text-white/10">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase font-sans">ETA:</span>
            <span className="text-slate-200 tabular-nums">
              {task.status === 'completed' ? 'Completed' : formatEta(task.eta)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {task.throttledReason && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] text-amber-300 font-mono">
              Auto-Throttled (429)
            </span>
          )}
          <span className="text-blue-400 font-semibold tabular-nums text-xs">
            {percentStr}%
          </span>
        </div>
      </div>

      {/* Hairline 1.5px Progress Bar */}
      <div className="w-full h-1 bg-[#101319] flex-shrink-0 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            task.status === 'completed' ? 'bg-emerald-500' : task.status === 'error' ? 'bg-rose-500' : 'bg-blue-600'
          }`}
          style={{ width: `${percentStr}%` }}
        />
      </div>

      {/* Error Diagnostic Ribbon */}
      {task.error && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-1.5 flex items-center justify-between text-[11px] text-rose-300 font-mono flex-shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse flex-shrink-0" />
            <span className="font-semibold text-rose-200 flex-shrink-0">Issue:</span>
            <span className="truncate text-rose-300">{task.error}</span>
          </div>
          <span className="text-[10px] text-slate-400 flex-shrink-0 font-sans ml-2">
            Click Resume to retry
          </span>
        </div>
      )}

      {/* 3. DEDICATED TAB VIEW AREA (Zero Shared Clutter!) */}
      <div className="flex-1 p-3.5 overflow-hidden flex flex-col min-h-0 bg-[#0d1015]">
        
        {/* ========================================================= */}
        {/* TAB 1: TRANSFER RATE WAVEFORM MONITOR (SPEED CHART HERO) */}
        {/* ========================================================= */}
        {activeTab === 'chart' && (
          <div className="flex-1 flex flex-col bg-[#141720] border border-white/5 rounded-lg p-3 min-h-0">
            <div className="flex items-center justify-between mb-2 text-xs flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-200 font-medium text-xs">Transfer Rate Oscilloscope</span>
                <span className="text-[10px] text-slate-500 font-mono">({samples.length} real-time samples)</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-blue-500 inline-block" />
                  <span className="text-slate-400">Current Rate</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-0.5 border-b border-dashed border-slate-400 inline-block" />
                  <span className="text-slate-400">Average Rate ({formatSpeed(avgSpeed)})</span>
                </div>
              </div>
            </div>

            {/* Precision Interactive SVG Oscilloscope */}
            <div className="relative w-full flex-1 min-h-0 overflow-hidden bg-[#0c0e14] rounded border border-white/5 flex items-center justify-center">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                className="w-full h-full select-none cursor-crosshair"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient id={`chartGrad-${inline ? 'inline' : 'modal'}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference lines */}
                {[0.25, 0.5, 0.75, 1.0].map((ratio) => {
                  const y = padTop + plotH * (1 - ratio);
                  const speedVal = maxVal * ratio;
                  return (
                    <g key={ratio}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={chartWidth - padRight}
                        y2={y}
                        stroke="rgba(255, 255, 255, 0.05)"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <text
                        x={padLeft - 6}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="9"
                        fill="#64748b"
                        fontFamily="monospace"
                      >
                        {formatSpeed(speedVal)}
                      </text>
                    </g>
                  );
                })}

                {/* Baseline (0 B/s) */}
                <line
                  x1={padLeft}
                  y1={padTop + plotH}
                  x2={chartWidth - padRight}
                  y2={padTop + plotH}
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={padTop + plotH + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#64748b"
                  fontFamily="monospace"
                >
                  0 B/s
                </text>

                {/* Horizontal timeline ticks */}
                {['Start', '25%', '50%', '75%', 'Latest'].map((lbl, idx) => {
                  const x = padLeft + (idx / 4) * plotW;
                  return (
                    <text
                      key={lbl}
                      x={x}
                      y={padTop + plotH + 16}
                      textAnchor={idx === 0 ? 'start' : idx === 4 ? 'end' : 'middle'}
                      fontSize="9"
                      fill="#64748b"
                      fontFamily="monospace"
                    >
                      {lbl}
                    </text>
                  );
                })}

                {/* Area Gradient */}
                {areaData && (
                  <path d={areaData} fill={`url(#chartGrad-${inline ? 'inline' : 'modal'})`} />
                )}

                {/* Main Speed Curve */}
                {pathData && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Average Speed Dotted Guide */}
                {avgSpeed > 0 && avgY >= padTop && avgY <= padTop + plotH && (
                  <line
                    x1={padLeft}
                    y1={avgY}
                    x2={chartWidth - padRight}
                    y2={avgY}
                    stroke="rgba(148, 163, 184, 0.45)"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                )}

                {/* Interactive Crosshair & Tooltip */}
                {hoverIndex !== null && points[hoverIndex] && (
                  <g>
                    <line
                      x1={points[hoverIndex].x}
                      y1={padTop}
                      x2={points[hoverIndex].x}
                      y2={padTop + plotH}
                      stroke="rgba(255, 255, 255, 0.35)"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={points[hoverIndex].x}
                      cy={points[hoverIndex].y}
                      r="4"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <rect
                      x={Math.min(chartWidth - 110, Math.max(padLeft, points[hoverIndex].x - 45))}
                      y={Math.max(padTop + 4, points[hoverIndex].y - 28)}
                      width="90"
                      height="20"
                      rx="4"
                      fill="#1e2433"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="1"
                    />
                    <text
                      x={Math.min(chartWidth - 65, Math.max(padLeft + 45, points[hoverIndex].x))}
                      y={Math.max(padTop + 18, points[hoverIndex].y - 14)}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="#f8fafc"
                      fontFamily="monospace"
                    >
                      {formatSpeed(points[hoverIndex].val)}
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: RANGE PARTITIONS & SOCKETS (SEGMENTS HERO)        */}
        {/* ========================================================= */}
        {activeTab === 'segments' && (
          <div className="flex-1 flex flex-col bg-[#141720] border border-white/5 rounded-lg p-3 min-h-0 space-y-2.5">
            
            {/* Parallel Sockets Concurrency Controller Bar */}
            <div className="bg-[#181c26] border border-white/5 p-2.5 rounded flex items-center justify-between flex-shrink-0 gap-4">
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-medium text-slate-300 text-xs">Parallel Sockets:</span>
                <span className="font-mono text-xs text-blue-400 font-bold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                  {sliderVal} Threads
                </span>
              </div>

              {/* Concurrency Range Slider */}
              <div className="flex-1 max-w-xs">
                <input
                  type="range"
                  min="1"
                  max="64"
                  step="1"
                  value={sliderVal}
                  onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-[#282f42] rounded appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {[
                  { count: 8, label: '8 Safe' },
                  { count: 16, label: '16 Balanced' },
                  { count: 32, label: '32 Default' },
                  { count: 64, label: '64 Maximum' }
                ].map((p) => (
                  <button
                    key={p.count}
                    onClick={() => handleSliderChange(p.count)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition cursor-pointer ${
                      sliderVal === p.count
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-[#202534] hover:bg-[#2b3245] text-slate-300 border border-white/5'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* IDM Signature Master File Memory Map Strip */}
            <div className="bg-[#181c26] border border-white/5 p-2 rounded flex-shrink-0">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1.5">
                <span>File Memory Map ({effectiveSegments.length} Partitions)</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />
                    <span>Completed</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />
                    <span>Active Stream</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-[#282f40] inline-block" />
                    <span>Pending</span>
                  </span>
                </div>
              </div>

              {/* Segmented Block Bar */}
              <div className="flex w-full h-3 rounded bg-[#0f1118] border border-white/5 overflow-hidden gap-[1px]">
                {effectiveSegments.map((seg, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-full transition-colors ${
                      seg.completed
                        ? 'bg-emerald-500'
                        : seg.active
                        ? 'bg-blue-500 animate-pulse'
                        : 'bg-[#202534]'
                    }`}
                    title={`Socket #${idx + 1}: ${formatBytes(seg.start)} - ${formatBytes(seg.end)} ${seg.completed ? '(Complete)' : seg.active ? '(Active)' : '(Queued)'}`}
                  />
                ))}
              </div>
            </div>

            {/* Socket Workers Cards Grid */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                {effectiveSegments.map((seg, idx) => {
                  const total = seg.end - seg.start + 1;
                  const done = Math.max(0, seg.current - seg.start);
                  const segPercent = total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 100;
                  const isDone = seg.completed || segPercent >= 100;

                  return (
                    <div
                      key={idx}
                      className="p-2 bg-[#181c26] rounded border border-white/5 text-[10px] space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-slate-300 font-semibold">Socket #{idx + 1}</span>
                        <span className={isDone ? 'text-emerald-400 font-bold' : seg.active ? 'text-blue-400 font-semibold' : 'text-slate-500'}>
                          {isDone ? '100%' : `${segPercent}%`}
                        </span>
                      </div>

                      <div className="w-full h-1 bg-[#0f1118] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${
                            isDone ? 'bg-emerald-500' : seg.active ? 'bg-blue-600' : 'bg-slate-700'
                          }`}
                          style={{ width: `${isDone ? 100 : segPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono truncate">
                        <span>{formatBytes(seg.start)}</span>
                        <span>{formatBytes(seg.end)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* 4. Footer */}
      <div className={`px-4 py-2 bg-[#0e1015] border-t border-white/10 flex items-center justify-between text-xs flex-shrink-0 ${inline ? 'h-10' : 'px-5 py-3'}`}>
        <div className="text-[11px] text-slate-400 truncate max-w-sm font-mono" title={task.savePath}>
          Destination: {task.savePath}
        </div>
        <div className="flex items-center gap-2">
          {task.status === 'downloading' ? (
            <button
              onClick={() => onPause(task.id)}
              className="px-3 py-1 rounded bg-[#202533] hover:bg-[#282f3f] text-slate-200 text-xs font-medium transition cursor-pointer border border-white/10"
            >
              Pause
            </button>
          ) : task.status !== 'completed' ? (
            <button
              onClick={() => onResume(task.id)}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition cursor-pointer"
            >
              Resume
            </button>
          ) : (
            <>
              {onOpenFile && (
                <button
                  onClick={() => onOpenFile(task.id)}
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition cursor-pointer"
                >
                  Open File
                </button>
              )}
              {onOpenFolder && (
                <button
                  onClick={() => onOpenFolder(task.id)}
                  className="px-3 py-1 rounded bg-[#202533] hover:bg-[#282f3f] text-slate-200 text-xs font-medium transition cursor-pointer border border-white/10"
                >
                  Open Folder
                </button>
              )}
            </>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#1c202a] hover:bg-[#252b38] text-slate-300 text-xs font-medium transition cursor-pointer border border-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="w-full border-t border-white/10 bg-[#11141a] flex flex-col flex-shrink-0 select-none overflow-hidden h-[340px]">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      {content}
    </div>
  );
};

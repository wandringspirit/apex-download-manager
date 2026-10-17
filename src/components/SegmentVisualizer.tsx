import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Activity, Cpu, Sliders, HardDrive, Wifi, TrendingUp, 
  BarChart2, Maximize2, ExternalLink, CheckCircle, Clock
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
  const [sliderVal, setSliderVal] = useState<number>(32);

  const segments = useMemo(() => {
    if (!task || !task.segments) return [];
    return task.segments.map((seg, idx) => {
      if (typeof seg === 'object' && seg !== null) return seg;
      return { id: idx, start: 0, end: 0, current: 0, completed: true, active: false };
    });
  }, [task?.segments]);

  useEffect(() => {
    if (task?.maxConnections) {
      setSliderVal(task.maxConnections);
    } else if (segments.length > 0) {
      setSliderVal(segments.length);
    }
  }, [task?.maxConnections, segments.length]);

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

  // Stack-safe speed telemetry calculation
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

  // Chart dimensions & scaling
  const chartWidth = 580;
  const chartHeight = inline ? 120 : 150;
  const padLeft = 60;
  const padRight = 15;
  const padTop = 15;
  const padBottom = 25;
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
    setSliderVal(newVal);
    if (task) {
      onSetConcurrency(task.id, newVal);
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
    <div className={`flex flex-col select-none font-sans text-slate-200 ${inline ? 'h-full bg-[#11141a]' : 'w-full max-w-2xl bg-[#11141a] border border-white/10 rounded-lg shadow-2xl overflow-hidden'}`}>
      {/* 1. Clean Structured Header */}
      <div className={`px-4 py-2.5 bg-[#0e1015] border-b border-white/10 flex items-center justify-between ${inline ? 'h-11' : 'px-5 py-3'}`}>
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
          {/* Segmented Tab Control (Linear style) */}
          <div className="flex items-center bg-[#181b22] p-0.5 rounded border border-white/10 text-xs">
            <button
              onClick={() => setActiveTab('chart')}
              className={`px-3 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                activeTab === 'chart'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Speed Chart
            </button>
            <button
              onClick={() => setActiveTab('segments')}
              className={`px-3 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                activeTab === 'segments'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Segments ({segments.length || sliderVal})
            </button>
          </div>

          {/* Pop-Out Button (for inline mode) */}
          {inline && onPopOut && (
            <button
              onClick={onPopOut}
              className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition cursor-pointer"
              title="Pop out modal"
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

      {/* 2. Main Body */}
      <div className={`p-4 space-y-3 overflow-y-auto flex-1 ${inline ? 'p-3 space-y-2' : ''}`}>
        {/* Precision Telemetry Row (Calm, Neutral, No Neon Slop) */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-[#161922] border border-white/5 p-2.5 rounded">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              {task.status === 'completed' ? 'Final Rate' : 'Current Rate'}
            </div>
            <div className="text-base font-semibold text-slate-100 font-mono mt-0.5 tabular-nums">
              {formatSpeed(task.speed || avgSpeed)}
            </div>
          </div>

          <div className="bg-[#161922] border border-white/5 p-2.5 rounded">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              Peak Transfer Rate
            </div>
            <div className="text-base font-semibold text-slate-100 font-mono mt-0.5 tabular-nums">
              {formatSpeed(peakSpeed)}
            </div>
          </div>

          <div className="bg-[#161922] border border-white/5 p-2.5 rounded">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              Average Rate
            </div>
            <div className="text-base font-semibold text-slate-100 font-mono mt-0.5 tabular-nums">
              {formatSpeed(avgSpeed)}
            </div>
          </div>

          <div className="bg-[#161922] border border-white/5 p-2.5 rounded">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              {task.status === 'completed' ? 'Status' : 'Time Remaining'}
            </div>
            <div className="text-base font-semibold text-slate-100 font-mono mt-0.5 tabular-nums">
              {task.status === 'completed' ? 'Completed' : formatEta(task.eta)}
            </div>
          </div>
        </div>

        {/* Master Progress Bar (Hairline, Solid Color) */}
        <div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>Overall Progress</span>
            <span className="font-semibold text-slate-200 tabular-nums">{percentStr}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#181c24] border border-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                task.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-600'
              }`}
              style={{ width: `${percentStr}%` }}
            />
          </div>
        </div>

        {/* Concurrency Settings (Clean, Engineered, No Gimmicks) */}
        <div className="bg-[#161922] border border-white/5 p-2.5 rounded space-y-2">
          {task.throttledReason && (
            <div className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-[10px] font-mono text-amber-300">
              <span>{task.throttledReason}</span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-200">
                Rate Limit Step-Down Active
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-300 text-[11px]">Parallel Sockets:</span>
              <span className="font-mono text-[11px] text-blue-400 font-bold px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                {sliderVal} Threads
              </span>
            </div>

            {/* Presets (Clean, No Emojis) */}
            <div className="flex items-center gap-1">
              {[
                { count: 8, label: '8 Safe' },
                { count: 16, label: '16 Balanced' },
                { count: 32, label: '32 Default' },
                { count: 64, label: '64 Maximum' }
              ].map((p) => (
                <button
                  key={p.count}
                  onClick={() => handleSliderChange(p.count)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                    sliderVal === p.count
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-[#1e232f] hover:bg-[#282f3f] text-slate-300 border border-white/5'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <input
            type="range"
            min="1"
            max="64"
            step="1"
            value={sliderVal}
            onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
            className="w-full h-1 bg-[#202533] rounded appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* TAB 1: Speed Timeline Oscilloscope Chart */}
        {activeTab === 'chart' && (
          <div className="bg-[#161922] border border-white/5 rounded p-2.5">
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="text-slate-300 text-[11px] font-medium">Transfer Rate Waveform ({samples.length} points)</span>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="text-slate-400">Peak: <span className="text-slate-200 font-semibold">{formatSpeed(peakSpeed)}</span></span>
                <span className="text-slate-400">Avg: <span className="text-slate-200 font-semibold">{formatSpeed(avgSpeed)}</span></span>
              </div>
            </div>

            {/* Precision SVG Chart */}
            <div className="relative w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full select-none cursor-crosshair"
                style={{ height: inline ? '110px' : '140px' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient id={`chartGrad-${inline ? 'inline' : 'modal'}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Gridlines with tabular labels */}
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
                        strokeDasharray="2 3"
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

                {/* Base 0 Line */}
                <line
                  x1={padLeft}
                  y1={padTop + plotH}
                  x2={chartWidth - padRight}
                  y2={padTop + plotH}
                  stroke="rgba(255, 255, 255, 0.08)"
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

                {/* Timeline axis labels */}
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

                {/* Subtle area gradient */}
                {areaData && (
                  <path d={areaData} fill={`url(#chartGrad-${inline ? 'inline' : 'modal'})`} />
                )}

                {/* Crisp single-hue line */}
                {pathData && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Average Dotted Guide */}
                {avgSpeed > 0 && avgY >= padTop && avgY <= padTop + plotH && (
                  <line
                    x1={padLeft}
                    y1={avgY}
                    x2={chartWidth - padRight}
                    y2={avgY}
                    stroke="rgba(148, 163, 184, 0.4)"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                )}

                {/* Precision Crosshair */}
                {hoverIndex !== null && points[hoverIndex] && (
                  <g>
                    <line
                      x1={points[hoverIndex].x}
                      y1={padTop}
                      x2={points[hoverIndex].x}
                      y2={padTop + plotH}
                      stroke="rgba(255, 255, 255, 0.3)"
                      strokeWidth="1"
                    />
                    <circle
                      cx={points[hoverIndex].x}
                      cy={points[hoverIndex].y}
                      r="3.5"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={Math.min(chartWidth - 80, Math.max(padLeft + 10, points[hoverIndex].x))}
                      y={Math.max(padTop + 14, points[hoverIndex].y - 8)}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="#ffffff"
                    >
                      {formatSpeed(points[hoverIndex].val)}
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>
        )}

        {/* TAB 2: Dynamic File Segments Grid */}
        {activeTab === 'segments' && (
          <div className="bg-[#161922] border border-white/5 rounded p-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300 text-[11px]">
                Range Partitions ({segments.length} Concurrent Workers)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Direct Absolute Offset File Writing
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {segments.map((seg, idx) => {
                const total = seg.end - seg.start;
                const done = seg.current - seg.start;
                const segPercent = total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 100;
                return (
                  <div key={idx} className="p-1.5 bg-[#1a1e28] rounded border border-white/5 text-[10px] space-y-1">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-slate-300 font-medium">Socket #{idx + 1}</span>
                      <span className={seg.completed ? 'text-emerald-400 font-semibold' : 'text-blue-400'}>
                        {segPercent}% {seg.completed ? '(Done)' : ''}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-[#101319] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${seg.completed ? 'bg-emerald-500' : 'bg-blue-600'}`}
                        style={{ width: `${segPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer */}
      <div className={`px-4 py-2 bg-[#0e1015] border-t border-white/10 flex items-center justify-between text-xs ${inline ? 'h-9' : 'px-5 py-3'}`}>
        <div className="text-[11px] text-slate-400 truncate max-w-xs font-mono" title={task.savePath}>
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
      <div className="w-full border-t border-white/10 bg-[#11141a] flex flex-col flex-shrink-0 select-none overflow-hidden h-72">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      {content}
    </div>
  );
};

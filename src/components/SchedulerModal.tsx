import React, { useState } from 'react';
import { Clock, X, Calendar, Play, Layers, Check, Save } from 'lucide-react';
import { DownloadItem } from '../types';

interface SchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: DownloadItem[];
  onStartQueue: () => void;
  onStopQueue: () => void;
  onSetMaxConcurrent: (count: number) => void;
  onSetQueueStatus: (id: string, inQueue: boolean) => void;
}

export const SchedulerModal: React.FC<SchedulerModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onStartQueue,
  onStopQueue,
  onSetMaxConcurrent,
  onSetQueueStatus
}) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'queue'>('schedule');
  const [schedulerEnabled, setSchedulerEnabled] = useState(() => {
    return localStorage.getItem('adm_scheduler_enabled') === 'true';
  });
  const [startTime, setStartTime] = useState(() => {
    return localStorage.getItem('adm_scheduler_start') || '02:00';
  });
  const [stopTime, setStopTime] = useState(() => {
    return localStorage.getItem('adm_scheduler_stop') || '06:00';
  });
  const [maxConcurrent, setMaxConcurrent] = useState(() => {
    return parseInt(localStorage.getItem('adm_max_concurrent') || '3', 10);
  });
  const [onCompleteAction, setOnCompleteAction] = useState(() => {
    return localStorage.getItem('adm_on_complete') || 'none';
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const queuedTasks = tasks.filter(t => t.status === 'queued');
  const otherTasks = tasks.filter(t => t.status !== 'queued' && t.status !== 'completed');

  const handleSave = () => {
    localStorage.setItem('adm_scheduler_enabled', String(schedulerEnabled));
    localStorage.setItem('adm_scheduler_start', startTime);
    localStorage.setItem('adm_scheduler_stop', stopTime);
    localStorage.setItem('adm_max_concurrent', String(maxConcurrent));
    localStorage.setItem('adm_on_complete', onCompleteAction);

    onSetMaxConcurrent(maxConcurrent);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-lg bg-[#13161c] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0f1117] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="font-semibold text-xs tracking-wide text-slate-100">
              Download Scheduler &amp; Queue Manager
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.08] bg-[#0c0e12] px-4 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3 py-1.5 font-medium rounded-t border-t border-x cursor-pointer transition ${
              activeTab === 'schedule'
                ? 'bg-[#13161c] border-white/10 text-white border-b-transparent'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Schedule Timers
            </span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 font-medium rounded-t border-t border-x cursor-pointer transition ${
              activeTab === 'queue'
                ? 'bg-[#13161c] border-white/10 text-white border-b-transparent'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Files in Queue ({queuedTasks.length})
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 text-xs">
          {activeTab === 'schedule' ? (
            <div className="space-y-3.5">
              {/* Enable toggle */}
              <div className="flex items-center justify-between p-3 bg-[#0b0d11] rounded-lg border border-white/[0.06]">
                <div>
                  <div className="font-medium text-slate-200">Automated Background Scheduler</div>
                  <div className="text-[11px] text-slate-500">Start and pause download queues automatically during off-peak hours</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedulerEnabled}
                    onChange={(e) => setSchedulerEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Time slots */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#0b0d11] rounded-lg border border-white/[0.06] space-y-1.5">
                  <span className="text-[11px] text-slate-400 block font-medium">Start queue at:</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-[#161922] border border-white/10 rounded-md px-2.5 py-1 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 block">Bandwidth window open</span>
                </div>
                <div className="p-3 bg-[#0b0d11] rounded-lg border border-white/[0.06] space-y-1.5">
                  <span className="text-[11px] text-slate-400 block font-medium">Stop queue at:</span>
                  <input
                    type="time"
                    value={stopTime}
                    onChange={(e) => setStopTime(e.target.value)}
                    className="w-full bg-[#161922] border border-white/10 rounded-md px-2.5 py-1 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 block">Pause until next cycle</span>
                </div>
              </div>

              {/* Concurrency slider */}
              <div className="p-3 bg-[#0b0d11] rounded-lg border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Download simultaneous files:</span>
                  <span className="font-mono text-blue-400 font-semibold px-2 py-0.5 bg-blue-500/10 rounded border border-blue-500/20 tabular-nums">
                    {maxConcurrent} {maxConcurrent === 1 ? 'file' : 'files'} at once
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={maxConcurrent}
                  onChange={(e) => setMaxConcurrent(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>1 file (Sequential)</span>
                  <span>5 files (Balanced)</span>
                  <span>10 files (Maximum)</span>
                </div>
              </div>

              {/* Action on complete */}
              <div className="p-3 bg-[#0b0d11] rounded-lg border border-white/[0.06] space-y-2">
                <span className="text-slate-300 text-xs font-medium block">When queue processing finishes:</span>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  {[
                    { id: 'none', label: 'Keep running' },
                    { id: 'exit', label: 'Exit ADM' },
                    { id: 'sleep', label: 'Sleep Computer' }
                  ].map(({ id, label }) => (
                    <label 
                      key={id}
                      className={`flex items-center justify-center p-2 rounded-md border cursor-pointer transition ${
                        onCompleteAction === id 
                          ? 'border-blue-500 bg-blue-500/15 text-white font-medium' 
                          : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="onComplete"
                        checked={onCompleteAction === id}
                        onChange={() => setOnCompleteAction(id)}
                        className="sr-only"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-400">
                Tasks currently queued for automatic sequential processing:
              </div>
              <div className="border border-white/[0.06] rounded-lg bg-[#0b0d11] max-h-56 overflow-y-auto divide-y divide-white/[0.04]">
                {queuedTasks.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    No downloads in queue. Right-click any download and choose "Add to queue".
                  </div>
                ) : (
                  queuedTasks.map((t, idx) => (
                    <div key={t.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-white/[0.03] transition">
                      <div className="flex items-center gap-2 truncate max-w-xs">
                        <span className="font-mono text-[10px] text-blue-400 font-semibold w-4">#{idx + 1}</span>
                        <span className="truncate text-slate-200">{t.fileName || t.url}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onSetQueueStatus(t.id, false)}
                          className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10px] cursor-pointer transition"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {otherTasks.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] text-slate-400 mb-1.5">Paused / Idle tasks available to queue:</div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {otherTasks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onSetQueueStatus(t.id, true)}
                        className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-slate-300 flex items-center gap-1.5 cursor-pointer border border-white/[0.06] transition"
                      >
                        <span className="truncate max-w-[120px]">{t.fileName || t.url}</span>
                        <span className="text-blue-400 font-bold">+</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-4 py-3 bg-[#0f1117] border-t border-white/[0.08] flex items-center justify-between">
          <button
            onClick={() => {
              onStartQueue();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer transition shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Queue Now
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 text-xs font-medium cursor-pointer transition"
            >
              {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5 text-slate-400" />}
              {savedSuccess ? 'Saved!' : 'Save & Apply'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 text-xs cursor-pointer transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

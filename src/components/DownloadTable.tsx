import React, { useState, useEffect } from 'react';
import { 
  File, Archive, Package, FileText, Video, ChevronRight, 
  Activity, Play, Pause, Square, Trash2, Folder, 
  ExternalLink, Edit2, RotateCcw, Check, Plus, Layers
} from 'lucide-react';
import { DownloadItem } from '../types';
import { formatBytes, formatSpeed, formatEta } from '../utils';

interface DownloadTableProps {
  tasks: DownloadItem[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onDoubleClickTask: (task: DownloadItem) => void;
  onResume: (id: string) => void;
  onPause: (id: string) => void;
  onDelete: (id: string, deleteFile?: boolean) => void;
  onOpenFile: (id: string) => void;
  onOpenWith: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onRedownload: (id: string) => void;
  onRenameTask: (id: string, newName: string) => void;
  onSetQueueStatus: (id: string, inQueue: boolean) => void;
  onOpenSpeedChart: (task: DownloadItem) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  task: DownloadItem | null;
}

export const DownloadTable: React.FC<DownloadTableProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  onDoubleClickTask,
  onResume,
  onPause,
  onDelete,
  onOpenFile,
  onOpenWith,
  onOpenFolder,
  onRedownload,
  onRenameTask,
  onSetQueueStatus,
  onOpenSpeedChart
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    task: null
  });

  const [doubleClickAction, setDoubleClickAction] = useState<'speedChart' | 'openFile'>(() => {
    return (localStorage.getItem('adm_double_click_action') as any) || 'speedChart';
  });

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0, task: null });
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu.visible]);

  const handleContextMenu = (e: React.MouseEvent, task: DownloadItem) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectTask(task.id);
    setContextMenu({
      visible: true,
      x: Math.min(e.clientX, window.innerWidth - 260),
      y: Math.min(e.clientY, window.innerHeight - 440),
      task
    });
  };

  const handleRowDoubleClick = (task: DownloadItem) => {
    if (doubleClickAction === 'openFile' && task.status === 'completed') {
      onOpenFile(task.id);
    } else {
      onOpenSpeedChart(task);
    }
  };

  const renderFileIcon = (fileName: string, category: string) => {
    const isVideo = category === 'Video' || /\.(mp4|mkv|avi|webm|flv|mov|ts)$/i.test(fileName);
    if (isVideo) {
      return (
        <div className="w-4 h-4 flex items-center justify-center text-slate-400 flex-shrink-0" title="Video File">
          <Video className="w-3.5 h-3.5 stroke-[1.75]" />
        </div>
      );
    }

    if (category === 'Compressed' || /\.(zip|rar|7z|tar|gz)$/i.test(fileName)) {
      return (
        <div className="w-4 h-4 flex items-center justify-center text-slate-400 flex-shrink-0" title="Archive">
          <Archive className="w-3.5 h-3.5 stroke-[1.75]" />
        </div>
      );
    }

    if (category === 'Programs' || /\.(exe|msi|apk|iso)$/i.test(fileName)) {
      return (
        <div className="w-4 h-4 flex items-center justify-center text-slate-400 flex-shrink-0" title="Executable">
          <Package className="w-3.5 h-3.5 stroke-[1.75]" />
        </div>
      );
    }

    if (category === 'Documents' || /\.(pdf|doc|docx|txt)$/i.test(fileName)) {
      return (
        <div className="w-4 h-4 flex items-center justify-center text-slate-400 flex-shrink-0" title="Document">
          <FileText className="w-3.5 h-3.5 stroke-[1.75]" />
        </div>
      );
    }

    return (
      <div className="w-4 h-4 flex items-center justify-center text-slate-400 flex-shrink-0">
        <File className="w-3.5 h-3.5 stroke-[1.75]" />
      </div>
    );
  };

  const renderStatusText = (task: DownloadItem) => {
    if (task.status === 'completed') {
      return (
        <div className="flex items-center gap-1.5 text-emerald-400/90 font-medium text-[11px]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Complete</span>
        </div>
      );
    }
    if (task.status === 'downloading') {
      const pct = typeof task.percent === 'number' && !isNaN(task.percent) ? task.percent : 0;
      return (
        <div className="flex flex-col gap-1 w-full max-w-[130px]">
          <div className="flex items-center justify-between text-[10px] tabular-nums font-mono">
            <span className="text-blue-400 font-sans font-medium">Downloading</span>
            <span className="text-slate-300 font-semibold">{pct.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
        </div>
      );
    }
    if (task.status === 'paused') {
      return (
        <div className="flex items-center gap-1.5 text-amber-400/90 text-[11px]">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
          <span>Paused</span>
        </div>
      );
    }
    if (task.status === 'queued') {
      return (
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          <span>Queued</span>
        </div>
      );
    }
    if (task.status === 'probing') {
      return (
        <div className="flex items-center gap-1.5 text-blue-400 text-[11px]">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span>Connecting...</span>
        </div>
      );
    }
    if (task.status === 'error') {
      return (
        <div 
          className="flex items-center gap-1.5 text-rose-400 font-medium text-[11px] cursor-help"
          title={task.error ? `Error: ${task.error}` : 'Download encountered an error. Click Resume (▶) to retry.'}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
          <span>Error</span>
          {task.error && (
            <span className="text-[9px] text-rose-300/70 font-mono max-w-[85px] truncate">
              ({task.error.includes('BotGuard') ? 'BotGuard' : 'Failed'})
            </span>
          )}
        </div>
      );
    }
    return <span className="text-slate-400 capitalize text-[11px]">{task.status}</span>;
  };

  const getTaskSize = (task: DownloadItem) => {
    if (task.totalBytes > 0) return formatBytes(task.totalBytes);
    if (task.downloadedBytes > 0) return formatBytes(task.downloadedBytes);
    return '--';
  };

  return (
    <div className="flex-1 overflow-auto bg-[#0b0d11] select-none font-sans relative">
      <table className="w-full text-left border-collapse border-b border-white/[0.06]">
        <thead className="bg-[#0e1015] text-slate-400 text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-white/[0.08] font-semibold">
          <tr>
            <th className="py-2 px-3 border-r border-white/[0.04]">File Name</th>
            <th className="py-2 px-2 border-r border-white/[0.04] w-8 text-center">Q</th>
            <th className="py-2 px-2.5 border-r border-white/[0.04] w-24">Size</th>
            <th className="py-2 px-2.5 border-r border-white/[0.04] w-36">Status</th>
            <th className="py-2 px-2.5 border-r border-white/[0.04] w-24">Time left</th>
            <th className="py-2 px-3 w-52">Transfer Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04] text-[11px] text-slate-200">
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-16 text-center text-slate-500 text-xs">
                No items in download queue. Click "Add URL" or download any file in Chrome/Edge.
              </td>
            </tr>
          ) : (
            tasks.map((task) => {
              const isSelected = selectedTaskId === task.id;
              return (
                <tr
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  onDoubleClick={() => handleRowDoubleClick(task)}
                  onContextMenu={(e) => handleContextMenu(e, task)}
                  className={`cursor-pointer transition border-b border-white/[0.04] ${
                    isSelected
                      ? 'bg-blue-600/15 text-white border-l-2 border-l-blue-500'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  {/* File Name */}
                  <td className="py-2 px-3 border-r border-white/[0.04] max-w-sm truncate">
                    <div className="flex items-center gap-2 truncate">
                      {renderFileIcon(task.fileName, task.category)}
                      <span className="truncate text-slate-200" title={task.fileName || task.url}>
                        {task.fileName || task.url}
                      </span>
                    </div>
                  </td>

                  {/* Q (Queue) */}
                  <td className="py-2 px-2 border-r border-white/[0.04] text-center text-slate-400 text-[10px]">
                    {task.status === 'queued' ? (
                      <span className="font-bold text-blue-400">Q</span>
                    ) : (
                      '1'
                    )}
                  </td>

                  {/* Size */}
                  <td className="py-2 px-2.5 border-r border-white/[0.04] font-mono text-[11px] tabular-nums text-slate-300">
                    {getTaskSize(task)}
                  </td>

                  {/* Status */}
                  <td className="py-2 px-2.5 border-r border-white/[0.04] text-[11px]">
                    {renderStatusText(task)}
                  </td>

                  {/* Time left */}
                  <td className="py-2 px-2.5 border-r border-white/[0.04] font-mono text-[11px] tabular-nums text-slate-400">
                    {task.status === 'downloading' ? formatEta(task.eta) : ''}
                  </td>

                  {/* Transfer Rate */}
                  {/* Transfer Rate & Universal Action Controls */}
                  <td className="py-2 px-3 font-mono text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-100 font-semibold tabular-nums min-w-[58px]">
                        {task.status === 'downloading' ? formatSpeed(task.speed) : '--'}
                      </span>

                      {/* Universal Action Symbols */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {task.status === 'downloading' ? (
                          <>
                            {/* Pause Button (Universal Symbol: ⏸) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPause(task.id);
                              }}
                              className="w-6 h-6 rounded flex items-center justify-center bg-white/[0.04] hover:bg-amber-500/15 text-amber-400 hover:text-amber-300 transition cursor-pointer border border-white/[0.06] hover:border-amber-500/30"
                              title="Pause Download (⏸)"
                            >
                              <Pause className="w-3 h-3 fill-current" />
                            </button>

                            {/* Stop Button (Universal Symbol: ⏹) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPause(task.id);
                              }}
                              className="w-6 h-6 rounded flex items-center justify-center bg-white/[0.04] hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 transition cursor-pointer border border-white/[0.06] hover:border-rose-500/30"
                              title="Stop Download (⏹)"
                            >
                              <Square className="w-2.5 h-2.5 fill-current" />
                            </button>
                          </>
                        ) : task.status === 'completed' ? (
                          <>
                            {/* Open / Play File Button (Universal Symbol: ▶) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenFile(task.id);
                              }}
                              className="w-6 h-6 rounded flex items-center justify-center bg-white/[0.04] hover:bg-blue-500/15 text-blue-400 hover:text-blue-300 transition cursor-pointer border border-white/[0.06] hover:border-blue-500/30"
                              title="Open File (▶)"
                            >
                              <Play className="w-3 h-3 fill-current ml-0.5" />
                            </button>

                            {/* Open Containing Folder Button (Universal Symbol: 📁) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenFolder(task.id);
                              }}
                              className="w-6 h-6 rounded flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-slate-200 transition cursor-pointer border border-white/[0.06] hover:border-white/15"
                              title="Open Containing Folder"
                            >
                              <Folder className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Resume Button (Universal Symbol: ▶) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onResume(task.id);
                              }}
                              className="w-6 h-6 rounded flex items-center justify-center bg-white/[0.04] hover:bg-emerald-500/15 text-emerald-400 hover:text-emerald-300 transition cursor-pointer border border-white/[0.06] hover:border-emerald-500/30"
                              title="Resume Download (▶)"
                            >
                              <Play className="w-3 h-3 fill-current ml-0.5" />
                            </button>

                            {/* Stop Button (Universal Symbol: ⏹) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPause(task.id);
                              }}
                              className="w-6 h-6 rounded flex items-center justify-center bg-white/[0.04] hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 transition cursor-pointer border border-white/[0.06] hover:border-rose-500/30"
                              title="Stop (⏹)"
                            >
                              <Square className="w-2.5 h-2.5 fill-current" />
                            </button>
                          </>
                        )}

                        {/* Speed Chart / Telemetry Inspector (Universal Symbol: 📈) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenSpeedChart(task);
                          }}
                          className={`w-6 h-6 rounded flex items-center justify-center transition cursor-pointer border ${
                            task.status === 'downloading'
                              ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border-blue-500/25'
                              : 'bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-slate-200 border-white/[0.06]'
                          }`}
                          title="Speed Chart & Telemetry Inspector"
                        >
                          <Activity className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.task && (
        <div
          className="fixed z-50 w-60 bg-[#141720] border border-white/10 rounded-lg shadow-2xl py-1 text-xs select-none font-sans text-slate-200"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Speed Chart */}
          <button
            onClick={() => {
              onOpenSpeedChart(contextMenu.task!);
              setContextMenu({ visible: false, x: 0, y: 0, task: null });
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] text-blue-400 font-medium cursor-pointer flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Transfer Speed & Telemetry
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Alt+Enter</span>
          </button>

          <div className="h-[1px] bg-white/5 my-1" />

          {/* Open */}
          <button
            onClick={() => {
              onOpenFile(contextMenu.task!.id);
              setContextMenu({ visible: false, x: 0, y: 0, task: null });
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] cursor-pointer flex items-center gap-2"
          >
            <Play className="w-3.5 h-3.5 text-slate-400" />
            Open File
          </button>

          {/* Open with */}
          <button
            onClick={() => {
              onOpenWith(contextMenu.task!.id);
              setContextMenu({ visible: false, x: 0, y: 0, task: null });
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] cursor-pointer flex items-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            Open with...
          </button>

          {/* Open folder */}
          <button
            onClick={() => {
              onOpenFolder(contextMenu.task!.id);
              setContextMenu({ visible: false, x: 0, y: 0, task: null });
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] cursor-pointer flex items-center gap-2"
          >
            <Folder className="w-3.5 h-3.5 text-slate-400" />
            Open containing folder
          </button>

          <div className="h-[1px] bg-white/5 my-1" />

          {/* Move/Rename */}
          <button
            onClick={() => {
              const newName = prompt('Enter new filename for this download:', contextMenu.task!.fileName);
              if (newName && newName.trim() && newName.trim() !== contextMenu.task!.fileName) {
                onRenameTask(contextMenu.task!.id, newName.trim());
              }
              setContextMenu({ visible: false, x: 0, y: 0, task: null });
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] cursor-pointer flex items-center gap-2"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
            Rename File (Ctrl+M)
          </button>

          {/* Redownload */}
          <button
            onClick={() => {
              onRedownload(contextMenu.task!.id);
              setContextMenu({ visible: false, x: 0, y: 0, task: null });
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] cursor-pointer flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            Redownload from start
          </button>

          <div className="h-[1px] bg-white/5 my-1" />

          {/* Resume */}
          <button
            onClick={() => {
              onResume(contextMenu.task!.id);
              setContextMenu({ visible: false, x: 0, y: 0, task: null });
            }}
            disabled={contextMenu.task.status === 'downloading' || contextMenu.task.status === 'completed'}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer flex items-center gap-2 text-emerald-400"
          >
            <Play className="w-3.5 h-3.5" />
            Resume Download
          </button>

          {/* Pause */}
          <button
            onClick={() => {
              onPause(contextMenu.task!.id);
              setContextMenu({ visible: false, x: 0, y: 0, task: null });
            }}
            disabled={contextMenu.task.status !== 'downloading'}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer flex items-center gap-2 text-amber-400"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause Download
          </button>

          {/* Remove */}
          <button
            onClick={() => {
              onDelete(contextMenu.task!.id, false);
              setContextMenu({ visible: false, x: 0, y: 0, task: null });
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] cursor-pointer flex items-center gap-2 text-rose-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove from list
          </button>

          <div className="h-[1px] bg-white/5 my-1" />

          {/* Queue operations */}
          {contextMenu.task.status === 'queued' ? (
            <button
              onClick={() => {
                onSetQueueStatus(contextMenu.task!.id, false);
                setContextMenu({ visible: false, x: 0, y: 0, task: null });
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] cursor-pointer flex items-center gap-2 text-slate-300"
            >
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Remove from Queue
            </button>
          ) : (
            <button
              onClick={() => {
                onSetQueueStatus(contextMenu.task!.id, true);
                setContextMenu({ visible: false, x: 0, y: 0, task: null });
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] cursor-pointer flex items-center gap-2 text-slate-300"
            >
              <Plus className="w-3.5 h-3.5 text-slate-400" />
              Add to Queue
            </button>
          )}

          {/* Double Click Setting */}
          <button
            onClick={() => {
              const next = doubleClickAction === 'speedChart' ? 'openFile' : 'speedChart';
              setDoubleClickAction(next);
              localStorage.setItem('adm_double_click_action', next);
              setContextMenu({ visible: false, x: 0, y: 0, task: null });
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1e2330] cursor-pointer flex items-center justify-between text-slate-400"
          >
            <span>On Double click:</span>
            <span className="text-[10px] text-blue-400 font-mono">
              {doubleClickAction === 'speedChart' ? 'Telemetry' : 'Open File'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

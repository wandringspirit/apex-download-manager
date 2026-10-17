import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { DownloadTable } from './components/DownloadTable';
import { SegmentVisualizer } from './components/SegmentVisualizer';
import { AddDownloadModal } from './components/AddDownloadModal';
import { SettingsModal } from './components/SettingsModal';
import { SchedulerModal } from './components/SchedulerModal';
import { AboutModal } from './components/AboutModal';
import { ShareModal } from './components/ShareModal';
import { DownloadItem, CategoryFilter, StatusFilter } from './types';
import { formatSpeed } from './utils';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ADM React Crash Guard]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-slate-100 p-6 select-none font-sans">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
            <span className="text-2xl font-bold">!</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Apex Download Manager Recovered</h2>
          <p className="text-xs text-slate-400 mb-6 max-w-md text-center font-mono">
            An unexpected UI exception was safely intercepted. Your downloads continue running in the background.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-lg shadow-sky-500/20"
          >
            Reload Interface
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AppContent: React.FC = () => {
  const [tasks, setTasks] = useState<DownloadItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [currentCategory, setCurrentCategory] = useState<CategoryFilter>('All');
  const [currentStatus, setCurrentStatus] = useState<StatusFilter>('All');
  const [visualizerTask, setVisualizerTask] = useState<DownloadItem | null>(null);
  const [showBottomInspector, setShowBottomInspector] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [aboutMode, setAboutMode] = useState<'about' | 'registration'>('about');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Connect to local Bridge Server on port 48911
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connect = () => {
      try {
        socket = new WebSocket('ws://127.0.0.1:48911');

        socket.onopen = () => {
          setBridgeConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            handleWsMessage(msg);
          } catch (e) {}
        };

        socket.onclose = () => {
          setBridgeConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        };

        socket.onerror = () => {
          setBridgeConnected(false);
        };

        setWs(socket);
      } catch (err) {
        setBridgeConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  // Global Keyboard Shortcuts (Ctrl+N, Alt+Enter, Del)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsAddModalOpen(true);
      } else if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        handleSpeedChartClick();
      } else if (e.key === 'Delete' && selectedTaskId) {
        e.preventDefault();
        handleDelete(selectedTaskId);
      } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleStartQueue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, tasks]);

  const handleWsMessage = (msg: any) => {
    switch (msg.type) {
      case 'INIT_STATE':
        setTasks(msg.tasks || []);
        break;
      case 'TASK_ADDED':
      case 'DOWNLOAD_CAUGHT':
        setTasks((prev) => {
          const exists = prev.some(t => t.id === msg.task.id);
          if (exists) return prev.map(t => t.id === msg.task.id ? msg.task : t);
          return [msg.task, ...prev];
        });
        showToast(`Download started: ${msg.task.fileName || 'New file'}`);
        break;
      case 'TASK_PROGRESS':
        setTasks((prev) => prev.map((t) => {
          if (t.id === msg.data.id) {
            const updated = {
              ...t,
              downloadedBytes: msg.data.downloadedBytes,
              percent: msg.data.percent,
              speed: msg.data.speed,
              peakSpeed: msg.data.peakSpeed ?? (t.peakSpeed ? Math.max(t.peakSpeed, msg.data.speed) : msg.data.speed),
              avgSpeed: msg.data.avgSpeed ?? t.avgSpeed,
              speedSamples: msg.data.speedSamples || (t.speedSamples ? [...t.speedSamples, msg.data.speed] : [msg.data.speed]),
              eta: msg.data.eta,
              segments: msg.data.segments || t.segments
            };
            setVisualizerTask((curr) => curr && curr.id === t.id ? updated : curr);
            return updated;
          }
          return t;
        }));
        break;
      case 'TASK_STATUS':
        setTasks((prev) => prev.map((t) => {
          if (t.id === msg.data.id) {
            const updated = { ...t, status: msg.data.status, ...(msg.data.fileName ? { fileName: msg.data.fileName } : {}) };
            setVisualizerTask((curr) => curr && curr.id === t.id ? updated : curr);
            return updated;
          }
          return t;
        }));
        break;
      case 'TASK_DELETED':
        setTasks((prev) => prev.filter(t => t.id !== msg.data.id));
        setVisualizerTask((curr) => curr && curr.id === msg.data.id ? null : curr);
        break;
      default:
        break;
    }
  };

  // Actions
  const handleAddDownload = (data: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ADD_DOWNLOAD', payload: data }));
    } else {
      fetch('http://127.0.0.1:48911/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(() => {});
    }
  };

  const handleResume = (id: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'START_DOWNLOAD', id }));
    }
  };

  const handlePause = (id: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PAUSE_DOWNLOAD', id }));
    }
  };

  const handleStopAll = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PAUSE_ALL' }));
    }
    showToast('All downloads stopped.');
  };

  const handleStartQueue = () => {
    const queuedCount = tasks.filter(t => t.status === 'queued' || t.status === 'paused').length;
    tasks.filter(t => t.status === 'queued' || t.status === 'paused').forEach(t => handleResume(t.id));
    showToast(`Main Download Queue started (${queuedCount} task(s))`);
  };

  const handleDelete = (id: string, deleteFile = false) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'DELETE_DOWNLOAD', id, deleteFile }));
    }
    fetch('http://127.0.0.1:48911/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, deleteFile })
    }).catch(() => {});
    if (selectedTaskId === id) setSelectedTaskId(null);
  };

  const handleOpenFile = (id: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'OPEN_FILE', id }));
    }
    fetch('http://127.0.0.1:48911/api/open-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    }).catch(() => {});
  };

  const handleOpenWith = (id: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'OPEN_WITH', id }));
    }
    fetch('http://127.0.0.1:48911/api/open-with', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    }).catch(() => {});
  };

  const handleOpenFolder = (id: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'OPEN_FOLDER', id }));
    }
    fetch('http://127.0.0.1:48911/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    }).catch(() => {});
  };

  const handleOpenDefaultFolder = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'OPEN_DEFAULT_FOLDER' }));
    }
    fetch('http://127.0.0.1:48911/api/open-default-folder', {
      method: 'POST'
    }).catch(() => {});
  };

  const handleRedownload = (id: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'REDOWNLOAD', id }));
    }
  };

  const handleSetConcurrency = (id: string, count: number) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SET_CONCURRENCY', id, count }));
    }
    fetch('http://127.0.0.1:48911/api/set-concurrency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, count })
    }).catch(() => {});
  };

  const handleRenameTask = (id: string, newName: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'RENAME_TASK', id, newName }));
    }
    fetch('http://127.0.0.1:48911/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, newName })
    }).catch(() => {});
    setTasks(prev => prev.map(t => t.id === id ? { ...t, fileName: newName } : t));
    showToast(`Renamed to "${newName}"`);
  };

  const handleSetQueueStatus = (id: string, inQueue: boolean) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SET_QUEUE_STATUS', id, inQueue }));
    }
    fetch('http://127.0.0.1:48911/api/queue-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, inQueue })
    }).catch(() => {});
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: inQueue ? 'queued' : 'paused' } : t));
    showToast(inQueue ? 'Added task to Main Download Queue' : 'Removed task from Queue');
  };

  const handleSetMaxConcurrent = (maxConcurrent: number) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SET_MAX_CONCURRENT', maxConcurrent }));
    }
    fetch('http://127.0.0.1:48911/api/set-max-concurrent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxConcurrent })
    }).catch(() => {});
  };

  // Dedicated task targeted by the Segment & Speed Inspector pane
  const inspectorTask = useMemo(() => {
    if (selectedTaskId) {
      const found = tasks.find(t => t.id === selectedTaskId);
      if (found) return found;
    }
    const active = tasks.find(t => t.status === 'downloading');
    if (active) return active;
    return tasks[0] || null;
  }, [selectedTaskId, tasks]);

  // Speed Chart inspection helper (opens modal)
  const handleSpeedChartClick = (task?: DownloadItem) => {
    if (task) {
      setSelectedTaskId(task.id);
      setShowBottomInspector(true);
      setVisualizerTask(task);
      return;
    }
    if (inspectorTask) {
      setShowBottomInspector(true);
      setVisualizerTask(inspectorTask);
      return;
    }
    setIsAddModalOpen(true);
  };

  const handleBatchAddClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const urls = text.match(/https?:\/\/[^\s"'<>]+/g);
      if (urls && urls.length > 0) {
        urls.forEach(url => {
          handleAddDownload({ url, autoStart: true });
        });
        showToast(`Added ${urls.length} download(s) from clipboard`);
      } else {
        setIsAddModalOpen(true);
      }
    } catch (e) {
      setIsAddModalOpen(true);
    }
  };

  const handleExportHistory = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `adm_downloads_export_${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Download history exported to JSON');
  };

  const handleImportHistory = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target?.result as string);
            if (Array.isArray(imported)) {
              imported.forEach(item => {
                if (item.url) handleAddDownload({ url: item.url, fileName: item.fileName, autoStart: false });
              });
              showToast(`Imported ${imported.length} tasks successfully`);
            }
          } catch (err) {
            alert('Invalid JSON file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handlePurgeAll = () => {
    if (tasks.length === 0) return;
    if (confirm(`Are you sure you want to purge all ${tasks.length} downloads and remove incomplete residual files?`)) {
      tasks.forEach(t => handleDelete(t.id, true));
      showToast('All downloads and residues purged.');
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Category filter
      if (currentCategory !== 'All' && t.category !== currentCategory) return false;

      // Status filter
      if (currentStatus === 'Active' && t.status !== 'downloading' && t.status !== 'probing') return false;
      if (currentStatus === 'Paused' && t.status !== 'paused') return false;
      if (currentStatus === 'Completed' && t.status !== 'completed') return false;
      if (currentStatus === 'Queued' && t.status !== 'queued') return false;
      if (currentStatus === 'Grabber' && t.category !== 'Video') return false;

      return true;
    });
  }, [tasks, currentCategory, currentStatus]);

  // Total speed
  const totalSpeed = useMemo(() => {
    return tasks.reduce((sum, t) => sum + (t.status === 'downloading' ? t.speed : 0), 0);
  }, [tasks]);

  return (
    <div className="flex flex-col h-screen bg-[#0b0d11] text-slate-100 select-none overflow-hidden relative font-sans">
      {/* Toast Notification Banner (Quiet Precision Notification) */}
      {toastMessage && (
        <div className="absolute top-12 right-4 z-50 px-3.5 py-1.5 bg-[#161922] border border-white/10 text-slate-200 rounded-md shadow-2xl text-xs flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          <span className="font-medium text-[11px]">{toastMessage}</span>
        </div>
      )}

      {/* Top Toolbar */}
      <Toolbar
        onAddClick={() => setIsAddModalOpen(true)}
        onResumeClick={() => selectedTaskId && handleResume(selectedTaskId)}
        onPauseClick={() => selectedTaskId && handlePause(selectedTaskId)}
        onStopAllClick={handleStopAll}
        onDeleteClick={() => selectedTaskId && handleDelete(selectedTaskId)}
        onDeleteCompletedClick={() => {
          tasks.filter(t => t.status === 'completed').forEach(t => handleDelete(t.id));
        }}
        onSpeedChartClick={() => handleSpeedChartClick()}
        onOptionsClick={() => setIsSettingsOpen(true)}
        onSchedulerClick={() => setIsSchedulerOpen(true)}
        onStartQueueClick={handleStartQueue}
        onStopQueueClick={handleStopAll}
        onTellFriendClick={() => setIsShareOpen(true)}
        onOpenDefaultFolder={handleOpenDefaultFolder}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        onOpenAbout={(mode = 'about') => {
          setAboutMode(mode);
          setIsAboutOpen(true);
        }}
        onBatchAddClipboard={handleBatchAddClipboard}
        onExportHistory={handleExportHistory}
        onImportHistory={handleImportHistory}
        onPurgeAll={handlePurgeAll}
        selectedTaskId={selectedTaskId}
        bridgeConnected={bridgeConnected}
        totalSpeed={totalSpeed}
      />

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left IDM Sidebar (Collapsible) */}
        {showSidebar && (
          <Sidebar
            currentCategory={currentCategory}
            onSelectCategory={setCurrentCategory}
            currentStatus={currentStatus}
            onSelectStatus={setCurrentStatus}
            tasks={tasks}
            onCloseSidebar={() => setShowSidebar(false)}
          />
        )}

        {/* Right Area: Table on top, Segment & Speed Inspector on bottom */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Half: Download Table */}
          <div className="flex-1 overflow-auto">
            <DownloadTable
              tasks={filteredTasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={(id) => {
                setSelectedTaskId(id);
                setShowBottomInspector(true);
              }}
              onDoubleClickTask={(task) => handleSpeedChartClick(task)}
              onResume={handleResume}
              onPause={handlePause}
              onDelete={handleDelete}
              onOpenFile={handleOpenFile}
              onOpenWith={handleOpenWith}
              onOpenFolder={handleOpenFolder}
              onRedownload={handleRedownload}
              onRenameTask={handleRenameTask}
              onSetQueueStatus={handleSetQueueStatus}
              onOpenSpeedChart={(task) => {
                setSelectedTaskId(task.id);
                setShowBottomInspector(true);
              }}
            />
          </div>

          {/* Bottom Half: Native Segment & Speed Inspector Pane */}
          {inspectorTask && showBottomInspector && (
            <SegmentVisualizer
              task={inspectorTask}
              inline={true}
              onClose={() => setShowBottomInspector(false)}
              onPopOut={() => setVisualizerTask(inspectorTask)}
              onResume={handleResume}
              onPause={handlePause}
              onSetConcurrency={handleSetConcurrency}
              onOpenFile={handleOpenFile}
              onOpenFolder={handleOpenFolder}
            />
          )}
        </div>
      </div>

      {/* 4. Bottom Native Instrument Status Bar */}
      <footer className="h-6 bg-[#0a0c10] border-t border-white/[0.06] px-3 flex items-center justify-between text-[10px] text-slate-400 font-mono select-none flex-shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${bridgeConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="font-sans text-slate-300">
              {bridgeConnected ? 'Bridge Online' : 'Bridge Offline'}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500 font-mono">127.0.0.1:48911</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-sans">Active:</span>
            <span className="text-blue-400 font-semibold tabular-nums">
              {tasks.filter(t => t.status === 'downloading').length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-sans">Queued:</span>
            <span className="text-slate-300 tabular-nums">
              {tasks.filter(t => t.status === 'queued').length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-sans">Completed:</span>
            <span className="text-emerald-400 tabular-nums">
              {tasks.filter(t => t.status === 'completed').length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-sans">Total Speed:</span>
            <span className={`font-semibold tabular-nums ${totalSpeed > 0 ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>
              {formatSpeed(totalSpeed)}
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-500 font-sans">Max: 64 Sockets/Task</span>
        </div>
      </footer>

      {/* Signature IDM Segment Visualizer & Transfer Speed Chart Modal (Full Screen) */}
      {visualizerTask && (
        <SegmentVisualizer
          task={visualizerTask}
          onClose={() => setVisualizerTask(null)}
          onResume={handleResume}
          onPause={handlePause}
          onSetConcurrency={handleSetConcurrency}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
        />
      )}

      {/* Add Download Modal */}
      <AddDownloadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddDownload}
      />

      {/* Settings & Extension Instructions Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Scheduler Modal */}
      <SchedulerModal
        isOpen={isSchedulerOpen}
        onClose={() => setIsSchedulerOpen(false)}
        tasks={tasks}
        onStartQueue={handleStartQueue}
        onStopQueue={handleStopAll}
        onSetMaxConcurrent={handleSetMaxConcurrent}
        onSetQueueStatus={handleSetQueueStatus}
      />

      {/* About & Registration Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        mode={aboutMode}
      />

      {/* Share / Tell a Friend Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

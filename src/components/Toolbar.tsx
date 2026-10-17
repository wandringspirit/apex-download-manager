import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, ArrowDownCircle, StopCircle, Hand, Trash2, 
  Settings, Clock, PlaySquare, StopCircle as StopQueueIcon, 
  ThumbsUp, Globe, Activity, TrendingUp, Folder, Download, 
  FileText, ExternalLink, RefreshCw, Key, ShieldCheck, Check
} from 'lucide-react';

interface ToolbarProps {
  onAddClick: () => void;
  onResumeClick: () => void;
  onPauseClick: () => void;
  onStopAllClick: () => void;
  onDeleteClick: () => void;
  onDeleteCompletedClick: () => void;
  onSpeedChartClick: () => void;
  onOptionsClick: () => void;
  onSchedulerClick: () => void;
  onStartQueueClick: () => void;
  onStopQueueClick: () => void;
  onTellFriendClick: () => void;
  onOpenDefaultFolder: () => void;
  onToggleSidebar: () => void;
  onOpenAbout: (mode?: 'about' | 'registration') => void;
  onBatchAddClipboard: () => void;
  onExportHistory: () => void;
  onImportHistory: () => void;
  onPurgeAll: () => void;
  selectedTaskId: string | null;
  bridgeConnected: boolean;
  totalSpeed: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onAddClick,
  onResumeClick,
  onPauseClick,
  onStopAllClick,
  onDeleteClick,
  onDeleteCompletedClick,
  onSpeedChartClick,
  onOptionsClick,
  onSchedulerClick,
  onStartQueueClick,
  onStopQueueClick,
  onTellFriendClick,
  onOpenDefaultFolder,
  onToggleSidebar,
  onOpenAbout,
  onBatchAddClipboard,
  onExportHistory,
  onImportHistory,
  onPurgeAll,
  selectedTaskId,
  bridgeConnected,
  totalSpeed
}) => {
  const [openMenu, setOpenMenu] = useState<'tasks' | 'file' | 'downloads' | 'view' | 'help' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menu: 'tasks' | 'file' | 'downloads' | 'view' | 'help') => {
    setOpenMenu(curr => curr === menu ? null : menu);
  };

  return (
    <div className="bg-[#13161c] border-b border-white/[0.08] select-none text-slate-200 font-sans">
      {/* 1. IDM Window Titlebar & Interactive Menu Row */}
      <div className="px-3 py-1 bg-[#0f1117] border-b border-white/[0.06] flex items-center justify-between text-xs relative" ref={menuRef}>
        <div className="flex items-center gap-5">
          {/* Logo & App Title */}
          <div className="flex items-center gap-2 pr-3 border-r border-white/[0.08]">
            <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Globe className="w-2.5 h-2.5 text-blue-400" />
            </div>
            <span className="font-semibold text-slate-200 tracking-tight text-[11px]">
              Apex Download Manager 6.42
            </span>
            <span 
              className={`w-1.5 h-1.5 rounded-full ml-1 ${bridgeConnected ? 'bg-emerald-400' : 'bg-red-400'}`} 
              title={bridgeConnected ? 'Browser Extension Bridge Online (Port 48911)' : 'Bridge Offline'}
            />
          </div>

          {/* Genuine Windows Standard Dropdown Menus */}
          <div className="flex items-center gap-1 text-[11px] text-slate-300">
            {/* Tasks Menu */}
            <div className="relative">
              <button
                onClick={() => toggleMenu('tasks')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  openMenu === 'tasks' ? 'bg-[#2b313d] text-white' : 'hover:bg-[#2b313d] hover:text-white'
                }`}
              >
                Tasks
              </button>
              {openMenu === 'tasks' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-[#1e222b] border border-[#3b4252] rounded shadow-2xl py-1 z-50 text-xs">
                  <button
                    onClick={() => { onAddClick(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer flex items-center justify-between"
                  >
                    <span>Add new download...</span>
                    <span className="text-[10px] text-slate-400">Ctrl+N</span>
                  </button>
                  <button
                    onClick={() => { onBatchAddClipboard(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer"
                  >
                    Add batch from clipboard
                  </button>
                  <div className="h-[1px] bg-[#2b313d] my-1" />
                  <button
                    onClick={() => { onExportHistory(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer"
                  >
                    Export downloads list (.json)
                  </button>
                  <button
                    onClick={() => { onImportHistory(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer"
                  >
                    Import downloads list (.json)
                  </button>
                  <div className="h-[1px] bg-[#2b313d] my-1" />
                  <button
                    onClick={() => { window.close(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] text-rose-300 cursor-pointer"
                  >
                    Exit Apex Download Manager
                  </button>
                </div>
              )}
            </div>

            {/* File Menu */}
            <div className="relative">
              <button
                onClick={() => toggleMenu('file')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  openMenu === 'file' ? 'bg-[#2b313d] text-white' : 'hover:bg-[#2b313d] hover:text-white'
                }`}
              >
                File
              </button>
              {openMenu === 'file' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-[#1e222b] border border-[#3b4252] rounded shadow-2xl py-1 z-50 text-xs">
                  <button
                    onClick={() => { onOpenDefaultFolder(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer"
                  >
                    Open Downloads folder
                  </button>
                  <button
                    onClick={() => { onOptionsClick(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer"
                  >
                    Options & Extension Setup...
                  </button>
                  <div className="h-[1px] bg-[#2b313d] my-1" />
                  <button
                    onClick={() => { onDeleteCompletedClick(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer"
                  >
                    Clear completed downloads
                  </button>
                  <button
                    onClick={() => { onPurgeAll(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] text-rose-300 cursor-pointer"
                  >
                    Purge all download residues
                  </button>
                </div>
              )}
            </div>

            {/* Downloads Menu */}
            <div className="relative">
              <button
                onClick={() => toggleMenu('downloads')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  openMenu === 'downloads' ? 'bg-[#2b313d] text-white' : 'hover:bg-[#2b313d] hover:text-white'
                }`}
              >
                Downloads
              </button>
              {openMenu === 'downloads' && (
                <div className="absolute left-0 top-full mt-1 w-60 bg-[#1e222b] border border-[#3b4252] rounded shadow-2xl py-1 z-50 text-xs">
                  <button
                    onClick={() => { onResumeClick(); setOpenMenu(null); }}
                    disabled={!selectedTaskId}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] disabled:opacity-40 cursor-pointer"
                  >
                    Resume Selected Download
                  </button>
                  <button
                    onClick={() => { onPauseClick(); setOpenMenu(null); }}
                    disabled={!selectedTaskId}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] disabled:opacity-40 cursor-pointer"
                  >
                    Pause Selected Download
                  </button>
                  <button
                    onClick={() => { onStopAllClick(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer"
                  >
                    Stop All Active Downloads
                  </button>
                  <div className="h-[1px] bg-[#2b313d] my-1" />
                  {/* SPEED CHART OPTION IN DOWNLOADS MENU */}
                  <button
                    onClick={() => { onSpeedChartClick(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] text-sky-400 font-semibold cursor-pointer flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Speed Chart & Properties
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Alt+Enter</span>
                  </button>
                  <div className="h-[1px] bg-[#2b313d] my-1" />
                  <button
                    onClick={() => { onDeleteClick(); setOpenMenu(null); }}
                    disabled={!selectedTaskId}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] text-rose-300 disabled:opacity-40 cursor-pointer"
                  >
                    Delete Download
                  </button>
                </div>
              )}
            </div>

            {/* View Menu */}
            <div className="relative">
              <button
                onClick={() => toggleMenu('view')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  openMenu === 'view' ? 'bg-[#2b313d] text-white' : 'hover:bg-[#2b313d] hover:text-white'
                }`}
              >
                View
              </button>
              {openMenu === 'view' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-[#1e222b] border border-[#3b4252] rounded shadow-2xl py-1 z-50 text-xs">
                  {/* SPEED CHART OPTION IN VIEW MENU */}
                  <button
                    onClick={() => { onSpeedChartClick(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] text-sky-400 font-semibold cursor-pointer flex items-center gap-1.5"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Speed Graph & Segments
                  </button>
                  <button
                    onClick={() => { onToggleSidebar(); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer"
                  >
                    Toggle Categories Sidebar
                  </button>
                </div>
              )}
            </div>

            {/* Help Menu */}
            <div className="relative">
              <button
                onClick={() => toggleMenu('help')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  openMenu === 'help' ? 'bg-[#2b313d] text-white' : 'hover:bg-[#2b313d] hover:text-white'
                }`}
              >
                Help
              </button>
              {openMenu === 'help' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-[#1e222b] border border-[#3b4252] rounded shadow-2xl py-1 z-50 text-xs">
                  <button
                    onClick={() => { onOpenAbout('about'); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer"
                  >
                    About Apex Download Manager
                  </button>
                  <button
                    onClick={() => { alert('You are running the latest v6.42 Pro build with 64-thread acceleration.'); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer"
                  >
                    Check for Updates...
                  </button>
                  <button
                    onClick={() => { onOpenAbout('about'); setOpenMenu(null); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#2d3545] cursor-pointer"
                  >
                    Keyboard Shortcuts & Docs
                  </button>
                </div>
              )}
            </div>

            {/* Registration Menu */}
            <button
              onClick={() => onOpenAbout('registration')}
              className="text-slate-400 hover:text-slate-200 cursor-pointer px-2 py-0.5 rounded hover:bg-white/[0.05] transition font-medium"
              title="View License Status"
            >
              Registration
            </button>
          </div>
        </div>

        {/* Right side status badge */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="text-[10px] font-mono tracking-wider text-slate-400 border border-white/10 px-1.5 py-0.5 rounded bg-white/[0.03]">
            v6.42 PRO
          </span>
        </div>
      </div>

      {/* 2. Precision Network Instrument Toolbar */}
      <div className="px-2 py-1.5 flex items-center gap-0.5 overflow-x-auto bg-[#101218]">
        {/* Add URL */}
        <button
          onClick={onAddClick}
          className="flex flex-col items-center justify-center min-w-[56px] px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition text-slate-300 hover:text-white group cursor-pointer"
          title="Add URL (Ctrl+N)"
        >
          <div className="w-6 h-6 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <Plus className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-slate-400 group-hover:text-slate-200">Add URL</span>
        </button>

        {/* Resume */}
        <button
          onClick={onResumeClick}
          disabled={!selectedTaskId}
          className="flex flex-col items-center justify-center min-w-[56px] px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed group cursor-pointer"
          title="Resume Selected Download"
        >
          <div className="w-6 h-6 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <ArrowDownCircle className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-slate-400 group-hover:text-slate-200">Resume</span>
        </button>

        {/* Stop */}
        <button
          onClick={onPauseClick}
          disabled={!selectedTaskId}
          className="flex flex-col items-center justify-center min-w-[56px] px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed group cursor-pointer"
          title="Stop Selected Download"
        >
          <div className="w-6 h-6 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <StopCircle className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-slate-400 group-hover:text-slate-200">Stop</span>
        </button>

        {/* Stop All */}
        <button
          onClick={onStopAllClick}
          className="flex flex-col items-center justify-center min-w-[56px] px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition text-slate-300 hover:text-white group cursor-pointer"
          title="Stop All Downloads"
        >
          <div className="w-6 h-6 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <Hand className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-slate-400 group-hover:text-slate-200">Stop All</span>
        </button>

        {/* Delete */}
        <button
          onClick={onDeleteClick}
          disabled={!selectedTaskId}
          className="flex flex-col items-center justify-center min-w-[56px] px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed group cursor-pointer"
          title="Delete Download (Del)"
        >
          <div className="w-6 h-6 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <Trash2 className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-slate-400 group-hover:text-slate-200">Delete</span>
        </button>

        {/* Delete Completed */}
        <button
          onClick={onDeleteCompletedClick}
          className="flex flex-col items-center justify-center min-w-[62px] px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition text-slate-300 hover:text-white group cursor-pointer"
          title="Clear Completed Downloads"
        >
          <div className="w-6 h-6 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <Trash2 className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-slate-400 group-hover:text-slate-200 truncate max-w-[58px]">Clear Done</span>
        </button>

        <div className="h-7 w-[1px] bg-white/[0.08] mx-1" />

        {/* SPEED CHART & PROPERTIES */}
        <button
          onClick={onSpeedChartClick}
          className="flex flex-col items-center justify-center min-w-[64px] px-2 py-1.5 rounded-md hover:bg-blue-500/10 transition text-blue-400 hover:text-blue-300 group cursor-pointer"
          title="Inspect Real-Time & Historical Transfer Speed Curve (Alt+Enter)"
        >
          <div className="w-6 h-6 flex items-center justify-center text-blue-400 group-hover:text-blue-300 transition-colors">
            <TrendingUp className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-blue-400 group-hover:text-blue-300">Speed Chart</span>
        </button>

        {/* Options */}
        <button
          onClick={onOptionsClick}
          className="flex flex-col items-center justify-center min-w-[56px] px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition text-slate-300 hover:text-white group cursor-pointer"
          title="Options & Extension Setup"
        >
          <div className="w-6 h-6 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <Settings className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-slate-400 group-hover:text-slate-200">Options</span>
        </button>

        {/* Scheduler */}
        <button
          onClick={onSchedulerClick}
          className="flex flex-col items-center justify-center min-w-[58px] px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition text-slate-300 hover:text-white group cursor-pointer"
          title="Scheduler & Queue Automation"
        >
          <div className="w-6 h-6 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <Clock className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-slate-400 group-hover:text-slate-200">Scheduler</span>
        </button>

        {/* Start Queue */}
        <button
          onClick={onStartQueueClick}
          className="flex flex-col items-center justify-center min-w-[58px] px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition text-slate-300 hover:text-white group cursor-pointer"
          title="Start Main Download Queue"
        >
          <div className="w-6 h-6 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <PlaySquare className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-slate-400 group-hover:text-slate-200 truncate max-w-[56px]">Start Q</span>
        </button>

        {/* Stop Queue */}
        <button
          onClick={onStopQueueClick}
          className="flex flex-col items-center justify-center min-w-[58px] px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition text-slate-300 hover:text-white group cursor-pointer"
          title="Stop Main Download Queue"
        >
          <div className="w-6 h-6 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <StopQueueIcon className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-slate-400 group-hover:text-slate-200 truncate max-w-[56px]">Stop Q</span>
        </button>

        {/* Tell a Friend */}
        <button
          onClick={onTellFriendClick}
          className="flex flex-col items-center justify-center min-w-[60px] px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition text-slate-300 hover:text-white group cursor-pointer ml-auto"
          title="Tell a Friend / Share"
        >
          <div className="w-6 h-6 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
            <ThumbsUp className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight text-slate-400 group-hover:text-slate-200 truncate max-w-[60px]">Share</span>
        </button>
      </div>
    </div>
  );
};

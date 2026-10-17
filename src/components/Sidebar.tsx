import React, { useState } from 'react';
import { 
  Folder, FolderOpen, ChevronRight, ChevronDown, 
  Archive, FileText, Music, Package, Video, 
  Clock, CheckCircle, DownloadCloud, Layers, X
} from 'lucide-react';
import { CategoryFilter, StatusFilter, DownloadItem } from '../types';

interface SidebarProps {
  currentCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
  currentStatus: StatusFilter;
  onSelectStatus: (status: StatusFilter) => void;
  tasks: DownloadItem[];
  onCloseSidebar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentCategory,
  onSelectCategory,
  currentStatus,
  onSelectStatus,
  tasks,
  onCloseSidebar
}) => {
  const [allDownloadsOpen, setAllDownloadsOpen] = useState(true);
  const [unfinishedOpen, setUnfinishedOpen] = useState(false);
  const [finishedOpen, setFinishedOpen] = useState(false);

  const subCategories = [
    { id: 'Compressed', label: 'Compressed', icon: Archive },
    { id: 'Documents', label: 'Documents', icon: FileText },
    { id: 'Music', label: 'Music', icon: Music },
    { id: 'Programs', label: 'Programs', icon: Package },
    { id: 'Video', label: 'Video', icon: Video },
  ] as const;

  return (
    <aside className="w-52 bg-[#0d0f14] border-r border-white/[0.06] flex flex-col select-none text-xs text-slate-300 font-sans">
      {/* Categories Header */}
      <div className="h-7 px-3 bg-[#0a0c10] border-b border-white/[0.06] flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase text-slate-400">
        <span>Categories</span>
        {onCloseSidebar && (
          <button 
            onClick={onCloseSidebar}
            className="text-slate-500 hover:text-slate-200 cursor-pointer p-0.5 rounded hover:bg-white/5 transition"
            title="Hide Sidebar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tree View */}
      <div className="p-1.5 space-y-0.5 overflow-y-auto flex-1 text-[11px]">
        {/* All Downloads Root */}
        <div>
          <div
            onClick={() => {
              onSelectCategory('All');
              onSelectStatus('All');
            }}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition ${
              currentCategory === 'All' && currentStatus === 'All'
                ? 'bg-blue-600/15 text-blue-400 font-medium border-l-2 border-l-blue-500 pl-1.5'
                : 'hover:bg-white/[0.04] text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              onClick={(e) => { e.stopPropagation(); setAllDownloadsOpen(!allDownloadsOpen); }}
              className="text-slate-500 hover:text-slate-300 transition"
            >
              {allDownloadsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
            <FolderOpen className="w-4 h-4 text-slate-300 stroke-[1.75]" />
            <span className="font-sans text-[11px] text-slate-200">All Downloads</span>
          </div>

          {/* Sub Categories indented */}
          {allDownloadsOpen && (
            <div className="pl-4 space-y-0.5 mt-0.5 border-l border-white/[0.06] ml-3.5">
              {subCategories.map(({ id, label, icon: Icon }) => {
                const active = currentCategory === id;
                return (
                  <div
                    key={id}
                    onClick={() => {
                      onSelectCategory(id);
                      onSelectStatus('All');
                    }}
                    className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition ${
                      active
                        ? 'bg-blue-600/15 text-blue-400 font-medium border-l-2 border-l-blue-500 pl-1.5'
                        : 'hover:bg-white/[0.04] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 stroke-[1.75] ${active ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span className="font-sans text-[11px]">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Unfinished */}
        <div
          onClick={() => {
            onSelectCategory('All');
            onSelectStatus('Active');
            setUnfinishedOpen(!unfinishedOpen);
          }}
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition ${
            currentStatus === 'Active'
              ? 'bg-blue-600/15 text-blue-400 font-medium border-l-2 border-l-blue-500 pl-1.5'
              : 'hover:bg-white/[0.04] text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className={`w-3.5 h-3.5 stroke-[1.75] ${currentStatus === 'Active' ? 'text-blue-400' : 'text-slate-400'}`} />
          <span className="font-sans text-[11px]">Unfinished</span>
        </div>

        {/* Finished */}
        <div
          onClick={() => {
            onSelectCategory('All');
            onSelectStatus('Completed');
            setFinishedOpen(!finishedOpen);
          }}
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition ${
            currentStatus === 'Completed'
              ? 'bg-blue-600/15 text-blue-400 font-medium border-l-2 border-l-blue-500 pl-1.5'
              : 'hover:bg-white/[0.04] text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle className={`w-3.5 h-3.5 stroke-[1.75] ${currentStatus === 'Completed' ? 'text-blue-400' : 'text-slate-400'}`} />
          <span className="font-sans text-[11px]">Finished</span>
        </div>

        {/* Grabber projects (Filters videos / streams) */}
        <div
          onClick={() => {
            onSelectCategory('Video');
            onSelectStatus('All');
          }}
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition ${
            currentCategory === 'Video'
              ? 'bg-blue-600/15 text-blue-400 font-medium border-l-2 border-l-blue-500 pl-1.5'
              : 'hover:bg-white/[0.04] text-slate-400 hover:text-slate-200'
          }`}
        >
          <DownloadCloud className={`w-3.5 h-3.5 stroke-[1.75] ${currentCategory === 'Video' ? 'text-blue-400' : 'text-slate-400'}`} />
          <span className="font-sans text-[11px]">Grabber projects</span>
        </div>

        {/* Queues (Filters queued downloads) */}
        <div
          onClick={() => {
            onSelectCategory('All');
            onSelectStatus('Queued');
          }}
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition ${
            currentStatus === 'Queued'
              ? 'bg-blue-600/15 text-blue-400 font-medium border-l-2 border-l-blue-500 pl-1.5'
              : 'hover:bg-white/[0.04] text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className={`w-3.5 h-3.5 stroke-[1.75] ${currentStatus === 'Queued' ? 'text-blue-400' : 'text-slate-400'}`} />
          <span className="font-sans text-[11px]">Queues</span>
        </div>
      </div>
    </aside>
  );
};

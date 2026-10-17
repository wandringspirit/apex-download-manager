import React from 'react';
import { X, Globe, ShieldCheck, Zap, Cpu, Terminal, Key } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'about' | 'registration';
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose, mode = 'about' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-lg bg-[#13161c] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0f1117] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <Globe className="w-3 h-3 text-blue-400" />
            </div>
            <span className="font-semibold text-xs tracking-wide text-slate-100">
              {mode === 'registration' ? 'License & Architecture Registration' : 'About Apex Download Manager'}
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Main Title Badge */}
          <div className="flex items-center gap-4 p-3.5 bg-[#0b0d11] rounded-lg border border-white/[0.06]">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Globe className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Apex Download Manager
                <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[10px] font-mono border border-blue-500/30">
                  v6.42 PRO
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Precision Multi-socket Dynamic Range Download Engine & Stream Sniffer
              </div>
            </div>
          </div>

          {/* License Status Card */}
          <div className="p-3 bg-[#0b0d11] border border-white/[0.06] rounded-lg flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-slate-200">Perpetual Open License (MIT)</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                100% Free and open-source. Uncapped socket acceleration, zero telemetry trackers, zero trial expirations, and zero advertisements.
              </div>
            </div>
          </div>

          {/* Architecture Highlights */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Core Engine Architecture
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-[#0b0d11] border border-white/[0.06] flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-blue-400 stroke-[1.75]" />
                <span className="text-slate-300">1–64 Multi-socket Range Bisect</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0b0d11] border border-white/[0.06] flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-blue-400 stroke-[1.75]" />
                <span className="text-slate-300">Adaptive 429 Step-Down Guard</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0b0d11] border border-white/[0.06] flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-blue-400 stroke-[1.75]" />
                <span className="text-slate-300">Zero-Copy Positional Disk I/O</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0b0d11] border border-white/[0.06] flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-blue-400 stroke-[1.75]" />
                <span className="text-slate-300">Manifest V3 Network Sniffer</span>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="p-3 bg-[#0b0d11] rounded-lg border border-white/[0.06] space-y-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Keyboard Shortcuts
            </span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Add URL:</span>
                <kbd className="px-1.5 py-0.5 bg-white/[0.06] border border-white/10 rounded font-mono text-[10px] text-slate-200">Ctrl + N</kbd>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Speed Chart:</span>
                <kbd className="px-1.5 py-0.5 bg-white/[0.06] border border-white/10 rounded font-mono text-[10px] text-slate-200">Alt + Enter</kbd>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Delete Task:</span>
                <kbd className="px-1.5 py-0.5 bg-white/[0.06] border border-white/10 rounded font-mono text-[10px] text-slate-200">Delete</kbd>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Start Queue:</span>
                <kbd className="px-1.5 py-0.5 bg-white/[0.06] border border-white/10 rounded font-mono text-[10px] text-slate-200">Ctrl + S</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#0f1117] border-t border-white/[0.08] flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-mono">v6.42 Pro • Windows x64</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { X, Settings, Chrome, Folder, Cpu, CheckCircle2, Copy } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = React.useState(false);
  const [extensionPath, setExtensionPath] = React.useState<string>('Detecting path...');
  const [downloadsPath, setDownloadsPath] = React.useState<string>('~/Downloads');

  React.useEffect(() => {
    if (isOpen) {
      fetch('http://127.0.0.1:48911/api/status')
        .then(res => res.json())
        .then(data => {
          if (data.extensionPath) setExtensionPath(data.extensionPath);
          if (data.downloadsPath) setDownloadsPath(data.downloadsPath);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(extensionPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenFolder = () => {
    fetch('http://127.0.0.1:48911/api/open-extension-folder', { method: 'POST' }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-xl bg-[#13161c] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0f1117] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <Settings className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <h3 className="text-xs font-semibold text-slate-100 tracking-wide">Options &amp; Browser Integration</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Browser Extension Installation Card */}
          <div className="bg-[#0b0d11] border border-white/[0.06] p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Chrome className="w-4 h-4 text-blue-400" />
              <h4 className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider">
                Chrome / Edge Browser Extension Setup
              </h4>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Enable the native bridge to automatically intercept browser downloads and capture embedded video streams with the floating badge:
            </p>
            <ol className="text-slate-300 space-y-1.5 list-decimal list-inside bg-[#10131a] p-3 rounded-md border border-white/[0.06] font-mono text-[11px]">
              <li>Open <span className="text-blue-400">chrome://extensions</span> or <span className="text-blue-400">edge://extensions</span></li>
              <li>Toggle <strong className="text-slate-100 font-sans">Developer mode</strong> ON in the top-right corner</li>
              <li>Click the <strong className="text-slate-100 font-sans">Load unpacked</strong> button</li>
              <li>Select the directory below:</li>
            </ol>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={extensionPath}
                className="flex-1 px-3 py-1.5 bg-[#161922] border border-white/10 rounded-md text-xs font-mono text-slate-300 select-all"
              />
              <button
                onClick={handleCopyPath}
                className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-slate-200 rounded-md flex items-center gap-1.5 transition cursor-pointer"
                title="Copy Path to Clipboard"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleOpenFolder}
                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-medium text-blue-300 hover:text-white rounded-md flex items-center gap-1.5 transition cursor-pointer"
                title="Open Folder in File Explorer"
              >
                <Folder className="w-3.5 h-3.5" />
                Open
              </button>
            </div>
          </div>

          {/* Engine Settings */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Acceleration Engine Defaults
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0b0d11] border border-white/[0.06] p-3 rounded-lg">
                <div className="text-[11px] font-medium text-slate-200 flex items-center gap-1.5 mb-1">
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  Default Connections
                </div>
                <div className="text-xs text-slate-400 font-mono">32 parallel HTTP range streams</div>
              </div>

              <div className="bg-[#0b0d11] border border-white/[0.06] p-3 rounded-lg">
                <div className="text-[11px] font-medium text-slate-200 flex items-center gap-1.5 mb-1">
                  <Folder className="w-3.5 h-3.5 text-blue-400" />
                  Default Save Folder
                </div>
                <div className="text-xs text-slate-400 font-mono truncate" title={downloadsPath}>{downloadsPath}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#0f1117] border-t border-white/[0.08] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition cursor-pointer shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

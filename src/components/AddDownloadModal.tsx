import React, { useState } from 'react';
import { X, Download, Link2, Folder, Sliders } from 'lucide-react';

interface AddDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { url: string; fileName?: string; savePath?: string; maxConnections?: number; autoStart?: boolean }) => void;
}

export const AddDownloadModal: React.FC<AddDownloadModalProps> = ({
  isOpen,
  onClose,
  onAdd
}) => {
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [connections, setConnections] = useState(32);

  if (!isOpen) return null;

  const handleSubmit = (autoStart: boolean) => {
    if (!url.trim()) return;
    onAdd({
      url: url.trim(),
      fileName: fileName.trim() || undefined,
      maxConnections: connections,
      autoStart
    });
    setUrl('');
    setFileName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-lg bg-[#13161c] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0f1117] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <Download className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <h3 className="text-xs font-semibold text-slate-100 tracking-wide">Enter New Download URL</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              Download Address (URL)
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/file.zip or direct video URL"
              className="w-full px-3 py-2 bg-[#0b0d11] border border-white/10 rounded-lg text-slate-100 placeholder-slate-600 text-xs focus:outline-none focus:border-blue-500 transition font-mono"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-slate-400" />
              File Name (Optional - auto-detected if empty)
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g. Ubuntu-24.04-desktop.iso"
              className="w-full px-3 py-2 bg-[#0b0d11] border border-white/10 rounded-lg text-slate-100 placeholder-slate-600 text-xs focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                Concurrent Acceleration Sockets
              </label>
              <span className="text-[11px] font-mono font-semibold text-blue-400 tabular-nums">
                {connections} Threads
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="64"
              value={connections}
              onChange={(e) => setConnections(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-[#1e2330] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between items-center mt-2.5">
              <div className="flex gap-1.5">
                {[
                  { n: 8, label: '8 Safe' },
                  { n: 16, label: '16 Balanced' },
                  { n: 32, label: '32 Default' },
                  { n: 64, label: '64 Maximum' }
                ].map(({ n, label }) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setConnections(n)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                      connections === n
                        ? 'bg-blue-600 text-white font-medium shadow-sm'
                        : 'bg-white/[0.05] hover:bg-white/[0.09] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {connections >= 64 ? 'Fiber Line Saturation' : connections >= 32 ? 'High-Performance' : 'Standard'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#0f1117] border-t border-white/[0.08] flex items-center justify-end gap-2.5">
          <button
            onClick={() => handleSubmit(false)}
            disabled={!url.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white text-xs font-medium transition disabled:opacity-30 cursor-pointer"
          >
            Add to Queue
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={!url.trim()}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition disabled:opacity-30 cursor-pointer shadow-sm"
          >
            Download Now
          </button>
        </div>
      </div>
    </div>
  );
};

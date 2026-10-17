import React, { useState } from 'react';
import { X, ThumbsUp, Copy, Check } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const shareText = "Apex Download Manager — High-performance multi-socket download accelerator with real-time transfer telemetry and full browser integration.";

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-md bg-[#13161c] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
        <div className="px-4 py-3 bg-[#0f1117] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <ThumbsUp className="w-3.5 h-3.5 stroke-[1.75]" />
            </div>
            <span className="font-semibold text-xs tracking-wide text-slate-100">
              Share Apex Download Manager
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <p className="text-slate-400 leading-relaxed">
            Share Apex Download Manager with colleagues or other developers who need high-throughput downloads:
          </p>

          <div className="p-3 bg-[#0b0d11] rounded-lg border border-white/[0.06] font-mono text-[11px] text-slate-300 select-all leading-relaxed">
            {shareText}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer transition shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied to Clipboard' : 'Copy Share Text'}
            </button>
          </div>
        </div>

        <div className="px-4 py-2.5 bg-[#0f1117] border-t border-white/[0.08] flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 text-xs cursor-pointer transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

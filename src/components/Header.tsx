import React from 'react';
import { Download, Sliders, Play, Pause, RotateCcw } from 'lucide-react';

interface HeaderProps {
  onExportConfig: () => void;
  onOpenReportModal: () => void;
  onResetMachine: () => void;
  onOpenNewTab?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onExportConfig,
  onOpenReportModal,
  onResetMachine,
  onOpenNewTab,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900 border-b border-slate-800 text-slate-100 select-none">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
        <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white shadow-md shadow-sky-950 font-mono text-sm">
          TX
        </div>
        <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 font-sans">
          TexTear 3D
        </span>
      </div>

      {/* Zone 2: 4–5 clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
        <a href="#machine" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
          Mô hình máy
        </a>
        <a href="#kinematics" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
          Động học trục
        </a>
        <a href="#clearance" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
          Khe hở khe dao
        </a>
        <a href="#diagnostics" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
          Chuẩn đoán lỗi
        </a>
        <a href="#suction" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
          Hệ thống hút
        </a>
      </nav>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {onOpenNewTab && (
          <button
            onClick={onOpenNewTab}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
            title="Mở ứng dụng sang tab mới độc lập hoặc sao chép link"
          >
            <span>Mở tab mới ↗</span>
          </button>
        )}
        <button
          onClick={onExportConfig}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-100 bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Xuất thông số máy</span>
        </button>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, Info, Globe, Monitor } from 'lucide-react';

interface OpenTabModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OpenTabModal: React.FC<OpenTabModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Đường link trực tiếp của ứng dụng (lấy động từ trình duyệt)
  const currentHref = typeof window !== 'undefined' ? window.location.href : '';
  const appUrl =
    currentHref && !currentHref.includes('about:blank')
      ? currentHref
      : 'https://ais-pre-c5hedmtgzmimd24z2gxb7g-476277255723.asia-southeast1.run.app';

  const handleCopy = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(appUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = appUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <ExternalLink className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">Mở Ứng Dụng Sang Tab Mới</h2>
              <p className="text-xs text-slate-400">Xem toàn màn hình không bị giới hạn khung nhúng</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs text-slate-300">
          {/* Thông báo lý do trình duyệt chặn popup */}
          <div className="p-3.5 bg-amber-950/40 border border-amber-800/80 rounded-xl flex items-start gap-2.5 text-amber-200 text-xs">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Trình duyệt đang chặn mở tab tự động từ khung nhúng (iframe sandbox). Bạn có thể bấm nút <strong>Mở trực tiếp</strong> bên dưới hoặc <strong>sao chép đường link</strong> rồi dán vào thanh địa chỉ của trình duyệt.
            </p>
          </div>

          {/* Ô hiển thị URL và nút Sao chép */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 block">Đường link trực tiếp của bạn:</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-sky-300 outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1.5 shrink-0 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>
            {copied && (
              <span className="text-[11px] text-emerald-400 font-medium block pt-0.5">
                ✓ Đã sao chép link! Bạn chỉ cần nhấn Ctrl+V vào tab mới của trình duyệt.
              </span>
            )}
          </div>

          {/* Cách mở qua nút có sẵn trên giao diện AI Studio */}
          <div className="p-4 bg-slate-950 rounded-xl border border-sky-500/30 space-y-3 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 font-semibold text-sky-300 text-xs">
              <Monitor className="w-4 h-4 text-sky-400" />
              <span>Vị trí nút &quot;Mở tab mới&quot; trên thanh của Google AI Studio (Nằm BÊN NGOÀI màn hình ứng dụng):</span>
            </div>
            
            {/* Minh họa trực quan thanh tiêu đề Google AI Studio */}
            <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-700 space-y-1 font-mono text-[10px]">
              <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
                <span className="text-slate-500">Khung xem trước của AI Studio</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">localhost:3000</span>
                  {/* Nút ↗ được highlight nhấp nháy */}
                  <span className="px-2 py-0.5 bg-sky-500 text-white rounded font-bold animate-pulse flex items-center gap-1 shadow-sm shadow-sky-400">
                    ↗ BẤM NÚT NÀY
                  </span>
                </div>
              </div>
              <p className="text-slate-400 font-sans text-[11px] pt-1">
                Nút này nằm ở <strong>góc trên bên phải của khung preview của Google</strong> (ngay phía trên dòng chữ <em>TX TexTear 3D</em>). Bấm vào biểu tượng <strong>↗</strong> đó sẽ mở tab mới 100% không bị trình duyệt chặn!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors"
          >
            Đóng lại
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Sao chép link</span>
            </button>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Mở tab mới ngay ↗</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

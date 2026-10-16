import React, { useState } from 'react';
import { MachineComponent, SuctionSystemConfig, MaterialFeedConfig, ClearanceItem, TechnicalConflict } from '../types/machine';
import { X, Copy, Check, Download, FileText, CheckCircle2 } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: MachineComponent[];
  suctionConfig: SuctionSystemConfig;
  materialConfig: MaterialFeedConfig;
  clearances: ClearanceItem[];
  conflicts: TechnicalConflict[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  components,
  suctionConfig,
  materialConfig,
  clearances,
  conflicts,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'json' | 'report'>('report');

  if (!isOpen) return null;

  const exportData = {
    exportedAt: new Date().toISOString(),
    machineSummary: {
      totalComponents: components.length,
      material: materialConfig.materialName,
      feedRateKgH: materialConfig.feedRateKgPerHour,
      suctionVelocityMs: suctionConfig.airVelocity,
      safetyStatus: conflicts.length === 0 ? 'AN TOÀN' : `${conflicts.length} VẤN ĐỀ CẦN LƯU Ý`,
    },
    components,
    suctionConfig,
    materialConfig,
    clearances,
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  // Báo cáo kỹ thuật bằng văn bản tiếng Việt
  const technicalReport = `=====================================================
BÁO CÁO KỸ THUẬT CẤU HÌNH & AN TOÀN MÁY XÉ VẢI CÔNG NGHIỆP
Thời gian xuất: ${new Date().toLocaleString('vi-VN')}
=====================================================

1. THÔNG SỐ VẬN HÀNH & NGUYÊN LIỆU:
- Loại nguyên liệu: ${materialConfig.materialName}
- Hướng cấp liệu: ${materialConfig.feedDirection === 'left_to_right' ? 'Trái sang Phải' : 'Phải sang Trái'}
- Tốc độ cấp: ${materialConfig.feedSpeedMPerMin} m/phút (Năng suất: ${materialConfig.feedRateKgPerHour} kg/giờ)
- Lực căng danh định: ${materialConfig.nominalTensionN} N
- Hệ thống hút gió: ${suctionConfig.active ? 'ĐANG BẬT' : 'TẮT'} | Tốc độ gió: ${suctionConfig.airVelocity} m/s | Lưu lượng: ${suctionConfig.airflowRate} m3/h

2. DANH MỤC TRỤC & CHI TIẾT MÁY (${components.length} chi tiết):
${components
  .map(
    (c, i) =>
      ` ${i + 1}. ${c.name} [${c.type}]
    - Tọa độ tâm: X=${c.x} mm, Y=${c.y} mm
    - Đường kính Ø: ${c.diameter} mm | Chiều dài: ${c.length} mm
    - Chiều quay: ${c.rotationDir} | Tốc độ: ${c.rpm} RPM
    - Bề mặt: ${c.surfaceType}`
  )
  .join('\n')}

3. BẢNG CỰ LY KHE HỞ THỰC TẾ (CLEARANCE MATRIX):
${clearances
  .map(
    (cl) =>
      `- ${cl.nameA} ↔ ${cl.nameB}: ${cl.gapMm} mm [Chuẩn: ${cl.recommendedGapMin}-${cl.recommendedGapMax}mm] -> ${
        cl.gapMm < 0 ? 'CẢNH BÁO VA CHẠM' : cl.status === 'optimal' ? 'ĐẠT CHUẨN' : 'CẦN CHỈNH'
      }`
  )
  .join('\n')}

4. KẾT QUẢ CHẨN ĐOÁN LỖI KỸ THUẬT:
${
  conflicts.length === 0
    ? '✔ KHÔNG CÓ XUNG ĐỘT KỸ THUẬT. Hệ thống đạt độ an toàn vận hành cao nhất.'
    : conflicts
        .map(
          (cf, i) =>
            `[${cf.level.toUpperCase()}] ${i + 1}. ${cf.title}
   Chi tiết: ${cf.description}
   Khắc phục: ${cf.recommendation}`
        )
        .join('\n\n')
}
=====================================================`;

  const textToCopy = activeTab === 'json' ? jsonString : technicalReport;

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([textToCopy], { type: activeTab === 'json' ? 'application/json' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab === 'json' ? 'may_xe_vai_config.json' : 'bao_cao_ky_thuat_may_xe_vai.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-semibold text-slate-100">Xuất Thông Số & Báo Cáo Kỹ Thuật Máy</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('report')}
            className={`pb-2.5 font-medium border-b-2 transition-colors ${
              activeTab === 'report' ? 'border-sky-500 text-sky-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Báo cáo kỹ thuật chi tiết (.txt)
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`pb-2.5 font-medium border-b-2 transition-colors ${
              activeTab === 'json' ? 'border-sky-500 text-sky-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Cấu hình dữ liệu JSON (.json)
          </button>
        </div>

        {/* Code Content View */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-[11px] bg-slate-950 text-slate-300 whitespace-pre">
          {textToCopy}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900">
          <span className="text-xs text-slate-400">
            {conflicts.length === 0 ? 'Trạng thái: Hoàn toàn an toàn' : `Cảnh báo: ${conflicts.length} điểm cần xử lý`}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải tập tin về máy</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

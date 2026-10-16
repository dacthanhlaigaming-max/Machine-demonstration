import React from 'react';
import { TechnicalConflict, ClearanceItem, MachineComponent, SuctionSystemConfig } from '../types/machine';
import { AlertCircle, AlertTriangle, CheckCircle2, Wrench, ShieldAlert, Wind, ArrowRight, Gauge } from 'lucide-react';

interface DiagnosticPanelProps {
  conflicts: TechnicalConflict[];
  clearances: ClearanceItem[];
  components: MachineComponent[];
  suctionConfig: SuctionSystemConfig;
  onAutoFixConflict?: (conflict: TechnicalConflict) => void;
  onOpenGapCalibrator: (idA: string, idB: string) => void;
  onSelectComponent: (id: string) => void;
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({
  conflicts,
  clearances,
  components,
  suctionConfig,
  onAutoFixConflict,
  onOpenGapCalibrator,
  onSelectComponent,
}) => {
  const dangerCount = conflicts.filter((c) => c.level === 'danger').length;
  const warningCount = conflicts.filter((c) => c.level === 'warning').length;
  const infoCount = conflicts.filter((c) => c.level === 'info').length;

  return (
    <div className="p-4 space-y-4 text-xs text-slate-200">
      {/* Thẻ tổng quan chỉ số an toàn máy */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          dangerCount > 0 ? 'bg-rose-950/60 border-rose-700 text-rose-300' : 'bg-slate-900 border-slate-800 text-slate-400'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium">Xung đột nguy hiểm</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <span className="text-xl font-bold font-mono mt-1 text-rose-400">{dangerCount}</span>
        </div>

        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          warningCount > 0 ? 'bg-amber-950/60 border-amber-700 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium">Cảnh báo kỹ thuật</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xl font-bold font-mono mt-1 text-amber-400">{warningCount}</span>
        </div>

        <div className="p-3 rounded-lg border bg-slate-900 border-slate-800 flex flex-col justify-between text-slate-400">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium">Gợi ý tối ưu</span>
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-xl font-bold font-mono mt-1 text-sky-400">{infoCount}</span>
        </div>
      </div>

      {/* Danh sách lỗi kỹ thuật phát hiện tự động */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-sky-400" /> Phân Tích Lỗi Kỹ Thuật Tự Động
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Thời gian thực</span>
        </div>

        {conflicts.length === 0 ? (
          <div className="p-5 text-center bg-slate-900/60 rounded-xl border border-slate-800">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-emerald-400 text-sm">Hệ Thống Vận Hành Hoàn Hảo</p>
            <p className="text-slate-400 text-xs mt-1">
              Không phát hiện xung đột chiều quay, không va chạm cơ khí, lực căng vải và lưu lượng hút đều đạt chuẩn.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {conflicts.map((c) => {
              const isDanger = c.level === 'danger';
              const isWarning = c.level === 'warning';

              return (
                <div
                  key={c.id}
                  className={`p-3.5 rounded-lg border transition-all ${
                    isDanger
                      ? 'bg-rose-950/40 border-rose-800/80'
                      : isWarning
                      ? 'bg-amber-950/30 border-amber-800/70'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isDanger ? (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      )}
                      <h4
                        className={`font-semibold text-xs leading-snug ${
                          isDanger ? 'text-rose-200' : isWarning ? 'text-amber-200' : 'text-slate-200'
                        }`}
                      >
                        {c.title}
                      </h4>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">{c.description}</p>

                  {/* Khuyến nghị giải pháp */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-start justify-between gap-3">
                    <div className="text-[11px] text-slate-400">
                      <strong className="text-sky-300">Khắc phục:</strong> {c.recommendation}
                    </div>
                    {onAutoFixConflict && (
                      <button
                        onClick={() => onAutoFixConflict(c)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded font-medium text-[11px] shrink-0 flex items-center gap-1 transition-colors border border-slate-700"
                        title="Tự động áp dụng thông số chuẩn khắc phục lỗi này"
                      >
                        <Wrench className="w-3 h-3 text-sky-400" />
                        <span>Sửa ngay</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bảng ma trận cự ly khe hở giữa các chi tiết lân cận */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-sky-400" /> Ma Trận Cự Ly Khe Hở Thực Tế (mm)
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Dưới 120mm</span>
        </div>

        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[9px]">
                <tr>
                  <th className="py-2 px-3">Cặp chi tiết máy</th>
                  <th className="py-2 px-2 text-right">Khe hở thực</th>
                  <th className="py-2 px-2 text-right">Chuẩn kỹ thuật</th>
                  <th className="py-2 px-2 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {clearances.slice(0, 6).map((c) => {
                  const isCollision = c.gapMm < 0;
                  const isTight = c.status === 'warning_tight';

                  return (
                    <tr key={`${c.idA}-${c.idB}`} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 font-sans text-slate-300">
                        <span className="truncate max-w-[120px] block" title={`${c.nameA} - ${c.nameB}`}>
                          {c.nameA} ↔ {c.nameB}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded ${
                            isCollision
                              ? 'bg-rose-950 text-rose-300'
                              : isTight
                              ? 'bg-amber-950 text-amber-300'
                              : 'text-emerald-400'
                          }`}
                        >
                          {c.gapMm} mm
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-slate-400">
                        {c.recommendedGapMin} - {c.recommendedGapMax} mm
                      </td>
                      <td className="py-2 px-2 text-center font-sans">
                        <button
                          onClick={() => onOpenGapCalibrator(c.idA, c.idB)}
                          className="text-[10px] text-sky-400 hover:text-sky-300 font-medium hover:underline"
                        >
                          Chỉnh
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { MachineComponent, ClearanceItem } from '../types/machine';
import { calculateGap } from '../utils/physicsEngine';
import { NumericInput } from './RollerInspector';
import { X, Check, Target, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';

interface GapCalibratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: MachineComponent[];
  initialIdA?: string | null;
  initialIdB?: string | null;
  onApplyGap: (movingCompId: string, newX: number, newY: number) => void;
}

export const GapCalibratorModal: React.FC<GapCalibratorModalProps> = ({
  isOpen,
  onClose,
  components,
  initialIdA,
  initialIdB,
  onApplyGap,
}) => {
  if (!isOpen) return null;

  // Chọn 2 chi tiết để cân chỉnh
  const defaultA = initialIdA || (components.length > 0 ? components[0].id : '');
  const defaultB = initialIdB || (components.length > 1 ? components[1].id : '');

  const [idA, setIdA] = useState<string>(defaultA);
  const [idB, setIdB] = useState<string>(defaultB === defaultA && components.length > 1 ? components[1].id : defaultB);

  const compA = components.find((c) => c.id === idA);
  const compB = components.find((c) => c.id === idB);

  // Cự ly mong muốn (mm)
  const [targetGapMm, setTargetGapMm] = useState<number>(2.0);
  const [movingChoice, setMovingChoice] = useState<'B' | 'A'>('B'); // Mặc định dịch chuyển B, giữ cố định A

  const currentCalc = compA && compB ? calculateGap(compA, compB) : { centerDist: 0, gapMm: 0 };

  // Khuyến nghị cự ly chuẩn nhanh
  const quickPresets = [
    { label: '0.8 mm (Cấp ép mỏng)', val: 0.8 },
    { label: '1.5 mm (Dao cắt - Trống)', val: 1.5 },
    { label: '2.0 mm (Trục Chải Worker)', val: 2.0 },
    { label: '2.5 mm (Trục Bóc Stripper)', val: 2.5 },
    { label: '3.5 mm (Mở xơ thô)', val: 3.5 },
  ];

  const handleApply = () => {
    if (!compA || !compB) return;

    // Chi tiết đứng yên và chi tiết di chuyển
    const stationary = movingChoice === 'B' ? compA : compB;
    const moving = movingChoice === 'B' ? compB : compA;

    const dx = moving.x - stationary.x;
    const dy = moving.y - stationary.y;
    const currentDist = Math.hypot(dx, dy);

    const sumRadius = compA.diameter / 2 + compB.diameter / 2;
    const newTargetDist = sumRadius + targetGapMm;

    let newX: number;
    let newY: number;

    if (currentDist === 0) {
      newX = Number((stationary.x + newTargetDist).toFixed(2));
      newY = Number(stationary.y.toFixed(2));
    } else {
      const ux = dx / currentDist;
      const uy = dy / currentDist;
      newX = Number((stationary.x + ux * newTargetDist).toFixed(2));
      newY = Number((stationary.y + uy * newTargetDist).toFixed(2));
    }

    onApplyGap(moving.id, newX, newY);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <Target className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">Căn Chỉnh Cự Ly Khe Hở Chính Xác</h2>
              <p className="text-xs text-slate-400">Thiết lập khe hở milimet chuẩn giữa trục xé, dao cắt và trục chải</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs text-slate-300">
          {/* Cặp chi tiết cần chỉnh */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">Chi tiết cố định (Gốc):</label>
              <select
                value={idA}
                onChange={(e) => setIdA(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
              >
                {components.map((c) => (
                  <option key={`a-${c.id}`} value={c.id}>
                    {c.name} (Ø{c.diameter}mm)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">Chi tiết cần dịch chuyển:</label>
              <select
                value={idB}
                onChange={(e) => setIdB(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
              >
                {components
                  .filter((c) => c.id !== idA)
                  .map((c) => (
                    <option key={`b-${c.id}`} value={c.id}>
                      {c.name} (Ø{c.diameter}mm)
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Trạng thái cự ly hiện tại */}
          {compA && compB && (
            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block text-[11px]">Cự ly khe hở hiện tại:</span>
                <span
                  className={`text-lg font-mono font-bold ${
                    currentCalc.gapMm < 0
                      ? 'text-rose-400'
                      : currentCalc.gapMm < 1
                      ? 'text-amber-400'
                      : 'text-sky-400'
                  }`}
                >
                  {currentCalc.gapMm} mm
                </span>
                <span className="text-slate-500 text-[10px] ml-2 font-mono">(Khoảng cách tâm: {currentCalc.centerDist} mm)</span>
              </div>
              {currentCalc.gapMm < 0 && (
                <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold bg-rose-950/60 px-2.5 py-1 rounded border border-rose-800">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Đang va chạm cơ khí!</span>
                </div>
              )}
            </div>
          )}

          {/* Nhập khe hở mong muốn */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-200">Cự ly khe hở mục tiêu (Target Clearance):</label>
              <div className="flex items-center gap-1.5">
                <NumericInput
                  step={0.1}
                  min={0.1}
                  max={100}
                  value={targetGapMm}
                  onChangeValue={(val) => setTargetGapMm(val)}
                  className="w-24 bg-slate-950 border border-sky-500 text-right px-2 py-1 font-mono text-base font-bold text-sky-300 rounded outline-none"
                />
                <span className="font-mono text-slate-400">mm</span>
              </div>
            </div>

            {/* Nút chọn nhanh cự ly kỹ thuật tiêu chuẩn */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {quickPresets.map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setTargetGapMm(p.val)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                    targetGapMm === p.val
                      ? 'bg-sky-600 text-white border-sky-500'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Phương hướng tịnh tiến */}
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400">
            <p>
              Hệ thống sẽ giữ nguyên tọa độ của{' '}
              <strong className="text-slate-200">{compA?.name}</strong> và tịnh tiến{' '}
              <strong className="text-sky-300">{compB?.name}</strong> dọc theo tia nối tâm để đạt chính xác{' '}
              <strong className="text-sky-400 font-mono">{targetGapMm} mm</strong>.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-slate-800 bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Áp dụng cự ly chuẩn</span>
          </button>
        </div>
      </div>
    </div>
  );
};

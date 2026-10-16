import React, { useState, useEffect, useRef } from 'react';
import { MachineComponent, RotationDirection, SurfaceType, RollerType, FabricRoutingConfig } from '../types/machine';
import { getLinearVelocity, calculateGap, rpmToHz, hzToRpm } from '../utils/physicsEngine';
import { Trash2, Copy, ArrowRightLeft, Compass, Gauge, Ruler, Cog, AlertCircle, Target, Sparkles, Sliders, Zap, Lock, Unlock, Route, Check } from 'lucide-react';

interface NumericInputProps {
  value: number;
  onChangeValue: (val: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  className?: string;
  placeholder?: string;
}

/**
 * Input số cho phép người dùng xóa trắng ("") để nhập lại số mới hoàn toàn (ví dụ xóa hết rồi gõ 800),
 * không bao giờ bị nhảy về giá trị 10 hay min trong khi đang gõ.
 * Hỗ trợ cả dấu chấm (.) và dấu phẩy (,) thập phân.
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChangeValue,
  min,
  max,
  step,
  className,
  placeholder,
}) => {
  const [text, setText] = useState<string>(() =>
    value !== undefined && !isNaN(value) ? String(value) : ''
  );
  const isFocusedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(value !== undefined && !isNaN(value) ? String(value) : '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    if (raw === '' || raw === '-' || raw === '.' || raw === ',') {
      return;
    }

    const normalized = raw.replace(',', '.');
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      onChangeValue(num);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (text === '' || isNaN(parseFloat(text.replace(',', '.')))) {
      const fallback = value !== undefined && !isNaN(value) ? value : (min ?? 0);
      setText(String(fallback));
      onChangeValue(fallback);
      return;
    }

    let num = parseFloat(text.replace(',', '.'));
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;

    setText(String(num));
    onChangeValue(num);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
    />
  );
};

interface GapInputItemProps {
  currentGap: number;
  onApply: (val: number) => void;
  isCollision: boolean;
  isTight: boolean;
}

const GapInputItem: React.FC<GapInputItemProps> = ({ currentGap, onApply, isCollision, isTight }) => {
  const [text, setText] = useState<string>(() => currentGap.toFixed(2));
  const isFocusedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(currentGap.toFixed(2));
    }
  }, [currentGap]);

  const commit = (inputStr?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const valToParse = (inputStr !== undefined ? inputStr : text).replace(',', '.').trim();
    const num = parseFloat(valToParse);
    if (!isNaN(num) && num >= 0.05 && num <= 200) {
      onApply(Number(num.toFixed(2)));
    } else {
      setText(currentGap.toFixed(2));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const normalized = raw.replace(',', '.').trim();
    const num = parseFloat(normalized);

    // Tự động dịch chuyển tức thời (debounce 350ms) ngay khi người dùng gõ số hợp lệ (ví dụ: gõ 2.5 hoặc 2,5)
    if (!isNaN(num) && num >= 0.05 && num <= 200) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onApply(Number(num.toFixed(2)));
      }, 350);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-slate-400">Nhập khe:</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onChange={handleInputChange}
        onBlur={() => {
          isFocusedRef.current = false;
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            isFocusedRef.current = false;
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={`w-14 bg-slate-950 border rounded px-1.5 py-0.5 text-right font-mono text-xs font-bold outline-none focus:ring-1 focus:ring-sky-400 ${
          isCollision
            ? 'border-rose-600 text-rose-300'
            : isTight
            ? 'border-amber-500 text-amber-300'
            : 'border-sky-500 text-sky-300'
        }`}
      />
      <button
        type="button"
        onClick={() => {
          isFocusedRef.current = false;
          commit();
        }}
        className="px-1.5 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-semibold cursor-pointer transition-colors shadow-sm flex items-center gap-0.5"
        title="Áp dụng khe hở vừa nhập (hoặc bấm Enter)"
      >
        <span>Áp dụng</span>
      </button>
      <span className="font-mono text-[10px] text-slate-400">mm</span>
    </div>
  );
};

interface RollerInspectorProps {
  selectedComponent: MachineComponent | null;
  allComponents: MachineComponent[];
  onUpdateComponent: (updated: MachineComponent) => void;
  onDeleteComponent: (id: string) => void;
  onDuplicateComponent: (id: string) => void;
  onOpenGapCalibrator: (idA: string) => void;
  onAdjustDistance: (activeId: string, otherId: string, targetGapMm: number) => void;
  onOpenCardClothingModal?: () => void;
  fabricRouting?: FabricRoutingConfig;
  onChangeFabricRouting?: (updated: FabricRoutingConfig) => void;
}

export const RollerInspector: React.FC<RollerInspectorProps> = ({
  selectedComponent,
  allComponents,
  onUpdateComponent,
  onDeleteComponent,
  onDuplicateComponent,
  onOpenGapCalibrator,
  onAdjustDistance,
  onOpenCardClothingModal,
  fabricRouting,
  onChangeFabricRouting,
}) => {
  if (!selectedComponent) {
    return (
      <div className="p-6 text-center text-slate-500 flex flex-col items-center justify-center h-full">
        <Cog className="w-10 h-10 text-slate-700 mb-3 animate-spin-slow" />
        <p className="text-sm font-medium text-slate-400">Chưa chọn trục hoặc chi tiết máy nào</p>
        <p className="text-xs text-slate-600 mt-1 max-w-xs">
          Nhấp chuột vào bất kỳ trục, trống, dao cắt hoặc ống hút trên khung nhìn 3D hoặc bản vẽ CAD để chỉnh sửa thông số.
        </p>
      </div>
    );
  }

  const v = getLinearVelocity(selectedComponent.diameter, selectedComponent.rpm);

  const handleChange = <K extends keyof MachineComponent>(key: K, value: MachineComponent[K]) => {
    onUpdateComponent({
      ...selectedComponent,
      [key]: value,
    });
  };

  return (
    <div className="p-4 space-y-5 text-slate-200 text-xs">
      {/* Header chi tiết */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-mono text-sky-400 font-semibold">
            {selectedComponent.type.replace('_', ' ')}
          </span>
          <input
            type="text"
            value={selectedComponent.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full mt-1 bg-slate-900 border border-slate-700 focus:border-sky-500 rounded px-2.5 py-1 text-sm font-semibold text-slate-100 outline-none"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0 pt-3">
          <button
            type="button"
            onClick={() => handleChange('isLocked', !selectedComponent.isLocked)}
            className={`p-1.5 rounded transition-colors ${
              selectedComponent.isLocked
                ? 'bg-amber-950/80 text-amber-300 border border-amber-600/70 font-semibold'
                : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={selectedComponent.isLocked ? 'Trục này đang bị khóa vị trí cố định. Bấm để mở khóa' : 'Khóa cố định vị trí trục này, chống kéo di chuyển'}
          >
            {selectedComponent.isLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onDuplicateComponent(selectedComponent.id)}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
            title="Nhân bản chi tiết"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteComponent(selectedComponent.id)}
            className="p-1.5 hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 rounded transition-colors"
            title="Xóa chi tiết"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Vị trí tọa độ X, Y (mm) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-sky-400" /> Tọa độ tâm trục (mm)
            {selectedComponent.isLocked && (
              <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                <Lock className="w-3 h-3" /> Đã khóa
              </span>
            )}
          </span>
          <button
            onClick={() => onOpenGapCalibrator(selectedComponent.id)}
            className="text-[11px] text-sky-400 hover:text-sky-300 underline font-medium"
          >
            Chỉnh cự ly khe hở chính xác
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Tọa độ X</span>
              <span className="font-mono text-slate-500">mm</span>
            </div>
            <div className="flex items-center gap-1">
              <NumericInput
                value={selectedComponent.x}
                onChangeValue={(val) => handleChange('x', val)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-slate-100 outline-none focus:border-sky-500"
              />
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleChange('x', selectedComponent.x + 1)}
                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px]"
                >
                  +1
                </button>
                <button
                  onClick={() => handleChange('x', selectedComponent.x - 1)}
                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px]"
                >
                  -1
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Tọa độ Y</span>
              <span className="font-mono text-slate-500">mm</span>
            </div>
            <div className="flex items-center gap-1">
              <NumericInput
                value={selectedComponent.y}
                onChangeValue={(val) => handleChange('y', val)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-slate-100 outline-none focus:border-sky-500"
              />
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleChange('y', selectedComponent.y + 1)}
                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px]"
                >
                  +1
                </button>
                <button
                  onClick={() => handleChange('y', selectedComponent.y - 1)}
                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px]"
                >
                  -1
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Căn chỉnh cự ly trực tiếp tới các vật thể xung quanh (Dao cắt, Trống xé, Trục Worker...) */}
      {(() => {
        const nearby = (allComponents || [])
          .filter((c) => c.id !== selectedComponent.id && c.type !== 'suction_hood')
          .map((other) => {
            const { centerDist, gapMm } = calculateGap(selectedComponent, other);
            return { other, centerDist, gapMm };
          })
          .sort((a, b) => Math.abs(a.gapMm) - Math.abs(b.gapMm))
          .slice(0, 4);

        if (nearby.length === 0) return null;

        return (
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-sky-400" /> Cự ly khe hở tới vật thể khác (mm)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Tự động dịch chuyển</span>
            </div>

            <div className="space-y-2">
              {nearby.map(({ other, gapMm }) => {
                const isCollision = gapMm < 0;
                const isTight = gapMm >= 0 && gapMm < 1.0;

                return (
                  <div key={other.id} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-200 truncate max-w-[140px]" title={other.name}>
                        ↔ {other.name}
                      </span>
                      <GapInputItem
                        currentGap={gapMm}
                        onApply={(val) => onAdjustDistance(selectedComponent.id, other.id, val)}
                        isCollision={isCollision}
                        isTight={isTight}
                      />
                    </div>

                    {/* Thanh trượt cự ly trực tiếp */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <input
                        type="range"
                        min="0.2"
                        max="20.0"
                        step="0.1"
                        value={Math.max(0.2, Math.min(20.0, gapMm))}
                        onChange={(e) => onAdjustDistance(selectedComponent.id, other.id, Number(e.target.value))}
                        className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                    </div>

                    {/* Các nút bấm tinh chỉnh cự ly siêu chuẩn (0.8mm, 1.5mm, 2.0mm, 2.5mm, 3.0mm) */}
                    <div className="flex items-center justify-between gap-1 pt-0.5 flex-wrap">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onAdjustDistance(selectedComponent.id, other.id, Number((gapMm - 0.5).toFixed(1)))}
                          className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[10px] cursor-pointer"
                          title="Thu hẹp 0.5mm"
                        >
                          -0.5
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustDistance(selectedComponent.id, other.id, Number((gapMm - 0.1).toFixed(1)))}
                          className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[10px] cursor-pointer"
                          title="Thu hẹp 0.1mm"
                        >
                          -0.1
                        </button>
                      </div>

                      {/* Các nút cự ly chuẩn công nghệ dệt xé */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onAdjustDistance(selectedComponent.id, other.id, 0.8)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                            Math.abs(gapMm - 0.8) < 0.05
                              ? 'bg-sky-600 text-white border-sky-400 font-bold'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                          title="0.8mm (Ép cấp)"
                        >
                          0.8
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustDistance(selectedComponent.id, other.id, 1.5)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                            Math.abs(gapMm - 1.5) < 0.05
                              ? 'bg-sky-600 text-white border-sky-400 font-bold'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                          title="1.5mm (Dao - Trống)"
                        >
                          1.5
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustDistance(selectedComponent.id, other.id, 2.0)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                            Math.abs(gapMm - 2.0) < 0.05
                              ? 'bg-sky-600 text-white border-sky-400 font-bold'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                          title="2.0mm (Worker - Trống)"
                        >
                          2.0
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustDistance(selectedComponent.id, other.id, 2.5)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                            Math.abs(gapMm - 2.5) < 0.05
                              ? 'bg-sky-600 text-white border-sky-400 font-bold ring-1 ring-sky-300'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                          title="2.5mm (Chuẩn khe hở)"
                        >
                          2.5
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustDistance(selectedComponent.id, other.id, 3.0)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                            Math.abs(gapMm - 3.0) < 0.05
                              ? 'bg-sky-600 text-white border-sky-400 font-bold'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                          title="3.0mm (Bông xốp)"
                        >
                          3.0
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onAdjustDistance(selectedComponent.id, other.id, Number((gapMm + 0.1).toFixed(1)))}
                          className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[10px] cursor-pointer"
                          title="Mở rộng 0.1mm"
                        >
                          +0.1
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustDistance(selectedComponent.id, other.id, Number((gapMm + 0.5).toFixed(1)))}
                          className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[10px] cursor-pointer"
                          title="Mở rộng 0.5mm"
                        >
                          +0.5
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Chế độ luồn vải / khe chải (Carding Action) cho trục chải, trục bóc, dao cắt */}
      {fabricRouting && onChangeFabricRouting && (selectedComponent.type === 'worker_roller' || selectedComponent.type === 'stripper_roller' || selectedComponent.type === 'cutter_knife' || selectedComponent.type === 'main_drum') && (() => {
        const currentStep = (fabricRouting.steps || []).find((s) => s.rollerId === selectedComponent.id);
        const currentMode = currentStep?.wrapMode || (selectedComponent.type === 'worker_roller' || selectedComponent.type === 'stripper_roller' ? 'carding_gap' : selectedComponent.type === 'cutter_knife' ? 'tangent' : 'under');
        const isEnabled = currentStep ? currentStep.enabled : true;

        const updateStepMode = (newMode: 'carding_gap' | 'under' | 'over' | 'tangent') => {
          const steps = fabricRouting.steps || [];
          const exists = steps.some((s) => s.rollerId === selectedComponent.id);
          const newSteps = exists
            ? steps.map((s) => (s.rollerId === selectedComponent.id ? { ...s, wrapMode: newMode, enabled: true } : s))
            : [...steps, { rollerId: selectedComponent.id, wrapMode: newMode, enabled: true }];
          onChangeFabricRouting({ ...fabricRouting, steps: newSteps, autoRoute: false });
        };

        const toggleEnabled = () => {
          const steps = fabricRouting.steps || [];
          const exists = steps.some((s) => s.rollerId === selectedComponent.id);
          const newSteps = exists
            ? steps.map((s) => (s.rollerId === selectedComponent.id ? { ...s, enabled: !s.enabled } : s))
            : [...steps, { rollerId: selectedComponent.id, wrapMode: currentMode, enabled: false }];
          onChangeFabricRouting({ ...fabricRouting, steps: newSteps, autoRoute: false });
        };

        return (
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5 text-emerald-400" /> Tuyến Đi Của Vải Qua Trục Này
              </span>
              <span className="font-mono text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
                {currentMode === 'carding_gap' ? 'Kẹp trong khe chải' : currentMode === 'over' ? 'Vòng trên' : currentMode === 'under' ? 'Vòng dưới' : 'Tiếp tuyến dao'}
              </span>
            </div>

            {(selectedComponent.type === 'worker_roller' || selectedComponent.type === 'stripper_roller') && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateStepMode('carding_gap')}
                    className={`py-2 px-2.5 rounded text-xs font-bold transition-all text-center col-span-2 flex items-center justify-center gap-1.5 ${
                      currentMode === 'carding_gap' && isEnabled
                        ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400 font-bold'
                        : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-700'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    <span>Chạy kẹp giữa trục & trống (Trong khe chải)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateStepMode('under')}
                    className={`py-1.5 px-2 rounded text-[11px] font-medium transition-colors text-center ${
                      currentMode === 'under' && isEnabled
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    Vòng ra mặt ngoài dưới
                  </button>

                  <button
                    type="button"
                    onClick={() => updateStepMode('over')}
                    className={`py-1.5 px-2 rounded text-[11px] font-medium transition-colors text-center ${
                      currentMode === 'over' && isEnabled
                        ? 'bg-sky-600 text-white font-bold shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    Vòng ra mặt ngoài trên
                  </button>
                </div>

                <div className="p-2 bg-emerald-950/60 border border-emerald-800/70 rounded text-[11px] text-emerald-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {currentMode === 'carding_gap'
                        ? 'Vải chạy kẹp chính xác qua khe hở kỹ thuật giữa trục và trống chính'
                        : 'Vải chạy vòng ra mặt ngoài'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={toggleEnabled}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      isEnabled
                        ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700 hover:bg-emerald-800'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {isEnabled ? 'Đang bật' : 'Đã tắt'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Kích thước hình học: Đường kính & Chiều dài */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-sky-400" /> Kích thước hình học (Hình trụ)
        </span>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Đường kính Ø</span>
              <span className="font-mono text-slate-500">mm</span>
            </div>
            <NumericInput
              min={20}
              max={1500}
              value={selectedComponent.diameter}
              onChangeValue={(val) => handleChange('diameter', val)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-slate-100 outline-none focus:border-sky-500"
            />
          </div>

          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Chiều dài trục L</span>
              <span className="font-mono text-slate-500">mm</span>
            </div>
            <NumericInput
              min={200}
              max={2500}
              value={selectedComponent.length}
              onChangeValue={(val) => handleChange('length', val)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-slate-100 outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Động học: Hướng quay & Tốc độ RPM */}
      {selectedComponent.type !== 'cutter_knife' && selectedComponent.type !== 'suction_hood' && (
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-sky-400" /> Động học quay & Chiều quay
          </span>

          {/* Chọn chiều quay */}
          <div>
            <label className="text-[11px] text-slate-400 mb-1.5 block">Chiều quay trục:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleChange('rotationDir', 'CW')}
                className={`py-2 px-3 rounded border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  selectedComponent.rotationDir === 'CW'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>↻ CW (Thuận kim)</span>
              </button>
              <button
                type="button"
                onClick={() => handleChange('rotationDir', 'CCW')}
                className={`py-2 px-3 rounded border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  selectedComponent.rotationDir === 'CCW'
                    ? 'bg-sky-950/80 border-sky-500 text-sky-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>↺ CCW (Ngược kim)</span>
              </button>
            </div>
          </div>

          {/* Tốc độ quay: Điều khiển bằng Tần Số Biến Tần (Hz) & RPM */}
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Tần số biến tần (Hz):
              </span>
              <div className="flex items-center gap-1">
                <NumericInput
                  min={5}
                  max={75}
                  step={0.5}
                  value={rpmToHz(selectedComponent.rpm)}
                  onChangeValue={(hz) => {
                    const newRpm = hzToRpm(hz);
                    onUpdateComponent({
                      ...selectedComponent,
                      rpm: newRpm,
                      frequencyHz: hz,
                    });
                  }}
                  className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono font-bold text-emerald-400 text-xs outline-none focus:border-sky-500"
                />
                <span className="font-mono text-xs text-slate-400 font-bold">Hz</span>
              </div>
            </div>

            {/* Slider điều chỉnh tần số Hz */}
            <input
              type="range"
              min="5"
              max="65"
              step="0.5"
              value={rpmToHz(selectedComponent.rpm)}
              onChange={(e) => {
                const hz = Number(e.target.value);
                const newRpm = hzToRpm(hz);
                onUpdateComponent({
                  ...selectedComponent,
                  rpm: newRpm,
                  frequencyHz: hz,
                });
              }}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />

            {/* Phím bấm chọn nhanh tần số công nghiệp chuẩn (Hz) */}
            <div className="flex items-center justify-between gap-1 pt-1">
              {[20, 35, 50, 60].map((presetHz) => (
                <button
                  key={presetHz}
                  type="button"
                  onClick={() => {
                    const newRpm = hzToRpm(presetHz);
                    onUpdateComponent({
                      ...selectedComponent,
                      rpm: newRpm,
                      frequencyHz: presetHz,
                    });
                  }}
                  className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors ${
                    Math.abs(rpmToHz(selectedComponent.rpm) - presetHz) < 1
                      ? 'bg-amber-600 text-white border-amber-400 font-bold shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
                  }`}
                >
                  {presetHz} Hz
                </button>
              ))}
            </div>

            {/* Thông số tương đương RPM & Vận tốc dài */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
              <div className="flex justify-between items-center bg-slate-950 px-2 py-1 rounded border border-slate-800/80">
                <span className="text-slate-400">Tốc độ góc:</span>
                <span className="font-mono font-semibold text-sky-400">{selectedComponent.rpm} RPM</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950 px-2 py-1 rounded border border-slate-800/80">
                <span className="text-slate-400">Vận tốc dài:</span>
                <span className="font-mono font-semibold text-emerald-400">{v} m/p</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bề mặt tang trống & Dạng răng kim */}
      <div className="space-y-3 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-slate-300 block">Dạng bề mặt làm việc:</label>
          {onOpenCardClothingModal && (
            <button
              type="button"
              onClick={onOpenCardClothingModal}
              className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold underline"
            >
              <Sparkles className="w-3 h-3 text-sky-400" />
              <span>Soi vi mô đồ kim</span>
            </button>
          )}
        </div>

        <select
          value={selectedComponent.surfaceType}
          onChange={(e) => handleChange('surfaceType', e.target.value as SurfaceType)}
          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
        >
          <option value="wire_teeth">Gai xé thép / Dây kim răng cưa nhọn (Wire Teeth)</option>
          <option value="fluted_steel">Khía rãnh thép kẹp chặt chống trượt (Fluted Steel)</option>
          <option value="smooth_rubber">Bọc cao su ép áp lực (Smooth Rubber)</option>
          <option value="blade">Lưỡi hợp kim dao cắt tĩnh (Alloy Blade)</option>
          <option value="mesh_perforated">Lưới inox đục lỗ hút gió (Perforated Mesh)</option>
        </select>

        {/* Thông số kỹ thuật chi tiết đồ kim (Tooth pitch, angle, height) */}
        {(selectedComponent.surfaceType === 'wire_teeth' ||
          selectedComponent.type === 'main_drum' ||
          selectedComponent.type === 'worker_roller' ||
          selectedComponent.type === 'stripper_roller') && (
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2 text-[11px]">
            <div className="flex items-center justify-between font-semibold text-sky-300">
              <span>Thông Số Đồ Kim Răng Cưa:</span>
              <span className="font-mono text-[10px] text-slate-400">Tiêu chuẩn dệt</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Bước kim p</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <NumericInput
                    step={0.1}
                    min={1.5}
                    max={10}
                    value={selectedComponent.toothPitchMm || (selectedComponent.type === 'main_drum' ? 3.2 : 2.8)}
                    onChangeValue={(val) => handleChange('toothPitchMm', val)}
                    className="w-full bg-transparent font-mono text-slate-100 text-xs outline-none"
                  />
                  <span className="text-[9px] text-slate-500">mm</span>
                </div>
              </div>

              <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Chiều cao H</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <NumericInput
                    step={0.1}
                    min={2}
                    max={12}
                    value={selectedComponent.toothHeightMm || (selectedComponent.type === 'main_drum' ? 4.8 : 3.5)}
                    onChangeValue={(val) => handleChange('toothHeightMm', val)}
                    className="w-full bg-transparent font-mono text-slate-100 text-xs outline-none"
                  />
                  <span className="text-[9px] text-slate-500">mm</span>
                </div>
              </div>

              <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Góc nghiêng</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <NumericInput
                    step={1}
                    min={50}
                    max={85}
                    value={selectedComponent.toothAngleDeg || (selectedComponent.type === 'main_drum' ? 70 : 65)}
                    onChangeValue={(val) => handleChange('toothAngleDeg', val)}
                    className="w-full bg-transparent font-mono text-slate-100 text-xs outline-none"
                  />
                  <span className="text-[9px] text-slate-500">°</span>
                </div>
              </div>
            </div>

            {onOpenCardClothingModal && (
              <button
                type="button"
                onClick={onOpenCardClothingModal}
                className="w-full mt-1.5 py-1.5 bg-sky-950/70 hover:bg-sky-900 text-sky-300 border border-sky-800 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Mở bảng giải phẫu đồ kim & tiêu chuẩn hãng</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Phân loại trục */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <label className="font-semibold text-slate-300 block">Chức năng công nghệ:</label>
        <select
          value={selectedComponent.type}
          onChange={(e) => handleChange('type', e.target.value as RollerType)}
          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
        >
          <option value="main_drum">Trống xé chính (Main Drum)</option>
          <option value="feed_roller">Trục ép / Cấp liệu (Feed Roller)</option>
          <option value="worker_roller">Trục chải (Worker Roller)</option>
          <option value="stripper_roller">Trục bóc (Stripper Roller)</option>
          <option value="cutter_knife">Dao cắt / Gạt tĩnh (Cutter Knife)</option>
          <option value="suction_hood">Miệng hút chân không (Suction Hood)</option>
          <option value="condenser_drum">Trống ngưng kết (Condenser Drum)</option>
        </select>
      </div>
    </div>
  );
};

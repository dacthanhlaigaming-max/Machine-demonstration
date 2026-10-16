import React from 'react';
import { FabricRoutingConfig, MaterialFeedConfig, MachineComponent, FabricPathStep } from '../types/machine';
import { calculateMaterialFeedRate } from '../utils/physicsEngine';
import {
  Route,
  ArrowRightLeft,
  MoveUp,
  MoveDown,
  Check,
  Sparkles,
  Layers,
  Palette,
  Eye,
  RotateCcw,
  Scale,
  Gauge,
  Zap,
} from 'lucide-react';

interface FabricRoutingPanelProps {
  fabricRouting: FabricRoutingConfig;
  onChangeFabricRouting: (updated: FabricRoutingConfig) => void;
  materialConfig: MaterialFeedConfig;
  onChangeMaterialConfig: (updated: MaterialFeedConfig) => void;
  components: MachineComponent[];
  isRunning: boolean;
}

export const FabricRoutingPanel: React.FC<FabricRoutingPanelProps> = ({
  fabricRouting,
  onChangeFabricRouting,
  materialConfig,
  onChangeMaterialConfig,
  components,
  isRunning,
}) => {
  // Lấy danh sách các trục và dao tham gia hành trình dải vải dệt (loại trừ miệng hút và trống ngưng kết)
  const routableComponents = components.filter((c) => c.type !== 'suction_hood' && c.type !== 'condenser_drum');

  const layers = materialConfig.fabricLayers || 2;
  const widthMm = fabricRouting.clothWidthMm || materialConfig.feedWidthMm || 850;
  const gsm = materialConfig.basisWeightGsm || 350;
  const speed = materialConfig.feedSpeedMPerMin || 12;

  const { kgPerHour, kgPerShift, linearMeterPerHour } = calculateMaterialFeedRate(
    speed,
    widthMm,
    gsm,
    layers
  );

  // Đảm bảo steps luôn chứa đầy đủ tất cả các trục hiện có trong máy (kể cả trục mới thêm vào)
  const existingStepMap = new Map((fabricRouting.steps || []).map((s) => [s.rollerId, s]));
  const steps: FabricPathStep[] = [];

  // 1. Giữ nguyên các trục đã được cấu hình trong fabricRouting.steps nếu component còn tồn tại
  (fabricRouting.steps || []).forEach((step) => {
    if (routableComponents.some((c) => c.id === step.rollerId)) {
      steps.push(step);
    }
  });

  // 2. Tự động đồng bộ các trục mới thêm vào máy (ví dụ: trục chải worker mới thêm vào)
  routableComponents.forEach((c) => {
    if (!existingStepMap.has(c.id)) {
      steps.push({
        rollerId: c.id,
        wrapMode:
          c.type === 'worker_roller' || c.type === 'stripper_roller'
            ? 'carding_gap'
            : c.type === 'cutter_knife'
            ? 'tangent'
            : 'under',
        enabled: true,
      });
    }
  });

  // 3. Nếu steps ban đầu rỗng hoàn toàn, tự động xếp theo thứ tự tọa độ
  if (steps.length === 0) {
    routableComponents
      .sort((a, b) =>
        materialConfig.feedDirection === 'left_to_right' ? a.x - b.x : b.x - a.x
      )
      .forEach((c) => {
        const isFeedBottom = c.id === 'feed_bottom' || c.id === 'feed_bottom_2';
        steps.push({
          rollerId: c.id,
          wrapMode:
            c.type === 'feed_roller'
              ? 'under'
              : c.type === 'cutter_knife'
              ? 'tangent'
              : c.type === 'worker_roller' || c.type === 'stripper_roller'
              ? 'carding_gap'
              : 'under',
          enabled: !isFeedBottom,
        });
      });
  }

  const handleToggleStep = (rollerId: string) => {
    const existing = steps.find((s) => s.rollerId === rollerId);
    let newSteps: FabricPathStep[];
    if (existing) {
      newSteps = steps.map((s) => (s.rollerId === rollerId ? { ...s, enabled: !s.enabled } : s));
    } else {
      const comp = components.find((c) => c.id === rollerId);
      const defaultMode =
        comp?.type === 'worker_roller' || comp?.type === 'stripper_roller'
          ? 'carding_gap'
          : comp?.type === 'cutter_knife'
          ? 'tangent'
          : 'under';
      newSteps = [...steps, { rollerId, wrapMode: defaultMode, enabled: true }];
    }
    onChangeFabricRouting({ ...fabricRouting, steps: newSteps, autoRoute: false });
  };

  const handleChangeWrapMode = (rollerId: string, wrapMode: FabricPathStep['wrapMode']) => {
    const newSteps = steps.map((s) => (s.rollerId === rollerId ? { ...s, wrapMode } : s));
    onChangeFabricRouting({ ...fabricRouting, steps: newSteps, autoRoute: false });
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIdx];
    newSteps[targetIdx] = temp;
    onChangeFabricRouting({ ...fabricRouting, steps: newSteps, autoRoute: false });
  };

  const handleResetAutoRoute = () => {
    const autoSteps: FabricPathStep[] = routableComponents
      .sort((a, b) =>
        materialConfig.feedDirection === 'left_to_right' ? a.x - b.x : b.x - a.x
      )
      .map((c) => {
        const isFeedBottom = c.id === 'feed_bottom' || c.id === 'feed_bottom_2';
        return {
          rollerId: c.id,
          wrapMode:
            c.type === 'feed_roller'
              ? 'under'
              : c.type === 'cutter_knife'
              ? 'tangent'
              : c.type === 'worker_roller' || c.type === 'stripper_roller'
              ? 'carding_gap'
              : 'under',
          enabled: !isFeedBottom,
        };
      });
    onChangeFabricRouting({ ...fabricRouting, steps: autoSteps, autoRoute: false });
  };

  const colorPresets = [
    { label: 'Xanh Denim', hex: '#2563eb' },
    { label: 'Trắng Cotton', hex: '#f8fafc' },
    { label: 'Xám Sợi Tái Sinh', hex: '#64748b' },
    { label: 'Đỏ Vải Vụn', hex: '#e11d48' },
    { label: 'Vàng Kaki', hex: '#d97706' },
  ];

  return (
    <div className="p-4 space-y-4 text-xs text-slate-200">
      {/* 1. Hướng nạp nguyên liệu chính */}
      <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4 text-sky-400" /> Hướng Nạp Vải / Bông Vào Máy
          </span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/70 px-2 py-0.5 rounded">
            {materialConfig.feedSpeedMPerMin} m/phút
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() =>
              onChangeMaterialConfig({ ...materialConfig, feedDirection: 'left_to_right' })
            }
            className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              materialConfig.feedDirection === 'left_to_right'
                ? 'bg-sky-600 border-sky-400 text-white shadow-md shadow-sky-950 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span>Trái ➔ Phải (Chuẩn)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeMaterialConfig({ ...materialConfig, feedDirection: 'right_to_left' })
            }
            className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              materialConfig.feedDirection === 'right_to_left'
                ? 'bg-sky-600 border-sky-400 text-white shadow-md shadow-sky-950 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span>Phải ➔ Trái (Nghịch)</span>
          </button>
        </div>
      </div>

      {/* 2. CẤP LIỆU: Số lượng vải / xơ cấp vào (Feed Capacity & Volume) */}
      <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-400" /> Số Lượng Vải / Bông Cấp Vào Máy
          </span>
          <span className="font-mono text-emerald-400 font-bold text-xs bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800/80">
            {kgPerHour} kg/giờ
          </span>
        </div>

        {/* Số lớp vải cấp vào */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Số lớp vải cấp cùng lúc (Dày mỏng):</span>
            <span className="font-mono text-sky-300 font-bold">{layers} lớp</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 6, 8].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  const updated = { ...materialConfig, fabricLayers: l };
                  const newRate = calculateMaterialFeedRate(speed, widthMm, gsm, l).kgPerHour;
                  updated.feedRateKgPerHour = newRate;
                  onChangeMaterialConfig(updated);
                }}
                className={`flex-1 py-1 rounded text-xs font-mono font-semibold border transition-all ${
                  layers === l
                    ? 'bg-sky-600 text-white border-sky-400 font-bold shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                {l}L
              </button>
            ))}
          </div>
        </div>

        {/* Định lượng vải GSM */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Định lượng vải (GSM):</span>
            <span className="font-mono text-slate-200 font-semibold">{gsm} g/m²</span>
          </div>
          <input
            type="range"
            min="150"
            max="750"
            step="25"
            value={gsm}
            onChange={(e) => {
              const val = Number(e.target.value);
              const updated = { ...materialConfig, basisWeightGsm: val };
              updated.feedRateKgPerHour = calculateMaterialFeedRate(speed, widthMm, val, layers).kgPerHour;
              onChangeMaterialConfig(updated);
            }}
            className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        {/* Tốc độ cấp liệu m/phút */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Tốc độ cấp băng chuyền vào:</span>
            <span className="font-mono text-emerald-300 font-semibold">{speed} m/phút</span>
          </div>
          <input
            type="range"
            min="2"
            max="25"
            step="0.5"
            value={speed}
            onChange={(e) => {
              const val = Number(e.target.value);
              const updated = { ...materialConfig, feedSpeedMPerMin: val };
              updated.feedRateKgPerHour = calculateMaterialFeedRate(val, widthMm, gsm, layers).kgPerHour;
              onChangeMaterialConfig(updated);
            }}
            className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        {/* Bảng tính sản lượng nạp liệu tức thời */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-[11px]">
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Sản lượng theo giờ:</span>
            <span className="font-mono text-emerald-400 font-bold text-xs">{kgPerHour} kg/h</span>
          </div>
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Năng suất ca 8 tiếng:</span>
            <span className="font-mono text-sky-400 font-bold text-xs">~{kgPerShift} kg/ca</span>
          </div>
        </div>
      </div>


      {/* 2. Danh sách các trục trong tuyến đường đi của vải */}
      <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Route className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-slate-100">Lộ Trình Luồn Vải Qua Từng Trục</span>
          </div>

          <button
            type="button"
            onClick={handleResetAutoRoute}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded text-[10px] font-medium border border-slate-700 transition-colors"
            title="Tự động xếp theo thứ tự tọa độ các trục"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Tự động sắp xếp</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Tích chọn trục vải sẽ đi qua, chọn kiểu quấn quanh trục (Mặt trên, Mặt dưới, hoặc Tiếp tuyến dao cắt):
        </p>

        {/* Danh sách các bước luồn vải */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {steps.map((step, idx) => {
            const comp = components.find((c) => c.id === step.rollerId);
            if (!comp) return null;

            return (
              <div
                key={step.rollerId}
                className={`p-2.5 rounded-lg border transition-all ${
                  step.enabled
                    ? 'bg-slate-950 border-slate-700 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={step.enabled}
                      onChange={() => handleToggleStep(step.rollerId)}
                      className="accent-sky-500 rounded cursor-pointer w-4 h-4 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-sky-400 font-bold">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-slate-100 truncate block">
                          {comp.name}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] text-slate-400">
                        Ø{comp.diameter}mm · X:{comp.x} Y:{comp.y}
                      </span>
                    </div>
                  </div>

                  {/* Nút dịch chuyển thứ tự */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveStep(idx, 'up')}
                      className="p-1 hover:bg-slate-800 disabled:opacity-30 text-slate-400 hover:text-slate-200 rounded"
                      title="Di chuyển lên trước"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === steps.length - 1}
                      onClick={() => handleMoveStep(idx, 'down')}
                      className="p-1 hover:bg-slate-800 disabled:opacity-30 text-slate-400 hover:text-slate-200 rounded"
                      title="Di chuyển xuống sau"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Chọn cách quấn tiếp xúc nếu được bật */}
                {step.enabled && (
                  <>
                    {/* Trường hợp trục chải worker roller hoặc trục bóc stripper: Bổ sung chế độ chạy trong khe chải */}
                    {comp.type === 'worker_roller' || comp.type === 'stripper_roller' ? (
                      <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-800/80">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'carding_gap')}
                            className={`py-1.5 px-2 rounded text-[10px] font-bold transition-all text-center col-span-2 flex items-center justify-center gap-1.5 ${
                              step.wrapMode === 'carding_gap'
                                ? 'bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400'
                                : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-700'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Giữa trục & trống (Chạy trong khe chải)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'under')}
                            className={`py-1 px-1.5 rounded text-[10px] font-medium transition-colors text-center ${
                              step.wrapMode === 'under'
                                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            Vòng ngoài dưới
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'over')}
                            className={`py-1 px-1.5 rounded text-[10px] font-medium transition-colors text-center ${
                              step.wrapMode === 'over'
                                ? 'bg-sky-600 text-white font-bold shadow-sm'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            Vòng ngoài trên
                          </button>
                        </div>

                        <div className="p-2 bg-emerald-950/70 border border-emerald-700/60 rounded text-[10px] text-emerald-200 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>
                              {step.wrapMode === 'carding_gap'
                                ? 'Dòng vải/xơ chạy kẹp chính xác trong khe hở kỹ thuật 1.5 - 3mm giữa trục chải và trống chính'
                                : 'Dòng vải chạy vòng ra ngoài trục vệ tinh'}
                            </span>
                          </span>
                          <span className="font-mono text-emerald-400 font-bold shrink-0 ml-1">
                            {step.wrapMode === 'carding_gap' ? 'Khe chải kẹp' : 'Vòng ngoài'}
                          </span>
                        </div>
                      </div>
                    ) : comp.type === 'main_drum' ? (
                      <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-800/80">
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'under')}
                            className={`py-1.5 px-1.5 rounded text-[10px] font-bold transition-all text-center ${
                              step.wrapMode === 'under'
                                ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            Ôm đáy & sườn ra
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'over')}
                            className={`py-1.5 px-1.5 rounded text-[10px] font-medium transition-colors text-center ${
                              step.wrapMode === 'over'
                                ? 'bg-sky-600 text-white font-bold shadow-sm'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            Ôm nửa trên đỉnh
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'tangent')}
                            className={`py-1.5 px-1.5 rounded text-[10px] font-medium transition-colors text-center ${
                              step.wrapMode === 'tangent'
                                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            Tiếp xúc xé
                          </button>
                        </div>

                        <div className="p-2 bg-indigo-950/70 border border-indigo-700/60 rounded text-[10px] text-indigo-200 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>
                              {step.wrapMode === 'under'
                                ? 'Cung ôm tự nhiên: Ôm từ dao cắt qua đáy và lượn lên sườn ra (~180° chu vi)'
                                : step.wrapMode === 'over'
                                ? 'Cung ôm đỉnh trống: Đi qua nửa trên chu vi (~160°)'
                                : 'Tiếp tuyến: Chạm tiếp xúc điểm xé'}
                            </span>
                          </span>
                          <span className="font-mono text-emerald-400 font-bold shrink-0 ml-1">
                            {step.wrapMode === 'under' ? 'Ôm đầy đủ ~180°' : 'Tiếp xúc'}
                          </span>
                        </div>
                      </div>
                    ) : comp.type === 'cutter_knife' ? (
                      <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-800/80">
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'over')}
                            className={`py-1.5 px-1.5 rounded text-[10px] font-bold transition-all text-center ${
                              step.wrapMode === 'over'
                                ? 'bg-sky-600 text-white shadow-md ring-1 ring-sky-400'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            Vòng trên dao cắt
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'tangent')}
                            className={`py-1.5 px-1.5 rounded text-[10px] font-medium transition-colors text-center ${
                              step.wrapMode === 'tangent'
                                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            Tiếp xúc mũi dao
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'under')}
                            className={`py-1.5 px-1.5 rounded text-[10px] font-medium transition-colors text-center ${
                              step.wrapMode === 'under'
                                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            Vòng dưới dao
                          </button>
                        </div>

                        <div className="p-2 bg-sky-950/70 border border-sky-700/60 rounded text-[10px] text-sky-200 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span>
                              {step.wrapMode === 'over'
                                ? 'Chuẩn xé vải: Vải đi dưới feed roller ➔ qua tấm chắn mỏng ➔ vòng trên dao cắt ➔ bị trống lớn kéo xuống xé tại khe cắt.'
                                : step.wrapMode === 'tangent'
                                ? 'Tiếp xúc mép cắt: Vải tiếp xúc trực tiếp tại lưỡi dao trước khi răng trống kéo vào.'
                                : 'Vòng qua đáy dưới của bệ dao cắt.'}
                            </span>
                          </span>
                          <span className="font-mono text-emerald-400 font-bold shrink-0 ml-1">
                            {step.wrapMode === 'over' ? 'Chuẩn máy xé' : step.wrapMode === 'tangent' ? 'Tiếp xúc' : 'Vòng dưới'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'over')}
                            className={`py-1 px-1.5 rounded text-[10px] font-medium transition-colors text-center ${
                              step.wrapMode === 'over'
                                ? 'bg-sky-600 text-white font-bold shadow-sm'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            Vòng trên
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'under')}
                            className={`py-1 px-1.5 rounded text-[10px] font-medium transition-colors text-center ${
                              step.wrapMode === 'under'
                                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            Vòng dưới
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeWrapMode(step.rollerId, 'tangent')}
                            className={`py-1 px-1.5 rounded text-[10px] font-medium transition-colors text-center ${
                              step.wrapMode === 'tangent'
                                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                          >
                            Tiếp xúc cắt
                          </button>
                        </div>

                        {comp.type === 'feed_roller' && step.wrapMode === 'under' && (
                          <div className="mt-2 p-2 bg-indigo-950/70 border border-indigo-700/60 rounded text-[10px] text-indigo-200 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>Quy tắc chuẩn: Đi vòng dưới feed roller ➔ ôm trục chuyển vào khe dao &amp; trống ➔ bị trống lớn cuốn xuống.</span>
                            </span>
                            <span className="font-mono text-emerald-400 font-bold shrink-0 ml-1">Chuẩn máy xé</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Tùy chỉnh mô hình 3D: Khổ vải & Màu sắc & Bông xơ */}
      <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-sky-400" /> Tùy Chỉnh Mô Hình Vải & Bông 3D
        </span>

        {/* Khổ rộng vải */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Khổ rộng dải vải 3D:</span>
            <span className="font-mono text-sky-300 font-bold">{fabricRouting.clothWidthMm || 850} mm</span>
          </div>
          <input
            type="range"
            min="400"
            max="1200"
            step="50"
            value={fabricRouting.clothWidthMm || 850}
            onChange={(e) =>
              onChangeFabricRouting({ ...fabricRouting, clothWidthMm: Number(e.target.value) })
            }
            className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        {/* Màu sắc mô hình vải */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] text-slate-400 block">Màu sắc tấm vải dệt 3D:</label>
          <div className="grid grid-cols-3 gap-1.5">
            {colorPresets.map((p) => (
              <button
                key={p.hex}
                type="button"
                onClick={() => onChangeFabricRouting({ ...fabricRouting, clothColor: p.hex })}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[10px] font-medium transition-all ${
                  fabricRouting.clothColor === p.hex
                    ? 'border-sky-400 bg-slate-800 text-white font-bold'
                    : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-slate-600 shrink-0"
                  style={{ backgroundColor: p.hex }}
                />
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bật hạt bông xơ 3D */}
        <label className="flex items-center gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={fabricRouting.fiberTuftParticles !== false}
            onChange={(e) =>
              onChangeFabricRouting({ ...fabricRouting, fiberTuftParticles: e.target.checked })
            }
            className="accent-sky-500 rounded cursor-pointer w-4 h-4"
          />
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Hiển thị cụm bông xơ 3D tơi xốp & luồng khí hút khi máy xé vải</span>
        </label>
      </div>

      {/* 4. Trạng thái chạy mô phỏng & Nguyên lý công nghệ chuẩn */}
      <div className="p-3 bg-slate-950 rounded-lg border border-emerald-950/60 text-[11px] text-slate-400 space-y-1.5">
        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          <span>Nguyên lý công nghệ máy xé tái chế vải vụn:</span>
        </div>
        <p className="leading-relaxed">
          Khi nhấn <strong className="text-emerald-400">{isRunning ? 'Tạm dừng' : 'Chạy thử'}</strong>: Tấm vải vụn dệt (Denim, Knit, Cotton) được nạp vào qua cặp trục ép và dao cắt. Khi tiếp xúc với răng kim trống xé chính và các cặp trục chải/trục bóc (Worker & Stripper), cấu trúc dệt bị đánh tơi hoàn toàn thành <strong className="text-amber-300">100% xơ bông tơi xốp</strong>.
        </p>
        <p className="leading-relaxed text-slate-300">
          Toàn bộ xơ bông thành phẩm được quạt hút hút vọt qua <strong className="text-emerald-400">Ống hút khí động</strong> (Pneumatic Suction Duct) chuyển sang cyclone/máy xé tiếp theo. Tuyệt đối không còn cuộn vải dệt nào chạy ra hay gập lại ở đầu ra.
        </p>
      </div>
    </div>
  );
};

import React from 'react';
import { MaterialFeedConfig, SuctionSystemConfig, TensionSegment, FabricRoutingConfig, MachineComponent, FabricPathStep } from '../types/machine';
import { ArrowLeftRight, Wind, Activity, Gauge, Flame, CheckCircle2, AlertTriangle, AlertCircle, Route, Sparkles, MoveUp, MoveDown, Check } from 'lucide-react';

interface MaterialTensionHUDProps {
  materialConfig: MaterialFeedConfig;
  onChangeMaterialConfig: (updated: MaterialFeedConfig) => void;
  suctionConfig: SuctionSystemConfig;
  onChangeSuctionConfig: (updated: SuctionSystemConfig) => void;
  tensions: TensionSegment[];
  fabricRouting: FabricRoutingConfig;
  onChangeFabricRouting: (updated: FabricRoutingConfig) => void;
  components: MachineComponent[];
  isRunning: boolean;
}

export const MaterialTensionHUD: React.FC<MaterialTensionHUDProps> = ({
  materialConfig,
  onChangeMaterialConfig,
  suctionConfig,
  onChangeSuctionConfig,
  tensions,
  fabricRouting,
  onChangeFabricRouting,
  components,
  isRunning,
}) => {
  // Lấy danh sách các trục có thể luồn vải (trừ miệng hút)
  const availableRollers = components.filter((c) => c.type !== 'suction_hood');

  // Khởi tạo các bước nếu chưa có
  const steps = fabricRouting.steps.length > 0
    ? fabricRouting.steps
    : availableRollers.map((r, i) => ({
        rollerId: r.id,
        wrapMode: (i % 2 === 0 ? 'under' : 'over') as FabricPathStep['wrapMode'],
        enabled: true,
      }));

  const handleToggleStep = (rollerId: string) => {
    const existing = steps.find((s) => s.rollerId === rollerId);
    let newSteps: FabricPathStep[];
    if (existing) {
      newSteps = steps.map((s) => (s.rollerId === rollerId ? { ...s, enabled: !s.enabled } : s));
    } else {
      newSteps = [...steps, { rollerId, wrapMode: 'under', enabled: true }];
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

  return (
    <div className="p-4 space-y-4 text-xs text-slate-200">
      {/* 1. Hướng đi của nguyên liệu & Cấu hình cấp vải */}
      <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <ArrowLeftRight className="w-4 h-4 text-sky-400" /> Luồng Cấp Nguyên Liệu (Vải/Bông)
          </span>
          <span className="font-mono text-[11px] text-slate-400">{materialConfig.feedRateKgPerHour} kg/giờ</span>
        </div>

        {/* Chuyển đổi hướng cấp liệu Trái ➔ Phải hoặc Phải ➔ Trái */}
        <div>
          <label className="text-[11px] text-slate-400 mb-1.5 block">Hướng di chuyển của vải/bông vào máy:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChangeMaterialConfig({ ...materialConfig, feedDirection: 'left_to_right' })}
              className={`py-2 px-3 rounded border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                materialConfig.feedDirection === 'left_to_right'
                  ? 'bg-sky-950/80 border-sky-500 text-sky-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Trái ➔ Phải (Tiêu chuẩn)</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeMaterialConfig({ ...materialConfig, feedDirection: 'right_to_left' })}
              className={`py-2 px-3 rounded border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                materialConfig.feedDirection === 'right_to_left'
                  ? 'bg-sky-950/80 border-sky-500 text-sky-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Phải ➔ Trái (Nghịch)</span>
            </button>
          </div>
        </div>

        {/* Loại nguyên liệu đầu vào */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Chủng loại vải xé:</label>
            <select
              value={materialConfig.materialType}
              onChange={(e) =>
                onChangeMaterialConfig({
                  ...materialConfig,
                  materialType: e.target.value as MaterialFeedConfig['materialType'],
                })
              }
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
            >
              <option value="cotton_denim">Vải bò / Denim dày (Khó xé)</option>
              <option value="knit_cotton">Vải thun dệt kim Cotton (Dễ dãn)</option>
              <option value="synthetic_poly">Vải sợi nhân tạo PE/Poly</option>
              <option value="blended_waste">Vải vụn hỗn hợp may mặc</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Tốc độ nạp (m/phút):</label>
            <input
              type="number"
              min="2"
              max="60"
              value={materialConfig.feedSpeedMPerMin}
              onChange={(e) =>
                onChangeMaterialConfig({
                  ...materialConfig,
                  feedSpeedMPerMin: Number(e.target.value),
                })
              }
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* 2. Tuyến Đường Luồn Vải & Hướng Đi Qua Các Trục (Fabric Threading Path) */}
      <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Route className="w-4 h-4 text-sky-400" /> Tuyến Đường Đi Của Vải / Bông (3D Routing)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeFabricRouting({ ...fabricRouting, autoRoute: !fabricRouting.autoRoute })}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                fabricRouting.autoRoute
                  ? 'bg-sky-950/80 border-sky-600 text-sky-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400'
              }`}
            >
              {fabricRouting.autoRoute ? 'TỰ ĐỘNG' : 'TỰ CHỌN'}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Chọn các trục mà dải vải/bông sẽ luồn qua, chọn cách quấn tiếp xúc (Mặt Trên / Mặt Dưới / Tiếp Tuyến Kẹp):
        </p>

        {/* Danh sách các trục trong tuyến luồn vải */}
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {availableRollers.map((r, idx) => {
            const step = steps.find((s) => s.rollerId === r.id);
            const isEnabled = step ? step.enabled : false;
            const wrapMode = step ? step.wrapMode : 'under';

            return (
              <div
                key={r.id}
                className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                  isEnabled ? 'bg-slate-950 border-slate-700' : 'bg-slate-950/40 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleToggleStep(r.id)}
                    className="accent-sky-500 rounded cursor-pointer w-3.5 h-3.5"
                  />
                  <div className="overflow-hidden">
                    <span className="font-semibold text-slate-200 truncate block max-w-[130px]">{r.name}</span>
                    <span className="font-mono text-[9px] text-slate-500">Ø{r.diameter}mm</span>
                  </div>
                </div>

                {/* Chọn cách quấn tiếp xúc */}
                {isEnabled && (
                  <div className="flex items-center gap-1">
                    {(r.type === 'worker_roller' || r.type === 'stripper_roller') && (
                      <button
                        type="button"
                        onClick={() => handleChangeWrapMode(r.id, 'carding_gap')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          wrapMode === 'carding_gap' ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Vải chạy trong khe chải kỹ thuật giữa trục và trống chính"
                      >
                        Khe chải
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleChangeWrapMode(r.id, 'under')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        wrapMode === 'under' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                      title={r.type === 'main_drum' ? 'Cung ôm tự nhiên: Qua đáy trống và lượn lên sườn ra (~180°)' : 'Vải luồn vòng cung mặt dưới'}
                    >
                      {r.type === 'main_drum' ? 'Ôm đầy đủ' : 'Dưới'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeWrapMode(r.id, 'over')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        wrapMode === 'over' ? 'bg-sky-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                      title="Vải luồn qua mặt trên tang trống"
                    >
                      Trên
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeWrapMode(r.id, 'tangent')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        wrapMode === 'tangent' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                      title="Tiếp xúc cắt mép dao"
                    >
                      Mép cắt
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Thiết lập khổ rộng và màu dải vải 3D */}
        <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <label className="text-slate-400 block mb-1">Khổ rộng vải 3D (mm):</label>
            <input
              type="number"
              min="400"
              max="1200"
              step="50"
              value={fabricRouting.clothWidthMm}
              onChange={(e) => onChangeFabricRouting({ ...fabricRouting, clothWidthMm: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Màu dải vải 3D:</label>
            <select
              value={fabricRouting.clothColor}
              onChange={(e) => onChangeFabricRouting({ ...fabricRouting, clothColor: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-sky-500"
            >
              <option value="#2563eb">Xanh Indigo (Denim / Vải Jean)</option>
              <option value="#f8fafc">Trắng Tinh (Bông xơ Cotton)</option>
              <option value="#64748b">Xám Đậm (Vải vụn hỗn hợp)</option>
              <option value="#f59e0b">Vàng Kaki (Sợi gai)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Giả lập Lực căng vải theo thời gian thực (Real-time Tension Gauges) */}
      <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" /> Lực Căng Vải Thời Gian Thực (Tension)
          </span>
          <span className="text-[10px] font-mono text-slate-400">Đơn vị: Newton (N)</span>
        </div>

        {tensions.length === 0 ? (
          <p className="text-[11px] text-slate-500 text-center py-2">Chưa đủ trục chuyển tiếp để tính lực căng liên tục.</p>
        ) : (
          <div className="space-y-2.5">
            {tensions.map((t) => {
              const isSnap = t.status === 'critical_snap';
              const isSlack = t.status === 'slack_wrap';
              const isHigh = t.status === 'warning_high';

              // Màu sắc thanh lực căng
              let barColor = 'bg-emerald-500';
              let badgeText = 'Tối ưu';
              let badgeColor = 'text-emerald-400 bg-emerald-950/70 border-emerald-700';

              if (isSnap) {
                barColor = 'bg-rose-500 animate-pulse';
                badgeText = 'Nguy cơ đứt';
                badgeColor = 'text-rose-400 bg-rose-950/70 border-rose-700';
              } else if (isSlack) {
                barColor = 'bg-sky-500';
                badgeText = 'Đùn dồn vải';
                badgeColor = 'text-sky-400 bg-sky-950/70 border-sky-700';
              } else if (isHigh) {
                barColor = 'bg-amber-500';
                badgeText = 'Căng cao';
                badgeColor = 'text-amber-400 bg-amber-950/70 border-amber-700';
              }

              // % hiển thị thanh progress (tối đa 600N)
              const percent = Math.min(100, Math.max(5, (t.tensionN / 600) * 100));

              return (
                <div key={`${t.fromId}-${t.toId}`} className="p-2.5 bg-slate-950 rounded border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-medium">
                      {t.fromName} ➔ {t.toName}
                    </span>
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${badgeColor}`}>
                      {badgeText}
                    </span>
                  </div>

                  {/* Thanh hiển thị lực căng */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${percent}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Lực căng: <strong className="text-slate-100">{t.tensionN} N</strong></span>
                    <span>Tỉ số kéo: <strong className="text-slate-100">{t.speedRatio}x</strong></span>
                    <span>V: {t.v1} ➔ {t.v2} m/m</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Hệ thống Hút Bụi & Thu Gom Bông Khí Động Học */}
      <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Wind className="w-4 h-4 text-emerald-400" /> Hệ Thống Hút Bụi & Thu Gom Bông
          </span>
          <button
            type="button"
            onClick={() => onChangeSuctionConfig({ ...suctionConfig, active: !suctionConfig.active })}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
              suctionConfig.active ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {suctionConfig.active ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
          </button>
        </div>

        {/* Tốc độ gió hút m/s */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Vận tốc gió tại miệng hút:</span>
            <span className={`font-mono font-bold ${suctionConfig.airVelocity < 20 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {suctionConfig.airVelocity} m/s
            </span>
          </div>
          <input
            type="range"
            min="12"
            max="34"
            step="0.5"
            value={suctionConfig.airVelocity}
            onChange={(e) =>
              onChangeSuctionConfig({
                ...suctionConfig,
                airVelocity: Number(e.target.value),
              })
            }
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>Yếu (12 m/s)</span>
            <span className="text-emerald-400 font-semibold">Chuẩn xé vải (22 - 26 m/s)</span>
            <span>Rất mạnh (34 m/s)</span>
          </div>
        </div>

        {/* Lưu lượng khí m3/h */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Lưu lượng quạt hút</span>
            <span className="font-mono font-semibold text-slate-100">{suctionConfig.airflowRate} m³/h</span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Đường kính ống dẫn</span>
            <span className="font-mono font-semibold text-slate-100">Ø {suctionConfig.ductDiameter} mm</span>
          </div>
        </div>

        {/* 5. Cấu hình Luồng Hút Khí Động Đáy Dưới Các Trục (Under-Roller Aerodynamics) */}
        <div className="pt-3 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-semibold text-xs text-cyan-300">Đường Luồng Hút Đáy (Under-Suction Path)</span>
            </div>
            <button
              type="button"
              onClick={() =>
                onChangeSuctionConfig({
                  ...suctionConfig,
                  showUnderSuctionPath: suctionConfig.showUnderSuctionPath === false ? true : false,
                })
              }
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                suctionConfig.showUnderSuctionPath !== false
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {suctionConfig.showUnderSuctionPath !== false ? 'ĐANG HIỆN' : 'ĐÃ ẨN'}
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Đường hút khí động học màu xanh chạy vòng dưới đáy các trục chải (worker) và thu gom toàn bộ xơ bông rơi xuống thẳng vào họng hút cuối.
          </p>

          {/* Slider & Presets điều chỉnh độ rộng / hạ sâu đường hút dưới trục (underSuctionOffsetMm) */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium">Khoảng cách / Độ rộng đường hút dưới trục:</span>
              <span className="font-mono font-bold text-sky-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                {suctionConfig.underSuctionOffsetMm ?? 45} mm
              </span>
            </div>
            <input
              type="range"
              min="15"
              max="160"
              step="5"
              value={suctionConfig.underSuctionOffsetMm ?? 45}
              onChange={(e) =>
                onChangeSuctionConfig({
                  ...suctionConfig,
                  underSuctionOffsetMm: Number(e.target.value),
                })
              }
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex gap-1.5 pt-1">
              {[
                { val: 25, label: 'Sát trục (25mm)' },
                { val: 45, label: 'Chuẩn (45mm)' },
                { val: 85, label: 'Rộng (85mm)' },
                { val: 140, label: 'Rất rộng (140mm)' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() =>
                    onChangeSuctionConfig({
                      ...suctionConfig,
                      underSuctionOffsetMm: item.val,
                    })
                  }
                  className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                    (suctionConfig.underSuctionOffsetMm ?? 45) === item.val
                      ? 'bg-cyan-600 text-white border-cyan-400 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
                  }`}
                >
                  {item.val}mm
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500 block italic">
              * Mẹo: Có thể dùng chuột kéo trực tiếp nút tròn xanh trên bản vẽ 2D để kéo rộng đường hút tùy ý.
            </span>
          </div>

          {/* Slider & Presets tỉ lệ xơ rơi qua khe hở do trọng lực (fallingFiberRatio) */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium">Tỉ lệ xơ rơi qua khe giữa các trục:</span>
              <span className="font-mono font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                {suctionConfig.fallingFiberRatio ?? 35} %
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="85"
              step="5"
              value={suctionConfig.fallingFiberRatio ?? 35}
              onChange={(e) =>
                onChangeSuctionConfig({
                  ...suctionConfig,
                  fallingFiberRatio: Number(e.target.value),
                })
              }
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex gap-1.5 pt-1">
              {[
                { val: 20, label: 'Ít (20%)' },
                { val: 35, label: 'Vừa (35%)' },
                { val: 60, label: 'Nhiều (60%)' },
                { val: 80, label: 'Tối đa (80%)' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() =>
                    onChangeSuctionConfig({
                      ...suctionConfig,
                      fallingFiberRatio: item.val,
                    })
                  }
                  className={`flex-1 py-1 rounded text-[10px] border transition-colors cursor-pointer ${
                    (suctionConfig.fallingFiberRatio ?? 35) === item.val
                      ? 'bg-amber-600 text-white border-amber-400 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lựa chọn kiểu dáng bông (tuftShape): Mảnh dẹt phẳng vs Tròn */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2">
            <span className="text-slate-300 font-medium text-[11px] block">Kiểu dáng hiển thị khối xơ bông 3D:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onChangeSuctionConfig({
                    ...suctionConfig,
                    tuftShape: 'fluffy_flake',
                  })
                }
                className={`py-2 px-2.5 rounded border text-left transition-colors cursor-pointer ${
                  (suctionConfig.tuftShape || 'fluffy_flake') === 'fluffy_flake'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="font-bold text-xs block">Mảnh xơ dẹt phẳng</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Vảy sợi vải rách tự nhiên (Không bị bọt khí)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeSuctionConfig({
                    ...suctionConfig,
                    tuftShape: 'round',
                  })
                }
                className={`py-2 px-2.5 rounded border text-left transition-colors cursor-pointer ${
                  suctionConfig.tuftShape === 'round'
                    ? 'bg-sky-950/80 border-sky-500 text-sky-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="font-bold text-xs block">Dạng hạt tròn</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Khối cầu đa diện tròn</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

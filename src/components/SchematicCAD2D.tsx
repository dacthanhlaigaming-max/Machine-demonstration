import React, { useRef, useState, useEffect } from 'react';
import { MachineComponent, SuctionSystemConfig, MaterialFeedConfig, ClearanceItem, TensionSegment, FabricRoutingConfig } from '../types/machine';
import { calculateGap, getLinearVelocity } from '../utils/physicsEngine';
import { buildContinuousFabricPath, convertPointsToSmoothSvgPath } from '../utils/fabricPath';
import { Move, ZoomIn, ZoomOut, Maximize2, AlertTriangle, ShieldCheck, Gauge, Lock, Wind, Plus, Minus, Sliders } from 'lucide-react';

interface SchematicCAD2DProps {
  components: MachineComponent[];
  selectedId: string | null;
  onSelectComponent: (id: string | null) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onOpenGapCalibrator: (idA: string, idB: string) => void;
  suctionConfig: SuctionSystemConfig;
  onChangeSuctionConfig?: (updated: SuctionSystemConfig) => void;
  materialConfig: MaterialFeedConfig;
  clearances: ClearanceItem[];
  tensions: TensionSegment[];
  isRunning: boolean;
  gridSnapMm: number;
  fabricRouting?: FabricRoutingConfig;
  isLocked?: boolean;
}

export const SchematicCAD2D: React.FC<SchematicCAD2DProps> = ({
  components,
  selectedId,
  onSelectComponent,
  onUpdatePosition,
  onOpenGapCalibrator,
  suctionConfig,
  onChangeSuctionConfig,
  materialConfig,
  clearances,
  tensions,
  isRunning,
  gridSnapMm,
  fabricRouting,
  isLocked = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 80, y: 380 }); // Tọa độ gốc CAD
  const [isPanning, setIsPanning] = useState(false);
  const [draggedCompId, setDraggedCompId] = useState<string | null>(null);
  const dragStartPos = useRef({ mouseX: 0, mouseY: 0, compX: 0, compY: 0 });
  const panStartPos = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });

  // Trạng thái kéo trực tiếp đường luồng hút khí động học dưới các trục chải
  const isDraggingUnderSuctionRef = useRef(false);
  const dragUnderSuctionStart = useRef({ mouseY: 0, startOffset: 45 });

  // Hoạt ảnh quay 2D
  const [rotationAngle, setRotationAngle] = useState(0);

  useEffect(() => {
    let animId: number;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (isRunning) {
        setRotationAngle((prev) => (prev + dt * 180) % 36000);
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning]);

  // Chuyển đổi tọa độ Máy (mm) sang Pixel trên SVG Canvas
  // Trong CAD: Trục Y hướng lên trên, SVG: Trục Y hướng xuống dưới
  const toScreen = (mmX: number, mmY: number) => {
    return {
      x: pan.x + mmX * zoom,
      y: pan.y - mmY * zoom,
    };
  };

  const toWorld = (screenX: number, screenY: number) => {
    return {
      x: Math.round((screenX - pan.x) / zoom),
      y: Math.round((pan.y - screenY) / zoom),
    };
  };

  // Xử lý kéo thả chi tiết
  const handleCompMouseDown = (e: React.MouseEvent, comp: MachineComponent) => {
    e.stopPropagation();
    onSelectComponent(comp.id);
    // Nếu toàn bộ dàn máy đang bị khóa hoặc chi tiết này bị khóa riêng, không cho phép kéo dịch chuyển!
    if (isLocked || comp.isLocked) {
      return;
    }
    setDraggedCompId(comp.id);
    dragStartPos.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      compX: comp.x,
      compY: comp.y,
    };
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Click nền để hủy chọn hoặc Pan
      if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
        onSelectComponent(null);
      }
      setIsPanning(true);
      panStartPos.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingUnderSuctionRef.current && onChangeSuctionConfig) {
      const dyScreen = e.clientY - dragUnderSuctionStart.current.mouseY;
      // Kéo chuột xuống dưới màn hình (dyScreen > 0) -> mở rộng độ võng cự ly dưới các trục
      const dyMm = dyScreen / zoom;
      const newOffset = Math.round(Math.max(15, Math.min(180, dragUnderSuctionStart.current.startOffset + dyMm)));
      onChangeSuctionConfig({
        ...suctionConfig,
        underSuctionOffsetMm: newOffset,
      });
      return;
    }

    if (draggedCompId) {
      const dx = (e.clientX - dragStartPos.current.mouseX) / zoom;
      const dy = -(e.clientY - dragStartPos.current.mouseY) / zoom; // Ngược chiều Y CAD

      let newX = dragStartPos.current.compX + dx;
      let newY = dragStartPos.current.compY + dy;

      // Snap theo lưới (gridSnapMm)
      if (gridSnapMm > 0) {
        newX = Math.round(newX / gridSnapMm) * gridSnapMm;
        newY = Math.round(newY / gridSnapMm) * gridSnapMm;
      }

      onUpdatePosition(draggedCompId, Math.round(newX), Math.round(newY));
      return;
    }

    if (isPanning) {
      const dx = e.clientX - panStartPos.current.mouseX;
      const dy = e.clientY - panStartPos.current.mouseY;
      setPan({
        x: panStartPos.current.panX + dx,
        y: panStartPos.current.panY + dy,
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingUnderSuctionRef.current = false;
    setDraggedCompId(null);
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(2.5, zoom * factor));

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom tương đối theo vị trí con trỏ chuột
      setPan({
        x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
        y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
      });
    }
    setZoom(newZoom);
  };

  const resetView = () => {
    setZoom(0.85);
    setPan({ x: 100, y: 420 });
  };

  // Tìm chi tiết đang chọn
  const selectedComp = components.find((c) => c.id === selectedId);

  // Đường dẫn vải/bông dệt nối các trục (Fabric Web Path)
  const sortedWebRollers = components
    .filter((c) => c.type !== 'suction_hood' && c.type !== 'cutter_knife')
    .sort((a, b) => (materialConfig.feedDirection === 'left_to_right' ? a.x - b.x : b.x - a.x));

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden bg-slate-900 border border-slate-800"
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* SVG Canvas Bản vẽ CAD Chi Tiết Máy */}
      <svg className="w-full h-full cursor-crosshair">
        <defs>
          {/* Lưới tọa độ phụ 20mm và lưới chính 100mm */}
          <pattern id="cadGridMinor" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse">
            <path d={`M ${20 * zoom} 0 L 0 0 0 ${20 * zoom}`} fill="none" stroke="#1e293b" strokeWidth="0.75" />
          </pattern>
          <pattern id="cadGridMajor" width={100 * zoom} height={100 * zoom} patternUnits="userSpaceOnUse">
            <rect width={100 * zoom} height={100 * zoom} fill="url(#cadGridMinor)" />
            <path d={`M ${100 * zoom} 0 L 0 0 0 ${100 * zoom}`} fill="none" stroke="#334155" strokeWidth="1.2" />
          </pattern>

          {/* Mũi tên chỉ hướng */}
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
          </marker>
          <marker id="arrowRed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
          </marker>
          <marker id="arrowGreen" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#22c55e" />
          </marker>
        </defs>

        {/* Nền lưới tọa độ */}
        <rect width="100%" height="100%" fill="url(#cadGridMajor)" />

        {/* Trục tọa độ máy gốc 0,0 */}
        {(() => {
          const origin = toScreen(0, 0);
          return (
            <g className="pointer-events-none opacity-40">
              <line x1={origin.x} y1={0} x2={origin.x} y2="100%" stroke="#475569" strokeWidth="1.5" strokeDasharray="4 4" />
              <line x1={0} y1={origin.y} x2="100%" y2={origin.y} stroke="#475569" strokeWidth="1.5" strokeDasharray="4 4" />
              <text x={origin.x + 6} y={origin.y - 6} fill="#94a3b8" fontSize="11" fontFamily="JetBrains Mono">
                GỐC MÁY (0,0 mm)
              </text>
            </g>
          );
        })()}

        {/* Luồng vải / bông (Fabric Web Ribbon) bám sát chu vi răng kim thực tế */}
        {(() => {
          let orderedRollers: { comp: MachineComponent; wrapMode: 'over' | 'under' | 'tangent' | 'carding_gap' }[] = [];

          if (fabricRouting && !fabricRouting.autoRoute && fabricRouting.steps.length > 0) {
            fabricRouting.steps.forEach((step) => {
              if (!step.enabled) return;
              const comp = components.find((c) => c.id === step.rollerId);
              // Bỏ qua condenser_drum khỏi hành trình vải dệt vì vải đã bị xé thành xơ bông
              if (comp && comp.type !== 'condenser_drum') {
                orderedRollers.push({ comp, wrapMode: step.wrapMode });
              }
            });
          }

          if (orderedRollers.length === 0) {
            const activeRollers = components
              .filter((c) => c.type !== 'suction_hood' && c.type !== 'condenser_drum')
              .sort((a, b) => (materialConfig.feedDirection === 'left_to_right' ? a.x - b.x : b.x - a.x));

            orderedRollers = activeRollers.map((comp) => ({
              comp,
              wrapMode:
                comp.type === 'feed_roller'
                  ? 'under'
                  : comp.type === 'cutter_knife'
                  ? 'tangent'
                  : comp.type === 'worker_roller' || comp.type === 'stripper_roller'
                  ? 'carding_gap'
                  : 'under',
            }));
          }

          if (orderedRollers.length < 2) return null;

          const { sampleMeta } = buildContinuousFabricPath(
            orderedRollers,
            materialConfig.feedDirection,
            components
          );

          if (sampleMeta.length < 2) return null;

          const screenPts = sampleMeta.map((p) => toScreen(p.x, p.y));
          const pathD = convertPointsToSmoothSvgPath(screenPts);
          const startPt = screenPts[0];
          const endPt = screenPts[screenPts.length - 1];

          // Tìm điểm qua khe cắt dao & trống để đánh dấu
          const nipSample = sampleMeta.find((p) => p.isContact && p.rollerId && p.rollerId.includes('cutter'));
          const nipScr = nipSample ? toScreen(nipSample.x, nipSample.y) : null;

          return (
            <g className="pointer-events-none">
              {/* Dải vải phát sáng dịu mượt */}
              <path
                d={pathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={10 * zoom}
                strokeOpacity="0.22"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Đường di chuyển chính xác của dải vải */}
              <path
                d={pathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={3 * zoom}
                strokeDasharray="7 4"
                strokeDashoffset={isRunning ? -rotationAngle * 10 : 0}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Mũi tên hướng nạp liệu */}
              <text x={startPt.x - 24} y={startPt.y - 12} fill="#38bdf8" fontSize="11" fontWeight="600" fontFamily="JetBrains Mono">
                HƯỚNG NẠP VẢI ➔
              </text>
              {/* Điểm chuyển tiếp tại khe dao và bị trống cuốn xuống */}
              {nipScr && (
                <g>
                  <circle cx={nipScr.x} cy={nipScr.y} r={4 * zoom} fill="#38bdf8" />
                  <text x={nipScr.x + 8} y={nipScr.y - 8} fill="#7dd3fc" fontSize="9.5" fontWeight="600" fontFamily="JetBrains Mono">
                    KHE DAO &amp; TRỐNG CUỐN XUỐNG ➔
                  </text>
                </g>
              )}
              {/* Điểm kết thúc vải nguyên tấm: Bị xé tan thành xơ bông */}
              <circle cx={endPt.x} cy={endPt.y} r={6 * zoom} fill="#f59e0b" fillOpacity="0.8" />
              <text x={endPt.x + 10} y={endPt.y + 4} fill="#fbbf24" fontSize="10.5" fontWeight="600" fontFamily="JetBrains Mono">
                VÙNG XÉ TƠI XƠ BÔNG ➔ BAY VÀO ỐNG HÚT
              </text>
            </g>
          );
        })()}

        {/* Luồng gió hút khí chân không & Đường luồng hút đáy vòng dưới các roller */}
        {suctionConfig.active &&
          components
            .filter((c) => c.type === 'suction_hood')
            .map((hood) => {
              const hoodPos = toScreen(hood.x, hood.y);
              const drum = components.find((c) => c.type === 'main_drum');
              const drumPos = drum ? toScreen(drum.x, drum.y) : { x: hoodPos.x - 100, y: hoodPos.y + 100 };

              // Tìm các worker rollers để vẽ đường luồng hút đáy vòng dưới
              const workers = drum
                ? components
                    .filter((c) => c.type === 'worker_roller' || c.type === 'stripper_roller')
                    .sort((a, b) => {
                      let angA = Math.atan2(a.y - drum.y, a.x - drum.x);
                      let angB = Math.atan2(b.y - drum.y, b.x - drum.x);
                      while (angA < -Math.PI) angA += Math.PI * 2;
                      while (angB < -Math.PI) angB += Math.PI * 2;
                      return angA - angB;
                    })
                : [];

              const showUnder = suctionConfig.showUnderSuctionPath !== false;
              const underOffset = suctionConfig.underSuctionOffsetMm ?? 45;

              let underPathD = '';
              let startUnderPos: { x: number; y: number } | null = null;
              let midScrPos: { x: number; y: number } | null = null;
              let underPtsList: { x: number; y: number }[] = [];

              if (showUnder && drum && workers.length > 0) {
                underPtsList = workers.map((w) => {
                  const dx = w.x - drum.x;
                  const dy = w.y - drum.y;
                  const dist = Math.hypot(dx, dy) || 1;
                  return {
                    x: w.x + (dx / dist) * (w.diameter / 2 + underOffset),
                    y: w.y + (dy / dist) * (w.diameter / 2 + underOffset),
                  };
                });
                const hoodMouth = { x: hood.x - 35, y: hood.y - 45 };
                underPtsList.push(hoodMouth);

                const scr0 = toScreen(underPtsList[0].x, underPtsList[0].y);
                startUnderPos = scr0;
                underPathD = `M ${scr0.x} ${scr0.y} `;
                for (let i = 1; i < underPtsList.length; i++) {
                  const scr = toScreen(underPtsList[i].x, underPtsList[i].y);
                  underPathD += `L ${scr.x} ${scr.y} `;
                }

                const midIdx = Math.floor((underPtsList.length - 1) / 2);
                midScrPos = toScreen(underPtsList[midIdx].x, underPtsList[midIdx].y);
              }

              return (
                <g key={`suction-${hood.id}`} className="opacity-95">
                  {/* Đường luồng hút đáy vòng dưới các worker roller */}
                  {underPathD && (
                    <>
                      {/* Vầng phát sáng luồng khí động */}
                      <path
                        d={underPathD}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth={8 * zoom}
                        strokeOpacity="0.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="pointer-events-none"
                      />
                      <path
                        d={underPathD}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth={3.5 * zoom}
                        strokeDasharray="7 4"
                        strokeDashoffset={isRunning ? -rotationAngle * 14 : 0}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeOpacity="0.95"
                        className="pointer-events-none"
                      />
                      {startUnderPos && (
                        <text
                          x={startUnderPos.x - 15}
                          y={startUnderPos.y + 18}
                          fill="#22d3ee"
                          fontSize="9.5"
                          fontWeight="600"
                          fontFamily="JetBrains Mono"
                          className="pointer-events-none"
                        >
                          ▼ LUỒNG HÚT ĐÁY VÒNG DƯỚI CÁC TRỤC CHẢI ➔ HỌNG HÚT
                        </text>
                      )}

                      {/* Nút điều khiển kéo mở rộng trực tiếp trên bản vẽ 2D */}
                      {midScrPos && (
                        <g
                          className="pointer-events-auto cursor-ns-resize select-none"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            isDraggingUnderSuctionRef.current = true;
                            dragUnderSuctionStart.current = {
                              mouseY: e.clientY,
                              startOffset: underOffset,
                            };
                          }}
                        >
                          <circle cx={midScrPos.x} cy={midScrPos.y} r={16} fill="#0ea5e9" fillOpacity="0.25" />
                          <circle cx={midScrPos.x} cy={midScrPos.y} r={8 * zoom} fill="#38bdf8" stroke="#ffffff" strokeWidth={2} />
                          <rect
                            x={midScrPos.x - 80}
                            y={midScrPos.y + 12}
                            width={160}
                            height={22}
                            rx={5}
                            fill="#0f172a"
                            stroke="#0284c7"
                            strokeWidth={1.3}
                            className="shadow-xl"
                          />
                          <text
                            x={midScrPos.x}
                            y={midScrPos.y + 27}
                            fill="#38bdf8"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                            fontFamily="JetBrains Mono"
                          >
                            ⇳ KÉO MỞ RỘNG: {underOffset}mm
                          </text>
                        </g>
                      )}

                      {/* Các mảnh xơ dẹt phẳng bay dọc luồng hút đáy và rơi qua khe hở 2D */}
                      {isRunning && underPtsList.length >= 2 && (
                        <g className="pointer-events-none">
                          {[0.12, 0.35, 0.58, 0.8, 0.94].map((fFrac, fIdx) => {
                            const animFrac = ((rotationAngle / 360) * 1.6 + fFrac) % 1;
                            const ptIdx = animFrac * (underPtsList.length - 1);
                            const seg = Math.min(underPtsList.length - 2, Math.floor(ptIdx));
                            const segT = ptIdx - seg;
                            const xMm = underPtsList[seg].x + (underPtsList[seg + 1].x - underPtsList[seg].x) * segT;
                            const yMm = underPtsList[seg].y + (underPtsList[seg + 1].y - underPtsList[seg].y) * segT;
                            const scr = toScreen(xMm, yMm);
                            return (
                              <g key={`flake-under-${fIdx}`} transform={`translate(${scr.x}, ${scr.y}) rotate(${animFrac * 360})`}>
                                <rect x="-6" y="-1.2" width="12" height="2.4" rx="0.8" fill="#f8fafc" fillOpacity="0.95" />
                                <line x1="-5" y1="0" x2="5" y2="0" stroke="#06b6d4" strokeWidth="0.8" />
                              </g>
                            );
                          })}

                          {workers.length >= 2 &&
                            [0, 1, 2].map((gIdx) => {
                              const wIdx = Math.min(workers.length - 2, gIdx * 2);
                              const wA = workers[wIdx];
                              const wB = workers[wIdx + 1];
                              const topX = (wA.x + wB.x) / 2;
                              const topY = (wA.y + wB.y) / 2;
                              const botX = underPtsList[wIdx]?.x ?? topX;
                              const botY = underPtsList[wIdx]?.y ?? topY - 40;
                              const dropFrac = ((rotationAngle / 360) * 2.2 + gIdx * 0.33) % 1;
                              const flakeX = topX + (botX - topX) * dropFrac;
                              const flakeY = topY + (botY - topY) * (dropFrac * dropFrac);
                              const scr = toScreen(flakeX, flakeY);
                              return (
                                <g key={`flake-drop-${gIdx}`} transform={`translate(${scr.x}, ${scr.y}) rotate(${dropFrac * 180})`}>
                                  <rect x="-5" y="-1" width="10" height="2" rx="0.6" fill="#fef08a" fillOpacity="0.9" />
                                </g>
                              );
                            })}
                        </g>
                      )}
                    </>
                  )}

                  {/* Luồng xoáy khí động hút xơ từ trống xé vào ống */}
                  <path
                    d={`M ${drumPos.x + 25 * zoom} ${drumPos.y - 35 * zoom} Q ${hoodPos.x - 20 * zoom} ${hoodPos.y + 40 * zoom} ${hoodPos.x} ${hoodPos.y}`}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={4 * zoom}
                    strokeDasharray="8 4"
                    strokeDashoffset={isRunning ? -rotationAngle * 12 : 0}
                    strokeLinecap="round"
                  />
                  <circle cx={hoodPos.x} cy={hoodPos.y} r={hood.diameter * 0.42 * zoom} fill="#10b981" fillOpacity="0.18" />
                  <text x={hoodPos.x} y={hoodPos.y - 24} fill="#10b981" fontSize="11.5" fontWeight="bold" textAnchor="middle" fontFamily="JetBrains Mono">
                    ỐNG HÚT XƠ KHÍ ĐỘNG ({suctionConfig.airVelocity} m/s)
                  </text>
                </g>
              );
            })}

        {/* Các đường gióng cự ly khe hở (Clearance Dimension Calipers) */}
        {clearances.map((c) => {
          const compA = components.find((item) => item.id === c.idA);
          const compB = components.find((item) => item.id === c.idB);
          if (!compA || !compB) return null;

          const ptA = toScreen(compA.x, compA.y);
          const ptB = toScreen(compB.x, compB.y);

          // Điểm giữa để hiện nhãn khoảng cách
          const midX = (ptA.x + ptB.x) / 2;
          const midY = (ptA.y + ptB.y) / 2;

          const isNearSelected = selectedId === c.idA || selectedId === c.idB;
          const isCollision = c.gapMm < 0;
          const isTight = c.status === 'warning_tight';

          // Chỉ vẽ đường cự ly nếu khoảng cách tương đối gần hoặc có liên quan đến trục đang chọn
          if (!isNearSelected && c.gapMm > 40) return null;

          const strokeColor = isCollision ? '#ef4444' : isTight ? '#f59e0b' : '#38bdf8';

          return (
            <g key={`clearance-${c.idA}-${c.idB}`} className="cursor-pointer" onClick={() => onOpenGapCalibrator(c.idA, c.idB)}>
              {/* Đường tâm nối 2 trục */}
              <line
                x1={ptA.x}
                y1={ptA.y}
                x2={ptB.x}
                y2={ptB.y}
                stroke={strokeColor}
                strokeWidth={isCollision ? 2 : 1.2}
                strokeDasharray="3 3"
                opacity={isNearSelected ? 1 : 0.6}
              />

              {/* Hộp nhãn khe hở chính xác mm */}
              <g transform={`translate(${midX}, ${midY})`}>
                <rect
                  x="-36"
                  y="-12"
                  width="72"
                  height="24"
                  rx="4"
                  fill={isCollision ? '#7f1d1d' : '#0f172a'}
                  stroke={strokeColor}
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill={isCollision ? '#fecaca' : strokeColor}
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="JetBrains Mono"
                >
                  {isCollision ? `VA CHẠM: ${c.gapMm}` : `Khe: ${c.gapMm} mm`}
                </text>
              </g>
            </g>
          );
        })}

        {/* Vẽ các chi tiết máy (Trục, Trống, Dao Cắt, Miệng Hút) */}
        {components.map((comp) => {
          const pos = toScreen(comp.x, comp.y);
          const radiusScreen = (comp.diameter / 2) * zoom;
          const isSel = comp.id === selectedId;
          const v = getLinearVelocity(comp.diameter, comp.rpm);

          if (comp.type === 'cutter_knife') {
            // Tìm trục feed roller bên trái và trống xé chính bên phải
            const feedRollers = components.filter((c) => c.type === 'feed_roller' && c.x < comp.x);
            let closestFeed: MachineComponent | null = null;
            let minFeedDist = Infinity;
            for (const f of feedRollers) {
              const d = Math.hypot(comp.x - f.x, comp.y - f.y);
              if (d < minFeedDist) {
                minFeedDist = d;
                closestFeed = f;
              }
            }

            const drums = components.filter((c) => c.type === 'main_drum' && c.x > comp.x);
            let closestDrum: MachineComponent | null = null;
            let minDrumDist = Infinity;
            for (const d of drums) {
              const dDist = Math.hypot(comp.x - d.x, comp.y - d.y);
              if (dDist < minDrumDist) {
                minDrumDist = dDist;
                closestDrum = d;
              }
            }

            // 1. Tấm dẫn hướng đón vải mỏng (Thin sheet guide apron) từ đáy feed roller tới sống dao
            let feedUnderMm = { x: comp.x - 45, y: comp.y - 4 };
            if (closestFeed) {
              const feedR = closestFeed.diameter / 2;
              feedUnderMm = {
                x: closestFeed.x + feedR * 0.72,
                y: closestFeed.y - feedR + 2,
              };
            }
            const feedGuidePt = toScreen(feedUnderMm.x, feedUnderMm.y);

            // 2. Mũi dao cắt mỏng vươn dài tới sát tang trống lớn với khe hở chính xác 2.0 mm
            let knifeNoseMm = { x: comp.x + 48, y: comp.y + 8 };
            let drumNipMm = { x: comp.x + 50, y: comp.y + 8 };
            if (closestDrum) {
              const drumR = closestDrum.diameter / 2 + 2.5;
              const dx = comp.x - closestDrum.x;
              const dy = (comp.y + 6) - closestDrum.y;
              const ang = Math.atan2(dy, dx);
              drumNipMm = {
                x: closestDrum.x + drumR * Math.cos(ang),
                y: closestDrum.y + drumR * Math.sin(ang),
              };
              // Mũi dao mỏng cách bề mặt răng kim trống lớn đúng 2.0 mm
              knifeNoseMm = {
                x: drumNipMm.x - 2.0 * Math.cos(ang),
                y: drumNipMm.y - 2.0 * Math.sin(ang),
              };
            }
            const knifeNosePt = toScreen(knifeNoseMm.x, knifeNoseMm.y);
            const drumNipPt = toScreen(drumNipMm.x, drumNipMm.y);

            // Gốc gá của tấm dao mỏng (Holder clamp base)
            const bladeRootTop = toScreen(comp.x - 14, comp.y + 4);
            const bladeRootBottom = toScreen(comp.x - 14, comp.y + 0.5);
            const bladeNoseBottom = {
              x: knifeNosePt.x - 2.5 * zoom,
              y: knifeNosePt.y + 3.0 * zoom,
            };

            // Khối kẹp giữ mỏng phía sau (Compact Clamp Holder Bar)
            const clampTL = toScreen(comp.x - 22, comp.y + 6);
            const clampTR = toScreen(comp.x - 8, comp.y + 6);
            const clampBR = toScreen(comp.x - 8, comp.y - 12);
            const clampBL = toScreen(comp.x - 22, comp.y - 12);

            return (
              <g
                key={comp.id}
                onMouseDown={(e) => handleCompMouseDown(e, comp)}
                className="cursor-move select-none"
              >
                {/* 1. TẤM LÓT ĐÓN LIỆU MỎNG (THIN SHEET GUIDE APRON) */}
                <path
                  d={`M ${feedGuidePt.x} ${feedGuidePt.y} Q ${(feedGuidePt.x + bladeRootTop.x) / 2} ${
                    (feedGuidePt.y + bladeRootTop.y) / 2 + 3 * zoom
                  } ${bladeRootTop.x} ${bladeRootTop.y}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.5 * zoom}
                  strokeLinecap="round"
                />

                {/* 2. KHỐI GÁ KẸP ĐẾ DAO GỌN GÀNG (SLIM CLAMP HOLDER) */}
                <polygon
                  points={`${clampBL.x},${clampBL.y} ${clampBR.x},${clampBR.y} ${clampTR.x},${clampTR.y} ${clampTL.x},${clampTL.y}`}
                  fill={isSel ? '#334155' : '#1e293b'}
                  stroke={isSel ? '#38bdf8' : '#475569'}
                  strokeWidth={1.2}
                />
                {/* Vít lục giác kẹp dao */}
                <circle cx={(clampTL.x + clampTR.x) / 2} cy={(clampTL.y + clampBL.y) / 2} r={2.5 * zoom} fill="#64748b" stroke="#334155" strokeWidth="1" />

                {/* 3. TẤM LƯỠI DAO MỎNG NHÔ RA (THIN PROTRUDING BLADE STRIP - DÀY ~2.5mm) */}
                {/* Thân tấm dao mỏng kéo dài thẳng tới sát trống lớn */}
                <polygon
                  points={`${bladeRootTop.x},${bladeRootTop.y} ${knifeNosePt.x},${knifeNosePt.y} ${bladeNoseBottom.x},${bladeNoseBottom.y} ${bladeRootBottom.x},${bladeRootBottom.y}`}
                  fill={isSel ? '#fb7185' : '#e11d48'}
                  stroke={isSel ? '#ffffff' : '#be123c'}
                  strokeWidth={isSel ? 1.8 : 1.2}
                />
                {/* Sống lưng mài vát hợp kim sáng bóng của tấm mỏng */}
                <line
                  x1={bladeRootTop.x}
                  y1={bladeRootTop.y}
                  x2={knifeNosePt.x}
                  y2={knifeNosePt.y}
                  stroke="#ffffff"
                  strokeWidth={1.2 * zoom}
                  strokeLinecap="round"
                />
                {/* Mũi vát vát sắc hợp kim (Razor Bevel Tip) */}
                <polygon
                  points={`${knifeNosePt.x},${knifeNosePt.y} ${knifeNosePt.x - 5 * zoom},${knifeNosePt.y - 1.2 * zoom} ${knifeNosePt.x - 3 * zoom},${knifeNosePt.y + 2.5 * zoom}`}
                  fill="#ffffff"
                  stroke="#cbd5e1"
                  strokeWidth="0.8"
                />

                {/* 4. CHỈ BÁO KHE HỞ CẮT CHÍNH XÁC 2.0 mm TỚI MẶT TRỐNG */}
                {/* Đường gióng khe hở */}
                <line
                  x1={knifeNosePt.x}
                  y1={knifeNosePt.y}
                  x2={drumNipPt.x}
                  y2={drumNipPt.y}
                  stroke="#fbbf24"
                  strokeWidth={1.8}
                  strokeDasharray="2 1.5"
                />
                <circle cx={knifeNosePt.x} cy={knifeNosePt.y} r={2.5 * zoom} fill="#f43f5e" stroke="#ffffff" strokeWidth="1" />
                <circle cx={drumNipPt.x} cy={drumNipPt.y} r={2.5 * zoom} fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />

                {/* Thẻ kỹ thuật nhãn khe hở 2.0mm */}
                <g transform={`translate(${(knifeNosePt.x + drumNipPt.x) / 2}, ${(knifeNosePt.y + drumNipPt.y) / 2 - 14 * zoom})`}>
                  <rect
                    x="-38"
                    y="-10"
                    width="76"
                    height="20"
                    rx="3"
                    fill="#0f172a"
                    stroke="#fbbf24"
                    strokeWidth="1.2"
                    className="shadow-md"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="#fef08a"
                    fontSize="9.5"
                    fontWeight="bold"
                    fontFamily="JetBrains Mono"
                  >
                    KHE: 2.0 mm
                  </text>
                </g>

                {/* Tên dao và nhãn kỹ thuật dưới bệ dao */}
                <g transform={`translate(${comp.x > 0 ? toScreen(comp.x, comp.y).x : clampBL.x}, ${clampBL.y + 18 * zoom})`}>
                  <rect
                    x="-60"
                    y="-10"
                    width="120"
                    height="20"
                    rx="3"
                    fill="#0f172a"
                    fillOpacity="0.9"
                    stroke={isSel ? '#f43f5e' : '#475569'}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill={isSel ? '#fda4af' : '#cbd5e1'}
                    fontSize="9"
                    fontWeight="600"
                    fontFamily="Plus Jakarta Sans"
                  >
                    {comp.name} (Tấm mỏng)
                  </text>
                </g>
              </g>
            );
          }

          if (comp.type === 'suction_hood') {
            // Hiển thị Miệng hút
            return (
              <g
                key={comp.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseDown={(e) => handleCompMouseDown(e, comp)}
                className="cursor-move"
              >
                <circle
                  cx={0}
                  cy={0}
                  r={radiusScreen}
                  fill="#10b981"
                  fillOpacity="0.2"
                  stroke={isSel ? '#34d399' : '#059669'}
                  strokeWidth={isSel ? 2.5 : 1.5}
                  strokeDasharray="4 2"
                />
                <circle cx={0} cy={0} r={radiusScreen * 0.4} fill="#10b981" fillOpacity="0.4" />
                <text x="0" y={radiusScreen + 14} textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="600">
                  {comp.name}
                </text>
              </g>
            );
          }

          // Vẽ Trục tròn / Trống xé
          let fillColor = '#334155';
          let strokeColor = '#64748b';

          if (comp.type === 'main_drum') {
            fillColor = '#0369a1';
            strokeColor = '#38bdf8';
          } else if (comp.type === 'worker_roller') {
            fillColor = '#d97706';
            strokeColor = '#fbbf24';
          } else if (comp.type === 'stripper_roller') {
            fillColor = '#db2777';
            strokeColor = '#f472b6';
          } else if (comp.type === 'feed_roller') {
            fillColor = '#475569';
            strokeColor = '#94a3b8';
          } else if (comp.type === 'condenser_drum') {
            fillColor = '#6d28d9';
            strokeColor = '#a78bfa';
          }

          // Tính góc xoay hiện tại theo RPM và CW/CCW
          const dirFactor = comp.rotationDir === 'CW' ? 1 : -1;
          const currentCompAngle = (rotationAngle * (comp.rpm / 60) * dirFactor) % 360;

          return (
            <g
              key={comp.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onMouseDown={(e) => handleCompMouseDown(e, comp)}
              className="cursor-move group"
            >
              {/* Vòng sáng viền khi được chọn */}
              {isSel && (
                <circle
                  cx={0}
                  cy={0}
                  r={radiusScreen + 7}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeDasharray="5 3"
                />
              )}

              {/* Thân tang trống chính */}
              <circle
                cx={0}
                cy={0}
                r={radiusScreen}
                fill={fillColor}
                fillOpacity="0.8"
                stroke={isSel ? '#ffffff' : strokeColor}
                strokeWidth={isSel ? 2.5 : 1.5}
              />

              {/* Bề mặt đồ kim răng cưa / gai xé kim loại dày đặc phủ kín chu vi (Dense Card Clothing Wire Teeth Array) */}
              {(comp.surfaceType === 'wire_teeth' || comp.type === 'main_drum' || comp.type === 'worker_roller' || comp.type === 'stripper_roller') && (() => {
                const isMain = comp.type === 'main_drum';
                const numTeeth = isMain ? 180 : comp.diameter > 180 ? 110 : 80;
                const toothH = Math.max(3.0, (isMain ? 6.0 : 4.5) * zoom);
                const dirFactor = comp.rotationDir === 'CW' ? 1 : -1;
                const tiltRake = dirFactor * ((Math.PI * 2) / numTeeth) * 0.45;

                let toothPathD = '';
                for (let k = 0; k < numTeeth; k++) {
                  const a0 = (k * Math.PI * 2) / numTeeth;
                  const aTip = a0 + tiltRake;
                  const aNext = ((k + 1) * Math.PI * 2) / numTeeth;

                  const x0 = radiusScreen * Math.cos(a0);
                  const y0 = radiusScreen * Math.sin(a0);
                  const xTip = (radiusScreen + toothH) * Math.cos(aTip);
                  const yTip = (radiusScreen + toothH) * Math.sin(aTip);
                  const xNext = radiusScreen * Math.cos(aNext);
                  const yNext = radiusScreen * Math.sin(aNext);

                  if (k === 0) {
                    toothPathD += `M ${x0.toFixed(1)} ${y0.toFixed(1)} `;
                  }
                  toothPathD += `L ${xTip.toFixed(1)} ${yTip.toFixed(1)} L ${xNext.toFixed(1)} ${yNext.toFixed(1)} `;
                }

                return (
                  <g className="pointer-events-none">
                    {/* Vành đế dây quấn kim loại */}
                    <circle
                      cx={0}
                      cy={0}
                      r={radiusScreen}
                      fill="none"
                      stroke="#475569"
                      strokeWidth={1.5 * zoom}
                    />
                    {/* Vành hàng trăm mũi kim thép dập phủ kín chu vi */}
                    <path
                      d={toothPathD}
                      fill="rgba(241, 245, 249, 0.18)"
                      stroke="#f1f5f9"
                      strokeWidth={1.2}
                      strokeLinejoin="round"
                    />
                    {/* Đường bao vành đỉnh gai kim */}
                    <circle
                      cx={0}
                      cy={0}
                      r={radiusScreen + toothH}
                      fill="none"
                      stroke={isSel ? '#38bdf8' : '#94a3b8'}
                      strokeWidth="0.8"
                      strokeDasharray="2 2"
                      opacity="0.75"
                    />
                  </g>
                );
              })()}

              {/* Trục ép khía rãnh dọc cấp liệu dày đặc (Densely Fluted Steel Rollers) */}
              {comp.surfaceType === 'fluted_steel' && (() => {
                const numFlutes = 64;
                let flutePathD = '';
                for (let k = 0; k < numFlutes; k++) {
                  const a = (k * Math.PI * 2) / numFlutes;
                  const rInner = radiusScreen - 2.8 * zoom;
                  const rOuter = radiusScreen;
                  const x1 = rInner * Math.cos(a);
                  const y1 = rInner * Math.sin(a);
                  const x2 = rOuter * Math.cos(a);
                  const y2 = rOuter * Math.sin(a);
                  flutePathD += `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} `;
                }
                return (
                  <g className="pointer-events-none">
                    <path d={flutePathD} stroke="#cbd5e1" strokeWidth="1.2" opacity="0.9" />
                    <circle cx={0} cy={0} r={radiusScreen} fill="none" stroke="#94a3b8" strokeWidth="1.5" />
                    <circle cx={0} cy={0} r={radiusScreen - 2.8 * zoom} fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                  </g>
                );
              })()}

              {/* Nan hoa tâm trục xoay theo thời gian thực để người dùng thấy rõ hướng quay */}
              <g transform={`rotate(${currentCompAngle})`}>
                <line x1={-radiusScreen * 0.85} y1={0} x2={radiusScreen * 0.85} y2={0} stroke="#ffffff" strokeWidth="1.2" opacity="0.6" />
                <line x1={0} y1={-radiusScreen * 0.85} x2={0} y2={radiusScreen * 0.85} stroke="#ffffff" strokeWidth="1.2" opacity="0.6" />
              </g>

              {/* Tâm trục kim loại */}
              <circle cx={0} cy={0} r={Math.max(4, radiusScreen * 0.18)} fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />

              {/* Mũi tên cong chỉ thị hướng quay CW/CCW */}
              {comp.rotationDir !== 'STATIC' && (
                <g className="pointer-events-none">
                  <path
                    d={`M ${radiusScreen * 0.55} 0 A ${radiusScreen * 0.55} ${radiusScreen * 0.55} 0 0 ${
                      comp.rotationDir === 'CW' ? 1 : 0
                    } 0 ${radiusScreen * 0.55}`}
                    fill="none"
                    stroke={comp.rotationDir === 'CW' ? '#22c55e' : '#38bdf8'}
                    strokeWidth="2"
                    markerEnd={comp.rotationDir === 'CW' ? 'url(#arrowGreen)' : 'url(#arrow)'}
                  />
                </g>
              )}

              {/* Nhãn thông số bên dưới trục */}
              <g transform={`translate(0, ${radiusScreen + 15})`} className="pointer-events-none">
                <text x="0" y="0" textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="600" fontFamily="Plus Jakarta Sans">
                  {comp.name}
                </text>
                <text x="0" y="14" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="JetBrains Mono">
                  Ø{comp.diameter}mm · {comp.rpm} RPM ({v} m/m)
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Floating Toolbar Điều Khiển Bản Vẽ CAD */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 p-1 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-lg shadow-xl text-xs font-medium text-slate-300">
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z * 1.2))}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors"
          title="Phóng to"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.25, z * 0.8))}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors"
          title="Thu nhỏ"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors"
          title="Vừa vặn khung nhìn"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <span className="font-mono text-[11px] text-slate-400 px-1.5">Tỉ lệ: {Math.round(zoom * 100)}%</span>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <span className="font-mono text-[11px] text-sky-400 px-1.5">Lưới: {gridSnapMm}mm</span>

        <div className="w-px h-4 bg-slate-700 mx-1" />
        {/* Nút bật/tắt đường luồng hút đáy 2D */}
        <button
          onClick={() => {
            const show = suctionConfig.showUnderSuctionPath !== false;
            onChangeSuctionConfig?.({
              ...suctionConfig,
              showUnderSuctionPath: !show,
            });
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-[11px] font-semibold cursor-pointer ${
            suctionConfig.showUnderSuctionPath !== false
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Bật / tắt hiển thị đường luồng hút khí động học dưới các trục chải (2D & 3D)"
        >
          <Wind className="w-3.5 h-3.5 text-emerald-400" />
          <span>Đường hút: {suctionConfig.showUnderSuctionPath !== false ? 'HIỆN' : 'ẨN'}</span>
        </button>

        {/* Tăng giảm nhanh độ rộng đường hút */}
        {suctionConfig.showUnderSuctionPath !== false && (
          <div className="flex items-center gap-1 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800 text-[11px]">
            <span className="text-slate-400">Rộng:</span>
            <button
              onClick={() => {
                const cur = suctionConfig.underSuctionOffsetMm ?? 45;
                onChangeSuctionConfig?.({
                  ...suctionConfig,
                  underSuctionOffsetMm: Math.max(15, cur - 10),
                });
              }}
              className="p-0.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer"
              title="Thu hẹp đường hút"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono font-bold text-sky-300 px-0.5">
              {suctionConfig.underSuctionOffsetMm ?? 45}mm
            </span>
            <button
              onClick={() => {
                const cur = suctionConfig.underSuctionOffsetMm ?? 45;
                onChangeSuctionConfig?.({
                  ...suctionConfig,
                  underSuctionOffsetMm: Math.min(180, cur + 10),
                });
              }}
              className="p-0.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer"
              title="Mở rộng đường hút dưới trục (kéo rộng ra)"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}

        {isLocked && (
          <>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <span className="flex items-center gap-1 font-semibold text-[11px] text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-600/70" title="Vị trí toàn bộ dàn máy đang được khóa cố định, chống kéo dịch chuyển nhầm">
              <Lock className="w-3 h-3 text-amber-400" /> Đã khóa vị trí
            </span>
          </>
        )}
      </div>

      {/* Thanh đo cự ly nhanh khi có chọn trục */}
      {selectedComp && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto z-10 p-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span className="font-semibold text-slate-100">{selectedComp.name}</span>
            <span className="text-slate-400 font-mono">X:{selectedComp.x}mm Y:{selectedComp.y}mm</span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden md:block" />

          {/* Cặp cự ly gần nhất */}
          {(() => {
            const nearestClearance = clearances.find((c) => c.idA === selectedComp.id || c.idB === selectedComp.id);
            if (!nearestClearance) return <span className="text-slate-500">Không có chi tiết lân cận &lt; 120mm</span>;
            const otherName = nearestClearance.idA === selectedComp.id ? nearestClearance.nameB : nearestClearance.nameA;
            const otherId = nearestClearance.idA === selectedComp.id ? nearestClearance.idB : nearestClearance.idA;
            const isDanger = nearestClearance.gapMm < 0;

            return (
              <div className="flex items-center gap-3">
                <span className="text-slate-400">Khe hở tới <strong>{otherName}</strong>:</span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded ${
                    isDanger ? 'bg-rose-950 text-rose-300 border border-rose-700' : 'bg-slate-800 text-sky-300'
                  }`}
                >
                  {nearestClearance.gapMm} mm
                </span>
                <button
                  onClick={() => onOpenGapCalibrator(selectedComp.id, otherId)}
                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium text-xs transition-colors"
                >
                  Chỉnh cự ly chính xác
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

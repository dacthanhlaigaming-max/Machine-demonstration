import * as THREE from 'three';
import { MachineComponent, FabricRoutingConfig, MaterialFeedConfig, FabricPathStep } from '../types/machine';

export interface PathSamplePoint {
  x: number;
  y: number;
  z: number;
  isContact: boolean;
  rollerId?: string;
  arcAngleDeg?: number;
}

export interface RollerArcWrap {
  rollerId: string;
  wrapMode: 'over' | 'under' | 'tangent' | 'carding_gap';
  entryTangent: { x: number; y: number };
  exitTangent: { x: number; y: number };
  wrapAngleDeg: number;
  arcLengthMm: number;
  arcPoints: PathSamplePoint[];
}

/**
 * Chuẩn hóa góc về khoảng [-3pi/2, pi/2] với tâm là -pi/2 (cho đáy dưới)
 */
function normalizeUnderAngle(ang: number): number {
  let a = ang;
  while (a > Math.PI / 2) a -= Math.PI * 2;
  while (a < -Math.PI * 1.5) a += Math.PI * 2;
  return a;
}

/**
 * Chuẩn hóa góc về khoảng [-pi/2, 3pi/2] với tâm là pi/2 (cho đỉnh trên)
 */
function normalizeOverAngle(ang: number): number {
  let a = ang;
  while (a < -Math.PI / 2) a += Math.PI * 2;
  while (a > Math.PI * 1.5) a -= Math.PI * 2;
  return a;
}

/**
 * Chuyển đổi mảng tọa độ điểm sang chuỗi SVG Path siêu mượt với Catmull-Rom Bezier Spline
 * Đảm bảo liên tục độ cong C1, loại bỏ hoàn toàn các góc gấp khúc hay đứt gãy gập góc
 */
export function convertPointsToSmoothSvgPath(pts: { x: number; y: number }[]): string {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  }

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
  const tension = 0.22; // Độ mềm spline Catmull-Rom tự nhiên cho dải vải

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i + 2 < pts.length ? pts[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `;
  }

  return d;
}

/**
 * Tính toán các tiếp điểm và cung ôm thực tế ôm sát vào chu vi trục/trống
 */
export function computeRollerWrapGeometry(
  comp: MachineComponent,
  prevPt: { x: number; y: number },
  nextPt: { x: number; y: number },
  wrapMode: 'over' | 'under' | 'tangent' | 'carding_gap',
  feedDirection: 'left_to_right' | 'right_to_left',
  allRollers?: MachineComponent[]
): RollerArcWrap {
  const isMainDrum = comp.type === 'main_drum';
  const isKnife = comp.type === 'cutter_knife';

  // 1. CHẾ ĐỘ "GIỮA TRỤC & TRỐNG (KHE CHẢI)" CHO WORKER ROLLER & STRIPPER ROLLER
  if (wrapMode === 'carding_gap') {
    const drums = (allRollers || []).filter((c) => c.type === 'main_drum');
    let closestDrum: MachineComponent | null = null;
    let minDist = Infinity;
    for (const d of drums) {
      const dist = Math.hypot(comp.x - d.x, comp.y - d.y);
      if (dist < minDist) {
        minDist = dist;
        closestDrum = d;
      }
    }

    if (closestDrum) {
      const dx = comp.x - closestDrum.x;
      const dy = comp.y - closestDrum.y;
      const centerDist = Math.hypot(dx, dy) || 1;
      const ux = dx / centerDist;
      const uy = dy / centerDist;

      const drumRadius = closestDrum.diameter / 2 + 3.5;
      const workerRadius = comp.diameter / 2;
      const gapActual = Math.max(0.5, centerDist - drumRadius - workerRadius);
      const nipRadius = drumRadius + gapActual / 2;

      const nipX = closestDrum.x + ux * nipRadius;
      const nipY = closestDrum.y + uy * nipRadius;

      const tx = -uy;
      const ty = ux;

      const span = Math.min(22, comp.diameter * 0.16);
      const p1: PathSamplePoint = {
        x: Number((nipX - tx * span).toFixed(2)),
        y: Number((nipY - ty * span).toFixed(2)),
        z: 0,
        isContact: true,
        rollerId: comp.id,
      };
      const p2: PathSamplePoint = {
        x: Number(nipX.toFixed(2)),
        y: Number(nipY.toFixed(2)),
        z: 0,
        isContact: true,
        rollerId: comp.id,
      };
      const p3: PathSamplePoint = {
        x: Number((nipX + tx * span).toFixed(2)),
        y: Number((nipY + ty * span).toFixed(2)),
        z: 0,
        isContact: true,
        rollerId: comp.id,
      };

      return {
        rollerId: comp.id,
        wrapMode: 'carding_gap',
        entryTangent: { x: p1.x, y: p1.y },
        exitTangent: { x: p3.x, y: p3.y },
        wrapAngleDeg: 28,
        arcLengthMm: Math.round(span * 2),
        arcPoints: [p1, p2, p3],
      };
    }
  }

  // Bán kính tiếp xúc thực tế
  const clearance = isMainDrum ? 3.5 : isKnife ? 1.0 : 2.5;
  const radius = isKnife ? Math.max(12, comp.diameter / 2) : comp.diameter / 2 + clearance;

  const cx = comp.x;
  const cy = comp.y;

  // 2. DAO CẮT TĨNH & TẤM CHẮN MỎNG DẪN HƯỚNG (CUTTER KNIFE & GUIDE SHIELD)
  // Vải đi vòng dưới feed roller, trượt qua tấm chắn mỏng dẫn hướng, chuyển tới giữa dao cắt và trống lớn,
  // và bị trống lớn cuốn xuống
  if (isKnife) {
    const feedRollers = (allRollers || []).filter((c) => c.type === 'feed_roller' && c.x < comp.x);
    const drums = (allRollers || []).filter((c) => c.type === 'main_drum' && c.x > comp.x);

    let closestFeed: MachineComponent | null = null;
    let minFeedDist = Infinity;
    for (const f of feedRollers) {
      const d = Math.hypot(comp.x - f.x, comp.y - f.y);
      if (d < minFeedDist) {
        minFeedDist = d;
        closestFeed = f;
      }
    }

    let closestDrum: MachineComponent | null = null;
    let minDrumDist = Infinity;
    for (const d of drums) {
      const dDist = Math.hypot(comp.x - d.x, comp.y - d.y);
      if (dDist < minDrumDist) {
        minDrumDist = dDist;
        closestDrum = d;
      }
    }

    const arcPoints: PathSamplePoint[] = [];

    // Điểm tiếp nhận đầu vào của tấm chắn mỏng (tiếp giáp mượt với tiếp tuyến thoát của feed roller)
    let shieldInX = cx - 28;
    let shieldInY = cy + 2;

    if (closestFeed) {
      const feedR = closestFeed.diameter / 2 + 2.0;
      // Nếu trục cấp liệu đi vòng dưới (under): tiếp tuyến thoát nằm ở góc ~ -30° ở góc dưới phải của trục
      const exitAngle = -0.52; // ~ -30°
      const exitFeedX = closestFeed.x + feedR * Math.cos(exitAngle);
      const exitFeedY = closestFeed.y + feedR * Math.sin(exitAngle);

      // Điểm đón trên tấm chắn mỏng dẫn hướng
      shieldInX = (exitFeedX + (cx - 16)) / 2;
      shieldInY = (exitFeedY + (cy + 4)) / 2;
    }

    const shieldMidX = cx - 8;
    const shieldMidY = cy + 6;
    const knifeTopX = cx;
    const knifeTopY = cy + 8;

    // Tính điểm nip giữa mũi dao cắt và mặt trống lớn
    let nipX = cx + 18;
    let nipY = cy + 4;
    let pullDownX = cx + 24;
    let pullDownY = cy - 12;

    if (closestDrum) {
      const drumR = closestDrum.diameter / 2 + 3.0;
      const dx = comp.x - closestDrum.x;
      const dy = (comp.y + 6) - closestDrum.y;
      const ang = Math.atan2(dy, dx);

      const drumSurfaceX = closestDrum.x + drumR * Math.cos(ang);
      const drumSurfaceY = closestDrum.y + drumR * Math.sin(ang);
      const knifeTipX = drumSurfaceX - 2.0 * Math.cos(ang);
      const knifeTipY = drumSurfaceY - 2.0 * Math.sin(ang);

      // Tâm điểm khe cắt giữa mũi dao và mặt trống
      nipX = (knifeTipX + drumSurfaceX) / 2;
      nipY = (knifeTipY + drumSurfaceY) / 2;

      // Chiều cuốn xuống của trống lớn (quay CCW: góc quét tăng về phía đáy -pi/2, Y giảm xuống)
      const downAng = ang + 0.14;
      pullDownX = closestDrum.x + drumR * Math.cos(downAng);
      pullDownY = closestDrum.y + drumR * Math.sin(downAng);
    }

    arcPoints.push(
      { x: Number(shieldInX.toFixed(2)), y: Number(shieldInY.toFixed(2)), z: 0, isContact: true, rollerId: comp.id },
      { x: Number(shieldMidX.toFixed(2)), y: Number(shieldMidY.toFixed(2)), z: 0, isContact: true, rollerId: comp.id },
      { x: Number(knifeTopX.toFixed(2)), y: Number(knifeTopY.toFixed(2)), z: 0, isContact: true, rollerId: comp.id },
      { x: Number(nipX.toFixed(2)), y: Number(nipY.toFixed(2)), z: 0, isContact: true, rollerId: comp.id },
      { x: Number(pullDownX.toFixed(2)), y: Number(pullDownY.toFixed(2)), z: 0, isContact: true, rollerId: comp.id }
    );

    return {
      rollerId: comp.id,
      wrapMode,
      entryTangent: { x: arcPoints[0].x, y: arcPoints[0].y },
      exitTangent: { x: arcPoints[arcPoints.length - 1].x, y: arcPoints[arcPoints.length - 1].y },
      wrapAngleDeg: 45,
      arcLengthMm: 55,
      arcPoints,
    };
  }

  // 3. TRỐNG XÉ CHÍNH (MAIN DRUM)
  if (isMainDrum && wrapMode === 'under') {
    const dIn = Math.hypot(prevPt.x - cx, prevPt.y - cy);
    let thetaIn = -2.48; // Mặc định ~ -142° ở sườn trái đón vải
    if (dIn > radius) {
      const betaIn = Math.atan2(prevPt.y - cy, prevPt.x - cx);
      const phiIn = Math.acos(Math.min(1, Math.max(-1, radius / dIn)));
      const cand1 = betaIn + phiIn;
      const cand2 = betaIn - phiIn;
      thetaIn = Math.sin(cand1) <= Math.sin(cand2) ? cand1 : cand2;
      thetaIn = normalizeUnderAngle(thetaIn);
      if (Math.cos(thetaIn) > 0) {
        thetaIn = -Math.PI - thetaIn;
      }
    }

    // Điểm ra (Exit Tangent) sườn phải của trống hướng về ống hút
    let thetaOut = 0.44;
    const hoodComp = (allRollers || []).find((c) => c.type === 'suction_hood');
    if (hoodComp) {
      const angToHood = Math.atan2(hoodComp.y - cy, hoodComp.x - cx);
      thetaOut = angToHood - 0.28;
      if (thetaOut < 0.2) thetaOut = 0.35;
      if (thetaOut > 0.8) thetaOut = 0.65;
    }

    while (thetaOut <= thetaIn) {
      thetaOut += Math.PI * 2;
    }

    const wrapAngleRad = thetaOut - thetaIn;
    const wrapAngleDeg = Math.round((wrapAngleRad * 180) / Math.PI);
    const arcLengthMm = Math.round(radius * wrapAngleRad);

    const numSteps = Math.max(20, Math.min(36, Math.round(wrapAngleDeg / 6)));
    const arcPoints: PathSamplePoint[] = [];

    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const angle = thetaIn + (thetaOut - thetaIn) * t;
      const px = Number((cx + radius * Math.cos(angle)).toFixed(2));
      const py = Number((cy + radius * Math.sin(angle)).toFixed(2));

      arcPoints.push({
        x: px,
        y: py,
        z: 0,
        isContact: true,
        rollerId: comp.id,
        arcAngleDeg: Math.round((angle * 180) / Math.PI),
      });
    }

    return {
      rollerId: comp.id,
      wrapMode: 'under',
      entryTangent: { x: arcPoints[0].x, y: arcPoints[0].y },
      exitTangent: { x: arcPoints[arcPoints.length - 1].x, y: arcPoints[arcPoints.length - 1].y },
      wrapAngleDeg,
      arcLengthMm,
      arcPoints,
    };
  }

  // 4. CÁC TRỤC CẤP LIỆU & TRỤC THÔNG THƯỜNG (Feed Rollers...)
  let thetaIn = -Math.PI / 2;
  let thetaOut = -0.46;
  const dIn = Math.hypot(prevPt.x - cx, prevPt.y - cy);
  const dOut = Math.hypot(nextPt.x - cx, nextPt.y - cy);

  if (comp.type === 'feed_roller' || wrapMode === 'under') {
    // Vải LUÔN LUÔN đi vòng dưới feed roller: tiếp xúc mượt mà ở mặt đáy trục tại góc -90° (6 giờ)
    thetaIn = -Math.PI / 2;

    // Tiếp tuyến thoát hướng sang chi tiết tiếp theo (dao cắt bên phải):
    // Luôn nằm ở góc phần tư dưới - trước (từ -45° đến -20°) để vải ôm khít mặt dưới
    thetaOut = -0.46; // ~ -26.4°
    if (dOut > radius && nextPt.x > cx) {
      const betaOut = Math.atan2(nextPt.y - cy, nextPt.x - cx);
      thetaOut = Math.max(-Math.PI * 0.42, Math.min(-0.24, betaOut));
    }
  } else {
    // wrapMode === 'over'
    if (prevPt.x < cx) {
      thetaIn = Math.PI / 2;
    } else {
      const betaIn = Math.atan2(prevPt.y - cy, prevPt.x - cx);
      thetaIn = normalizeOverAngle(betaIn);
    }

    if (dOut > radius) {
      const betaOut = Math.atan2(nextPt.y - cy, nextPt.x - cx);
      const phiOut = Math.acos(Math.min(1, Math.max(-1, radius / dOut)));
      const cand1 = betaOut + phiOut;
      const cand2 = betaOut - phiOut;
      thetaOut = Math.sin(cand1) >= Math.sin(cand2) ? cand1 : cand2;
      thetaOut = normalizeOverAngle(thetaOut);
    } else {
      thetaOut = Math.PI / 4;
    }
  }

  // Đảm bảo thetaOut >= thetaIn để cung quét liên tục theo chiều chuyển động của vải
  while (thetaOut < thetaIn) {
    thetaOut += Math.PI * 2;
  }
  if (thetaOut - thetaIn > Math.PI) {
    thetaOut -= Math.PI * 2;
  }

  const wrapAngleRad = Math.abs(thetaOut - thetaIn);
  const wrapAngleDeg = Math.round((wrapAngleRad * 180) / Math.PI);
  const arcLengthMm = Math.round(radius * wrapAngleRad);

  const numSteps = Math.max(8, Math.min(20, Math.round(wrapAngleDeg / 5)));
  const arcPoints: PathSamplePoint[] = [];

  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const angle = thetaIn + (thetaOut - thetaIn) * t;
    const px = Number((cx + radius * Math.cos(angle)).toFixed(2));
    const py = Number((cy + radius * Math.sin(angle)).toFixed(2));

    arcPoints.push({
      x: px,
      y: py,
      z: 0,
      isContact: true,
      rollerId: comp.id,
      arcAngleDeg: Math.round((angle * 180) / Math.PI),
    });
  }

  return {
    rollerId: comp.id,
    wrapMode,
    entryTangent: { x: arcPoints[0].x, y: arcPoints[0].y },
    exitTangent: { x: arcPoints[arcPoints.length - 1].x, y: arcPoints[arcPoints.length - 1].y },
    wrapAngleDeg,
    arcLengthMm,
    arcPoints,
  };
}

/**
 * Xây dựng chuỗi toàn bộ điểm không gian của lộ trình vải bao gồm cung ôm thực tế
 * Tự động tích hợp:
 * 1. Đi vòng dưới feed roller, ôm sát thân trục cấp liệu
 * 2. Trượt qua tấm chắn mỏng dẫn hướng chuyển vào giữa dao cắt và trống lớn
 * 3. Bị trống lớn cuốn xuống tự nhiên và xé tơi thành xơ bông
 * 4. Loại bỏ mọi hiện tượng gấp khúc hoặc nhảy nhầm qua trục dưới
 */
export function buildContinuousFabricPath(
  orderedRollers: { comp: MachineComponent; wrapMode: 'over' | 'under' | 'tangent' | 'carding_gap' }[],
  feedDirection: 'left_to_right' | 'right_to_left',
  allComponents?: MachineComponent[]
): {
  points: THREE.Vector3[];
  sampleMeta: PathSamplePoint[];
  wraps: RollerArcWrap[];
} {
  if (orderedRollers.length === 0) {
    return { points: [], sampleMeta: [], wraps: [] };
  }

  const isLtoR = feedDirection === 'left_to_right';
  const contextRollers = allComponents || orderedRollers.map((r) => r.comp);

  // Tìm tất cả các trống xé chính (main drum)
  const drums = contextRollers.filter((c) => c.type === 'main_drum');

  // Xử lý đặc biệt: Với mỗi trống xé chính, tìm các trục chải (worker) và trục bóc (stripper)
  // có wrapMode === 'carding_gap' nằm xung quanh trống này.
  const satelliteRollersMap = new Map<string, { comp: MachineComponent; wrapMode: string }[]>();

  drums.forEach((drum) => {
    const drumRadius = drum.diameter / 2;
    const satellites = orderedRollers.filter((item) => {
      if (item.comp.type !== 'worker_roller' && item.comp.type !== 'stripper_roller') {
        return false;
      }
      if (item.wrapMode !== 'carding_gap') {
        return false;
      }
      const dist = Math.hypot(item.comp.x - drum.x, item.comp.y - drum.y);
      const sumR = drumRadius + item.comp.diameter / 2;
      return dist <= sumR + 140;
    });

    if (satellites.length > 0) {
      satelliteRollersMap.set(drum.id, satellites);
    }
  });

  const absorbedSatelliteIds = new Set<string>();
  satelliteRollersMap.forEach((list) => {
    list.forEach((item) => absorbedSatelliteIds.add(item.comp.id));
  });

  // XỬ LÝ CẶP TRỤC CẤP LIỆU (FEED ROLLER PAIR):
  // 1. Tìm trục cấp liệu dẫn hướng chính (Feed Roller):
  //    Nếu có nhiều feed_roller, trục phía trên (y > 180 hoặc y lớn nhất) là trục Feed Roller chính
  //    mà người vận hành thao tác để đưa vải vào máy.
  // 2. Trục đối diện bên dưới (feed_bottom) là trục đỡ/kẹp, KHÔNG được đưa vào hành trình lặp.
  // 3. QUY TẮC BẮT BUỘC: Vải LUÔN LUÔN đi vòng bên dưới ('under') trục Feed Roller!
  const feedRollersInOrder = orderedRollers.filter((item) => item.comp.type === 'feed_roller');
  const feedIdsToSkip = new Set<string>();

  let mainFeedRoller = feedRollersInOrder[0];
  if (feedRollersInOrder.length > 1) {
    const topFeed = feedRollersInOrder.find((f) => f.comp.id === 'feed_top' || f.comp.id === 'feed_top_2' || f.comp.y > 180);
    mainFeedRoller = topFeed || feedRollersInOrder[0];
    feedRollersInOrder.forEach((f) => {
      if (f.comp.id !== mainFeedRoller.comp.id && Math.abs(f.comp.x - mainFeedRoller.comp.x) < 100) {
        feedIdsToSkip.add(f.comp.id);
      }
    });
  }

  // Lọc danh sách trục chính của hành trình vải nguyên tấm:
  const primaryRollers = orderedRollers
    .filter(
      (item) =>
        !absorbedSatelliteIds.has(item.comp.id) &&
        item.comp.type !== 'condenser_drum' &&
        !feedIdsToSkip.has(item.comp.id)
    )
    .map((item) => {
      // Đảm bảo TUYỆT ĐỐI: Bất kể cấu hình nào, feed_roller LUÔN LUÔN đi vòng dưới ('under')
      if (item.comp.type === 'feed_roller') {
        return { comp: item.comp, wrapMode: 'under' as const };
      }
      return item;
    });

  if (primaryRollers.length === 0) {
    return { points: [], sampleMeta: [], wraps: [] };
  }

  // Điểm nạp vải vào đầu băng (Inlet Conveyor Lead-in):
  const first = primaryRollers[0];
  const firstRadius = first.comp.diameter / 2 + (first.comp.type === 'main_drum' ? 3.5 : 2.5);
  const feedInOffset = isLtoR ? -180 : 180;

  // Vải LUÔN nạp từ băng chuyền bên trái đi ngang vào MẶT DƯỚI của feed roller:
  // startY = first.comp.y - firstRadius
  const startY = first.comp.type === 'feed_roller' || first.wrapMode === 'under'
    ? first.comp.y - firstRadius
    : first.comp.y + firstRadius;

  const startPt: PathSamplePoint = {
    x: Number((first.comp.x + feedInOffset).toFixed(2)),
    y: Number(startY.toFixed(2)),
    z: 0,
    isContact: false,
  };

  const leadInPt: PathSamplePoint = {
    x: Number((first.comp.x + (isLtoR ? -40 : 40)).toFixed(2)),
    y: Number(startY.toFixed(2)),
    z: 0,
    isContact: false,
  };

  // Điểm xuất vải sau cùng
  const last = primaryRollers[primaryRollers.length - 1].comp;
  const feedOutOffset = isLtoR ? 220 : -220;
  const endPt: PathSamplePoint = {
    x: Number((last.x + feedOutOffset).toFixed(2)),
    y: Number((last.y - 15).toFixed(2)),
    z: 0,
    isContact: false,
  };

  const fullMeta: PathSamplePoint[] = [];
  fullMeta.push(startPt);
  fullMeta.push(leadInPt);

  const wraps: RollerArcWrap[] = [];

  for (let i = 0; i < primaryRollers.length; i++) {
    const current = primaryRollers[i];
    const prevPt =
      i === 0
        ? { x: leadInPt.x, y: leadInPt.y }
        : wraps.length > 0
        ? wraps[wraps.length - 1].exitTangent
        : { x: primaryRollers[i - 1].comp.x, y: primaryRollers[i - 1].comp.y };

    const hoodComp = contextRollers.find((c) => c.type === 'suction_hood');
    const isCurrentLast = i === primaryRollers.length - 1;
    const nextPt = isCurrentLast
      ? (hoodComp ? { x: hoodComp.x, y: hoodComp.y } : { x: endPt.x, y: endPt.y })
      : { x: primaryRollers[i + 1].comp.x, y: primaryRollers[i + 1].comp.y };

    if (current.comp.type === 'main_drum') {
      const drum = current.comp;
      const radius = drum.diameter / 2 + 3.5;
      const cx = drum.x;
      const cy = drum.y;

      // 1. Tính góc vào (thetaIn) sườn trái
      // Vải được nạp chính xác tại khe cắt giữa mũi dao và mặt trống lớn rồi bị trống cuốn xuống
      const prevComp = i > 0 ? primaryRollers[i - 1].comp : null;
      let thetaIn = -2.48; // ~-142°
      if (prevComp && prevComp.type === 'cutter_knife') {
        const dx = prevComp.x - cx;
        const dy = (prevComp.y + 6) - cy;
        thetaIn = Math.atan2(dy, dx);
      } else {
        const dx = prevPt.x - cx;
        const dy = prevPt.y - cy;
        thetaIn = Math.atan2(dy, dx);
      }

      // 2. Góc quét cuốn xuống (Pull-down angle sweep):
      // Trống lớn quay CCW, răng kim kéo vải CUỐN XUỐNG dọc theo chu vi mặt trống về phía đáy
      // Góc atan2 trên sườn trái (-145°): quay CCW nghĩa là góc tăng dần về phía -90° (đáy trống),
      // làm tọa độ Y giảm mạnh xuống dưới (sin(-145°) ~ -0.64 -> sin(-95°) ~ -0.99)
      const sweepDownRad = 0.52; // ~30° chu vi trống trong cung xé ban đầu
      const drumPoints: PathSamplePoint[] = [];

      const numSteps = 14;
      for (let s = 0; s <= numSteps; s++) {
        const ang = thetaIn + sweepDownRad * (s / numSteps);
        const px = Number((cx + radius * Math.cos(ang)).toFixed(2));
        const py = Number((cy + radius * Math.sin(ang)).toFixed(2));

        drumPoints.push({
          x: px,
          y: py,
          z: 0,
          isContact: true,
          rollerId: drum.id,
          arcAngleDeg: Math.round((ang * 180) / Math.PI),
        });
      }

      // Điểm kết thúc của dải vải nguyên tấm: Bị răng kim đánh tan nát vụn thành xơ bông
      const lastPt = drumPoints[drumPoints.length - 1];
      drumPoints.push({
        x: Number((lastPt.x + 8).toFixed(2)),
        y: Number((lastPt.y - 4).toFixed(2)),
        z: 0,
        isContact: false,
        rollerId: drum.id,
      });

      drumPoints.forEach((pt) => fullMeta.push(pt));

      wraps.push({
        rollerId: drum.id,
        wrapMode: 'under',
        entryTangent: { x: drumPoints[0].x, y: drumPoints[0].y },
        exitTangent: { x: drumPoints[drumPoints.length - 1].x, y: drumPoints[drumPoints.length - 1].y },
        wrapAngleDeg: Math.round((sweepDownRad * 180) / Math.PI),
        arcLengthMm: Math.round(radius * sweepDownRad),
        arcPoints: drumPoints,
      });
    } else {
      const wrap = computeRollerWrapGeometry(
        current.comp,
        prevPt,
        nextPt,
        current.wrapMode,
        feedDirection,
        contextRollers
      );
      wraps.push(wrap);
      wrap.arcPoints.forEach((pt) => fullMeta.push(pt));
    }
  }

  // Điểm kết thúc xuất vải:
  // Lọc bỏ các điểm trùng lặp hoặc cự ly quá sát nhau (< 1.5mm) để đường uốn không bị lỗi micro-loop
  const cleanedMeta: PathSamplePoint[] = [];
  fullMeta.forEach((pt) => {
    if (cleanedMeta.length === 0) {
      cleanedMeta.push(pt);
    } else {
      const last = cleanedMeta[cleanedMeta.length - 1];
      const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
      if (dist >= 1.5) {
        cleanedMeta.push(pt);
      }
    }
  });

  const points3D = cleanedMeta.map((p) => new THREE.Vector3(p.x, p.y, p.z));

  return {
    points: points3D,
    sampleMeta: cleanedMeta,
    wraps,
  };
}

/**
 * Tạo hình học dải vải 3D (3D Fabric Ribbon Geometry) với độ dày và uốn lượn tự nhiên
 * Tự động vuốt mỏng và xé tơi về phía cuối khi vải bị đánh tơi thành xơ bông
 */
export function createNaturalRibbonGeometry(
  points: THREE.Vector3[],
  clothWidthMm: number,
  subdivisions = 160,
  isTornIntoFiber = true
): {
  geometry: THREE.BufferGeometry;
  curve: THREE.CatmullRomCurve3;
} {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.22);
  const sampledPoints = curve.getPoints(subdivisions);

  const arcLengths = [0];
  let totalLength = 0;
  for (let i = 1; i < sampledPoints.length; i++) {
    const segLen = sampledPoints[i].distanceTo(sampledPoints[i - 1]);
    totalLength += segLen;
    arcLengths.push(totalLength);
  }

  const vertexCount = (subdivisions + 1) * 2;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const halfWidth = clothWidthMm * 0.55;

  for (let i = 0; i <= subdivisions; i++) {
    const p = sampledPoints[i];
    const s = arcLengths[i] / (totalLength || 1);

    // Khi đi qua vùng xé bông của trống: dải vải vuốt mỏng dần và tơi dần thành xơ
    let currentHalfWidth = halfWidth;
    let fadeBrightness = 1.0;
    if (isTornIntoFiber && s > 0.65) {
      const progress = (s - 0.65) / 0.35;
      currentHalfWidth = halfWidth * Math.max(0.12, 1.0 - Math.pow(progress, 1.3) * 0.88);
      fadeBrightness = Math.max(0.2, 1.0 - progress * 0.8);
    }

    const normal = new THREE.Vector3(0, 0, 1);

    // Đỉnh cạnh trái (+Z)
    positions[i * 6 + 0] = p.x;
    positions[i * 6 + 1] = p.y;
    positions[i * 6 + 2] = -currentHalfWidth;

    uvs[i * 4 + 0] = 0;
    uvs[i * 4 + 1] = s * (totalLength / 220);

    normals[i * 6 + 0] = normal.x;
    normals[i * 6 + 1] = normal.y;
    normals[i * 6 + 2] = normal.z;

    colors[i * 6 + 0] = fadeBrightness;
    colors[i * 6 + 1] = fadeBrightness;
    colors[i * 6 + 2] = fadeBrightness;

    // Đỉnh cạnh phải (-Z)
    positions[i * 6 + 3] = p.x;
    positions[i * 6 + 4] = p.y;
    positions[i * 6 + 5] = currentHalfWidth;

    uvs[i * 4 + 2] = 1;
    uvs[i * 4 + 3] = s * (totalLength / 220);

    normals[i * 6 + 3] = normal.x;
    normals[i * 6 + 4] = normal.y;
    normals[i * 6 + 5] = normal.z;

    colors[i * 6 + 3] = fadeBrightness;
    colors[i * 6 + 4] = fadeBrightness;
    colors[i * 6 + 5] = fadeBrightness;

    if (i < subdivisions) {
      const r1 = i * 2;
      const r2 = (i + 1) * 2;
      indices.push(r1, r1 + 1, r2);
      indices.push(r1 + 1, r2 + 1, r2);
      indices.push(r1, r2, r1 + 1);
      indices.push(r1 + 1, r2, r2 + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  return { geometry, curve };
}

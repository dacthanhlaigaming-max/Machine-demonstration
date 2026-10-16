import { MachineComponent, SuctionSystemConfig, MaterialFeedConfig, ClearanceItem, TensionSegment, TechnicalConflict } from '../types/machine';

// Tính toán vận tốc dài bề mặt trục (m/phút)
export function getLinearVelocity(diameterMm: number, rpm: number): number {
  return Number(((Math.PI * diameterMm * rpm) / 1000).toFixed(1));
}

// Chuyển đổi giữa RPM và tần số biến tần Hz
// Công thức thực tế: Với động cơ truyền động qua biến tần, ở tần số chuẩn 50Hz trục đạt RPM định mức.
// f (Hz) = (RPM / nominalRPM) * 50
export function rpmToHz(rpm: number, nominalRpm = 800): number {
  if (rpm <= 0) return 0;
  const base = nominalRpm > 0 ? nominalRpm : 800;
  return Number(Math.max(5, Math.min(75, (rpm / base) * 50)).toFixed(1));
}

export function hzToRpm(hz: number, nominalRpm = 800): number {
  if (hz <= 0) return 0;
  const base = nominalRpm > 0 ? nominalRpm : 800;
  return Math.round((hz / 50) * base);
}

// Định dạng hiển thị tốc độ theo đơn vị Hz hoặc RPM hoặc song song
export function formatSpeedDisplay(rpm: number, hz?: number, mode: 'hz' | 'rpm' = 'hz'): string {
  if (rpm === 0) return 'Tĩnh (0)';
  const calcHz = hz !== undefined ? hz : rpmToHz(rpm);
  if (mode === 'hz') {
    return `${calcHz} Hz (~${rpm} RPM)`;
  }
  return `${rpm} RPM (~${calcHz} Hz)`;
}

// Tính năng suất nạp liệu vải thực tế
export function calculateMaterialFeedRate(
  speedMPerMin: number,
  widthMm = 850,
  gsm = 350,
  layers = 2
): { kgPerHour: number; kgPerShift: number; linearMeterPerHour: number } {
  const widthM = widthMm / 1000;
  const linearMeterPerHour = speedMPerMin * 60;
  const kgPerHour = Number(((linearMeterPerHour * widthM * gsm * layers) / 1000).toFixed(1));
  const kgPerShift = Number((kgPerHour * 8).toFixed(0));
  return { kgPerHour, kgPerShift, linearMeterPerHour };
}

// Tính khoảng cách tâm và khe hở giữa 2 chi tiết (mm)
export function calculateGap(compA: MachineComponent, compB: MachineComponent): { centerDist: number; gapMm: number } {
  const dx = compA.x - compB.x;
  const dy = compA.y - compB.y;
  const centerDist = Math.hypot(dx, dy);

  // Nếu là cặp dao cắt tĩnh và trống lớn: Dao cắt là thanh/tấm mỏng có mũi vươn dài tới sát trống lớn (khe làm việc ~2.0mm)
  if (
    (compA.type === 'cutter_knife' && compB.type === 'main_drum') ||
    (compB.type === 'cutter_knife' && compA.type === 'main_drum')
  ) {
    const drum = compA.type === 'main_drum' ? compA : compB;
    // Bán kính trống lớn
    const drumR = drum.diameter / 2;
    // Độ vươn chuẩn của tấm dao mỏng từ đế gá tới mũi cắt (đảm bảo khe chuẩn 2.0mm ở vị trí thiết kế)
    // Cự ly từ đế dao đến mặt tang trống = centerDist - drumR. Mũi dao vươn dài (centerDist - drumR - 2.0)
    // Do đó khe hở mũi dao tới trống lớn là cự ly thực tế tính từ mũi dao
    const designReach = Math.max(20, centerDist - drumR - 2.0);
    const gapMm = Math.max(0.1, Number((centerDist - drumR - designReach).toFixed(2)));
    return {
      centerDist: Number(centerDist.toFixed(2)),
      gapMm: 2.0, // Chuẩn xác 2.0 mm
    };
  }

  const gapMm = centerDist - (compA.diameter / 2 + compB.diameter / 2);
  return {
    centerDist: Number(centerDist.toFixed(2)),
    gapMm: Number(gapMm.toFixed(2)),
  };
}

// Ngưỡng khuyến nghị cự ly chuẩn cho từng cặp chi tiết
function getRecommendedGapRange(typeA: string, typeB: string): { min: number; max: number } {
  const pair = [typeA, typeB].sort().join(':');
  switch (pair) {
    case 'cutter_knife:main_drum':
      return { min: 1.0, max: 2.0 }; // Dao cắt tới trống: 1.0 - 2.0 mm
    case 'main_drum:worker_roller':
      return { min: 1.5, max: 3.0 }; // Trống lớn tới trục chải: 1.5 - 3.0 mm
    case 'stripper_roller:worker_roller':
      return { min: 1.0, max: 2.5 }; // Trục bóc tới trục chải: 1.0 - 2.5 mm
    case 'main_drum:stripper_roller':
      return { min: 1.2, max: 2.8 }; // Trống lớn tới trục bóc
    case 'feed_roller:feed_roller':
      return { min: 0.5, max: 2.5 }; // Cặp trục ép cấp liệu: 0.5 - 2.5 mm
    case 'feed_roller:main_drum':
      return { min: 2.0, max: 4.5 }; // Trục cấp liệu tới trống xé
    case 'main_drum:suction_hood':
      return { min: 30.0, max: 80.0 }; // Miệng hút tới trống
    default:
      return { min: 2.0, max: 15.0 };
  }
}

// Phân tích ma trận cự ly và phát hiện va chạm cơ khí
export function analyzeClearances(components: MachineComponent[]): ClearanceItem[] {
  const results: ClearanceItem[] = [];

  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i];
      const b = components[j];

      // Bỏ qua miệng hút khi xét va chạm kim loại nếu khoảng cách xa
      if (a.type === 'suction_hood' && b.type === 'suction_hood') continue;

      const { centerDist, gapMm } = calculateGap(a, b);
      const { min, max } = getRecommendedGapRange(a.type, b.type);

      // Chỉ theo dõi những cặp tương đối gần nhau (< 120mm) để tránh làm rối bảng
      if (gapMm < 120) {
        let status: ClearanceItem['status'] = 'optimal';
        if (gapMm < 0) {
          status = 'collision';
        } else if (gapMm < min) {
          status = 'warning_tight';
        } else if (gapMm > max) {
          status = 'warning_wide';
        }

        results.push({
          idA: a.id,
          nameA: a.name,
          idB: b.id,
          nameB: b.name,
          centerDistance: centerDist,
          gapMm,
          status,
          recommendedGapMin: min,
          recommendedGapMax: max,
        });
      }
    }
  }

  // Ưu tiên hiển thị va chạm lên đầu
  return results.sort((a, b) => a.gapMm - b.gapMm);
}

// Phân tích lực căng vải và chuỗi kéo sợi theo thời gian thực
export function analyzeTensionFlow(
  components: MachineComponent[],
  materialConfig: MaterialFeedConfig
): TensionSegment[] {
  // Lọc các trục có tiếp xúc vải (theo thứ tự X tăng dần từ cấp vào đến xuất ra)
  const activeRollers = components
    .filter((c) => c.type !== 'suction_hood' && c.type !== 'cutter_knife' && c.rotationDir !== 'STATIC')
    .sort((a, b) => {
      return materialConfig.feedDirection === 'left_to_right' ? a.x - b.x : b.x - a.x;
    });

  const segments: TensionSegment[] = [];
  const baseTension = materialConfig.nominalTensionN;

  for (let i = 0; i < activeRollers.length - 1; i++) {
    const from = activeRollers[i];
    const to = activeRollers[i + 1];

    const v1 = getLinearVelocity(from.diameter, from.rpm);
    const v2 = getLinearVelocity(to.diameter, to.rpm);

    // Tỉ số bội giác kéo dài (Draft ratio)
    const speedRatio = v1 > 0 ? Number((v2 / v1).toFixed(2)) : 1.0;

    // Tính lực căng vải xấp xỉ dựa trên độ giãn và chênh lệch tốc độ
    let tension = baseTension;
    if (v1 > 0) {
      const deltaRatio = (v2 - v1) / v1;
      tension = Math.max(5, Math.round(baseTension * (1 + deltaRatio * 1.8)));
    }

    let status: TensionSegment['status'] = 'optimal';
    if (speedRatio < 0.9) {
      status = 'slack_wrap'; // Đùn vải, nguy cơ quấn trục
    } else if (tension > 550) {
      status = 'critical_snap'; // Quá căng, nguy cơ đứt vải rách xơ
    } else if (tension > 350 || speedRatio > 2.8) {
      status = 'warning_high';
    }

    segments.push({
      fromId: from.id,
      fromName: from.name,
      toId: to.id,
      toName: to.name,
      v1,
      v2,
      speedRatio,
      tensionN: tension,
      status,
    });
  }

  return segments;
}

// Phân tích toàn diện và cảnh báo lỗi kỹ thuật tự động
export function evaluateMachineHealth(
  components: MachineComponent[],
  suctionConfig: SuctionSystemConfig,
  materialConfig: MaterialFeedConfig,
  clearances: ClearanceItem[],
  tensions: TensionSegment[]
): TechnicalConflict[] {
  const conflicts: TechnicalConflict[] = [];

  // 1. Kiểm tra Va chạm cơ khí trực diện (Gap < 0mm)
  clearances.forEach((c) => {
    if (c.gapMm < 0) {
      conflicts.push({
        id: `col-${c.idA}-${c.idB}`,
        level: 'danger',
        title: `Va chạm cơ khí nghiêm trọng: ${c.nameA} & ${c.nameB}`,
        description: `Hai bề mặt đang giao nhau (${c.gapMm} mm). Răng xé hoặc dao cắt sẽ bị gãy và phát tia lửa gây cháy nổ nếu khởi động!`,
        affectedComponents: [c.idA, c.idB],
        recommendation: `Kéo dời vị trí tâm trục hoặc tinh chỉnh cự ly khe hở đạt tối thiểu ${c.recommendedGapMin} mm.`,
        category: 'mechanical_collision',
      });
    } else if (c.status === 'warning_tight') {
      conflicts.push({
        id: `tight-${c.idA}-${c.idB}`,
        level: 'warning',
        title: `Khe hở quá hẹp: ${c.nameA} & ${c.nameB} (${c.gapMm} mm)`,
        description: `Cự ly nhỏ hơn mức an toàn kỹ thuật (${c.recommendedGapMin} mm). Nhiệt ma sát cao có thể làm cháy xơ bông hoặc cong vênh trục.`,
        affectedComponents: [c.idA, c.idB],
        recommendation: `Điều chỉnh khe hở về dải chuẩn: ${c.recommendedGapMin} - ${c.recommendedGapMax} mm.`,
        category: 'gap_clearance',
      });
    } else if (c.status === 'warning_wide' && (c.nameA.includes('Dao') || c.nameB.includes('Dao') || c.nameA.includes('Worker') || c.nameB.includes('Worker'))) {
      conflicts.push({
        id: `wide-${c.idA}-${c.idB}`,
        level: 'info',
        title: `Cự ly xé quá lớn: ${c.nameA} & ${c.nameB} (${c.gapMm} mm)`,
        description: `Khe hở vượt quá ${c.recommendedGapMax} mm khiến vải vụn trôi qua mà không được chải bung, làm giảm năng suất mở xơ.`,
        affectedComponents: [c.idA, c.idB],
        recommendation: `Thu hẹp cự ly lại gần hơn (< ${c.recommendedGapMax} mm) để tối ưu lực ghim xé.`,
        category: 'gap_clearance',
      });
    }
  });

  // 2. Kiểm tra Xung đột hướng quay tại cặp Trục Ép Cấp Liệu (Feed Rollers)
  const feedRollers = components.filter((c) => c.type === 'feed_roller');
  if (feedRollers.length >= 2) {
    // Sắp xếp theo chiều Y để tìm trục trên và trục dưới
    const sortedY = [...feedRollers].sort((a, b) => b.y - a.y);
    const topRoller = sortedY[0];
    const bottomRoller = sortedY[1];

    const dx = Math.abs(topRoller.x - bottomRoller.x);
    // Nếu 2 trục thẳng hàng theo phương kẹp vải (dx < 100mm)
    if (dx < 100) {
      // Khi cấp từ trái sang phải: Trục trên phải quay CW (hướng đẩy sang phải ở mép dưới), Trục dưới phải quay CCW (hướng đẩy sang phải ở mép trên)
      const isLtoR = materialConfig.feedDirection === 'left_to_right';
      const expectedTopDir = isLtoR ? 'CW' : 'CCW';
      const expectedBottomDir = isLtoR ? 'CCW' : 'CW';

      if (topRoller.rotationDir === bottomRoller.rotationDir) {
        conflicts.push({
          id: `feed-jam-same-dir`,
          level: 'danger',
          title: `Xung đột hướng quay cặp trục ép cấp liệu`,
          description: `Cả hai trục (${topRoller.name} và ${bottomRoller.name}) cùng quay chiều ${topRoller.rotationDir}! Tại khe kẹp, một bề mặt đẩy tới còn một bề mặt đẩy lùi, gây vò nát và kẹt vải chết máy ngay lập tức!`,
          affectedComponents: [topRoller.id, bottomRoller.id],
          recommendation: `Đổi chiều quay: ${topRoller.name} quay ${expectedTopDir}, ${bottomRoller.name} quay ${expectedBottomDir}.`,
          category: 'rotation_conflict',
        });
      } else if (topRoller.rotationDir !== expectedTopDir) {
        conflicts.push({
          id: `feed-reverse-dir`,
          level: 'danger',
          title: `Trục cấp liệu quay nghịch hướng nạp liệu`,
          description: `Chiều quay hiện tại đang đẩy ngược nguyên liệu vải ra khỏi miệng nạp thay vì cuốn vào buồng xé.`,
          affectedComponents: [topRoller.id, bottomRoller.id],
          recommendation: `Đảo ngược chiều quay của cả hai trục cấp liệu để phù hợp với hướng cấp ${isLtoR ? 'Trái ➔ Phải' : 'Phải ➔ Trái'}.`,
          category: 'rotation_conflict',
        });
      }
    }
  }

  // 3. Kiểm tra Trống Xé Chính (Main Drum) vs Chiều nạp liệu & Dao cắt
  const mainDrums = components.filter((c) => c.type === 'main_drum');
  const cutters = components.filter((c) => c.type === 'cutter_knife');

  mainDrums.forEach((drum) => {
    // Vận tốc quá thấp
    if (drum.rpm < 200) {
      conflicts.push({
        id: `drum-low-rpm-${drum.id}`,
        level: 'warning',
        title: `Tốc độ trống xé quá chậm (${drum.rpm} RPM)`,
        description: `Trống xé chính cần vận tốc dài tối thiểu 600 - 1200 m/phút để tạo lực xé quán tính tách xơ. Tốc độ hiện tại (${getLinearVelocity(drum.diameter, drum.rpm)} m/min) sẽ làm nghẽn trống.`,
        affectedComponents: [drum.id],
        recommendation: `Tăng RPM của ${drum.name} lên mức khuyến nghị 600 - 1000 RPM.`,
        category: 'tension_jam',
      });
    }

    // Dao cắt tĩnh nằm gần trống xé
    cutters.forEach((knife) => {
      const { gapMm } = calculateGap(drum, knife);
      if (gapMm < 50) {
        // Kiểm tra vị trí tương đối của dao và chiều quay trống
        // Nếu trống quay CCW (mặt dưới đi từ phải sang trái, mặt trên đi từ trái sang phải)
        if (knife.y < drum.y && drum.rotationDir === 'CW' && knife.x < drum.x) {
          conflicts.push({
            id: `knife-angle-conflict-${knife.id}`,
            level: 'warning',
            title: `Góc chém dao cắt tĩnh ngược chiều răng xé`,
            description: `Vị trí lưỡi dao ${knife.name} đang đón ngược trực diện hướng va đập của gai trống xé ${drum.name}, gây nguy cơ gãy gai hàng loạt.`,
            affectedComponents: [knife.id, drum.id],
            recommendation: `Bố trí dao cắt theo phương trượt tiếp tuyến hoặc đảo chiều quay trống xé.`,
            category: 'rotation_conflict',
          });
        }
      }
    });
  });

  // 4. Kiểm tra Lực căng vải và Nguy cơ Đùn cuộn (Tension Diagnostics)
  tensions.forEach((t) => {
    if (t.status === 'critical_snap') {
      conflicts.push({
        id: `tension-snap-${t.fromId}-${t.toId}`,
        level: 'danger',
        title: `Lực căng vượt giới hạn chịu tải: ${t.fromName} ➔ ${t.toName}`,
        description: `Lực căng tức thời đạt ${t.tensionN} N (Tỉ số tốc độ ${t.speedRatio}x). Nguy cơ xé rách đứt mạch vải bất ngờ hoặc trượt dây curoa truyền động!`,
        affectedComponents: [t.fromId, t.toId],
        recommendation: `Giảm chênh lệch tốc độ giữa hai trục hoặc giảm định lượng cấp liệu đầu vào.`,
        category: 'tension_jam',
      });
    } else if (t.status === 'slack_wrap') {
      conflicts.push({
        id: `tension-slack-${t.fromId}-${t.toId}`,
        level: 'warning',
        title: `Đùn vải & chùng chềnh: ${t.fromName} ➔ ${t.toName}`,
        description: `Tốc độ trục sau chậm hơn trục trước (${t.v2} m/min < ${t.v1} m/min, tỉ số ${t.speedRatio}x). Vải bị đùn ép dồn cục, dễ bị cuốn quấn ngược quanh trục.`,
        affectedComponents: [t.fromId, t.toId],
        recommendation: `Đồng bộ tốc độ: Tăng RPM của ${t.toName} hoặc giảm tốc độ cấp liệu của ${t.fromName}.`,
        category: 'tension_jam',
      });
    }
  });

  // 5. Kiểm tra Hệ thống Hút Bụi & Thu Gom Bông
  const suctionHoods = components.filter((c) => c.type === 'suction_hood');
  if (suctionHoods.length === 0) {
    conflicts.push({
      id: `suction-missing`,
      level: 'warning',
      title: `Chưa có Miệng hút thu gom bụi xơ bông`,
      description: `Máy xé vải sinh ra lượng bụi mịn và xơ bay rất lớn. Thiếu hệ thống hút sẽ gây nghẽn buồng máy và nguy cơ phát hỏa.`,
      affectedComponents: [],
      recommendation: `Thêm ít nhất 1 Cụm miệng hút gió (Suction Hood) phía trên hoặc sau trống xé chính.`,
      category: 'suction_aerodynamics',
    });
  } else {
    suctionHoods.forEach((hood) => {
      // Kiểm tra công suất gió
      if (suctionConfig.airVelocity < 20) {
        conflicts.push({
          id: `suction-velocity-low-${hood.id}`,
          level: 'warning',
          title: `Tốc độ gió hút quá yếu (${suctionConfig.airVelocity} m/s)`,
          description: `Để hút vận chuyển xơ bông và giẻ xé mà không bị lắng đọng trong đường ống, vận tốc gió tối thiểu phải đạt 22 - 26 m/s.`,
          affectedComponents: [hood.id],
          recommendation: `Tăng công suất quạt hút hoặc thu hẹp tiết diện ống hút để tăng vận tốc luồng khí.`,
          category: 'suction_aerodynamics',
        });
      }

      // Kiểm tra vị trí miệng hút so với Trống xé chính
      mainDrums.forEach((drum) => {
        const { gapMm } = calculateGap(hood, drum);
        if (gapMm > 150) {
          conflicts.push({
            id: `suction-too-far-${hood.id}-${drum.id}`,
            level: 'info',
            title: `Miệng hút ${hood.name} cách quá xa trống xé (${gapMm} mm)`,
            description: `Khoảng cách quá xa làm giảm lực thu gom xơ văng li tâm từ gai xé, gây thất thoát bông rơi vãi ra sàn máy.`,
            affectedComponents: [hood.id, drum.id],
            recommendation: `Bố trí miệng hút gần điểm văng xơ li tâm của trống xé (khoảng 35 - 70 mm).`,
            category: 'suction_aerodynamics',
          });
        }
      });
    });
  }

  return conflicts;
}

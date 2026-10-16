export type RollerType = 
  | 'main_drum'        // Trống xé chính (đường kính lớn, răng nhọn)
  | 'feed_roller'      // Trục ép / cấp liệu (trục kẹp)
  | 'worker_roller'    // Trục chải (Worker roller)
  | 'stripper_roller'  // Trục bóc (Stripper roller)
  | 'cutter_knife'     // Dao cắt / dao gạt tĩnh
  | 'suction_hood'     // Miệng hút thu gom bụi bông
  | 'condenser_drum';  // Trống ngưng kết / thoát khí

export type SurfaceType = 
  | 'wire_teeth'       // Gai xé thép / răng cưa nhọn
  | 'fluted_steel'     // Khía rãnh thép kẹp chặt
  | 'smooth_rubber'    // Cao su áp lực
  | 'blade'            // Lưỡi hợp kim cắt
  | 'mesh_perforated'; // Lưới inox đục lỗ hút gió

export type RotationDirection = 'CW' | 'CCW' | 'STATIC';

export interface MachineComponent {
  id: string;
  name: string;
  type: RollerType;
  x: number; // Tọa độ X tâm trục (mm)
  y: number; // Tọa độ Y tâm trục (mm)
  diameter: number; // Đường kính trục (mm)
  length: number; // Chiều dài trục (mm)
  rpm: number; // Tốc độ quay (vòng/phút, 0 nếu STATIC)
  rotationDir: RotationDirection; // Hướng quay (CW: theo kim đồng hồ, CCW: ngược kim đồng hồ, STATIC: tĩnh)
  surfaceType: SurfaceType;
  teethDensity?: number; // Mật độ răng (răng/inch vuông hoặc số gai)
  frequencyHz?: number; // Tần số biến tần điều khiển động cơ (Hz, e.g. 10 - 65 Hz)
  nominalHz?: number; // Tần số danh định (mặc định 50Hz)
  toothPitchMm?: number; // Bước răng kim (mm, e.g. 2.5 - 4.5 mm)
  toothHeightMm?: number; // Chiều cao răng cưa (mm, e.g. 3.0 - 5.5 mm)
  toothAngleDeg?: number; // Góc nghiêng trước răng cưa (độ, e.g. 68° - 75°)
  cardClothingType?: 'metallic_sawtooth' | 'pinned_lag' | 'fluted_groove' | 'flexible_card'; // Kiểu đồ kim
  color?: string;
  isLocked?: boolean;
}

export interface SuctionSystemConfig {
  active: boolean;
  airflowRate: number; // m3/h (lưu lượng quạt hút)
  airVelocity: number; // m/s (tốc độ gió tại miệng hút)
  ductDiameter: number; // mm (đường kính ống dẫn)
  filterDifferentialPressure: number; // Pa (chênh lệch áp suất màng lọc)
  showUnderSuctionPath?: boolean; // Bật / tắt hiển thị đường luồng hút đáy (mặc định: true)
  underSuctionOffsetMm?: number; // Cự ly độ rộng / độ võng của đường luồng hút dưới (mm, 15 - 140mm, mặc định: 38mm)
  fallingFiberRatio?: number; // Tỉ lệ xơ rơi qua khe hở do trọng lực (%, 10 - 70%, mặc định: 30%)
  tuftShape?: 'fluffy_flake' | 'round'; // Kiểu dáng bông: Dẹt phẳng tự nhiên (fluffy_flake) hoặc Tròn (round)
}

export interface MaterialFeedConfig {
  materialName: string;
  materialType: 'cotton_denim' | 'knit_cotton' | 'synthetic_poly' | 'blended_waste';
  feedSpeedMPerMin: number; // m/phút (tốc độ cấp nguyên liệu đầu vào)
  feedDirection: 'left_to_right' | 'right_to_left'; // Chiều cấp liệu
  basisWeightGsm: number; // Định lượng vải g/m2
  feedRateKgPerHour: number; // Năng suất cấp kg/h
  nominalTensionN: number; // Lực căng danh định (Newton)
  fabricLayers?: number; // Số lớp vải cấp vào cùng lúc (1 - 8 lớp)
  feedWidthMm?: number; // Khổ rộng vải cấp vào (mm, e.g. 850mm)
}

export interface ClearanceItem {
  idA: string;
  nameA: string;
  idB: string;
  nameB: string;
  centerDistance: number; // Khoảng cách giữa 2 tâm (mm)
  gapMm: number; // Cự ly khe hở giữa 2 bề mặt (mm)
  status: 'optimal' | 'warning_tight' | 'warning_wide' | 'collision';
  recommendedGapMin: number;
  recommendedGapMax: number;
}

export interface TensionSegment {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  v1: number; // m/min
  v2: number; // m/min
  speedRatio: number; // v2 / v1
  tensionN: number; // Newton
  status: 'optimal' | 'warning_high' | 'critical_snap' | 'slack_wrap';
}

export interface TechnicalConflict {
  id: string;
  level: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  affectedComponents: string[];
  recommendation: string;
  category: 'rotation_conflict' | 'mechanical_collision' | 'gap_clearance' | 'tension_jam' | 'suction_aerodynamics';
}

export interface SimulationState {
  isRunning: boolean;
  simSpeedMultiplier: number; // 0.1x, 0.2x, 0.5x, 1x, 2x
  elapsedSeconds: number;
  viewMode: '3d' | '2d_cad' | 'split';
  showAirflow: boolean;
  showTeeth: boolean;
  showTensionHeatmap: boolean;
  showDimensionLines: boolean;
  gridSnapMm: number; // 1, 5, 10 mm
  showHUD?: boolean; // Ẩn / hiện toàn bộ bảng thông số, huy hiệu, HUD trên khung nhìn
  speedUnitMode?: 'hz' | 'rpm'; // Đơn vị đo hiển thị tốc độ: Hz (Biến tần) hoặc RPM
}

export interface FabricPathStep {
  rollerId: string;
  wrapMode: 'over' | 'under' | 'tangent' | 'carding_gap'; // Vòng qua đỉnh trên (over), vòng qua đáy dưới (under), tiếp xúc cắt (tangent), hoặc chạy qua khe chải giữa trục & trống (carding_gap)
  enabled: boolean;
}

export interface FabricRoutingConfig {
  autoRoute: boolean; // Tự động dò tuyến theo tọa độ X hay theo lộ trình tùy chọn thủ công
  steps: FabricPathStep[]; // Chuỗi các trục được người dùng chọn
  clothWidthMm: number; // Chiều rộng khổ vải (mm, ví dụ 850mm)
  clothColor: string; // Màu mô hình vải 3D (#3b82f6 denim, #f8fafc cotton, #64748b xám)
  fiberTuftParticles: boolean; // Bật hạt xơ bông bung ra khi gặp trống xé
}

export interface SavedConfiguration {
  id: string;
  name: string;
  savedAt: string;
  components: MachineComponent[];
  suctionConfig: SuctionSystemConfig;
  materialConfig: MaterialFeedConfig;
  fabricRouting?: FabricRoutingConfig;
  notes?: string;
}


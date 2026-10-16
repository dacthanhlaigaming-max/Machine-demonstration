import React, { useState, useRef, useEffect } from 'react';
import { RollerType, SavedConfiguration } from '../types/machine';
import { PRESETS } from '../utils/presets';
import {
  Play,
  Pause,
  Plus,
  Box,
  Compass,
  Columns,
  Target,
  ChevronDown,
  Layers,
  Sparkles,
  Zap,
  FolderOpen,
  ExternalLink,
  Maximize,
  Minimize,
  PanelRightClose,
  PanelRightOpen,
  Eye,
  EyeOff,
  PlusCircle,
  Undo2,
  Redo2,
  Lock,
  Unlock,
  Save,
  Check,
  Edit2,
  Trash2,
  Copy,
  X,
  Grid,
} from 'lucide-react';

interface ToolbarProps {
  isRunning: boolean;
  onTogglePlay: () => void;
  simSpeedMultiplier: number;
  onChangeSpeedMultiplier: (speed: number) => void;
  viewMode: '3d' | '2d_cad' | 'split';
  onChangeViewMode: (mode: '3d' | '2d_cad' | 'split') => void;
  onAddComponent: (type: RollerType) => void;
  onSelectPreset: (presetId: string) => void;
  onCreateNewModel?: () => void;
  onOpenGapCalibrator: () => void;
  onOpenSaveModal: () => void;
  onOpenNewTabModal: () => void;
  savedCount: number;
  gridSnapMm: number;
  onChangeGridSnap: (snap: number) => void;
  activePresetId?: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenCardClothingModal?: () => void;
  showHUD?: boolean;
  onToggleHUD?: () => void;
  speedUnitMode?: 'hz' | 'rpm';
  onToggleSpeedUnitMode?: () => void;
  // Undo & Redo
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  // Khóa di chuyển (Lock position)
  isLocked?: boolean;
  onToggleLock?: () => void;
  // Quản lý mẫu đơn giản & 1-Click Save
  activeModelId?: string;
  activeModelName?: string;
  isDirty?: boolean;
  onQuickSave?: () => void;
  savedConfigs?: SavedConfiguration[];
  onLoadConfig?: (config: SavedConfiguration) => void;
  onRenameConfig?: (id: string, newName: string) => void;
  onDuplicateConfig?: (id: string) => void;
  onDeleteConfig?: (id: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isRunning,
  onTogglePlay,
  simSpeedMultiplier,
  onChangeSpeedMultiplier,
  viewMode,
  onChangeViewMode,
  onAddComponent,
  onSelectPreset,
  onCreateNewModel,
  onOpenGapCalibrator,
  onOpenSaveModal,
  onOpenNewTabModal,
  savedCount,
  gridSnapMm,
  onChangeGridSnap,
  activePresetId,
  isSidebarOpen,
  onToggleSidebar,
  isFullscreen,
  onToggleFullscreen,
  onOpenCardClothingModal,
  showHUD = true,
  onToggleHUD,
  speedUnitMode = 'hz',
  onToggleSpeedUnitMode,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  isLocked = false,
  onToggleLock,
  activeModelId = 'preset_standard_1_drum',
  activeModelName = 'Dàn máy 1 trống tiêu chuẩn',
  isDirty = false,
  onQuickSave,
  savedConfigs = [],
  onLoadConfig,
  onRenameConfig,
  onDuplicateConfig,
  onDeleteConfig,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  // Trạng thái đổi tên inline trong modal menu
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi click ra ngoài vùng chứa
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(target)) {
        setShowModelMenu(false);
      }
      if (addDropdownRef.current && !addDropdownRef.current.contains(target)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleStartRename = (e: React.MouseEvent, cfg: SavedConfiguration) => {
    e.stopPropagation();
    setEditingId(cfg.id);
    setEditingName(cfg.name);
  };

  const handleSaveRename = (e: React.MouseEvent | React.FormEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (editingName.trim() && onRenameConfig) {
      onRenameConfig(id, editingName.trim());
    }
    setEditingId(null);
  };

  const componentAddOptions: { type: RollerType; label: string; desc: string }[] = [
    { type: 'main_drum', label: 'Trống Xé Chính (Main Cylinder)', desc: 'Tang trống lớn Ø400-600mm gắn gai xé' },
    { type: 'feed_roller', label: 'Trục Ép Cấp Liệu (Feed Roller)', desc: 'Cặp trục kẹp khía rãnh Ø140-180mm' },
    { type: 'worker_roller', label: 'Trục Chải (Worker Roller)', desc: 'Trục vệ tinh chải tơi xơ Ø150mm' },
    { type: 'stripper_roller', label: 'Trục Bóc (Stripper Roller)', desc: 'Trục bóc xơ từ worker về trống Ø130mm' },
    { type: 'cutter_knife', label: 'Dao Cắt Tĩnh (Fixed Knife)', desc: 'Thanh dao chém phân tách giẻ vụn' },
    { type: 'suction_hood', label: 'Miệng Hút Gom Bông (Suction)', desc: 'Họng hút chân không thu gom xơ bay' },
    { type: 'condenser_drum', label: 'Trống Ngưng Kết (Condenser)', desc: 'Lồng lưới thu gom bông ra ngoài' },
  ];

  return (
    <div className="relative z-40 flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-200 backdrop-blur-md shadow-md">
      {/* VÙNG TRÁI: Vận hành, Tốc độ, Undo/Redo & Khóa vị trí */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Nút Play/Pause */}
        <button
          type="button"
          onClick={onTogglePlay}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors shadow-sm cursor-pointer ${
            isRunning
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
          title={isRunning ? 'Tạm dừng mô phỏng động học' : 'Bắt đầu mô phỏng quay trục & dòng chảy vải'}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isRunning ? 'Tạm dừng' : 'Chạy'}</span>
        </button>

        {/* Tốc độ giả lập (hỗ trợ chuyển động siêu chậm 0.1x, 0.2x để quan sát kỹ xơ bông) */}
        <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[11px] font-mono">
          {[0.1, 0.2, 0.5, 1, 2].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeSpeedMultiplier(s)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                simSpeedMultiplier === s ? 'bg-slate-800 text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
              title={`Chạy mô phỏng ở tốc độ ${s}x`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Toggle đơn vị tốc độ Hz / RPM */}
        {onToggleSpeedUnitMode && (
          <button
            type="button"
            onClick={onToggleSpeedUnitMode}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 text-[11px] font-mono transition-colors cursor-pointer"
            title="Chuyển đổi hiển thị tốc độ theo tần số biến tần (Hz) hoặc vòng/phút (RPM)"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span><strong className="text-emerald-400 uppercase">{speedUnitMode}</strong></span>
          </button>
        )}

        <div className="w-px h-5 bg-slate-800 mx-0.5 hidden sm:block" />

        {/* NÚT UNDO / REDO (Hoàn tác / Làm lại) */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded transition-colors flex items-center gap-1 ${
              canUndo
                ? 'text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer'
                : 'text-slate-600 cursor-not-allowed opacity-50'
            }`}
            title="Hoàn tác thao tác trước (Phím tắt: Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">Undo</span>
          </button>
          <div className="w-px h-3.5 bg-slate-800" />
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded transition-colors flex items-center gap-1 ${
              canRedo
                ? 'text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer'
                : 'text-slate-600 cursor-not-allowed opacity-50'
            }`}
            title="Làm lại thao tác vừa hoàn tác (Phím tắt: Ctrl+Y hoặc Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">Redo</span>
          </button>
        </div>

        {/* NÚT KHÓA VỊ TRÍ (LOCK / UNLOCK) */}
        {onToggleLock && (
          <button
            type="button"
            onClick={onToggleLock}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isLocked
                ? 'bg-amber-950/90 border-amber-500 text-amber-300 shadow-sm shadow-amber-950 ring-1 ring-amber-500/50'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
            title={
              isLocked
                ? 'Vị trí dàn máy đang BỊ KHÓA cố định. Click để MỞ KHÓA cho phép dịch chuyển'
                : 'Click để KHÓA CỐ ĐỊNH vị trí các trục trên bản vẽ và 3D, tránh vô tình rê chuột làm xê dịch'
            }
          >
            {isLocked ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>ĐÃ KHÓA</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden md:inline">Khóa vị trí</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* VÙNG GIỮA: Chế độ khung nhìn, Snap lưới CAD & HUD */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => onChangeViewMode('3d')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              viewMode === '3d' ? 'bg-sky-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3D</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('2d_cad')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              viewMode === '2d_cad' ? 'bg-sky-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2D CAD</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('split')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'split' ? 'bg-sky-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Chia đôi</span>
          </button>
        </div>

        {/* BƯỚC LƯỚI SNAP CAD (Grid snap dropdown) */}
        <div className="hidden lg:flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 gap-1.5">
          <Grid className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="text-[11px] text-slate-400 shrink-0">Lưới:</span>
          <select
            value={gridSnapMm}
            onChange={(e) => onChangeGridSnap(Number(e.target.value))}
            className="bg-transparent text-xs font-mono text-sky-300 font-bold outline-none cursor-pointer"
            title="Độ bắt dính bước lưới khi rê kéo chi tiết trên CAD (Snap to grid)"
          >
            <option value={10} className="bg-slate-900 text-slate-100">10 mm (Chuẩn)</option>
            <option value={5} className="bg-slate-900 text-slate-100">5 mm</option>
            <option value={1} className="bg-slate-900 text-slate-100">1 mm (Mịn)</option>
            <option value={0} className="bg-slate-900 text-slate-100">Tắt (Tự do)</option>
          </select>
        </div>

        {/* Nút Ẩn / Hiện Bảng Thông Số HUD */}
        {onToggleHUD && (
          <button
            type="button"
            onClick={onToggleHUD}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              showHUD
                ? 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                : 'bg-amber-950/80 text-amber-300 border-amber-600/80 font-bold shadow-md'
            }`}
            title="Ẩn / Hiện các bảng thông số nổi (Phím tắt: H)"
          >
            {showHUD ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden xl:inline">{showHUD ? 'HUD [H]' : 'Hiện [H]'}</span>
          </button>
        )}

        {/* Nút Soi Bề Mặt Kim */}
        {onOpenCardClothingModal && (
          <button
            type="button"
            onClick={onOpenCardClothingModal}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-950/70 hover:bg-sky-900 text-sky-300 rounded-lg text-xs font-semibold border border-sky-800/80 transition-colors cursor-pointer"
            title="Xem chi tiết vi mô bề mặt kim, dải quấn xoắn và góc nghiêng răng cưa"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Bề mặt kim</span>
          </button>
        )}
      </div>

      {/* VÙNG PHẢI: QUẢN LÝ MẪU DÀN MÁY ĐƠN GIẢN, LƯU 1-CLICK & THÊM TRỤC */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 1. NÚT TẠO MẪU MỚI (1-CLICK NEW MACHINE) */}
        {onCreateNewModel && (
          <button
            type="button"
            onClick={onCreateNewModel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            title="Tạo một dàn máy mới để bắt đầu thiết kế theo ý bạn"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Tạo mẫu mới</span>
          </button>
        )}

        {/* 2. NÚT LƯU MẪU NHANH (1-CLICK QUICK SAVE) */}
        {onQuickSave && (
          <button
            type="button"
            onClick={onQuickSave}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
              isDirty
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-300/80 shadow-emerald-950'
                : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80'
            }`}
            title="Lưu ngay dàn máy hiện tại (Phím tắt: Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isDirty ? 'Lưu mẫu *' : 'Đã lưu'}</span>
          </button>
        )}

        {/* 3. BỘ CHỌN & QUẢN LÝ DÀN MÁY (DROPDOWN LIST CHO CHỌN MẪU) */}
        <div ref={modelDropdownRef} className="relative flex items-center">
          {/* NATIVE DROPDOWN SELECT: Luôn luôn xổ xuống 100%, không bao giờ bị che hoặc kẹt */}
          <div className="flex items-center bg-slate-800 hover:bg-slate-750 border border-slate-700 focus-within:border-sky-500 rounded-lg px-2.5 py-1.5 transition-colors gap-1.5 shadow-sm">
            <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <select
              value={activeModelId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__create_new__') {
                  onCreateNewModel?.();
                } else if (val === '__open_modal__') {
                  onOpenSaveModal();
                } else {
                  const preset = PRESETS.find((p) => p.id === val);
                  if (preset) {
                    onSelectPreset(preset.id);
                  } else {
                    const saved = savedConfigs.find((s) => s.id === val);
                    if (saved && onLoadConfig) {
                      onLoadConfig(saved);
                    }
                  }
                }
              }}
              className="bg-transparent text-slate-100 font-semibold text-xs outline-none cursor-pointer max-w-[170px] sm:max-w-[210px] truncate"
              title="Chọn mẫu dàn máy để xem hoặc tiếp tục chỉnh sửa"
            >
              <optgroup label="⭐ Dàn máy tự lưu của bạn">
                {savedConfigs.map((cfg) => (
                  <option key={cfg.id} value={cfg.id} className="bg-slate-900 text-slate-100 py-1">
                    {cfg.name} ({cfg.components.length} trục)
                  </option>
                ))}
                {savedConfigs.length === 0 && (
                  <option value="__empty__" disabled className="bg-slate-900 text-slate-500">
                    (Chưa có mẫu tự lưu nào)
                  </option>
                )}
              </optgroup>
              <optgroup label="🏭 Mẫu công nghiệp tiêu chuẩn">
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100 py-1">
                    {p.name} [{p.badge}]
                  </option>
                ))}
              </optgroup>
              <optgroup label="⚙️ Thao tác nhanh">
                <option value="__create_new__" className="bg-slate-900 text-sky-400 font-bold">
                  + Tạo mẫu máy mới...
                </option>
                <option value="__open_modal__" className="bg-slate-900 text-slate-300">
                  📁 Quản lý chi tiết & Xuất/Nhập JSON...
                </option>
              </optgroup>
            </select>

            {/* Nút mở menu chi tiết (đổi tên, nhân bản, xóa từng mẫu) */}
            <button
              type="button"
              onClick={() => {
                setShowModelMenu(!showModelMenu);
                setShowAddMenu(false);
              }}
              className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded transition-colors cursor-pointer"
              title="Mở bảng danh sách chi tiết (Đổi tên, nhân bản, xóa mẫu)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* POPUP CHI TIẾT QUẢN LÝ MẪU (z-[100] nổi trên mọi lớp canvas) */}
          {showModelMenu && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[100] p-3 space-y-3 max-h-[75vh] overflow-y-auto">
              {/* Header popup */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-sky-400">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>DANH SÁCH MẪU DÀN MÁY</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModelMenu(false)}
                  className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Nút tạo mẫu mới nhanh */}
              {onCreateNewModel && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateNewModel();
                    setShowModelMenu(false);
                  }}
                  className="w-full text-left p-2.5 rounded-lg border border-dashed border-sky-500/70 hover:border-sky-400 bg-sky-950/40 hover:bg-sky-900/50 transition-colors flex items-center gap-2 text-sky-300 font-semibold cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <div className="text-xs">+ Tạo dàn máy mới (Trống trơn)</div>
                    <div className="text-[10px] text-slate-400 font-normal">Tự do build sắp đặt các trục theo ý bạn</div>
                  </div>
                </button>
              )}

              {/* DANH SÁCH MẪU TỰ BUILD CỦA BẠN (CUSTOM SAVED MODELS) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                    Mẫu bạn đã lưu ({savedConfigs.length})
                  </span>
                  <span className="text-[10px] text-slate-500">1-click để tải</span>
                </div>

                {savedConfigs.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-slate-500 italic bg-slate-950/60 rounded-lg border border-slate-800">
                    Chưa có mẫu tự lưu nào. Hãy tùy chỉnh máy rồi bấm <strong>Lưu mẫu</strong>!
                  </div>
                ) : (
                  savedConfigs.map((cfg) => {
                    const isSelected = activeModelId === cfg.id;
                    const isRenaming = editingId === cfg.id;

                    if (isRenaming) {
                      return (
                        <form
                          key={cfg.id}
                          onSubmit={(e) => handleSaveRename(e, cfg.id)}
                          className="flex items-center gap-1.5 p-1.5 bg-slate-950 rounded-lg border border-sky-500"
                        >
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            autoFocus
                            className="w-full bg-transparent text-xs text-slate-100 outline-none px-1 font-semibold"
                          />
                          <button
                            type="button"
                            onClick={(e) => handleSaveRename(e, cfg.id)}
                            className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                            title="Xác nhận đổi tên"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                            title="Hủy"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </form>
                      );
                    }

                    return (
                      <div
                        key={cfg.id}
                        onClick={() => {
                          if (onLoadConfig) onLoadConfig(cfg);
                          setShowModelMenu(false);
                        }}
                        className={`group w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/80 border border-emerald-500/80 text-emerald-200'
                            : 'bg-slate-950/50 hover:bg-slate-800 border border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                            <span>{cfg.name}</span>
                            {isSelected && (
                              <span className="text-[9px] bg-emerald-900/90 text-emerald-200 px-1 py-0.2 rounded font-mono">
                                Đang chọn
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {cfg.components.length} chi tiết • {new Date(cfg.savedAt).toLocaleDateString('vi-VN')}
                          </div>
                        </div>

                        {/* Các nút thao tác nhanh: Đổi tên, Nhân bản, Xóa */}
                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                          {onRenameConfig && (
                            <button
                              type="button"
                              onClick={(e) => handleStartRename(e, cfg)}
                              className="p-1 text-slate-400 hover:text-sky-300 hover:bg-slate-700/60 rounded transition-colors cursor-pointer"
                              title="Đổi tên mẫu"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                          {onDuplicateConfig && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateConfig(cfg.id);
                              }}
                              className="p-1 text-slate-400 hover:text-sky-300 hover:bg-slate-700/60 rounded transition-colors cursor-pointer"
                              title="Nhân bản mẫu này"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                          {onDeleteConfig && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Bạn có chắc muốn xóa mẫu "${cfg.name}"?`)) {
                                  onDeleteConfig(cfg.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 rounded transition-colors cursor-pointer"
                              title="Xóa mẫu này"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* MẪU CÔNG NGHIỆP CÓ SẴN (FACTORY PRESETS) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <span className="text-[10px] font-mono text-sky-400 font-bold uppercase px-1 block">
                  Mẫu công nghiệp nhà máy ({PRESETS.length})
                </span>
                {PRESETS.map((p) => {
                  const isSelected = activeModelId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectPreset(p.id);
                        setShowModelMenu(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg transition-colors flex flex-col gap-0.5 cursor-pointer ${
                        isSelected
                          ? 'bg-sky-950/80 border border-sky-500/80 text-sky-200'
                          : 'bg-slate-950/50 hover:bg-slate-800 border border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">{p.name}</span>
                        <span className="text-[10px] bg-slate-800 text-sky-400 px-1.5 py-0.5 rounded font-mono">
                          {p.badge}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 line-clamp-1">{p.description}</span>
                    </button>
                  );
                })}
              </div>

              {/* Nút mở rộng modal quản lý đầy đủ nếu cần */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onOpenSaveModal();
                    setShowModelMenu(false);
                  }}
                  className="w-full py-2 text-center text-xs text-sky-400 hover:text-sky-300 hover:bg-slate-800 rounded-lg transition-colors font-medium border border-slate-800 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Quản lý chi tiết & sao lưu tập tin JSON...</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. NÚT THÊM TRỤC / CHI TIẾT MỚI (DROPDOWN POPUP z-[100]) */}
        <div ref={addDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setShowAddMenu(!showAddMenu);
              setShowModelMenu(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 shadow-sm transition-colors cursor-pointer"
            title="Lắp thêm chi tiết mới vào dàn máy"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Thêm trục</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showAddMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[100] p-2 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 px-2 py-1 block font-semibold border-b border-slate-800 mb-1">
                Chọn chi tiết lắp thêm vào máy
              </span>
              {componentAddOptions.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    onAddComponent(opt.type);
                    setShowAddMenu(false);
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-slate-800 transition-colors flex flex-col cursor-pointer"
                >
                  <span className="font-semibold text-slate-100 text-xs">{opt.label}</span>
                  <span className="text-[10px] text-slate-400">{opt.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 5. CĂN CHỈNH KHE HỞ MM */}
        <button
          type="button"
          onClick={onOpenGapCalibrator}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          title="Căn chỉnh chính xác khe hở milimet giữa các trục"
        >
          <Target className="w-3.5 h-3.5 text-sky-400" />
          <span>Khe hở mm</span>
        </button>

        {/* 6. MỞ TAB MỚI */}
        <button
          type="button"
          onClick={onOpenNewTabModal}
          className="hidden md:flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          title="Mở toàn màn hình trong tab mới độc lập"
        >
          <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
          <span>Tab mới ↗</span>
        </button>

        {/* 7. FULLSCREEN */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            isFullscreen
              ? 'bg-sky-600 border-sky-500 text-white font-semibold'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
          title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
        >
          {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5 text-sky-400" />}
        </button>

        {/* 8. SIDEBAR TOGGLE */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            isSidebarOpen
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              : 'bg-sky-950/70 border-sky-600 text-sky-300'
          }`}
          title={isSidebarOpen ? 'Thu gọn bảng thông số bên phải' : 'Hiện bảng thông số bên phải'}
        >
          {isSidebarOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};

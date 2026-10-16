import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MachineComponent, SuctionSystemConfig, MaterialFeedConfig, RollerType, TechnicalConflict, SavedConfiguration, FabricRoutingConfig } from './types/machine';
import { PRESETS } from './utils/presets';
import { analyzeClearances, analyzeTensionFlow, evaluateMachineHealth, calculateGap } from './utils/physicsEngine';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { Viewport3D } from './components/Viewport3D';
import { SchematicCAD2D } from './components/SchematicCAD2D';
import { RollerInspector } from './components/RollerInspector';
import { DiagnosticPanel } from './components/DiagnosticPanel';
import { MaterialTensionHUD } from './components/MaterialTensionHUD';
import { FabricRoutingPanel } from './components/FabricRoutingPanel';
import { GapCalibratorModal } from './components/GapCalibratorModal';
import { ExportModal } from './components/ExportModal';
import { SavedConfigsModal } from './components/SavedConfigsModal';
import { OpenTabModal } from './components/OpenTabModal';
import { CardClothingModal } from './components/CardClothingModal';
import { Sliders, ShieldAlert, Activity, ChevronRight, AlertTriangle, AlertCircle, Sparkles, Route, CheckCircle2 } from 'lucide-react';

interface MachineSnapshot {
  components: MachineComponent[];
  fabricRouting: FabricRoutingConfig;
  suctionConfig: SuctionSystemConfig;
  materialConfig: MaterialFeedConfig;
}

export default function App() {
  const initialPreset = PRESETS[0];

  // Quản lý mẫu / Dàn máy hiện tại
  const [activeModelId, setActiveModelId] = useState<string>('preset_standard_1_drum');
  const [activeModelName, setActiveModelName] = useState<string>('Dàn máy 1 trống tiêu chuẩn');
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Khóa di chuyển vị trí dàn máy (Chống xê dịch nhầm)
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Thông báo Toast nhanh cho người dùng
  const [toastMsg, setToastMsg] = useState<{ id: number; message: string } | null>(null);
  const showToast = useCallback((message: string) => {
    setToastMsg({ id: Date.now(), message });
    setTimeout(() => {
      setToastMsg((prev) => (prev && Date.now() - prev.id >= 2800 ? null : prev));
    }, 3000);
  }, []);

  const [components, setComponents] = useState<MachineComponent[]>(initialPreset.components);
  const [suctionConfig, setSuctionConfig] = useState<SuctionSystemConfig>(initialPreset.suctionConfig);
  const [materialConfig, setMaterialConfig] = useState<MaterialFeedConfig>(initialPreset.materialConfig);

  // Trạng thái vận hành & Khung nhìn
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'3d' | '2d_cad' | 'split'>('split');
  const [selectedId, setSelectedId] = useState<string | null>(initialPreset.components[3].id);
  const [gridSnapMm, setGridSnapMm] = useState<number>(5);

  // Tab Sidebar bên phải
  const [sidebarTab, setSidebarTab] = useState<'inspector' | 'routing' | 'diagnostics' | 'tension'>('inspector');

  // Lộ trình & Hướng đi của vải 3D (Fabric Routing)
  const [fabricRouting, setFabricRouting] = useState<FabricRoutingConfig>(() => ({
    autoRoute: false,
    steps: [
      { rollerId: 'feed_top', wrapMode: 'under', enabled: true },
      { rollerId: 'cutter_fixed', wrapMode: 'tangent', enabled: true },
      { rollerId: 'main_cylinder_1', wrapMode: 'under', enabled: true },
    ],
    clothWidthMm: initialPreset.fabricRouting?.clothWidthMm ?? 850,
    clothColor: initialPreset.fabricRouting?.clothColor ?? '#2563eb',
    fiberTuftParticles: initialPreset.fabricRouting?.fiberTuftParticles ?? true,
  }));

  // Modals & Hiển thị thông số
  const [isGapModalOpen, setIsGapModalOpen] = useState(false);
  const [gapTargetA, setGapTargetA] = useState<string | null>(null);
  const [gapTargetB, setGapTargetB] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isOpenTabModalOpen, setIsOpenTabModalOpen] = useState(false);
  const [isCardClothingModalOpen, setIsCardClothingModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Chế độ hiển thị: Ẩn/Hiện toàn bộ thông số HUD & Đơn vị tốc độ (Hz / RPM)
  const [showHUD, setShowHUD] = useState<boolean>(true);
  const [speedUnitMode, setSpeedUnitMode] = useState<'hz' | 'rpm'>('hz');

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<MachineSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<MachineSnapshot[]>([]);
  const dragSnapshotTakenRef = useRef<boolean>(false);

  // Lưu snapshot trạng thái trước khi có thay đổi
  const takeSnapshot = useCallback(() => {
    const snap: MachineSnapshot = {
      components: JSON.parse(JSON.stringify(components)),
      fabricRouting: JSON.parse(JSON.stringify(fabricRouting)),
      suctionConfig: JSON.parse(JSON.stringify(suctionConfig)),
      materialConfig: JSON.parse(JSON.stringify(materialConfig)),
    };
    setUndoStack((prev) => [...prev.slice(-35), snap]);
    setRedoStack([]);
    setIsDirty(true);
  }, [components, fabricRouting, suctionConfig, materialConfig]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const currentSnap: MachineSnapshot = {
      components: JSON.parse(JSON.stringify(components)),
      fabricRouting: JSON.parse(JSON.stringify(fabricRouting)),
      suctionConfig: JSON.parse(JSON.stringify(suctionConfig)),
      materialConfig: JSON.parse(JSON.stringify(materialConfig)),
    };
    const previousSnap = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, currentSnap]);

    setComponents(previousSnap.components);
    setFabricRouting(previousSnap.fabricRouting);
    setSuctionConfig(previousSnap.suctionConfig);
    setMaterialConfig(previousSnap.materialConfig);
    showToast('↶ Đã hoàn tác thao tác');
  }, [undoStack, components, fabricRouting, suctionConfig, materialConfig, showToast]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const currentSnap: MachineSnapshot = {
      components: JSON.parse(JSON.stringify(components)),
      fabricRouting: JSON.parse(JSON.stringify(fabricRouting)),
      suctionConfig: JSON.parse(JSON.stringify(suctionConfig)),
      materialConfig: JSON.parse(JSON.stringify(materialConfig)),
    };
    const nextSnap = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, currentSnap]);

    setComponents(nextSnap.components);
    setFabricRouting(nextSnap.fabricRouting);
    setSuctionConfig(nextSnap.suctionConfig);
    setMaterialConfig(nextSnap.materialConfig);
    showToast('↷ Đã làm lại thao tác');
  }, [redoStack, components, fabricRouting, suctionConfig, materialConfig, showToast]);

  // Cấu hình đã lưu trong localStorage
  const [savedConfigs, setSavedConfigs] = useState<SavedConfiguration[]>(() => {
    try {
      const stored = localStorage.getItem('textile_tearing_saved_machines');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Tự động lưu vào localStorage khi có thay đổi danh sách cấu hình
  useEffect(() => {
    try {
      localStorage.setItem('textile_tearing_saved_machines', JSON.stringify(savedConfigs));
    } catch {
      // ignore
    }
  }, [savedConfigs]);

  // Reset drag snapshot khi nhả chuột
  useEffect(() => {
    const handleMouseUp = () => {
      dragSnapshotTakenRef.current = false;
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // LƯU MẪU 1-CLICK (QUICK SAVE)
  const handleQuickSave = useCallback(() => {
    const nowIso = new Date().toISOString();
    const existingIndex = savedConfigs.findIndex((c) => c.id === activeModelId);

    if (existingIndex >= 0) {
      // Cập nhật cấu hình tự tạo hiện tại
      const updated = [...savedConfigs];
      updated[existingIndex] = {
        ...updated[existingIndex],
        components,
        suctionConfig,
        materialConfig,
        fabricRouting,
        savedAt: nowIso,
      };
      setSavedConfigs(updated);
      setIsDirty(false);
      showToast(`✓ Đã lưu thành công dàn máy "${activeModelName}"!`);
    } else {
      // Nếu đang ở preset mẫu hoặc máy mới chưa lưu: tự tạo bản lưu mới
      const newId = `custom_${Date.now()}`;
      const newName = activeModelName.includes('tự build') || activeModelName.includes('mới')
        ? activeModelName
        : `${activeModelName} (Bản lưu)`;

      const newConfig: SavedConfiguration = {
        id: newId,
        name: newName,
        savedAt: nowIso,
        components,
        suctionConfig,
        materialConfig,
        fabricRouting,
        notes: 'Lưu từ mô phỏng máy xé vải',
      };
      setSavedConfigs((prev) => [newConfig, ...prev]);
      setActiveModelId(newId);
      setActiveModelName(newName);
      setIsDirty(false);
      showToast(`✓ Đã lưu thành công dàn máy "${newName}"!`);
    }
  }, [activeModelId, activeModelName, savedConfigs, components, suctionConfig, materialConfig, fabricRouting, showToast]);

  // TẠO MẪU MỚI 1-CLICK (CREATE NEW MACHINE MODEL)
  const handleCreateNewModel = useCallback(() => {
    takeSnapshot();
    const newNum = savedConfigs.length + 1;
    const newId = `custom_${Date.now()}`;
    const newName = `Dàn máy mới #${newNum}`;

    const starterComponents: MachineComponent[] = [
      {
        id: `feed_top_${Date.now()}`,
        name: 'Trục Ép Trên (Feed Roller)',
        type: 'feed_roller',
        x: 180,
        y: 280,
        diameter: 140,
        length: 1050,
        rpm: 15,
        rotationDir: 'CW',
        surfaceType: 'fluted_steel',
        color: '#10b981',
      },
      {
        id: `feed_bottom_${Date.now()}`,
        name: 'Trục Ép Dưới (Feed Roller)',
        type: 'feed_roller',
        x: 180,
        y: 150,
        diameter: 140,
        length: 1050,
        rpm: 15,
        rotationDir: 'CCW',
        surfaceType: 'fluted_steel',
        color: '#059669',
      },
      {
        id: `main_drum_${Date.now()}`,
        name: 'Trống Xé Chính (Main Drum)',
        type: 'main_drum',
        x: 520,
        y: 250,
        diameter: 500,
        length: 1050,
        rpm: 800,
        frequencyHz: 50,
        rotationDir: 'CCW',
        surfaceType: 'wire_teeth',
        color: '#0284c7',
        toothPitchMm: 3.2,
        toothHeightMm: 4.8,
        toothAngleDeg: 70,
      },
    ];

    const newConfig: SavedConfiguration = {
      id: newId,
      name: newName,
      savedAt: new Date().toISOString(),
      components: starterComponents,
      suctionConfig,
      materialConfig,
      fabricRouting: { ...fabricRouting, steps: [] },
      notes: 'Mẫu dàn máy tự thiết kế',
    };

    setSavedConfigs((prev) => [newConfig, ...prev]);
    setActiveModelId(newId);
    setActiveModelName(newName);
    setComponents(starterComponents);
    setSelectedId(starterComponents[2].id);
    setIsDirty(false);
    showToast(`+ Đã tạo "${newName}". Hãy tự do build máy và bấm "Lưu mẫu"!`);
  }, [takeSnapshot, savedConfigs.length, suctionConfig, materialConfig, fabricRouting, showToast]);

  // Đổi tên mẫu
  const handleRenameConfig = useCallback((id: string, newName: string) => {
    if (!newName.trim()) return;
    setSavedConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: newName.trim() } : c))
    );
    if (activeModelId === id) {
      setActiveModelName(newName.trim());
    }
    showToast(`✓ Đã đổi tên thành "${newName.trim()}"`);
  }, [activeModelId, showToast]);

  // Nhân bản mẫu
  const handleDuplicateConfig = useCallback((id: string) => {
    takeSnapshot();
    const orig = savedConfigs.find((c) => c.id === id);
    if (!orig) return;
    const copyId = `custom_${Date.now()}`;
    const copyName = `${orig.name} (Bản sao)`;
    const copyConfig: SavedConfiguration = {
      ...orig,
      id: copyId,
      name: copyName,
      savedAt: new Date().toISOString(),
    };
    setSavedConfigs((prev) => [copyConfig, ...prev]);
    showToast(`📋 Đã nhân bản: "${copyName}"`);
  }, [takeSnapshot, savedConfigs, showToast]);

  // Xóa mẫu
  const handleDeleteConfig = useCallback((id: string) => {
    setSavedConfigs((prev) => prev.filter((c) => c.id !== id));
    if (activeModelId === id) {
      // Chuyển về preset 1
      const p = PRESETS[0];
      setActiveModelId(p.id);
      setActiveModelName(p.name);
      setComponents(p.components);
      setIsDirty(false);
    }
    showToast('🗑️ Đã xóa mẫu');
  }, [activeModelId, showToast]);

  // Tải mẫu tự lưu
  const handleLoadSavedModel = useCallback((config: SavedConfiguration) => {
    takeSnapshot();
    setActiveModelId(config.id);
    setActiveModelName(config.name);
    setComponents(config.components);
    setSuctionConfig(config.suctionConfig);
    setMaterialConfig(config.materialConfig);
    if (config.fabricRouting) {
      setFabricRouting(config.fabricRouting);
    }
    setSelectedId(config.components[0]?.id || null);
    setIsDirty(false);
    showToast(`⚡ Đã tải mẫu: "${config.name}"`);
  }, [takeSnapshot, showToast]);

  // Chọn mẫu công nghiệp (Preset)
  const handleSelectPreset = useCallback((presetId: string) => {
    takeSnapshot();
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setActiveModelId(preset.id);
    setActiveModelName(preset.name);
    setComponents(preset.components);
    setSuctionConfig(preset.suctionConfig);
    setMaterialConfig(preset.materialConfig);
    setSelectedId(preset.components[3]?.id || preset.components[0]?.id || null);
    setIsDirty(false);
    showToast(`⚡ Đã tải mẫu chuẩn: "${preset.name}"`);
  }, [takeSnapshot, showToast]);

  // Phím tắt bàn phím toàn cục (Ctrl+Z, Ctrl+Y, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleQuickSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleQuickSave]);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleSaveCurrent = (name: string, notes?: string) => {
    const newConfig: SavedConfiguration = {
      id: `config_${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      components,
      suctionConfig,
      materialConfig,
      fabricRouting,
      notes,
    };
    setSavedConfigs((prev) => [newConfig, ...prev]);
    setActiveModelId(newConfig.id);
    setActiveModelName(newConfig.name);
    setIsDirty(false);
    showToast(`✓ Đã lưu: "${name}"`);
  };

  const handleImportConfig = (config: SavedConfiguration) => {
    setSavedConfigs((prev) => [config, ...prev]);
    handleLoadSavedModel(config);
  };

  // Tính toán Cơ khí & Lực căng & Chẩn đoán lỗi thời gian thực
  const clearances = useMemo(() => analyzeClearances(components), [components]);
  const tensions = useMemo(() => analyzeTensionFlow(components, materialConfig), [components, materialConfig]);
  const conflicts = useMemo(
    () => evaluateMachineHealth(components, suctionConfig, materialConfig, clearances, tensions),
    [components, suctionConfig, materialConfig, clearances, tensions]
  );

  const dangerCount = conflicts.filter((c) => c.level === 'danger').length;
  const warningCount = conflicts.filter((c) => c.level === 'warning').length;

  // Căn chỉnh trực tiếp cự ly giữa 2 vật thể bất kỳ (ví dụ dao cắt <-> trống, worker <-> trống)
  const handleAdjustDistance = useCallback((activeId: string, otherId: string, targetGapMm: number) => {
    takeSnapshot();
    let movedName = '';
    setComponents((prev) => {
      const active = prev.find((c) => c.id === activeId);
      const other = prev.find((c) => c.id === otherId);
      if (!active || !other) return prev;

      // Xác định chi tiết cố định (stationary) và chi tiết di chuyển (moving):
      // - Trống xé chính (main_drum) là trục trung tâm của toàn bộ máy (khối lượng lớn, gốc chính).
      // Khi chỉnh cự ly giữa trống và trục vệ tinh (worker, dao cắt, feed roller), trục vệ tinh sẽ dịch chuyển!
      // - Nếu một chi tiết đang bị khóa (isLocked), chi tiết còn lại không bị khóa sẽ dịch chuyển!
      let stationary = other;
      let moving = active;

      if (active.type === 'main_drum' && other.type !== 'main_drum') {
        stationary = active;
        moving = other;
      } else if (other.type === 'main_drum' && active.type !== 'main_drum') {
        stationary = other;
        moving = active;
      } else if (active.isLocked && !other.isLocked) {
        stationary = active;
        moving = other;
      } else if (!active.isLocked && other.isLocked) {
        stationary = other;
        moving = active;
      }

      movedName = moving.name;

      const dx = moving.x - stationary.x;
      const dy = moving.y - stationary.y;
      const currentDist = Math.hypot(dx, dy);
      if (currentDist === 0) {
        const sumRadius = stationary.diameter / 2 + moving.diameter / 2;
        const newX = Number((stationary.x + sumRadius + targetGapMm).toFixed(2));
        return prev.map((c) => (c.id === moving.id ? { ...c, x: newX } : c));
      }

      const ux = dx / currentDist;
      const uy = dy / currentDist;
      const sumRadius = stationary.diameter / 2 + moving.diameter / 2;
      const newTargetDist = sumRadius + targetGapMm;

      // Giữ độ chính xác tuyệt đối 2 chữ số thập phân (0.01mm)
      const newX = Number((stationary.x + ux * newTargetDist).toFixed(2));
      const newY = Number((stationary.y + uy * newTargetDist).toFixed(2));

      return prev.map((c) => (c.id === moving.id ? { ...c, x: newX, y: newY } : c));
    });
    setIsDirty(true);
    showToast(`↔ Đã căn cự ly ${targetGapMm.toFixed(2)} mm (Dịch chuyển: ${movedName || 'chi tiết'})!`);
  }, [takeSnapshot, showToast]);

  // Cập nhật vị trí kéo thả trục
  const handleUpdatePosition = useCallback((id: string, x: number, y: number) => {
    if (isLocked) return;
    if (!dragSnapshotTakenRef.current) {
      takeSnapshot();
      dragSnapshotTakenRef.current = true;
    }
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)));
    setIsDirty(true);
  }, [isLocked, takeSnapshot]);

  // Cập nhật chi tiết trục
  const handleUpdateComponent = (updated: MachineComponent) => {
    takeSnapshot();
    setComponents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setIsDirty(true);
  };

  // Xóa chi tiết
  const handleDeleteComponent = (id: string) => {
    takeSnapshot();
    setComponents((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
    setIsDirty(true);
    showToast('Đã xóa chi tiết');
  };

  // Nhân bản chi tiết
  const handleDuplicateComponent = (id: string) => {
    takeSnapshot();
    const original = components.find((c) => c.id === id);
    if (!original) return;
    const newComp: MachineComponent = {
      ...original,
      id: `${original.type}_${Date.now()}`,
      name: `${original.name} (Bản sao)`,
      x: original.x + 80,
      y: original.y + 30,
    };
    setComponents((prev) => [...prev, newComp]);
    setSelectedId(newComp.id);
    setIsDirty(true);
    showToast(`Đã nhân bản "${original.name}"`);
  };

  // Thêm mới chi tiết máy
  const handleAddComponent = (type: RollerType) => {
    takeSnapshot();
    const id = `${type}_${Date.now()}`;
    const maxX = components.length > 0 ? Math.max(...components.map((c) => c.x)) : 200;
    const mainDrum = components.find((c) => c.type === 'main_drum');

    let newComp: MachineComponent;
    switch (type) {
      case 'main_drum':
        newComp = {
          id,
          name: `Trống Xé Chính #${components.filter((c) => c.type === 'main_drum').length + 1}`,
          type,
          x: maxX + 450,
          y: 250,
          diameter: 500,
          length: 1050,
          rpm: 800,
          rotationDir: 'CCW',
          surfaceType: 'wire_teeth',
          color: '#0284c7',
        };
        break;
      case 'worker_roller': {
        const workerCount = components.filter((c) => c.type === 'worker_roller').length;
        let wx = maxX - 100;
        let wy = 120;
        if (mainDrum) {
          // Bố trí thông minh bên dưới hoặc quanh trống chính với khe chải chuẩn 2.0mm
          const angles = [-Math.PI * 0.72, -Math.PI * 0.5, -Math.PI * 0.28];
          const ang = angles[workerCount % angles.length];
          const targetDist = mainDrum.diameter / 2 + 80 + 2.0;
          wx = Number((mainDrum.x + targetDist * Math.cos(ang)).toFixed(2));
          wy = Number((mainDrum.y + targetDist * Math.sin(ang)).toFixed(2));
        }
        newComp = {
          id,
          name: `Trục Chải Worker #${workerCount + 1}`,
          type,
          x: wx,
          y: wy,
          diameter: 160,
          length: 1050,
          rpm: 35,
          rotationDir: 'CW',
          surfaceType: 'wire_teeth',
          color: '#f59e0b',
        };
        break;
      }
      case 'stripper_roller': {
        const stripperCount = components.filter((c) => c.type === 'stripper_roller').length;
        let sx = maxX + 80;
        let sy = 120;
        if (mainDrum) {
          const angles = [-Math.PI * 0.6, -Math.PI * 0.38, -Math.PI * 0.18];
          const ang = angles[stripperCount % angles.length];
          const targetDist = mainDrum.diameter / 2 + 65 + 1.8;
          sx = Number((mainDrum.x + targetDist * Math.cos(ang)).toFixed(2));
          sy = Number((mainDrum.y + targetDist * Math.sin(ang)).toFixed(2));
        }
        newComp = {
          id,
          name: `Trục Bóc Stripper #${stripperCount + 1}`,
          type,
          x: sx,
          y: sy,
          diameter: 130,
          length: 1050,
          rpm: 110,
          rotationDir: 'CCW',
          surfaceType: 'wire_teeth',
          color: '#ec4899',
        };
        break;
      }
      case 'feed_roller':
        newComp = {
          id,
          name: `Trục Ép Cấp #${components.filter((c) => c.type === 'feed_roller').length + 1}`,
          type,
          x: maxX + 150,
          y: 200,
          diameter: 150,
          length: 1050,
          rpm: 25,
          rotationDir: 'CW',
          surfaceType: 'fluted_steel',
          color: '#64748b',
        };
        break;
      case 'cutter_knife':
        newComp = {
          id,
          name: `Dao Cắt Gạt #${components.filter((c) => c.type === 'cutter_knife').length + 1}`,
          type,
          x: maxX - 200,
          y: 110,
          diameter: 32,
          length: 1050,
          rpm: 0,
          rotationDir: 'STATIC',
          surfaceType: 'blade',
          color: '#ef4444',
        };
        break;
      case 'suction_hood':
        newComp = {
          id,
          name: `Họng Hút Khí #${components.filter((c) => c.type === 'suction_hood').length + 1}`,
          type,
          x: maxX + 200,
          y: 520,
          diameter: 180,
          length: 1100,
          rpm: 0,
          rotationDir: 'STATIC',
          surfaceType: 'mesh_perforated',
          color: '#10b981',
        };
        break;
      case 'condenser_drum':
        newComp = {
          id,
          name: `Trống Ngưng Kết #${components.filter((c) => c.type === 'condenser_drum').length + 1}`,
          type,
          x: maxX + 350,
          y: 300,
          diameter: 280,
          length: 1050,
          rpm: 50,
          rotationDir: 'CCW',
          surfaceType: 'mesh_perforated',
          color: '#8b5cf6',
        };
        break;
    }

    setComponents((prev) => [...prev, newComp]);
    setSelectedId(newComp.id);

    // Đồng bộ tức thời vào danh sách lộ trình vải
    setFabricRouting((prev) => {
      if (newComp.type === 'suction_hood') return prev;
      const exists = prev.steps.some((s) => s.rollerId === newComp.id);
      if (exists) return prev;
      const defaultMode =
        newComp.type === 'worker_roller' || newComp.type === 'stripper_roller'
          ? 'carding_gap'
          : newComp.type === 'cutter_knife'
          ? 'tangent'
          : 'under';
      return {
        ...prev,
        steps: [...prev.steps, { rollerId: newComp.id, wrapMode: defaultMode, enabled: true }],
      };
    });

    setIsDirty(true);
    showToast(`✓ Đã thêm ${newComp.name}`);
  };

  // Mở modal căn chỉnh khe hở mm
  const handleOpenGapCalibrator = (idA?: string, idB?: string) => {
    if (idA) setGapTargetA(idA);
    else if (selectedId) setGapTargetA(selectedId);
    else if (components.length > 0) setGapTargetA(components[0].id);

    if (idB) setGapTargetB(idB);
    else {
      // Tìm chi tiết gần nhất
      const curA = idA || selectedId || (components.length > 0 ? components[0].id : null);
      if (curA) {
        const found = clearances.find((c) => c.idA === curA || c.idB === curA);
        if (found) {
          setGapTargetB(found.idA === curA ? found.idB : found.idA);
        } else {
          const other = components.find((c) => c.id !== curA);
          setGapTargetB(other ? other.id : null);
        }
      }
    }
    setIsGapModalOpen(true);
  };

  // Áp dụng cự ly chuẩn từ modal
  const handleApplyGap = (movingCompId: string, newX: number, newY: number) => {
    takeSnapshot();
    setComponents((prev) =>
      prev.map((c) =>
        c.id === movingCompId
          ? { ...c, x: Number(newX.toFixed(2)), y: Number(newY.toFixed(2)) }
          : c
      )
    );
    setIsDirty(true);
    showToast(`✓ Đã áp dụng cự ly khe hở chính xác!`);
  };

  // Tự động sửa lỗi kỹ thuật thông minh (1-Click Auto-Fix)
  const handleAutoFixConflict = (conflict: TechnicalConflict) => {
    if (conflict.category === 'rotation_conflict') {
      // Đảo chiều quay cặp trục ép hoặc trống xé
      const feedRollers = components.filter((c) => c.type === 'feed_roller');
      if (feedRollers.length >= 2) {
        const sortedY = [...feedRollers].sort((a, b) => b.y - a.y);
        const topR = sortedY[0];
        const bottomR = sortedY[1];
        setComponents((prev) =>
          prev.map((c) => {
            if (c.id === topR.id) return { ...c, rotationDir: 'CW' };
            if (c.id === bottomR.id) return { ...c, rotationDir: 'CCW' };
            return c;
          })
        );
      }
    } else if (conflict.category === 'mechanical_collision' || conflict.category === 'gap_clearance') {
      // Tách khe hở an toàn về 2.0 mm
      const [idA, idB] = conflict.affectedComponents;
      const compA = components.find((c) => c.id === idA);
      const compB = components.find((c) => c.id === idB);
      if (compA && compB) {
        const dx = compB.x - compA.x;
        const dy = compB.y - compA.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          const targetDist = compA.diameter / 2 + compB.diameter / 2 + 2.0;
          const newX = Math.round(compA.x + (dx / dist) * targetDist);
          const newY = Math.round(compA.y + (dy / dist) * targetDist);
          handleUpdatePosition(compB.id, newX, newY);
        }
      }
    } else if (conflict.category === 'suction_aerodynamics') {
      // Bật quạt hút và tăng tốc gió lên 25 m/s
      setSuctionConfig((prev) => ({
        ...prev,
        active: true,
        airVelocity: 25.0,
      }));
    } else if (conflict.category === 'tension_jam') {
      // Đồng bộ hóa tốc độ RPM
      const drums = components.filter((c) => c.type === 'main_drum');
      setComponents((prev) =>
        prev.map((c) => {
          if (c.type === 'main_drum' && c.rpm < 600) return { ...c, rpm: 800 };
          return c;
        })
      );
    }
  };

  const selectedComp = components.find((c) => c.id === selectedId) || null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* 1. Header tuân thủ quy tắc 3 vùng Top Bar Contract */}
      <Header
        onExportConfig={() => setIsExportModalOpen(true)}
        onOpenReportModal={() => setIsExportModalOpen(true)}
        onResetMachine={() => handleSelectPreset(activeModelId)}
        onOpenNewTab={() => setIsOpenTabModalOpen(true)}
      />

      {/* 2. Thanh công cụ Workspace Toolbar */}
      <Toolbar
        isRunning={isRunning}
        onTogglePlay={() => setIsRunning(!isRunning)}
        simSpeedMultiplier={simSpeedMultiplier}
        onChangeSpeedMultiplier={setSimSpeedMultiplier}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        onAddComponent={handleAddComponent}
        onSelectPreset={handleSelectPreset}
        onCreateNewModel={handleCreateNewModel}
        onOpenGapCalibrator={() => handleOpenGapCalibrator()}
        onOpenSaveModal={() => setIsSaveModalOpen(true)}
        onOpenNewTabModal={() => setIsOpenTabModalOpen(true)}
        savedCount={savedConfigs.length}
        gridSnapMm={gridSnapMm}
        onChangeGridSnap={setGridSnapMm}
        activePresetId={activeModelId}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenCardClothingModal={() => setIsCardClothingModalOpen(true)}
        showHUD={showHUD}
        onToggleHUD={() => setShowHUD((prev) => !prev)}
        speedUnitMode={speedUnitMode}
        onToggleSpeedUnitMode={() => setSpeedUnitMode((prev) => (prev === 'hz' ? 'rpm' : 'hz'))}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isLocked={isLocked}
        onToggleLock={() => {
          setIsLocked((prev) => {
            const next = !prev;
            showToast(next ? '🔒 Đã KHÓA vị trí dàn máy (Chống xê dịch nhầm)' : '🔓 Đã MỞ KHÓA (Cho phép kéo di chuyển)');
            return next;
          });
        }}
        activeModelId={activeModelId}
        activeModelName={activeModelName}
        isDirty={isDirty}
        onQuickSave={handleQuickSave}
        savedConfigs={savedConfigs}
        onLoadConfig={handleLoadSavedModel}
        onRenameConfig={handleRenameConfig}
        onDuplicateConfig={handleDuplicateConfig}
        onDeleteConfig={handleDeleteConfig}
      />

      {/* 3. Thân không gian làm việc chính (Viewport Canvas + Sidebar) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Khung nhìn trực quan (3D / 2D CAD / Split) */}
        <div className="flex-1 flex overflow-hidden relative">
          {viewMode === '3d' && (
            <div className="w-full h-full">
              <Viewport3D
                components={components}
                selectedId={selectedId}
                onSelectComponent={setSelectedId}
                onUpdatePosition={handleUpdatePosition}
                suctionConfig={suctionConfig}
                onChangeSuctionConfig={setSuctionConfig}
                materialConfig={materialConfig}
                fabricRouting={fabricRouting}
                clearances={clearances}
                tensions={tensions}
                isRunning={isRunning}
                simSpeedMultiplier={simSpeedMultiplier}
                onOpenGapCalibrator={(a, b) => handleOpenGapCalibrator(a, b)}
                onOpenCardClothingModal={() => setIsCardClothingModalOpen(true)}
                showHUD={showHUD}
                onToggleHUD={() => setShowHUD((prev) => !prev)}
                speedUnitMode={speedUnitMode}
                isLocked={isLocked}
              />
            </div>
          )}

          {viewMode === '2d_cad' && (
            <div className="w-full h-full">
              <SchematicCAD2D
                components={components}
                selectedId={selectedId}
                onSelectComponent={setSelectedId}
                onUpdatePosition={handleUpdatePosition}
                onOpenGapCalibrator={(a, b) => handleOpenGapCalibrator(a, b)}
                suctionConfig={suctionConfig}
                onChangeSuctionConfig={setSuctionConfig}
                materialConfig={materialConfig}
                clearances={clearances}
                tensions={tensions}
                isRunning={isRunning}
                gridSnapMm={gridSnapMm}
                fabricRouting={fabricRouting}
                isLocked={isLocked}
              />
            </div>
          )}

          {viewMode === 'split' && (
            <div className="w-full h-full grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
              {/* Nửa bên trái: 3D View */}
              <div className="h-full relative">
                <div className="absolute top-2 left-2 z-20 px-2 py-0.5 bg-slate-900/90 text-sky-400 font-mono text-[10px] rounded border border-slate-700 pointer-events-none">
                  KHUNG NHÌN 3D KHÔNG GIAN
                </div>
                <Viewport3D
                  components={components}
                  selectedId={selectedId}
                  onSelectComponent={setSelectedId}
                  onUpdatePosition={handleUpdatePosition}
                  suctionConfig={suctionConfig}
                  onChangeSuctionConfig={setSuctionConfig}
                  materialConfig={materialConfig}
                  fabricRouting={fabricRouting}
                  clearances={clearances}
                  tensions={tensions}
                  isRunning={isRunning}
                  simSpeedMultiplier={simSpeedMultiplier}
                  onOpenGapCalibrator={(a, b) => handleOpenGapCalibrator(a, b)}
                  onOpenCardClothingModal={() => setIsCardClothingModalOpen(true)}
                  showHUD={showHUD}
                  onToggleHUD={() => setShowHUD((prev) => !prev)}
                  speedUnitMode={speedUnitMode}
                  isLocked={isLocked}
                />
              </div>

              {/* Nửa bên phải: 2D CAD Precision Cross-section */}
              <div className="h-full relative">
                <div className="absolute top-2 left-2 z-20 px-2 py-0.5 bg-slate-900/90 text-sky-400 font-mono text-[10px] rounded border border-slate-700 pointer-events-none">
                  BẢN VẼ MẶT CẮT KỸ THUẬT 2D CAD (mm)
                </div>
                <SchematicCAD2D
                  components={components}
                  selectedId={selectedId}
                  onSelectComponent={setSelectedId}
                  onUpdatePosition={handleUpdatePosition}
                  onOpenGapCalibrator={(a, b) => handleOpenGapCalibrator(a, b)}
                  suctionConfig={suctionConfig}
                  onChangeSuctionConfig={setSuctionConfig}
                  materialConfig={materialConfig}
                  clearances={clearances}
                  tensions={tensions}
                  isRunning={isRunning}
                  gridSnapMm={gridSnapMm}
                  fabricRouting={fabricRouting}
                  isLocked={isLocked}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Bảng điều khiển kỹ thuật bên phải */}
        {isSidebarOpen ? (
          <div className="w-80 md:w-96 bg-slate-950 border-l border-slate-800 flex flex-col h-full shrink-0 z-20 transition-all">
            {/* Tab Selector Buttons: 4 tabs chuyên sâu */}
            <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-900/80 text-[11px] font-medium">
              <button
                onClick={() => setSidebarTab('inspector')}
                className={`py-2.5 px-1 flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors border-b-2 ${
                  sidebarTab === 'inspector'
                    ? 'border-sky-500 text-sky-300 bg-slate-900 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
                title="Hiệu chỉnh thông số trục và cự ly khe hở mm"
              >
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span className="truncate">Trục & Cự ly</span>
              </button>

              <button
                onClick={() => setSidebarTab('routing')}
                className={`py-2.5 px-1 flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors border-b-2 ${
                  sidebarTab === 'routing'
                    ? 'border-sky-500 text-sky-300 bg-slate-900 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
                title="Chọn hướng đi của vải và các trục vải đi qua"
              >
                <Route className="w-3.5 h-3.5 text-sky-400" />
                <span className="truncate">Lộ trình vải</span>
              </button>

              <button
                onClick={() => setSidebarTab('diagnostics')}
                className={`py-2.5 px-1 flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors border-b-2 relative ${
                  sidebarTab === 'diagnostics'
                    ? 'border-sky-500 text-sky-300 bg-slate-900 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
                title="Chẩn đoán lỗi xung đột quay và va chạm cơ khí"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span className="truncate">Chẩn đoán</span>
                {dangerCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 ml-0.5" />
                )}
              </button>

              <button
                onClick={() => setSidebarTab('tension')}
                className={`py-2.5 px-1 flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors border-b-2 ${
                  sidebarTab === 'tension'
                    ? 'border-sky-500 text-sky-300 bg-slate-900 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
                title="Giả lập lực căng thời gian thực và điều khiển hút khí"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="truncate">Lực căng</span>
              </button>
            </div>

            {/* Nội dung Tab */}
            <div className="flex-1 overflow-y-auto">
              {sidebarTab === 'inspector' && (
                <RollerInspector
                  selectedComponent={selectedComp}
                  allComponents={components}
                  onUpdateComponent={handleUpdateComponent}
                  onDeleteComponent={handleDeleteComponent}
                  onDuplicateComponent={handleDuplicateComponent}
                  onOpenGapCalibrator={(id) => handleOpenGapCalibrator(id)}
                  onAdjustDistance={handleAdjustDistance}
                  onOpenCardClothingModal={() => setIsCardClothingModalOpen(true)}
                  fabricRouting={fabricRouting}
                  onChangeFabricRouting={setFabricRouting}
                />
              )}

              {sidebarTab === 'routing' && (
                <FabricRoutingPanel
                  fabricRouting={fabricRouting}
                  onChangeFabricRouting={setFabricRouting}
                  materialConfig={materialConfig}
                  onChangeMaterialConfig={setMaterialConfig}
                  components={components}
                  isRunning={isRunning}
                />
              )}

              {sidebarTab === 'diagnostics' && (
                <DiagnosticPanel
                  conflicts={conflicts}
                  clearances={clearances}
                  components={components}
                  suctionConfig={suctionConfig}
                  onAutoFixConflict={handleAutoFixConflict}
                  onOpenGapCalibrator={(a, b) => handleOpenGapCalibrator(a, b)}
                  onSelectComponent={(id) => {
                    setSelectedId(id);
                    setSidebarTab('inspector');
                  }}
                />
              )}

              {sidebarTab === 'tension' && (
                <MaterialTensionHUD
                  materialConfig={materialConfig}
                  onChangeMaterialConfig={setMaterialConfig}
                  suctionConfig={suctionConfig}
                  onChangeSuctionConfig={setSuctionConfig}
                  tensions={tensions}
                  fabricRouting={fabricRouting}
                  onChangeFabricRouting={setFabricRouting}
                  components={components}
                  isRunning={isRunning}
                />
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 right-4 z-30 px-3 py-2 bg-slate-900/95 hover:bg-slate-800 text-sky-300 border border-slate-700 rounded-lg shadow-2xl flex items-center gap-2 text-xs font-semibold backdrop-blur-md transition-all hover:scale-105"
            title="Mở lại bảng hiệu chỉnh trục & thông số"
          >
            <Sliders className="w-4 h-4 text-sky-400" />
            <span>Mở bảng thông số</span>
          </button>
        )}
      </div>

      {/* Modal Căn chỉnh cự ly khe hở chính xác */}
      <GapCalibratorModal
        isOpen={isGapModalOpen}
        onClose={() => setIsGapModalOpen(false)}
        components={components}
        initialIdA={gapTargetA}
        initialIdB={gapTargetB}
        onApplyGap={handleApplyGap}
      />

      {/* Modal Xuất thông số máy & Báo cáo kỹ thuật */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        components={components}
        suctionConfig={suctionConfig}
        materialConfig={materialConfig}
        clearances={clearances}
        conflicts={conflicts}
      />

      {/* Modal Quản lý & Lưu Cấu hình Máy */}
      <SavedConfigsModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        savedConfigs={savedConfigs}
        onSaveCurrent={handleSaveCurrent}
        onLoadConfig={handleLoadSavedModel}
        onDeleteConfig={handleDeleteConfig}
        onImportConfig={handleImportConfig}
        currentComponents={components}
        currentSuction={suctionConfig}
        currentMaterial={materialConfig}
      />

      {/* Modal Hướng Dẫn & Link Mở Tab Mới */}
      <OpenTabModal
        isOpen={isOpenTabModalOpen}
        onClose={() => setIsOpenTabModalOpen(false)}
      />

      {/* Modal Soi Chi Tiết Bề Mặt Kim & Răng Cưa Đồ Kim */}
      <CardClothingModal
        isOpen={isCardClothingModalOpen}
        onClose={() => setIsCardClothingModalOpen(false)}
        components={components}
        selectedComponentId={selectedId}
        onUpdateComponent={handleUpdateComponent}
      />

      {/* Toast thông báo nhanh (Floating Toast) */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md border border-emerald-500/80 text-emerald-300 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold pointer-events-none ring-1 ring-emerald-500/40">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg.message}</span>
        </div>
      )}
    </div>
  );
}

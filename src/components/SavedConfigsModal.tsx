import React, { useState } from 'react';
import { SavedConfiguration, MachineComponent, SuctionSystemConfig, MaterialFeedConfig } from '../types/machine';
import { X, Save, FolderOpen, Trash2, Download, Upload, ExternalLink, Copy, Check, Clock, Calendar, CheckCircle2 } from 'lucide-react';

interface SavedConfigsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedConfigs: SavedConfiguration[];
  onSaveCurrent: (name: string, notes?: string) => void;
  onLoadConfig: (config: SavedConfiguration) => void;
  onDeleteConfig: (id: string) => void;
  onImportConfig: (config: SavedConfiguration) => void;
  currentComponents: MachineComponent[];
  currentSuction: SuctionSystemConfig;
  currentMaterial: MaterialFeedConfig;
}

export const SavedConfigsModal: React.FC<SavedConfigsModalProps> = ({
  isOpen,
  onClose,
  savedConfigs,
  onSaveCurrent,
  onLoadConfig,
  onDeleteConfig,
  onImportConfig,
  currentComponents,
  currentSuction,
  currentMaterial,
}) => {
  const [configName, setConfigName] = useState('');
  const [notes, setNotes] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configName.trim()) return;
    onSaveCurrent(configName.trim(), notes.trim());
    setConfigName('');
    setNotes('');
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.components && Array.isArray(json.components)) {
          const imported: SavedConfiguration = {
            id: `imported_${Date.now()}`,
            name: json.name || file.name.replace('.json', ''),
            savedAt: new Date().toISOString(),
            components: json.components,
            suctionConfig: json.suctionConfig || currentSuction,
            materialConfig: json.materialConfig || currentMaterial,
            notes: json.notes || 'Đã nhập từ tập tin máy tính',
          };
          onImportConfig(imported);
          setSaveSuccessNotice(true);
          setTimeout(() => setSaveSuccessNotice(false), 2500);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Lỗi đọc file JSON:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleExportConfigToJson = (cfg: SavedConfiguration) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cfg, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${cfg.name.replace(/\s+/g, '_')}_textile_machine.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCurrentStateToJson = () => {
    const currentConfig: SavedConfiguration = {
      id: `config_${Date.now()}`,
      name: configName.trim() || 'Cau_hinh_may_xe_vai',
      savedAt: new Date().toISOString(),
      components: currentComponents,
      suctionConfig: currentSuction,
      materialConfig: currentMaterial,
      notes: notes.trim() || 'Xuất trực tiếp từ phần mềm mô phỏng',
    };
    handleExportConfigToJson(currentConfig);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">Quản Lý & Lưu Cấu Hình Máy Xé Vải</h2>
              <p className="text-xs text-slate-400">Lưu lại vị trí các trục, cự ly và thông số đã chỉnh sửa để tải lại bất cứ khi nào</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* 1. Mở qua tab mới */}
          <div className="p-4 bg-sky-950/40 rounded-xl border border-sky-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-sky-400" />
                <h3 className="font-semibold text-sm text-sky-200">Mở Phần Mềm Sang Tab Mới</h3>
              </div>
              <p className="text-[11px] text-sky-300/80 mt-1">
                Xem toàn màn hình ở một tab trình duyệt riêng biệt để có không gian quan sát 3D và 2D rộng nhất.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                title="Sao chép liên kết vào bộ nhớ tạm"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Đã chép link' : 'Chép link'}</span>
              </button>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở tab mới</span>
              </a>
            </div>
          </div>

          {/* 2. Form lưu cấu hình hiện tại */}
          <form onSubmit={handleSave} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Save className="w-4 h-4 text-emerald-400" /> Lưu Cấu Hình Đang Chỉnh Sửa
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                {currentComponents.length} chi tiết trục/dao
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Tên cấu hình thiết lập:</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Cấu hình xé vải Jean dày - Xưởng 1"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Ghi chú kỹ thuật (tùy chọn):</label>
                <input
                  type="text"
                  placeholder="VD: Khe hở dao 1.5mm, 820 RPM"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500">
                Tự động lưu vào trình duyệt của bạn (F5 không mất) hoặc tải file .json về máy.
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleExportCurrentStateToJson}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                  title="Tải tập tin cấu hình .json về máy tính cá nhân"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Tải file .json</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu vào trình duyệt</span>
                </button>
              </div>
            </div>

            {saveSuccessNotice && (
              <div className="p-2.5 bg-emerald-950/80 border border-emerald-700 rounded-lg flex items-center gap-2 text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Đã lưu cấu hình thành công! Bạn có thể tải lại bất cứ lúc nào.</span>
              </div>
            )}
          </form>

          {/* 3. Hướng dẫn từng bước tạo & tự lưu mẫu máy */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <span className="font-semibold text-xs text-sky-300 flex items-center gap-1.5">
              💡 Hướng Dẫn: Cách tạo mẫu mới & tự lưu
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-300">
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/90">
                <strong className="text-white block mb-0.5">1. Bắt đầu mẫu mới</strong>
                <span className="text-slate-400">
                  Bấm nút <strong>&quot;Tạo máy mới&quot;</strong> trên thanh công cụ hoặc chọn 1 mẫu có sẵn để làm khung sườn, sau đó thêm/xóa trục, kéo cự ly.
                </span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/90">
                <strong className="text-white block mb-0.5">2. Đặt tên & Lưu</strong>
                <span className="text-slate-400">
                  Bấm <strong>&quot;Lưu cấu hình&quot;</strong> (hoặc nhấn <strong>Ctrl + S</strong>), đặt tên mẫu và bấm <em>Lưu vào trình duyệt</em>.
                </span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/90">
                <strong className="text-white block mb-0.5">3. Sử dụng & Tải file</strong>
                <span className="text-slate-400">
                  Bấm <strong>&quot;Tải ra máy&quot;</strong> để mở lại bất kỳ lúc nào, hoặc bấm nút tải 📥 để lưu file .json về máy tính gửi cho người khác.
                </span>
              </div>
            </div>
          </div>

          {/* 4. Danh sách cấu hình đã lưu */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-sky-400" /> Danh Sách Cấu Hình Đã Lưu ({savedConfigs.length})
              </h3>

              {/* Nút nhập file từ máy tính */}
              <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Nhập file (.json)</span>
                <input type="file" accept=".json" onChange={handleFileInput} className="hidden" />
              </label>
            </div>

            {savedConfigs.length === 0 ? (
              <div className="p-6 text-center bg-slate-950/60 rounded-xl border border-slate-800 text-slate-500">
                <p>Chưa có cấu hình nào được lưu riêng.</p>
                <p className="text-[11px] mt-1 text-slate-600">
                  Hãy nhập tên ở ô bên trên và bấm &quot;Lưu vào trình duyệt&quot; để tạo bản lưu đầu tiên.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {savedConfigs.map((cfg) => {
                  const dateStr = new Date(cfg.savedAt).toLocaleString('vi-VN');
                  return (
                    <div
                      key={cfg.id}
                      className="p-3 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200 text-xs truncate">{cfg.name}</span>
                          <span className="text-[10px] text-sky-400 font-mono bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/60 shrink-0">
                            {cfg.components.length} trục
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{dateStr}</span>
                          {cfg.notes && <span>· {cfg.notes}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            onLoadConfig(cfg);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition-colors"
                          title="Tải cấu hình này ra màn hình mô phỏng"
                        >
                          Tải ra máy
                        </button>
                        <button
                          onClick={() => handleExportConfigToJson(cfg)}
                          className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded border border-transparent hover:border-slate-700 transition-colors"
                          title="Tải tập tin .json của cấu hình này về máy tính"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteConfig(cfg.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded transition-colors"
                          title="Xóa cấu hình này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900">
          <span className="text-xs text-slate-500">
            Dữ liệu được tự động đồng bộ hóa trên trình duyệt của bạn
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

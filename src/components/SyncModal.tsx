import React, { useState, useRef } from 'react';
import { 
  Cloud, 
  Key, 
  Copy, 
  Check, 
  RefreshCw, 
  Download, 
  Upload, 
  Wifi, 
  WifiOff, 
  ShieldCheck, 
  AlertCircle,
  HardDrive
} from 'lucide-react';
import { SyncState, syncManager } from '../services/sync';
import { db } from '../services/db';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  syncState: SyncState;
  pendingCount: number;
  lastSyncTime: number | null;
  syncKey: string;
  onUpdateSyncKey: (newKey: string) => void;
  onTriggerSync: () => Promise<void>;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  isOnline,
  syncState,
  pendingCount,
  lastSyncTime,
  syncKey,
  onUpdateSyncKey,
  onTriggerSync,
}) => {
  const [keyInput, setKeyInput] = useState(syncKey);
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<{ msg: string; isError: boolean } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(syncKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveKey = () => {
    if (!keyInput.trim()) return;
    onUpdateSyncKey(keyInput.trim());
    onTriggerSync();
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const json = await syncManager.exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ankisync-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`匯出失敗: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const res = await syncManager.importBackup(content);
      if (res.success) {
        setImportStatus({ msg: `成功匯入 ${res.count} 張卡片！`, isError: false });
      } else {
        setImportStatus({ msg: `匯入失敗: ${res.error}`, isError: true });
      }
    };
    reader.readAsText(file);
  };

  const formatLastSync = (ts: number | null) => {
    if (!ts) return '尚未同步過';
    return new Date(ts).toLocaleString('zh-TW', { hour12: false });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-stone-900">雲端同步與離線資料管理</h3>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-base"
          >
            ✕
          </button>
        </div>

        {/* Real-time Status Card */}
        <div className={`p-4 rounded-xl border space-y-2 text-xs ${
          !isOnline 
            ? 'bg-amber-50 border-amber-200 text-amber-900' 
            : 'bg-stone-50 border-stone-200 text-stone-700'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1.5">
              {!isOnline ? (
                <>
                  <WifiOff className="w-4 h-4 text-amber-600" />
                  <span>目前離線中 (本機正常運作)</span>
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  <span>網路連線正常</span>
                </>
              )}
            </span>
            <span className="font-mono text-[11px]">
              {syncState === 'syncing' ? '🔄 正在同步...' : isOnline ? '🟢 已連線' : '🟡 離線暫存'}
            </span>
          </div>

          <div className="flex justify-between text-stone-500 pt-1 border-t border-stone-200/60">
            <span>本機尚未同步至雲端的修改數：</span>
            <span className="font-bold text-stone-800">{pendingCount} 筆</span>
          </div>

          <div className="flex justify-between text-stone-500">
            <span>上次同步時間：</span>
            <span className="font-medium text-stone-800">{formatLastSync(lastSyncTime)}</span>
          </div>
        </div>

        {/* Sync Key (Cross-device sync) */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-stone-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-stone-500" />
              <span>跨裝置同步金鑰 (Sync Key)</span>
            </span>
            <button
              type="button"
              onClick={handleCopyKey}
              className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? '已複製！' : '複製金鑰'}</span>
            </button>
          </label>

          <p className="text-[11px] text-stone-500 leading-relaxed">
            在您的其他筆電、平板或手機瀏覽器開啟本網站，並輸入相同的同步金鑰，即可跨裝置自動同步所有卡片、卡組與學習進度。
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="flex-1 font-mono text-xs px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 text-stone-900"
            />
            <button
              type="button"
              onClick={handleSaveKey}
              className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl"
            >
              更新並同步
            </button>
          </div>
        </div>

        {/* Manual Sync Trigger */}
        <div className="pt-2">
          <button
            onClick={onTriggerSync}
            disabled={!isOnline || syncState === 'syncing'}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-stone-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
            <span>立即觸發雙向雲端同步</span>
          </button>
        </div>

        {/* Offline & Local Data Guarantees */}
        <div className="border-t border-stone-100 pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-stone-800">資料安全與本機備份</h4>
          </div>
          <p className="text-[11px] text-stone-500">
            採用 Offline-First 離線優先架構，即便完全斷網，所有卡組、卡片增刪改與學習複習紀錄皆安全保存在本機 IndexedDB，重獲連線後將自動無縫補齊同步。
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-stone-300 hover:bg-stone-50 rounded-xl text-xs font-semibold text-stone-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span>匯出 JSON 備份</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-stone-300 hover:bg-stone-50 rounded-xl text-xs font-semibold text-stone-700 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-stone-500" />
              <span>匯入 JSON 備份</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {importStatus && (
            <div className={`p-2.5 rounded-xl text-xs flex items-center gap-1.5 ${
              importStatus.isError ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <Check className="w-3.5 h-3.5" />
              <span>{importStatus.msg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

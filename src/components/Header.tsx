import React from 'react';
import { 
  BookOpen, 
  Search, 
  Layers, 
  BarChart2, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CloudCheck, 
  Key, 
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SyncState } from '../services/sync';

interface HeaderProps {
  currentTab: 'decks' | 'dictionary' | 'cards' | 'stats';
  onSelectTab: (tab: 'decks' | 'dictionary' | 'cards' | 'stats') => void;
  isOnline: boolean;
  syncState: SyncState;
  pendingCount: number;
  lastSyncTime: number | null;
  onTriggerSync: () => void;
  onOpenSyncModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  isOnline,
  syncState,
  pendingCount,
  lastSyncTime,
  onTriggerSync,
  onOpenSyncModal,
}) => {
  const formatLastSync = (ts: number | null) => {
    if (!ts) return '尚未同步';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return '剛剛';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between">
          <div 
            onClick={() => onSelectTab('decks')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-blue-600 transition-colors">
              <Layers className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg text-stone-900 tracking-tight">AnkiSync</span>
                <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                  SRS 雲端離線
                </span>
              </div>
              <p className="text-[11px] text-stone-600 hidden sm:block">字典自動建卡 · 間隔重複 · 雙向雲端同步</p>
            </div>
          </div>

          {/* Mobile Sync Pill */}
          <div className="flex md:hidden items-center gap-1.5">
            <button
              onClick={onOpenSyncModal}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-all ${
                !isOnline
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : syncState === 'syncing'
                  ? 'bg-blue-50 text-blue-700 border-blue-300 animate-pulse'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              {!isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>離線 ({pendingCount})</span>
                </>
              ) : syncState === 'syncing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>同步中</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{pendingCount > 0 ? `待同步 (${pendingCount})` : '已連線'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-stone-100/90 p-1 rounded-xl border border-stone-200/80 w-full md:w-auto justify-center">
          <button
            onClick={() => onSelectTab('decks')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              currentTab === 'decks'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200/50'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>我的卡組</span>
          </button>

          <button
            onClick={() => onSelectTab('dictionary')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              currentTab === 'dictionary'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200/50'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <Search className="w-4 h-4 text-indigo-600" />
            <span>字典抓取建卡</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse hidden sm:inline-block"></span>
          </button>

          <button
            onClick={() => onSelectTab('cards')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              currentTab === 'cards'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200/50'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>卡片管理</span>
          </button>

          <button
            onClick={() => onSelectTab('stats')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              currentTab === 'stats'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200/50'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-amber-600" />
            <span>學習統計</span>
          </button>
        </nav>

        {/* Sync & Connectivity Status Controls (Desktop) */}
        <div className="hidden md:flex items-center gap-2">
          {/* Online/Offline Badge */}
          <div 
            onClick={onOpenSyncModal}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border cursor-pointer select-none transition-all ${
              !isOnline
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : pendingCount > 0
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
            title="點擊設定跨裝置同步金鑰與檢視同步狀態"
          >
            {!isOnline ? (
              <>
                <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="leading-tight">
                  <p className="font-semibold">離線編輯中</p>
                  <p className="text-[10px] text-amber-700">{pendingCount} 筆變更暫存本機</p>
                </div>
              </>
            ) : syncState === 'syncing' ? (
              <>
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                <div className="leading-tight">
                  <p className="font-semibold">同步資料中...</p>
                  <p className="text-[10px] text-blue-700">正在與雲端雙向合併</p>
                </div>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="leading-tight">
                  <p className="font-semibold flex items-center gap-1">
                    {pendingCount > 0 ? `有 ${pendingCount} 筆待同步` : '已與雲端同步'}
                  </p>
                  <p className="text-[10px] text-emerald-700">上次：{formatLastSync(lastSyncTime)}</p>
                </div>
              </>
            )}
          </div>

          {/* Manual Sync Button */}
          <button
            onClick={onTriggerSync}
            disabled={!isOnline || syncState === 'syncing'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white hover:bg-stone-800 disabled:bg-stone-300 text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95"
            title="立即與伺服器雙向同步"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
            <span>立即同步</span>
          </button>

          {/* Sync Key / Backup Settings Button */}
          <button
            onClick={onOpenSyncModal}
            className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors"
            title="跨裝置同步設定 & 備份匯入匯出"
          >
            <Key className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

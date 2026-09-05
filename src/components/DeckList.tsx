import React, { useState } from 'react';
import { 
  Play, 
  Plus, 
  Search, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Clock, 
  Sparkles, 
  BookOpen, 
  Calendar, 
  CheckCircle2,
  Layers,
  ArrowRight,
  Flame
} from 'lucide-react';
import { Card, Deck } from '../types';
import { categorizeDeckCards } from '../services/srs';

interface DeckListProps {
  decks: Deck[];
  cards: Card[];
  onStartStudy: (deckId: string) => void;
  onCreateDeck: (name: string, description: string, color: string) => void;
  onDeleteDeck: (deckId: string) => void;
  onEditDeck: (deck: Deck) => void;
  onNavigateToDictionary: (defaultDeckId?: string) => void;
  onNavigateToCards: (deckId?: string) => void;
}

const DECK_COLORS = [
  '#2563eb', // Blue
  '#059669', // Emerald
  '#7c3aed', // Violet
  '#d97706', // Amber
  '#e11d48', // Rose
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
];

export const DeckList: React.FC<DeckListProps> = ({
  decks,
  cards,
  onStartStudy,
  onCreateDeck,
  onDeleteDeck,
  onEditDeck,
  onNavigateToDictionary,
  onNavigateToCards,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [newDeckColor, setNewDeckColor] = useState(DECK_COLORS[0]);
  const [activeMenuDeckId, setActiveMenuDeckId] = useState<string | null>(null);

  // Overall stats
  const totalCards = cards.filter(c => !c.deleted).length;
  const totalDueCards = cards.filter(c => !c.deleted && (c.state === 'new' || c.due <= Date.now())).length;
  const learnedCards = cards.filter(c => !c.deleted && c.state === 'review').length;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    onCreateDeck(newDeckName.trim(), newDeckDesc.trim(), newDeckColor);
    setNewDeckName('');
    setNewDeckDesc('');
    setIsCreateModalOpen(false);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner: Daily Study Overview & Quick Actions */}
      <div className="bg-stone-900 text-white rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-blue-600/20 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>今日間隔重複學習任務</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {totalDueCards > 0 ? (
                <>今日共有 <span className="text-amber-400">{totalDueCards}</span> 張卡片待複習</>
              ) : (
                <>太棒了！今日所有卡組已全數複習完畢 🎉</>
              )}
            </h1>
            <p className="text-stone-300 text-sm leading-relaxed">
              基於 Anki SM-2 科學記憶曲線，依據遺忘臨界點自動排程複習，支援完全離線編輯與多裝置雲端同步。
            </p>
          </div>

          {/* Quick Stat Blocks & Action */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 bg-stone-800/80 backdrop-blur px-4 py-3 rounded-xl border border-stone-700/60">
              <div>
                <p className="text-[11px] text-stone-400 font-medium">總單字卡</p>
                <p className="text-xl font-bold text-white">{totalCards}</p>
              </div>
              <div className="w-px h-8 bg-stone-700 mx-1" />
              <div>
                <p className="text-[11px] text-stone-400 font-medium">長期記憶 (成熟)</p>
                <p className="text-xl font-bold text-emerald-400">{learnedCards}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateToDictionary()}
                className="flex items-center gap-2 px-4 py-3 bg-white text-stone-900 hover:bg-stone-100 font-semibold rounded-xl text-sm transition-all shadow-sm active:scale-95"
              >
                <Search className="w-4 h-4 text-indigo-600" />
                <span>查字典自動建卡</span>
              </button>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-3 bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold rounded-xl text-sm transition-all border border-stone-700"
              >
                <Plus className="w-4 h-4 text-blue-400" />
                <span>建立新卡組</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Decks Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">我的記憶卡組 ({decks.length})</h2>
            <p className="text-xs text-stone-500">選擇卡組立即開始間隔重複學習，或點擊管理卡片內容</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            <Plus className="w-4 h-4" />
            <span>新增卡組</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {decks.map(deck => {
            const deckCards = cards.filter(c => c.deckId === deck.id && !c.deleted);
            const stats = categorizeDeckCards(deckCards);
            const isMenuOpen = activeMenuDeckId === deck.id;

            return (
              <div 
                key={deck.id}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-stone-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Deck Card Header */}
                <div className="p-5 pb-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" 
                        style={{ backgroundColor: deck.color || '#2563eb' }}
                      />
                      <h3 className="font-bold text-stone-900 text-base leading-snug group-hover:text-blue-600 transition-colors">
                        {deck.name}
                      </h3>
                    </div>

                    {/* Options Menu Toggle */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuDeckId(isMenuOpen ? null : deck.id);
                        }}
                        className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {isMenuOpen && (
                        <div 
                          className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setActiveMenuDeckId(null);
                              onNavigateToDictionary(deck.id);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                          >
                            <Search className="w-3.5 h-3.5 text-indigo-500" />
                            <span>查字典新增至此卡組</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuDeckId(null);
                              onNavigateToCards(deck.id);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                          >
                            <Layers className="w-3.5 h-3.5 text-emerald-500" />
                            <span>瀏覽管理卡片 ({deckCards.length})</span>
                          </button>
                          <div className="my-1 border-t border-stone-100" />
                          <button
                            onClick={() => {
                              setActiveMenuDeckId(null);
                              if (confirm(`確定要刪除卡組「${deck.name}」及其內部 ${deckCards.length} 張卡片嗎？`)) {
                                onDeleteDeck(deck.id);
                              }
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>刪除此卡組</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-stone-500 line-clamp-2 min-h-[32px] leading-relaxed">
                    {deck.description || '暫無說明'}
                  </p>

                  {/* SRS Stats Pills */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-2 text-center">
                      <p className="text-[10px] font-semibold text-amber-800">待複習</p>
                      <p className="text-base font-extrabold text-amber-700">{stats.dueCount}</p>
                    </div>
                    <div className="bg-blue-50/80 border border-blue-200/60 rounded-xl p-2 text-center">
                      <p className="text-[10px] font-semibold text-blue-800">新卡片</p>
                      <p className="text-base font-extrabold text-blue-700">{stats.newCount}</p>
                    </div>
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-2 text-center">
                      <p className="text-[10px] font-semibold text-stone-600">總卡片</p>
                      <p className="text-base font-extrabold text-stone-800">{stats.total}</p>
                    </div>
                  </div>
                </div>

                {/* Deck Card Action Footer */}
                <div className="px-5 py-3.5 bg-stone-50/90 border-t border-stone-100 flex items-center justify-between gap-3">
                  <button
                    onClick={() => onNavigateToCards(deck.id)}
                    className="text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
                  >
                    卡片清單
                  </button>

                  {stats.dueTotal > 0 ? (
                    <button
                      onClick={() => onStartStudy(deck.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>開始學習 ({stats.dueTotal})</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onStartStudy(deck.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold text-xs rounded-xl transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>複習所有 ({stats.total})</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Deck Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4">
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-lg font-bold text-stone-900">建立新學習卡組</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  卡組名稱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：日文 JLPT N2 核心動詞、商用英語面試"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  卡組描述（選填）
                </label>
                <textarea
                  rows={2}
                  placeholder="簡要描述此卡組的學習目標或範圍"
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-2">
                  識別色彩標籤
                </label>
                <div className="flex items-center gap-3">
                  {DECK_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewDeckColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        newDeckColor === c ? 'ring-2 ring-offset-2 ring-stone-900 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newDeckName.trim()}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-stone-300 text-white text-xs font-semibold shadow-xs transition-all"
                >
                  確定建立
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Volume2, 
  BookOpen, 
  Calendar, 
  Layers, 
  Plus, 
  Check, 
  X,
  Clock,
  Sparkles
} from 'lucide-react';
import { Card, Deck } from '../types';
import { playAudio } from '../services/audio';

interface CardManagerProps {
  decks: Deck[];
  cards: Card[];
  selectedDeckId?: string;
  onUpdateCard: (card: Card) => void;
  onDeleteCard: (cardId: string) => void;
  onNavigateToDictionary: () => void;
}

export const CardManager: React.FC<CardManagerProps> = ({
  decks,
  cards,
  selectedDeckId: initialDeckId,
  onUpdateCard,
  onDeleteCard,
  onNavigateToDictionary,
}) => {
  const [filterDeckId, setFilterDeckId] = useState<string>(initialDeckId || 'ALL');
  const [filterState, setFilterState] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  const activeCards = cards.filter(c => !c.deleted);

  const filteredCards = activeCards.filter(card => {
    if (filterDeckId !== 'ALL' && card.deckId !== filterDeckId) return false;
    if (filterState !== 'ALL') {
      if (filterState === 'due') {
        const isDue = card.state === 'new' || card.due <= Date.now();
        if (!isDue) return false;
      } else if (card.state !== filterState) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchFront = card.front.toLowerCase().includes(q);
      const matchBack = (card.primaryMeaning || card.back || '').toLowerCase().includes(q);
      const matchNotes = (card.notes || '').toLowerCase().includes(q);
      const matchTags = (card.tags || []).some(t => t.toLowerCase().includes(q));
      if (!matchFront && !matchBack && !matchNotes && !matchTags) return false;
    }
    return true;
  });

  const getDeckName = (deckId: string) => {
    const d = decks.find(deck => deck.id === deckId);
    return d ? d.name : '未知卡組';
  };

  const getDeckColor = (deckId: string) => {
    const d = decks.find(deck => deck.id === deckId);
    return d?.color || '#2563eb';
  };

  const formatDueDate = (due: number, state: Card['state']) => {
    if (state === 'new') return '新卡片 (待初次學習)';
    const now = Date.now();
    const diffDays = Math.round((due - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `逾期 ${Math.abs(diffDays)} 天`;
    if (diffDays === 0) return '今日到期';
    if (diffDays === 1) return '明日到期';
    return `${diffDays} 天後到期`;
  };

  const handleResetSRS = (card: Card) => {
    if (confirm(`確定要重置「${card.front}」的記憶進度嗎？卡片將回到新卡片狀態。`)) {
      onUpdateCard({
        ...card,
        state: 'new',
        repetitions: 0,
        interval: 0,
        easeFactor: 2.5,
        due: Date.now(),
        lastReviewed: null,
        lapses: 0,
        syncStatus: 'pending',
      });
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    onUpdateCard({
      ...editingCard,
      syncStatus: 'pending',
    });
    setEditingCard(null);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600" />
            <span>卡片管理與離線編輯</span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            即時搜尋、檢視與修改卡片內容。所有變更均即時保存在本機，並於連線時自動排程雲端同步。
          </p>
        </div>

        <button
          onClick={onNavigateToDictionary}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>字典抓取新增卡片</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋單字、中文釋義、備註或標籤..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Deck Selector */}
          <div>
            <select
              value={filterDeckId}
              onChange={(e) => setFilterDeckId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">所有卡組 ({activeCards.length})</option>
              {decks.map(d => {
                const count = activeCards.filter(c => c.deckId === d.id).length;
                return (
                  <option key={d.id} value={d.id}>
                    {d.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* State Selector */}
          <div>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">所有狀態</option>
              <option value="due">今日待複習</option>
              <option value="new">新卡片 (New)</option>
              <option value="learning">學習中 (Learning)</option>
              <option value="review">已熟記複習中 (Review)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-stone-500 px-1">
          <span>共篩選出 <b>{filteredCards.length}</b> 張卡片</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-stone-400 hover:text-stone-700 underline"
            >
              清除搜尋條件
            </button>
          )}
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-3">
        {filteredCards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-stone-300 mx-auto" />
            <h3 className="text-sm font-bold text-stone-700">找不到符合條件的卡片</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              可以嘗試更換篩選條件，或使用「字典自動抓取」快速新增單字卡。
            </p>
          </div>
        ) : (
          filteredCards.map(card => {
            const deckName = getDeckName(card.deckId);
            const deckColor = getDeckColor(card.deckId);

            return (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-stone-300 shadow-2xs hover:shadow-xs p-4 sm:p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Card Identity & Linguistic details */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span 
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
                      style={{ backgroundColor: deckColor }}
                    >
                      {deckName}
                    </span>

                    {card.partOfSpeech && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                        {card.partOfSpeech}
                      </span>
                    )}

                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                      card.state === 'new'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : card.state === 'review'
                        ? 'bg-stone-50 text-stone-700 border-stone-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {card.state === 'new' ? '新單字' : `間隔 ${card.interval} 天 (成功 ${card.repetitions} 次)`}
                    </span>

                    {card.syncStatus === 'pending' && (
                      <span className="text-[10px] text-amber-600 font-medium">
                        • 待雲端同步
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-3">
                    <h3 className="text-lg md:text-xl font-black text-stone-900">
                      {card.front}
                    </h3>
                    {card.phonetic && (
                      <span className="text-xs font-mono text-stone-500">
                        {card.phonetic}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => playAudio(card.front, card.audioUrl)}
                      className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
                      title="播放發音"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm font-semibold text-amber-950">
                    {card.primaryMeaning || card.back}
                  </p>

                  {card.examples && card.examples.length > 0 && (
                    <p className="text-xs text-stone-500 italic line-clamp-1">
                      例：{card.examples[0].sentence}
                    </p>
                  )}

                  {card.notes && (
                    <p className="text-[11px] text-stone-400 line-clamp-1">
                      備註：{card.notes}
                    </p>
                  )}
                </div>

                {/* Right: SRS Schedule & Action Controls */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-stone-100 gap-2 shrink-0">
                  <div className="text-left md:text-right">
                    <p className="text-[11px] font-semibold text-stone-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      {formatDueDate(card.due, card.state)}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      難易係數: {card.easeFactor ? card.easeFactor.toFixed(2) : '2.50'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingCard(card)}
                      className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                      title="編輯卡片"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleResetSRS(card)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                      title="重置記憶狀態為新卡片"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`確定要刪除「${card.front}」嗎？`)) {
                          onDeleteCard(card.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="刪除卡片"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Card Edit Modal */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4">
          <div 
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">編輯記憶卡片</h3>
              <button
                onClick={() => setEditingCard(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              {/* Target Deck */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">所屬卡組</label>
                <select
                  value={editingCard.deckId}
                  onChange={(e) => setEditingCard({ ...editingCard, deckId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white"
                >
                  {decks.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Front */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">正面 (單字 / 詞彙)</label>
                <input
                  type="text"
                  required
                  value={editingCard.front}
                  onChange={(e) => setEditingCard({ ...editingCard, front: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-bold text-stone-900 rounded-xl border border-stone-300"
                />
              </div>

              {/* Back */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">背面 (主要繁體中文解義)</label>
                <input
                  type="text"
                  required
                  value={editingCard.primaryMeaning || editingCard.back}
                  onChange={(e) => setEditingCard({ 
                    ...editingCard, 
                    back: e.target.value,
                    primaryMeaning: e.target.value 
                  })}
                  className="w-full px-3 py-2 text-sm text-stone-900 rounded-xl border border-stone-300"
                />
              </div>

              {/* Phonetic & POS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">音標 (IPA)</label>
                  <input
                    type="text"
                    value={editingCard.phonetic || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, phonetic: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">詞性</label>
                  <input
                    type="text"
                    value={editingCard.partOfSpeech || ''}
                    onChange={(e) => setEditingCard({ ...editingCard, partOfSpeech: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">記憶技巧與備註</label>
                <textarea
                  rows={2}
                  value={editingCard.notes || ''}
                  onChange={(e) => setEditingCard({ ...editingCard, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                >
                  儲存變更
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Volume2, 
  ArrowLeft, 
  RotateCw, 
  Check, 
  HelpCircle, 
  Sparkles, 
  CheckCircle2, 
  Trophy, 
  Calendar,
  Layers,
  Clock,
  Keyboard
} from 'lucide-react';
import { Card, Deck, SRSRating } from '../types';
import { calculateNextSRS, getNextIntervalPreview } from '../services/srs';
import { playAudio } from '../services/audio';

interface StudySessionProps {
  deck: Deck;
  cards: Card[];
  onCompleteCard: (card: Card, rating: SRSRating) => void;
  onExitStudy: () => void;
}

export const StudySession: React.FC<StudySessionProps> = ({
  deck,
  cards,
  onCompleteCard,
  onExitStudy,
}) => {
  // Filter queue: due cards first, then new cards; if none due, allow studying all cards in deck
  const [queue, setQueue] = useState<Card[]>(() => {
    const dueOrNew = cards.filter(c => !c.deleted && (c.state === 'new' || c.due <= Date.now()));
    return dueOrNew.length > 0 ? dueOrNew : cards.filter(c => !c.deleted);
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const currentCard = queue[currentIndex];

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  const handlePlayAudio = useCallback((text?: string, url?: string) => {
    if (!currentCard) return;
    playAudio(text || currentCard.front, url || currentCard.audioUrl);
  }, [currentCard]);

  const handleRate = useCallback((rating: SRSRating) => {
    if (!currentCard) return;

    onCompleteCard(currentCard, rating);
    setCompletedCount(prev => prev + 1);

    if (rating === 1) {
      // "Again" - reinsert card at the end of the queue for this session
      setQueue(prev => [...prev, currentCard]);
    }

    if (currentIndex + 1 >= queue.length) {
      setSessionCompleted(true);
    } else {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  }, [currentCard, currentIndex, queue.length, onCompleteCard]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in input, ignore
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        handleFlip();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handlePlayAudio();
      } else if (isFlipped) {
        if (e.key === '1') handleRate(1);
        if (e.key === '2') handleRate(2);
        if (e.key === '3') handleRate(3);
        if (e.key === '4') handleRate(4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handlePlayAudio, handleRate, isFlipped]);

  // Auto-play pronunciation when card appears
  useEffect(() => {
    if (currentCard) {
      handlePlayAudio();
    }
  }, [currentIndex]);

  if (sessionCompleted || !currentCard) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600 shadow-inner">
          <Trophy className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-stone-900">恭喜！今日學習目標達成</h2>
          <p className="text-stone-600 text-sm max-w-md mx-auto">
            卡組「<span className="font-semibold text-stone-900">{deck.name}</span>」本次共複習了{' '}
            <span className="font-bold text-blue-600">{completedCount}</span> 張卡片。
          </p>
        </div>

        <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl max-w-sm mx-auto text-left text-xs text-stone-600 space-y-2">
          <div className="flex justify-between">
            <span>複習總次數</span>
            <span className="font-bold text-stone-900">{completedCount} 次</span>
          </div>
          <div className="flex justify-between">
            <span>演算法排程</span>
            <span className="font-bold text-emerald-600">SM-2 間隔重複已更新</span>
          </div>
          <div className="flex justify-between">
            <span>雲端與離線狀態</span>
            <span className="font-bold text-stone-800">本機已安全暫存</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={onExitStudy}
            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            返回卡組列表
          </button>
          <button
            onClick={() => {
              setQueue(cards.filter(c => !c.deleted));
              setCurrentIndex(0);
              setIsFlipped(false);
              setSessionCompleted(false);
            }}
            className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl transition-all"
          >
            再次溫習此卡組
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round((currentIndex / queue.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-16">
      {/* Top Header: Navigation & Progress */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onExitStudy}
          className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>結束複習</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: deck.color }} />
          <span className="font-bold text-xs text-stone-800">{deck.name}</span>
        </div>

        {/* Counter */}
        <div className="text-xs font-medium text-stone-500">
          進度：<span className="font-bold text-stone-800">{currentIndex + 1}</span> / {queue.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
        <div 
          className="bg-blue-600 h-full transition-all duration-300 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Flashcard Main Surface */}
      <div 
        onClick={handleFlip}
        className={`w-full min-h-[380px] bg-white rounded-3xl border border-stone-200/90 shadow-sm hover:shadow-md cursor-pointer transition-all p-6 md:p-8 flex flex-col justify-between select-none relative group ${
          isFlipped ? 'ring-2 ring-blue-500/20 border-blue-200' : ''
        }`}
      >
        {/* Card Header Pills */}
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            {currentCard.partOfSpeech && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                {currentCard.partOfSpeech}
              </span>
            )}
            {currentCard.state === 'new' && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                新卡片
              </span>
            )}
            {currentCard.repetitions > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-600">
                已記憶 {currentCard.repetitions} 次
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePlayAudio();
              }}
              className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              title="播放發音 (快速鍵：R)"
            >
              <Volume2 className="w-5 h-5 text-indigo-600" />
            </button>
          </div>
        </div>

        {/* Front Content (Prominent Word or Question) */}
        <div className="py-6 text-center space-y-3">
          <h2 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight">
            {currentCard.front}
          </h2>

          {currentCard.phonetic && (
            <p className="text-stone-500 font-mono text-base md:text-lg">
              {currentCard.phonetic}
            </p>
          )}

          {!isFlipped && (
            <div className="pt-6">
              <span className="inline-flex items-center gap-1.5 text-xs text-stone-400 bg-stone-50 px-4 py-1.5 rounded-full border border-stone-200/70 group-hover:border-stone-300">
                <RotateCw className="w-3.5 h-3.5" />
                點擊卡片或按 <kbd className="px-1 bg-white border rounded font-mono text-[10px]">Space</kbd> 查看答案
              </span>
            </div>
          )}
        </div>

        {/* Back Content (Revealed after flip) */}
        {isFlipped ? (
          <div 
            className="border-t border-stone-100 pt-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Primary Meaning */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-center">
              <span className="text-xs font-semibold text-amber-800">繁體中文解義</span>
              <p className="text-xl md:text-2xl font-black text-amber-950 mt-0.5">
                {currentCard.primaryMeaning || currentCard.back}
              </p>
            </div>

            {/* Bilingual Example Sentences */}
            {currentCard.examples && currentCard.examples.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-stone-600">情境實用語境例句：</p>
                <div className="space-y-2">
                  {currentCard.examples.map((ex, idx) => (
                    <div key={idx} className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-stone-900 leading-snug">
                          {ex.sentence}
                        </p>
                        <button
                          type="button"
                          onClick={() => playAudio(ex.sentence)}
                          className="text-stone-400 hover:text-stone-700 shrink-0 p-1"
                          title="播放例句發音"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {ex.translation && (
                        <p className="text-xs text-stone-500">{ex.translation}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Synonyms & Collocations */}
            {((currentCard.synonyms && currentCard.synonyms.length > 0) || (currentCard.collocations && currentCard.collocations.length > 0)) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {currentCard.synonyms && currentCard.synonyms.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500 font-medium">近義詞:</span>
                    {currentCard.synonyms.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {currentCard.collocations && currentCard.collocations.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500 font-medium">常見搭配:</span>
                    {currentCard.collocations.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes / Mnemonic */}
            {currentCard.notes && (
              <div className="p-3 bg-stone-100/70 rounded-xl border border-stone-200/70 text-xs text-stone-600 space-y-1">
                <span className="font-bold text-stone-700 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  記憶技巧 / 詞源備註：
                </span>
                <p className="leading-relaxed">{currentCard.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-4" />
        )}
      </div>

      {/* SRS Rating Bar (SM-2 Buttons with Next Interval Previews) */}
      <div className="space-y-2">
        {isFlipped ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 1: Again (忘記) */}
            <button
              onClick={() => handleRate(1)}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition-all active:scale-95 group shadow-2xs"
            >
              <span className="text-[11px] font-bold text-rose-500">
                {getNextIntervalPreview(currentCard, 1)}
              </span>
              <span className="text-sm font-extrabold text-rose-800">1. 忘記 (Again)</span>
              <span className="text-[10px] text-rose-500/80 mt-0.5 hidden sm:inline">鍵盤按 1</span>
            </button>

            {/* 2: Hard (困難) */}
            <button
              onClick={() => handleRate(2)}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 transition-all active:scale-95 group shadow-2xs"
            >
              <span className="text-[11px] font-bold text-amber-600">
                {getNextIntervalPreview(currentCard, 2)}
              </span>
              <span className="text-sm font-extrabold text-amber-900">2. 困難 (Hard)</span>
              <span className="text-[10px] text-amber-600/80 mt-0.5 hidden sm:inline">鍵盤按 2</span>
            </button>

            {/* 3: Good (良好) */}
            <button
              onClick={() => handleRate(3)}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 transition-all active:scale-95 group shadow-2xs"
            >
              <span className="text-[11px] font-bold text-blue-600">
                {getNextIntervalPreview(currentCard, 3)}
              </span>
              <span className="text-sm font-extrabold text-blue-900">3. 良好 (Good)</span>
              <span className="text-[10px] text-blue-600/80 mt-0.5 hidden sm:inline">鍵盤按 3</span>
            </button>

            {/* 4: Easy (容易) */}
            <button
              onClick={() => handleRate(4)}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 transition-all active:scale-95 group shadow-2xs"
            >
              <span className="text-[11px] font-bold text-emerald-600">
                {getNextIntervalPreview(currentCard, 4)}
              </span>
              <span className="text-sm font-extrabold text-emerald-900">4. 容易 (Easy)</span>
              <span className="text-[10px] text-emerald-600/80 mt-0.5 hidden sm:inline">鍵盤按 4</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleFlip}
            className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-2xl shadow-sm transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            <RotateCw className="w-4 h-4" />
            <span>翻開答案 (空白鍵 / Space)</span>
          </button>
        )}

        {/* Keyboard shortcut legend */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-stone-400 pt-1">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-stone-100 border rounded font-mono text-[10px]">Space</kbd> 翻開卡片
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-stone-100 border rounded font-mono text-[10px]">1-4</kbd> 記憶評分
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-stone-100 border rounded font-mono text-[10px]">R</kbd> 重新發音
          </span>
        </div>
      </div>
    </div>
  );
};

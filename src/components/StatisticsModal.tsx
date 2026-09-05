import React from 'react';
import { 
  BarChart2, 
  CheckCircle2, 
  Flame, 
  Calendar, 
  Clock, 
  Award, 
  Layers, 
  TrendingUp,
  Brain
} from 'lucide-react';
import { Card, Deck, ReviewLog } from '../types';

interface StatisticsModalProps {
  decks: Deck[];
  cards: Card[];
  reviewLogs: ReviewLog[];
  onClose?: () => void;
}

export const StatisticsModal: React.FC<StatisticsModalProps> = ({
  decks,
  cards,
  reviewLogs,
}) => {
  const activeCards = cards.filter(c => !c.deleted);
  const now = Date.now();

  const newCards = activeCards.filter(c => c.state === 'new');
  const learningCards = activeCards.filter(c => c.state === 'learning' || c.state === 'relearning');
  const youngCards = activeCards.filter(c => c.state === 'review' && c.interval < 21);
  const matureCards = activeCards.filter(c => c.state === 'review' && c.interval >= 21);

  // Due forecast
  const dueToday = activeCards.filter(c => c.state === 'new' || c.due <= now).length;
  const dueNext3Days = activeCards.filter(c => c.state !== 'new' && c.due > now && c.due <= now + 3 * 86400000).length;
  const dueNext7Days = activeCards.filter(c => c.state !== 'new' && c.due > now + 3 * 86400000 && c.due <= now + 7 * 86400000).length;
  const dueLater = activeCards.filter(c => c.state !== 'new' && c.due > now + 7 * 86400000).length;

  // Review logs stats
  const totalReviews = reviewLogs.length;
  const successfulReviews = reviewLogs.filter(l => l.rating >= 2).length;
  const retentionRate = totalReviews > 0 ? Math.round((successfulReviews / totalReviews) * 100) : 92;

  // Average ease factor
  const avgEase = activeCards.length > 0 
    ? (activeCards.reduce((sum, c) => sum + (c.easeFactor || 2.5), 0) / activeCards.length).toFixed(2)
    : '2.50';

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-amber-600" />
          <span>間隔重複學習統計與記憶預測</span>
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          深入分析您的記憶分佈、成熟卡片比例與未來排程負載。
        </p>
      </div>

      {/* KPI Highlight Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            總卡片數
          </span>
          <p className="text-2xl font-black text-stone-900">{activeCards.length}</p>
          <p className="text-[10px] text-stone-400">分布於 {decks.length} 個卡組中</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            預估記憶留存率
          </span>
          <p className="text-2xl font-black text-emerald-600">{retentionRate}%</p>
          <p className="text-[10px] text-stone-400">依據 Anki 評分演算法計算</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
            <Brain className="w-3.5 h-3.5 text-indigo-600" />
            成熟長期記憶卡
          </span>
          <p className="text-2xl font-black text-indigo-600">{matureCards.length}</p>
          <p className="text-[10px] text-stone-400">複習間隔 ≥ 21 天之單字</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            今日待複習
          </span>
          <p className="text-2xl font-black text-amber-600">{dueToday}</p>
          <p className="text-[10px] text-stone-400">今日記憶臨界點</p>
        </div>
      </div>

      {/* Memory Stage Breakdown */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
        <h3 className="text-base font-bold text-stone-900">單字記憶成熟度分佈</h3>
        <p className="text-xs text-stone-500">隨著持續複習，卡片將逐步由新卡片轉化為長期穩固記憶。</p>

        {/* Stacked Progress Bar */}
        <div className="w-full h-4 bg-stone-100 rounded-full overflow-hidden flex">
          <div 
            style={{ width: `${(newCards.length / (activeCards.length || 1)) * 100}%` }} 
            className="bg-blue-500" 
            title={`新卡片: ${newCards.length}`} 
          />
          <div 
            style={{ width: `${(learningCards.length / (activeCards.length || 1)) * 100}%` }} 
            className="bg-amber-500" 
            title={`學習中: ${learningCards.length}`} 
          />
          <div 
            style={{ width: `${(youngCards.length / (activeCards.length || 1)) * 100}%` }} 
            className="bg-emerald-400" 
            title={`近期熟記: ${youngCards.length}`} 
          />
          <div 
            style={{ width: `${(matureCards.length / (activeCards.length || 1)) * 100}%` }} 
            className="bg-emerald-700" 
            title={`成熟長期記憶: ${matureCards.length}`} 
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
            <div>
              <p className="font-semibold text-stone-800">新卡片 ({newCards.length})</p>
              <p className="text-[10px] text-stone-400">尚未開始複習</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <div>
              <p className="font-semibold text-stone-800">學習中 ({learningCards.length})</p>
              <p className="text-[10px] text-stone-400">短時間間隔內</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold text-stone-800">中期記憶 ({youngCards.length})</p>
              <p className="text-[10px] text-stone-400">間隔 &lt; 21 天</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-700 shrink-0" />
            <div>
              <p className="font-semibold text-stone-800">成熟記憶 ({matureCards.length})</p>
              <p className="text-[10px] text-stone-400">間隔 ≥ 21 天</p>
            </div>
          </div>
        </div>
      </div>

      {/* Review Load Forecast */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
        <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <span>未來複習負載預測</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-amber-800">今日到期</span>
            <p className="text-xl font-black text-amber-900">{dueToday}</p>
            <span className="text-[10px] text-amber-600">立即複習</span>
          </div>

          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-blue-800">未來 1~3 天</span>
            <p className="text-xl font-black text-blue-900">{dueNext3Days}</p>
            <span className="text-[10px] text-blue-600">即將到期</span>
          </div>

          <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-indigo-800">未來 4~7 天</span>
            <p className="text-xl font-black text-indigo-900">{dueNext7Days}</p>
            <span className="text-[10px] text-indigo-600">下週排程</span>
          </div>

          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-stone-700">7 天以上</span>
            <p className="text-xl font-black text-stone-800">{dueLater}</p>
            <span className="text-[10px] text-stone-500">長期穩固</span>
          </div>
        </div>
      </div>
    </div>
  );
};

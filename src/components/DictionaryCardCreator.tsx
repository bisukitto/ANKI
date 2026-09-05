import React, { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  Volume2, 
  Plus, 
  Check, 
  Layers, 
  BookOpen, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  FileText,
  ListPlus,
  RefreshCw
} from 'lucide-react';
import { Card, Deck, DictionaryLookupResult } from '../types';
import { playAudio } from '../services/audio';

interface DictionaryCardCreatorProps {
  decks: Deck[];
  defaultDeckId?: string;
  onAddCard: (cardData: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onBatchAddCards?: (cards: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
  onNavigateToDecks: () => void;
}

const QUICK_SUGGESTIONS = [
  'ubiquitous',
  'resilience',
  'pragmatic',
  'conundrum',
  'meticulous',
  'vicarious',
  'nostalgia',
];

export const DictionaryCardCreator: React.FC<DictionaryCardCreatorProps> = ({
  decks,
  defaultDeckId,
  onAddCard,
  onBatchAddCards,
  onNavigateToDecks,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    defaultDeckId || (decks[0]?.id ?? '')
  );

  // Single Lookup State
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DictionaryLookupResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSavedToast, setIsSavedToast] = useState(false);

  // Editable fields in preview
  const [frontWord, setFrontWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [primaryMeaning, setPrimaryMeaning] = useState('');
  const [exampleSentence, setExampleSentence] = useState('');
  const [exampleTranslation, setExampleTranslation] = useState('');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');

  // Batch Mode State
  const [batchText, setBatchText] = useState('');
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchSuccessCount, setBatchSuccessCount] = useState<number | null>(null);

  const handleLookup = async (wordToQuery?: string) => {
    const query = (wordToQuery || searchTerm).trim();
    if (!query) return;

    setIsLoading(true);
    setErrorMsg('');
    setResult(null);
    setIsSavedToast(false);

    let data: DictionaryLookupResult | null = null;
    let fallbackNotice = '';

    try {
      // 1. Try server API first
      try {
        const res = await fetch('/api/dictionary/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });

        if (res.ok) {
          const response = await res.json();
          if (response.success && response.data) {
            data = response.data;
          }
        } else {
          console.warn(`Server lookup returned status ${res.status}`);
          if (res.status === 500) {
            fallbackNotice = '（伺服器回應 500，若使用 Vercel 請確認已設定 GEMINI_API_KEY，已自動啟動瀏覽器備援查詢）';
          }
        }
      } catch (serverErr) {
        console.warn('Server lookup fetch failed, switching to client fallback:', serverErr);
      }

      // 2. If server failed or returned 500, try client-side public dictionary directly
      if (!data) {
        try {
          const freeRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query.trim())}`);
          if (freeRes.ok) {
            const list = await freeRes.json();
            if (Array.isArray(list) && list.length > 0) {
              const entry = list[0];
              const phonetic = entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text || '';
              const audioUrl = entry.phonetics?.find((p: any) => p.audio && p.audio.length > 0)?.audio || '';

              const definitions: any[] = [];
              let mainPos = '';
              if (Array.isArray(entry.meanings)) {
                for (const m of entry.meanings) {
                  if (!mainPos) mainPos = m.partOfSpeech || '';
                  for (const d of m.definitions || []) {
                    definitions.push({
                      partOfSpeech: m.partOfSpeech || '',
                      definitionEn: d.definition || '',
                      definitionZh: '',
                      examples: d.example ? [{ sentence: d.example, translation: '' }] : [],
                    });
                  }
                }
              }

              data = {
                word: entry.word || query,
                phonetic,
                audioUrl,
                partOfSpeech: mainPos,
                primaryMeaning: definitions[0]?.definitionEn || query,
                definitions: definitions.slice(0, 4),
                synonyms: entry.meanings?.flatMap((m: any) => m.synonyms || []).slice(0, 6) || [],
                collocations: [],
                memoryTip: fallbackNotice || '已透過備援字典載入英英定義與發音。',
              };
            }
          }
        } catch (clientDictErr) {
          console.warn('Client-side dictionary lookup failed:', clientDictErr);
        }
      }

      // 3. Fallback to basic structure so user is never blocked
      if (!data) {
        data = {
          word: query.trim(),
          phonetic: '',
          partOfSpeech: '',
          primaryMeaning: '',
          definitions: [
            {
              partOfSpeech: '',
              definitionEn: '',
              definitionZh: '',
              examples: [],
            },
          ],
          synonyms: [],
          collocations: [],
          memoryTip: fallbackNotice || '已為您開啟卡片編輯，請直接填入中文釋義與例句。',
        };
      }

      setResult(data);

      // Pre-fill editable fields
      setFrontWord(data.word || query);
      setPhonetic(data.phonetic || '');
      setPartOfSpeech(data.partOfSpeech || '');
      setPrimaryMeaning(data.primaryMeaning || data.definitions?.[0]?.definitionZh || '');

      const firstEx = data.definitions?.[0]?.examples?.[0];
      setExampleSentence(firstEx?.sentence || '');
      setExampleTranslation(firstEx?.translation || '');
      setNotes(data.memoryTip || '');
      setTagInput('字典抓取');

      // Auto play audio if available
      playAudio(data.word || query, data.audioUrl);
    } catch (err: any) {
      console.error('Dictionary lookup error:', err);
      setErrorMsg(err.message || '查詢時發生問題，請檢查網路或稍後重試');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCard = () => {
    if (!frontWord.trim() || !primaryMeaning.trim() || !selectedDeckId) {
      alert('請填寫單字與中文解義，並確認選擇目的卡組');
      return;
    }

    const examples = [];
    if (exampleSentence.trim()) {
      examples.push({
        sentence: exampleSentence.trim(),
        translation: exampleTranslation.trim(),
      });
    }

    const tags = tagInput
      .split(/[,，\s]+/)
      .map(t => t.trim())
      .filter(Boolean);

    onAddCard({
      deckId: selectedDeckId,
      front: frontWord.trim(),
      back: primaryMeaning.trim(),
      phonetic: phonetic.trim(),
      partOfSpeech: partOfSpeech.trim(),
      primaryMeaning: primaryMeaning.trim(),
      examples,
      synonyms: result?.synonyms || [],
      collocations: result?.collocations || [],
      notes: notes.trim(),
      audioUrl: result?.audioUrl,
      tags,
      state: 'new',
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      due: Date.now(),
      lastReviewed: null,
      lapses: 0,
      syncStatus: 'pending',
    });

    setIsSavedToast(true);
    setTimeout(() => {
      setIsSavedToast(false);
    }, 3000);

    // Reset search input for next card
    setSearchTerm('');
  };

  const handleBatchProcess = async () => {
    const words = batchText
      .split(/[\n,，]+/)
      .map(w => w.trim())
      .filter(Boolean);

    if (words.length === 0) {
      alert('請先輸入至少一個單字或詞彙');
      return;
    }

    if (!selectedDeckId) {
      alert('請選擇存放的卡組');
      return;
    }

    setIsBatchLoading(true);
    setBatchProgress({ current: 0, total: words.length });
    setBatchSuccessCount(null);

    try {
      const res = await fetch('/api/dictionary/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
      });

      const response = await res.json();
      if (!response.success || !Array.isArray(response.cards)) {
        throw new Error('批次生成失敗');
      }

      const newCards = response.cards.map((c: any) => ({
        deckId: selectedDeckId,
        front: c.word,
        back: c.primaryMeaning || c.definitionZh,
        phonetic: c.phonetic || '',
        partOfSpeech: c.partOfSpeech || '',
        primaryMeaning: c.primaryMeaning || c.definitionZh,
        examples: c.exampleSentence ? [{ sentence: c.exampleSentence, translation: c.exampleTranslation || '' }] : [],
        notes: c.memoryTip || '',
        tags: ['批次匯入'],
        state: 'new' as const,
        repetitions: 0,
        interval: 0,
        easeFactor: 2.5,
        due: Date.now(),
        lastReviewed: null,
        lapses: 0,
        syncStatus: 'pending' as const,
      }));

      if (onBatchAddCards) {
        onBatchAddCards(newCards);
      } else {
        for (const c of newCards) {
          onAddCard(c);
        }
      }

      setBatchSuccessCount(newCards.length);
      setBatchText('');
    } catch (err: any) {
      alert(`批次匯入失敗: ${err.message}`);
    } finally {
      setIsBatchLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Page Title & Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            <span>字典自動抓取與建立卡片</span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            輸入任何單字或短語，AI 與權威字典自動抓取音標、詞性、英漢雙解、高頻例句並生成標準 Anki 記憶卡片。
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200/80">
          <button
            onClick={() => setActiveTab('single')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'single'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            單字精準解析
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'batch'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            批次快速建卡
          </button>
        </div>
      </div>

      {/* Target Deck Selector (Shared) */}
      <div className="bg-stone-50 border border-stone-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-stone-800">儲存目標卡組：</span>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <select
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-stone-300 bg-white text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          >
            {decks.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SINGLE LOOKUP TAB */}
      {activeTab === 'single' && (
        <div className="space-y-6">
          {/* Search Box */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="輸入英文單字、片語、日文或欲學習之詞彙（例如：serendipity, epiphanic, 侘び寂び）"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm font-medium rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !searchTerm.trim()}
                className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-stone-300 text-white font-semibold text-xs rounded-xl shadow-xs transition-all active:scale-95 shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>解析中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>查詢字典</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-stone-400 text-[11px]">熱門推薦：</span>
              {QUICK_SUGGESTIONS.map(word => (
                <button
                  key={word}
                  type="button"
                  onClick={() => {
                    setSearchTerm(word);
                    handleLookup(word);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 text-[11px] transition-colors"
                >
                  {word}
                </button>
              ))}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Result Card Preview & Customization */}
          {result && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                    卡片預覽與即時編輯
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">
                    可自由微調再建立
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => playAudio(frontWord, result.audioUrl)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>試聽發音</span>
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Front (Word) */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    正面 (單字 / 詞彙)
                  </label>
                  <input
                    type="text"
                    value={frontWord}
                    onChange={(e) => setFrontWord(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold text-stone-900 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Phonetic */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    國際音標 (IPA)
                  </label>
                  <input
                    type="text"
                    value={phonetic}
                    onChange={(e) => setPhonetic(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono text-stone-700 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Part of Speech */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    詞性 (Part of Speech)
                  </label>
                  <input
                    type="text"
                    value={partOfSpeech}
                    onChange={(e) => setPartOfSpeech(e.target.value)}
                    placeholder="如：n., v., adj., idiom"
                    className="w-full px-3 py-2 text-sm text-stone-800 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Primary Meaning */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    背面 (主要繁體中文解義)
                  </label>
                  <input
                    type="text"
                    value={primaryMeaning}
                    onChange={(e) => setPrimaryMeaning(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold text-amber-900 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 bg-amber-50/50"
                  />
                </div>
              </div>

              {/* Example Sentences */}
              <div className="space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200/80">
                <p className="text-xs font-bold text-stone-700">精選語境例句：</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={exampleSentence}
                    onChange={(e) => setExampleSentence(e.target.value)}
                    placeholder="英文例句"
                    className="w-full px-3 py-2 text-xs font-medium text-stone-900 rounded-lg border border-stone-300 bg-white"
                  />
                  <input
                    type="text"
                    value={exampleTranslation}
                    onChange={(e) => setExampleTranslation(e.target.value)}
                    placeholder="中文翻譯"
                    className="w-full px-3 py-2 text-xs text-stone-600 rounded-lg border border-stone-300 bg-white"
                  />
                </div>
              </div>

              {/* Synonyms & Collocations Pill Display */}
              {((result.synonyms && result.synonyms.length > 0) || (result.collocations && result.collocations.length > 0)) && (
                <div className="flex flex-wrap gap-3 text-xs">
                  {result.synonyms && result.synonyms.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-500 font-medium">近義詞：</span>
                      {result.synonyms.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-stone-100 rounded text-stone-700">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {result.collocations && result.collocations.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-500 font-medium">常見搭配：</span>
                      {result.collocations.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Memory Tip & Notes */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  記憶技巧 / 詞源備註
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-stone-700 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  標籤（逗號分隔）
                </label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="例如：GRE, TOEFL, 科技詞彙"
                  className="w-full px-3 py-1.5 text-xs text-stone-700 rounded-xl border border-stone-300"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                <span className="text-xs text-stone-500">
                  即刻保存在本機 IndexedDB，即使離線也能複習
                </span>

                <div className="flex items-center gap-3">
                  {isSavedToast && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 animate-in fade-in">
                      <Check className="w-4 h-4" />
                      已成功新增卡片！
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveCard}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>立即新增至卡組</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BATCH LOOKUP TAB */}
      {activeTab === 'batch' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-5">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <ListPlus className="w-5 h-5 text-indigo-600" />
              <span>批次單字抓取與快速建卡</span>
            </h3>
            <p className="text-xs text-stone-500">
              在下方文字框貼上一組單字（每行一個，或以逗號分隔），系統將自動為每個單字抓取釋義與例句並加入所選卡組。
            </p>
          </div>

          <div>
            <textarea
              rows={8}
              placeholder={`resilience\npragmatic\nepiphanic\nconundrum\nmeticulous`}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              className="w-full p-4 font-mono text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {batchSuccessCount !== null && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold">
                <Check className="w-4 h-4 text-emerald-600" />
                成功批次建立 {batchSuccessCount} 張單字卡！
              </span>
              <button
                onClick={onNavigateToDecks}
                className="underline font-bold hover:text-emerald-900"
              >
                前往開始學習 →
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-stone-500">建議每次 5-15 個單字以達最佳速度</span>
            <button
              onClick={handleBatchProcess}
              disabled={isBatchLoading || !batchText.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-stone-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
            >
              {isBatchLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>批次解析建立中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>一鍵批次建立卡片</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

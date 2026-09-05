import React, { useState, useEffect, useCallback } from 'react';
import { Card, Deck, ReviewLog, SRSRating } from './types';
import { db, subscribeToDB } from './services/db';
import { syncManager, SyncState } from './services/sync';
import { calculateNextSRS } from './services/srs';
import { Header } from './components/Header';
import { DeckList } from './components/DeckList';
import { StudySession } from './components/StudySession';
import { DictionaryCardCreator } from './components/DictionaryCardCreator';
import { CardManager } from './components/CardManager';
import { StatisticsModal } from './components/StatisticsModal';
import { SyncModal } from './components/SyncModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'decks' | 'study' | 'dictionary' | 'cards' | 'stats'>('decks');
  const [activeStudyDeckId, setActiveStudyDeckId] = useState<string | null>(null);
  const [filterCardDeckId, setFilterCardDeckId] = useState<string | undefined>(undefined);
  const [dictionaryTargetDeckId, setDictionaryTargetDeckId] = useState<string | undefined>(undefined);

  // Data state
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [reviewLogs, setReviewLogs] = useState<ReviewLog[]>([]);

  // Sync state
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncKey, setSyncKey] = useState<string>('');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // Load data from Local Database
  const reloadData = useCallback(async () => {
    const [loadedDecks, loadedCards, loadedLogs] = await Promise.all([
      db.getDecks(),
      db.getCards(),
      db.getReviewLogs(),
    ]);
    setDecks(loadedDecks);
    setCards(loadedCards);
    setReviewLogs(loadedLogs);
  }, []);

  useEffect(() => {
    reloadData();
    const unsubscribeDB = subscribeToDB(() => {
      reloadData();
    });

    const unsubscribeSync = syncManager.subscribe((state) => {
      setIsOnline(state.isOnline);
      setSyncState(state.syncState);
      setLastSyncTime(state.lastSyncTime);
      setPendingCount(state.pendingCount);
      setSyncKey(state.syncKey);
    });

    // Initial background sync check
    syncManager.checkAndSyncIfNeeded();

    return () => {
      unsubscribeDB();
      unsubscribeSync();
    };
  }, [reloadData]);

  // Handlers for Deck Operations
  const handleCreateDeck = async (name: string, description: string, color: string) => {
    const newDeck: Deck = {
      id: 'deck-' + Date.now(),
      name,
      description,
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'pending',
    };
    await db.saveDeck(newDeck);
    showToast(`成功建立卡組「${name}」`);
    syncManager.checkAndSyncIfNeeded();
  };

  const handleDeleteDeck = async (deckId: string) => {
    await db.deleteDeck(deckId);
    showToast('已刪除該卡組');
    syncManager.checkAndSyncIfNeeded();
  };

  const handleEditDeck = async (deck: Deck) => {
    await db.saveDeck(deck);
    showToast(`已儲存卡組「${deck.name}」`);
    syncManager.checkAndSyncIfNeeded();
  };

  // Handlers for Card Operations
  const handleAddCard = async (cardData: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const newCard: Card = {
      ...cardData,
      id: 'card-' + now + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };
    await db.saveCard(newCard);
    showToast(`已新增「${newCard.front}」至卡組`);
    syncManager.checkAndSyncIfNeeded();
  };

  const handleBatchAddCards = async (newCardsData: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    const now = Date.now();
    const newCards: Card[] = newCardsData.map((c, idx) => ({
      ...c,
      id: 'card-' + (now + idx) + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    }));
    await db.addCards(newCards);
    showToast(`批次新增了 ${newCards.length} 張卡片！`);
    syncManager.checkAndSyncIfNeeded();
  };

  const handleUpdateCard = async (card: Card) => {
    await db.saveCard(card);
    showToast(`已更新「${card.front}」`);
    syncManager.checkAndSyncIfNeeded();
  };

  const handleDeleteCard = async (cardId: string) => {
    await db.deleteCard(cardId);
    showToast('已刪除卡片');
    syncManager.checkAndSyncIfNeeded();
  };

  // SRS Review Completion
  const handleCompleteCardReview = async (card: Card, rating: SRSRating) => {
    const nextSRS = calculateNextSRS(card, rating);
    const now = Date.now();

    const updatedCard: Card = {
      ...card,
      repetitions: nextSRS.repetitions,
      interval: nextSRS.interval,
      easeFactor: nextSRS.easeFactor,
      due: nextSRS.due,
      state: nextSRS.state,
      lapses: nextSRS.lapses,
      lastReviewed: now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    const reviewLog: ReviewLog = {
      id: 'log-' + now,
      cardId: card.id,
      deckId: card.deckId,
      rating,
      reviewedAt: now,
      intervalBefore: card.interval,
      intervalAfter: nextSRS.interval,
      easeFactorBefore: card.easeFactor || 2.5,
      easeFactorAfter: nextSRS.easeFactor,
    };

    await Promise.all([
      db.saveCard(updatedCard),
      db.logReview(reviewLog),
    ]);

    // Schedule background sync
    syncManager.checkAndSyncIfNeeded();
  };

  // Sync Trigger
  const handleManualSync = async () => {
    const res = await syncManager.performSync(true);
    showToast(res.message);
  };

  const handleUpdateSyncKey = (newKey: string) => {
    db.setSyncKey(newKey);
    showToast(`同步金鑰已更新為：${newKey}`);
  };

  // Active study deck
  const currentStudyDeck = decks.find(d => d.id === activeStudyDeckId);

  return (
    <div className="min-h-screen bg-stone-100/50 text-stone-900 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Global Navigation Header */}
      <Header
        currentTab={currentTab === 'study' ? 'decks' : currentTab}
        onSelectTab={(tab) => {
          if (currentTab === 'study') {
            setActiveStudyDeckId(null);
          }
          setCurrentTab(tab);
        }}
        isOnline={isOnline}
        syncState={syncState}
        pendingCount={pendingCount}
        lastSyncTime={lastSyncTime}
        onTriggerSync={handleManualSync}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 pt-6">
        {/* VIEW 1: STUDY SESSION */}
        {currentTab === 'study' && currentStudyDeck && (
          <StudySession
            deck={currentStudyDeck}
            cards={cards.filter(c => c.deckId === currentStudyDeck.id)}
            onCompleteCard={handleCompleteCardReview}
            onExitStudy={() => {
              setActiveStudyDeckId(null);
              setCurrentTab('decks');
            }}
          />
        )}

        {/* VIEW 2: DECKS LIST */}
        {currentTab === 'decks' && (
          <DeckList
            decks={decks}
            cards={cards}
            onStartStudy={(deckId) => {
              setActiveStudyDeckId(deckId);
              setCurrentTab('study');
            }}
            onCreateDeck={handleCreateDeck}
            onDeleteDeck={handleDeleteDeck}
            onEditDeck={handleEditDeck}
            onNavigateToDictionary={(deckId) => {
              setDictionaryTargetDeckId(deckId);
              setCurrentTab('dictionary');
            }}
            onNavigateToCards={(deckId) => {
              setFilterCardDeckId(deckId);
              setCurrentTab('cards');
            }}
          />
        )}

        {/* VIEW 3: DICTIONARY LOOKUP & CARD CREATOR */}
        {currentTab === 'dictionary' && (
          <DictionaryCardCreator
            decks={decks}
            defaultDeckId={dictionaryTargetDeckId}
            onAddCard={handleAddCard}
            onBatchAddCards={handleBatchAddCards}
            onNavigateToDecks={() => setCurrentTab('decks')}
          />
        )}

        {/* VIEW 4: CARDS MANAGER */}
        {currentTab === 'cards' && (
          <CardManager
            decks={decks}
            cards={cards}
            selectedDeckId={filterCardDeckId}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onNavigateToDictionary={() => setCurrentTab('dictionary')}
          />
        )}

        {/* VIEW 5: STATISTICS */}
        {currentTab === 'stats' && (
          <StatisticsModal
            decks={decks}
            cards={cards}
            reviewLogs={reviewLogs}
          />
        )}
      </main>

      {/* Cloud Sync & Backup Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        isOnline={isOnline}
        syncState={syncState}
        pendingCount={pendingCount}
        lastSyncTime={lastSyncTime}
        syncKey={syncKey}
        onUpdateSyncKey={handleUpdateSyncKey}
        onTriggerSync={handleManualSync}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-stone-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

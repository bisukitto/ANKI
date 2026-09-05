import { Card, Deck, SyncPayload } from '../types';
import { db } from './db';

export type SyncState = 'synced' | 'syncing' | 'offline' | 'pending' | 'error';

type SyncListener = (state: {
  isOnline: boolean;
  syncState: SyncState;
  lastSyncTime: number | null;
  pendingCount: number;
  syncKey: string;
  errorMessage?: string;
}) => void;

class SyncManager {
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private currentSyncState: SyncState = 'synced';
  private errorMessage = '';
  private syncListeners = new Set<SyncListener>();
  private autoSyncTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notify();
        // Auto sync when coming back online
        this.performSync(false);
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.currentSyncState = 'offline';
        this.notify();
      });

      // Periodic check every 45s if online
      setInterval(() => {
        if (this.isOnline) {
          this.checkAndSyncIfNeeded();
        }
      }, 45000);
    }
  }

  subscribe(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    this.notifySingle(listener);
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  private async notify() {
    const pendingCount = await db.getPendingCount();
    const lastSyncTime = db.getLastSyncTime();
    const syncKey = db.getSyncKey();

    const state = {
      isOnline: this.isOnline,
      syncState: !this.isOnline ? 'offline' : this.currentSyncState,
      lastSyncTime,
      pendingCount,
      syncKey,
      errorMessage: this.errorMessage,
    };

    for (const listener of this.syncListeners) {
      listener(state);
    }
  }

  private async notifySingle(listener: SyncListener) {
    const pendingCount = await db.getPendingCount();
    const lastSyncTime = db.getLastSyncTime();
    const syncKey = db.getSyncKey();

    listener({
      isOnline: this.isOnline,
      syncState: !this.isOnline ? 'offline' : this.currentSyncState,
      lastSyncTime,
      pendingCount,
      syncKey,
      errorMessage: this.errorMessage,
    });
  }

  async checkAndSyncIfNeeded() {
    const pending = await db.getPendingCount();
    if (pending > 0 && this.isOnline) {
      await this.performSync(false);
    }
  }

  async performSync(force: boolean = false): Promise<{ success: boolean; message: string }> {
    if (!this.isOnline) {
      this.currentSyncState = 'offline';
      this.notify();
      return { success: false, message: '目前處於離線狀態，變更已完整儲存於本機，連線後將自動同步。' };
    }

    this.currentSyncState = 'syncing';
    this.errorMessage = '';
    this.notify();

    try {
      const syncKey = db.getSyncKey();
      const [allDecks, allCards] = await Promise.all([
        db.getAllDecksRaw(),
        db.getAllCardsRaw(),
      ]);

      const lastSyncTime = db.getLastSyncTime() || 0;

      const payload: SyncPayload = {
        syncKey,
        clientDecks: allDecks,
        clientCards: allCards,
        clientLastSyncTime: lastSyncTime,
      };

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`伺服器回應錯誤: ${res.statusText}`);
      }

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || '同步失敗');
      }

      // Mark all merged decks and cards as synced
      const mergedDecks: Deck[] = (result.decks || []).map((d: Deck) => ({
        ...d,
        syncStatus: 'synced',
      }));

      const mergedCards: Card[] = (result.cards || []).map((c: Card) => ({
        ...c,
        syncStatus: 'synced',
      }));

      await db.saveDecks(mergedDecks);
      await db.saveCards(mergedCards);
      db.setLastSyncTime(result.serverTime || Date.now());

      this.currentSyncState = 'synced';
      this.errorMessage = '';
      this.notify();
      return { success: true, message: '雲端同步完成！所有卡組與進度已更新。' };
    } catch (err: any) {
      console.error('Sync failed:', err);
      this.currentSyncState = 'error';
      this.errorMessage = err?.message || '同步過程發生錯誤';
      this.notify();
      return { success: false, message: `同步失敗: ${this.errorMessage}（資料仍安全儲存於本機）` };
    }
  }

  // Backup Export
  async exportBackup(): Promise<string> {
    const [decks, cards, logs] = await Promise.all([
      db.getDecks(),
      db.getCards(),
      db.getReviewLogs(),
    ]);

    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      syncKey: db.getSyncKey(),
      decks,
      cards,
      logs,
    };

    return JSON.stringify(backupData, null, 2);
  }

  // Backup Import
  async importBackup(jsonString: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data.decks) || !Array.isArray(data.cards)) {
        return { success: false, count: 0, error: '檔案格式不符，缺少 decks 或 cards 欄位' };
      }

      const now = Date.now();
      const existingDecks = await db.getAllDecksRaw();
      const existingCards = await db.getAllCardsRaw();

      const deckMap = new Map(existingDecks.map(d => [d.id, d]));
      const cardMap = new Map(existingCards.map(c => [c.id, c]));

      for (const d of data.decks) {
        deckMap.set(d.id, {
          ...d,
          updatedAt: now,
          syncStatus: 'pending',
        });
      }

      for (const c of data.cards) {
        cardMap.set(c.id, {
          ...c,
          updatedAt: now,
          syncStatus: 'pending',
        });
      }

      await db.saveDecks(Array.from(deckMap.values()));
      await db.saveCards(Array.from(cardMap.values()));

      // Trigger sync if online
      if (this.isOnline) {
        this.performSync(false);
      }

      return { success: true, count: data.cards.length };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message || 'JSON 解析失敗' };
    }
  }
}

export const syncManager = new SyncManager();

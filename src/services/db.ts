import { Card, Deck, ReviewLog } from '../types';
import { INITIAL_CARDS, INITIAL_DECKS } from '../data/sampleDecks';

const DB_NAME = 'ankisync_db';
const DB_VERSION = 1;
const STORAGE_KEYS = {
  DECKS: 'ankisync_decks_v1',
  CARDS: 'ankisync_cards_v1',
  LOGS: 'ankisync_logs_v1',
  SYNC_KEY: 'ankisync_user_sync_key',
  LAST_SYNC: 'ankisync_last_sync_timestamp',
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.error('Listener error:', e);
    }
  }
}

export function subscribeToDB(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase | null>;
  private isIndexedDBAvailable = false;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private async initDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      this.isIndexedDBAvailable = false;
      return null;
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
          const db: IDBDatabase = event.target.result;
          if (!db.objectStoreNames.contains('decks')) {
            db.createObjectStore('decks', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('cards')) {
            const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
            cardStore.createIndex('deckId', 'deckId', { unique: false });
            cardStore.createIndex('due', 'due', { unique: false });
          }
          if (!db.objectStoreNames.contains('logs')) {
            db.createObjectStore('logs', { keyPath: 'id' });
          }
        };

        request.onsuccess = () => {
          this.isIndexedDBAvailable = true;
          resolve(request.result);
        };

        request.onerror = (e) => {
          console.warn('IndexedDB open error, using localStorage fallback:', e);
          this.isIndexedDBAvailable = false;
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB unavailable, falling back to localStorage:', err);
        this.isIndexedDBAvailable = false;
        resolve(null);
      }
    });
  }

  // --- LocalStorage Fallback Helpers ---
  private getLocal<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  private setLocal<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  }

  // --- Core CRUD ---
  async getDecks(): Promise<Deck[]> {
    const db = await this.dbPromise;
    if (db && this.isIndexedDBAvailable) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('decks', 'readonly');
          const store = tx.objectStore('decks');
          const req = store.getAll();
          req.onsuccess = () => {
            let decks: Deck[] = req.result || [];
            if (decks.length === 0) {
              // Seed initial decks if empty
              decks = INITIAL_DECKS;
              this.saveDecks(decks);
            }
            resolve(decks.filter(d => !d.deleted));
          };
          req.onerror = () => resolve(this.getLocal(STORAGE_KEYS.DECKS, INITIAL_DECKS).filter(d => !d.deleted));
        } catch {
          resolve(this.getLocal(STORAGE_KEYS.DECKS, INITIAL_DECKS).filter(d => !d.deleted));
        }
      });
    }
    const decks = this.getLocal<Deck[]>(STORAGE_KEYS.DECKS, INITIAL_DECKS);
    if (!localStorage.getItem(STORAGE_KEYS.DECKS)) {
      this.setLocal(STORAGE_KEYS.DECKS, INITIAL_DECKS);
    }
    return decks.filter(d => !d.deleted);
  }

  async getAllDecksRaw(): Promise<Deck[]> {
    const db = await this.dbPromise;
    if (db && this.isIndexedDBAvailable) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('decks', 'readonly');
          const store = tx.objectStore('decks');
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve(this.getLocal(STORAGE_KEYS.DECKS, INITIAL_DECKS));
        } catch {
          resolve(this.getLocal(STORAGE_KEYS.DECKS, INITIAL_DECKS));
        }
      });
    }
    return this.getLocal(STORAGE_KEYS.DECKS, INITIAL_DECKS);
  }

  async saveDecks(decks: Deck[]): Promise<void> {
    this.setLocal(STORAGE_KEYS.DECKS, decks);
    const db = await this.dbPromise;
    if (db && this.isIndexedDBAvailable) {
      const tx = db.transaction('decks', 'readwrite');
      const store = tx.objectStore('decks');
      for (const d of decks) {
        store.put(d);
      }
    }
    notifyListeners();
  }

  async saveDeck(deck: Deck): Promise<void> {
    const decks = await this.getAllDecksRaw();
    const idx = decks.findIndex(d => d.id === deck.id);
    const updated = {
      ...deck,
      updatedAt: Date.now(),
      syncStatus: 'pending' as const,
    };
    if (idx >= 0) {
      decks[idx] = updated;
    } else {
      decks.push(updated);
    }
    await this.saveDecks(decks);
  }

  async deleteDeck(deckId: string): Promise<void> {
    const decks = await this.getAllDecksRaw();
    const target = decks.find(d => d.id === deckId);
    if (target) {
      target.deleted = true;
      target.updatedAt = Date.now();
      target.syncStatus = 'pending';
      await this.saveDecks(decks);
    }
    // Mark cards in this deck as deleted as well
    const cards = await this.getAllCardsRaw();
    let modified = false;
    for (const card of cards) {
      if (card.deckId === deckId && !card.deleted) {
        card.deleted = true;
        card.updatedAt = Date.now();
        card.syncStatus = 'pending';
        modified = true;
      }
    }
    if (modified) {
      await this.saveCards(cards);
    }
  }

  async getCards(): Promise<Card[]> {
    const db = await this.dbPromise;
    if (db && this.isIndexedDBAvailable) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('cards', 'readonly');
          const store = tx.objectStore('cards');
          const req = store.getAll();
          req.onsuccess = () => {
            let cards: Card[] = req.result || [];
            if (cards.length === 0) {
              cards = INITIAL_CARDS;
              this.saveCards(cards);
            }
            resolve(cards.filter(c => !c.deleted));
          };
          req.onerror = () => resolve(this.getLocal(STORAGE_KEYS.CARDS, INITIAL_CARDS).filter(c => !c.deleted));
        } catch {
          resolve(this.getLocal(STORAGE_KEYS.CARDS, INITIAL_CARDS).filter(c => !c.deleted));
        }
      });
    }
    const cards = this.getLocal<Card[]>(STORAGE_KEYS.CARDS, INITIAL_CARDS);
    if (!localStorage.getItem(STORAGE_KEYS.CARDS)) {
      this.setLocal(STORAGE_KEYS.CARDS, INITIAL_CARDS);
    }
    return cards.filter(c => !c.deleted);
  }

  async getAllCardsRaw(): Promise<Card[]> {
    const db = await this.dbPromise;
    if (db && this.isIndexedDBAvailable) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('cards', 'readonly');
          const store = tx.objectStore('cards');
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve(this.getLocal(STORAGE_KEYS.CARDS, INITIAL_CARDS));
        } catch {
          resolve(this.getLocal(STORAGE_KEYS.CARDS, INITIAL_CARDS));
        }
      });
    }
    return this.getLocal(STORAGE_KEYS.CARDS, INITIAL_CARDS);
  }

  async saveCards(cards: Card[]): Promise<void> {
    this.setLocal(STORAGE_KEYS.CARDS, cards);
    const db = await this.dbPromise;
    if (db && this.isIndexedDBAvailable) {
      const tx = db.transaction('cards', 'readwrite');
      const store = tx.objectStore('cards');
      for (const c of cards) {
        store.put(c);
      }
    }
    notifyListeners();
  }

  async saveCard(card: Card): Promise<void> {
    const cards = await this.getAllCardsRaw();
    const idx = cards.findIndex(c => c.id === card.id);
    const updated = {
      ...card,
      updatedAt: Date.now(),
      syncStatus: 'pending' as const,
    };
    if (idx >= 0) {
      cards[idx] = updated;
    } else {
      cards.push(updated);
    }
    await this.saveCards(cards);
  }

  async addCards(newCards: Card[]): Promise<void> {
    const cards = await this.getAllCardsRaw();
    const now = Date.now();
    for (const c of newCards) {
      const prepared: Card = {
        ...c,
        updatedAt: now,
        syncStatus: 'pending',
      };
      cards.push(prepared);
    }
    await this.saveCards(cards);
  }

  async deleteCard(cardId: string): Promise<void> {
    const cards = await this.getAllCardsRaw();
    const target = cards.find(c => c.id === cardId);
    if (target) {
      target.deleted = true;
      target.updatedAt = Date.now();
      target.syncStatus = 'pending';
      await this.saveCards(cards);
    }
  }

  async logReview(log: ReviewLog): Promise<void> {
    const logs = this.getLocal<ReviewLog[]>(STORAGE_KEYS.LOGS, []);
    logs.push(log);
    this.setLocal(STORAGE_KEYS.LOGS, logs.slice(-500)); // keep last 500
    const db = await this.dbPromise;
    if (db && this.isIndexedDBAvailable) {
      try {
        const tx = db.transaction('logs', 'readwrite');
        tx.objectStore('logs').put(log);
      } catch (e) {
        console.warn('Error saving log to IDB:', e);
      }
    }
  }

  async getReviewLogs(): Promise<ReviewLog[]> {
    return this.getLocal<ReviewLog[]>(STORAGE_KEYS.LOGS, []);
  }

  // --- Sync Key Management ---
  getSyncKey(): string {
    let key = localStorage.getItem(STORAGE_KEYS.SYNC_KEY);
    if (!key) {
      key = 'anki-' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(STORAGE_KEYS.SYNC_KEY, key);
    }
    return key;
  }

  setSyncKey(key: string): void {
    localStorage.setItem(STORAGE_KEYS.SYNC_KEY, key.trim());
    notifyListeners();
  }

  getLastSyncTime(): number | null {
    const t = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return t ? parseInt(t, 10) : null;
  }

  setLastSyncTime(timestamp: number): void {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp.toString());
    notifyListeners();
  }

  async getPendingCount(): Promise<number> {
    const [decks, cards] = await Promise.all([this.getAllDecksRaw(), this.getAllCardsRaw()]);
    const pendingDecks = decks.filter(d => d.syncStatus === 'pending').length;
    const pendingCards = cards.filter(c => c.syncStatus === 'pending').length;
    return pendingDecks + pendingCards;
  }
}

export const db = new LocalDatabase();

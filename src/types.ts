export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export type SRSRating = 1 | 2 | 3 | 4; // 1: Again (忘記), 2: Hard (困難), 3: Good (良好), 4: Easy (容易)

export interface ExampleSentence {
  sentence: string;
  translation: string;
  audioUrl?: string;
}

export interface Card {
  id: string;
  deckId: string;
  front: string; // The word, term, or question
  back: string; // Meaning or answer
  phonetic?: string; // IPA phonetic symbols
  partOfSpeech?: string; // n., v., adj., phrase
  primaryMeaning?: string; // Concise translation
  examples?: ExampleSentence[];
  synonyms?: string[];
  collocations?: string[];
  notes?: string; // Etymology, memory tip, or custom notes
  audioUrl?: string;
  tags?: string[];
  
  // SRS (SM-2) scheduling metadata
  state: CardState;
  repetitions: number; // Consecutive successful recalls
  interval: number; // Interval in days (0 = today)
  easeFactor: number; // Starting ease factor: 2.5
  due: number; // Due timestamp in ms
  lastReviewed: number | null;
  lapses: number; // Count of forgotten reviews
  
  // Sync metadata
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  syncStatus?: 'synced' | 'pending';
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  syncStatus?: 'synced' | 'pending';
}

export interface ReviewLog {
  id: string;
  cardId: string;
  deckId: string;
  rating: SRSRating;
  reviewedAt: number;
  intervalBefore: number;
  intervalAfter: number;
  easeFactorBefore: number;
  easeFactorAfter: number;
}

export interface DictionaryDefinition {
  partOfSpeech: string;
  definitionEn?: string;
  definitionZh: string;
  examples?: ExampleSentence[];
}

export interface DictionaryLookupResult {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  primaryMeaning: string;
  definitions: DictionaryDefinition[];
  synonyms?: string[];
  collocations?: string[];
  memoryTip?: string;
  audioUrl?: string;
}

export interface SyncPayload {
  syncKey: string;
  clientDecks: Deck[];
  clientCards: Card[];
  clientLastSyncTime: number;
}

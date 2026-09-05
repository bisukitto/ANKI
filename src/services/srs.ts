import { Card, SRSRating } from '../types';

const MIN_EASE_FACTOR = 1.3;
const ONE_MINUTE = 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

export interface SRSNextState {
  repetitions: number;
  interval: number; // in days
  easeFactor: number;
  due: number; // timestamp
  state: Card['state'];
  lapses: number;
}

/**
 * Calculates the next SRS state based on Anki SM-2 algorithm.
 */
export function calculateNextSRS(card: Card, rating: SRSRating): SRSNextState {
  const now = Date.now();
  let repetitions = card.repetitions;
  let interval = card.interval;
  let easeFactor = card.easeFactor || 2.5;
  let lapses = card.lapses || 0;
  let state = card.state;
  let due = now;

  switch (rating) {
    case 1: {
      // Again (忘記)
      repetitions = 0;
      interval = 0;
      lapses += 1;
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.20);
      state = lapses > 1 ? 'relearning' : 'learning';
      // Re-review in 10 minutes
      due = now + 10 * ONE_MINUTE;
      break;
    }
    case 2: {
      // Hard (困難)
      if (card.state === 'new' || card.state === 'learning') {
        repetitions = 1;
        interval = 1;
        due = now + 1 * ONE_DAY;
      } else {
        repetitions += 1;
        interval = Math.max(1, Math.round((interval || 1) * 1.2));
        due = now + interval * ONE_DAY;
      }
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
      state = 'review';
      break;
    }
    case 3: {
      // Good (良好)
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.max(1, Math.round(interval * easeFactor));
      }
      repetitions += 1;
      state = 'review';
      due = now + interval * ONE_DAY;
      break;
    }
    case 4: {
      // Easy (容易)
      if (repetitions === 0) {
        interval = 4;
      } else {
        interval = Math.max(1, Math.round((interval || 1) * easeFactor * 1.3));
      }
      repetitions += 1;
      easeFactor += 0.15;
      state = 'review';
      due = now + interval * ONE_DAY;
      break;
    }
  }

  return {
    repetitions,
    interval,
    easeFactor,
    due,
    state,
    lapses,
  };
}

/**
 * Returns human-readable duration preview for button labels
 */
export function getNextIntervalPreview(card: Card, rating: SRSRating): string {
  const next = calculateNextSRS(card, rating);
  if (rating === 1) {
    return '< 10 分';
  }
  if (next.interval < 1) {
    return '< 1 天';
  }
  if (next.interval === 1) {
    return '1 天';
  }
  if (next.interval < 30) {
    return `${next.interval} 天`;
  }
  const months = Math.round((next.interval / 30) * 10) / 10;
  return `${months} 個月`;
}

/**
 * Checks if a card is currently due for review
 */
export function isCardDue(card: Card): boolean {
  if (card.deleted) return false;
  if (card.state === 'new') return true;
  return card.due <= Date.now();
}

/**
 * Categorizes cards into New, Due Review, and Total
 */
export function categorizeDeckCards(cards: Card[]) {
  const activeCards = cards.filter(c => !c.deleted);
  const now = Date.now();

  const newCards = activeCards.filter(c => c.state === 'new');
  const dueReviewCards = activeCards.filter(c => c.state !== 'new' && c.due <= now);
  const learningCards = activeCards.filter(c => c.state === 'learning' || c.state === 'relearning');

  return {
    total: activeCards.length,
    newCount: newCards.length,
    dueCount: dueReviewCards.length,
    learningCount: learningCards.length,
    dueTotal: newCards.length + dueReviewCards.length,
  };
}

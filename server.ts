import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

// Lazy initialize Gemini API client with User-Agent header
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Storage for Cloud Sync
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', '.data')
  : path.join(process.cwd(), '.data');
const SYNC_FILE = path.join(DATA_DIR, 'cloud-sync-store.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

interface SyncStoreData {
  [syncKey: string]: {
    decks: any[];
    cards: any[];
    lastSyncTime: number;
    updatedAt: number;
  };
}

function loadSyncStore(): SyncStoreData {
  try {
    ensureDataDir();
    if (fs.existsSync(SYNC_FILE)) {
      const raw = fs.readFileSync(SYNC_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading sync store:', err);
  }
  return {};
}

function saveSyncStore(store: SyncStoreData) {
  try {
    ensureDataDir();
    fs.writeFileSync(SYNC_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving sync store:', err);
  }
}

// Helper: fallback lookup using free dictionary api
async function fetchFromFreeDictionary(word: string) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const entry = data[0];
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

    return {
      word: entry.word || word,
      phonetic,
      audioUrl,
      partOfSpeech: mainPos,
      primaryMeaning: '',
      definitions: definitions.slice(0, 4),
      synonyms: entry.meanings?.flatMap((m: any) => m.synonyms || []).slice(0, 6) || [],
      collocations: [],
      memoryTip: '',
    };
  } catch (err) {
    console.error('Free dictionary lookup failed:', err);
    return null;
  }
}

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
  });
});

// API: Dictionary lookup with Gemini + fallback
app.post('/api/dictionary/lookup', async (req, res) => {
  const { query, sourceLang, targetLang } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  const trimmedQuery = query.trim();
  const ai = getGeminiClient();

  if (ai) {
    try {
      const prompt = `You are an expert bilingual lexicographer and flashcard educator. 
Analyze the word, idiom, or phrase: "${trimmedQuery}".
Provide accurate linguistic data for language learning cards.
Target translation language: Traditional Chinese (繁體中文) with natural, idiomatic nuance.
Include:
1. Exact word or lemma.
2. Standard IPA phonetic transcription (or romaji/kana for Japanese).
3. Primary part of speech (e.g., n., v., adj., adv., phrase).
4. Concise Traditional Chinese translation of primary meaning.
5. 1 to 3 distinct meanings / senses, each with:
   - Part of speech
   - Concise English explanation
   - Traditional Chinese translation
   - 1 to 2 high-quality, practical bilingual example sentences (sentence in source language, translation in Traditional Chinese)
6. Up to 5 relevant synonyms or related expressions.
7. Up to 3 high-frequency common collocations.
8. A memorable mnemonic / etymology / memory tip (記憶技巧/詞源) in Traditional Chinese to help the learner remember.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              phonetic: { type: Type.STRING },
              partOfSpeech: { type: Type.STRING },
              primaryMeaning: { type: Type.STRING },
              definitions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    partOfSpeech: { type: Type.STRING },
                    definitionEn: { type: Type.STRING },
                    definitionZh: { type: Type.STRING },
                    examples: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          sentence: { type: Type.STRING },
                          translation: { type: Type.STRING },
                        },
                        required: ['sentence', 'translation'],
                      },
                    },
                  },
                  required: ['partOfSpeech', 'definitionZh'],
                },
              },
              synonyms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              collocations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              memoryTip: { type: Type.STRING },
            },
            required: ['word', 'phonetic', 'partOfSpeech', 'primaryMeaning', 'definitions'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');

      // Attempt to check if free dictionary has native pronunciation audio
      const freeDict = await fetchFromFreeDictionary(trimmedQuery);
      if (freeDict?.audioUrl) {
        parsed.audioUrl = freeDict.audioUrl;
      }

      return res.json({
        success: true,
        source: 'gemini-ai',
        data: parsed,
      });
    } catch (geminiErr: any) {
      console.warn('Gemini dictionary lookup error, falling back:', geminiErr?.message);
    }
  }

  // Fallback to Free Dictionary API if Gemini is not configured or failed
  const freeData = await fetchFromFreeDictionary(trimmedQuery);
  if (freeData) {
    return res.json({
      success: true,
      source: 'free-dictionary-api',
      data: {
        ...freeData,
        primaryMeaning: freeData.definitions[0]?.definitionEn || trimmedQuery,
        memoryTip: '提示：可於設定中配置 GEMINI_API_KEY 獲得完整繁體中文解析與記憶口訣。',
      },
    });
  }

  // Minimal fallback if dictionary lookup returns nothing
  return res.json({
    success: true,
    source: 'basic-fallback',
    data: {
      word: trimmedQuery,
      phonetic: '',
      partOfSpeech: 'word',
      primaryMeaning: trimmedQuery,
      definitions: [
        {
          partOfSpeech: 'word',
          definitionEn: 'Custom entry',
          definitionZh: trimmedQuery,
          examples: [],
        },
      ],
      synonyms: [],
      collocations: [],
      memoryTip: '',
    },
  });
});

// API: Batch Dictionary Lookup
app.post('/api/dictionary/batch', async (req, res) => {
  const { words } = req.body;
  if (!Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: 'Words array is required' });
  }

  const cleanWords = words.map(w => String(w).trim()).filter(Boolean).slice(0, 10);
  const ai = getGeminiClient();

  if (ai) {
    try {
      const prompt = `Batch generate bilingual dictionary flashcards for the following words: ${JSON.stringify(cleanWords)}.
For each word, return:
- word
- phonetic (IPA)
- partOfSpeech
- primaryMeaning (Traditional Chinese)
- definitionEn
- definitionZh
- exampleSentence
- exampleTranslation
- memoryTip`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                phonetic: { type: Type.STRING },
                partOfSpeech: { type: Type.STRING },
                primaryMeaning: { type: Type.STRING },
                definitionEn: { type: Type.STRING },
                definitionZh: { type: Type.STRING },
                exampleSentence: { type: Type.STRING },
                exampleTranslation: { type: Type.STRING },
                memoryTip: { type: Type.STRING },
              },
              required: ['word', 'phonetic', 'primaryMeaning', 'definitionZh'],
            },
          },
        },
      });

      const cards = JSON.parse(response.text?.trim() || '[]');
      return res.json({ success: true, cards });
    } catch (err: any) {
      console.warn('Batch lookup error with Gemini:', err?.message);
    }
  }

  // Fallback for batch
  const results = cleanWords.map(w => ({
    word: w,
    phonetic: '',
    partOfSpeech: 'word',
    primaryMeaning: w,
    definitionEn: '',
    definitionZh: w,
    exampleSentence: '',
    exampleTranslation: '',
    memoryTip: '',
  }));
  return res.json({ success: true, cards: results });
});

// API: Cloud Sync - Pull / Push / Merge
app.post('/api/sync', (req, res) => {
  const { syncKey, clientDecks, clientCards, clientLastSyncTime } = req.body;
  const key = (syncKey && typeof syncKey === 'string' && syncKey.trim()) || 'default-user';

  const store = loadSyncStore();
  const serverUser = store[key] || {
    decks: [],
    cards: [],
    lastSyncTime: 0,
    updatedAt: 0,
  };

  const serverDecksMap = new Map<string, any>(serverUser.decks.map(d => [d.id, d]));
  const serverCardsMap = new Map<string, any>(serverUser.cards.map(c => [c.id, c]));

  // Merge client decks using Last-Write-Wins
  if (Array.isArray(clientDecks)) {
    for (const cDeck of clientDecks) {
      if (!cDeck.id) continue;
      const sDeck = serverDecksMap.get(cDeck.id);
      if (!sDeck || (cDeck.updatedAt || 0) >= (sDeck.updatedAt || 0)) {
        serverDecksMap.set(cDeck.id, cDeck);
      }
    }
  }

  // Merge client cards using Last-Write-Wins
  if (Array.isArray(clientCards)) {
    for (const cCard of clientCards) {
      if (!cCard.id) continue;
      const sCard = serverCardsMap.get(cCard.id);
      if (!sCard || (cCard.updatedAt || 0) >= (sCard.updatedAt || 0)) {
        serverCardsMap.set(cCard.id, cCard);
      }
    }
  }

  const mergedDecks = Array.from(serverDecksMap.values());
  const mergedCards = Array.from(serverCardsMap.values());
  const now = Date.now();

  store[key] = {
    decks: mergedDecks,
    cards: mergedCards,
    lastSyncTime: now,
    updatedAt: now,
  };

  saveSyncStore(store);

  return res.json({
    success: true,
    serverTime: now,
    syncKey: key,
    decks: mergedDecks,
    cards: mergedCards,
  });
});

// API: Cloud Sync status check
app.get('/api/sync/status', (req, res) => {
  const syncKey = (req.query.syncKey as string) || 'default-user';
  const store = loadSyncStore();
  const serverUser = store[syncKey];
  if (!serverUser) {
    return res.json({
      exists: false,
      deckCount: 0,
      cardCount: 0,
      lastSyncTime: null,
    });
  }
  return res.json({
    exists: true,
    deckCount: serverUser.decks.filter(d => !d.deleted).length,
    cardCount: serverUser.cards.filter(c => !c.deleted).length,
    lastSyncTime: serverUser.lastSyncTime,
  });
});

// Vite middleware / production serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AnkiSync server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;

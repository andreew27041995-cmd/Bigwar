import {
  GameSaveData,
  HeroState,
  EquippedGear,
  GameItem,
  MarketLot,
  TradeProtocolEntry,
  FriendEntry,
  PyramidCell,
  PlayerPosition
} from '../types/game';
import {
  INITIAL_HERO,
  INITIAL_EQUIPPED,
  INITIAL_INVENTORY,
  INITIAL_MARKET,
  INITIAL_FRIENDS
} from './gameData';



// Очистка локальных кешей браузера (игра работает исключительно через онлайн-базу Supabase и оперативную память сессии)
export function clearAllLocalCharacters(): void {
  if (typeof window !== 'undefined') {
    try {
      if (window.indexedDB && typeof (window.indexedDB as any).databases === 'function') {
        (window.indexedDB as any).databases().then((dbs: any[]) => {
          dbs.forEach((db) => {
            if (db && db.name) window.indexedDB.deleteDatabase(db.name);
          });
        }).catch(() => {});
      }
      if ('caches' in window && typeof window.caches.keys === 'function') {
        window.caches.keys().then((keys) => {
          keys.forEach((key) => window.caches.delete(key));
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Storage cleanup notice:', e);
    }
  }
}

clearAllLocalCharacters();

let memoryGameSave: GameSaveData | null = null;
let memoryCurrentUser: string | null = null;

export function loadGameFromStorage(): GameSaveData {
  if (!memoryGameSave) {
    memoryGameSave = getDefaultSaveData();
  }
  return {
    ...memoryGameSave,
    hero: { ...INITIAL_HERO, ...(memoryGameSave.hero || {}) },
    equipped: { ...INITIAL_EQUIPPED, ...(memoryGameSave.equipped || {}) },
    inventory: Array.isArray(memoryGameSave.inventory) ? memoryGameSave.inventory : [...INITIAL_INVENTORY],
    market: Array.isArray(memoryGameSave.market) ? memoryGameSave.market : [...INITIAL_MARKET],
    tradeProtocol: Array.isArray(memoryGameSave.tradeProtocol) ? memoryGameSave.tradeProtocol : [],
    friends: Array.isArray(memoryGameSave.friends) ? memoryGameSave.friends : [],
    pyramidMap: Array.isArray(memoryGameSave.pyramidMap) ? memoryGameSave.pyramidMap : [],
    playerPos: memoryGameSave.playerPos || { row: 9, col: 1 },
    savedMapTier: memoryGameSave.savedMapTier ?? 1,
    weeklyStats: memoryGameSave.weeklyStats || { mobsKilled: 0, pvpKills: 0, itemsSold: 0 },
    privateMessages: memoryGameSave.privateMessages || []
  };
}

export function saveGameToStorage(data: Partial<GameSaveData>): void {
  const existing = loadGameFromStorage();
  memoryGameSave = {
    ...existing,
    ...data,
    version: 1
  };
  // localStorage is strictly prohibited for game data per user instructions - progress is saved to Supabase
}

export function resetGameStorage(): GameSaveData {
  const defaults = getDefaultSaveData();
  memoryGameSave = defaults;
  return defaults;
}

export function getCurrentUserNick(): string | null {
  if (!memoryCurrentUser && typeof window !== 'undefined') {
    try {
      memoryCurrentUser = localStorage.getItem('pyramid_current_user_nick');
    } catch (e) {
      // ignore
    }
  }
  return memoryCurrentUser;
}

export function setCurrentUserNick(nick: string | null): void {
  memoryCurrentUser = nick;
  if (typeof window !== 'undefined') {
    try {
      if (nick) {
        localStorage.setItem('pyramid_current_user_nick', nick);
      } else {
        localStorage.removeItem('pyramid_current_user_nick');
      }
    } catch (e) {
      // ignore
    }
  }
}

export function getDefaultSaveData(): GameSaveData {
  return {
    version: 1,
    hero: { ...INITIAL_HERO },
    equipped: { ...INITIAL_EQUIPPED },
    inventory: [...INITIAL_INVENTORY],
    market: [...INITIAL_MARKET],
    tradeProtocol: [
      {
        id: 'init_prot_1',
        timestamp: Date.now() - 600000,
        dateStr: '12:00',
        type: 'transfer_in',
        description: '📜 Начало пути: получена стартовая экипировка и свиток фараона.'
      }
    ],
    friends: [...INITIAL_FRIENDS],
    pyramidMap: [],
    playerPos: { row: 9, col: 1 },
    savedMapTier: 1,
    weeklyStats: {
      mobsKilled: 0,
      pvpKills: 0,
      itemsSold: 0
    },
    privateMessages: []
  };
}


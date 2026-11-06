import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeroState } from '../../types/game';
import {
  playSpinTickSound as playClickSound,
  playLootSound,
  playCoinSound,
  playAttackSound,
  playLevelUpSound
} from '../../utils/audio';
import {
  getScarabTournamentConfig,
  saveScarabTournamentConfigLocal,
  syncScarabTournamentConfigFromSupabase,
  saveScarabTournamentConfigToSupabase,
  ScarabTournamentGlobalConfig,
  ScarabCupAdminConfig
} from '../../utils/scarabTournamentConfig';

export interface GamblingTransactionPayload {
  gameName: string;
  spentGold?: number;
  wonGold?: number;
  spentCrystals?: number;
  wonCrystals?: number;
  logText?: string;
  countGame?: boolean;
}

interface SubGameCommonProps {
  hero: HeroState;
  currentUser?: string | null;
  onGamblingTransaction: (tx: GamblingTransactionPayload) => void;
}

// ============================================================================
// 1. «ИГРОВОЙ СЛОТ ФАРАОНА (5x3)» (CLASSIC 5x3 EGYPTIAN SLOT MACHINE)
// ============================================================================
export type SlotSymbolId = 'pyramid' | 'mask' | 'scarab' | 'gold' | 'eye' | 'ankh';

interface SlotSymbolDef {
  id: SlotSymbolId;
  name: string;
  shortLabel: string;
  isBonus?: boolean;
  isWild?: boolean;
  pay3: number;
  pay4: number;
  pay5: number;
  accentColor: string;
  weight: number;
}

// Tuned Realistic Casino RTP (20–25% Win Hit Rate):
// Most spins (77.5%) are non-winning; among the ~22.5% winning spins, the majority return part of the bet
// (0.45x - 0.7x) or give a small profit (1.15x - 1.5x), while big 4-5 symbol lines and Pyramid Bonuses are rare!
const SLOT_SYMBOLS: SlotSymbolDef[] = [
  {
    id: 'mask',
    name: 'Золотая Маска Анубиса (WILD / JACKPOT)',
    shortLabel: 'WILD',
    isWild: true,
    pay3: 3.5,
    pay4: 10,
    pay5: 50,
    accentColor: '#fbbf24',
    weight: 4 // Very rare! Needed for Pharaoh's Grand Jackpot on center payline
  },
  {
    id: 'pyramid',
    name: 'Пирамида Ра (БОНУС СКАТТЕР)',
    shortLabel: 'БОНУС',
    isBonus: true,
    pay3: 3,
    pay4: 8,
    pay5: 25,
    accentColor: '#facc15',
    weight: 6 // Rare scatter trigger
  },
  {
    id: 'scarab',
    name: 'Священный Скарабей',
    shortLabel: 'Скарабей',
    pay3: 1.4,
    pay4: 3.5,
    pay5: 10,
    accentColor: '#2dd4bf',
    weight: 15
  },
  {
    id: 'gold',
    name: 'Сокровища Фараона',
    shortLabel: 'Золото',
    pay3: 1.15,
    pay4: 2.5,
    pay5: 7,
    accentColor: '#f59e0b',
    weight: 22
  },
  {
    id: 'eye',
    name: 'Око Гора',
    shortLabel: 'Око Ра',
    pay3: 0.7,
    pay4: 1.6,
    pay5: 4.5,
    accentColor: '#38bdf8',
    weight: 34
  },
  {
    id: 'ankh',
    name: 'Золотой Анкх',
    shortLabel: 'Анкх',
    pay3: 0.45,
    pay4: 1.2,
    pay5: 3,
    accentColor: '#c084fc',
    weight: 44
  }
];

const SLOT_SYMBOL_MAP: Record<SlotSymbolId, SlotSymbolDef> = SLOT_SYMBOLS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<SlotSymbolId, SlotSymbolDef>
);

// 9 classic 5x3 paylines: each array has 5 row indices (0 = top, 1 = middle, 2 = bottom) for reels 0..4
const PAYLINES_5X3: Array<{ id: number; name: string; rows: [number, number, number, number, number] }> = [
  { id: 1, name: 'Центральная линия (Джекпот)', rows: [1, 1, 1, 1, 1] },
  { id: 2, name: 'Верхняя линия', rows: [0, 0, 0, 0, 0] },
  { id: 3, name: 'Нижняя линия', rows: [2, 2, 2, 2, 2] },
  { id: 4, name: 'Пирамида V', rows: [0, 1, 2, 1, 0] },
  { id: 5, name: 'Купол Λ', rows: [2, 1, 0, 1, 2] },
  { id: 6, name: 'Верхний трон', rows: [0, 0, 1, 0, 0] },
  { id: 7, name: 'Нижняя чаша', rows: [2, 2, 1, 2, 2] },
  { id: 8, name: 'Волна Нила ↑', rows: [1, 0, 0, 0, 1] },
  { id: 9, name: 'Волна Нила ↓', rows: [1, 2, 2, 2, 1] }
];

const STREAK_MULTIPLIERS = [1, 2, 3, 5, 10] as const;
const BET_STEPS_GOLD = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const BET_STEPS_CRYSTALS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];

// Storage keys for progressive jackpot and daily leaderboard
const PHARAOH_JACKPOT_KEY = 'egyptian_slots_progressive_jackpot_v1';
const LUCK_TOURNAMENT_KEY = 'egyptian_slots_luck_tournament_v1';

interface TournamentWinnerRecord {
  nick: string;
  winAmount: number;
  bet: number;
  multiplier: number;
  currency: 'gold' | 'crystals';
  timestamp: number;
}

function getStoredJackpot(): { gold: number; crystals: number } {
  try {
    const raw = localStorage.getItem(PHARAOH_JACKPOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        gold: Math.max(50000, Number(parsed.gold || 50000)),
        crystals: Math.max(1000, Number(parsed.crystals || 1000))
      };
    }
  } catch (_) {
    // Ignore error
  }
  return { gold: 50000, crystals: 1000 };
}

function saveStoredJackpot(jackpot: { gold: number; crystals: number }) {
  try {
    localStorage.setItem(PHARAOH_JACKPOT_KEY, JSON.stringify(jackpot));
  } catch (_) {
    // Ignore error
  }
}

function getStoredTournamentWinners(): TournamentWinnerRecord[] {
  try {
    const raw = localStorage.getItem(LUCK_TOURNAMENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, 10);
    }
  } catch (_) {
    // Ignore error
  }
  // Default authentic Pharaoh high-roller entries
  return [
    { nick: 'Рамзес_Великий', winAmount: 48500, bet: 1000, multiplier: 10, currency: 'gold', timestamp: Date.now() - 3600000 },
    { nick: 'Анубис_Тайный', winAmount: 22000, bet: 500, multiplier: 5, currency: 'gold', timestamp: Date.now() - 7200000 },
    { nick: 'Нефертити_Удача', winAmount: 850, bet: 50, multiplier: 10, currency: 'crystals', timestamp: Date.now() - 10800000 },
    { nick: 'Осирис_Лорд', winAmount: 14200, bet: 250, multiplier: 3, currency: 'gold', timestamp: Date.now() - 14400000 }
  ];
}

function recordTournamentWin(record: TournamentWinnerRecord) {
  try {
    const current = getStoredTournamentWinners();
    const updated = [record, ...current]
      .sort((a, b) => b.winAmount - a.winAmount)
      .slice(0, 10);
    localStorage.setItem(LUCK_TOURNAMENT_KEY, JSON.stringify(updated));
  } catch (_) {
    // Ignore error
  }
}

// Crisp, high-definition 2D Vector SVG renderer for each Egyptian Slot Symbol (zero blur!)
const SlotSymbolSvg: React.FC<{ symbolId: SlotSymbolId; isHighlighted?: boolean }> = ({
  symbolId,
  isHighlighted
}) => {
  switch (symbolId) {
    case 'pyramid':
      return (
        <svg viewBox="0 0 64 64" className="w-10 h-10 sm:w-12 sm:h-12 select-none overflow-visible">
          <defs>
            <linearGradient id="pyrGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
            <linearGradient id="pyrShadow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>
          </defs>
          <circle
            cx="32"
            cy="24"
            r="18"
            fill="rgba(250, 204, 21, 0.22)"
            stroke="#fde047"
            strokeWidth="1.2"
            strokeDasharray="3 2"
          />
          <polygon points="32,8 8,50 32,54" fill="url(#pyrGold)" stroke="#fef08a" strokeWidth="1.4" />
          <polygon points="32,8 56,50 32,54" fill="url(#pyrShadow)" stroke="#f59e0b" strokeWidth="1.4" />
          <polygon points="32,8 23,23 32,25 41,23" fill="#22d3ee" stroke="#cffafe" strokeWidth="1.2" />
          <line x1="18" y1="33" x2="32" y2="36" stroke="#78350f" strokeWidth="1.2" />
          <line x1="13" y1="42" x2="32" y2="45" stroke="#78350f" strokeWidth="1.2" />
          <line x1="46" y1="33" x2="32" y2="36" stroke="#451a03" strokeWidth="1.2" />
          <line x1="51" y1="42" x2="32" y2="45" stroke="#451a03" strokeWidth="1.2" />
          <rect x="11" y="47" width="42" height="11" rx="3" fill="#7c2d12" stroke="#facc15" strokeWidth="1.3" />
          <text
            x="32"
            y="55"
            textAnchor="middle"
            fill="#fef08a"
            fontSize="7.5"
            fontWeight="900"
            letterSpacing="0.5"
          >
            BONUS
          </text>
        </svg>
      );

    case 'mask':
      return (
        <svg viewBox="0 0 64 64" className="w-10 h-10 sm:w-12 sm:h-12 select-none overflow-visible">
          <defs>
            <linearGradient id="maskGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="55%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#a16207" />
            </linearGradient>
          </defs>
          <path
            d="M32 6 L52 18 L56 40 L44 54 L20 54 L8 40 L12 18 Z"
            fill="#1e3a8a"
            stroke="#facc15"
            strokeWidth="2"
          />
          <path d="M14 22 L50 22 M11 30 L53 30 M10 38 L54 38" stroke="#facc15" strokeWidth="2.4" />
          <path
            d="M22 18 Q32 14 42 18 L40 42 Q32 50 24 42 Z"
            fill="url(#maskGold)"
            stroke="#fef08a"
            strokeWidth="1.4"
          />
          <circle cx="32" cy="13" r="4" fill="#ef4444" stroke="#fef08a" strokeWidth="1.2" />
          <ellipse cx="27" cy="27" rx="3" ry="1.8" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
          <ellipse cx="37" cy="27" rx="3" ry="1.8" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
          <rect x="29" y="44" width="6" height="10" rx="2" fill="#1e3a8a" stroke="#facc15" strokeWidth="1.2" />
          <rect x="13" y="48" width="38" height="10" rx="3" fill="#4c1d95" stroke="#fde047" strokeWidth="1.3" />
          <text x="32" y="55.5" textAnchor="middle" fill="#fef08a" fontSize="7" fontWeight="900">
            JACKPOT
          </text>
        </svg>
      );

    case 'scarab':
      return (
        <svg viewBox="0 0 64 64" className="w-10 h-10 sm:w-12 sm:h-12 select-none overflow-visible">
          <path
            d="M30 28 L6 18 L10 36 L28 38 Z"
            fill="#f59e0b"
            stroke="#fef08a"
            strokeWidth="1.3"
          />
          <path
            d="M34 28 L58 18 L54 36 L36 38 Z"
            fill="#f59e0b"
            stroke="#fef08a"
            strokeWidth="1.3"
          />
          <path
            d="M28 34 L12 44 L18 50 L30 42 Z"
            fill="#0284c7"
            stroke="#7dd3fc"
            strokeWidth="1.1"
          />
          <path
            d="M36 34 L52 44 L46 50 L34 42 Z"
            fill="#0284c7"
            stroke="#7dd3fc"
            strokeWidth="1.1"
          />
          <circle cx="32" cy="13" r="6" fill="#ef4444" stroke="#fde047" strokeWidth="1.5" />
          <ellipse cx="32" cy="34" rx="11" ry="15" fill="#0d9488" stroke="#fef08a" strokeWidth="1.8" />
          <line x1="32" y1="24" x2="32" y2="49" stroke="#fef08a" strokeWidth="1.4" />
          <path d="M22 27 Q32 30 42 27" fill="none" stroke="#fef08a" strokeWidth="1.4" />
        </svg>
      );

    case 'gold':
      return (
        <svg viewBox="0 0 64 64" className="w-10 h-10 sm:w-12 sm:h-12 select-none overflow-visible">
          <polygon points="10,48 16,36 34,36 40,48" fill="#d97706" stroke="#fef08a" strokeWidth="1.4" />
          <polygon points="24,48 30,36 48,36 54,48" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.4" />
          <polygon points="17,37 23,25 41,25 47,37" fill="#fbbf24" stroke="#fef9c3" strokeWidth="1.5" />
          <circle cx="20" cy="49" r="6" fill="#eab308" stroke="#fef08a" strokeWidth="1.3" />
          <circle cx="32" cy="51" r="6.5" fill="#facc15" stroke="#fef9c3" strokeWidth="1.3" />
          <circle cx="44" cy="49" r="6" fill="#eab308" stroke="#fef08a" strokeWidth="1.3" />
          <polygon points="32,12 39,20 32,28 25,20" fill="#ef4444" stroke="#fde047" strokeWidth="1.3" />
        </svg>
      );

    case 'eye':
      return (
        <svg viewBox="0 0 64 64" className="w-10 h-10 sm:w-12 sm:h-12 select-none overflow-visible">
          <path
            d="M10 22 Q32 10 54 22"
            fill="none"
            stroke="#facc15"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M10 30 Q32 16 54 30 Q32 44 10 30 Z"
            fill="#0f172a"
            stroke="#fde047"
            strokeWidth="2"
          />
          <circle cx="32" cy="30" r="7.5" fill="#06b6d4" stroke="#fef08a" strokeWidth="1.4" />
          <circle cx="32" cy="30" r="3.2" fill="#020617" />
          <circle cx="34" cy="28" r="1.4" fill="#ffffff" />
          <path
            d="M32 39 L32 52 M36 38 Q46 46 42 53 Q38 56 36 51"
            fill="none"
            stroke="#facc15"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'ankh':
    default:
      return (
        <svg viewBox="0 0 64 64" className="w-10 h-10 sm:w-12 sm:h-12 select-none overflow-visible">
          <ellipse
            cx="32"
            cy="21"
            rx="9"
            ry="12"
            fill="none"
            stroke={isHighlighted ? '#fef08a' : '#fbbf24'}
            strokeWidth="5"
          />
          <line
            x1="15"
            y1="34"
            x2="49"
            y2="34"
            stroke="#fbbf24"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <line
            x1="32"
            y1="33"
            x2="32"
            y2="55"
            stroke="#f59e0b"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="32" cy="34" r="4.5" fill="#a855f7" stroke="#fef08a" strokeWidth="1.4" />
        </svg>
      );
  }
};

function pickRandomSlotSymbol(): SlotSymbolId {
  const totalWeight = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * totalWeight;
  for (const sym of SLOT_SYMBOLS) {
    if (r < sym.weight) return sym.id;
    r -= sym.weight;
  }
  return 'ankh';
}

function evaluateGridQuickSummary(grid: SlotSymbolId[][]): {
  totalBaseMult: number;
  lineCount: number;
  pyramidCount: number;
  isJackpot: boolean;
} {
  const centerLine = [grid[0][1], grid[1][1], grid[2][1], grid[3][1], grid[4][1]];
  const isJackpot = centerLine.every((s) => s === 'mask');

  let totalBaseMult = 0;
  let lineCount = 0;

  for (const pl of PAYLINES_5X3) {
    const lineSyms = pl.rows.map((r, c) => grid[c][r]);
    let targetSym: SlotSymbolId | null = null;
    for (const s of lineSyms) {
      if (s === 'pyramid') break;
      if (s !== 'mask') {
        targetSym = s;
        break;
      }
    }
    if (!targetSym && lineSyms[0] === 'mask') targetSym = 'mask';
    if (!targetSym) continue;

    let matchLen = 0;
    for (let c = 0; c < 5; c++) {
      const s = lineSyms[c];
      if (s === targetSym || s === 'mask') {
        matchLen++;
      } else {
        break;
      }
    }

    if (matchLen >= 3) {
      const symDef = SLOT_SYMBOL_MAP[targetSym];
      const baseMult = matchLen === 5 ? symDef.pay5 : matchLen === 4 ? symDef.pay4 : symDef.pay3;
      totalBaseMult += baseMult;
      lineCount++;
    }
  }

  let pyramidCount = 0;
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 3; r++) {
      if (grid[c][r] === 'pyramid') pyramidCount++;
    }
  }

  if (pyramidCount >= 3) {
    const pyrDef = SLOT_SYMBOL_MAP.pyramid;
    totalBaseMult += pyramidCount >= 5 ? pyrDef.pay5 : pyramidCount === 4 ? pyrDef.pay4 : pyrDef.pay3;
  }

  return { totalBaseMult, lineCount, pyramidCount, isJackpot };
}

function buildRandomRawGrid5x3(): SlotSymbolId[][] {
  const grid: SlotSymbolId[][] = [];
  for (let col = 0; col < 5; col++) {
    const reelCol: SlotSymbolId[] = [];
    for (let row = 0; row < 3; row++) {
      let sym = pickRandomSlotSymbol();
      if (sym === 'pyramid' && reelCol.includes('pyramid')) {
        sym = 'ankh';
      }
      reelCol.push(sym);
    }
    grid.push(reelCol);
  }
  return grid;
}

/**
 * Generates a 5x3 slot grid calibrated so that:
 * - Winning spins occur in ~22.5% of spins (20–25% range).
 * - ~77.5% of spins are losing spins (0 winning lines, <3 pyramids).
 * - Most winning spins return part of the bet (0.45x - 0.7x) or give a small plus (1.15x - 1.5x).
 * - Big combinations (4-5 in a row) and Pyramid bonuses (3+ pyramids) occur rarely.
 */
function generateSlotGrid5x3(): SlotSymbolId[][] {
  const roll = Math.random();
  const nonWinSymbols: SlotSymbolId[] = ['ankh', 'eye', 'gold', 'scarab'];

  // 1) 77.5% of spins -> Strictly Non-Winning Spin (Hit Rate = 22.5%, inside 20-25%)
  if (roll >= 0.225) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate = buildRandomRawGrid5x3();
      const summary = evaluateGridQuickSummary(candidate);
      if (summary.totalBaseMult === 0 && !summary.isJackpot) {
        return candidate;
      }
    }
    // Guaranteed deterministic non-winning fallback grid (reel 2 has completely disjoint symbols from reels 0 & 1)
    return [
      ['ankh', 'eye', 'gold'],
      ['scarab', 'ankh', 'eye'],
      ['gold', 'scarab', 'pyramid'],
      ['eye', 'ankh', 'scarab'],
      ['gold', 'eye', 'ankh']
    ];
  }

  // 2) 22.5% of spins -> Winning Spin, distributed across realistic payout tiers:
  const winTierRoll = Math.random();

  // Tier A (62% of wins = ~14% of all spins): Partial return of bet (0.45x Ankh or 0.7x Eye, single 3-of-a-kind line)
  if (winTierRoll < 0.62) {
    const targetSym: SlotSymbolId = Math.random() < 0.58 ? 'ankh' : 'eye';
    const blockerSyms = nonWinSymbols.filter((s) => s !== targetSym);
    for (let attempt = 0; attempt < 45; attempt++) {
      const candidate = buildRandomRawGrid5x3();
      // Remove masks and excess pyramids so we don't accidentally create multi-line mega wins
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 3; r++) {
          if (candidate[c][r] === 'mask' || candidate[c][r] === 'pyramid') {
            candidate[c][r] = blockerSyms[(c + r) % blockerSyms.length];
          }
        }
      }
      const pl = PAYLINES_5X3[Math.floor(Math.random() * PAYLINES_5X3.length)];
      candidate[0][pl.rows[0]] = targetSym;
      candidate[1][pl.rows[1]] = targetSym;
      candidate[2][pl.rows[2]] = targetSym;
      // Ensure 4th reel breaks the 4-of-a-kind
      if (candidate[3][pl.rows[3]] === targetSym) {
        candidate[3][pl.rows[3]] = blockerSyms[0];
      }
      const summary = evaluateGridQuickSummary(candidate);
      if (summary.lineCount === 1 && summary.totalBaseMult > 0 && summary.totalBaseMult <= 0.85 && !summary.isJackpot) {
        return candidate;
      }
    }
  }

  // Tier B (25% of wins = ~5.6% of all spins): Small profit (1.15x Gold, 1.4x Scarab, or 2 low lines ~1.1x-1.6x)
  if (winTierRoll < 0.87) {
    const targetSym: SlotSymbolId = Math.random() < 0.6 ? 'gold' : 'scarab';
    const blockerSyms = nonWinSymbols.filter((s) => s !== targetSym);
    for (let attempt = 0; attempt < 45; attempt++) {
      const candidate = buildRandomRawGrid5x3();
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 3; r++) {
          if (candidate[c][r] === 'mask' || candidate[c][r] === 'pyramid') {
            candidate[c][r] = blockerSyms[(c + r) % blockerSyms.length];
          }
        }
      }
      const pl = PAYLINES_5X3[Math.floor(Math.random() * PAYLINES_5X3.length)];
      candidate[0][pl.rows[0]] = targetSym;
      candidate[1][pl.rows[1]] = targetSym;
      candidate[2][pl.rows[2]] = targetSym;
      if (candidate[3][pl.rows[3]] === targetSym) {
        candidate[3][pl.rows[3]] = blockerSyms[0];
      }
      const summary = evaluateGridQuickSummary(candidate);
      if (summary.totalBaseMult >= 0.9 && summary.totalBaseMult <= 2.1 && !summary.isJackpot) {
        return candidate;
      }
    }
  }

  // Tier C (9.5% of wins = ~2.1% of all spins): Medium / Big Line Win (4-of-a-kind or Wild combo, 2.2x - 7x)
  if (winTierRoll < 0.965) {
    const targetSym: SlotSymbolId =
      Math.random() < 0.45 ? 'eye' : Math.random() < 0.75 ? 'gold' : 'scarab';
    const blockerSyms = nonWinSymbols.filter((s) => s !== targetSym);
    const pl = PAYLINES_5X3[Math.floor(Math.random() * PAYLINES_5X3.length)];
    const candidate = buildRandomRawGrid5x3();
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 3; r++) {
        if (candidate[c][r] === 'pyramid') {
          candidate[c][r] = blockerSyms[(c + r) % blockerSyms.length];
        }
      }
    }
    candidate[0][pl.rows[0]] = targetSym;
    candidate[1][pl.rows[1]] = targetSym;
    candidate[2][pl.rows[2]] = Math.random() < 0.35 ? 'mask' : targetSym;
    candidate[3][pl.rows[3]] = targetSym;
    if (candidate[4][pl.rows[4]] === targetSym || candidate[4][pl.rows[4]] === 'mask') {
      candidate[4][pl.rows[4]] = blockerSyms[0];
    }
    return candidate;
  }

  // Tier D (3.3% of wins = ~0.75% of all spins): Rare Bonus (3 Pyramids of Ra Scatter or 5-of-a-kind line)
  if (winTierRoll < 0.998) {
    const candidate = buildRandomRawGrid5x3();
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 3; r++) {
        if (candidate[c][r] === 'pyramid' || candidate[c][r] === 'mask') {
          candidate[c][r] = nonWinSymbols[(c + r) % nonWinSymbols.length];
        }
      }
    }
    if (Math.random() < 0.65) {
      // 3 Bonus Pyramids of Ra
      const cols = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3);
      cols.forEach((colIdx) => {
        const rowIdx = Math.floor(Math.random() * 3);
        candidate[colIdx][rowIdx] = 'pyramid';
      });
    } else {
      // 5-of-a-kind line
      const pl = PAYLINES_5X3[Math.floor(Math.random() * PAYLINES_5X3.length)];
      const sym5: SlotSymbolId = Math.random() < 0.6 ? 'gold' : 'scarab';
      for (let c = 0; c < 5; c++) {
        candidate[c][pl.rows[c]] = sym5;
      }
    }
    return candidate;
  }

  // Tier E (0.2% of wins = ~0.045% of all spins): Ultra-Rare Grand Pharaoh Jackpot (5 Anubis Masks on center line)
  const jackpotGrid = buildRandomRawGrid5x3();
  for (let c = 0; c < 5; c++) {
    jackpotGrid[c][1] = 'mask';
  }
  return jackpotGrid;
}

interface WinningLineResult {
  lineId: number;
  lineName: string;
  symbolId: SlotSymbolId;
  matchCount: number;
  baseMultiplier: number;
  cells: Array<{ col: number; row: number }>;
}

interface SlotSpinHistoryEntry {
  id: string;
  time: string;
  outcome: 'win' | 'loss' | 'bonus' | 'jackpot';
  label: string;
  bet: number;
  winAmount: number;
  currency: 'gold' | 'crystals';
  multiplier: number;
}

export const EgyptianSlots5x3GameView: React.FC<SubGameCommonProps> = ({
  hero,
  currentUser,
  onGamblingTransaction
}) => {
  const [currency, setCurrency] = useState<'gold' | 'crystals'>('gold');
  const [betIndex, setBetIndex] = useState<number>(2); // Default 50 Gold / 5 Crystals
  const [grid, setGrid] = useState<SlotSymbolId[][]>(() => [
    ['pyramid', 'gold', 'ankh'],
    ['scarab', 'mask', 'eye'],
    ['eye', 'mask', 'scarab'],
    ['ankh', 'gold', 'pyramid'],
    ['gold', 'scarab', 'mask']
  ]);

  // Rolling strip symbols for realistic vertical reel spinning with blur
  const [stripSymbols, setStripSymbols] = useState<SlotSymbolId[][]>(() => [
    ['mask', 'pyramid', 'scarab', 'gold', 'eye', 'ankh'],
    ['gold', 'scarab', 'mask', 'ankh', 'pyramid', 'eye'],
    ['eye', 'mask', 'pyramid', 'gold', 'scarab', 'ankh'],
    ['ankh', 'pyramid', 'gold', 'mask', 'scarab', 'eye'],
    ['scarab', 'gold', 'eye', 'mask', 'ankh', 'pyramid']
  ]);

  // Reel spinning states for each of the 5 columns
  const [reelSpinning, setReelSpinning] = useState<[boolean, boolean, boolean, boolean, boolean]>([
    false,
    false,
    false,
    false,
    false
  ]);
  const [teaserActiveOnReel5, setTeaserActiveOnReel5] = useState<boolean>(false);
  const [streakStep, setStreakStep] = useState<number>(0);
  const [winningLines, setWinningLines] = useState<WinningLineResult[]>([]);
  const [bonusScatterCells, setBonusScatterCells] = useState<Array<{ col: number; row: number }>>([]);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);
  const [lastWinMessage, setLastWinMessage] = useState<string | null>(null);

  // Progressive Pharaoh Jackpot state
  const [jackpotPool, setJackpotPool] = useState<{ gold: number; crystals: number }>(() => getStoredJackpot());
  const [jackpotHitOverlay, setJackpotHitOverlay] = useState<{ active: boolean; amount: number; currency: 'gold' | 'crystals' } | null>(null);

  // Gamble / Risk Game (x2 Double-Up)
  const [gambleAvailableAmount, setGambleAvailableAmount] = useState<number>(0);
  const [isGambleModalOpen, setIsGambleModalOpen] = useState<boolean>(false);
  const [gambleHistory, setGambleHistory] = useState<string[]>([]);
  const [gambleCurrentMultiplier, setGambleCurrentMultiplier] = useState<number>(1);
  const [gambleResultState, setGambleResultState] = useState<'idle' | 'won' | 'lost'>('idle');

  // Luck Gauge: Bad-streak protection (Fills on zero-win spins, triggers Free Spins when 100%)
  const [luckGaugeCount, setLuckGaugeCount] = useState<number>(0);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState<number>(0);

  // Daily High-Roller Luck Tournament Leaderboard Modal
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState<boolean>(false);
  const [tournamentWinners, setTournamentWinners] = useState<TournamentWinnerRecord[]>(() => getStoredTournamentWinners());

  // Spin History Modal (Last 10 spins log for transparency & dynamics)
  const [isSpinHistoryModalOpen, setIsSpinHistoryModalOpen] = useState<boolean>(false);
  const [spinHistory, setSpinHistory] = useState<SlotSpinHistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem('pharaoh_slots_spin_history_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, 10);
      }
    } catch (_) {}
    return [];
  });

  const appendSpinHistoryEntry = (entry: Omit<SlotSpinHistoryEntry, 'id' | 'time'>) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newRecord: SlotSpinHistoryEntry = {
      ...entry,
      id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time: nowTime
    };
    setSpinHistory((prev) => {
      const updated = [newRecord, ...prev].slice(0, 10);
      try {
        localStorage.setItem('pharaoh_slots_spin_history_v1', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const [bigWinOverlay, setBigWinOverlay] = useState<{
    active: boolean;
    amount: number;
    multiplier: number;
    currency: 'gold' | 'crystals';
  } | null>(null);

  // Track the bet at which current winning streak was earned
  const [streakLockedBet, setStreakLockedBet] = useState<number>(50);
  const [streakLockedCurrency, setStreakLockedCurrency] = useState<'gold' | 'crystals'>('gold');

  // Pharaoh's Loan (Sacred Debt of Anubis) state for zero gold balance
  const [pharaohLoanActive, setPharaohLoanActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pharaoh_loan_active_v1') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [pharaohLoanDebt, setPharaohLoanDebt] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('pharaoh_loan_debt_v1') || 0);
    } catch (_) {
      return 0;
    }
  });
  const [lastLoanDate, setLastLoanDate] = useState<string>(() => {
    try {
      return localStorage.getItem('pharaoh_loan_last_date_v1') || '';
    } catch (_) {
      return '';
    }
  });

  // «Благословение Богов» («Благословение Ра»): с небольшим случайным шансом (~18%) активируется перед спином
  // и даёт солнечный бонус (+50%, +75% или +100%) к следующей победе, украшая интерфейс золотым свечением
  const [raBlessingBonus, setRaBlessingBonus] = useState<{
    active: boolean;
    bonusPct: number;
    justTriggered: boolean;
  }>({
    active: false,
    bonusPct: 50,
    justTriggered: false
  });

  const timersRef = useRef<number[]>([]);
  const intervalRefs = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      intervalRefs.current.forEach((id) => window.clearInterval(id));
      timersRef.current = [];
      intervalRefs.current = [];
    };
  }, []);

  const betSteps = currency === 'gold' ? BET_STEPS_GOLD : BET_STEPS_CRYSTALS;
  const currentBet = betSteps[Math.min(betIndex, betSteps.length - 1)] || betSteps[0];
  const maxBalance = currency === 'gold' ? hero.gold : hero.crystals;
  const isAnySpinning = reelSpinning.some(Boolean);
  const activeMultiplier = STREAK_MULTIPLIERS[Math.min(streakStep, STREAK_MULTIPLIERS.length - 1)];

  // Critical Fix: Changing bet size resets win-streak multiplier to 1X
  // to prevent exploiting low bets to build a 10X streak then betting huge!
  const handleDecreaseBet = () => {
    if (isAnySpinning || freeSpinsLeft > 0) return;
    playClickSound();
    setBetIndex((prev) => {
      const nextIdx = Math.max(0, prev - 1);
      if (nextIdx !== prev && streakStep > 0) {
        setStreakStep(0);
        setLastWinMessage('⚠️ Размер ставки изменен: множитель победной серии сброшен до 1X.');
      }
      return nextIdx;
    });
  };

  const handleIncreaseBet = () => {
    if (isAnySpinning || freeSpinsLeft > 0) return;
    playClickSound();
    setBetIndex((prev) => {
      const nextIdx = Math.min(betSteps.length - 1, prev + 1);
      if (nextIdx !== prev && streakStep > 0) {
        setStreakStep(0);
        setLastWinMessage('⚠️ Размер ставки изменен: множитель победной серии сброшен до 1X.');
      }
      return nextIdx;
    });
  };

  const handleMaxBet = () => {
    if (isAnySpinning || freeSpinsLeft > 0) return;
    playClickSound();
    let bestIdx = 0;
    for (let i = 0; i < betSteps.length; i++) {
      if (betSteps[i] <= maxBalance) {
        bestIdx = i;
      }
    }
    if (bestIdx !== betIndex && streakStep > 0) {
      setStreakStep(0);
      setLastWinMessage('⚠️ Выбрана максимальная ставка: множитель победной серии сброшен до 1X.');
    }
    setBetIndex(bestIdx);
  };

  // Pharaoh's Loan (Sacred Loan from Anubis when gold = 0)
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const canClaimPharaohLoan = hero.gold <= 0 && !pharaohLoanActive && lastLoanDate !== todayDateStr;

  const handleClaimPharaohLoan = () => {
    if (!canClaimPharaohLoan) return;
    const loanCoins = 500;
    playLevelUpSound();
    setPharaohLoanActive(true);
    setPharaohLoanDebt(loanCoins);
    setLastLoanDate(todayDateStr);
    try {
      localStorage.setItem('pharaoh_loan_active_v1', 'true');
      localStorage.setItem('pharaoh_loan_debt_v1', String(loanCoins));
      localStorage.setItem('pharaoh_loan_last_date_v1', todayDateStr);
    } catch (_) {}

    onGamblingTransaction({
      gameName: 'Фараонов Долг Анубиса',
      spentGold: 0,
      wonGold: loanCoins,
      spentCrystals: 0,
      wonCrystals: 0,
      countGame: false,
      logText: `🏛️ [Фараонов Долг] Анубис даровал священный заем +${loanCoins} 🪙 для отыгрыша (долг ${loanCoins} 🪙 будет списан при крупной победе).`
    });

    setLastWinMessage(`🏛️ СВЯЩЕННЫЙ ЗАЕМ: Статуя Анубиса даровала вам +${loanCoins} 🪙! При первой же крупной победе долг вернется в казну.`);
  };

  // Main Spin Handler with Rolling Reels Animation, Teaser, Sequential Left-to-Right Stop, and Jackpot Detection
  const handleSpinSlots = () => {
    if (isAnySpinning) return;
    const isFreeSpin = freeSpinsLeft > 0;

    if (!isFreeSpin && currentBet > maxBalance) {
      setLastWinMessage(
        currency === 'gold'
          ? '⚠️ Недостаточно золота для выбранной ставки!'
          : '⚠️ Недостаточно кристаллов для выбранной ставки!'
      );
      return;
    }

    // Clear previous highlights & states
    timersRef.current.forEach((id) => window.clearTimeout(id));
    intervalRefs.current.forEach((id) => window.clearInterval(id));
    timersRef.current = [];
    intervalRefs.current = [];
    setWinningLines([]);
    setBonusScatterCells([]);
    setLastWinAmount(0);
    setLastWinMessage(null);
    setBigWinOverlay(null);
    setJackpotHitOverlay(null);
    setTeaserActiveOnReel5(false);
    setGambleAvailableAmount(0);

    const lockedCurrency = currency;
    const lockedBet = currentBet;
    const lockedStreakIdx = streakStep;
    const lockedMultiplier = STREAK_MULTIPLIERS[Math.min(lockedStreakIdx, STREAK_MULTIPLIERS.length - 1)];
    const curIcon = lockedCurrency === 'gold' ? '🪙' : '💎';

    // Roll for «Благословение Ра» (Blessing of Ra) right before the spin starts (~18% chance if not already active)
    let activeRaBlessing = raBlessingBonus.active;
    let activeRaBlessingPct = raBlessingBonus.bonusPct;
    if (!activeRaBlessing && Math.random() < 0.18) {
      const pctRoll = Math.random();
      activeRaBlessingPct = pctRoll < 0.65 ? 50 : pctRoll < 0.9 ? 75 : 100;
      activeRaBlessing = true;
      setRaBlessingBonus({
        active: true,
        bonusPct: activeRaBlessingPct,
        justTriggered: true
      });
      playLootSound();
    } else if (activeRaBlessing && raBlessingBonus.justTriggered) {
      setRaBlessingBonus((prev) => ({ ...prev, justTriggered: false }));
    }

    if (isFreeSpin) {
      setFreeSpinsLeft((prev) => Math.max(0, prev - 1));
    } else {
      // Deduct stake and contribute 2% to progressive Pharaoh Jackpot!
      const jackpotAddition = Math.max(1, Math.round(lockedBet * 0.02));
      const nextJackpot = {
        ...jackpotPool,
        [lockedCurrency]: jackpotPool[lockedCurrency] + jackpotAddition
      };
      setJackpotPool(nextJackpot);
      saveStoredJackpot(nextJackpot);

      onGamblingTransaction({
        gameName: 'Слоты Фараона 5x3',
        spentGold: lockedCurrency === 'gold' ? lockedBet : 0,
        wonGold: 0,
        spentCrystals: lockedCurrency === 'crystals' ? lockedBet : 0,
        wonCrystals: 0,
        countGame: false
      });
    }

    playClickSound();

    // Generate outcome grid (20–25% win hit rate, mostly partial returns or small pluses)
    const nextGrid = generateSlotGrid5x3();

    // Check for teaser (2+ Pyramids in reels 0..3)
    const pyramidsInFirst4: Array<{ col: number; row: number }> = [];
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 3; r++) {
        if (nextGrid[c][r] === 'pyramid') {
          pyramidsInFirst4.push({ col: c, row: r });
        }
      }
    }
    const shouldTriggerTeaser = pyramidsInFirst4.length >= 2;

    // Start all 5 reels spinning
    setReelSpinning([true, true, true, true, true]);

    // Continuously cycle vertical strip symbols while reels are spinning for authentic blur motion
    const spinInterval = window.setInterval(() => {
      setStripSymbols((prev) =>
        prev.map(() => [
          pickRandomSlotSymbol(),
          pickRandomSlotSymbol(),
          pickRandomSlotSymbol(),
          pickRandomSlotSymbol(),
          pickRandomSlotSymbol(),
          pickRandomSlotSymbol()
        ])
      );
    }, 85);
    intervalRefs.current.push(spinInterval);

    // Stop reels 0..3 sequentially left-to-right at 500ms, 850ms, 1200ms, 1550ms
    const stopTimes = [500, 850, 1200, 1550];
    stopTimes.forEach((ms, colIdx) => {
      const t = window.setTimeout(() => {
        playClickSound();
        setGrid((prev) => {
          const copy = prev.map((c) => [...c]);
          copy[colIdx] = nextGrid[colIdx];
          return copy;
        });
        setReelSpinning((prev) => {
          const nextState = [...prev] as [boolean, boolean, boolean, boolean, boolean];
          nextState[colIdx] = false;
          return nextState;
        });

        // Trigger teaser on 5th reel if 2+ Pyramids landed on reels 0..3
        if (colIdx === 3 && shouldTriggerTeaser) {
          setTeaserActiveOnReel5(true);
          setBonusScatterCells(pyramidsInFirst4);
          [260, 560, 900, 1300].forEach((tickOffset) => {
            const tt = window.setTimeout(() => playClickSound(), tickOffset);
            timersRef.current.push(tt);
          });
        }
      }, ms);
      timersRef.current.push(t);
    });

    // 5th reel stop: normal (1900ms) or Teaser slow-down with golden aura (3100ms)
    const finalStopMs = shouldTriggerTeaser ? 3100 : 1900;
    const finalTimer = window.setTimeout(() => {
      window.clearInterval(spinInterval);
      playClickSound();
      setGrid(nextGrid);
      setReelSpinning([false, false, false, false, false]);
      setTeaserActiveOnReel5(false);

      // 1. Evaluate Grand Pharaoh Jackpot: 5 Anubis Masks on center payline (line 1, row 1 across all 5 reels)
      const centerLine = [nextGrid[0][1], nextGrid[1][1], nextGrid[2][1], nextGrid[3][1], nextGrid[4][1]];
      const isJackpotHit = centerLine.every((s) => s === 'mask');

      if (isJackpotHit) {
        playLevelUpSound();
        const jackpotWin = jackpotPool[lockedCurrency];
        setJackpotHitOverlay({
          active: true,
          amount: jackpotWin,
          currency: lockedCurrency
        });
        // Reset jackpot to base minimum seed
        const resetJackpot = {
          ...jackpotPool,
          [lockedCurrency]: lockedCurrency === 'gold' ? 50000 : 1000
        };
        setJackpotPool(resetJackpot);
        saveStoredJackpot(resetJackpot);

        setLastWinAmount(jackpotWin);
        setLastWinMessage(`👑 НЕВЕРОЯТНО! ВЫ ВЫБИЛИ 5 МАСОК АНУБИСА И СОРВАЛИ ДЖЕКПОТ ФАРАОНА: +${jackpotWin.toLocaleString()} ${curIcon}!`);
        setGambleAvailableAmount(jackpotWin);

        recordTournamentWin({
          nick: currentUser || (hero as any).nick || (hero as any).name || 'Счастливчик',
          winAmount: jackpotWin,
          bet: lockedBet,
          multiplier: 100,
          currency: lockedCurrency,
          timestamp: Date.now()
        });

        appendSpinHistoryEntry({
          outcome: 'jackpot',
          label: `👑 ГРАНД ДЖЕКПОТ! +${jackpotWin.toLocaleString()} ${curIcon}`,
          bet: isFreeSpin ? 0 : lockedBet,
          winAmount: jackpotWin,
          currency: lockedCurrency,
          multiplier: 100
        });

        onGamblingTransaction({
          gameName: 'Слоты Фараона 5x3',
          spentGold: 0,
          wonGold: lockedCurrency === 'gold' ? jackpotWin : 0,
          spentCrystals: 0,
          wonCrystals: lockedCurrency === 'crystals' ? jackpotWin : 0,
          countGame: true,
          logText: `👑 [ДЖЕКПОТ ФАРАОНА] Сорван грандиозный банк +${jackpotWin.toLocaleString()} ${curIcon}!`
        });
        return;
      }

      // 2. Evaluate all 9 paylines
      const lineWins: WinningLineResult[] = [];
      for (const pl of PAYLINES_5X3) {
        const lineSyms = pl.rows.map((r, c) => nextGrid[c][r]);
        let targetSym: SlotSymbolId | null = null;
        for (const s of lineSyms) {
          if (s === 'pyramid') break;
          if (s !== 'mask') {
            targetSym = s;
            break;
          }
        }
        if (!targetSym && lineSyms[0] === 'mask') targetSym = 'mask';
        if (!targetSym) continue;

        let matchLen = 0;
        const matchedCells: Array<{ col: number; row: number }> = [];
        for (let c = 0; c < 5; c++) {
          const s = lineSyms[c];
          if (s === targetSym || s === 'mask') {
            matchLen++;
            matchedCells.push({ col: c, row: pl.rows[c] });
          } else {
            break;
          }
        }

        if (matchLen >= 3) {
          const symDef = SLOT_SYMBOL_MAP[targetSym];
          const baseMult = matchLen === 5 ? symDef.pay5 : matchLen === 4 ? symDef.pay4 : symDef.pay3;
          lineWins.push({
            lineId: pl.id,
            lineName: pl.name,
            symbolId: targetSym,
            matchCount: matchLen,
            baseMultiplier: baseMult,
            cells: matchedCells
          });
        }
      }

      // 3. Evaluate Pyramid Scatters
      const allPyramids: Array<{ col: number; row: number }> = [];
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 3; r++) {
          if (nextGrid[c][r] === 'pyramid') {
            allPyramids.push({ col: c, row: r });
          }
        }
      }

      let totalBaseMult = lineWins.reduce((sum, w) => sum + w.baseMultiplier, 0);
      let scatterBonusMult = 0;
      if (allPyramids.length >= 3) {
        const pyrDef = SLOT_SYMBOL_MAP.pyramid;
        scatterBonusMult = allPyramids.length >= 5 ? pyrDef.pay5 : allPyramids.length === 4 ? pyrDef.pay4 : pyrDef.pay3;
        totalBaseMult += scatterBonusMult;
      }

      setWinningLines(lineWins);
      setBonusScatterCells(allPyramids.length >= 2 ? allPyramids : []);

      if (totalBaseMult > 0) {
        // Player won!
        // Reset streak multiplier back to 1X if player just hit the 10X multiplier,
        // otherwise advance streak step.
        let nextStreakIdx = 0;
        if (lockedStreakIdx >= STREAK_MULTIPLIERS.length - 1 || lockedMultiplier >= 10) {
          // Reached max 10X multiplier: Next spin MUST reset to 1X!
          nextStreakIdx = 0;
        } else {
          nextStreakIdx = lockedStreakIdx + 1;
        }

        const appliedMult = lockedMultiplier;
        const raMultFactor = activeRaBlessing ? 1 + activeRaBlessingPct / 100 : 1;
        let rawWin = Math.max(1, Math.round(lockedBet * totalBaseMult * appliedMult * raMultFactor));

        if (activeRaBlessing) {
          setRaBlessingBonus({
            active: false,
            bonusPct: 50,
            justTriggered: false
          });
        }

        // Handle Pharaoh's Sacred Loan Repayment upon win:
        let loanRepaidAmount = 0;
        if (pharaohLoanActive && pharaohLoanDebt > 0 && lockedCurrency === 'gold' && rawWin >= 100) {
          loanRepaidAmount = Math.min(pharaohLoanDebt, Math.round(rawWin * 0.5));
          const remainingDebt = pharaohLoanDebt - loanRepaidAmount;
          rawWin -= loanRepaidAmount;
          setPharaohLoanDebt(remainingDebt);
          if (remainingDebt <= 0) {
            setPharaohLoanActive(false);
            try {
              localStorage.removeItem('pharaoh_loan_active_v1');
              localStorage.removeItem('pharaoh_loan_debt_v1');
            } catch (_) {}
          } else {
            try {
              localStorage.setItem('pharaoh_loan_debt_v1', String(remainingDebt));
            } catch (_) {}
          }
        }

        setStreakStep(nextStreakIdx);
        setLastWinAmount(rawWin);
        setGambleAvailableAmount(rawWin);
        setLuckGaugeCount((prev) => Math.max(0, prev - 1));

        const isBigWin = rawWin >= lockedBet * 5 || allPyramids.length >= 3 || appliedMult >= 3;
        if (isBigWin) {
          playLevelUpSound();
          setBigWinOverlay({
            active: true,
            amount: rawWin,
            multiplier: appliedMult,
            currency: lockedCurrency
          });
        } else {
          playLootSound();
        }

        // Record in daily tournament
        recordTournamentWin({
          nick: currentUser || (hero as any).nick || (hero as any).name || 'Игрок',
          winAmount: rawWin,
          bet: lockedBet,
          multiplier: appliedMult,
          currency: lockedCurrency,
          timestamp: Date.now()
        });

        appendSpinHistoryEntry({
          outcome: allPyramids.length >= 3 ? 'bonus' : 'win',
          label:
            allPyramids.length >= 3
              ? `🔺 Бонус Пирамид! +${rawWin.toLocaleString()} ${curIcon}${activeRaBlessing ? ` (☀️ Ра +${activeRaBlessingPct}%)` : ''}`
              : `Победа +${rawWin.toLocaleString()} ${curIcon} (Линий: ${lineWins.length}${activeRaBlessing ? `, ☀️ Ра +${activeRaBlessingPct}%` : ''})`,
          bet: isFreeSpin ? 0 : lockedBet,
          winAmount: rawWin,
          currency: lockedCurrency,
          multiplier: appliedMult
        });

        const summaryParts: string[] = [];
        if (allPyramids.length >= 3) summaryParts.push(`🔺 БОНУС ПИРАМИД (${allPyramids.length} шт.)`);
        if (lineWins.length > 0) summaryParts.push(`Линий: ${lineWins.length}`);
        if (activeRaBlessing) summaryParts.push(`☀️ Благословение Ра +${activeRaBlessingPct}%`);
        if (appliedMult >= 10) summaryParts.push('⚡ 10X МАКСИМУМ (СБРОС ДО 1X)');
        if (loanRepaidAmount > 0) summaryParts.push(`🏛️ Долг Анубису: -${loanRepaidAmount} 🪙`);

        const winText = `🎉 ВЫИГРЫШ: +${rawWin.toLocaleString()} ${curIcon} (${summaryParts.join(' • ')}${appliedMult > 1 ? ` • ${appliedMult}X` : ''})!`;
        setLastWinMessage(winText);

        onGamblingTransaction({
          gameName: 'Слоты Фараона 5x3',
          spentGold: 0,
          wonGold: lockedCurrency === 'gold' ? rawWin : 0,
          spentCrystals: 0,
          wonCrystals: lockedCurrency === 'crystals' ? rawWin : 0,
          countGame: true,
          logText: `🎰 Слоты Фараона: выигрыш +${rawWin} ${curIcon}!${activeRaBlessing ? ` (☀️ Благословение Ра +${activeRaBlessingPct}%)` : ''}${loanRepaidAmount > 0 ? ` (Возврат займа Анубиса: ${loanRepaidAmount} 🪙)` : ''}`
        });
      } else {
        // Spin lost: advance bad-streak protection Luck Gauge!
        playCoinSound();
        setStreakStep(0);
        setLastWinAmount(0);
        setGambleAvailableAmount(0);

        appendSpinHistoryEntry({
          outcome: 'loss',
          label: isFreeSpin ? 'Free Spin — мимо' : `Проигрыш (-${lockedBet} ${curIcon})`,
          bet: isFreeSpin ? 0 : lockedBet,
          winAmount: 0,
          currency: lockedCurrency,
          multiplier: lockedMultiplier
        });

        const nextGauge = luckGaugeCount + 1;
        if (nextGauge >= 6) {
          // Trigger consolation 5 Free Spins series!
          playLevelUpSound();
          setLuckGaugeCount(0);
          setFreeSpinsLeft((prev) => prev + 5);
          setLastWinMessage('✨ «ШКАЛА УДАЧИ» ЗАПОЛНЕНА! Вам начислена утешительная серия из 5 БЕСПЛАТНЫХ СПИНОВ! 🎁');
        } else {
          setLuckGaugeCount(nextGauge);
          setLastWinMessage(
            allPyramids.length === 2
              ? '✨ Выпало 2 Пирамиды Ра — до Бонуса не хватило всего одной! Шкала удачи +1.'
              : `Комбинация не совпала. Шкала удачи: ${nextGauge}/6 (накопите 6 для бесплатных спинов).`
          );
        }

        onGamblingTransaction({
          gameName: 'Слоты Фараона 5x3',
          spentGold: 0,
          wonGold: 0,
          spentCrystals: 0,
          wonCrystals: 0,
          countGame: true
        });
      }
    }, finalStopMs);
    timersRef.current.push(finalTimer);
  };

  // Double-Up Gamble / Risk Game
  const handleOpenGambleModal = () => {
    if (gambleAvailableAmount <= 0) return;
    playClickSound();
    setGambleHistory([]);
    setGambleCurrentMultiplier(1);
    setGambleResultState('idle');
    setIsGambleModalOpen(true);
  };

  const handleChooseGambleChoice = (choice: 'red' | 'black' | 'gold' | 'turquoise') => {
    if (gambleResultState === 'lost') return;
    playClickSound();

    // 50/50 fair gamble risk check
    const isWin = Math.random() < 0.5;
    const curIcon = currency === 'gold' ? '🪙' : '💎';

    if (isWin) {
      playLootSound();
      const nextAmount = gambleAvailableAmount * 2;
      const nextMult = gambleCurrentMultiplier * 2;
      setGambleAvailableAmount(nextAmount);
      setGambleCurrentMultiplier(nextMult);
      setGambleHistory((prev) => [...prev, `${choice.toUpperCase()}: ПОБЕДА (x${nextMult})`]);
      setGambleResultState('won');

      // Adjust transaction
      onGamblingTransaction({
        gameName: 'Риск-игра Слотов Фараона',
        spentGold: 0,
        wonGold: currency === 'gold' ? gambleAvailableAmount : 0,
        spentCrystals: 0,
        wonCrystals: currency === 'crystals' ? gambleAvailableAmount : 0,
        countGame: false,
        logText: `🎲 [Риск-игра x2] Успешное удвоение: куш ${nextAmount.toLocaleString()} ${curIcon}!`
      });
    } else {
      playAttackSound();
      setGambleHistory((prev) => [...prev, `${choice.toUpperCase()}: ПРОИГРЫШ`]);
      setGambleResultState('lost');

      // Deduct the won balance that player gambled away
      onGamblingTransaction({
        gameName: 'Риск-игра Слотов Фараона',
        spentGold: currency === 'gold' ? gambleAvailableAmount : 0,
        wonGold: 0,
        spentCrystals: currency === 'crystals' ? gambleAvailableAmount : 0,
        wonCrystals: 0,
        countGame: false,
        logText: `💀 [Риск-игра x2] Неверный выбор — выигрыш сгорел.`
      });

      setGambleAvailableAmount(0);
      setLastWinAmount(0);
      setLastWinMessage('💀 Неверный выбор в риск-игре! Выигрыш за спин сгорел.');
    }
  };

  const handleCollectGambleWin = () => {
    setIsGambleModalOpen(false);
    playLootSound();
    setLastWinMessage(`💰 ВЫИГРЫШ ЗАБРАН! Итоговый куш: +${gambleAvailableAmount.toLocaleString()} ${currency === 'gold' ? '🪙' : '💎'}!`);
  };

  const isCellWinning = (col: number, row: number): boolean => {
    if (winningLines.some((w) => w.cells.some((cell) => cell.col === col && cell.row === row))) {
      return true;
    }
    if (
      bonusScatterCells.length >= 2 &&
      bonusScatterCells.some((cell) => cell.col === col && cell.row === row)
    ) {
      return true;
    }
    return false;
  };

  return (
    <div className="relative flex flex-col gap-2.5 select-none">
      {/* 1. TOP PROGRESSIVE JACKPOT, SPIN HISTORY SCROLL & HIGH-ROLLER TOURNAMENT BAR */}
      <div className="rounded-2xl border-2 border-yellow-400 bg-gradient-to-r from-[#291305] via-[#3a1d08] to-[#291305] p-2.5 shadow-[0_4px_20px_rgba(250,204,21,0.25)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-300 bg-gradient-to-b from-yellow-300 to-amber-600 text-lg shadow-[0_0_12px_rgba(250,204,21,0.7)]">
            👑
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-yellow-300">
                ДЖЕКПОТ ФАРАОНА
              </span>
              <span className="rounded bg-red-600/80 px-1 py-0.2 text-[7px] font-black uppercase text-white animate-pulse">
                5 МАСОК ПО ЦЕНТРУ
              </span>
            </div>
            <div className="text-xs sm:text-sm font-black text-white tabular-nums drop-shadow mt-0.5 truncate">
              {jackpotPool[currency].toLocaleString()} {currency === 'gold' ? '🪙' : '💎'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Spin History Scroll Button */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsSpinHistoryModalOpen(true);
            }}
            className="rounded-xl border border-amber-400/80 bg-gradient-to-b from-amber-800/90 to-slate-950 px-2.5 py-1.5 text-[9px] font-black uppercase text-amber-200 shadow hover:brightness-110 active:scale-95 cursor-pointer flex items-center gap-1"
            title="Открыть свиток истории последних спинов"
          >
            <span>📜</span>
            <span>История ({spinHistory.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTournamentWinners(getStoredTournamentWinners());
              setIsTournamentModalOpen(true);
            }}
            className="rounded-xl border border-amber-400/80 bg-gradient-to-b from-amber-700 to-slate-950 px-2.5 py-1.5 text-[9px] font-black uppercase text-yellow-200 shadow hover:brightness-110 active:scale-95 cursor-pointer"
          >
            🏆 Турнир дня
          </button>
        </div>
      </div>

      {/* 2. LUCK GAUGE & FREE SPINS STATUS (BAD-STREAK PROTECTION) */}
      <div className="rounded-xl border border-cyan-500/50 bg-slate-950/90 p-2 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[8px] font-black uppercase mb-1">
            <span className="text-cyan-300">
              🛡️ Шкала удачи (защита от неудач): {luckGaugeCount}/6
            </span>
            <span className="text-amber-300">
              {freeSpinsLeft > 0 ? `🎁 БЕСПЛАТНЫХ СПИНОВ: ${freeSpinsLeft}` : 'Заполните для 5 Free Spins'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-cyan-500/30">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-amber-300 transition-all duration-300"
              style={{ width: `${Math.min(100, (luckGaugeCount / 6) * 100)}%` }}
            />
          </div>
        </div>

        {freeSpinsLeft > 0 && (
          <div className="shrink-0 rounded-lg border border-amber-400 bg-amber-950 px-2 py-1 text-[9px] font-black uppercase text-yellow-300 animate-pulse">
            FREE SPIN x{freeSpinsLeft}
          </div>
        )}
      </div>

      {/* 3. STREAK MULTIPLIER BAR (2X, 3X, 5X, 10X) */}
      <div className="rounded-2xl border border-amber-500/70 bg-gradient-to-b from-[#221005] via-[#140b04] to-[#0a0603] p-2 shadow-[0_4px_14px_rgba(0,0,0,0.85)]">
        <div className="flex items-center justify-between gap-1.5 mb-1.5 px-1">
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-300">
            ⚡ Множители победной серии
          </span>
          <span className="text-[8.5px] font-bold text-amber-200/90 tabular-nums">
            Текущий: <strong className="text-yellow-300 text-xs">{activeMultiplier}X</strong>
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[2, 3, 5, 10].map((multVal, idx) => {
            const stepIdx = idx + 1;
            const isUnlocked = streakStep >= stepIdx;
            const isCurrent = streakStep === stepIdx;
            return (
              <div
                key={multVal}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 py-1 px-1.5 transition-all duration-200 ${
                  isCurrent
                    ? 'border-yellow-300 bg-gradient-to-b from-amber-500 via-yellow-500 to-amber-700 text-slate-950 shadow-[0_0_16px_rgba(250,204,21,0.85)] scale-[1.03]'
                    : isUnlocked
                    ? 'border-amber-400/90 bg-gradient-to-b from-amber-800/80 to-amber-950 text-yellow-200 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                    : 'border-slate-800 bg-slate-950/90 text-slate-500'
                }`}
              >
                <span className="text-xs sm:text-sm font-black tracking-tight tabular-nums leading-none">
                  {multVal}X
                </span>
                <span className={`text-[7px] font-extrabold uppercase mt-0.5 ${isCurrent ? 'text-slate-950' : isUnlocked ? 'text-amber-300' : 'text-slate-600'}`}>
                  {isCurrent ? 'АКТИВЕН' : isUnlocked ? 'ГОТОВ' : `Серия ${stepIdx}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. STRICTLY LOCKED 5x3 REEL GRID (5 COLUMNS × 3 ROWS = 15 VISIBLE CELLS) */}
      <div
        className={`relative rounded-2xl border-[3px] p-2.5 overflow-hidden transition-all duration-300 ${
          raBlessingBonus.active
            ? 'border-yellow-300 bg-gradient-to-b from-[#2b1804] via-[#140b16] to-[#0b060d] shadow-[0_0_36px_rgba(250,204,21,0.72),inset_0_0_28px_rgba(245,158,11,0.32)] ring-2 ring-yellow-300/70'
            : 'border-amber-400 bg-gradient-to-b from-[#1a0e06] via-[#0d0710] to-[#07050a] shadow-[0_0_28px_rgba(245,158,11,0.3),inset_0_0_24px_rgba(0,0,0,0.95)]'
        }`}
      >
        {raBlessingBonus.active && (
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(253,224,71,0.22)_0%,transparent_70%)] animate-pulse" />
        )}
        {teaserActiveOnReel5 && (
          <div className="mb-2 rounded-xl border-2 border-yellow-300 bg-gradient-to-r from-amber-700 via-yellow-500 to-amber-700 px-3 py-1 text-center text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.9)] animate-pulse">
            ✨ 2 ПИРАМИДЫ РА! ОЖИДАНИЕ БОНУСА НА 5-М БАРАБАНЕ... ✨
          </div>
        )}

        <div className="relative grid grid-cols-5 gap-1.5 sm:gap-2 items-stretch">
          {[0, 1, 2, 3, 4].map((colIdx) => {
            const reelSymbols =
              Array.isArray(grid[colIdx]) && grid[colIdx].length >= 3
                ? grid[colIdx]
                : (['gold', 'scarab', 'ankh'] as SlotSymbolId[]);
            const spinningThisReel = Boolean(reelSpinning[colIdx]);
            const isTeaserCol = colIdx === 4 && teaserActiveOnReel5;

            const rawStrip =
              Array.isArray(stripSymbols[colIdx]) && stripSymbols[colIdx].length >= 3
                ? stripSymbols[colIdx]
                : (['mask', 'pyramid', 'scarab', 'gold', 'eye', 'ankh'] as SlotSymbolId[]);
            const loopStrip: SlotSymbolId[] =
              rawStrip.length >= 6
                ? rawStrip.slice(0, 6)
                : ([...rawStrip, ...rawStrip, 'gold', 'scarab', 'ankh'] as SlotSymbolId[]).slice(0, 6);

            return (
              <div
                key={colIdx}
                className={`relative rounded-xl border-2 p-1 sm:p-1.5 transition-colors duration-200 overflow-hidden ${
                  isTeaserCol
                    ? 'border-yellow-300 bg-gradient-to-b from-amber-900/90 via-yellow-950/90 to-amber-900/90 shadow-[0_0_28px_rgba(250,204,21,0.95)] ring-2 ring-yellow-300'
                    : 'border-amber-500/45 bg-gradient-to-b from-[#130d1c] via-[#0b0811] to-[#130d1c]'
                }`}
              >
                {/* Fixed 3-row viewport container so every reel column has the exact same height whether spinning or stopped */}
                <div className="relative h-[216px] sm:h-[234px] w-full overflow-hidden">
                  {spinningThisReel ? (
                    <div className="absolute inset-x-0 top-0 flex flex-col gap-1.5 select-none animate-slot-roll opacity-95">
                      {loopStrip.map((rollSym, rIdx) => {
                        const safeRollSym: SlotSymbolId =
                          rollSym && SLOT_SYMBOL_MAP[rollSym] ? rollSym : 'gold';
                        return (
                          <div
                            key={rIdx}
                            className="flex h-[68px] sm:h-[74px] w-full shrink-0 flex-col items-center justify-center rounded-lg border border-amber-500/35 bg-slate-950/95 shadow-inner"
                          >
                            <SlotSymbolSvg symbolId={safeRollSym} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-rows-3 gap-1.5 h-full w-full animate-slot-stop">
                      {[0, 1, 2].map((rowIdx) => {
                        const rawSym = reelSymbols[rowIdx];
                        const symId: SlotSymbolId =
                          rawSym && SLOT_SYMBOL_MAP[rawSym] ? rawSym : 'gold';
                        const symDef = SLOT_SYMBOL_MAP[symId];
                        const isWinCell = isCellWinning(colIdx, rowIdx);

                        return (
                          <div
                            key={rowIdx}
                            className={`relative flex h-[68px] sm:h-[74px] w-full flex-col items-center justify-center rounded-lg border transition-all duration-150 ${
                              isWinCell
                                ? 'border-2 border-yellow-300 bg-gradient-to-b from-amber-500/45 via-yellow-500/30 to-amber-900/65 shadow-[0_0_18px_rgba(250,204,21,0.95)] scale-[1.02] z-10'
                                : 'border-slate-800/90 bg-gradient-to-b from-[#181122] via-[#0d0914] to-[#181122]'
                            }`}
                          >
                            <SlotSymbolSvg symbolId={symId} isHighlighted={isWinCell} />
                            <span
                              className={`mt-0.5 text-[7px] font-black uppercase tracking-wider leading-none ${
                                isWinCell ? 'text-yellow-200' : 'text-slate-400'
                              }`}
                            >
                              {symDef.shortLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* SVG Glowing Golden Win Lines Overlay (Connects Matching Horizontal & Diagonal Symbols) */}
          {!isAnySpinning && (winningLines.length > 0 || bonusScatterCells.length >= 3) && (
            <svg
              viewBox="0 0 500 300"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible animate-win-line-pulse"
            >
              <defs>
                <linearGradient id="slotGoldLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#fde047" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#fef08a" />
                </linearGradient>
              </defs>

              {/* Bonus Pyramid Scatter Connection Line */}
              {bonusScatterCells.length >= 3 && (
                <g>
                  <polyline
                    points={bonusScatterCells
                      .map((c) => `${c.col * 100 + 50},${c.row * 100 + 50}`)
                      .join(' ')}
                    fill="none"
                    stroke="rgba(250, 204, 21, 0.45)"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={bonusScatterCells
                      .map((c) => `${c.col * 100 + 50},${c.row * 100 + 50}`)
                      .join(' ')}
                    fill="none"
                    stroke="#fde047"
                    strokeWidth="4.5"
                    strokeDasharray="10 8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-win-line-flow"
                  />
                  {bonusScatterCells.map((c, idx) => (
                    <circle
                      key={`pyr_${idx}`}
                      cx={c.col * 100 + 50}
                      cy={c.row * 100 + 50}
                      r="9"
                      fill="#f59e0b"
                      stroke="#fef08a"
                      strokeWidth="2.5"
                    />
                  ))}
                </g>
              )}

              {/* Standard Horizontal & Diagonal Payline Connections */}
              {winningLines.map((winLine) => {
                const points = winLine.cells
                  .map((c) => `${c.col * 100 + 50},${c.row * 100 + 50}`)
                  .join(' ');
                const midCell =
                  winLine.cells[Math.floor(winLine.cells.length / 2)] || winLine.cells[0];
                const badgeX = midCell ? midCell.col * 100 + 50 : 250;
                const badgeY = midCell ? midCell.row * 100 + 50 : 150;

                return (
                  <g key={winLine.lineId}>
                    {/* Outer Golden Glow Aura */}
                    <polyline
                      points={points}
                      fill="none"
                      stroke="rgba(245, 158, 11, 0.55)"
                      strokeWidth="18"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Main Solid Golden Beam */}
                    <polyline
                      points={points}
                      fill="none"
                      stroke="url(#slotGoldLineGrad)"
                      strokeWidth="6.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Animated Flowing White-Gold Energy Dashes */}
                    <polyline
                      points={points}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2.8"
                      strokeDasharray="14 10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="animate-win-line-flow"
                    />
                    {/* Glowing Nodes at Each Matched Symbol Center */}
                    {winLine.cells.map((c, idx) => (
                      <g key={idx}>
                        <circle
                          cx={c.col * 100 + 50}
                          cy={c.row * 100 + 50}
                          r="12"
                          fill="rgba(250, 204, 21, 0.3)"
                          stroke="#fde047"
                          strokeWidth="2.5"
                        />
                        <circle
                          cx={c.col * 100 + 50}
                          cy={c.row * 100 + 50}
                          r="5.5"
                          fill="#fef08a"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                      </g>
                    ))}
                    {/* Multiplier Tag on Winning Line */}
                    <g transform={`translate(${badgeX}, ${Math.max(24, badgeY - 26)})`}>
                      <rect
                        x="-36"
                        y="-12"
                        width="72"
                        height="22"
                        rx="8"
                        fill="#1c0d02"
                        stroke="#fde047"
                        strokeWidth="2"
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        fill="#fef08a"
                        fontSize="12"
                        fontWeight="900"
                      >
                        x{winLine.baseMultiplier * activeMultiplier}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* GRAND PHARAOH JACKPOT FULLSCREEN FRAMER MOTION OVERLAY */}
        <AnimatePresence>
          {jackpotHitOverlay && jackpotHitOverlay.active && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setJackpotHitOverlay(null)}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 text-center cursor-pointer overflow-hidden backdrop-blur-md"
            >
              {/* Rotating Golden Sunburst Beam in background */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                className="pointer-events-none absolute h-[600px] w-[600px] sm:h-[900px] sm:w-[900px] rounded-full opacity-40"
                style={{
                  background: 'conic-gradient(from 0deg, #facc15 0deg, transparent 30deg, #f59e0b 60deg, transparent 90deg, #facc15 120deg, transparent 150deg, #fbbf24 180deg, transparent 210deg, #facc15 240deg, transparent 270deg, #f59e0b 300deg, transparent 330deg, #facc15 360deg)'
                }}
              />

              {/* Pulsing Golden Core Halo */}
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.7, 0.35] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute h-[320px] w-[320px] sm:h-[500px] sm:w-[500px] rounded-full bg-gradient-radial from-yellow-300/60 via-amber-500/20 to-transparent blur-3xl"
              />

              {/* Coin Fireworks / Golden Sparks particles */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 42 }).map((_, i) => {
                  const angle = (i / 42) * 2 * Math.PI;
                  const distance = 160 + (i % 6) * 45;
                  const targetX = Math.cos(angle) * distance;
                  const targetY = Math.sin(angle) * distance;
                  const coinSymbol = i % 4 === 0 ? '🪙' : i % 4 === 1 ? '👑' : i % 4 === 2 ? '💎' : '✨';
                  return (
                    <motion.div
                      key={i}
                      initial={{ x: 0, y: 0, opacity: 0, scale: 0.2 }}
                      animate={{
                        x: [0, targetX, targetX * 1.3],
                        y: [0, targetY, targetY * 1.3 + 120],
                        opacity: [0, 1, 0],
                        scale: [0.2, 1.4, 0.8],
                        rotate: [0, (i % 2 === 0 ? 360 : -360)]
                      }}
                      transition={{
                        duration: 2.2 + (i % 5) * 0.3,
                        repeat: Infinity,
                        delay: (i % 7) * 0.18,
                        ease: 'easeOut'
                      }}
                      className="absolute left-1/2 top-1/2 text-2xl sm:text-3xl select-none"
                    >
                      {coinSymbol}
                    </motion.div>
                  );
                })}
              </div>

              {/* Main Epic Card with Framer Motion Bounce & Shimmer */}
              <motion.div
                initial={{ scale: 0.3, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', damping: 14, stiffness: 180 }}
                className="relative z-10 max-w-sm sm:max-w-md w-full rounded-3xl border-4 border-yellow-300 bg-gradient-to-b from-[#2b1603] via-[#1a0e05] to-[#0d0703] px-6 py-8 shadow-[0_0_80px_rgba(250,204,21,0.9),inset_0_0_40px_rgba(245,158,11,0.5)] text-center"
              >
                {/* 5 Golden Anubis Masks Row */}
                <motion.div
                  animate={{ y: [-4, 4, -4] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex items-center justify-center gap-2 mb-3"
                >
                  {[0, 1, 2, 3, 4].map((mIdx) => (
                    <motion.div
                      key={mIdx}
                      initial={{ scale: 0 }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ delay: mIdx * 0.12, duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }}
                      className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl border-2 border-yellow-300 bg-gradient-to-b from-amber-500/40 to-slate-950/90 shadow-[0_0_20px_rgba(250,204,21,0.85)]"
                    >
                      <SlotSymbolSvg symbolId="mask" isHighlighted={true} />
                    </motion.div>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-yellow-300 drop-shadow-[0_2px_8px_rgba(0,0,0,1)]"
                >
                  ⚡ САКРАЛЬНАЯ КОМБИНАЦИЯ • 5 МАСОК АНУБИСА ⚡
                </motion.div>

                <motion.h1
                  animate={{
                    textShadow: [
                      '0 0 20px rgba(250,204,21,0.8), 0 0 40px rgba(245,158,11,0.6)',
                      '0 0 35px rgba(255,255,255,1), 0 0 60px rgba(250,204,21,1)',
                      '0 0 20px rgba(250,204,21,0.8), 0 0 40px rgba(245,158,11,0.6)'
                    ]
                  }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="mt-2 text-2xl sm:text-4xl font-black uppercase tracking-wider text-white"
                >
                  ГРАНД ДЖЕКПОТ ФАРАОНА!
                </motion.h1>

                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="mt-4 rounded-2xl border-2 border-yellow-300 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 p-3 sm:p-4 text-3xl sm:text-5xl font-black text-slate-950 tabular-nums shadow-[0_0_30px_rgba(250,204,21,0.9)]"
                >
                  +{jackpotHitOverlay.amount.toLocaleString()} {jackpotHitOverlay.currency === 'gold' ? '🪙' : '💎'}
                </motion.div>

                <div className="mt-4 text-[11px] font-bold text-yellow-200/90 leading-relaxed">
                  Все 5 масок Анубиса заполнили центральную линию! Весь накопительный банк пирамиды принадлежит вам.
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setJackpotHitOverlay(null)}
                  className="mt-6 w-full rounded-2xl border-2 border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-700 py-3 text-sm sm:text-base font-black uppercase tracking-wider text-slate-950 shadow-[0_0_30px_rgba(250,204,21,0.8)] cursor-pointer"
                >
                  💰 ЗАБРАТЬ ВЕЛИКИЙ КУШ 💰
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BIG WIN COIN BURST OVERLAY */}
        {bigWinOverlay && bigWinOverlay.active && !jackpotHitOverlay && (
          <div onClick={() => setBigWinOverlay(null)} className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 p-4 text-center cursor-pointer">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 28 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute text-lg sm:text-xl animate-bounce select-none"
                  style={{
                    left: `${8 + ((i * 37) % 84)}%`,
                    top: `${10 + ((i * 29) % 78)}%`,
                    animationDelay: `${(i % 7) * 90}ms`,
                    animationDuration: `${650 + (i % 4) * 140}ms`
                  }}
                >
                  {i % 3 === 0 ? '🪙' : i % 3 === 1 ? '💰' : '✨'}
                </span>
              ))}
            </div>

            <div className="relative z-10 rounded-2xl border-2 border-yellow-300 bg-gradient-to-b from-amber-600 via-amber-900 to-slate-950 px-6 py-4 shadow-[0_0_40px_rgba(250,204,21,0.9)]">
              <div className="text-xs font-black uppercase tracking-widest text-yellow-200">
                👑 СОКРОВИЩА ФАРАОНА • BIG WIN! 👑
              </div>
              <div className="mt-1 text-2xl sm:text-3xl font-black text-white tabular-nums drop-shadow">
                +{bigWinOverlay.amount.toLocaleString()} {bigWinOverlay.currency === 'gold' ? '🪙' : '💎'}
              </div>
              <div className="mt-2 text-[9px] font-bold text-amber-200/80">
                Нажмите, чтобы продолжить
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. GAMBLE / RISK BUTTON (X2 DOUBLE-UP) & WIN FEEDBACK */}
      <div className="flex flex-col gap-1.5">
        {lastWinMessage && (
          <div
            className={`rounded-xl border px-3 py-1.5 text-center text-[10px] font-black ${
              lastWinAmount > 0
                ? 'border-yellow-400 bg-amber-950/80 text-yellow-200 shadow-[0_0_14px_rgba(250,204,21,0.3)]'
                : 'border-slate-800 bg-slate-900/90 text-slate-300'
            }`}
          >
            {lastWinMessage}
          </div>
        )}

        {/* Flashing Double-Up Gamble Button */}
        {gambleAvailableAmount > 0 && !isAnySpinning && (
          <button
            type="button"
            onClick={handleOpenGambleModal}
            className="w-full rounded-xl border-2 border-yellow-300 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 py-2 px-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(245,158,11,0.8)] animate-pulse hover:brightness-110 active:scale-95 cursor-pointer"
          >
            ⚡ РИСКНУТЬ (x2): Удвоить {gambleAvailableAmount.toLocaleString()} {currency === 'gold' ? '🪙' : '💎'}!
          </button>
        )}

        {/* PHARAOH'S SACRED LOAN (Фараонов Долг Анубиса) */}
        {hero.gold <= 0 && !pharaohLoanActive && (
          <div className="rounded-xl border-2 border-cyan-400 bg-gradient-to-r from-slate-950 via-cyan-950/80 to-slate-950 p-2.5 shadow-[0_0_18px_rgba(6,182,212,0.5)] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase text-cyan-300 flex items-center gap-1">
                <span>🏛️</span>
                <span>ФАРАОНОВ ДОЛГ АНУБИСА</span>
              </div>
              <div className="text-[8.5px] text-slate-300 leading-tight mt-0.5">
                Баланс иссяк? Статуя Анубиса дарует священный заем +500 🪙 раз в день для возврата в игру!
              </div>
            </div>
            <button
              type="button"
              onClick={handleClaimPharaohLoan}
              className="shrink-0 rounded-xl border border-cyan-300 bg-gradient-to-b from-cyan-400 to-blue-700 px-3 py-1.5 text-[9px] font-black uppercase text-slate-950 shadow hover:brightness-110 active:scale-95 cursor-pointer animate-pulse"
            >
              Взять 500 🪙
            </button>
          </div>
        )}

        {pharaohLoanActive && (
          <div className="rounded-xl border border-amber-500/60 bg-amber-950/40 px-3 py-1.5 flex items-center justify-between text-[8.5px]">
            <span className="font-bold text-amber-300">
              🏛️ Священный долг Анубису: <strong className="text-yellow-300">{pharaohLoanDebt} 🪙</strong>
            </span>
            <span className="text-slate-400">
              (Списывается до 50% от выигрышей)
            </span>
          </div>
        )}

        {/* BLESSING OF THE GODS: BLESSING OF RA (Благословение Ра — динамическая золотая строка на месте удаленного алтаря) */}
        <div
          className={`relative overflow-hidden flex items-center justify-between gap-2.5 rounded-xl border-2 px-3 py-2 transition-all duration-300 ${
            raBlessingBonus.active
              ? 'border-yellow-300 bg-gradient-to-r from-[#381d04] via-[#5c3206] to-[#381d04] shadow-[0_0_26px_rgba(250,204,21,0.75),inset_0_1px_0_rgba(254,249,195,0.65)]'
              : 'border-amber-500/45 bg-gradient-to-r from-[#170e06] via-[#241508] to-[#170e06] shadow-inner'
          }`}
        >
          {raBlessingBonus.active && (
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(253,224,71,0.28)_0%,rgba(245,158,11,0.12)_50%,transparent_80%)] animate-pulse"
              aria-hidden="true"
            />
          )}

          <div className="relative z-10 flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-300 ${
                raBlessingBonus.active
                  ? 'border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 text-slate-950 shadow-[0_0_18px_rgba(253,224,71,0.95)] scale-105'
                  : 'border-amber-500/50 bg-gradient-to-b from-amber-900/70 to-slate-950 text-amber-300'
              }`}
            >
              <span className={`text-lg leading-none ${raBlessingBonus.active ? 'animate-spin' : ''}`} style={{ animationDuration: '9s' }}>
                ☀️
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[9.5px] font-black uppercase tracking-wider ${
                    raBlessingBonus.active ? 'text-yellow-200 drop-shadow' : 'text-amber-300'
                  }`}
                >
                  𓇳 БЛАГОСЛОВЕНИЕ РА
                </span>
                {raBlessingBonus.active ? (
                  <span className="rounded-md border border-yellow-200 bg-gradient-to-r from-yellow-300 to-amber-400 px-1.5 py-0.2 text-[7.5px] font-black uppercase text-slate-950 shadow-[0_0_10px_rgba(250,204,21,0.9)] animate-pulse">
                    ДАР БОГОВ АКТИВЕН!
                  </span>
                ) : (
                  <span className="rounded bg-amber-950/90 border border-amber-600/40 px-1.5 py-0.2 text-[7px] font-bold uppercase text-amber-300/80">
                    Случайный дар перед спином
                  </span>
                )}
              </div>
              <div
                className={`text-[8px] mt-0.5 leading-snug ${
                  raBlessingBonus.active ? 'text-yellow-100 font-bold' : 'text-amber-100/70'
                }`}
              >
                {raBlessingBonus.active
                  ? `✨ Солнечное сияние Ра озарило барабаны: следующая победа увеличена на +${raBlessingBonus.bonusPct}%!`
                  : 'С небольшим шансом пробуждается перед спином и дарует солнечный бонус к следующей победе'}
              </div>
            </div>
          </div>

          <div
            className={`relative z-10 shrink-0 rounded-xl border px-2.5 py-1.5 text-center transition-all ${
              raBlessingBonus.active
                ? 'border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 text-slate-950 shadow-[0_0_16px_rgba(250,204,21,0.85)]'
                : 'border-amber-700/45 bg-[#120b05] text-amber-300/80'
            }`}
          >
            <div className="text-[7px] font-black uppercase tracking-wider leading-none opacity-85">
              {raBlessingBonus.active ? 'БОНУС РА' : 'ШАНС ДАРА'}
            </div>
            <div className="mt-0.5 text-[11px] font-black tabular-nums leading-none">
              {raBlessingBonus.active ? `+${raBlessingBonus.bonusPct}%` : '+50..100%'}
            </div>
          </div>
        </div>
      </div>

      {/* 6. MOBILE SLOT CONTROL CONSOLE */}
      <div className="rounded-2xl border-2 border-amber-500/70 bg-gradient-to-b from-[#221309] via-[#120b07] to-[#090604] p-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.9)]">
        <div className="flex items-stretch justify-between gap-2">
          {/* Left & Center: Balance/Win and Bet panel */}
          <div className="flex flex-1 flex-col justify-between gap-2 min-w-0">
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-xl border border-amber-500/40 bg-slate-950/90 px-2.5 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[7.5px] font-black uppercase text-slate-400">БАЛАНС</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isAnySpinning}
                      onClick={() => {
                        setCurrency('gold');
                        setBetIndex(2);
                      }}
                      className={`rounded px-1.5 py-0.5 text-[8px] font-black cursor-pointer ${
                        currency === 'gold' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🪙
                    </button>
                    <button
                      type="button"
                      disabled={isAnySpinning}
                      onClick={() => {
                        setCurrency('crystals');
                        setBetIndex(2);
                      }}
                      className={`rounded px-1.5 py-0.5 text-[8px] font-black cursor-pointer ${
                        currency === 'crystals' ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      💎
                    </button>
                  </div>
                </div>
                <div className="mt-0.5 truncate text-xs sm:text-sm font-black text-amber-300 tabular-nums">
                  {maxBalance.toLocaleString()} {currency === 'gold' ? '🪙' : '💎'}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/40 bg-slate-950/90 px-2.5 py-1.5">
                <div className="text-[7.5px] font-black uppercase text-slate-400">ВЫИГРЫШ</div>
                <div className={`mt-0.5 truncate text-xs sm:text-sm font-black tabular-nums ${lastWinAmount > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>
                  +{lastWinAmount.toLocaleString()} {currency === 'gold' ? '🪙' : '💎'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-slate-950/95 p-1.5">
              <button
                type="button"
                disabled={isAnySpinning || betIndex <= 0 || freeSpinsLeft > 0}
                onClick={handleDecreaseBet}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/60 bg-gradient-to-b from-slate-800 to-slate-950 text-base font-black text-amber-300 hover:border-amber-300 active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                −
              </button>

              <div className="flex-1 text-center min-w-0">
                <div className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">
                  {freeSpinsLeft > 0 ? 'FREE SPIN' : 'СТАВКА'}
                </div>
                <div className="truncate text-xs sm:text-sm font-black text-white tabular-nums">
                  {freeSpinsLeft > 0 ? 'БЕСПЛАТНО' : `${currentBet.toLocaleString()} ${currency === 'gold' ? '🪙' : '💎'}`}
                </div>
              </div>

              <button
                type="button"
                disabled={isAnySpinning || betIndex >= betSteps.length - 1 || freeSpinsLeft > 0}
                onClick={handleIncreaseBet}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/60 bg-gradient-to-b from-slate-800 to-slate-950 text-base font-black text-amber-300 hover:border-amber-300 active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                +
              </button>

              <button
                type="button"
                disabled={isAnySpinning || freeSpinsLeft > 0}
                onClick={handleMaxBet}
                className="h-9 shrink-0 rounded-lg border border-amber-400/80 bg-gradient-to-b from-amber-700 to-amber-950 px-2.5 text-[9px] font-black uppercase tracking-wider text-yellow-200 hover:brightness-110 active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                MAX BET
              </button>
            </div>
          </div>

          {/* Large SPIN Button */}
          <button
            type="button"
            disabled={isAnySpinning || (freeSpinsLeft === 0 && currentBet > maxBalance)}
            onClick={handleSpinSlots}
            className={`relative flex w-24 sm:w-28 shrink-0 flex-col items-center justify-center rounded-2xl border-[3px] transition-all cursor-pointer select-none ${
              isAnySpinning
                ? 'border-amber-500/50 bg-slate-900 text-amber-300/70'
                : freeSpinsLeft > 0
                ? 'border-cyan-300 bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-700 text-slate-950 shadow-[0_0_26px_rgba(6,182,212,0.8)] animate-pulse'
                : 'border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-700 text-slate-950 shadow-[0_0_24px_rgba(250,204,21,0.7),inset_0_2px_0_rgba(255,255,255,0.65)] hover:brightness-105 active:scale-95'
            } disabled:opacity-45`}
          >
            <span className="text-xl sm:text-2xl leading-none">{isAnySpinning ? '⏳' : freeSpinsLeft > 0 ? '🎁' : '🔄'}</span>
            <span className="mt-1 text-sm sm:text-base font-black uppercase tracking-wider leading-none">
              {freeSpinsLeft > 0 ? 'FREE' : 'SPIN'}
            </span>
            <span className="mt-0.5 text-[7.5px] font-extrabold opacity-85">
              {isAnySpinning ? 'КРУТИМ...' : freeSpinsLeft > 0 ? `СПИН (${freeSpinsLeft})` : 'СТАРТ'}
            </span>
          </button>
        </div>

        {/* Compact Paytable Legend */}
        <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-1 border-t border-slate-800/90 pt-2 text-[8px]">
          {SLOT_SYMBOLS.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-800/90 bg-slate-950/80 px-1.5 py-1">
              <span className="font-black text-amber-200 truncate">{s.shortLabel}</span>
              <span className="font-mono font-bold text-emerald-300 tabular-nums ml-1">x{s.pay5}</span>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: GAMBLE / RISK GAME (X2 DOUBLE UP WITH PHARAOH'S BOWLS & CARDS)
         ========================================================================= */}
      {isGambleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border-2 border-yellow-300 bg-gradient-to-b from-[#241306] via-[#150a04] to-black p-4 shadow-[0_0_35px_rgba(250,204,21,0.5)]">
            <div className="flex items-center justify-between border-b border-amber-500/40 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">⚖️</span>
                <span className="text-sm font-black uppercase tracking-wider text-yellow-300">
                  РИСК-ИГРА ФАРАОНА (x2)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsGambleModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-3 text-center">
              <div className="text-[10px] font-black uppercase text-amber-300">
                Текущий куш на кону:
              </div>
              <div className="text-2xl font-black text-white tabular-nums mt-0.5">
                {gambleAvailableAmount.toLocaleString()} {currency === 'gold' ? '🪙' : '💎'}
              </div>
              <div className="text-[9px] text-slate-400 mt-1">
                Угадайте Чашу Фараона или Цвет Карты. Верный выбор умножит выигрыш в 2 раза!
              </div>

              {/* Two Pharaoh Bowls / Card Choices */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={gambleResultState === 'lost' || gambleAvailableAmount <= 0}
                  onClick={() => handleChooseGambleChoice('gold')}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-amber-400 bg-gradient-to-b from-amber-600 to-amber-950 p-3 hover:brightness-110 active:scale-95 cursor-pointer disabled:opacity-40"
                >
                  <span className="text-3xl">🏺</span>
                  <span className="mt-1 text-xs font-black text-yellow-200">ЗОЛОТАЯ ЧАША</span>
                  <span className="text-[8px] text-amber-300 font-bold">(Красная масть)</span>
                </button>

                <button
                  type="button"
                  disabled={gambleResultState === 'lost' || gambleAvailableAmount <= 0}
                  onClick={() => handleChooseGambleChoice('turquoise')}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-cyan-400 bg-gradient-to-b from-cyan-700 to-slate-950 p-3 hover:brightness-110 active:scale-95 cursor-pointer disabled:opacity-40"
                >
                  <span className="text-3xl">🏺</span>
                  <span className="mt-1 text-xs font-black text-cyan-200">НЕФРИТОВАЯ ЧАША</span>
                  <span className="text-[8px] text-cyan-300 font-bold">(Чёрная масть)</span>
                </button>
              </div>

              {/* History */}
              {gambleHistory.length > 0 && (
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/80 p-1.5 text-[8.5px] font-bold text-slate-300">
                  {gambleHistory.join(' → ')}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-amber-500/30 pt-3">
              <button
                type="button"
                onClick={handleCollectGambleWin}
                className="w-full rounded-xl border border-emerald-400 bg-gradient-to-r from-emerald-600 to-teal-700 py-2.5 text-xs font-black uppercase text-white shadow hover:brightness-110 active:scale-95 cursor-pointer"
              >
                💰 ЗАБРАТЬ КУШ ({gambleAvailableAmount.toLocaleString()} {currency === 'gold' ? '🪙' : '💎'})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: DAILY LUCK TOURNAMENT LEADERBOARD
         ========================================================================= */}
      {isTournamentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-[#251408] via-[#140a04] to-black p-4 shadow-[0_0_35px_rgba(245,158,11,0.5)]">
            <div className="flex items-center justify-between border-b border-amber-500/40 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">🏆</span>
                <span className="text-sm font-black uppercase tracking-wider text-amber-300">
                  ТУРНИР УДАЧИ (ТОП ВЫИГРЫШЕЙ)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsTournamentModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-2.5 space-y-1.5 max-h-72 overflow-y-auto">
              <div className="text-[9px] text-slate-400 mb-1">
                Рейтинг обновляется каждые 24 часа. Топовые игроки дня получают призовые награды в золоте и кристаллах!
              </div>

              {tournamentWinners.map((record, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-[9.5px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-amber-400 tabular-nums">#{idx + 1}</span>
                    <span className="font-bold text-white truncate max-w-[120px]">{record.nick}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-emerald-300 tabular-nums">
                      +{record.winAmount.toLocaleString()} {record.currency === 'gold' ? '🪙' : '💎'}
                    </span>
                    <span className="text-[7.5px] text-slate-400 block">
                      Ставка: {record.bet} ({record.multiplier}X)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-amber-500/30 pt-2.5">
              <button
                type="button"
                onClick={() => setIsTournamentModalOpen(false)}
                className="w-full rounded-xl border border-amber-500/60 bg-slate-900 py-2 text-xs font-black uppercase text-amber-200 hover:bg-slate-800 cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* МОДАЛКА 3: ИСТОРИЯ СПИНОВ (ПОСЛЕДНИЕ 10 ВРАЩЕНИЙ)                 */}
      {/* ================================================================= */}
      {isSpinHistoryModalOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3"
          onClick={() => setIsSpinHistoryModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border-2 border-amber-500/70 bg-gradient-to-b from-slate-950 via-[#1a1308] to-slate-950 p-4 shadow-[0_0_50px_rgba(245,158,11,0.4)] animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">📜</span>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-amber-300 block">
                    ИСТОРИЯ СПИНОВ
                  </span>
                  <span className="text-[9px] text-slate-400">
                    Последние {spinHistory.length} из 10 вращений игрока
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSpinHistoryModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer px-1.5 py-0.5"
              >
                ✕
              </button>
            </div>

            <div className="py-2.5 space-y-1.5 max-h-72 overflow-y-auto">
              {spinHistory.length === 0 ? (
                <div className="py-8 text-center text-[11px] font-bold text-slate-400">
                  История пуста. Сделайте первый спин! 🎰
                </div>
              ) : (
                spinHistory.map((item) => {
                  const isPositive = item.outcome === 'win' || item.outcome === 'bonus' || item.outcome === 'jackpot';
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between rounded-xl border px-2.5 py-2 text-[10px] transition ${
                        item.outcome === 'jackpot'
                          ? 'border-amber-400/80 bg-amber-950/60 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                          : item.outcome === 'bonus'
                            ? 'border-yellow-500/60 bg-yellow-950/40'
                            : item.outcome === 'win'
                              ? 'border-emerald-500/50 bg-emerald-950/30'
                              : 'border-slate-800 bg-slate-950/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">
                          {item.outcome === 'jackpot'
                            ? '👑'
                            : item.outcome === 'bonus'
                              ? '🔺'
                              : item.outcome === 'win'
                                ? '✨'
                                : '💨'}
                        </span>
                        <div className="min-w-0">
                          <div
                            className={`font-black truncate ${
                              item.outcome === 'jackpot'
                                ? 'text-amber-300'
                                : item.outcome === 'bonus'
                                  ? 'text-yellow-300'
                                  : item.outcome === 'win'
                                    ? 'text-emerald-300'
                                    : 'text-slate-400'
                            }`}
                          >
                            {item.label}
                          </div>
                          <div className="text-[8px] text-slate-400 flex items-center gap-1.5">
                            <span>{item.time}</span>
                            <span>•</span>
                            <span>
                              Ставка: {item.bet} {item.currency === 'gold' ? '🪙' : '💎'}
                            </span>
                            {item.multiplier > 1 && (
                              <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[7.5px] font-black text-amber-300">
                                {item.multiplier}X
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        {isPositive ? (
                          <span className="font-black text-emerald-300 tabular-nums text-[11px]">
                            +{item.winAmount.toLocaleString()} {item.currency === 'gold' ? '🪙' : '💎'}
                          </span>
                        ) : (
                          <span className="font-bold text-rose-400/80 tabular-nums text-[10px]">
                            -{item.bet.toLocaleString()} {item.currency === 'gold' ? '🪙' : '💎'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-amber-500/30 pt-2.5 flex items-center gap-2">
              {spinHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSpinHistory([]);
                    try {
                      localStorage.removeItem('pharaoh_slots_spin_history_v1');
                    } catch {
                      // ignore
                    }
                  }}
                  className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-[10px] font-bold uppercase text-rose-300 hover:bg-rose-900/50 cursor-pointer"
                >
                  Очистить
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSpinHistoryModalOpen(false)}
                className="flex-1 rounded-xl border border-amber-500/60 bg-slate-900 py-2 text-xs font-black uppercase text-amber-200 hover:bg-slate-800 cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. «КОСТИ АНУБИСА» (DICE)
// ============================================================================
type DicePredictionType =
  | 'over7'
  | 'under7'
  | 'exact7'
  | 'even'
  | 'odd'
  | 'double'
  | 'exact';

interface DiceOption {
  id: DicePredictionType;
  label: string;
  desc: string;
  multiplier: number;
}

const DICE_OPTIONS: DiceOption[] = [
  { id: 'over7', label: 'Больше 7 (8–12)', desc: 'Сумма > 7', multiplier: 2.2 },
  { id: 'under7', label: 'Меньше 7 (2–6)', desc: 'Сумма < 7', multiplier: 2.2 },
  { id: 'exact7', label: 'Ровно 7 (𓂀)', desc: 'Сумма = 7', multiplier: 5.5 },
  { id: 'even', label: 'Чётное число', desc: '2, 4, 6, 8, 10, 12', multiplier: 1.95 },
  { id: 'odd', label: 'Нечётное число', desc: '3, 5, 7, 9, 11', multiplier: 1.95 },
  { id: 'double', label: 'Дубль костей', desc: '1-1, 2-2 ... 6-6', multiplier: 5.5 }
];

const EXACT_SUM_MULTIPLIERS: Record<number, number> = {
  2: 32,
  3: 16,
  4: 10.5,
  5: 8,
  6: 6.5,
  7: 5.5,
  8: 6.5,
  9: 8,
  10: 10.5,
  11: 16,
  12: 32
};

const DICE_FACES: Record<number, string> = {
  1: '⚀',
  2: '⚁',
  3: '⚂',
  4: '⚃',
  5: '⚄',
  6: '⚅'
};

export const AnubisDiceGameView: React.FC<SubGameCommonProps> = ({
  hero,
  onGamblingTransaction
}) => {
  const [currency, setCurrency] = useState<'gold' | 'crystals'>('gold');
  const [betAmount, setBetAmount] = useState<string>('50');
  const [prediction, setPrediction] = useState<DicePredictionType>('over7');
  const [exactTarget, setExactTarget] = useState<number>(7);
  const [rolling, setRolling] = useState(false);
  const [dice, setDice] = useState<[number, number]>([4, 5]);
  const [lastResult, setLastResult] = useState<{
    d1: number;
    d2: number;
    sum: number;
    won: boolean;
    payout: number;
    currency: 'gold' | 'crystals';
    text: string;
  } | null>(null);
  const [history, setHistory] = useState<
    Array<{ id: string; sum: number; d1: number; d2: number; won: boolean; payout: number; currency: 'gold' | 'crystals' }>
  >([]);

  const MAX_DICE_BET = 10000;
  const activeMultiplier =
    prediction === 'exact'
      ? EXACT_SUM_MULTIPLIERS[exactTarget] || 5.5
      : DICE_OPTIONS.find((o) => o.id === prediction)?.multiplier || 2;

  const parsedBet = Math.max(1, Math.floor(Number(betAmount) || 0));
  const maxBalance = currency === 'gold' ? hero.gold : hero.crystals;
  const potentialWin = Math.floor(parsedBet * activeMultiplier);

  const handleRollDice = () => {
    if (rolling) return;
    if (parsedBet <= 0) return;
    if (parsedBet > MAX_DICE_BET) {
      setLastResult({
        d1: dice[0],
        d2: dice[1],
        sum: dice[0] + dice[1],
        won: false,
        payout: 0,
        currency,
        text: `❌ Максимальная ставка в Костях Анубиса — ${MAX_DICE_BET.toLocaleString()} ${currency === 'gold' ? '🪙' : '💎'}!`
      });
      return;
    }
    if (parsedBet > maxBalance) {
      setLastResult({
        d1: dice[0],
        d2: dice[1],
        sum: dice[0] + dice[1],
        won: false,
        payout: 0,
        currency,
        text: currency === 'gold' ? '❌ Недостаточно золота для ставки!' : '❌ Недостаточно кристаллов для ставки!'
      });
      return;
    }

    const lockedCurrency = currency;
    const lockedBet = parsedBet;
    const lockedMultiplier = activeMultiplier;
    const lockedPrediction = prediction;
    const lockedExactTarget = exactTarget;
    const curIcon = lockedCurrency === 'gold' ? '🪙' : '💎';

    // Immediately deduct stake from player's balance when placing the bet
    onGamblingTransaction({
      gameName: 'Кости Анубиса',
      spentGold: lockedCurrency === 'gold' ? lockedBet : 0,
      wonGold: 0,
      spentCrystals: lockedCurrency === 'crystals' ? lockedBet : 0,
      wonCrystals: 0,
      countGame: false
    });

    playClickSound();
    setRolling(true);
    setLastResult(null);

    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      setDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ]);
      if (ticks >= 12) {
        clearInterval(interval);
        const finalD1 = Math.floor(Math.random() * 6) + 1;
        const finalD2 = Math.floor(Math.random() * 6) + 1;
        const sum = finalD1 + finalD2;
        setDice([finalD1, finalD2]);

        let isWin = false;
        if (lockedPrediction === 'over7') isWin = sum > 7;
        else if (lockedPrediction === 'under7') isWin = sum < 7;
        else if (lockedPrediction === 'exact7') isWin = sum === 7;
        else if (lockedPrediction === 'even') isWin = sum % 2 === 0;
        else if (lockedPrediction === 'odd') isWin = sum % 2 !== 0;
        else if (lockedPrediction === 'double') isWin = finalD1 === finalD2;
        else if (lockedPrediction === 'exact') isWin = sum === lockedExactTarget;

        const winPayout = isWin ? Math.floor(lockedBet * lockedMultiplier) : 0;

        if (isWin) {
          playLootSound();
        } else {
          playCoinSound();
        }

        // Only credit payout if won; if lost, nothing is returned
        onGamblingTransaction({
          gameName: 'Кости Анубиса',
          spentGold: 0,
          wonGold: isWin && lockedCurrency === 'gold' ? winPayout : 0,
          spentCrystals: 0,
          wonCrystals: isWin && lockedCurrency === 'crystals' ? winPayout : 0,
          countGame: true,
          logText: isWin
            ? `🎲 Кости Анубиса: выпало ${finalD1}+${finalD2}=${sum}! Выигрыш +${winPayout} ${curIcon} (x${lockedMultiplier})`
            : `🎲 Кости Анубиса: выпало ${finalD1}+${finalD2}=${sum}. Ставка ${lockedBet} ${curIcon} не сыграла.`
        });

        setLastResult({
          d1: finalD1,
          d2: finalD2,
          sum,
          won: isWin,
          payout: winPayout,
          currency: lockedCurrency,
          text: isWin
            ? `🎉 Победа! Выпало ${finalD1} + ${finalD2} = ${sum}. Выигрыш: +${winPayout.toLocaleString()} ${curIcon}`
            : `💀 Проигрыш! Выпало ${finalD1} + ${finalD2} = ${sum}. Ставка ${lockedBet.toLocaleString()} ${curIcon} не возвращается.`
        });

        setHistory((prev) => [
          {
            id: `${Date.now()}_${Math.random()}`,
            sum,
            d1: finalD1,
            d2: finalD2,
            won: isWin,
            payout: winPayout,
            currency: lockedCurrency
          },
          ...prev.slice(0, 9)
        ]);
        setRolling(false);
      }
    }, 75);
  };

  return (
    <div className="space-y-2.5">
      {/* Header & Egyptian Lore */}
      <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-slate-900 to-purple-950/50 p-2.5 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
            <span>🎲 Кости Анубиса (Египетский покер на костях)</span>
          </div>
          <div className="text-[9.5px] text-slate-300 mt-0.5">
            Выберите валюту (Золото или Кристаллы), укажите ставку и сделайте прогноз на сумму двух священных кубиков (от 2 до 12).
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] text-slate-400">Коэффициент:</div>
          <div className="text-sm font-black text-emerald-400">x{activeMultiplier}</div>
        </div>
      </div>

      {/* Animated Dice Table */}
      <div className="relative rounded-2xl border-2 border-amber-500/50 bg-[radial-gradient(circle_at_center,#2e1a0f_0%,#090d16_100%)] p-3.5 text-center shadow-inner overflow-hidden">
        <div className="text-[9px] font-bold uppercase tracking-widest text-amber-400/80 mb-2">
          𓂀 Алтарь Судьбы Анубиса 𓂀
        </div>
        <div className="flex items-center justify-center gap-5 my-1">
          {[dice[0], dice[1]].map((val, idx) => (
            <div
              key={idx}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-amber-900/90 via-slate-900 to-slate-950 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-transform ${
                rolling ? 'animate-bounce scale-110 border-yellow-300' : ''
              }`}
            >
              <span className="text-4xl sm:text-5xl leading-none text-amber-300 select-none">
                {DICE_FACES[val] || '⚄'}
              </span>
              <span className="text-[9px] font-black text-amber-200 mt-0.5">{val}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-slate-950/90 px-3 py-1 text-xs font-black text-amber-300">
          <span>Сумма костей:</span>
          <span className="text-base text-white">{dice[0] + dice[1]}</span>
          {dice[0] === dice[1] && (
            <span className="rounded bg-purple-900/80 px-1.5 py-0.5 text-[9px] text-purple-200 border border-purple-400/50">
              ДУБЛЬ!
            </span>
          )}
        </div>

        {lastResult && (
          <div
            className={`mt-2.5 rounded-xl border px-3 py-1.5 text-[11px] font-black ${
              lastResult.won
                ? 'border-emerald-400 bg-emerald-950/70 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'border-rose-500/60 bg-rose-950/60 text-rose-200'
            }`}
          >
            {lastResult.text}
          </div>
        )}
      </div>

      {/* Currency & Bet Input */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 space-y-1.5">
          <div className="text-[10px] font-black uppercase text-slate-400">1. Валюта ставки:</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCurrency('gold');
                setBetAmount('50');
              }}
              className={`rounded-lg border py-1.5 px-2 text-xs font-black transition-all cursor-pointer ${
                currency === 'gold'
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              🪙 Золото ({hero.gold.toLocaleString()})
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrency('crystals');
                setBetAmount('5');
              }}
              className={`rounded-lg border py-1.5 px-2 text-xs font-black transition-all cursor-pointer ${
                currency === 'crystals'
                  ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200 shadow'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              💎 Кристаллы ({hero.crystals.toLocaleString()})
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
            <span>2. Сумма ставки (макс. {MAX_DICE_BET.toLocaleString()} {currency === 'gold' ? '🪙' : '💎'}):</span>
            <span className="text-emerald-300">
              Возможный выигрыш: +{potentialWin.toLocaleString()} {currency === 'gold' ? '🪙' : '💎'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={Math.min(MAX_DICE_BET, maxBalance)}
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-black text-white outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={() => setBetAmount(String(Math.min(MAX_DICE_BET, Math.max(1, Math.floor(parsedBet * 2)))))}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] font-black text-amber-300 hover:bg-slate-700 cursor-pointer shrink-0"
            >
              x2
            </button>
            <button
              type="button"
              onClick={() => setBetAmount(String(Math.min(MAX_DICE_BET, Math.max(1, Math.floor(maxBalance / 2)))))}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] font-black text-cyan-300 hover:bg-slate-700 cursor-pointer shrink-0"
            >
              1/2
            </button>
            <button
              type="button"
              onClick={() => setBetAmount(String(Math.min(MAX_DICE_BET, maxBalance)))}
              className="rounded-lg border border-amber-500/50 bg-amber-950/60 px-2 py-1.5 text-[10px] font-black text-amber-200 hover:bg-amber-900 cursor-pointer shrink-0"
            >
              MAX
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {[50, 100, 500, 1000, 5000, 10000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setBetAmount(String(Math.min(preset, maxBalance)))}
                className={`rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-[8.5px] font-bold hover:border-slate-700 cursor-pointer ${
                  parsedBet === preset ? 'text-amber-300 border-amber-400/60 bg-amber-950/40' : 'text-slate-400'
                }`}
              >
                {preset.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prediction Selector */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 space-y-2">
        <div className="text-[10px] font-black uppercase text-slate-400">
          3. Выберите прогноз исхода броска:
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {DICE_OPTIONS.map((opt) => {
            const active = prediction === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPrediction(opt.id)}
                className={`rounded-xl border p-2 text-left transition-all cursor-pointer ${
                  active
                    ? 'border-amber-400 bg-gradient-to-br from-amber-500/25 to-purple-900/40 text-white shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'border-slate-800 bg-slate-950/90 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10.5px] font-black text-amber-300">{opt.label}</span>
                  <span className="rounded bg-emerald-950 border border-emerald-500/50 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                    x{opt.multiplier}
                  </span>
                </div>
                <div className="text-[8.5px] text-slate-400 mt-0.5">{opt.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Exact Sum Selector (2..12) */}
        <div className="pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9.5px] font-bold text-purple-300">
              🎯 Или угадайте точное значение суммы (повышенный коэффициент до x32):
            </span>
          </div>
          <div className="grid grid-cols-11 gap-1">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
              const isSelected = prediction === 'exact' && exactTarget === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setPrediction('exact');
                    setExactTarget(num);
                  }}
                  className={`rounded-lg border py-1 text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-purple-400 bg-purple-600/30 text-white font-black shadow'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="text-[10px] font-black">{num}</div>
                  <div className="text-[7.5px] text-emerald-400 font-bold">
                    x{EXACT_SUM_MULTIPLIERS[num]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Roll Button */}
      <button
        type="button"
        disabled={rolling || parsedBet <= 0 || maxBalance < parsedBet}
        onClick={handleRollDice}
        className="w-full rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:brightness-110 active:scale-98 disabled:opacity-40 cursor-pointer"
      >
        {rolling
          ? '🎲 Кости Анубиса вращаются...'
          : `🎲 Бросить кости (Ставка: ${parsedBet.toLocaleString()} ${currency === 'gold' ? '🪙' : '💎'} ➔ Выигрыш: ${potentialWin.toLocaleString()} ${currency === 'gold' ? '🪙' : '💎'})`}
      </button>

      {/* Recent Rolls History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-2">
          <div className="text-[9px] font-bold uppercase text-slate-400 mb-1">
            Последние броски:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((h) => (
              <span
                key={h.id}
                className={`rounded-lg border px-2 py-0.5 text-[9px] font-bold ${
                  h.won
                    ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                {h.d1}+{h.d2}={h.sum}{' '}
                {h.won ? `(+${h.payout}${h.currency === 'gold' ? '🪙' : '💎'})` : '(—)'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. «КЛАССИЧЕСКАЯ РУЛЕТКА (1–36)» (EUROPEAN ROULETTE)
// ============================================================================
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);

function getNumberColor(n: number): 'green' | 'red' | 'black' {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

const MAX_ROULETTE_BET = 5000;
const ROULETTE_ROUND_SECONDS = 2 * 60; // 2 минуты ожидания до розыгрыша

interface RoulettePlacedBet {
  key: string;
  label: string;
  amount: number;
  multiplier: number;
}

function doesRouletteBetMatch(key: string, rolled: number): boolean {
  if (key.startsWith('num_')) {
    return rolled === Number(key.replace('num_', ''));
  }
  if (rolled === 0) return false;
  if (key === 'doz_1') return rolled >= 1 && rolled <= 12;
  if (key === 'doz_2') return rolled >= 13 && rolled <= 24;
  if (key === 'doz_3') return rolled >= 25 && rolled <= 36;
  if (key === 'low_1_18') return rolled >= 1 && rolled <= 18;
  if (key === 'high_19_36') return rolled >= 19 && rolled <= 36;
  if (key === 'even') return rolled % 2 === 0;
  if (key === 'odd') return rolled % 2 !== 0;
  if (key === 'red') return RED_NUMBERS.has(rolled);
  if (key === 'black') return !RED_NUMBERS.has(rolled);
  return false;
}

export const ClassicRouletteGameView: React.FC<SubGameCommonProps> = ({
  hero,
  currentUser,
  onGamblingTransaction
}) => {
  const storageKey = `piramida_roulette36_v2_${(currentUser || 'guest').toLowerCase()}`;

  const [betCurrency, setBetCurrency] = useState<'gold' | 'crystals'>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.betCurrency === 'crystals' || parsed.betCurrency === 'gold') {
          return parsed.betCurrency;
        }
      }
    } catch {}
    return 'gold';
  });

  const [chipValue, setChipValue] = useState<number>(100);

  const [placedBets, setPlacedBets] = useState<Record<string, RoulettePlacedBet>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.placedBets && typeof parsed.placedBets === 'object') {
          return parsed.placedBets;
        }
      }
    } catch {}
    return {};
  });

  const [roundDeadline, setRoundDeadline] = useState<number>(() => {
    const maxDl = Date.now() + ROULETTE_ROUND_SECONDS * 1000;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.roundDeadline === 'number' && parsed.roundDeadline > Date.now()) {
          return Math.min(maxDl, parsed.roundDeadline);
        }
      }
    } catch {}
    return maxDl;
  });

  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    Math.min(
      ROULETTE_ROUND_SECONDS,
      Math.max(0, Math.ceil((roundDeadline - Date.now()) / 1000))
    )
  );

  // Key of a placed bet currently picked up to move ("переставить") to another number/sector
  const [movingBetKey, setMovingBetKey] = useState<string | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [rolledNumber, setRolledNumber] = useState<number | null>(null);
  const [spinResultText, setSpinResultText] = useState<{
    won: boolean;
    text: string;
  } | null>(null);
  const [recentNumbers, setRecentNumbers] = useState<number[]>([17, 32, 0, 7, 23, 14]);

  // Live balance ref so rapid chip clicks cannot exceed balance before state flushes
  const liveBalanceRef = useRef<{ gold: number; crystals: number }>({
    gold: hero.gold,
    crystals: hero.crystals
  });
  useEffect(() => {
    liveBalanceRef.current = {
      gold: hero.gold,
      crystals: hero.crystals
    };
  }, [hero.gold, hero.crystals]);

  const betsList: RoulettePlacedBet[] = Object.keys(placedBets).map((k) => placedBets[k]);
  const totalStaked = betsList.reduce((acc, b) => acc + b.amount, 0);
  const curIcon = betCurrency === 'gold' ? '🪙' : '💎';
  const remainingLimit = Math.max(0, MAX_ROULETTE_BET - totalStaked);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          betCurrency,
          placedBets,
          roundDeadline
        })
      );
    } catch {}
  }, [storageKey, betCurrency, placedBets, roundDeadline]);

  const placeChipOn = (
    key: string,
    label: string,
    multiplier: number,
    forceAddChip: boolean = false
  ) => {
    if (spinning) return;

    // 1. If a bet is currently selected to be moved ("переставить") and user clicks a DIFFERENT number/sector:
    // Move the staked amount to the new number/sector without charging player's balance again!
    if (movingBetKey && placedBets[movingBetKey] && movingBetKey !== key && !forceAddChip) {
      const sourceBet = placedBets[movingBetKey];
      playClickSound();
      setPlacedBets((prev) => {
        const next = { ...prev };
        delete next[movingBetKey];
        const existingTarget = next[key];
        next[key] = {
          key,
          label,
          amount: (existingTarget?.amount || 0) + sourceBet.amount,
          multiplier
        };
        return next;
      });
      setMovingBetKey(null);
      setSpinResultText({
        won: true,
        text: `🔄 Ставка ${sourceBet.amount.toLocaleString()} ${curIcon} успешно переставлена с «${sourceBet.label}» на «${label}»!`
      });
      return;
    }

    // 2. If user clicks on a number/sector that ALREADY has a bet and no bet is being moved yet:
    // Select this bet for moving ("переставить") so their next click on any other number moves it there!
    // (Clicking the same number a second time or clicking "+Добавить фишку" will add another chip to it).
    if (!forceAddChip && !movingBetKey && placedBets[key] && placedBets[key].amount > 0) {
      playClickSound();
      setMovingBetKey(key);
      setSpinResultText({
        won: true,
        text: `🔄 Выбрана ставка на «${label}» (${placedBets[key].amount.toLocaleString()} ${curIcon}). Нажмите на ЛЮБУЮ другую цифру/сектор, чтобы переставить ставку туда (или нажмите ещё раз на «${label}», чтобы добавить фишку).`
      });
      return;
    }

    // Clear moving state if user clicked the same number again to add another chip
    if (movingBetKey === key) {
      setMovingBetKey(null);
    }

    if (totalStaked >= MAX_ROULETTE_BET) {
      setSpinResultText({
        won: false,
        text: `⚠️ Максимальная ставка в рулетке — ${MAX_ROULETTE_BET.toLocaleString()} ${curIcon} (${
          betCurrency === 'gold' ? 'золота' : 'кристаллов'
        })!`
      });
      return;
    }

    const actualChip = Math.min(chipValue, MAX_ROULETTE_BET - totalStaked);
    if (actualChip <= 0) return;

    const availableBalance =
      betCurrency === 'gold' ? liveBalanceRef.current.gold : liveBalanceRef.current.crystals;

    if (availableBalance < actualChip) {
      setSpinResultText({
        won: false,
        text:
          betCurrency === 'gold'
            ? `❌ Недостаточно золота на балансе (нужно ${actualChip.toLocaleString()} 🪙)!`
            : `❌ Недостаточно кристаллов на балансе (нужно ${actualChip.toLocaleString()} 💎)!`
      });
      return;
    }

    const wasTableEmpty = totalStaked <= 0;

    // Immediately deduct chip amount from player's account when placing the bet
    if (betCurrency === 'gold') {
      liveBalanceRef.current.gold = Math.max(0, liveBalanceRef.current.gold - actualChip);
    } else {
      liveBalanceRef.current.crystals = Math.max(0, liveBalanceRef.current.crystals - actualChip);
    }

    onGamblingTransaction({
      gameName: 'Классическая Рулетка (1–36)',
      spentGold: betCurrency === 'gold' ? actualChip : 0,
      wonGold: 0,
      spentCrystals: betCurrency === 'crystals' ? actualChip : 0,
      wonCrystals: 0,
      countGame: false
    });

    playClickSound();
    setSpinResultText(null);

    // Start the 2-minute countdown to the draw when the first bet is placed on the table
    if (wasTableEmpty) {
      const nextDl = Date.now() + ROULETTE_ROUND_SECONDS * 1000;
      setRoundDeadline(nextDl);
      setSecondsLeft(ROULETTE_ROUND_SECONDS);
    }

    setPlacedBets((prev) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          key,
          label,
          amount: (existing?.amount || 0) + actualChip,
          multiplier
        }
      };
    });
  };

  const handleLaunchRoulette = () => {
    if (spinning) return;
    if (betsList.length === 0 || totalStaked <= 0) {
      setSpinResultText({
        won: false,
        text: '⚠️ Сначала разместите фишки на игровом поле (на числа, цвет или чётность)!'
      });
      return;
    }

    const snapshotBets = [...betsList];
    const snapshotTotalStaked = totalStaked;
    const snapshotCurrency = betCurrency;
    const snapshotIcon = snapshotCurrency === 'gold' ? '🪙' : '💎';

    playClickSound();
    setMovingBetKey(null);
    setSpinning(true);
    setSpinResultText(null);

    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
      setRolledNumber(Math.floor(Math.random() * 37));
      if (ticks >= 18) {
        clearInterval(interval);
        const finalNum = Math.floor(Math.random() * 37);
        const finalColor = getNumberColor(finalNum);
        setRolledNumber(finalNum);
        setRecentNumbers((prev) => [finalNum, ...prev.slice(0, 11)]);

        let totalPayout = 0;
        const winningLabels: string[] = [];
        for (const bet of snapshotBets) {
          if (doesRouletteBetMatch(bet.key, finalNum)) {
            const winAmt = Math.floor(bet.amount * bet.multiplier);
            totalPayout += winAmt;
            winningLabels.push(`${bet.label} (+${winAmt}${snapshotIcon})`);
          }
        }

        const colorName =
          finalColor === 'red' ? '🔴 Красное' : finalColor === 'black' ? '⚫ Чёрное' : '🟢 Зеро';

        // Immediately clear all placed bets from the board after win or loss so sectors stop glowing!
        setPlacedBets({});
        setMovingBetKey(null);
        const nextDl = Date.now() + ROULETTE_ROUND_SECONDS * 1000;
        setRoundDeadline(nextDl);
        setSecondsLeft(ROULETTE_ROUND_SECONDS);
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              betCurrency: snapshotCurrency,
              placedBets: {},
              roundDeadline: nextDl
            })
          );
        } catch {}

        if (totalPayout > 0) {
          playLootSound();
        } else {
          playCoinSound();
        }

        // Stake was already deducted when placing chips; only credit winnings if won
        onGamblingTransaction({
          gameName: 'Классическая Рулетка (1–36)',
          spentGold: 0,
          wonGold: snapshotCurrency === 'gold' ? totalPayout : 0,
          spentCrystals: 0,
          wonCrystals: snapshotCurrency === 'crystals' ? totalPayout : 0,
          countGame: true,
          logText:
            totalPayout > 0
              ? `🎯 Рулетка (1–36): выпало число ${finalNum} (${colorName})! Выигрыш: +${totalPayout} ${snapshotIcon} (Ставка: ${snapshotTotalStaked} ${snapshotIcon})`
              : `🎯 Рулетка (1–36): выпало число ${finalNum} (${colorName}). Ставка ${snapshotTotalStaked} ${snapshotIcon} не сыграла.`
        });

        setSpinResultText({
          won: totalPayout > 0,
          text:
            totalPayout > 0
              ? `🎉 Выпало ${finalNum} (${colorName})! Сыграли ставки: ${winningLabels.join(', ')}. Выигрыш зачислен: +${totalPayout.toLocaleString()} ${snapshotIcon}!`
              : `💀 Выпало ${finalNum} (${colorName}). Ставка (${snapshotTotalStaked.toLocaleString()} ${snapshotIcon}) проиграла и не возвращается.`
        });
        setSpinning(false);
      }
    }, 80);
  };

  // 2-Minute Spin Round Timer (counts down when bets are placed and automatically launches draw at 00:00)
  const launchRef = useRef(handleLaunchRoulette);
  launchRef.current = handleLaunchRoulette;
  const stakedRef = useRef(totalStaked);
  stakedRef.current = totalStaked;
  const spinningRef = useRef(spinning);
  spinningRef.current = spinning;

  useEffect(() => {
    const t = setInterval(() => {
      if (spinningRef.current) return;
      if (stakedRef.current <= 0) {
        setSecondsLeft(ROULETTE_ROUND_SECONDS);
        return;
      }
      const rem = Math.max(0, Math.ceil((roundDeadline - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem <= 0) {
        launchRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [roundDeadline]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-red-950/60 via-slate-900 to-emerald-950/50 p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black text-amber-300 flex items-center gap-2">
            <span>🎯 Классическая Рулетка Фараона (0–36)</span>
            <span className="rounded-full bg-amber-500/20 border border-amber-400/50 px-2 py-0.5 text-[9.5px] text-amber-200">
              Макс. ставка: 5 000 🪙 / 5 000 💎
            </span>
          </div>
          <div className="text-[9.5px] text-slate-300 mt-0.5">
            Ставка снимается сразу. Розыгрыш через 2 мин после ставки — до крутки вы можете переставить фишку на любую другую цифру!
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="rounded-lg border border-amber-500/40 bg-slate-950/90 px-2.5 py-1 text-center">
            <div className="text-[8.5px] uppercase text-slate-400 font-bold">
              {totalStaked > 0 ? 'До розыгрыша (2 мин):' : 'Таймер розыгрыша:'}
            </div>
            <div
              className={`text-xs font-black font-mono ${
                totalStaked > 0 ? 'text-emerald-300 animate-pulse' : 'text-amber-300'
              }`}
            >
              ⏱️ {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-slate-400">Ставка (лимит 5 000):</div>
            <div
              className={`text-sm font-black ${
                betCurrency === 'gold' ? 'text-amber-300' : 'text-cyan-300'
              }`}
            >
              {totalStaked.toLocaleString()} / {MAX_ROULETTE_BET.toLocaleString()} {curIcon}
            </div>
          </div>
        </div>
      </div>

      {/* Wheel Display + Last Numbers + Currency & Chip Selector */}
      <div className="rounded-2xl border-2 border-amber-500/50 bg-[radial-gradient(circle_at_center,#1e1b2e_0%,#090d16_100%)] p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center font-black shadow-xl transition-transform ${
              spinning ? 'animate-spin border-amber-400' : 'border-amber-500/80'
            } ${
              rolledNumber === null
                ? 'bg-slate-900 text-amber-300'
                : getNumberColor(rolledNumber) === 'red'
                ? 'bg-red-700 text-white'
                : getNumberColor(rolledNumber) === 'black'
                ? 'bg-slate-950 text-white'
                : 'bg-emerald-700 text-white'
            }`}
          >
            <span className="text-xl leading-none">{rolledNumber !== null ? rolledNumber : '🎯'}</span>
            <span className="text-[8px] uppercase mt-0.5">
              {rolledNumber === null
                ? 'Рулетка'
                : getNumberColor(rolledNumber) === 'red'
                ? 'Красное'
                : getNumberColor(rolledNumber) === 'black'
                ? 'Чёрное'
                : 'Зеро'}
            </span>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-amber-300">
              {spinning ? 'Шарик вращается по колесу...' : 'История выпавших чисел:'}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {recentNumbers.map((n, i) => {
                const c = getNumberColor(n);
                return (
                  <span
                    key={i}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                      c === 'red'
                        ? 'bg-red-700 border-red-400 text-white'
                        : c === 'black'
                        ? 'bg-slate-950 border-slate-600 text-slate-200'
                        : 'bg-emerald-700 border-emerald-400 text-white'
                    }`}
                  >
                    {n}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Currency Switcher + Chip Selector */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase text-slate-400">Валюта ставки:</span>
            <button
              type="button"
              disabled={spinning || totalStaked > 0}
              onClick={() => {
                setBetCurrency('gold');
                setChipValue(100);
                setSpinResultText(null);
              }}
              title={
                totalStaked > 0
                  ? 'Завершите крутку с текущими ставками для смены валюты'
                  : 'Ставить золотом (макс. 5000)'
              }
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer disabled:opacity-40 ${
                betCurrency === 'gold'
                  ? 'border-amber-400 bg-amber-500 text-slate-950 shadow-sm'
                  : 'border-slate-700 bg-slate-900 text-amber-300 hover:border-amber-500/60'
              }`}
            >
              🪙 Золото ({hero.gold.toLocaleString()})
            </button>
            <button
              type="button"
              disabled={spinning || totalStaked > 0}
              onClick={() => {
                setBetCurrency('crystals');
                setChipValue(50);
                setSpinResultText(null);
              }}
              title={
                totalStaked > 0
                  ? 'Завершите крутку с текущими ставками для смены валюты'
                  : 'Ставить кристаллами (макс. 5000)'
              }
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-black transition-all cursor-pointer disabled:opacity-40 ${
                betCurrency === 'crystals'
                  ? 'border-cyan-300 bg-cyan-500 text-slate-950 shadow-sm'
                  : 'border-slate-700 bg-slate-900 text-cyan-300 hover:border-cyan-500/60'
              }`}
            >
              💎 Кристаллы ({hero.crystals.toLocaleString()})
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1">
            <span className="text-[9px] font-bold uppercase text-slate-400 mr-1">
              Фишка ({curIcon}):
            </span>
            {[10, 50, 100, 500, 1000, 2500, 5000].map((val) => (
              <button
                key={val}
                type="button"
                disabled={spinning}
                onClick={() => setChipValue(val)}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-black transition-all cursor-pointer ${
                  chipValue === val
                    ? betCurrency === 'gold'
                      ? 'border-amber-300 bg-amber-500 text-slate-950 scale-105 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                      : 'border-cyan-200 bg-cyan-400 text-slate-950 scale-105 shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                    : 'border-slate-700 bg-slate-900 text-amber-300 hover:border-amber-500/60'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Bets & Re-place ("Переставить") Control Panel */}
      {betsList.length > 0 && (
        <div className="rounded-xl border border-cyan-500/50 bg-slate-900/95 p-2.5 space-y-2 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-black text-cyan-300 flex items-center gap-1.5">
              <span>🔄 Ваши ставки на столе (можно переставить на другую цифру до розыгрыша):</span>
            </div>
            {movingBetKey && placedBets[movingBetKey] ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={spinning}
                  onClick={() => {
                    const b = placedBets[movingBetKey];
                    if (b) placeChipOn(b.key, b.label, b.multiplier, true);
                  }}
                  className="rounded-lg border border-emerald-400 bg-emerald-600/30 px-2 py-0.5 text-[9.5px] font-black text-emerald-200 hover:bg-emerald-600/50 cursor-pointer"
                >
                  ➕ Добавить +{chipValue} {curIcon} на «{placedBets[movingBetKey].label}»
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMovingBetKey(null);
                    setSpinResultText(null);
                  }}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-0.5 text-[9.5px] font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  ✕ Отмена перестановки
                </button>
              </div>
            ) : (
              betsList.length === 1 && (
                <button
                  type="button"
                  disabled={spinning}
                  onClick={() => {
                    const onlyBet = betsList[0];
                    setMovingBetKey(onlyBet.key);
                    setSpinResultText({
                      won: true,
                      text: `🔄 Выбрана ставка «${onlyBet.label}» (${onlyBet.amount.toLocaleString()} ${curIcon}). Нажмите на любую другую цифру на поле, чтобы переставить её туда!`
                    });
                  }}
                  className="rounded-lg border border-cyan-400 bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-black text-cyan-200 hover:bg-cyan-500/35 cursor-pointer animate-pulse"
                >
                  🔄 Переставить ставку на другую цифру
                </button>
              )
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {betsList.map((b) => {
              const isMovingThis = movingBetKey === b.key;
              return (
                <div
                  key={b.key}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold transition-all ${
                    isMovingThis
                      ? 'border-cyan-300 bg-cyan-900/70 text-white ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
                      : 'border-amber-500/40 bg-slate-950 text-amber-200'
                  }`}
                >
                  <span>
                    {b.label}: <strong>{b.amount.toLocaleString()} {curIcon}</strong> (x{b.multiplier})
                  </span>
                  <button
                    type="button"
                    disabled={spinning}
                    onClick={() => {
                      if (isMovingThis) {
                        setMovingBetKey(null);
                        setSpinResultText(null);
                      } else {
                        setMovingBetKey(b.key);
                        setSpinResultText({
                          won: true,
                          text: `🔄 Выбрана ставка «${b.label}» (${b.amount.toLocaleString()} ${curIcon}). Нажмите на любую другую цифру или сектор на поле, чтобы переставить её туда!`
                        });
                      }
                    }}
                    className={`rounded px-1.5 py-0.5 text-[9px] font-black cursor-pointer transition-colors ${
                      isMovingThis
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-cyan-950 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-800'
                    }`}
                  >
                    {isMovingThis ? '👉 Выберите новую цифру...' : '🔄 Переставить'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {spinResultText && (
        <div
          className={`rounded-xl border px-3 py-2 text-[11px] font-black ${
            spinResultText.won
              ? 'border-emerald-400 bg-emerald-950/75 text-emerald-200'
              : 'border-rose-500/60 bg-rose-950/60 text-rose-200'
          }`}
        >
          {spinResultText.text}
        </div>
      )}

      {/* Roulette Betting Board (0 + 1..36 + Dozens + 1:1 Outside Bets) */}
      <div className="rounded-2xl border border-amber-500/40 bg-slate-950/95 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400 px-1">
          <span>
            {movingBetKey && placedBets[movingBetKey]
              ? `🔄 РЕЖИМ ПЕРЕСТАНОВКИ: нажмите на любую цифру, чтобы перенести туда ${placedBets[movingBetKey].amount} ${curIcon} с «${placedBets[movingBetKey].label}»`
              : 'Нажмите на цифру для ставки (повторное нажатие на цифру со ставкой позволяет переставить её)'}
          </span>
          <span className="font-bold text-amber-300">
            Доступно до лимита: {remainingLimit.toLocaleString()} {curIcon}
          </span>
        </div>

        {/* Zero Button */}
        <button
          type="button"
          disabled={spinning}
          onClick={() => placeChipOn('num_0', 'Число 0 (Зеро)', 36)}
          className={`w-full rounded-lg border py-1.5 text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
            movingBetKey === 'num_0'
              ? 'border-cyan-300 bg-cyan-800/90 text-white ring-2 ring-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.7)]'
              : placedBets['num_0']
              ? 'border-amber-300 bg-emerald-800/90 text-white shadow-[0_0_12px_rgba(251,191,36,0.5)]'
              : 'border-emerald-500/70 bg-emerald-900/60 hover:bg-emerald-800/70 text-emerald-200'
          }`}
        >
          <span>🟢 0 — ЗЕРО (Коэффициент x36)</span>
          {placedBets['num_0'] && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-slate-950">
              {placedBets['num_0'].amount} {curIcon}{' '}
              {movingBetKey === 'num_0' ? '🔄 Переставить' : ''}
            </span>
          )}
        </button>

        {/* Numbers 1..36 Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {Array.from({ length: 36 }, (_, idx) => idx + 1).map((num) => {
            const color = getNumberColor(num);
            const betKey = `num_${num}`;
            const staked = placedBets[betKey]?.amount || 0;
            const isMovingSource = movingBetKey === betKey;
            return (
              <button
                key={num}
                type="button"
                disabled={spinning}
                onClick={() => placeChipOn(betKey, `Число ${num}`, 36)}
                className={`relative rounded-lg border py-1.5 text-center transition-transform active:scale-95 cursor-pointer ${
                  color === 'red'
                    ? 'border-red-500/60 bg-red-900/70 hover:bg-red-800 text-white'
                    : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
                } ${
                  isMovingSource
                    ? 'ring-2 ring-cyan-300 border-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.8)] scale-105'
                    : staked > 0
                    ? 'ring-2 ring-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                    : ''
                }`}
              >
                <div className="text-[11px] font-black">{num}</div>
                {staked > 0 && (
                  <div
                    className={`mt-0.5 mx-auto w-fit rounded-full px-1 text-[8px] font-black leading-tight ${
                      isMovingSource ? 'bg-cyan-300 text-slate-950' : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {isMovingSource ? '🔄 ' : ''}
                    {staked}
                    {curIcon}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Dozens (x3) */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {[
            { key: 'doz_1', label: '1-я Дюжина (1–12)' },
            { key: 'doz_2', label: '2-я Дюжина (13–24)' },
            { key: 'doz_3', label: '3-я Дюжина (25–36)' }
          ].map((d) => {
            const staked = placedBets[d.key]?.amount || 0;
            const isMovingSource = movingBetKey === d.key;
            return (
              <button
                key={d.key}
                type="button"
                disabled={spinning}
                onClick={() => placeChipOn(d.key, d.label, 3)}
                className={`rounded-lg border py-1.5 px-2 text-[10px] font-black flex items-center justify-between cursor-pointer transition-all ${
                  isMovingSource
                    ? 'border-cyan-300 bg-cyan-900/70 text-white ring-2 ring-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                    : staked > 0
                    ? 'border-amber-300 bg-purple-900/70 text-white shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                    : 'border-purple-500/50 bg-purple-950/40 hover:bg-purple-900/50 text-purple-200'
                }`}
              >
                <span>{d.label} (x3)</span>
                {staked > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 text-[8.5px] text-slate-950">
                    {isMovingSource ? '🔄 ' : ''}
                    {staked}
                    {curIcon}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Outside Bets (x2): 1-18, Even, Red, Black, Odd, 19-36 */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
          {[
            {
              key: 'low_1_18',
              label: '1–18 (Малые)',
              cls: 'border-slate-700 bg-slate-900 text-slate-200'
            },
            {
              key: 'even',
              label: 'ЧЁТНОЕ',
              cls: 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200'
            },
            {
              key: 'red',
              label: '🔴 КРАСНОЕ',
              cls: 'border-red-500/70 bg-red-900/70 text-white'
            },
            {
              key: 'black',
              label: '⚫ ЧЁРНОЕ',
              cls: 'border-slate-600 bg-slate-950 text-white'
            },
            {
              key: 'odd',
              label: 'НЕЧЁТНОЕ',
              cls: 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200'
            },
            {
              key: 'high_19_36',
              label: '19–36 (Большие)',
              cls: 'border-slate-700 bg-slate-900 text-slate-200'
            }
          ].map((out) => {
            const staked = placedBets[out.key]?.amount || 0;
            const isMovingSource = movingBetKey === out.key;
            return (
              <button
                key={out.key}
                type="button"
                disabled={spinning}
                onClick={() => placeChipOn(out.key, out.label, 2)}
                className={`rounded-lg border py-2 px-2 text-[10px] font-black flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:brightness-110 ${
                  out.cls
                } ${
                  isMovingSource
                    ? 'ring-2 ring-cyan-300 border-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                    : staked > 0
                    ? 'ring-2 ring-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                    : ''
                }`}
              >
                <span>{out.label} (x2)</span>
                {staked > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 text-[8.5px] text-slate-950">
                    {isMovingSource ? '🔄 ' : ''}
                    {staked} {curIcon}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Draw Countdown Status Banner */}
      <div className="flex items-center gap-2">
        <div
          className={`w-full rounded-xl border-2 py-2.5 px-3 text-center text-xs sm:text-sm font-black uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.3)] ${
            spinning
              ? 'border-amber-400 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-600 text-white'
              : totalStaked > 0
              ? 'border-emerald-400 bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950 text-emerald-200'
              : 'border-slate-700 bg-slate-900/90 text-slate-400'
          }`}
        >
          {spinning
            ? '🎯 Колесо крутится... Идёт розыгрыш!'
            : totalStaked <= 0
            ? '🎯 Сделайте ставку на цифру или сектор (после ставки начнётся отсчёт 2 мин до розыгрыша)'
            : `⏳ Розыгрыш через ${String(mins).padStart(2, '0')}:${String(secs).padStart(
                2,
                '0'
              )} • На кону: ${totalStaked.toLocaleString()} ${curIcon} (можно переставить фишку на другую цифру)`}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. «БОИ СКАРАБЕЕВ» (ТОТАЛИЗАТОР)
// ============================================================================
export type ScarabArchetypeKey = 'сила' | 'ловкость' | 'броня' | 'крит' | 'яд';
export type ScarabRarity = 'Обычный' | 'Редкий' | 'Эпический' | 'Легендарный' | 'Мифический';

interface ScarabRarityConfig {
  rarity: ScarabRarity;
  label: string;
  badgeCls: string;
  levelMin: number;
  levelMax: number;
  bonusAtkMin: number;
  bonusAtkMax: number;
  bonusAgiMin: number;
  bonusAgiMax: number;
  bonusCritMin: number;
  bonusCritMax: number;
}

const SCARAB_RARITIES: ScarabRarityConfig[] = [
  {
    rarity: 'Обычный',
    label: 'Обычный',
    badgeCls: 'bg-slate-800 text-slate-300 border-slate-600',
    levelMin: 1,
    levelMax: 4,
    bonusAtkMin: 5,
    bonusAtkMax: 10,
    bonusAgiMin: 5,
    bonusAgiMax: 9,
    bonusCritMin: 4,
    bonusCritMax: 8
  },
  {
    rarity: 'Редкий',
    label: 'Редкий',
    badgeCls: 'bg-cyan-950 text-cyan-300 border-cyan-500/70',
    levelMin: 5,
    levelMax: 8,
    bonusAtkMin: 11,
    bonusAtkMax: 18,
    bonusAgiMin: 10,
    bonusAgiMax: 16,
    bonusCritMin: 9,
    bonusCritMax: 15
  },
  {
    rarity: 'Эпический',
    label: 'Эпический',
    badgeCls: 'bg-purple-950 text-purple-300 border-purple-500/70',
    levelMin: 9,
    levelMax: 12,
    bonusAtkMin: 19,
    bonusAtkMax: 28,
    bonusAgiMin: 17,
    bonusAgiMax: 24,
    bonusCritMin: 16,
    bonusCritMax: 24
  },
  {
    rarity: 'Легендарный',
    label: 'Легендарный',
    badgeCls: 'bg-amber-950 text-amber-300 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
    levelMin: 13,
    levelMax: 16,
    bonusAtkMin: 29,
    bonusAtkMax: 38,
    bonusAgiMin: 25,
    bonusAgiMax: 32,
    bonusCritMin: 25,
    bonusCritMax: 35
  },
  {
    rarity: 'Мифический',
    label: 'Мифический',
    badgeCls: 'bg-rose-950 text-rose-300 border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]',
    levelMin: 17,
    levelMax: 20,
    bonusAtkMin: 39,
    bonusAtkMax: 50,
    bonusAgiMin: 32,
    bonusAgiMax: 42,
    bonusCritMin: 36,
    bonusCritMax: 48
  }
];

interface ScarabFighter {
  id: 'scarab1' | 'scarab2';
  name: string;
  title: string;
  icon: string;
  colorCls: string;
  archetype: ScarabArchetypeKey;
  archetypeLabel: string;
  rarity: ScarabRarity;
  rarityLabel: string;
  rarityBadgeCls: string;
  level: number;
  bonusAtk: number;
  bonusAgility: number;
  bonusCrit: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  agility: number; // Ловкость: шанс уклонения от удара, контратаки и перехвата инициативы (+15% базовая)
  critPct: number; // Шанс критического удара (растет от редкости, наносит 2x урон)
  skillName: string;
  skillDesc: string;
  winProb: number;
  odds: number;
}

// Базовые пресеты с увеличенным на +15% базовым HP и +15% базовой ловкостью/уворотом
const SCARAB_PRESETS = [
  {
    name: 'Скарабей Рубиновый',
    title: 'Ярость Сета (Смертоносный титан)',
    icon: '🦀',
    colorCls: 'text-rose-400 border-rose-500/70',
    archetype: 'сила' as const,
    archetypeLabel: '🗡️ Силовик',
    baseHp: 290, // увеличено на +15% (было 250)
    baseAtk: 50,
    baseDef: 9,
    baseAgility: 18, // увеличено на +15% (было 14)
    baseCrit: 24,
    skillName: '🔥 Сокрушение Сета',
    skillDesc: 'Шанс пробивающего удара двойной силы'
  },
  {
    name: 'Скарабей Песчаный',
    title: 'Охотник Барханов (Мастер ловкости)',
    icon: '🦂',
    colorCls: 'text-amber-300 border-amber-500/70',
    archetype: 'ловкость' as const,
    archetypeLabel: '💨 Ловкач',
    baseHp: 250, // увеличено на +15% (было 215)
    baseAtk: 34,
    baseDef: 7,
    baseAgility: 44, // увеличено на +15% (было 36)
    baseCrit: 20,
    skillName: '💨 Песчаный мираж',
    skillDesc: 'Уклонение от ударов и быстрый контрудар'
  },
  {
    name: 'Скарабей Золотой',
    title: 'Страж Ра (Несокрушимый панцирь)',
    icon: '🪲',
    colorCls: 'text-yellow-300 border-yellow-500/70',
    archetype: 'броня' as const,
    archetypeLabel: '🛡️ Танк',
    baseHp: 370, // увеличено на +15% (было 320)
    baseAtk: 29,
    baseDef: 24,
    baseAgility: 14, // увеличено на +15% (было 10)
    baseCrit: 12,
    skillName: '🛡️ Солнечный барьер',
    skillDesc: 'Блокирует 50% входящего урона панцирем'
  },
  {
    name: 'Скарабей Обсидиановый',
    title: 'Жнец Анубиса (Ассасин теней)',
    icon: '🕷️',
    colorCls: 'text-purple-300 border-purple-500/70',
    archetype: 'крит' as const,
    archetypeLabel: '💥 Ассасин',
    baseHp: 255, // увеличено на +15% (было 220)
    baseAtk: 42,
    baseDef: 9,
    baseAgility: 26, // увеличено на +15% (было 22)
    baseCrit: 38,
    skillName: '💥 Смертельный выпад',
    skillDesc: 'Критический удар наносит 215% урона'
  },
  {
    name: 'Скарабей Изумрудный',
    title: 'Вестник Осириса (Токсичный мистик)',
    icon: '🪲',
    colorCls: 'text-emerald-300 border-emerald-500/70',
    archetype: 'яд' as const,
    archetypeLabel: '🧪 Травитель',
    baseHp: 305, // увеличено на +15% (было 265)
    baseAtk: 32,
    baseDef: 15,
    baseAgility: 22, // увеличено на +15% (было 18)
    baseCrit: 16,
    skillName: '🧪 Смертоносный яд',
    skillDesc: 'Отравляет врага ядом сквозь любую броню'
  },
  {
    name: 'Скарабей Сапфировый',
    title: 'Хранитель Нила (Вихревой охотник)',
    icon: '🦋',
    colorCls: 'text-cyan-300 border-cyan-500/70',
    archetype: 'ловкость' as const,
    archetypeLabel: '💨 Ловкач',
    baseHp: 265, // увеличено на +15% (было 230)
    baseAtk: 36,
    baseDef: 12,
    baseAgility: 38, // увеличено на +15% (было 32)
    baseCrit: 22,
    skillName: '🌊 Водный рывок',
    skillDesc: 'Высокая инициатива и серия быстрых атак'
  },
  {
    name: 'Скарабей Базальтовый',
    title: 'Глубинный Монолит (Колосс земли)',
    icon: '🪨',
    colorCls: 'text-slate-300 border-slate-500/70',
    archetype: 'броня' as const,
    archetypeLabel: '🛡️ Танк',
    baseHp: 390, // увеличено на +15% (было 340)
    baseAtk: 30,
    baseDef: 22,
    baseAgility: 12, // увеличено на +15% (было 9)
    baseCrit: 14,
    skillName: '🗿 Каменный панцирь',
    skillDesc: 'Поглощает удары и отражает шипами осколки'
  },
  {
    name: 'Скарабей Пепельный',
    title: 'Вихрь Хаоса (Огненный берсерк)',
    icon: '🔥',
    colorCls: 'text-orange-300 border-orange-500/70',
    archetype: 'сила' as const,
    archetypeLabel: '🗡️ Силовик',
    baseHp: 270, // увеличено на +15% (было 235)
    baseAtk: 48,
    baseDef: 10,
    baseAgility: 24, // увеличено на +15% (было 20)
    baseCrit: 25,
    skillName: '🌪️ Шквал когтей',
    skillDesc: 'Яростный шквал с шансом двойного удара'
  }
];

function rollRarityConfig(): ScarabRarityConfig {
  const r = Math.random();
  if (r < 0.22) return SCARAB_RARITIES[0]; // Обычный 22%
  if (r < 0.52) return SCARAB_RARITIES[1]; // Редкий 30%
  if (r < 0.80) return SCARAB_RARITIES[2]; // Эпический 28%
  if (r < 0.93) return SCARAB_RARITIES[3]; // Легендарный 13%
  return SCARAB_RARITIES[4];              // Мифический 7%
}

function generateScarabPair(): [ScarabFighter, ScarabFighter] {
  const shuffled = [...SCARAB_PRESETS].sort(() => Math.random() - 0.5);
  const p1 = shuffled[0];
  const p2 = shuffled[1];

  const r1 = rollRarityConfig();
  const lvl1 = Math.floor(Math.random() * (r1.levelMax - r1.levelMin + 1)) + r1.levelMin;
  const bonusAtk1 = Math.floor(Math.random() * (r1.bonusAtkMax - r1.bonusAtkMin + 1)) + r1.bonusAtkMin;
  const bonusAgi1 = Math.floor(Math.random() * (r1.bonusAgiMax - r1.bonusAgiMin + 1)) + r1.bonusAgiMin;
  const bonusCrit1 = Math.floor(Math.random() * (r1.bonusCritMax - r1.bonusCritMin + 1)) + r1.bonusCritMin;

  const r2 = rollRarityConfig();
  const lvl2 = Math.floor(Math.random() * (r2.levelMax - r2.levelMin + 1)) + r2.levelMin;
  const bonusAtk2 = Math.floor(Math.random() * (r2.bonusAtkMax - r2.bonusAtkMin + 1)) + r2.bonusAtkMin;
  const bonusAgi2 = Math.floor(Math.random() * (r2.bonusAgiMax - r2.bonusAgiMin + 1)) + r2.bonusAgiMin;
  const bonusCrit2 = Math.floor(Math.random() * (r2.bonusCritMax - r2.bonusCritMin + 1)) + r2.bonusCritMin;

  const hp1 = p1.baseHp + lvl1 * 8 + Math.floor(Math.random() * 16);
  const atk1 = p1.baseAtk + bonusAtk1;
  const def1 = p1.baseDef + Math.floor(lvl1 * 0.45);
  const agi1 = Math.min(65, p1.baseAgility + bonusAgi1);
  const crit1 = Math.min(75, p1.baseCrit + bonusCrit1 + Math.floor(lvl1 * 0.35));

  const hp2 = p2.baseHp + lvl2 * 8 + Math.floor(Math.random() * 16);
  const atk2 = p2.baseAtk + bonusAtk2;
  const def2 = p2.baseDef + Math.floor(lvl2 * 0.45);
  const agi2 = Math.min(65, p2.baseAgility + bonusAgi2);
  const crit2 = Math.min(75, p2.baseCrit + bonusCrit2 + Math.floor(lvl2 * 0.35));

  // Dynamic power rating calculation including strength, agility, armor, and 2x crits
  const power1 = hp1 * 0.42 + atk1 * 3.3 + def1 * 2.2 + agi1 * 3.1 + crit1 * 2.5;
  const power2 = hp2 * 0.42 + atk2 * 3.3 + def2 * 2.2 + agi2 * 3.1 + crit2 * 2.5;
  const totalPower = power1 + power2;

  const rawProb1 = power1 / totalPower;
  // Volatility compression so probabilities are competitive and neither side is guaranteed (30% - 70%)
  const prob1 = Math.min(0.70, Math.max(0.30, 0.5 + (rawProb1 - 0.5) * 0.85));
  const prob2 = 1 - prob1;

  // Bookmaker margin of ~8% for realistic totalizator odds
  const odds1 = Number(Math.max(1.30, Math.min(3.40, (0.92 / prob1))).toFixed(2));
  const odds2 = Number(Math.max(1.30, Math.min(3.40, (0.92 / prob2))).toFixed(2));

  return [
    {
      id: 'scarab1',
      name: p1.name,
      title: p1.title,
      icon: p1.icon,
      colorCls: p1.colorCls,
      archetype: p1.archetype,
      archetypeLabel: p1.archetypeLabel,
      rarity: r1.rarity,
      rarityLabel: r1.label,
      rarityBadgeCls: r1.badgeCls,
      level: lvl1,
      bonusAtk: bonusAtk1,
      bonusAgility: bonusAgi1,
      bonusCrit: bonusCrit1,
      hp: hp1,
      maxHp: hp1,
      atk: atk1,
      def: def1,
      agility: agi1,
      critPct: crit1,
      skillName: p1.skillName,
      skillDesc: p1.skillDesc,
      winProb: Math.round(prob1 * 100),
      odds: odds1
    },
    {
      id: 'scarab2',
      name: p2.name,
      title: p2.title,
      icon: p2.icon,
      colorCls: p2.colorCls,
      archetype: p2.archetype,
      archetypeLabel: p2.archetypeLabel,
      rarity: r2.rarity,
      rarityLabel: r2.label,
      rarityBadgeCls: r2.badgeCls,
      level: lvl2,
      bonusAtk: bonusAtk2,
      bonusAgility: bonusAgi2,
      bonusCrit: bonusCrit2,
      hp: hp2,
      maxHp: hp2,
      atk: atk2,
      def: def2,
      agility: agi2,
      critPct: crit2,
      skillName: p2.skillName,
      skillDesc: p2.skillDesc,
      winProb: Math.round(prob2 * 100),
      odds: odds2
    }
  ];
}

export const ScarabFightsTotalizatorView: React.FC<SubGameCommonProps> = ({
  hero,
  onGamblingTransaction
}) => {
  const [fighters, setFighters] = useState<[ScarabFighter, ScarabFighter]>(() => generateScarabPair());
  const [selectedFighter, setSelectedFighter] = useState<'scarab1' | 'scarab2'>('scarab1');
  const [betAmount, setBetAmount] = useState<string>('100');
  const [lockedBet, setLockedBet] = useState<{
    fighterId: 'scarab1' | 'scarab2';
    amount: number;
    odds: number;
    fighterName: string;
  } | null>(null);
  const [isFighting, setIsFighting] = useState(false);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [winnerResult, setWinnerResult] = useState<{
    winnerId: 'scarab1' | 'scarab2';
    winnerName: string;
    playerWon: boolean;
    payout: number;
    text: string;
  } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const period = 15 * 60;
    return period - (Math.floor(Date.now() / 1000) % period);
  });

  const fightIntervalRef = useRef<any>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 15 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      if (fightIntervalRef.current) clearInterval(fightIntervalRef.current);
    };
  }, []);

  const parsedBet = Math.max(1, Math.floor(Number(betAmount) || 0));
  const chosenScarab = fighters[selectedFighter === 'scarab1' ? 0 : 1];

  const handleLockBet = () => {
    if (isFighting || lockedBet) return;
    if (parsedBet <= 0 || parsedBet > hero.gold) {
      setCombatLog(['❌ Недостаточно золота на балансе для принятия ставки в тотализаторе!']);
      return;
    }
    playCoinSound();
    // Immediately deduct stake and record spent gold
    onGamblingTransaction({
      gameName: 'Бои Скарабеев (Ставка)',
      spentGold: parsedBet,
      wonGold: 0,
      countGame: false,
      logText: `🪲 Принята ставка ${parsedBet} 🪙 на бойца «${chosenScarab.name}» (x${chosenScarab.odds})`
    });
    setLockedBet({
      fighterId: selectedFighter,
      amount: parsedBet,
      odds: chosenScarab.odds,
      fighterName: chosenScarab.name
    });
    setWinnerResult(null);
    setCombatLog([
      `✅ Ваша ставка ${parsedBet.toLocaleString()} 🪙 на «${chosenScarab.name}» (коэф. x${chosenScarab.odds}) принята и списана со счёта! Нажмите «⚡ Начать бой сейчас», чтобы запустить поединок.`
    ]);
  };

  const startScarabBattle = () => {
    if (isFighting) return;
    if (!lockedBet) {
      setCombatLog(['⚠️ Сначала выберите одного из двух Скарабеев и нажмите «Сделать ставку»!']);
      return;
    }

    playClickSound();
    setIsFighting(true);
    setWinnerResult(null);

    let f1 = {
      ...fighters[0],
      hp: fighters[0].maxHp,
      enraged: false,
      blindTurns: 0
    };
    let f2 = {
      ...fighters[1],
      hp: fighters[1].maxHp,
      enraged: false,
      blindTurns: 0
    };
    setFighters([f1, f2]);
    setCombatLog([
      `⚔️ Гонг арены! «${f1.name}» [${f1.rarityLabel} Ур.${f1.level}] против «${f2.name}» [${f2.rarityLabel} Ур.${f2.level}] — смертельная битва началась!`
    ]);

    let turn = 0;
    fightIntervalRef.current = setInterval(() => {
      turn++;

      // Dynamic Initiative: Agility + random roll determines attacker tempo
      const initRoll1 = f1.agility * 1.5 + Math.random() * 45;
      const initRoll2 = f2.agility * 1.5 + Math.random() * 45;
      const attackerIsF1 = initRoll1 >= initRoll2;

      const atkScarab = attackerIsF1 ? f1 : f2;
      const defScarab = attackerIsF1 ? f2 : f1;

      // Handle Blindness (Ослепление песком арены)
      if (atkScarab.blindTurns > 0) {
        atkScarab.blindTurns--;
        const logLine = `🌪️ «${atkScarab.name}» ослеплён песчаной бурей и промахивается вслепую! (Ход потерян)`;
        setCombatLog((prev) => [logLine, ...prev.slice(0, 14)]);
        return;
      }

      // Check Evasion (Ловкость): Increased by +15% and boosted by rarity
      const evadeChance = Math.min(58, defScarab.agility);
      const isEvaded = Math.random() * 100 < evadeChance;

      let logLine = '';

      if (isEvaded) {
        // Defender successfully dodged!
        const counterRoll = Math.random() * 100 < defScarab.agility * 0.8;
        const blindRoll = Math.random() * 100 < 30;
        if (blindRoll) {
          atkScarab.blindTurns = 1;
        }

        if (counterRoll) {
          const counterDmg = Math.max(9, Math.floor(defScarab.atk * 0.70 - atkScarab.def * 0.28));
          atkScarab.hp = Math.max(0, atkScarab.hp - counterDmg);
          logLine = `💨 УВОРОТ И КОНТРУДАР! «${defScarab.name}» ловко уклонился от выпада и контратаковал жвалами на -${counterDmg} ❤️!${blindRoll ? ' 🌪️ (Враг ослеплён песком!)' : ''} (У «${atkScarab.name}» ${atkScarab.hp}/${atkScarab.maxHp} ❤️)`;
        } else {
          logLine = `💨 УВОРОТ! «${defScarab.name}» молниеносно увернулся от выпада «${atkScarab.name}»! Урон не прошёл.${blindRoll ? ' 🌪️ (Враг ослеплён песком!)' : ''}`;
        }
      } else {
        // Hit landed! Check Crits (Deal full 2x damage upon critical strike as requested)
        const isCrit = Math.random() * 100 < atkScarab.critPct;

        // Armor blocking
        const blockChance = Math.min(38, defScarab.def * 1.3);
        const isBlocked = Math.random() * 100 < blockChance;

        let baseDamage = Math.max(8, atkScarab.atk - Math.floor(defScarab.def * 0.42) + Math.floor(Math.random() * 10) - 4);
        if (isCrit) {
          baseDamage = Math.floor(baseDamage * 2.0); // 2x сокрушительный урон при критическом ударе!
        }
        if (isBlocked) {
          baseDamage = Math.max(5, Math.floor(baseDamage * 0.5));
        }

        let extraSkillText = '';

        // Archetype Special Skills
        if (atkScarab.archetype === 'сила' && Math.random() * 100 < 30) {
          baseDamage += 16;
          extraSkillText = ' 🔥 Сокрушение Сета (+16 урона)!';
        } else if (atkScarab.archetype === 'яд' && Math.random() * 100 < 35) {
          baseDamage += 12;
          extraSkillText = ' 🧪 Смертоносный яд (+12 урона сквозь хитин)!';
        }

        // Armor Reflected Thorns
        if (defScarab.archetype === 'броня' && isBlocked && Math.random() * 100 < 35) {
          const reflectDmg = Math.max(5, Math.floor(baseDamage * 0.30));
          atkScarab.hp = Math.max(0, atkScarab.hp - reflectDmg);
          extraSkillText += ` 🗿 Шипы панциря отразили ${reflectDmg} урона во врага!`;
        }

        // Low HP Enrage mechanic (survival surge)
        if (!defScarab.enraged && defScarab.hp - baseDamage <= defScarab.maxHp * 0.35 && defScarab.hp - baseDamage > 0) {
          defScarab.enraged = true;
          baseDamage = Math.max(4, Math.floor(baseDamage * 0.65));
          defScarab.atk += 14;
          defScarab.agility = Math.min(68, defScarab.agility + 12);
          extraSkillText += ' 🔥 ЯРОСТЬ ПУСТЫНИ! (Получен всплеск адреналина: +14 Атаки, +12% Уворота!)';
        }

        defScarab.hp = Math.max(0, defScarab.hp - baseDamage);
        const critBadge = isCrit ? ' (💥 КРИТ 2x УРОН!)' : '';
        const blockBadge = isBlocked ? ' (🛡️ БЛОК!)' : '';

        logLine = `${attackerIsF1 ? '🪲' : '🦂'} Раунд ${turn}: «${atkScarab.name}» наносит ${baseDamage} урона${critBadge}${blockBadge}${extraSkillText} по «${defScarab.name}» (Осталось ${defScarab.hp}/${defScarab.maxHp} ❤️)`;
      }

      setFighters([{ ...f1 }, { ...f2 }]);
      setCombatLog((prev) => [logLine, ...prev.slice(0, 14)]);

      // Check for death (either defender or attacker killed by counter-attack/thorns)
      if (defScarab.hp <= 0 || atkScarab.hp <= 0) {
        clearInterval(fightIntervalRef.current);
        const winner = defScarab.hp <= 0 ? atkScarab : defScarab;
        const playerWon = lockedBet.fighterId === winner.id;
        const payout = playerWon ? Math.floor(lockedBet.amount * lockedBet.odds) : 0;

        if (playerWon) {
          playLootSound();
        } else {
          playCoinSound();
        }

        onGamblingTransaction({
          gameName: 'Бои Скарабеев',
          spentGold: 0,
          wonGold: playerWon ? payout : 0,
          countGame: true,
          logText: playerWon
            ? `🏆 Бои Скарабеев: победил «${winner.name}»! Выигрыш по тотализатору: +${payout} 🪙 (x${lockedBet.odds})`
            : `💀 Бои Скарабеев: победил «${winner.name}». Ставка ${lockedBet.amount} 🪙 не сыграла.`
        });

        setWinnerResult({
          winnerId: winner.id,
          winnerName: winner.name,
          playerWon,
          payout,
          text: playerWon
            ? `🏆 Победил «${winner.name}» [${winner.rarityLabel}]! Ваша ставка сыграла (x${lockedBet.odds}): вы получили +${payout.toLocaleString()} 🪙!`
            : `💀 Победил «${winner.name}» [${winner.rarityLabel}]! Ваш боец повержен на арене, ставка ${lockedBet.amount.toLocaleString()} 🪙 сгорела.`
        });
        setLockedBet(null);
        setIsFighting(false);
      }
    }, 450);
  };

  const handleNextPair = () => {
    if (isFighting || lockedBet) return;
    playClickSound();
    setFighters(generateScarabPair());
    setWinnerResult(null);
    setCombatLog(['🔄 На арену вышли два новых боевых Скарабея! Изучите их силу, ловкость, редкость и коэффициенты.']);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="space-y-2.5">
      {/* Top Info & Timer */}
      <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-slate-900 to-emerald-950/50 p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
            <span>🪲 Бои Скарабеев (Усиленная Арена Тотализатора)</span>
          </div>
          <div className="text-[9.5px] text-slate-300 mt-0.5">
            У скарабеев увеличены базовое HP и уворот (+15%), добавлены ранги редкости (Обычный–Мифический) с бонусами к Силе и Ловкости, а также механика выживания «Ярость Пустыни»!
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-amber-500/40 bg-slate-950 px-2.5 py-1 text-right">
            <div className="text-[8px] uppercase text-slate-400">Авто-раунд через:</div>
            <div className="font-mono text-xs font-black text-amber-300">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
          </div>
          <button
            type="button"
            disabled={isFighting || Boolean(lockedBet)}
            onClick={handleNextPair}
            className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 text-[10px] font-black text-cyan-300 disabled:opacity-40 cursor-pointer"
          >
            🔄 Новая пара
          </button>
        </div>
      </div>

      {/* Two Scarab Fighters Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {fighters.map((f) => {
          const isChosen = selectedFighter === f.id;
          const hpPct = Math.max(0, Math.min(100, Math.round((f.hp / f.maxHp) * 100)));
          return (
            <div
              key={f.id}
              onClick={() => !isFighting && !lockedBet && setSelectedFighter(f.id)}
              className={`rounded-2xl border-2 p-3 transition-all cursor-pointer ${
                isChosen
                  ? 'border-amber-400 bg-gradient-to-b from-amber-950/50 via-slate-900 to-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                  : 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{f.icon}</span>
                  <div>
                    <div className="text-xs font-black text-white flex flex-wrap items-center gap-1">
                      <span>{f.name}</span>
                      <span className={`rounded border px-1 py-0.2 text-[8px] font-black ${f.rarityBadgeCls}`}>
                        {f.rarityLabel} Ур.{f.level}
                      </span>
                      <span className="rounded bg-slate-800 border border-slate-700 px-1 py-0.2 text-[8px] font-bold text-amber-300">
                        {f.archetypeLabel}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-400">{f.title}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded-lg border border-emerald-400/60 bg-emerald-950/80 px-2 py-0.5 text-xs font-black text-emerald-300">
                    x{f.odds}
                  </span>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">Шанс: ~{f.winProb}%</div>
                </div>
              </div>

              {/* HP Bar */}
              <div className="mt-2.5 space-y-1">
                <div className="flex justify-between text-[9.5px] font-bold">
                  <span className="text-red-300">❤️ Здоровье (+15%):</span>
                  <span className="text-white">
                    {f.hp} / {f.maxHp} ({hpPct}%)
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
              </div>

              {/* Fighter Stats (Strength, Agility, Armor, Crit) */}
              <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[9px]">
                <div className="rounded bg-slate-950/90 border border-slate-800 py-1">
                  <div className="text-slate-400 text-[7.5px] uppercase">Сила</div>
                  <div className="font-black text-amber-300">⚔️ {f.atk}</div>
                  <div className="text-[7px] text-amber-400/80">+{f.bonusAtk} ранг</div>
                </div>
                <div className={`rounded bg-slate-950/90 border py-1 ${f.agility >= 30 ? 'border-amber-400/50 bg-amber-950/30' : 'border-slate-800'}`}>
                  <div className="text-slate-400 text-[7.5px] uppercase">Ловкость</div>
                  <div className="font-black text-emerald-300">💨 {f.agility}%</div>
                  <div className="text-[7px] text-emerald-400/80">+{f.bonusAgility}% ранг</div>
                </div>
                <div className="rounded bg-slate-950/90 border border-slate-800 py-1">
                  <div className="text-slate-400 text-[7.5px] uppercase">Броня</div>
                  <div className="font-black text-cyan-300">🛡️ {f.def}</div>
                </div>
                <div className={`rounded bg-slate-950/90 border py-1 ${f.critPct >= 35 ? 'border-purple-400/50 bg-purple-950/30' : 'border-slate-800'}`}>
                  <div className="text-slate-400 text-[7.5px] uppercase">Крит (2x)</div>
                  <div className="font-black text-purple-300">💥 {f.critPct}%</div>
                  <div className="text-[7px] text-purple-400/80">+{f.bonusCrit}% ранг</div>
                </div>
              </div>

              {/* Unique Skill & Trait */}
              <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-950/60 p-1.5 text-[8.5px] text-slate-300 flex items-center justify-between gap-1">
                <span className="font-bold text-amber-300">{f.skillName}</span>
                <span className="text-[8px] text-slate-400 truncate">{f.skillDesc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Winner Banner */}
      {winnerResult && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs font-black ${
            winnerResult.playerWon
              ? 'border-emerald-400 bg-emerald-950/80 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              : 'border-rose-500/60 bg-rose-950/70 text-rose-200'
          }`}
        >
          {winnerResult.text}
        </div>
      )}

      {/* Bet Controls & Launch Fight */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/95 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <span className="font-black text-amber-300">
            Выбран боец: «{chosenScarab.name}» [{chosenScarab.rarityLabel} Ур.{chosenScarab.level}] (x{chosenScarab.odds})
          </span>
          <span className="font-bold text-emerald-300">
            Выплата при победе: +{Math.floor(parsedBet * chosenScarab.odds).toLocaleString()} 🪙
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="number"
            min={10}
            max={hero.gold}
            disabled={isFighting || Boolean(lockedBet)}
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            className="w-28 sm:w-36 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-black text-white outline-none focus:border-amber-400"
          />
          {[100, 500, 1000, 5000].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={isFighting || Boolean(lockedBet)}
              onClick={() => setBetAmount(String(preset))}
              className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-2 text-[10px] font-black text-amber-300 disabled:opacity-40 cursor-pointer"
            >
              {preset}🪙
            </button>
          ))}

          {!lockedBet ? (
            <button
              type="button"
              disabled={isFighting || parsedBet <= 0 || parsedBet > hero.gold}
              onClick={handleLockBet}
              className="flex-1 rounded-xl border border-amber-400 bg-amber-500 hover:bg-amber-400 py-2 px-3 text-xs font-black text-slate-950 shadow cursor-pointer disabled:opacity-40"
            >
              💰 Сделать ставку ({parsedBet.toLocaleString()} 🪙)
            </button>
          ) : (
            <button
              type="button"
              disabled={isFighting}
              onClick={startScarabBattle}
              className="flex-1 rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 py-2 px-3 text-xs font-black text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse cursor-pointer"
            >
              {isFighting ? '⚔️ Идёт бой на арене...' : '⚡ Начать бой сейчас!'}
            </button>
          )}
        </div>
      </div>

      {/* Live Battle Log */}
      {combatLog.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 max-h-40 overflow-y-auto space-y-1">
          <div className="text-[9px] font-black uppercase text-slate-400 flex items-center justify-between">
            <span>📜 Хроника песчаной арены:</span>
            <span className="text-[8px] text-amber-400/80">💥 Крит = 2x сокрушительный урон (растёт с редкостью) | 💨 Уворот (+15%) | 🌪️ Ослепление | 🔥 Ярость &lt;35% HP</span>
          </div>
          {combatLog.map((line, idx) => (
            <div key={idx} className="text-[10px] text-slate-200 font-medium leading-snug">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 5. «ТУРНИР СКАРАБЕЕВ» (SCARAB TOURNAMENT WITH TRAINING, BRACKETS & LEADERBOARD)
// ============================================================================

export type TournamentScarabArchetypeKey = 'juggernaut' | 'swift' | 'tank' | 'assassin';

export interface ScarabArchetypeMeta {
  key: TournamentScarabArchetypeKey;
  label: string;
  badge: string;
  icon: string;
  color: string;
  bonusDesc: string;
}

export const SCARAB_ARCHETYPES: Record<TournamentScarabArchetypeKey, ScarabArchetypeMeta> = {
  juggernaut: {
    key: 'juggernaut',
    label: 'Силовик',
    badge: '💥 Сокрушение',
    icon: '⚔️',
    color: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
    bonusDesc: '+7 базового урона и «Ярость Сета» при <35% HP (+15 урона)'
  },
  swift: {
    key: 'swift',
    label: 'Ловкач',
    badge: '💨 Вихрь песков',
    icon: '🌪️',
    color: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40',
    bonusDesc: '+18% к увороту, высокий шанс контратаки при уклонении'
  },
  tank: {
    key: 'tank',
    label: 'Панцирник',
    badge: '🛡️ Стена Хепри',
    icon: '🧱',
    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40',
    bonusDesc: '+35 HP, +6 Брони и возврат 20% урона обратно врагу'
  },
  assassin: {
    key: 'assassin',
    label: 'Ассасин',
    badge: '⚡ Смертельный выпад',
    icon: '🗡️',
    color: 'text-purple-300 border-purple-500/40 bg-purple-950/40',
    bonusDesc: '+14% к шансу крита 2x и внезапный первый удар в начале боя'
  }
};

export interface TrainedScarab {
  id: string;
  trainerNick: string;
  name: string;
  avatar: string;
  archetype: TournamentScarabArchetypeKey;
  level: number;
  xp: number;
  xpToNext: number;
  // Attributes
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  armor: number;
  critChance: number;
  // Tournament Records
  trophies: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  matchesWon: number;
  matchesLost: number;
  totalPrizeGold: number;
  totalPrizeCrystals: number;
}

export interface TournamentCupConfig {
  id: 'bronze' | 'silver' | 'gold';
  name: string;
  badge: string;
  icon: string;
  entryFeeGold: number;
  prize1stGold: number;
  prize1stCrystals: number;
  prize1stTrophies: number;
  prize1stXp: number;
  prize2ndGold: number;
  prize2ndTrophies: number;
  prize2ndXp: number;
  minLvl: number;
  maxLvl: number;
  desc: string;
  tierColor: string;
}

export const TOURNAMENT_CUPS: TournamentCupConfig[] = [
  {
    id: 'bronze',
    name: 'Песчаный Кубок (Бронза)',
    badge: '🥉 Лига Песков',
    icon: '🥉',
    entryFeeGold: 25,
    prize1stGold: 65,
    prize1stCrystals: 1,
    prize1stTrophies: 15,
    prize1stXp: 90,
    prize2ndGold: 30,
    prize2ndTrophies: 7,
    prize2ndXp: 40,
    minLvl: 2,
    maxLvl: 6,
    desc: 'Турнир закалённых скарабеев. Взнос и призы сбалансированы под снаряжение 2–8 ур.',
    tierColor: 'border-amber-700/60 bg-amber-950/30 text-amber-300'
  },
  {
    id: 'silver',
    name: 'Кубок Нила (Серебро)',
    badge: '🥈 Лига Стражей',
    icon: '🥈',
    entryFeeGold: 60,
    prize1stGold: 150,
    prize1stCrystals: 3,
    prize1stTrophies: 35,
    prize1stXp: 200,
    prize2ndGold: 70,
    prize2ndTrophies: 15,
    prize2ndXp: 90,
    minLvl: 6,
    maxLvl: 13,
    desc: 'Престижный чемпионат опытных бойцов. Главный приз равен стоимости редкой брони 15 ур. в магазине!',
    tierColor: 'border-slate-400/60 bg-slate-900/60 text-slate-200'
  },
  {
    id: 'gold',
    name: 'Кубок Фараона (Золотой Гранд-Турнир)',
    badge: '👑 Королевская Лига',
    icon: '👑',
    entryFeeGold: 120,
    prize1stGold: 300,
    prize1stCrystals: 6,
    prize1stTrophies: 80,
    prize1stXp: 450,
    prize2ndGold: 135,
    prize2ndTrophies: 35,
    prize2ndXp: 180,
    minLvl: 11,
    maxLvl: 25,
    desc: 'Главный турнир Пирамиды! Награда за 1-е место равна стоимости легендарного оружия 20 ур.',
    tierColor: 'border-yellow-400 bg-gradient-to-br from-amber-500/20 via-yellow-950/40 to-amber-900/40 text-yellow-300'
  }
];

export interface TournamentCombatant {
  id: string;
  trainerNick: string;
  isPlayer: boolean;
  name: string;
  avatar: string;
  archetype: TournamentScarabArchetypeKey;
  level: number;
  maxHp: number;
  hp: number;
  strength: number;
  agility: number;
  armor: number;
  critChance: number;
}

export interface BracketMatch {
  id: string;
  round: 'quarters' | 'semis' | 'final';
  roundName: string;
  indexInRound: number;
  c1: TournamentCombatant;
  c2: TournamentCombatant;
  winner: TournamentCombatant | null;
  scoreSummary?: string;
  isCompleted: boolean;
}

export interface TournamentLeaderboardEntry {
  rank?: number;
  trainerNick: string;
  isPlayer?: boolean;
  scarabName: string;
  scarabAvatar: string;
  archetype: TournamentScarabArchetypeKey;
  level: number;
  trophies: number;
  tournamentsWon: number;
  matchesWon: number;
  matchesLost: number;
  totalPrizeGold: number;
  totalPrizeCrystals: number;
  inspectStats: {
    hp: number;
    strength: number;
    agility: number;
    armor: number;
    critChance: number;
  };
}

const DEFAULT_RIVAL_NAMES = [
  'Анубис_Хранитель',
  'Песчаный_Демон',
  'Сехмет_99',
  'Нефритовый_Жук',
  'Осирис_Тень',
  'Гладиатор_Мемфиса',
  'Золотой_Хепри',
  'Караванщик_Али',
  'Владыка_Дюн',
  'Страж_Гробницы',
  'Феникс_Песков',
  'Скарабей_Ра'
];

const DEFAULT_LEADERBOARD_SEEDS: TournamentLeaderboardEntry[] = [
  {
    trainerNick: 'Фараон_Хеопс',
    scarabName: 'Солнечный Хепри',
    scarabAvatar: '👑',
    archetype: 'tank',
    level: 22,
    trophies: 780,
    tournamentsWon: 18,
    matchesWon: 68,
    matchesLost: 9,
    totalPrizeGold: 5200,
    totalPrizeCrystals: 85,
    inspectStats: { hp: 640, strength: 68, agility: 46, armor: 42, critChance: 38 }
  },
  {
    trainerNick: 'Аменхотеп_IV',
    scarabName: 'Ярость Сехмет',
    scarabAvatar: '💥',
    archetype: 'juggernaut',
    level: 19,
    trophies: 610,
    tournamentsWon: 14,
    matchesWon: 54,
    matchesLost: 11,
    totalPrizeGold: 3900,
    totalPrizeCrystals: 62,
    inspectStats: { hp: 520, strength: 82, agility: 42, armor: 30, critChance: 42 }
  },
  {
    trainerNick: 'Нефертити_Страж',
    scarabName: 'Призрак Оазиса',
    scarabAvatar: '⚡',
    archetype: 'assassin',
    level: 17,
    trophies: 490,
    tournamentsWon: 11,
    matchesWon: 46,
    matchesLost: 10,
    totalPrizeGold: 3100,
    totalPrizeCrystals: 48,
    inspectStats: { hp: 460, strength: 70, agility: 58, armor: 26, critChance: 58 }
  },
  {
    trainerNick: 'Имхотеп_Архитектор',
    scarabName: 'Древний Титан',
    scarabAvatar: '🪲',
    archetype: 'tank',
    level: 15,
    trophies: 380,
    tournamentsWon: 9,
    matchesWon: 38,
    matchesLost: 11,
    totalPrizeGold: 2250,
    totalPrizeCrystals: 34,
    inspectStats: { hp: 510, strength: 56, agility: 38, armor: 36, critChance: 30 }
  },
  {
    trainerNick: 'Анубис_Пепел',
    scarabName: 'Тень Загробная',
    scarabAvatar: '🌪️',
    archetype: 'swift',
    level: 13,
    trophies: 290,
    tournamentsWon: 7,
    matchesWon: 31,
    matchesLost: 9,
    totalPrizeGold: 1640,
    totalPrizeCrystals: 24,
    inspectStats: { hp: 410, strength: 54, agility: 64, armor: 24, critChance: 36 }
  },
  {
    trainerNick: 'Рамзес_Победитель',
    scarabName: 'Золотой Клинок',
    scarabAvatar: '🦂',
    archetype: 'juggernaut',
    level: 11,
    trophies: 210,
    tournamentsWon: 5,
    matchesWon: 24,
    matchesLost: 8,
    totalPrizeGold: 1180,
    totalPrizeCrystals: 16,
    inspectStats: { hp: 370, strength: 58, agility: 38, armor: 26, critChance: 32 }
  },
  {
    trainerNick: 'Себек_Крокодил',
    scarabName: 'Болотный Панцирь',
    scarabAvatar: '🪲',
    archetype: 'swift',
    level: 9,
    trophies: 140,
    tournamentsWon: 3,
    matchesWon: 16,
    matchesLost: 7,
    totalPrizeGold: 720,
    totalPrizeCrystals: 9,
    inspectStats: { hp: 330, strength: 46, agility: 48, armor: 22, critChance: 26 }
  }
];

function getCurrentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const ScarabTournamentGameView: React.FC<SubGameCommonProps> = ({
  hero,
  currentUser,
  onGamblingTransaction
}) => {
  const [subTab, setSubTab] = useState<'arena' | 'training' | 'leaderboard'>('arena');
  const trainerKey = currentUser || hero.nick || (hero as any).name || 'player';

  // Global Admin Config for Scarab Tournament (cups, training costs, difficulty, reward schedule)
  const [tournamentConfig, setTournamentConfig] = useState<ScarabTournamentGlobalConfig>(() =>
    getScarabTournamentConfig()
  );
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [seasonRewardNotice, setSeasonRewardNotice] = useState<string | null>(null);

  // Track monthly tournament entries per player
  const getStoredMonthlyEntries = (resetToken: number): number => {
    try {
      const raw = localStorage.getItem(`pyramid_scarab_monthly_entry_${trainerKey}`);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      const monthKey = getCurrentMonthKey();
      if (parsed && parsed.monthKey === monthKey && Number(parsed.resetToken || 1) === Number(resetToken || 1)) {
        return Math.max(0, Number(parsed.count || 0));
      }
    } catch {}
    return 0;
  };

  const [entriesUsedThisMonth, setEntriesUsedThisMonth] = useState<number>(() =>
    getStoredMonthlyEntries(getScarabTournamentConfig().schedule.seasonResetToken || 1)
  );

  // 1. Player's Personal Trained Scarab
  const loadPersonalScarab = (): TrainedScarab => {
    try {
      const saved = localStorage.getItem(`pyramid_my_tournament_scarab_${trainerKey}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      id: `scarab_${trainerKey}_${Date.now()}`,
      trainerNick: trainerKey,
      name: `${trainerKey.slice(0, 8)}_Скарабей`,
      avatar: '🪲',
      archetype: 'juggernaut',
      level: 1,
      xp: 0,
      xpToNext: 100,
      hp: 120,
      maxHp: 120,
      strength: 18,
      agility: 15,
      armor: 6,
      critChance: 12,
      trophies: 0,
      tournamentsPlayed: 0,
      tournamentsWon: 0,
      matchesWon: 0,
      matchesLost: 0,
      totalPrizeGold: 0,
      totalPrizeCrystals: 0
    };
  };

  const [scarab, setScarab] = useState<TrainedScarab>(() => loadPersonalScarab());

  // 4. Tournament Leaderboard
  const loadStoredLeaderboard = (): TournamentLeaderboardEntry[] => {
    try {
      const raw = localStorage.getItem('pyramid_scarab_tournament_leaderboard_v3');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_LEADERBOARD_SEEDS;
  };

  const [leaderboard, setLeaderboard] = useState<TournamentLeaderboardEntry[]>(() => loadStoredLeaderboard());

  useEffect(() => {
    void syncScarabTournamentConfigFromSupabase().then((updated) => {
      if (updated) {
        const freshCfg = getScarabTournamentConfig();
        setTournamentConfig(freshCfg);
        setEntriesUsedThisMonth(getStoredMonthlyEntries(freshCfg.schedule.seasonResetToken || 1));
      }
    });
    const onCfgUpdate = () => {
      const freshCfg = getScarabTournamentConfig();
      setTournamentConfig(freshCfg);
      setEntriesUsedThisMonth(getStoredMonthlyEntries(freshCfg.schedule.seasonResetToken || 1));
    };
    const onDataUpdate = () => {
      setScarab(loadPersonalScarab());
      setLeaderboard(loadStoredLeaderboard());
      const freshCfg = getScarabTournamentConfig();
      setEntriesUsedThisMonth(getStoredMonthlyEntries(freshCfg.schedule.seasonResetToken || 1));
    };
    window.addEventListener('scarab-tournament-config-updated', onCfgUpdate);
    window.addEventListener('scarab-tournament-data-updated', onDataUpdate);
    return () => {
      window.removeEventListener('scarab-tournament-config-updated', onCfgUpdate);
      window.removeEventListener('scarab-tournament-data-updated', onDataUpdate);
    };
  }, [trainerKey]);

  // Save personal scarab changes
  useEffect(() => {
    try {
      localStorage.setItem(`pyramid_my_tournament_scarab_${trainerKey}`, JSON.stringify(scarab));
    } catch {}
  }, [scarab, trainerKey]);

  // Rename & UI state
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(scarab.name);

  // 2. Active Tournament State
  const [selectedCupId, setSelectedCupId] = useState<'bronze' | 'silver' | 'gold'>('bronze');
  const [activeTournament, setActiveTournament] = useState<{
    cup: ScarabCupAdminConfig;
    round: 'quarters' | 'semis' | 'final';
    matches: BracketMatch[];
    activeMatchIndex: number;
    isFinished: boolean;
    isWon: boolean;
    placedRank?: 1 | 2 | 3 | 8;
    prizeClaimed: boolean;
  } | null>(null);

  // 3. Combat Match State
  const [isFightingMatch, setIsFightingMatch] = useState(false);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [liveP1Hp, setLiveP1Hp] = useState<number>(scarab.hp);
  const [liveP2Hp, setLiveP2Hp] = useState<number>(scarab.hp);
  const [inspectedEntry, setInspectedEntry] = useState<TournamentLeaderboardEntry | null>(null);

  // Sync player into leaderboard
  useEffect(() => {
    setLeaderboard((prev) => {
      const filtered = prev.filter((e) => e.trainerNick.toLowerCase() !== trainerKey.toLowerCase());
      const playerEntry: TournamentLeaderboardEntry = {
        trainerNick: trainerKey,
        isPlayer: true,
        scarabName: scarab.name,
        scarabAvatar: scarab.avatar,
        archetype: scarab.archetype,
        level: scarab.level,
        trophies: scarab.trophies,
        tournamentsWon: scarab.tournamentsWon,
        matchesWon: scarab.matchesWon,
        matchesLost: scarab.matchesLost,
        totalPrizeGold: scarab.totalPrizeGold,
        totalPrizeCrystals: scarab.totalPrizeCrystals,
        inspectStats: {
          hp: scarab.maxHp,
          strength: scarab.strength,
          agility: scarab.agility,
          armor: scarab.armor,
          critChance: scarab.critChance
        }
      };
      const merged = [...filtered, playerEntry].sort((a, b) => b.trophies - a.trophies);
      try {
        localStorage.setItem('pyramid_scarab_tournament_leaderboard_v3', JSON.stringify(merged));
      } catch {}
      return merged;
    });
  }, [scarab, trainerKey]);

  // Live 1s timer for Seasonal Leaderboard Reward Distribution
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to format remaining seconds to DDд HH:MM:SS or HH:MM:SS
  const formatRewardCountdown = (targetMs: number) => {
    const diffSec = Math.max(0, Math.floor((targetMs - nowTs) / 1000));
    const days = Math.floor(diffSec / 86400);
    const hrs = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    if (days > 0) {
      return `${days}д ${String(hrs).padStart(2, '0')}ч ${String(mins).padStart(2, '0')}м ${String(secs).padStart(2, '0')}с`;
    }
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Claim / trigger seasonal reward if timer reached 0 and player is in Top-3
  const handleClaimSeasonRewardIfReady = () => {
    const sched = tournamentConfig.schedule;
    const playerRank = leaderboard.findIndex((e) => e.isPlayer) + 1;
    let wonG = 0;
    let wonC = 0;
    if (playerRank === 1) {
      wonG = sched.top1Gold ?? 250;
      wonC = sched.top1Crystals ?? 7;
    } else if (playerRank === 2) {
      wonG = sched.top2Gold ?? 150;
      wonC = sched.top2Crystals ?? 4;
    } else if (playerRank === 3) {
      wonG = sched.top3Gold ?? 80;
      wonC = sched.top3Crystals ?? 2;
    }

    const nextCycleMs = Date.now() + Math.max(1, sched.rewardIntervalMinutes) * 60 * 1000;
    const nextResetToken = (sched.seasonResetToken || 1) + 1;
    const nextCfg: ScarabTournamentGlobalConfig = {
      ...tournamentConfig,
      schedule: {
        ...sched,
        seasonNumber: (sched.seasonNumber || 1) + 1,
        seasonResetToken: nextResetToken,
        nextRewardDistributionAt: nextCycleMs
      }
    };
    saveScarabTournamentConfigLocal(nextCfg);
    setTournamentConfig(nextCfg);
    setEntriesUsedThisMonth(0);

    if (wonG > 0 || wonC > 0) {
      playCoinSound();
      playLevelUpSound();
      onGamblingTransaction({
        gameName: `Награда Ежемесячного Сезона Турнира Скарабеев (#${playerRank} место)`,
        wonGold: wonG,
        wonCrystals: wonC,
        countGame: false
      });
      setSeasonRewardNotice(
        `🎉 Вы получили ежемесячную награду сезона за #${playerRank} место в рейтинге: +${wonG.toLocaleString()} 🪙 и +${wonC} 💎! Открыт новый сезон!`
      );
    } else {
      setSeasonRewardNotice(
        `⏱️ Ежемесячные награды Топ-3 распределены и открыт новый сезон! Поднимитесь в Топ-3 по кубкам (ваш ранг #${playerRank}), чтобы получить призы.`
      );
    }
  };

  // Helper: create combatant from personal scarab
  function buildPlayerCombatant(sc: TrainedScarab): TournamentCombatant {
    const extraHp = sc.archetype === 'tank' ? 35 : 0;
    const extraStr = sc.archetype === 'juggernaut' ? 7 : 0;
    const extraAgi = sc.archetype === 'swift' ? 12 : 0;
    const extraArmor = sc.archetype === 'tank' ? 6 : 0;
    const extraCrit = sc.archetype === 'assassin' ? 14 : 0;

    return {
      id: 'player_combatant',
      trainerNick: sc.trainerNick,
      isPlayer: true,
      name: sc.name,
      avatar: sc.avatar,
      archetype: sc.archetype,
      level: sc.level,
      maxHp: sc.maxHp + extraHp,
      hp: sc.maxHp + extraHp,
      strength: sc.strength + extraStr,
      agility: sc.agility + extraAgi,
      armor: sc.armor + extraArmor,
      critChance: sc.critChance + extraCrit
    };
  }

  // Helper: generate much stronger rival combatant for a cup (controlled by tournamentConfig.difficulty)
  function generateRivalCombatant(cup: ScarabCupAdminConfig, idx: number): TournamentCombatant {
    const diff = tournamentConfig.difficulty || {
      globalStatMultiplier: 1.55,
      minPlayerStatRatio: 1.2,
      bonusLevelOffset: 3,
      semiFinalBuffMult: 1.28,
      finalBossBuffMult: 1.45,
      rivalExtraCritPct: 12,
      rivalExtraDodgePct: 10,
      rivalDamageReductionPct: 15,
      enableBossRageSkill: true,
      enableCounterAttackSkill: true
    };

    const archKeys: TournamentScarabArchetypeKey[] = ['juggernaut', 'swift', 'tank', 'assassin'];
    const chosenArch = archKeys[Math.floor(Math.random() * archKeys.length)];
    const rivalNick = DEFAULT_RIVAL_NAMES[idx % DEFAULT_RIVAL_NAMES.length];
    const cupRollLvl = Math.floor(Math.random() * (cup.maxLvl - cup.minLvl + 1)) + cup.minLvl;
    const scaledPlayerLvl = Math.max(
      cup.minLvl,
      Math.round(scarab.level * 1.25) + diff.bonusLevelOffset + Math.floor(Math.random() * 4)
    );
    const lvl = Math.min(cup.maxLvl + 10, Math.max(cupRollLvl, scaledPlayerLvl));

    const playerPowerFactor = Math.max(1, (scarab.strength + scarab.agility + scarab.armor) / 36);
    const cupTierMul = cup.id === 'gold' ? 1.55 : cup.id === 'silver' ? 1.32 : 1.15;
    const totalMul = cupTierMul * Math.max(0.5, diff.globalStatMultiplier || 1.55);
    const minRatio = Math.max(0.5, diff.minPlayerStatRatio || 1.2);

    const rawHp = (165 + lvl * 34 + (chosenArch === 'tank' ? 85 : 25)) * totalMul;
    const rawStr = (26 + lvl * 5.6 + (chosenArch === 'juggernaut' ? 14 : 5)) * totalMul;
    const rawAgi = (20 + lvl * 4.2 + (chosenArch === 'swift' ? 18 : 5) + (diff.rivalExtraDodgePct || 0)) * totalMul;
    const rawArm = (10 + Math.floor(lvl * 3.1) + (chosenArch === 'tank' ? 12 : 4)) * totalMul;

    const baseHp = Math.round(
      Math.max(
        rawHp,
        scarab.maxHp * (minRatio + Math.random() * 0.32) * (cup.id === 'gold' ? 1.28 : cup.id === 'silver' ? 1.15 : 1.05)
      )
    );
    const baseStr = Math.round(
      Math.max(
        rawStr,
        scarab.strength *
          (minRatio - 0.04 + Math.random() * 0.3) *
          Math.min(1.5, playerPowerFactor * 0.4 + 0.85)
      )
    );
    const baseAgi = Math.round(
      Math.max(rawAgi, scarab.agility * (minRatio - 0.08 + Math.random() * 0.28) + (diff.rivalExtraDodgePct || 0))
    );
    const baseArm = Math.round(
      Math.max(rawArm, scarab.armor * (minRatio - 0.05 + Math.random() * 0.28))
    );
    const baseCrit = Math.min(
      78,
      Math.round(
        18 +
          lvl * 2.8 +
          (chosenArch === 'assassin' ? 18 : 6) +
          (diff.rivalExtraCritPct || 12)
      )
    );

    const icons = ['🪲', '🦂', '🪳', '⚡', '💥', '🌪️'];

    return {
      id: `rival_${idx}_${Date.now()}`,
      trainerNick: rivalNick,
      isPlayer: false,
      name: `Титан ${rivalNick.slice(0, 7)}`,
      avatar: icons[idx % icons.length],
      archetype: chosenArch,
      level: lvl,
      maxHp: baseHp,
      hp: baseHp,
      strength: baseStr,
      agility: baseAgi,
      armor: baseArm,
      critChance: baseCrit
    };
  }

  // Award XP and handle level up (2x stronger level-up stat gains!)
  function awardScarabXp(amount: number) {
    const maxCritAllowed = tournamentConfig.training.maxCritChance || 70;
    setScarab((prev) => {
      let newXp = prev.xp + amount;
      let newLvl = prev.level;
      let newXpToNext = prev.xpToNext;
      let newMaxHp = prev.maxHp;
      let newStr = prev.strength;
      let newAgi = prev.agility;
      let newArm = prev.armor;
      let newCrit = prev.critChance;

      let leveledUp = false;
      while (newXp >= newXpToNext) {
        newXp -= newXpToNext;
        newLvl += 1;
        newXpToNext = Math.floor(newXpToNext * 1.35) + 30;
        newMaxHp += 40;
        newStr += 4;
        newAgi += 2;
        newArm += 2;
        newCrit = Math.min(maxCritAllowed, newCrit + 2);
        leveledUp = true;
      }

      if (leveledUp) {
        playLevelUpSound();
      }

      return {
        ...prev,
        level: newLvl,
        xp: newXp,
        xpToNext: newXpToNext,
        maxHp: newMaxHp,
        hp: newMaxHp,
        strength: newStr,
        agility: newAgi,
        armor: newArm,
        critChance: newCrit
      };
    });
  }

  // --- TRAINING ACTIONS (Dynamic from Admin Config, balanced with monster & shop economy) ---
  const trCfg = tournamentConfig.training;
  const costStrength = Math.round((trCfg.strBaseGold ?? 10) + scarab.strength * (trCfg.strStepGold ?? 1));
  const costAgility = Math.round((trCfg.agiBaseGold ?? 10) + scarab.agility * (trCfg.agiStepGold ?? 1));
  const costArmor = Math.round((trCfg.armorBaseGold ?? 14) + scarab.armor * (trCfg.armorStepGold ?? 2));
  const costCritCrystals = Math.max(1, trCfg.critCostCrystals ?? 1);
  const costXpElixir = Math.max(1, trCfg.xpElixirCostGold ?? 35);

  const handleTrainStrength = () => {
    if (hero.gold < costStrength) return;
    playCoinSound();
    onGamblingTransaction({
      gameName: 'Тренировка Скарабея (Сила)',
      spentGold: costStrength,
      countGame: false
    });
    setScarab((prev) => ({
      ...prev,
      strength: prev.strength + Math.max(1, trCfg.strGain),
      hp: prev.maxHp
    }));
  };

  const handleTrainAgility = () => {
    if (hero.gold < costAgility) return;
    playCoinSound();
    onGamblingTransaction({
      gameName: 'Тренировка Скарабея (Ловкость)',
      spentGold: costAgility,
      countGame: false
    });
    setScarab((prev) => ({
      ...prev,
      agility: prev.agility + Math.max(1, trCfg.agiGain),
      hp: prev.maxHp
    }));
  };

  const handleTrainArmor = () => {
    if (hero.gold < costArmor) return;
    playCoinSound();
    onGamblingTransaction({
      gameName: 'Тренировка Скарабея (Панцирь)',
      spentGold: costArmor,
      countGame: false
    });
    setScarab((prev) => ({
      ...prev,
      maxHp: prev.maxHp + Math.max(1, trCfg.hpGain),
      hp: prev.maxHp + Math.max(1, trCfg.hpGain),
      armor: prev.armor + Math.max(1, trCfg.armorGain)
    }));
  };

  const handleTrainCrit = () => {
    if (hero.crystals < costCritCrystals) return;
    playCoinSound();
    onGamblingTransaction({
      gameName: 'Тренировка Скарабея (Крит 2x)',
      spentCrystals: costCritCrystals,
      countGame: false
    });
    setScarab((prev) => ({
      ...prev,
      critChance: Math.min(trCfg.maxCritChance || 65, prev.critChance + Math.max(1, trCfg.critGain)),
      hp: prev.maxHp
    }));
  };

  const handleBuyXpElixir = () => {
    if (hero.gold < costXpElixir) return;
    playLootSound();
    onGamblingTransaction({
      gameName: 'Тренировка Скарабея (Эликсир Опыта)',
      spentGold: costXpElixir,
      countGame: false
    });
    awardScarabXp(Math.max(10, trCfg.xpElixirGain));
  };

  // --- START TOURNAMENT (Enforces Monthly Entry Limit if maxEntriesPerSeason > 0) ---
  const activeCupsList = tournamentConfig.cups?.length ? tournamentConfig.cups : TOURNAMENT_CUPS as any as ScarabCupAdminConfig[];
  const maxEntriesAllowed = Number(tournamentConfig.schedule.maxEntriesPerSeason ?? 1);
  const hasMonthlyLimitReached = maxEntriesAllowed > 0 && entriesUsedThisMonth >= maxEntriesAllowed;
  const isAdminUser = Boolean(hero.role === 'admin' || Number((hero as any).is_admin) === 1);

  const handleResetMyMonthlyEntryLimit = () => {
    const monthKey = getCurrentMonthKey();
    const token = tournamentConfig.schedule.seasonResetToken || 1;
    try {
      localStorage.setItem(
        `pyramid_scarab_monthly_entry_${trainerKey}`,
        JSON.stringify({ monthKey, resetToken: token, count: 0 })
      );
    } catch {}
    setEntriesUsedThisMonth(0);
    setSeasonRewardNotice('✅ Лимит выступлений в этом месяце сброшен! Вы снова можете вступить в Турнир Скарабеев.');
  };

  const handleStartTournament = (overrideCupId?: 'bronze' | 'silver' | 'gold') => {
    const targetId = overrideCupId || selectedCupId;
    const cup = activeCupsList.find((c) => c.id === targetId) || activeCupsList[0];
    if (!cup || hero.gold < cup.entryFeeGold) return;
    if (hasMonthlyLimitReached) {
      setSeasonRewardNotice(
        `⏳ Турнир Скарабеев проводится раз в месяц! Вы уже использовали свои попытки (${entriesUsedThisMonth}/${maxEntriesAllowed}) в текущем месячном сезоне.`
      );
      return;
    }

    const nextCount = entriesUsedThisMonth + 1;
    const monthKey = getCurrentMonthKey();
    const token = tournamentConfig.schedule.seasonResetToken || 1;
    try {
      localStorage.setItem(
        `pyramid_scarab_monthly_entry_${trainerKey}`,
        JSON.stringify({ monthKey, resetToken: token, count: nextCount })
      );
    } catch {}
    setEntriesUsedThisMonth(nextCount);

    playCoinSound();
    onGamblingTransaction({
      gameName: `Ежемесячный Турнир Скарабеев (${cup.name})`,
      spentGold: cup.entryFeeGold,
      countGame: true
    });

    const pCombatant = buildPlayerCombatant(scarab);
    const rivals: TournamentCombatant[] = [];
    for (let i = 0; i < 7; i++) {
      rivals.push(generateRivalCombatant(cup, i));
    }

    // 4 Quarterfinal matches
    const quarters: BracketMatch[] = [
      {
        id: 'q_0',
        round: 'quarters',
        roundName: '1/4 финала (Матч #1)',
        indexInRound: 0,
        c1: pCombatant,
        c2: rivals[0],
        winner: null,
        isCompleted: false
      },
      {
        id: 'q_1',
        round: 'quarters',
        roundName: '1/4 финала (Матч #2)',
        indexInRound: 1,
        c1: rivals[1],
        c2: rivals[2],
        winner: null,
        isCompleted: false
      },
      {
        id: 'q_2',
        round: 'quarters',
        roundName: '1/4 финала (Матч #3)',
        indexInRound: 2,
        c1: rivals[3],
        c2: rivals[4],
        winner: null,
        isCompleted: false
      },
      {
        id: 'q_3',
        round: 'quarters',
        roundName: '1/4 финала (Матч #4)',
        indexInRound: 3,
        c1: rivals[5],
        c2: rivals[6],
        winner: null,
        isCompleted: false
      }
    ];

    setActiveTournament({
      cup,
      round: 'quarters',
      matches: quarters,
      activeMatchIndex: 0,
      isFinished: false,
      isWon: false,
      prizeClaimed: false
    });

    setScarab((prev) => ({
      ...prev,
      tournamentsPlayed: prev.tournamentsPlayed + 1
    }));

    setSubTab('arena');
    setCombatLog([
      `🏆 Ежемесячный Турнир начался! Выставлен скарабей: ${scarab.name} (${SCARAB_ARCHETYPES[scarab.archetype].label}) против усиленных Титанов Пирамиды!`
    ]);
  };

  // Helper: simulate single combat between two combatants (with stronger AI boss mechanics)
  function runCombatSimulation(c1: TournamentCombatant, c2: TournamentCombatant): {
    winner: TournamentCombatant;
    loser: TournamentCombatant;
    log: string[];
  } {
    const diff = tournamentConfig.difficulty || {
      globalStatMultiplier: 1.55,
      minPlayerStatRatio: 1.2,
      bonusLevelOffset: 3,
      semiFinalBuffMult: 1.28,
      finalBossBuffMult: 1.45,
      rivalExtraCritPct: 12,
      rivalExtraDodgePct: 10,
      rivalDamageReductionPct: 15,
      enableBossRageSkill: true,
      enableCounterAttackSkill: true
    };

    let hp1 = c1.maxHp;
    let hp2 = c2.maxHp;
    const log: string[] = [];
    log.push(`⚔️ Начало поединка: ${c1.avatar} ${c1.name} (HP: ${hp1}) vs ${c2.avatar} ${c2.name} (HP: ${hp2})`);

    let turn = c1.agility >= c2.agility ? 1 : 2;

    for (let round = 1; round <= 35; round++) {
      if (hp1 <= 0 || hp2 <= 0) break;

      const attacker = turn === 1 ? c1 : c2;
      const defender = turn === 1 ? c2 : c1;

      // Evasion check based on agility (AI rivals get stronger evasion cap up to 62%)
      const maxDodgeCap = defender.isPlayer ? 52 : 62;
      const evasionChance = Math.min(maxDodgeCap, defender.agility * 1.45);
      const isEvaded = Math.random() * 100 < evasionChance;

      if (isEvaded) {
        log.push(`💨 ${defender.name} молниеносно уклонился от удара ${attacker.name}!`);
        // Swift or AI Rival counter attack
        const canCounter =
          defender.archetype === 'swift' ||
          (!defender.isPlayer && diff.enableCounterAttackSkill !== false);
        if (canCounter && Math.random() < (defender.isPlayer ? 0.45 : 0.58)) {
          const counterDmg = Math.max(5, Math.round(defender.strength * (defender.isPlayer ? 0.65 : 0.8)));
          if (turn === 1) hp1 = Math.max(0, hp1 - counterDmg);
          else hp2 = Math.max(0, hp2 - counterDmg);
          log.push(`⚡ [Контрудар Титана] ${defender.name} мгновенно контратакует на ${counterDmg} урона!`);
        }
      } else {
        // Crit roll (2x dmg)
        const isCrit = Math.random() * 100 < attacker.critChance;
        let baseDmg = Math.max(4, attacker.strength + Math.floor(Math.random() * 7 - 2) - Math.round(defender.armor * 0.85));

        // Low HP fury (<45% HP for AI Bosses if enabled, <35% for player)
        const currentHp = turn === 1 ? hp1 : hp2;
        const maxHp = attacker.maxHp;
        const rageThreshold = !attacker.isPlayer && diff.enableBossRageSkill !== false ? 0.45 : 0.35;
        if (currentHp / maxHp < rageThreshold) {
          const rageBonus = !attacker.isPlayer && diff.enableBossRageSkill !== false
            ? Math.max(12, Math.round(baseDmg * 0.3))
            : 8;
          baseDmg += rageBonus;
          log.push(`🔥 [Ярость Древнего Скарабея] ${attacker.name} впадает в бешенство (+${rageBonus} к урону)!`);
        }

        // AI Rival Armor Shield damage reduction
        if (!defender.isPlayer && (diff.rivalDamageReductionPct || 0) > 0) {
          const redPct = Math.min(60, Math.max(0, diff.rivalDamageReductionPct));
          baseDmg = Math.max(3, Math.round(baseDmg * (1 - redPct / 100)));
        }

        const finalDmg = isCrit ? baseDmg * 2 : baseDmg;

        if (turn === 1) {
          hp2 = Math.max(0, hp2 - finalDmg);
        } else {
          hp1 = Math.max(0, hp1 - finalDmg);
        }

        log.push(
          `${attacker.avatar} ${attacker.name} наносит ${finalDmg} урона ${defender.name}${
            isCrit ? ' (💥 КРИТ 2x УРОН!)' : ''
          } [Осталось HP: ${turn === 1 ? hp2 : hp1}]`
        );

        // Tank / Rival thorn reflect
        const canReflect =
          defender.archetype === 'tank' ||
          (!defender.isPlayer && diff.enableCounterAttackSkill !== false && Math.random() < 0.35);
        if (canReflect && Math.random() < (defender.isPlayer ? 0.4 : 0.52)) {
          const reflectDmg = Math.max(3, Math.round(finalDmg * (defender.isPlayer ? 0.22 : 0.28)));
          if (turn === 1) hp1 = Math.max(0, hp1 - reflectDmg);
          else hp2 = Math.max(0, hp2 - reflectDmg);
          log.push(`🛡️ [Шипы Панциря] ${defender.name} отражает ${reflectDmg} урона обратно!`);
        }
      }

      turn = turn === 1 ? 2 : 1;
    }

    const winner = hp1 > 0 ? c1 : c2;
    const loser = hp1 > 0 ? c2 : c1;
    log.push(`🏁 Победу одержал: ${winner.avatar} ${winner.name}!`);

    return { winner, loser, log };
  }

  // --- PLAY ACTIVE MATCH ---
  const handlePlayCurrentMatch = (instant: boolean = false) => {
    if (!activeTournament || isFightingMatch) return;

    const currentMatch = activeTournament.matches[activeTournament.activeMatchIndex];
    if (!currentMatch || currentMatch.isCompleted) return;

    setIsFightingMatch(true);
    setLiveP1Hp(currentMatch.c1.maxHp);
    setLiveP2Hp(currentMatch.c2.maxHp);
    playAttackSound();

    const sim = runCombatSimulation(currentMatch.c1, currentMatch.c2);
    const playerWon = sim.winner.isPlayer;
    const stepDelay = Math.max(80, Number(tournamentConfig.schedule.matchStepDelayMs || 350));

    if (instant) {
      finishMatchResolution(sim.winner, sim.log, playerWon);
    } else {
      // Step-by-step log animation
      let step = 0;
      setCombatLog([sim.log[0]]);
      const interval = setInterval(() => {
        step++;
        if (step < sim.log.length) {
          setCombatLog((prev) => [sim.log[step], ...prev]);
          playClickSound();
        } else {
          clearInterval(interval);
          finishMatchResolution(sim.winner, sim.log, playerWon);
        }
      }, stepDelay);
    }
  };

  function finishMatchResolution(winner: TournamentCombatant, fullLog: string[], playerWon: boolean) {
    setIsFightingMatch(false);
    setCombatLog(fullLog);
    const payoutDelayMs = Math.max(0, Number(tournamentConfig.schedule.payoutDelaySeconds || 0)) * 1000;

    if (playerWon) {
      playLevelUpSound();
      awardScarabXp(40);
      setScarab((prev) => ({
        ...prev,
        matchesWon: prev.matchesWon + 1
      }));
    } else {
      setScarab((prev) => ({
        ...prev,
        matchesLost: prev.matchesLost + 1
      }));
    }

    setActiveTournament((prev) => {
      if (!prev) return null;
      const updatedMatches = [...prev.matches];
      updatedMatches[prev.activeMatchIndex] = {
        ...updatedMatches[prev.activeMatchIndex],
        winner,
        isCompleted: true
      };

      // If player lost
      if (!playerWon) {
        if (prev.round === 'final') {
          playCoinSound();
          const prizeGold = prev.cup.prize2ndGold;
          const prizeCrystals = Number(prev.cup.prize2ndCrystals || 0);
          const trophies = prev.cup.prize2ndTrophies;
          const xp = prev.cup.prize2ndXp;
          setScarab((sc) => ({
            ...sc,
            trophies: sc.trophies + trophies,
            totalPrizeGold: sc.totalPrizeGold + prizeGold,
            totalPrizeCrystals: sc.totalPrizeCrystals + prizeCrystals
          }));
          setTimeout(() => {
            awardScarabXp(xp);
            onGamblingTransaction({
              gameName: `🥈 2-е место в турнире (${prev.cup.name})`,
              wonGold: prizeGold,
              wonCrystals: prizeCrystals > 0 ? prizeCrystals : undefined,
              countGame: false
            });
          }, payoutDelayMs);
          return {
            ...prev,
            matches: updatedMatches,
            isFinished: true,
            isWon: false,
            placedRank: 2
          };
        }

        if (prev.round === 'semis') {
          const p3Gold = Number(prev.cup.prize3rdGold || 0);
          const p3Crystals = Number(prev.cup.prize3rdCrystals || 0);
          const p3Trophies = Number(prev.cup.prize3rdTrophies || 0);
          const p3Xp = Number(prev.cup.prize3rdXp || 0);
          if (p3Gold > 0 || p3Crystals > 0 || p3Trophies > 0) {
            playCoinSound();
            setScarab((sc) => ({
              ...sc,
              trophies: sc.trophies + p3Trophies,
              totalPrizeGold: sc.totalPrizeGold + p3Gold,
              totalPrizeCrystals: sc.totalPrizeCrystals + p3Crystals
            }));
            setTimeout(() => {
              if (p3Xp > 0) awardScarabXp(p3Xp);
              onGamblingTransaction({
                gameName: `🥉 3-е место (Полуфинал ${prev.cup.name})`,
                wonGold: p3Gold > 0 ? p3Gold : undefined,
                wonCrystals: p3Crystals > 0 ? p3Crystals : undefined,
                countGame: false
              });
            }, payoutDelayMs);
          }
          return {
            ...prev,
            matches: updatedMatches,
            isFinished: true,
            isWon: false,
            placedRank: 3
          };
        }

        return {
          ...prev,
          matches: updatedMatches,
          isFinished: true,
          isWon: false,
          placedRank: 8
        };
      }

      // If player won in Grand Final: CHAMPION!
      if (prev.round === 'final') {
        playLevelUpSound();
        playCoinSound();
        const p1Gold = prev.cup.prize1stGold;
        const p1Crystals = prev.cup.prize1stCrystals;
        const trophies = prev.cup.prize1stTrophies;
        const xp = prev.cup.prize1stXp;

        setScarab((sc) => ({
          ...sc,
          tournamentsWon: sc.tournamentsWon + 1,
          trophies: sc.trophies + trophies,
          totalPrizeGold: sc.totalPrizeGold + p1Gold,
          totalPrizeCrystals: sc.totalPrizeCrystals + p1Crystals
        }));
        setTimeout(() => {
          awardScarabXp(xp);
          onGamblingTransaction({
            gameName: `🥇 Чемпион Турнира Скарабеев (${prev.cup.name})`,
            wonGold: p1Gold,
            wonCrystals: p1Crystals,
            countGame: true
          });
        }, payoutDelayMs);

        return {
          ...prev,
          matches: updatedMatches,
          isFinished: true,
          isWon: true,
          placedRank: 1
        };
      }

      // Otherwise, simulate other non-player matches in this round and advance to next round (buffing AI semifinalists & finalists)!
      const semiMul = Number(tournamentConfig.difficulty?.semiFinalBuffMult || 1.28);
      const finalMul = Number(tournamentConfig.difficulty?.finalBossBuffMult || 1.45);

      const buffAiCombatant = (comb: TournamentCombatant, mul: number, bonusLvl: number): TournamentCombatant => {
        if (comb.isPlayer) return comb;
        const nextHp = Math.round(comb.maxHp * mul);
        return {
          ...comb,
          level: comb.level + bonusLvl,
          maxHp: nextHp,
          hp: nextHp,
          strength: Math.round(comb.strength * mul),
          agility: Math.round(comb.agility * mul),
          armor: Math.round(comb.armor * mul),
          critChance: Math.min(78, comb.critChance + bonusLvl * 4)
        };
      };

      if (prev.round === 'quarters') {
        const roundWinners: TournamentCombatant[] = [winner];
        for (let i = 1; i < 4; i++) {
          const simOther = runCombatSimulation(updatedMatches[i].c1, updatedMatches[i].c2);
          updatedMatches[i].winner = simOther.winner;
          updatedMatches[i].isCompleted = true;
          roundWinners.push(buffAiCombatant(simOther.winner, semiMul, 2));
        }

        const semiMatches: BracketMatch[] = [
          {
            id: 's_0',
            round: 'semis',
            roundName: 'Полуфинал (Матч #1)',
            indexInRound: 0,
            c1: roundWinners[0],
            c2: roundWinners[1],
            winner: null,
            isCompleted: false
          },
          {
            id: 's_1',
            round: 'semis',
            roundName: 'Полуфинал (Матч #2)',
            indexInRound: 1,
            c1: roundWinners[2],
            c2: roundWinners[3],
            winner: null,
            isCompleted: false
          }
        ];

        return {
          ...prev,
          round: 'semis',
          matches: semiMatches,
          activeMatchIndex: 0
        };
      }

      if (prev.round === 'semis') {
        const otherSemi = runCombatSimulation(updatedMatches[1].c1, updatedMatches[1].c2);
        updatedMatches[1].winner = otherSemi.winner;
        updatedMatches[1].isCompleted = true;

        const finalMatch: BracketMatch[] = [
          {
            id: 'f_0',
            round: 'final',
            roundName: '👑 Гранд-Финал за Кубок!',
            indexInRound: 0,
            c1: winner,
            c2: buffAiCombatant(otherSemi.winner, finalMul, 3),
            winner: null,
            isCompleted: false
          }
        ];

        return {
          ...prev,
          round: 'final',
          matches: finalMatch,
          activeMatchIndex: 0
        };
      }

      return prev;
    });
  }

  const handleResetTournament = () => {
    setActiveTournament(null);
    setCombatLog([]);
  };

  const handleSaveName = () => {
    if (nameInput.trim().length > 0) {
      setScarab((prev) => ({ ...prev, name: nameInput.trim() }));
    }
    setIsRenaming(false);
  };

  const isSeasonRewardReady = nowTs >= tournamentConfig.schedule.nextRewardDistributionAt;

  return (
    <div className="space-y-3 pb-4">
      {/* Top Tournament Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-base sm:text-lg">🏆</span>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-xs sm:text-sm font-black text-amber-300">
                {tournamentConfig.schedule.seasonTitle || 'Ежемесячный Турнир Скарабеев'}
              </h3>
              <span className="rounded bg-amber-500/20 border border-amber-400/50 px-1.5 py-0.2 text-[8.5px] font-black text-amber-200">
                📅 Раз в месяц (Сезон #{tournamentConfig.schedule.seasonNumber || 1})
              </span>
              <span className="rounded bg-rose-950/90 border border-rose-500/50 px-1.5 py-0.2 text-[8.5px] font-black text-rose-300">
                🔥 Сила соперников: x{(tournamentConfig.difficulty?.globalStatMultiplier || 1.55).toFixed(2)}
              </span>
            </div>
            <p className="text-[9px] text-slate-400">
              Ежемесячный чемпионат (раз в {tournamentConfig.schedule.seasonCycleDays || 30} дн.) • Усиленные соперники-титаны и призовой фонд!
            </p>
          </div>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 p-0.5 rounded-lg text-[9px] font-bold">
          <button
            type="button"
            onClick={() => setSubTab('arena')}
            className={`px-2 py-1 rounded transition-colors cursor-pointer ${
              subTab === 'arena'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚔️ Турнир
          </button>
          <button
            type="button"
            onClick={() => setSubTab('training')}
            className={`px-2 py-1 rounded transition-colors cursor-pointer ${
              subTab === 'training'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🏋️ Мой боец (Lv.{scarab.level})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('leaderboard')}
            className={`px-2 py-1 rounded transition-colors cursor-pointer ${
              subTab === 'leaderboard'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🏆 Рейтинг (Топ)
          </button>
        </div>
      </div>

      {/* Compact Monthly Seasonal Reward Distribution Countdown Bar */}
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[9px]">
        <div className="flex flex-wrap items-center gap-2 text-slate-300">
          <span className="font-black text-amber-300">📅 Финал месяца и выдача наград (Топ-3):</span>
          <span className="rounded bg-slate-950/80 border border-slate-800 px-1.5 py-0.5 font-mono font-black text-emerald-300">
            {isSeasonRewardReady
              ? '🎁 ГОТОВО К ВЫДАЧЕ!'
              : `Через ${formatRewardCountdown(tournamentConfig.schedule.nextRewardDistributionAt)}`}
          </span>
          <span className="rounded bg-slate-950/90 border border-cyan-500/40 px-1.5 py-0.5 font-black text-cyan-300">
            {maxEntriesAllowed > 0
              ? `🎟️ Выступлений в этом месяце: ${entriesUsedThisMonth} / ${maxEntriesAllowed}`
              : '🎟️ Выступления: Без лимита'}
          </span>
          <span className="text-[8.5px] text-slate-400">
            (🥇 {(tournamentConfig.schedule.top1Gold ?? 250).toLocaleString()}🪙+{tournamentConfig.schedule.top1Crystals ?? 7}💎 • 🥈 {(tournamentConfig.schedule.top2Gold ?? 150).toLocaleString()}🪙+{tournamentConfig.schedule.top2Crystals ?? 4}💎 • 🥉 {(tournamentConfig.schedule.top3Gold ?? 80).toLocaleString()}🪙+{tournamentConfig.schedule.top3Crystals ?? 2}💎)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasMonthlyLimitReached && isAdminUser && (
            <button
              type="button"
              onClick={handleResetMyMonthlyEntryLimit}
              className="rounded-lg border border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 px-2 py-1 text-[8.5px] font-black text-cyan-200 cursor-pointer"
              title="Админ-кнопка: сбросить месячный лимит участий"
            >
              🔄 Сбросить лимит месяца (Админ)
            </button>
          )}
          {isSeasonRewardReady && (
            <button
              type="button"
              onClick={handleClaimSeasonRewardIfReady}
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-amber-400 px-2.5 py-1 text-[9px] font-black text-slate-950 shadow cursor-pointer"
            >
              🎁 Получить награду месяца
            </button>
          )}
        </div>
      </div>

      {seasonRewardNotice && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-2.5 py-1.5 text-[9.5px] font-bold text-emerald-200 flex items-center justify-between">
          <span>{seasonRewardNotice}</span>
          <button
            type="button"
            onClick={() => setSeasonRewardNotice(null)}
            className="text-slate-400 hover:text-white ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB 1: ARENA & ACTIVE TOURNAMENT
      ========================================================================= */}
      {subTab === 'arena' && (
        <div className="space-y-3">
          {!activeTournament ? (
            /* Select Tournament Cup */
            <div className="space-y-3">
              {/* Personal Fighter Glance Banner */}
              <div className="rounded-xl border border-amber-500/30 bg-slate-900/90 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/50 bg-amber-950/60 text-xl shadow">
                    {scarab.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-black text-amber-200">
                      <span>{scarab.name}</span>
                      <span className="rounded bg-slate-800 border border-slate-700 px-1 py-0.2 text-[8px] text-amber-400">
                        Lv.{scarab.level}
                      </span>
                      <span className="rounded bg-amber-950/80 border border-amber-600/40 px-1 py-0.2 text-[8px] text-amber-300">
                        {SCARAB_ARCHETYPES[scarab.archetype].label}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>❤️ HP: {scarab.maxHp}</span>
                      <span>⚔️ Сила: {scarab.strength}</span>
                      <span>💨 Ловкость: {scarab.agility}</span>
                      <span>🛡️ Броня: {scarab.armor}</span>
                      <span>💥 Крит: {scarab.critChance}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[9px] text-slate-400">Трофеи:</div>
                    <div className="text-xs font-black text-yellow-300">🏆 {scarab.trophies}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubTab('training')}
                    className="rounded-lg border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 text-[9px] font-black text-amber-300 cursor-pointer"
                  >
                    🏋️ Прокачать
                  </button>
                </div>
              </div>

              {/* Tournament Cup Tiers Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {activeCupsList.map((cup) => {
                  const isSelected = selectedCupId === cup.id;
                  const canAfford =
                    hero.gold >= cup.entryFeeGold &&
                    tournamentConfig.enabled !== false &&
                    !hasMonthlyLimitReached;

                  return (
                    <div
                      key={cup.id}
                      onClick={() => setSelectedCupId(cup.id)}
                      className={`relative rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? `${cup.tierColor} ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]`
                          : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg">{cup.icon}</span>
                          <span className="rounded bg-slate-950/80 border border-slate-700 px-1.5 py-0.5 text-[8.5px] font-black text-amber-300">
                            Взнос: {cup.entryFeeGold.toLocaleString()} 🪙
                          </span>
                        </div>
                        <h4 className="mt-1 text-xs font-black text-white">{cup.name}</h4>
                        <p className="mt-0.5 text-[8.5px] text-slate-400 leading-snug">{cup.desc}</p>
                      </div>

                      <div className="mt-3 border-t border-slate-800/80 pt-2 space-y-1 text-[8.5px]">
                        <div className="flex items-center justify-between font-bold text-emerald-300">
                          <span>🥇 1-е место:</span>
                          <span>
                            {cup.prize1stGold.toLocaleString()} 🪙
                            {cup.prize1stCrystals > 0 ? ` + ${cup.prize1stCrystals} 💎` : ''} (+{cup.prize1stTrophies}🏆)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span>🥈 2-е место:</span>
                          <span>
                            {cup.prize2ndGold.toLocaleString()} 🪙
                            {cup.prize2ndCrystals > 0 ? ` + ${cup.prize2ndCrystals} 💎` : ''} (+{cup.prize2ndTrophies}🏆)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-amber-300/90">
                          <span>🥉 3-е место (1/2):</span>
                          <span>
                            {(cup.prize3rdGold || 0).toLocaleString()} 🪙
                            {(cup.prize3rdCrystals || 0) > 0 ? ` + ${cup.prize3rdCrystals} 💎` : ''} (+{cup.prize3rdTrophies || 0}🏆)
                          </span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCupId(cup.id);
                            handleStartTournament(cup.id);
                          }}
                          className={`w-full rounded-lg py-2 text-center text-xs font-black cursor-pointer shadow transition-all ${
                            canAfford
                              ? 'border border-amber-400 bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-110 text-slate-950'
                              : 'border border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {tournamentConfig.enabled === false
                            ? 'Турниры временно закрыты'
                            : hasMonthlyLimitReached
                            ? `Участие 1 раз в месяц (${entriesUsedThisMonth}/${maxEntriesAllowed})`
                            : canAfford
                            ? `Вступить (${cup.entryFeeGold.toLocaleString()} 🪙)`
                            : `Не хватает золота`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Active Tournament Live Bracket & Matches */
            <div className="space-y-3">
              {/* Cup Banner Header */}
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{activeTournament.cup.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 font-black text-amber-300 text-xs sm:text-sm">
                      <span>{activeTournament.cup.name}</span>
                      <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 text-[8.5px] text-amber-200">
                        {activeTournament.round === 'quarters'
                          ? '1/4 финала'
                          : activeTournament.round === 'semis'
                          ? 'Полуфинал'
                          : '👑 ГРАНД-ФИНАЛ'}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-300">
                      Призовой фонд: <strong className="text-emerald-300">{activeTournament.cup.prize1stGold.toLocaleString()} 🪙 + {activeTournament.cup.prize1stCrystals} 💎</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetTournament}
                  className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[9px] font-black text-slate-300 cursor-pointer"
                >
                  ✕ Покинуть турнир
                </button>
              </div>

              {/* Tournament Winner / Finished Banner */}
              {activeTournament.isFinished && (
                <div
                  className={`rounded-xl border-2 p-3 text-center space-y-2 ${
                    activeTournament.isWon
                      ? 'border-yellow-400 bg-gradient-to-br from-amber-500/30 via-yellow-900/40 to-amber-950/50 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                      : activeTournament.placedRank === 2 || activeTournament.placedRank === 3
                      ? 'border-amber-500/50 bg-amber-950/25'
                      : 'border-red-500/40 bg-red-950/20'
                  }`}
                >
                  <div className="text-2xl">
                    {activeTournament.isWon
                      ? '🏆 👑 🌟'
                      : activeTournament.placedRank === 2
                      ? '🥈'
                      : activeTournament.placedRank === 3
                      ? '🥉'
                      : '💀'}
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-white">
                    {activeTournament.isWon
                      ? 'ПОЗДРАВЛЯЕМ! ВЫ ЧЕМПИОН ТУРНИРА (1-е МЕСТО)!'
                      : activeTournament.placedRank === 2
                      ? '🥈 ВЫ ФИНАЛИСТ ТУРНИРА (2-е МЕСТО)!'
                      : activeTournament.placedRank === 3
                      ? '🥉 ПРИЗЁР ПОЛУФИНАЛА (3-е МЕСТО)!'
                      : 'Ваш скарабей выбыл в 1/4 финала'}
                  </h4>
                  <p className="text-[10px] text-slate-300 max-w-md mx-auto">
                    {activeTournament.isWon
                      ? `Ваш боец ${scarab.name} одолел всех соперников! Вы получили главный призовой фонд: +${activeTournament.cup.prize1stGold.toLocaleString()} 🪙, +${activeTournament.cup.prize1stCrystals} 💎 и +${activeTournament.cup.prize1stTrophies} кубков!`
                      : activeTournament.placedRank === 2
                      ? `Награда за 2-е место: +${activeTournament.cup.prize2ndGold.toLocaleString()} 🪙${activeTournament.cup.prize2ndCrystals ? `, +${activeTournament.cup.prize2ndCrystals} 💎` : ''} и +${activeTournament.cup.prize2ndTrophies} кубков!`
                      : activeTournament.placedRank === 3
                      ? `Награда за 3-е место: +${(activeTournament.cup.prize3rdGold || 0).toLocaleString()} 🪙${activeTournament.cup.prize3rdCrystals ? `, +${activeTournament.cup.prize3rdCrystals} 💎` : ''} и +${activeTournament.cup.prize3rdTrophies || 0} кубков!`
                      : `Прокачайте Силу, Ловкость и Панцирь вашего жука в тренировочном лагере и возьмите реванш!`}
                  </p>
                  <button
                    type="button"
                    onClick={handleResetTournament}
                    className="rounded-xl border border-amber-400 bg-amber-500 hover:bg-amber-400 py-1.5 px-4 text-xs font-black text-slate-950 cursor-pointer shadow"
                  >
                    Завершить и вернуться к выбору кубка
                  </button>
                </div>
              )}

              {/* Tournament Bracket Tree Display */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[9.5px] font-black uppercase text-slate-400 mb-2 flex items-center justify-between">
                  <span>Турнирная сетка (Раунд: {activeTournament.round.toUpperCase()}):</span>
                  <span className="text-amber-400">8 бойцов • Плей-офф на выбывание</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {activeTournament.matches.map((m, idx) => {
                    const isCurrent = idx === activeTournament.activeMatchIndex && !m.isCompleted;
                    return (
                      <div
                        key={m.id}
                        className={`rounded-lg border p-2 flex flex-col justify-between text-[9px] ${
                          isCurrent
                            ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400'
                            : m.isCompleted
                            ? 'border-slate-800 bg-slate-950/70 text-slate-400'
                            : 'border-slate-800 bg-slate-950/40 text-slate-500'
                        }`}
                      >
                        <div className="font-bold text-slate-400 text-[8px] mb-1 flex items-center justify-between">
                          <span>{m.roundName}</span>
                          {m.isCompleted && <span className="text-emerald-400">✓ Завершён</span>}
                        </div>

                        {/* Combatant 1 */}
                        <div
                          className={`flex items-center justify-between p-1 rounded ${
                            m.winner?.id === m.c1.id
                              ? 'bg-emerald-950/80 text-emerald-300 font-black'
                              : m.c1.isPlayer
                              ? 'bg-amber-950/40 text-amber-300 font-bold'
                              : 'text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <span>{m.c1.avatar}</span>
                            <span className="truncate">{m.c1.name}</span>
                          </div>
                          <span className="text-[8px] opacity-75">Lv.{m.c1.level}</span>
                        </div>

                        <div className="text-center text-[7.5px] text-slate-600 my-0.5">VS</div>

                        {/* Combatant 2 */}
                        <div
                          className={`flex items-center justify-between p-1 rounded ${
                            m.winner?.id === m.c2.id
                              ? 'bg-emerald-950/80 text-emerald-300 font-black'
                              : m.c2.isPlayer
                              ? 'bg-amber-950/40 text-amber-300 font-bold'
                              : 'text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <span>{m.c2.avatar}</span>
                            <span className="truncate">{m.c2.name}</span>
                          </div>
                          <span className="text-[8px] opacity-75">Lv.{m.c2.level}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Match Arena Card (if tournament not finished) */}
              {!activeTournament.isFinished && (
                <div className="rounded-xl border border-amber-500/50 bg-slate-900 p-3 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black text-amber-300">
                      ⚔️ Текущий матч: {activeTournament.matches[activeTournament.activeMatchIndex]?.roundName}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Победитель проходит дальше по сетке
                    </span>
                  </div>

                  {/* Side-by-Side Combatant Cards */}
                  {(() => {
                    const match = activeTournament.matches[activeTournament.activeMatchIndex];
                    if (!match) return null;
                    const c1 = match.c1;
                    const c2 = match.c2;

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Fighter 1 (Player) */}
                        <div className="rounded-xl border border-amber-500/60 bg-gradient-to-b from-amber-950/30 to-slate-950 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[8.5px] font-black text-amber-300">
                              Ваш скарабей
                            </span>
                            <span className="text-[9px] text-slate-400">Ур. {c1.level}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="text-2xl">{c1.avatar}</div>
                            <div>
                              <div className="text-xs font-black text-white">{c1.name}</div>
                              <div className="text-[8.5px] text-amber-300">
                                {SCARAB_ARCHETYPES[c1.archetype].label} • {SCARAB_ARCHETYPES[c1.archetype].badge}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 grid grid-cols-3 gap-1 text-[8.5px] text-slate-300 border-t border-slate-800/80 pt-1.5">
                            <div>❤️ HP: {c1.maxHp}</div>
                            <div>⚔️ Сила: {c1.strength}</div>
                            <div>💨 Ловк: {c1.agility}</div>
                            <div>🛡️ Броня: {c1.armor}</div>
                            <div className="col-span-2 text-amber-300 font-bold">💥 Крит 2x: {c1.critChance}%</div>
                          </div>
                        </div>

                        {/* Fighter 2 (Opponent) */}
                        <div className="rounded-xl border border-purple-500/60 bg-gradient-to-b from-purple-950/30 to-slate-950 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-purple-500/20 border border-purple-500/40 px-1.5 py-0.5 text-[8.5px] font-black text-purple-300">
                              Соперник ({c2.trainerNick})
                            </span>
                            <span className="text-[9px] text-slate-400">Ур. {c2.level}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="text-2xl">{c2.avatar}</div>
                            <div>
                              <div className="text-xs font-black text-white">{c2.name}</div>
                              <div className="text-[8.5px] text-purple-300">
                                {SCARAB_ARCHETYPES[c2.archetype].label} • {SCARAB_ARCHETYPES[c2.archetype].badge}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 grid grid-cols-3 gap-1 text-[8.5px] text-slate-300 border-t border-slate-800/80 pt-1.5">
                            <div>❤️ HP: {c2.maxHp}</div>
                            <div>⚔️ Сила: {c2.strength}</div>
                            <div>💨 Ловк: {c2.agility}</div>
                            <div>🛡️ Броня: {c2.armor}</div>
                            <div className="col-span-2 text-purple-300 font-bold">💥 Крит 2x: {c2.critChance}%</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Battle Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isFightingMatch}
                      onClick={() => handlePlayCurrentMatch(false)}
                      className="flex-1 rounded-xl border border-amber-400 bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-110 py-2 px-3 text-xs font-black text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer disabled:opacity-50"
                    >
                      {isFightingMatch ? '⚔️ Идёт поединок на арене...' : '⚡ Начать поединок'}
                    </button>
                    <button
                      type="button"
                      disabled={isFightingMatch}
                      onClick={() => handlePlayCurrentMatch(true)}
                      className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2 px-3 text-xs font-black text-slate-200 cursor-pointer disabled:opacity-50"
                    >
                      ⏩ Быстрый бой
                    </button>
                  </div>
                </div>
              )}

              {/* Combat Log */}
              {combatLog.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 max-h-40 overflow-y-auto space-y-1">
                  <div className="text-[9px] font-black uppercase text-slate-400 flex items-center justify-between">
                    <span>📜 Хроника турнирного поединка:</span>
                    <span className="text-[8px] text-amber-400/80">💥 2.0x Крит | 💨 Уворот и контрудар | 🔥 Ярость &lt;35% HP</span>
                  </div>
                  {combatLog.map((line, idx) => (
                    <div key={idx} className="text-[10px] text-slate-200 font-medium leading-snug">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: TRAINING CAMP & STATS UPGRADE
      ========================================================================= */}
      {subTab === 'training' && (
        <div className="space-y-3">
          {/* Main Scarab Profile & Archetype Selection */}
          <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/50 bg-amber-950/70 text-2xl shadow">
                  {scarab.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {!isRenaming ? (
                      <>
                        <span className="text-sm font-black text-amber-200">{scarab.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNameInput(scarab.name);
                            setIsRenaming(true);
                          }}
                          className="text-[10px] text-slate-400 hover:text-amber-300 cursor-pointer"
                        >
                          ✏️
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          maxLength={16}
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          className="rounded border border-amber-500/60 bg-slate-950 px-2 py-0.5 text-xs font-black text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSaveName}
                          className="rounded bg-amber-500 px-2 py-0.5 text-[9px] font-black text-slate-950 cursor-pointer"
                        >
                          OK
                        </button>
                      </div>
                    )}
                    <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[8.5px] font-black text-amber-400">
                      Уровень {scarab.level}
                    </span>
                  </div>

                  <div className="text-[9px] text-slate-400 mt-0.5">
                    Тренер: <strong className="text-slate-200">{scarab.trainerNick}</strong> • Трофеи: <strong className="text-yellow-300">🏆 {scarab.trophies}</strong>
                  </div>
                </div>
              </div>

              {/* Avatar Selector Icons */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-lg">
                {['🪲', '🦂', '🪳', '👑', '⚡', '💎'].map((ico) => (
                  <button
                    key={ico}
                    type="button"
                    onClick={() => setScarab((prev) => ({ ...prev, avatar: ico }))}
                    className={`h-7 w-7 rounded flex items-center justify-center text-sm cursor-pointer ${
                      scarab.avatar === ico ? 'bg-amber-500/30 border border-amber-400' : 'hover:bg-slate-800'
                    }`}
                  >
                    {ico}
                  </button>
                ))}
              </div>
            </div>

            {/* XP Level Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9px] font-bold">
                <span className="text-slate-400">Опыт бойца (XP):</span>
                <span className="text-amber-300">{scarab.xp} / {scarab.xpToNext} XP</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((scarab.xp / scarab.xpToNext) * 100))}%` }}
                />
              </div>
            </div>

            {/* Archetype Selector */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400">
                Боевой архетип скарабея (выберите стиль боя):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(Object.keys(SCARAB_ARCHETYPES) as TournamentScarabArchetypeKey[]).map((key) => {
                  const meta = SCARAB_ARCHETYPES[key];
                  const active = scarab.archetype === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setScarab((prev) => ({ ...prev, archetype: key }))}
                      className={`rounded-xl border p-2 text-left transition-all cursor-pointer ${
                        active
                          ? `${meta.color} ring-1 ring-amber-400 shadow`
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1 text-[10px] font-black text-white">
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </div>
                      <div className="text-[7.5px] text-slate-300 leading-tight mt-1">
                        {meta.bonusDesc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tournament Lifetime Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[9px]">
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-1.5 text-center">
                <div className="text-slate-400">Кубки Фараона:</div>
                <div className="text-xs font-black text-yellow-300">🏆 {scarab.trophies}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-1.5 text-center">
                <div className="text-slate-400">Турниров выиграно:</div>
                <div className="text-xs font-black text-emerald-300">
                  {scarab.tournamentsWon} / {scarab.tournamentsPlayed}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-1.5 text-center">
                <div className="text-slate-400">Матчей (Винрейт):</div>
                <div className="text-xs font-black text-amber-300">
                  {scarab.matchesWon}W - {scarab.matchesLost}L (
                  {scarab.matchesWon + scarab.matchesLost > 0
                    ? Math.round((scarab.matchesWon / (scarab.matchesWon + scarab.matchesLost)) * 100)
                    : 0}
                  %)
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-1.5 text-center">
                <div className="text-slate-400">Призовые в сумме:</div>
                <div className="text-xs font-black text-white">
                  🪙 {scarab.totalPrizeGold.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Stat Upgrade Stations */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-amber-300 uppercase tracking-wide">
              Тренировочные станции лагеря:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Strength Station */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-white text-xs">
                    <span>⚔️ Сила атаки:</span>
                    <span className="text-amber-400 text-sm">{scarab.strength}</span>
                  </div>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">
                    Увеличивает базовый урон по соперникам
                  </div>
                </div>
                <button
                  type="button"
                  disabled={hero.gold < costStrength}
                  onClick={handleTrainStrength}
                  className="rounded-lg border border-amber-500/50 bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1.5 text-[10px] font-black cursor-pointer shadow disabled:opacity-40"
                >
                  +{trCfg.strGain} Силы ({costStrength} 🪙)
                </button>
              </div>

              {/* Agility Station */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-white text-xs">
                    <span>💨 Ловкость:</span>
                    <span className="text-cyan-300 text-sm">{scarab.agility}</span>
                  </div>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">
                    Повышает уворот (~{Math.min(55, scarab.agility * 1.4)}%) и первый ход
                  </div>
                </div>
                <button
                  type="button"
                  disabled={hero.gold < costAgility}
                  onClick={handleTrainAgility}
                  className="rounded-lg border border-cyan-500/50 bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-2.5 py-1.5 text-[10px] font-black cursor-pointer shadow disabled:opacity-40"
                >
                  +{trCfg.agiGain} Ловкости ({costAgility} 🪙)
                </button>
              </div>

              {/* Armor & Vitality Station */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-white text-xs">
                    <span>🛡️ Панцирь и HP:</span>
                    <span className="text-emerald-400 text-sm">{scarab.armor} Бр / {scarab.maxHp} HP</span>
                  </div>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">
                    Поглощает входящий урон и даёт здоровье
                  </div>
                </div>
                <button
                  type="button"
                  disabled={hero.gold < costArmor}
                  onClick={handleTrainArmor}
                  className="rounded-lg border border-emerald-500/50 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2.5 py-1.5 text-[10px] font-black cursor-pointer shadow disabled:opacity-40"
                >
                  +{trCfg.hpGain} HP & +{trCfg.armorGain} Бр ({costArmor} 🪙)
                </button>
              </div>

              {/* Critical Chance Station */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-white text-xs">
                    <span>💥 Крит 2x урон:</span>
                    <span className="text-purple-300 text-sm">{scarab.critChance}%</span>
                  </div>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">
                    Шанс нанести сокрушительный 2.0x урон (Макс: {trCfg.maxCritChance || 65}%)
                  </div>
                </div>
                <button
                  type="button"
                  disabled={hero.crystals < costCritCrystals || scarab.critChance >= (trCfg.maxCritChance || 65)}
                  onClick={handleTrainCrit}
                  className="rounded-lg border border-purple-500/50 bg-purple-500 hover:bg-purple-400 text-slate-950 px-2.5 py-1.5 text-[10px] font-black cursor-pointer shadow disabled:opacity-40"
                >
                  +{trCfg.critGain}% Крита ({costCritCrystals} 💎)
                </button>
              </div>

              {/* XP Elixir */}
              <div className="sm:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-white text-xs">
                    <span>🧪 Настойка Опыта Арены:</span>
                    <span className="text-yellow-300 text-xs">+{trCfg.xpElixirGain} XP</span>
                  </div>
                  <div className="text-[8.5px] text-slate-400 mt-0.5">
                    Ускоряет повышение уровня вашего бойца
                  </div>
                </div>
                <button
                  type="button"
                  disabled={hero.gold < costXpElixir}
                  onClick={handleBuyXpElixir}
                  className="rounded-lg border border-yellow-500/50 bg-yellow-500 hover:bg-yellow-400 text-slate-950 px-3 py-1.5 text-[10px] font-black cursor-pointer shadow disabled:opacity-40"
                >
                  Принять настойку ({costXpElixir} 🪙)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: TOURNAMENT LEADERBOARD & HALL OF FAME
      ========================================================================= */}
      {subTab === 'leaderboard' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-500/30 bg-slate-900 p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <div>
                <h4 className="font-black text-amber-300 text-xs">Таблица лидеров Турнира Скарабеев</h4>
                <p className="text-[8.5px] text-slate-400">
                  Лучшие тренеры Пирамиды по количеству заработанных кубков и побед
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[8.5px] text-slate-400">Ваш ранг:</div>
              <div className="text-xs font-black text-yellow-300">
                #{Math.max(1, leaderboard.findIndex((e) => e.isPlayer) + 1)} (🏆 {scarab.trophies})
              </div>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[9.5px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900 text-slate-400">
                    <th className="py-2 px-2.5">#</th>
                    <th className="py-2 px-2.5">Тренер и Скарабей</th>
                    <th className="py-2 px-2.5">Кубки</th>
                    <th className="py-2 px-2.5">Победы / Бои</th>
                    <th className="py-2 px-2.5">Призовые</th>
                    <th className="py-2 px-2.5 text-right">Инфо</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {leaderboard.map((entry, idx) => {
                    const rank = idx + 1;
                    const isPlayerRow = entry.isPlayer || entry.trainerNick.toLowerCase() === trainerKey.toLowerCase();
                    const winrate =
                      entry.matchesWon + entry.matchesLost > 0
                        ? Math.round((entry.matchesWon / (entry.matchesWon + entry.matchesLost)) * 100)
                        : 0;

                    return (
                      <tr
                        key={entry.trainerNick}
                        className={`transition-colors ${
                          isPlayerRow
                            ? 'bg-amber-500/15 font-black text-amber-200'
                            : 'hover:bg-slate-900/60 text-slate-300'
                        }`}
                      >
                        <td className="py-2 px-2.5 font-black">
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{entry.scarabAvatar}</span>
                            <div>
                              <div className="flex items-center gap-1">
                                <span className={isPlayerRow ? 'text-amber-300' : 'text-white'}>
                                  {entry.trainerNick}
                                </span>
                                {isPlayerRow && (
                                  <span className="rounded bg-amber-500 px-1 py-0.2 text-[7px] text-slate-950 font-black">
                                    ВЫ
                                  </span>
                                )}
                              </div>
                              <div className="text-[8px] text-slate-400">
                                {entry.scarabName} (Lv.{entry.level} • {SCARAB_ARCHETYPES[entry.archetype]?.label || entry.archetype})
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2.5 font-black text-yellow-300">
                          🏆 {entry.trophies.toLocaleString()}
                        </td>
                        <td className="py-2 px-2.5">
                          <div>{entry.tournamentsWon} кубков</div>
                          <div className="text-[8px] text-slate-400">{entry.matchesWon}W ({winrate}%)</div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="text-emerald-300">🪙 {entry.totalPrizeGold.toLocaleString()}</span>
                          {entry.totalPrizeCrystals > 0 && (
                            <span className="text-purple-300 ml-1">💎 {entry.totalPrizeCrystals}</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectedEntry(entry)}
                            className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[8.5px] font-bold text-slate-300 cursor-pointer"
                          >
                            🔍 Осмотреть
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inspect Rival Scarab Modal */}
          {inspectedEntry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
              <div className="w-full max-w-sm rounded-2xl border border-amber-500/60 bg-slate-900 p-4 space-y-3 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{inspectedEntry.scarabAvatar}</span>
                    <div>
                      <h4 className="text-xs font-black text-amber-300">{inspectedEntry.scarabName}</h4>
                      <p className="text-[8.5px] text-slate-400">Тренер: {inspectedEntry.trainerNick}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectedEntry(null)}
                    className="text-base font-bold text-slate-400 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1.5 text-[9.5px]">
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Боевой архетип:</span>
                    <span className="font-bold text-amber-300">
                      {SCARAB_ARCHETYPES[inspectedEntry.archetype]?.label} ({SCARAB_ARCHETYPES[inspectedEntry.archetype]?.badge})
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Уровень скарабея:</span>
                    <span className="font-bold text-white">Ур. {inspectedEntry.level}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Здоровье (HP):</span>
                    <span className="font-bold text-emerald-400">{inspectedEntry.inspectStats.hp}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Сила атаки:</span>
                    <span className="font-bold text-amber-400">{inspectedEntry.inspectStats.strength}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Ловкость (Уворот):</span>
                    <span className="font-bold text-cyan-300">{inspectedEntry.inspectStats.agility} (~{Math.min(55, inspectedEntry.inspectStats.agility * 1.4)}%)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Броня (Панцирь):</span>
                    <span className="font-bold text-slate-200">{inspectedEntry.inspectStats.armor}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Шанс критического удара (2x):</span>
                    <span className="font-bold text-purple-300">{inspectedEntry.inspectStats.critChance}%</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 py-1">
                    <span className="text-slate-400">Выиграно золота:</span>
                    <span className="font-bold text-yellow-300">🪙 {inspectedEntry.totalPrizeGold.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectedEntry(null)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-1.5 text-xs font-black text-white cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


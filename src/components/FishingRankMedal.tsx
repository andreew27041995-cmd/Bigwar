import React from 'react';
import { HeroState } from '../types/game';
import { RealtimePlayer } from '../utils/supabase';

export type FishingMedalRank = 1 | 2 | 3;

interface FishingRankMedalProps {
  rank?: number | null;
  fishCaught?: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

export const FISHING_MEDAL_META: Record<
  FishingMedalRank,
  {
    rank: FishingMedalRank;
    title: string;
    shortTitle: string;
    placeLabel: string;
    weeklyRewardText: string;
    borderCls: string;
    bgCls: string;
    textCls: string;
    badgeBgCls: string;
    glowCls: string;
    gradId: string;
    finGradId: string;
    stop1: string;
    stop2: string;
    stop3: string;
    finColor: string;
    eyeColor: string;
    ribbonColor: string;
  }
> = {
  1: {
    rank: 1,
    title: 'Золотая медаль Рыбака • 1 место',
    shortTitle: 'Золотая Рыба (1 место)',
    placeLabel: '1 МЕСТО',
    weeklyRewardText: '500 💎 в неделю',
    borderCls: 'border-amber-300',
    bgCls: 'from-amber-950/95 via-yellow-900/75 to-amber-950/95',
    textCls: 'text-yellow-200',
    badgeBgCls: 'bg-amber-400 text-slate-950 border-yellow-200',
    glowCls: 'shadow-[0_0_16px_rgba(250,204,21,0.75)]',
    gradId: 'fish_medal_gold_grad',
    finGradId: 'fish_medal_gold_fin',
    stop1: '#fef08a',
    stop2: '#f59e0b',
    stop3: '#b45309',
    finColor: '#fde047',
    eyeColor: '#0284c7',
    ribbonColor: '#dc2626'
  },
  2: {
    rank: 2,
    title: 'Серебряная медаль Рыбака • 2 место',
    shortTitle: 'Серебряная Рыба (2 место)',
    placeLabel: '2 МЕСТО',
    weeklyRewardText: '250 💎 в неделю',
    borderCls: 'border-slate-200',
    bgCls: 'from-slate-900/95 via-slate-700/75 to-slate-900/95',
    textCls: 'text-slate-100',
    badgeBgCls: 'bg-slate-200 text-slate-950 border-white',
    glowCls: 'shadow-[0_0_15px_rgba(226,232,240,0.7)]',
    gradId: 'fish_medal_silver_grad',
    finGradId: 'fish_medal_silver_fin',
    stop1: '#ffffff',
    stop2: '#cbd5e1',
    stop3: '#475569',
    finColor: '#e2e8f0',
    eyeColor: '#0ea5e9',
    ribbonColor: '#2563eb'
  },
  3: {
    rank: 3,
    title: 'Бронзовая медаль Рыбака • 3 место',
    shortTitle: 'Бронзовая Рыба (3 место)',
    placeLabel: '3 МЕСТО',
    weeklyRewardText: '100 💎 в неделю',
    borderCls: 'border-orange-400',
    bgCls: 'from-orange-950/95 via-amber-900/70 to-stone-950/95',
    textCls: 'text-orange-200',
    badgeBgCls: 'bg-orange-500 text-slate-950 border-orange-200',
    glowCls: 'shadow-[0_0_14px_rgba(249,115,22,0.7)]',
    gradId: 'fish_medal_bronze_grad',
    finGradId: 'fish_medal_bronze_fin',
    stop1: '#fed7aa',
    stop2: '#ea580c',
    stop3: '#7c2d12',
    finColor: '#fb923c',
    eyeColor: '#fde047',
    ribbonColor: '#059669'
  }
};

/**
 * Extracts how many fish a player has caught for the weekly fishing leaderboard.
 */
export function getPlayerWeeklyFishCount(
  player: Partial<RealtimePlayer> | null | undefined,
  currentWeekId?: string
): number {
  if (!player) return 0;
  const fState: any = (player as any).fishingState || (player as any).fishing_state;
  if (fState && typeof fState === 'object') {
    if (
      currentWeekId &&
      fState.fishingWeekId &&
      fState.fishingWeekId === currentWeekId &&
      typeof fState.weeklyFishCaught === 'number'
    ) {
      return Math.max(0, Math.floor(fState.weeklyFishCaught));
    }
    if (typeof fState.weeklyFishCaught === 'number' && !fState.fishingWeekId) {
      return Math.max(0, Math.floor(fState.weeklyFishCaught));
    }
    if (typeof fState.totalFishCaught === 'number') {
      return Math.max(0, Math.floor(fState.totalFishCaught));
    }
  }
  return 0;
}

/**
 * Extracts all-time total fish caught by a player.
 */
export function getPlayerTotalFishCount(
  player: Partial<RealtimePlayer> | null | undefined
): number {
  if (!player) return 0;
  const fState: any = (player as any).fishingState || (player as any).fishing_state;
  if (fState && typeof fState === 'object' && typeof fState.totalFishCaught === 'number') {
    return Math.max(0, Math.floor(fState.totalFishCaught));
  }
  return 0;
}

/**
 * Computes the player's rank (strictly 1, 2, or 3, or null) in the fishing leaderboard.
 * Medals ONLY glow for 1st, 2nd, and 3rd place!
 */
export function resolvePlayerFishingMedalRank(
  targetNick: string | null | undefined,
  players: RealtimePlayer[],
  currentUserNick?: string | null,
  currentHero?: HeroState | null
): FishingMedalRank | null {
  if (!targetNick) return null;
  const cleanTarget = targetNick.trim().toLowerCase();
  if (!cleanTarget) return null;

  // Build deduplicated list of players with their fish count
  const map = new Map<string, { nick: string; fishCaught: number; storedMedal?: number | null }>();

  for (const p of players || []) {
    if (!p?.nick) continue;
    const key = p.nick.trim().toLowerCase();
    const fState: any = p.fishingState || (p as any).fishing_state;
    const fishCaught = Math.max(
      getPlayerWeeklyFishCount(p),
      getPlayerTotalFishCount(p)
    );
    const storedMedal =
      fState?.fishingMedalRank === 1 || fState?.fishingMedalRank === 2 || fState?.fishingMedalRank === 3
        ? (fState.fishingMedalRank as FishingMedalRank)
        : null;
    map.set(key, {
      nick: p.nick,
      fishCaught,
      storedMedal
    });
  }

  if (currentUserNick && currentHero) {
    const selfKey = currentUserNick.trim().toLowerCase();
    const selfFish = Math.max(
      Number(currentHero.fishingState?.weeklyFishCaught ?? 0),
      Number(currentHero.fishingState?.totalFishCaught ?? 0)
    );
    const selfStoredMedal =
      currentHero.fishingState?.fishingMedalRank === 1 ||
      currentHero.fishingState?.fishingMedalRank === 2 ||
      currentHero.fishingState?.fishingMedalRank === 3
        ? (currentHero.fishingState.fishingMedalRank as FishingMedalRank)
        : null;
    const prev = map.get(selfKey);
    map.set(selfKey, {
      nick: currentUserNick,
      fishCaught: Math.max(prev?.fishCaught || 0, selfFish),
      storedMedal: selfStoredMedal || prev?.storedMedal || null
    });
  }

  const sorted = Array.from(map.values())
    .filter((entry) => entry.fishCaught > 0)
    .sort((a, b) => b.fishCaught - a.fishCaught);

  const liveIdx = sorted.findIndex((e) => e.nick.trim().toLowerCase() === cleanTarget);
  if (liveIdx === 0) return 1;
  if (liveIdx === 1) return 2;
  if (liveIdx === 2) return 3;

  // Fallback to awarded weekly medal if the player earned 1st, 2nd, or 3rd place
  const entry = map.get(cleanTarget);
  if (entry?.storedMedal === 1 || entry?.storedMedal === 2 || entry?.storedMedal === 3) {
    return entry.storedMedal;
  }

  return null;
}

/**
 * Glowing Fish-Shaped Medal component.
 * Strictly renders ONLY for rank 1 (Gold), rank 2 (Silver), and rank 3 (Bronze).
 */
export const FishingRankMedal: React.FC<FishingRankMedalProps> = ({
  rank,
  fishCaught,
  size = 'md',
  showDetails = true,
  className = ''
}) => {
  if (rank !== 1 && rank !== 2 && rank !== 3) {
    return null;
  }

  const meta = FISHING_MEDAL_META[rank];
  const uid = `${meta.gradId}_${size}`;

  const svgSizeCls =
    size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-11 h-11' : 'w-8 h-8';

  return (
    <div
      title={`${meta.title}${typeof fishCaught === 'number' ? ` • Поймано рыб: ${fishCaught}` : ''}`}
      className={`relative inline-flex items-center gap-2 rounded-lg border ${meta.borderCls} bg-gradient-to-r ${meta.bgCls} ${
        size === 'sm' ? 'px-1.5 py-0.5' : size === 'lg' ? 'px-3 py-1.5' : 'px-2.5 py-1'
      } ${meta.glowCls} select-none ${className}`}
    >
      {/* Subtle pulsing aura behind the fish medal */}
      <div
        className={`pointer-events-none absolute inset-0 rounded-lg opacity-35 animate-pulse ${
          rank === 1
            ? 'bg-gradient-to-r from-yellow-400/30 via-amber-300/15 to-yellow-400/30'
            : rank === 2
            ? 'bg-gradient-to-r from-white/25 via-slate-300/15 to-white/25'
            : 'bg-gradient-to-r from-orange-400/25 via-amber-500/15 to-orange-400/25'
        }`}
      />

      {/* Fish-Shaped Medallion SVG */}
      <div className={`relative shrink-0 flex items-center justify-center ${svgSizeCls}`}>
        <svg viewBox="0 0 64 64" className="w-full h-full overflow-visible drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
          <defs>
            <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={meta.stop1} />
              <stop offset="50%" stopColor={meta.stop2} />
              <stop offset="100%" stopColor={meta.stop3} />
            </linearGradient>
          </defs>

          {/* Top Medallion Ribbon */}
          <path
            d="M 22 2 L 32 14 L 42 2 L 37 2 L 32 9 L 27 2 Z"
            fill={meta.ribbonColor}
            stroke={meta.stop1}
            strokeWidth="1.2"
          />
          {/* Gold/Silver/Bronze Suspension Ring */}
          <circle
            cx="32"
            cy="13"
            r="3.2"
            fill="none"
            stroke={`url(#${uid})`}
            strokeWidth="2"
          />

          {/* Outer Medallion Halo Ring */}
          <circle
            cx="32"
            cy="37"
            r="22"
            fill="rgba(15, 23, 42, 0.75)"
            stroke={`url(#${uid})`}
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />

          {/* Dorsal Fin (Top Crown Fin of the Fish) */}
          <path
            d="M 22 25 L 27 16 L 32 22 L 37 15 L 41 25 Z"
            fill={meta.finColor}
            stroke={meta.stop3}
            strokeWidth="1.2"
          />

          {/* Ventral Fin (Bottom Fin) */}
          <path
            d="M 25 48 Q 32 57 39 47 Z"
            fill={meta.finColor}
            stroke={meta.stop3}
            strokeWidth="1.2"
          />

          {/* Royal Fish Tail Fin */}
          <path
            d="M 46 37 L 60 24 L 55 37 L 60 50 Z"
            fill={`url(#${uid})`}
            stroke={meta.stop1}
            strokeWidth="1.4"
          />

          {/* Sculpted Fish Body (The Medal Core) */}
          <path
            d="M 8 37 C 16 21, 38 21, 49 37 C 38 53, 16 53, 8 37 Z"
            fill={`url(#${uid})`}
            stroke={meta.stop1}
            strokeWidth="1.8"
          />

          {/* Decorative Scales & Gill Arc on the Fish Medal */}
          <path
            d="M 21 29 Q 25 37 21 45"
            fill="none"
            stroke={meta.stop3}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M 28 31 Q 32 37 28 43 M 35 32 Q 39 37 35 42"
            fill="none"
            stroke={meta.stop1}
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* Glowing Gem Eye of the Fish */}
          <circle cx="16" cy="35" r="2.6" fill={meta.eyeColor} stroke="#ffffff" strokeWidth="1" />

          {/* Rank Number Engraved on Fish Flank */}
          <text
            x="32"
            y="41"
            textAnchor="middle"
            fill="#0f172a"
            stroke={meta.stop1}
            strokeWidth="0.6"
            fontSize="12"
            fontWeight="900"
          >
            {rank}
          </text>
        </svg>
      </div>

      {/* Text Description */}
      {showDetails && (
        <div className="relative z-10 min-w-0 flex flex-col leading-tight">
          <div className="flex items-center gap-1 flex-wrap">
            <span
              className={`rounded border px-1 py-[0.5px] text-[8px] font-black uppercase tracking-wider ${meta.badgeBgCls}`}
            >
              🐟 {meta.placeLabel}
            </span>
            <span className={`text-[10px] font-black truncate ${meta.textCls}`}>
              {meta.title}
            </span>
          </div>
          <div className="text-[8.5px] text-slate-300 font-semibold mt-0.5 flex items-center gap-2">
            <span>Еженедельная награда: <strong className={meta.textCls}>{meta.weeklyRewardText}</strong></span>
            {typeof fishCaught === 'number' && fishCaught > 0 && (
              <span className="text-sky-300 font-bold">• Улов: {fishCaught} рыб</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

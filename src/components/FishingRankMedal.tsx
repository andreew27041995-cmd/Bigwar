import React from 'react';
import { HeroState, TournamentMedalEntry, TournamentMedalCategory } from '../types/game';
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

export interface GroupedTournamentMedal {
  groupKey: string;
  category: TournamentMedalCategory;
  rank: 1 | 2 | 3;
  title: string;
  count: number;
  entries: TournamentMedalEntry[];
}

const TOURNAMENT_CATEGORY_LABELS: Record<
  TournamentMedalCategory,
  { icon: string; name: string; accentCls: string }
> = {
  fishing: { icon: '🐟', name: 'Рыбалка Нила', accentCls: 'text-sky-300 border-sky-400/50 bg-sky-950/50' },
  pyramid: { icon: '🔺', name: 'Пирамида Ра', accentCls: 'text-amber-300 border-amber-400/50 bg-amber-950/50' },
  clan: { icon: '🛡️', name: 'Клановые войны 7×7', accentCls: 'text-emerald-300 border-emerald-400/50 bg-emerald-950/50' },
  arena: { icon: '🏟️', name: 'Стадион Фароса', accentCls: 'text-purple-300 border-purple-400/50 bg-purple-950/50' }
};

export function buildGroupedTournamentMedals(
  medals?: TournamentMedalEntry[] | null,
  legacyFishingRank?: number | null,
  legacyFishCaught?: number
): GroupedTournamentMedal[] {
  const list: TournamentMedalEntry[] = Array.isArray(medals) ? [...medals] : [];
  if (
    (legacyFishingRank === 1 || legacyFishingRank === 2 || legacyFishingRank === 3) &&
    !list.some((m) => m.category === 'fishing' && m.rank === legacyFishingRank)
  ) {
    list.unshift({
      id: `legacy_fish_${legacyFishingRank}`,
      category: 'fishing',
      rank: legacyFishingRank,
      title: FISHING_MEDAL_META[legacyFishingRank].shortTitle,
      awardedAt: Date.now(),
      seasonLabel: legacyFishCaught && legacyFishCaught > 0 ? `Улов: ${legacyFishCaught} рыб` : 'Турнир Рыболовов'
    });
  }

  const grouped = new Map<string, GroupedTournamentMedal>();
  for (const entry of list) {
    const key = `${entry.category}_${entry.rank}_${entry.title}`;
    const prev = grouped.get(key);
    if (prev) {
      prev.count += 1;
      prev.entries.push(entry);
    } else {
      grouped.set(key, {
        groupKey: key,
        category: entry.category,
        rank: entry.rank,
        title: entry.title,
        count: 1,
        entries: [entry]
      });
    }
  }
  return Array.from(grouped.values()).sort((a, b) => a.rank - b.rank || b.count - a.count);
}

export const TournamentShowcaseBlock: React.FC<{
  medals?: TournamentMedalEntry[] | null;
  legacyFishingRank?: number | null;
  legacyFishCaught?: number;
  onOpenShowcase?: () => void;
  className?: string;
}> = ({ medals, legacyFishingRank, legacyFishCaught, onOpenShowcase, className = '' }) => {
  const grouped = buildGroupedTournamentMedals(medals, legacyFishingRank, legacyFishCaught);
  if (grouped.length === 0) return null;

  const totalCount = grouped.reduce((acc, g) => acc + g.count, 0);

  return (
    <button
      type="button"
      onClick={onOpenShowcase}
      className={`w-full rounded-xl border border-amber-400/60 bg-gradient-to-r from-[#23180c] via-[#171c29] to-[#23180c] p-2 text-left hover:border-yellow-300 transition-colors cursor-pointer ${className}`}
      title="Открыть Витрину Трофеев и накопительных медалей"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-300">
          🏆 Витрина Трофеев ({totalCount})
        </span>
        <span className="text-[8.5px] font-bold text-amber-200/80 underline">
          Подробнее ▶
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {grouped.map((g) => {
          const rankColors =
            g.rank === 1
              ? 'border-amber-300 bg-amber-950/75 text-yellow-200'
              : g.rank === 2
              ? 'border-slate-300 bg-slate-800/85 text-slate-100'
              : 'border-orange-400 bg-orange-950/75 text-orange-200';
          const catMeta = TOURNAMENT_CATEGORY_LABELS[g.category] || TOURNAMENT_CATEGORY_LABELS.fishing;
          return (
            <span
              key={g.groupKey}
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8.5px] font-black ${rankColors}`}
            >
              <span>{catMeta.icon}</span>
              <span>{g.rank === 1 ? '🥇' : g.rank === 2 ? '🥈' : '🥉'}</span>
              <span className="truncate max-w-[140px]">{g.title}</span>
              {g.count > 1 && (
                <span className="rounded bg-amber-400 px-1 text-[8px] font-black text-slate-950">
                  x{g.count}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </button>
  );
};

export const TournamentShowcaseModal: React.FC<{
  playerNick?: string;
  medals?: TournamentMedalEntry[] | null;
  legacyFishingRank?: number | null;
  legacyFishCaught?: number;
  onClose: () => void;
}> = ({ playerNick, medals, legacyFishingRank, legacyFishCaught, onClose }) => {
  const grouped = buildGroupedTournamentMedals(medals, legacyFishingRank, legacyFishCaught);
  const totalCount = grouped.reduce((acc, g) => acc + g.count, 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border-2 border-amber-400/80 bg-[#111722] text-slate-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-amber-500/40 bg-[#1a2232] px-3.5 py-2.5">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-amber-300">
              🏆 Витрина Трофеев {playerNick ? `• ${playerNick}` : ''}
            </div>
            <div className="text-[10px] text-slate-400">
              Накопительные медали турниров (Всего наград: {totalCount})
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-lg border border-slate-600 bg-slate-900 text-xs font-bold text-slate-200 hover:border-red-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-3 space-y-2 max-h-[70dvh] overflow-y-auto">
          {grouped.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-slate-400 border border-dashed border-slate-700 rounded-xl">
              Турнирных медалей пока нет. Занимайте призовые 1–3 места в Рыбалке, Пирамиде или Клановых войнах 7×7!
            </div>
          ) : (
            grouped.map((g) => {
              const catMeta = TOURNAMENT_CATEGORY_LABELS[g.category] || TOURNAMENT_CATEGORY_LABELS.fishing;
              return (
                <div
                  key={g.groupKey}
                  className="rounded-xl border border-slate-700 bg-slate-900/90 p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base">{g.rank === 1 ? '🥇' : g.rank === 2 ? '🥈' : '🥉'}</span>
                      <span className="text-[11px] font-black text-amber-200 truncate">
                        {g.title}
                      </span>
                    </div>
                    <span className="rounded-md border border-amber-400/70 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300 shrink-0">
                      [x{g.count}]
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[9.5px]">
                    <span className={`rounded border px-1.5 py-0.5 font-bold ${catMeta.accentCls}`}>
                      {catMeta.icon} {catMeta.name}
                    </span>
                    <span className="text-slate-400">
                      {g.entries[0]?.seasonLabel || `${g.rank} место в турнире`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};


import { HeroState } from '../types/game';

export type AchievementCategoryKey = 'gold' | 'monsters' | 'bosses' | 'hero' | 'pvp_economy';

export interface PlayerAchievementTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategoryKey;
  metric:
    | 'total_gold'
    | 'mobs_killed'
    | 'bosses_killed'
    | 'hero_level'
    | 'pyramid_tier'
    | 'pvp_kills'
    | 'items_sold'
    | 'gambling_games';
  target: number;
  rewardCrystals: number;
  unitLabel: string;
}

export interface EvaluatedAchievement extends PlayerAchievementTemplate {
  progress: number;
  pct: number;
  isCompleted: boolean;
  isClaimed: boolean;
  canClaim: boolean;
  remaining: number;
}

export const ACHIEVEMENT_CATEGORIES: Record<
  'all' | AchievementCategoryKey,
  { label: string; icon: string; badgeClass: string }
> = {
  all: {
    label: 'Все',
    icon: '🏅',
    badgeClass: 'border-amber-500/60 bg-amber-950/70 text-amber-200'
  },
  gold: {
    label: 'Золото',
    icon: '🪙',
    badgeClass: 'border-yellow-500/60 bg-yellow-950/70 text-yellow-200'
  },
  monsters: {
    label: 'Монстры',
    icon: '🦂',
    badgeClass: 'border-emerald-500/60 bg-emerald-950/70 text-emerald-200'
  },
  bosses: {
    label: 'Боссы',
    icon: '👹',
    badgeClass: 'border-red-500/60 bg-red-950/70 text-red-200'
  },
  hero: {
    label: 'Герой',
    icon: '⭐',
    badgeClass: 'border-purple-500/60 bg-purple-950/70 text-purple-200'
  },
  pvp_economy: {
    label: 'Арена и Быт',
    icon: '⚔️',
    badgeClass: 'border-cyan-500/60 bg-cyan-950/70 text-cyan-200'
  }
};

export const PLAYER_ACHIEVEMENTS: PlayerAchievementTemplate[] = [
  // ================= КАТЕГОРИЯ: ЗОЛОТО (БОГАТСТВО ФАРАОНА) =================
  {
    id: 'gold_1000',
    title: 'Искатель сокровищ',
    description: 'Собрать 1 000 золота в походах, сундуках или торговле.',
    icon: '🪙',
    category: 'gold',
    metric: 'total_gold',
    target: 1000,
    rewardCrystals: 5,
    unitLabel: '🪙'
  },
  {
    id: 'gold_5000',
    title: 'Купец Луксора',
    description: 'Собрать суммарно 5 000 золота за время приключений.',
    icon: '💰',
    category: 'gold',
    metric: 'total_gold',
    target: 5000,
    rewardCrystals: 15,
    unitLabel: '🪙'
  },
  {
    id: 'gold_25000',
    title: 'Казначей Пирамиды',
    description: 'Собрать суммарно 25 000 золота.',
    icon: '🏺',
    category: 'gold',
    metric: 'total_gold',
    target: 25000,
    rewardCrystals: 35,
    unitLabel: '🪙'
  },
  {
    id: 'gold_100000',
    title: 'Золотой Фараон',
    description: 'Собрать 100 000 золота и наполнить царскую сокровищницу.',
    icon: '👑',
    category: 'gold',
    metric: 'total_gold',
    target: 100000,
    rewardCrystals: 100,
    unitLabel: '🪙'
  },
  {
    id: 'gold_500000',
    title: 'Повелитель Золотых Песков',
    description: 'Собрать легендарное состояние в 500 000 золота.',
    icon: '🏛️',
    category: 'gold',
    metric: 'total_gold',
    target: 500000,
    rewardCrystals: 250,
    unitLabel: '🪙'
  },

  // ================= КАТЕГОРИЯ: МОНСТРЫ (ОХОТА В ПИРАМИДЕ) =================
  {
    id: 'mobs_10',
    title: 'Первая кровь пустыни',
    description: 'Одержать 10 побед над монстрами в Пирамиде.',
    icon: '🦂',
    category: 'monsters',
    metric: 'mobs_killed',
    target: 10,
    rewardCrystals: 3,
    unitLabel: 'монстр.'
  },
  {
    id: 'mobs_50',
    title: 'Охотник на мумий',
    description: 'Одержать 50 побед над монстрами Пирамиды.',
    icon: '🗡️',
    category: 'monsters',
    metric: 'mobs_killed',
    target: 50,
    rewardCrystals: 10,
    unitLabel: 'монстр.'
  },
  {
    id: 'mobs_200',
    title: 'Истребитель нежити',
    description: 'Одержать 200 побед над древними монстрами и стражами.',
    icon: '⚔️',
    category: 'monsters',
    metric: 'mobs_killed',
    target: 200,
    rewardCrystals: 25,
    unitLabel: 'монстр.'
  },
  {
    id: 'mobs_500',
    title: 'Гроза Гробниц',
    description: 'Одержать 500 побед над монстрами в залах Пирамид.',
    icon: '🛡️',
    category: 'monsters',
    metric: 'mobs_killed',
    target: 500,
    rewardCrystals: 60,
    unitLabel: 'монстр.'
  },
  {
    id: 'mobs_1000',
    title: 'Легенда Древнего Египта',
    description: 'Сокрушить 1 000 монстров в Пирамидах Фараонов.',
    icon: '𓂀',
    category: 'monsters',
    metric: 'mobs_killed',
    target: 1000,
    rewardCrystals: 150,
    unitLabel: 'монстр.'
  },

  // ================= КАТЕГОРИЯ: БОССЫ (ПОКОРИТЕЛЬ БОССОВ) =================
  {
    id: 'boss_1',
    title: 'Победитель Стража',
    description: 'Одержать первую победу над Боссом Пирамиды.',
    icon: '👹',
    category: 'bosses',
    metric: 'bosses_killed',
    target: 1,
    rewardCrystals: 5,
    unitLabel: 'босс.'
  },
  {
    id: 'boss_10',
    title: 'Сокрушитель Фараонов',
    description: 'Победить 10 Верховных Боссов в Пирамидах.',
    icon: '💀',
    category: 'bosses',
    metric: 'bosses_killed',
    target: 10,
    rewardCrystals: 25,
    unitLabel: 'босс.'
  },
  {
    id: 'boss_50',
    title: 'Владыка Загробного Мира',
    description: 'Победить 50 Боссов Пирамид и доказать своё могущество.',
    icon: '🐉',
    category: 'bosses',
    metric: 'bosses_killed',
    target: 50,
    rewardCrystals: 80,
    unitLabel: 'босс.'
  },

  // ================= КАТЕГОРИЯ: ГЕРОЙ (УРОВЕНЬ И ЯРУСЫ ПИРАМИДЫ) =================
  {
    id: 'lvl_5',
    title: 'Посвящённый Воин',
    description: 'Достичь 5-го уровня персонажа.',
    icon: '⭐',
    category: 'hero',
    metric: 'hero_level',
    target: 5,
    rewardCrystals: 5,
    unitLabel: 'ур.'
  },
  {
    id: 'lvl_10',
    title: 'Ветеран Песков',
    description: 'Достичь 10-го уровня персонажа.',
    icon: '🌟',
    category: 'hero',
    metric: 'hero_level',
    target: 10,
    rewardCrystals: 15,
    unitLabel: 'ур.'
  },
  {
    id: 'lvl_15',
    title: 'Бессмертный Чемпион',
    description: 'Достичь 15-го уровня персонажа.',
    icon: '🔥',
    category: 'hero',
    metric: 'hero_level',
    target: 15,
    rewardCrystals: 35,
    unitLabel: 'ур.'
  },
  {
    id: 'lvl_20',
    title: 'Божество Ра',
    description: 'Достичь максимального 20-го уровня героя.',
    icon: '☀️',
    category: 'hero',
    metric: 'hero_level',
    target: 20,
    rewardCrystals: 100,
    unitLabel: 'ур.'
  },
  {
    id: 'pyr_tier_2',
    title: 'Покоритель Врат',
    description: 'Пробиться через портал во 2-й ярус Пирамиды.',
    icon: '🌀',
    category: 'hero',
    metric: 'pyramid_tier',
    target: 2,
    rewardCrystals: 10,
    unitLabel: 'ярус'
  },
  {
    id: 'pyr_tier_3',
    title: 'Хранитель Вершины',
    description: 'Открыть доступ к 3-му (высшему) ярусу Пирамиды.',
    icon: '🔺',
    category: 'hero',
    metric: 'pyramid_tier',
    target: 3,
    rewardCrystals: 25,
    unitLabel: 'ярус'
  },

  // ================= КАТЕГОРИЯ: АРЕНА И БЫТ (PVP, ТОРГОВЛЯ, АЗАРТ) =================
  {
    id: 'pvp_5',
    title: 'Охотник за головами',
    description: 'Одержать 5 побед над соперниками в PvP боях Пирамиды.',
    icon: '🩸',
    category: 'pvp_economy',
    metric: 'pvp_kills',
    target: 5,
    rewardCrystals: 10,
    unitLabel: 'побед'
  },
  {
    id: 'pvp_25',
    title: 'Палач Пирамиды',
    description: 'Одержать 25 побед над соперниками в PvP боях Пирамиды.',
    icon: '☠️',
    category: 'pvp_economy',
    metric: 'pvp_kills',
    target: 25,
    rewardCrystals: 40,
    unitLabel: 'побед'
  },
  {
    id: 'trade_10',
    title: 'Торговец реликвиями',
    description: 'Продать 10 предметов снаряжения торговцу.',
    icon: '⚖️',
    category: 'pvp_economy',
    metric: 'items_sold',
    target: 10,
    rewardCrystals: 10,
    unitLabel: 'предм.'
  },
  {
    id: 'gamble_10',
    title: 'Любимец Фортуны',
    description: 'Сыграть 10 раз в разделе «Азартные игры».',
    icon: '🎰',
    category: 'pvp_economy',
    metric: 'gambling_games',
    target: 10,
    rewardCrystals: 10,
    unitLabel: 'игр'
  }
];

export function getHeroAchievementMetricValue(
  metric: PlayerAchievementTemplate['metric'],
  hero: Partial<HeroState> | null | undefined
): number {
  if (!hero) return 0;
  switch (metric) {
    case 'total_gold':
      return Math.max(
        0,
        Math.floor(Number(hero.totalGoldCollected || 0)),
        Math.floor(Number(hero.gold || 0))
      );
    case 'mobs_killed':
      return Math.max(
        0,
        Math.floor(Number(hero.mobsKilled ?? hero.mobKills ?? 0)),
        Math.floor(Number(hero.npcCompanion?.mobsKilled || 0))
      );
    case 'bosses_killed': {
      const explicitBosses = Math.max(0, Math.floor(Number(hero.bossesKilled || 0)));
      const maxTier = Math.max(1, Number(hero.homePyramidTier || hero.pyramidTier || 1));
      // If player already unlocked higher pyramid tiers previously, they killed at least (maxTier - 1) bosses
      return Math.max(explicitBosses, maxTier > 1 ? maxTier - 1 : 0);
    }
    case 'hero_level':
      return Math.max(1, Math.floor(Number(hero.level || hero.lvl || 1)));
    case 'pyramid_tier':
      return Math.max(
        1,
        Math.floor(Number(hero.homePyramidTier || hero.pyramidTier || 1))
      );
    case 'pvp_kills':
      return Math.max(
        0,
        Math.floor(Number(hero.pvpKills || 0)),
        Math.floor(Number(hero.pvpWins || 0))
      );
    case 'items_sold': {
      const explicitSold = Math.max(0, Math.floor(Number(hero.itemsSold || 0)));
      const estimatedFromSellExp = Math.floor(Number(hero.sellExperience || 0) / 3);
      return Math.max(explicitSold, estimatedFromSellExp);
    }
    case 'gambling_games': {
      const explicitGames = Math.max(0, Math.floor(Number(hero.gamblingGamesPlayed || 0)));
      const hasGamblingHistory =
        Number(hero.gamblingSpentGold || 0) > 0 || Number(hero.gamblingSpentCrystals || 0) > 0;
      return Math.max(explicitGames, hasGamblingHistory ? 1 : 0);
    }
    default:
      return 0;
  }
}

export interface PlayerAchievementsSummary {
  items: EvaluatedAchievement[];
  totalCount: number;
  completedCount: number;
  claimedCount: number;
  claimableCount: number;
  totalClaimableCrystals: number;
  earnedCrystalsTotal: number;
  maxPossibleCrystals: number;
}

export function evaluatePlayerAchievements(
  hero: Partial<HeroState> | null | undefined
): PlayerAchievementsSummary {
  const claimedSet = new Set(
    Array.isArray(hero?.claimedAchievementIds) ? hero!.claimedAchievementIds! : []
  );

  let completedCount = 0;
  let claimedCount = 0;
  let claimableCount = 0;
  let totalClaimableCrystals = 0;
  let earnedCrystalsTotal = 0;
  let maxPossibleCrystals = 0;

  const items: EvaluatedAchievement[] = PLAYER_ACHIEVEMENTS.map((tpl) => {
    const rawProgress = getHeroAchievementMetricValue(tpl.metric, hero);
    const progress = Math.max(0, rawProgress);
    const isCompleted = progress >= tpl.target;
    const isClaimed = claimedSet.has(tpl.id);
    const canClaim = isCompleted && !isClaimed;
    const pct = Math.max(0, Math.min(100, Math.round((Math.min(progress, tpl.target) / tpl.target) * 100)));
    const remaining = Math.max(0, tpl.target - progress);

    maxPossibleCrystals += tpl.rewardCrystals;
    if (isCompleted) completedCount += 1;
    if (isClaimed) {
      claimedCount += 1;
      earnedCrystalsTotal += tpl.rewardCrystals;
    }
    if (canClaim) {
      claimableCount += 1;
      totalClaimableCrystals += tpl.rewardCrystals;
    }

    return {
      ...tpl,
      progress,
      pct,
      isCompleted,
      isClaimed,
      canClaim,
      remaining
    };
  });

  return {
    items,
    totalCount: items.length,
    completedCount,
    claimedCount,
    claimableCount,
    totalClaimableCrystals,
    earnedCrystalsTotal,
    maxPossibleCrystals
  };
}

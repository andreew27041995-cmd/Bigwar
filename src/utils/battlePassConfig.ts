import { GameItem } from '../types/game';
import { generateItem } from './gameData';

export type BattlePassChestType = 'basic' | 'silver' | 'gold' | 'elite';
export type SeasonTitleId = 'sand_explorer' | 'season_pharaoh';

export interface BattlePassRewardDef {
  title: string;
  description: string;
  icon: string;
  gold?: number;
  crystals?: number;
  energy?: number;
  vipDays?: number;
  chestType?: BattlePassChestType;
  chestCount?: number;
  baitId?: string;
  baitName?: string;
  baitCount?: number;
  keepnetLevels?: number;
  relicsCount?: number;
  transportId?: 'scarab_boat' | 'apache_season';
  transportName?: string;
  transportDurability?: number;
  seasonTitleId?: SeasonTitleId;
  seasonTitleName?: string;
  seasonTitleDays?: number;
  seasonTitleStatBonusPct?: number;
}

export interface BattlePassLevelConfig {
  level: number;
  xpRequiredForNext: number; // XP needed to go from this level to level+1 (for lvl 40 it is 0)
  freeReward: BattlePassRewardDef;
  vipReward: BattlePassRewardDef;
}

export type BattlePassQuestCategory = 'daily' | 'weekly';
export type BattlePassQuestActionType =
  | 'pyramid_step'
  | 'catch_fish'
  | 'gambling_play'
  | 'port_trip'
  | 'clan_activity';

export interface BattlePassQuestTemplate {
  id: string;
  category: BattlePassQuestCategory;
  title: string;
  description: string;
  icon: string;
  actionType: BattlePassQuestActionType;
  target: number;
  xpReward: number;
}

export interface PlayerBattlePassQuestProgress {
  id: string;
  progress: number;
  isCompleted: boolean;
  isClaimed: boolean;
}

export interface PlayerBattlePassState {
  seasonId: string;
  level: number; // 1..40
  currentXp: number; // XP within current level
  totalXpEarned: number;
  isVipUnlocked: boolean;
  vipUnlockedAt?: number;
  claimedFreeLevels: number[];
  claimedVipLevels: number[];
  dailyDayKey: string;
  weeklyWeekKey: string;
  dailyQuests: Record<string, PlayerBattlePassQuestProgress>;
  weeklyQuests: Record<string, PlayerBattlePassQuestProgress>;
  activeTitleId?: SeasonTitleId | null;
  activeTitleName?: string | null;
  activeTitleUntil?: number;
  activeTitleBonusPct?: number;
  ownedTitles?: {
    id: SeasonTitleId;
    name: string;
    expiresAt: number;
    bonusPct: number;
  }[];
}

export interface BattlePassGlobalConfig {
  seasonId: string;
  seasonTitle: string;
  seasonSubtitle: string;
  seasonEndTimestamp: number;
  vipUnlockCostCrystals: number;
  maxLevel: number;
  levels: BattlePassLevelConfig[];
  dailyQuests: BattlePassQuestTemplate[];
  weeklyQuests: BattlePassQuestTemplate[];
}

export const BATTLE_PASS_STORAGE_KEY = 'piramida_battle_pass_config_v2';

// Прогрессивная таблица опыта (XP) Боевого Пропуска по ТЗ: от 50 XP (Ур. 1) до 3 880 XP (Ур. 40)
export const DEFAULT_BATTLE_PASS_XP_TO_NEXT: Record<number, number> = {
  1: 50,
  2: 65,
  3: 80,
  4: 100,
  5: 120,
  6: 145,
  7: 170,
  8: 200,
  9: 235,
  10: 270,
  11: 310,
  12: 355,
  13: 400,
  14: 450,
  15: 505,
  16: 565,
  17: 630,
  18: 700,
  19: 775,
  20: 855,
  21: 940,
  22: 1030,
  23: 1125,
  24: 1225,
  25: 1330,
  26: 1445,
  27: 1565,
  28: 1695,
  29: 1830,
  30: 1975,
  31: 2130,
  32: 2295,
  33: 2470,
  34: 2655,
  35: 2850,
  36: 3040,
  37: 3240,
  38: 3445,
  39: 3660,
  40: 3880
};

export function getBattlePassLevelXpRequirement(
  level: number,
  cfg?: BattlePassGlobalConfig
): number {
  const clamped = Math.max(1, Math.min(40, Math.floor(Number(level) || 1)));
  const fromCfg = cfg?.levels?.find((l) => l.level === clamped)?.xpRequiredForNext;
  const fallback = DEFAULT_BATTLE_PASS_XP_TO_NEXT[clamped] ?? 3880;
  const val = Number(fromCfg);
  return val > 0 ? val : fallback;
}


export const DEFAULT_BP_DAILY_QUESTS: BattlePassQuestTemplate[] = [
  {
    id: 'bp_daily_pyramid_steps',
    category: 'daily',
    title: 'Утренний поход',
    description: 'Сделать 10 шагов в Пирамиде',
    icon: '🏛️',
    actionType: 'pyramid_step',
    target: 10,
    xpReward: 50
  },
  {
    id: 'bp_daily_fishing',
    category: 'daily',
    title: 'Рыбный день',
    description: 'Поймать 5 рыб в Рыбалке',
    icon: '🎣',
    actionType: 'catch_fish',
    target: 5,
    xpReward: 50
  },
  {
    id: 'bp_daily_gambling',
    category: 'daily',
    title: 'Азартный игрок',
    description: 'Сыграть 2 раза в рулетку / азартные игры',
    icon: '🎰',
    actionType: 'gambling_play',
    target: 2,
    xpReward: 75
  },
  {
    id: 'bp_daily_port',
    category: 'daily',
    title: 'Портовый рейс',
    description: 'Отправить транспорт в Порт 1 раз',
    icon: '⚓',
    actionType: 'port_trip',
    target: 1,
    xpReward: 50
  }
];

export const DEFAULT_BP_WEEKLY_QUESTS: BattlePassQuestTemplate[] = [
  {
    id: 'bp_weekly_pyramid_steps',
    category: 'weekly',
    title: 'Повелитель песков',
    description: 'Сделать суммарно 70 шагов в Пирамиде',
    icon: '🏜️',
    actionType: 'pyramid_step',
    target: 70,
    xpReward: 400
  },
  {
    id: 'bp_weekly_fishing',
    category: 'weekly',
    title: 'Опытный рыбак',
    description: 'Поймать 40 рыб и заполнить садок',
    icon: '🐟',
    actionType: 'catch_fish',
    target: 40,
    xpReward: 400
  },
  {
    id: 'bp_weekly_clan',
    category: 'weekly',
    title: 'Клановая опора',
    description: 'Участвовать в 3 клановых активностях / битвах',
    icon: '🛡️',
    actionType: 'clan_activity',
    target: 3,
    xpReward: 500
  }
];

function buildDefaultFreeReward(lvl: number): BattlePassRewardDef {
  switch (lvl) {
    case 1:
      return { title: '1 000 Золота', description: '+1 000 🪙 Золота', icon: '🪙', gold: 1000 };
    case 2:
      return { title: 'Энергия +10', description: '+10 ⚡ Энергии', icon: '⚡', energy: 10 };
    case 3:
      return { title: 'Базовый сундук', description: '1x Базовый сундук с добычей', icon: '📦', chestType: 'basic', chestCount: 1 };
    case 4:
      return { title: 'Обычная наживка (3 шт.)', description: '3x Хлебный мякиш для рыбалки', icon: '🍞', baitId: 'bait_bread', baitName: 'Хлебный мякиш', baitCount: 3 };
    case 5:
      return { title: '3 000 Золота', description: '+3 000 🪙 Золота', icon: '🪙', gold: 3000 };
    case 6:
      return { title: 'Энергия +15', description: '+15 ⚡ Энергии', icon: '⚡', energy: 15 };
    case 7:
      return { title: 'Базовый сундук', description: '1x Базовый сундук с добычей', icon: '📦', chestType: 'basic', chestCount: 1 };
    case 8:
      return { title: 'Речная наживка (3 шт.)', description: '3x Речной червь для рыбалки', icon: '🪱', baitId: 'bait_worm', baitName: 'Речной червь', baitCount: 3 };
    case 9:
      return { title: '5 000 Золота', description: '+5 000 🪙 Золота', icon: '🪙', gold: 5000 };
    case 10:
      return { title: '5 Кристаллов', description: '+5 💎 Кристаллов', icon: '💎', crystals: 5 };
    case 11:
      return { title: '2 000 Золота', description: '+2 000 🪙 Золота', icon: '🪙', gold: 2000 };
    case 12:
      return { title: 'Энергия +20', description: '+20 ⚡ Энергии', icon: '⚡', energy: 20 };
    case 13:
      return { title: '2 000 Золота', description: '+2 000 🪙 Золота', icon: '🪙', gold: 2000 };
    case 14:
      return { title: 'Базовый сундук', description: '1x Базовый сундук', icon: '📦', chestType: 'basic', chestCount: 1 };
    case 15:
      return { title: '2 000 Золота и Энергия', description: '+2 000 🪙 Золота и +15 ⚡ Энергии', icon: '🪙', gold: 2000, energy: 15 };
    case 16:
      return { title: '2 000 Золота', description: '+2 000 🪙 Золота', icon: '🪙', gold: 2000 };
    case 17:
      return { title: 'Энергия +25', description: '+25 ⚡ Энергии', icon: '⚡', energy: 25 };
    case 18:
      return { title: 'Серебряный сундук', description: '1x Серебряный сундук', icon: '🧰', chestType: 'silver', chestCount: 1 };
    case 19:
      return { title: '2 000 Золота', description: '+2 000 🪙 Золота', icon: '🪙', gold: 2000 };
    case 20:
      return {
        title: '10 Кристаллов + Речная наживка',
        description: '+10 💎 Кристаллов и 3x Речной червь',
        icon: '💎',
        crystals: 10,
        baitId: 'bait_worm',
        baitName: 'Речной червь',
        baitCount: 3
      };
    case 21:
      return { title: '3 500 Золота', description: '+3 500 🪙 Золота', icon: '🪙', gold: 3500 };
    case 22:
      return { title: 'Энергия +25', description: '+25 ⚡ Энергии', icon: '⚡', energy: 25 };
    case 23:
      return { title: 'Серебряный сундук', description: '1x Серебряный сундук', icon: '🧰', chestType: 'silver', chestCount: 1 };
    case 24:
      return { title: '4 000 Золота', description: '+4 000 🪙 Золота', icon: '🪙', gold: 4000 };
    case 25:
      return {
        title: 'Энергия +30 и Наживка',
        description: '+30 ⚡ Энергии и 3x Нильская креветка',
        icon: '🦐',
        energy: 30,
        baitId: 'bait_shrimp',
        baitName: 'Нильская креветка',
        baitCount: 3
      };
    case 26:
      return { title: '4 500 Золота', description: '+4 500 🪙 Золота', icon: '🪙', gold: 4500 };
    case 27:
      return { title: 'Серебряный сундук', description: '1x Серебряный сундук', icon: '🧰', chestType: 'silver', chestCount: 1 };
    case 28:
      return { title: 'Энергия +35', description: '+35 ⚡ Энергии', icon: '⚡', energy: 35 };
    case 29:
      return { title: '5 000 Золота', description: '+5 000 🪙 Золота', icon: '🪙', gold: 5000 };
    case 30:
      return {
        title: '15 Кристаллов + Золотой сундук',
        description: '+15 💎 Кристаллов и 1x Золотой сундук',
        icon: '🎁',
        crystals: 15,
        chestType: 'gold',
        chestCount: 1
      };
    case 31:
      return { title: '6 000 Золота', description: '+6 000 🪙 Золота', icon: '🪙', gold: 6000 };
    case 32:
      return {
        title: 'Редкая наживка (3 шт.)',
        description: '3x Золотой живец для редких рыб',
        icon: '🐠',
        baitId: 'bait_minnow',
        baitName: 'Золотой живец',
        baitCount: 3
      };
    case 33:
      return { title: '7 000 Золота', description: '+7 000 🪙 Золота', icon: '🪙', gold: 7000 };
    case 34:
      return { title: 'Энергия +40', description: '+40 ⚡ Энергии', icon: '⚡', energy: 40 };
    case 35:
      return {
        title: '8 000 Золота + Золотой сундук',
        description: '+8 000 🪙 Золота и 1x Золотой сундук',
        icon: '🎁',
        gold: 8000,
        chestType: 'gold',
        chestCount: 1
      };
    case 36:
      return {
        title: 'Священный жук (3 шт.)',
        description: '3x Священный жук (редкая наживка)',
        icon: '🪲',
        baitId: 'bait_scarab',
        baitName: 'Священный жук',
        baitCount: 3
      };
    case 37:
      return { title: '9 000 Золота', description: '+9 000 🪙 Золота', icon: '🪙', gold: 9000 };
    case 38:
      return {
        title: 'Энергия +50 + Золотой сундук',
        description: '+50 ⚡ Энергии и 1x Золотой сундук',
        icon: '⚡',
        energy: 50,
        chestType: 'gold',
        chestCount: 1
      };
    case 39:
      return { title: '12 000 Золота', description: '+12 000 🪙 Золота', icon: '🪙', gold: 12000 };
    case 40:
    default:
      return {
        title: '30 💎 + Титул «Исследователь Песков» (7 дн.)',
        description: '+30 💎 Кристаллов и титул «Исследователь Песков» на 7 дней (+15% ко всем статам, серебристое свечение ника)',
        icon: '🏜️',
        crystals: 30,
        seasonTitleId: 'sand_explorer',
        seasonTitleName: 'Исследователь Песков',
        seasonTitleDays: 7,
        seasonTitleStatBonusPct: 15
      };
  }
}

function buildDefaultVipReward(lvl: number): BattlePassRewardDef {
  switch (lvl) {
    case 1:
      return {
        title: 'VIP (1 дн.) + 50 000 🪙 + 15 💎',
        description: 'VIP-статус на 1 день, +50 000 Золота и +15 Кристаллов',
        icon: '👑',
        vipDays: 1,
        gold: 50000,
        crystals: 15
      };
    case 2:
      return {
        title: 'Редкая наживка (5 шт.) + 10 000 🪙',
        description: '5x Золотой живец и +10 000 Золота',
        icon: '🐠',
        baitId: 'bait_minnow',
        baitName: 'Золотой живец',
        baitCount: 5,
        gold: 10000
      };
    case 3:
      return {
        title: 'Расширение садка + Элитный сундук',
        description: '+1 уровень вместимости садка и 1x Элитный сундук',
        icon: '🪣',
        keepnetLevels: 1,
        chestType: 'elite',
        chestCount: 1
      };
    case 4:
      return {
        title: '2 Золотых сундука + Священный жук (5 шт.)',
        description: '2x Золотых сундука и 5x Священный жук',
        icon: '🪲',
        chestType: 'gold',
        chestCount: 2,
        baitId: 'bait_scarab',
        baitName: 'Священный жук',
        baitCount: 5
      };
    case 5:
      return {
        title: 'Катер «Скарабей» (500/500)',
        description: 'Уникальный транспорт для Порта: «Легкий катер «Скарабей»» (Прочность 500/500)',
        icon: '🚤',
        transportId: 'scarab_boat',
        transportName: 'Легкий катер «Скарабей»',
        transportDurability: 500
      };
    case 6:
      return {
        title: '25 000 🪙 + 2 Реликвии',
        description: '+25 000 Золота и 2x Древние Реликвии для Алтаря',
        icon: '🏺',
        gold: 25000,
        relicsCount: 2
      };
    case 7:
      return {
        title: '20 💎 Кристаллов + 50 ⚡',
        description: '+20 Кристаллов и +50 Энергии',
        icon: '💎',
        crystals: 20,
        energy: 50
      };
    case 8:
      return {
        title: '30 000 🪙 + Золотой сундук',
        description: '+30 000 Золота и 1x Золотой сундук',
        icon: '🎁',
        gold: 30000,
        chestType: 'gold',
        chestCount: 1
      };
    case 9:
      return {
        title: '3 Реликвии + 20 💎',
        description: '3x Древние Реликвии и +20 Кристаллов',
        icon: '🏺',
        relicsCount: 3,
        crystals: 20
      };
    case 10:
      return {
        title: '40 000 🪙 + 25 💎 + Элитный сундук',
        description: '+40 000 Золота, +25 Кристаллов и 1x Элитный сундук',
        icon: '👑',
        gold: 40000,
        crystals: 25,
        chestType: 'elite',
        chestCount: 1
      };
    case 11:
      return {
        title: '35 000 🪙 + Королевская наживка',
        description: '+35 000 Золота и 3x Королевская приманка Ра',
        icon: '👑',
        gold: 35000,
        baitId: 'bait_royal',
        baitName: 'Королевская приманка Ра',
        baitCount: 3
      };
    case 12:
      return {
        title: '25 💎 + 3 Реликвии',
        description: '+25 Кристаллов и 3x Древние Реликвии',
        icon: '💎',
        crystals: 25,
        relicsCount: 3
      };
    case 13:
      return {
        title: '45 000 🪙 + 60 ⚡',
        description: '+45 000 Золота и +60 Энергии',
        icon: '🪙',
        gold: 45000,
        energy: 60
      };
    case 14:
      return {
        title: '30 💎 + 2 Золотых сундука',
        description: '+30 Кристаллов и 2x Золотых сундука',
        icon: '🎁',
        crystals: 30,
        chestType: 'gold',
        chestCount: 2
      };
    case 15:
      return {
        title: 'VIP (3 дн.) + 40 💎 + Элитный сундук',
        description: 'VIP-статус на 3 дня, +40 Кристаллов и 1x Элитный сундук',
        icon: '👑',
        vipDays: 3,
        crystals: 40,
        chestType: 'elite',
        chestCount: 1
      };
    case 16:
      return {
        title: '50 000 🪙 + Королевская наживка (4 шт.)',
        description: '+50 000 Золота и 4x Королевская приманка Ра',
        icon: '👑',
        gold: 50000,
        baitId: 'bait_royal',
        baitName: 'Королевская приманка Ра',
        baitCount: 4
      };
    case 17:
      return {
        title: '30 💎 + 3 Реликвии',
        description: '+30 Кристаллов и 3x Древние Реликвии',
        icon: '🏺',
        crystals: 30,
        relicsCount: 3
      };
    case 18:
      return {
        title: 'Расширение садка + 55 000 🪙',
        description: '+1 уровень вместимости садка и +55 000 Золота',
        icon: '🪣',
        keepnetLevels: 1,
        gold: 55000
      };
    case 19:
      return {
        title: '35 💎 + Элитный сундук',
        description: '+35 Кристаллов и 1x Элитный сундук',
        icon: '💎',
        crystals: 35,
        chestType: 'elite',
        chestCount: 1
      };
    case 20:
      return {
        title: '75 000 🪙 + 45 💎 + Священный жук (6 шт.)',
        description: '+75 000 Золота, +45 Кристаллов и 6x Священный жук',
        icon: '🪲',
        gold: 75000,
        crystals: 45,
        baitId: 'bait_scarab',
        baitName: 'Священный жук',
        baitCount: 6
      };
    case 21:
      return {
        title: '4 Реликвии + 80 ⚡',
        description: '4x Древние Реликвии и +80 Энергии',
        icon: '🏺',
        relicsCount: 4,
        energy: 80
      };
    case 22:
      return {
        title: '60 000 🪙 + 35 💎',
        description: '+60 000 Золота и +35 Кристаллов',
        icon: '🪙',
        gold: 60000,
        crystals: 35
      };
    case 23:
      return {
        title: '2 Элитных сундука + Наживка Ра (5 шт.)',
        description: '2x Элитных сундука и 5x Королевская приманка Ра',
        icon: '🎁',
        chestType: 'elite',
        chestCount: 2,
        baitId: 'bait_royal',
        baitName: 'Королевская приманка Ра',
        baitCount: 5
      };
    case 24:
      return {
        title: '70 000 🪙 + 4 Реликвии',
        description: '+70 000 Золота и 4x Древние Реликвии',
        icon: '🏺',
        gold: 70000,
        relicsCount: 4
      };
    case 25:
      return {
        title: '50 💎 + VIP (2 дн.) + Элитный сундук',
        description: '+50 Кристаллов, VIP-статус на 2 дня и 1x Элитный сундук',
        icon: '👑',
        crystals: 50,
        vipDays: 2,
        chestType: 'elite',
        chestCount: 1
      };
    case 26:
      return {
        title: '80 000 🪙 + Наживка Ра (5 шт.)',
        description: '+80 000 Золота и 5x Королевская приманка Ра',
        icon: '🪙',
        gold: 80000,
        baitId: 'bait_royal',
        baitName: 'Королевская приманка Ра',
        baitCount: 5
      };
    case 27:
      return {
        title: '45 💎 + 5 Реликвий',
        description: '+45 Кристаллов и 5x Древних Реликвий',
        icon: '💎',
        crystals: 45,
        relicsCount: 5
      };
    case 28:
      return {
        title: '90 000 🪙 + 100 ⚡',
        description: '+90 000 Золота и +100 Энергии',
        icon: '⚡',
        gold: 90000,
        energy: 100
      };
    case 29:
      return {
        title: '55 💎 + 2 Элитных сундука',
        description: '+55 Кристаллов и 2x Элитных сундука',
        icon: '🎁',
        crystals: 55,
        chestType: 'elite',
        chestCount: 2
      };
    case 30:
      return {
        title: 'VIP (7 дн.) + Вертолет «Апач Сезона» (1000/1000)',
        description: 'VIP-статус на 7 дней и уникальный транспорт для Порта: «Вертолет «Апач Сезона»» (Прочность 1000/1000)',
        icon: '🚁',
        vipDays: 7,
        transportId: 'apache_season',
        transportName: 'Вертолет «Апач Сезона»',
        transportDurability: 1000
      };
    case 31:
      return {
        title: '100 000 🪙 + 5 Реликвий',
        description: '+100 000 Золота и 5x Древних Реликвий',
        icon: '🏺',
        gold: 100000,
        relicsCount: 5
      };
    case 32:
      return {
        title: '60 💎 + Наживка Ра (6 шт.)',
        description: '+60 Кристаллов и 6x Королевская приманка Ра',
        icon: '💎',
        crystals: 60,
        baitId: 'bait_royal',
        baitName: 'Королевская приманка Ра',
        baitCount: 6
      };
    case 33:
      return {
        title: '110 000 🪙 + 2 Элитных сундука',
        description: '+110 000 Золота и 2x Элитных сундука',
        icon: '🎁',
        gold: 110000,
        chestType: 'elite',
        chestCount: 2
      };
    case 34:
      return {
        title: '65 💎 + 6 Реликвий',
        description: '+65 Кристаллов и 6x Древних Реликвий',
        icon: '🏺',
        crystals: 65,
        relicsCount: 6
      };
    case 35:
      return {
        title: '125 000 🪙 + 75 💎 + VIP (3 дн.)',
        description: '+125 000 Золота, +75 Кристаллов и VIP на 3 дня',
        icon: '👑',
        gold: 125000,
        crystals: 75,
        vipDays: 3
      };
    case 36:
      return {
        title: '6 Реликвий + 2 Элитных сундука',
        description: '6x Древних Реликвий и 2x Элитных сундука',
        icon: '🏺',
        relicsCount: 6,
        chestType: 'elite',
        chestCount: 2
      };
    case 37:
      return {
        title: '140 000 🪙 + 80 💎',
        description: '+140 000 Золота и +80 Кристаллов',
        icon: '💎',
        gold: 140000,
        crystals: 80
      };
    case 38:
      return {
        title: '8 Реликвий + 150 ⚡',
        description: '8x Древних Реликвий и +150 Энергии',
        icon: '⚡',
        relicsCount: 8,
        energy: 150
      };
    case 39:
      return {
        title: '160 000 🪙 + 90 💎 + 3 Элитных сундука',
        description: '+160 000 Золота, +90 Кристаллов и 3x Элитных сундука',
        icon: '🎁',
        gold: 160000,
        crystals: 90,
        chestType: 'elite',
        chestCount: 3
      };
    case 40:
    default:
      return {
        title: '150 💎 + Титул «Фараон Сезона» (14 дн.)',
        description: '+150 💎 Кристаллов и эксклюзивный титул «Фараон Сезона» на 14 дней (+25% ко всем статам, золотисто-багровая переливчатая рамка ника)',
        icon: '👑',
        crystals: 150,
        seasonTitleId: 'season_pharaoh',
        seasonTitleName: 'Фараон Сезона',
        seasonTitleDays: 14,
        seasonTitleStatBonusPct: 25
      };
  }
}

export const DEFAULT_BATTLE_PASS_LEVELS: BattlePassLevelConfig[] = Array.from(
  { length: 40 },
  (_, idx) => {
    const level = idx + 1;
    return {
      level,
      xpRequiredForNext: DEFAULT_BATTLE_PASS_XP_TO_NEXT[level] ?? 3880,
      freeReward: buildDefaultFreeReward(level),
      vipReward: buildDefaultVipReward(level)
    };
  }
);

export const DEFAULT_BATTLE_PASS_CONFIG: BattlePassGlobalConfig = {
  seasonId: 'season_1_pharaoh_rise',
  seasonTitle: 'Сезон I: Возвышение Фараона',
  seasonSubtitle: 'Проходите испытания Пирамиды, рыбачьте и забирайте эксклюзивные дары Сезона!',
  seasonEndTimestamp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  vipUnlockCostCrystals: 2000,
  maxLevel: 40,
  levels: DEFAULT_BATTLE_PASS_LEVELS,
  dailyQuests: DEFAULT_BP_DAILY_QUESTS,
  weeklyQuests: DEFAULT_BP_WEEKLY_QUESTS
};

export function getBattlePassDayKey(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function getBattlePassWeekKey(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getBattlePassConfig(overrideFromFlags?: any): BattlePassGlobalConfig {
  try {
    const raw =
      overrideFromFlags ||
      (() => {
        const saved = localStorage.getItem(BATTLE_PASS_STORAGE_KEY);
        return saved ? JSON.parse(saved) : null;
      })();

    if (!raw || typeof raw !== 'object') {
      return DEFAULT_BATTLE_PASS_CONFIG;
    }

    const levels: BattlePassLevelConfig[] = DEFAULT_BATTLE_PASS_LEVELS.map((defLvl) => {
      const found = Array.isArray(raw.levels)
        ? raw.levels.find((l: any) => Number(l?.level) === defLvl.level)
        : null;
      if (!found) return defLvl;
      const rawXp = Number(found.xpRequiredForNext);
      return {
        level: defLvl.level,
        xpRequiredForNext: rawXp >= 10 ? rawXp : defLvl.xpRequiredForNext,
        freeReward: {
          ...defLvl.freeReward,
          ...(found.freeReward || {})
        },
        vipReward: {
          ...defLvl.vipReward,
          ...(found.vipReward || {})
        }
      };
    });

    const dailyQuests: BattlePassQuestTemplate[] = Array.isArray(raw.dailyQuests) && raw.dailyQuests.length > 0
      ? raw.dailyQuests
      : DEFAULT_BP_DAILY_QUESTS;

    const weeklyQuests: BattlePassQuestTemplate[] = Array.isArray(raw.weeklyQuests) && raw.weeklyQuests.length > 0
      ? raw.weeklyQuests
      : DEFAULT_BP_WEEKLY_QUESTS;

    const rawVipCost = Number(raw.vipUnlockCostCrystals);
    // Migrate legacy 250 / 500 default to 2000 crystals unless explicitly customized to another price
    const resolvedVipCost =
      !rawVipCost || rawVipCost === 250 || rawVipCost === 500
        ? DEFAULT_BATTLE_PASS_CONFIG.vipUnlockCostCrystals
        : Math.max(1, rawVipCost);

    return {
      seasonId: String(raw.seasonId || DEFAULT_BATTLE_PASS_CONFIG.seasonId),
      seasonTitle: String(raw.seasonTitle || DEFAULT_BATTLE_PASS_CONFIG.seasonTitle),
      seasonSubtitle: String(raw.seasonSubtitle || DEFAULT_BATTLE_PASS_CONFIG.seasonSubtitle),
      seasonEndTimestamp:
        Number(raw.seasonEndTimestamp) > 0
          ? Number(raw.seasonEndTimestamp)
          : DEFAULT_BATTLE_PASS_CONFIG.seasonEndTimestamp,
      vipUnlockCostCrystals: resolvedVipCost,
      maxLevel: 40,
      levels,
      dailyQuests,
      weeklyQuests
    };
  } catch {
    return DEFAULT_BATTLE_PASS_CONFIG;
  }
}

export function saveBattlePassConfigLocal(cfg: BattlePassGlobalConfig): void {
  try {
    localStorage.setItem(BATTLE_PASS_STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn('Failed to save battle pass config locally:', e);
  }
}

export function normalizePlayerBattlePassState(
  raw: any,
  nowMs: number = Date.now(),
  cfg: BattlePassGlobalConfig = getBattlePassConfig()
): PlayerBattlePassState {
  const todayKey = getBattlePassDayKey(nowMs);
  const weekKey = getBattlePassWeekKey(nowMs);

  const isSameSeason = raw && typeof raw === 'object' && (!raw.seasonId || raw.seasonId === cfg.seasonId);
  const base = isSameSeason && raw ? raw : {};

  let level = Math.max(1, Math.min(40, Math.floor(Number(base.level) || 1)));
  let currentXp = Math.max(0, Math.floor(Number(base.currentXp) || 0));
  const totalXpEarned = Math.max(0, Math.floor(Number(base.totalXpEarned) || 0));
  const isVipUnlocked = Boolean(base.isVipUnlocked);

  // Прогрессивный пересчет уровня по таблице опыта (от 50 XP на Ур.1 до 3 880 XP на Ур.40)
  while (level < 40) {
    const req = getBattlePassLevelXpRequirement(level, cfg);
    if (currentXp >= req) {
      currentXp -= req;
      level += 1;
    } else {
      break;
    }
  }
  if (level >= 40) {
    level = 40;
    currentXp = 0;
  }

  const claimedFreeLevels: number[] = Array.isArray(base.claimedFreeLevels)
    ? Array.from(new Set(base.claimedFreeLevels.map((n: any) => Number(n)).filter((n: number) => n >= 1 && n <= 40)))
    : [];
  const claimedVipLevels: number[] = Array.isArray(base.claimedVipLevels)
    ? Array.from(new Set(base.claimedVipLevels.map((n: any) => Number(n)).filter((n: number) => n >= 1 && n <= 40)))
    : [];

  const sameDay = base.dailyDayKey === todayKey;
  const sameWeek = base.weeklyWeekKey === weekKey;

  const dailyQuests: Record<string, PlayerBattlePassQuestProgress> = {};
  cfg.dailyQuests.forEach((tpl) => {
    const prev = sameDay && base.dailyQuests?.[tpl.id] ? base.dailyQuests[tpl.id] : null;
    const prog = Math.max(0, Math.min(tpl.target, Math.floor(Number(prev?.progress) || 0)));
    dailyQuests[tpl.id] = {
      id: tpl.id,
      progress: prog,
      isCompleted: Boolean(prev?.isCompleted || prog >= tpl.target),
      isClaimed: Boolean(prev?.isClaimed)
    };
  });

  const weeklyQuests: Record<string, PlayerBattlePassQuestProgress> = {};
  cfg.weeklyQuests.forEach((tpl) => {
    const prev = sameWeek && base.weeklyQuests?.[tpl.id] ? base.weeklyQuests[tpl.id] : null;
    const prog = Math.max(0, Math.min(tpl.target, Math.floor(Number(prev?.progress) || 0)));
    weeklyQuests[tpl.id] = {
      id: tpl.id,
      progress: prog,
      isCompleted: Boolean(prev?.isCompleted || prog >= tpl.target),
      isClaimed: Boolean(prev?.isClaimed)
    };
  });

  const ownedTitles = Array.isArray(base.ownedTitles)
    ? base.ownedTitles.filter((t: any) => t && Number(t.expiresAt) > nowMs)
    : [];

  let activeTitleId: SeasonTitleId | null = base.activeTitleId || null;
  let activeTitleName: string | null = base.activeTitleName || null;
  let activeTitleUntil: number = Number(base.activeTitleUntil || 0);
  let activeTitleBonusPct: number = Number(base.activeTitleBonusPct || 0);

  if (activeTitleUntil <= nowMs) {
    // Check if another owned title is still active
    const validOwned = ownedTitles.sort((a: any, b: any) => b.bonusPct - a.bonusPct)[0];
    if (validOwned) {
      activeTitleId = validOwned.id;
      activeTitleName = validOwned.name;
      activeTitleUntil = validOwned.expiresAt;
      activeTitleBonusPct = validOwned.bonusPct;
    } else {
      activeTitleId = null;
      activeTitleName = null;
      activeTitleUntil = 0;
      activeTitleBonusPct = 0;
    }
  }

  return {
    seasonId: cfg.seasonId,
    level,
    currentXp,
    totalXpEarned,
    isVipUnlocked,
    vipUnlockedAt: base.vipUnlockedAt,
    claimedFreeLevels,
    claimedVipLevels,
    dailyDayKey: todayKey,
    weeklyWeekKey: weekKey,
    dailyQuests,
    weeklyQuests,
    activeTitleId,
    activeTitleName,
    activeTitleUntil,
    activeTitleBonusPct,
    ownedTitles
  };
}

export function addBattlePassXp(
  rawState: any,
  xpToAdd: number,
  nowMs: number = Date.now(),
  cfg: BattlePassGlobalConfig = getBattlePassConfig()
): {
  nextState: PlayerBattlePassState;
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
} {
  const state = normalizePlayerBattlePassState(rawState, nowMs, cfg);
  const cleanAdd = Math.max(0, Math.floor(Number(xpToAdd) || 0));
  if (cleanAdd <= 0) {
    return { nextState: state, leveledUp: false, oldLevel: state.level, newLevel: state.level };
  }

  const oldLevel = state.level;
  let lvl = state.level;
  let curXp = state.currentXp + cleanAdd;
  const totalXpEarned = state.totalXpEarned + cleanAdd;

  while (lvl < 40) {
    const req = getBattlePassLevelXpRequirement(lvl, cfg);
    if (curXp >= req) {
      curXp -= req;
      lvl += 1;
    } else {
      break;
    }
  }

  if (lvl >= 40) {
    lvl = 40;
    curXp = 0;
  }

  const nextState: PlayerBattlePassState = {
    ...state,
    level: lvl,
    currentXp: curXp,
    totalXpEarned
  };

  return {
    nextState,
    leveledUp: lvl > oldLevel,
    oldLevel,
    newLevel: lvl
  };
}

export function recordBattlePassAction(
  rawState: any,
  actionType: BattlePassQuestActionType,
  amount: number = 1,
  directXpBonus: number = 0,
  nowMs: number = Date.now(),
  cfg: BattlePassGlobalConfig = getBattlePassConfig()
): {
  nextState: PlayerBattlePassState;
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  newlyCompletedQuests: BattlePassQuestTemplate[];
} {
  const state = normalizePlayerBattlePassState(rawState, nowMs, cfg);
  const inc = Math.max(1, Math.floor(Number(amount) || 1));
  const newlyCompletedQuests: BattlePassQuestTemplate[] = [];

  const nextDaily = { ...state.dailyQuests };
  cfg.dailyQuests.forEach((tpl) => {
    if (tpl.actionType !== actionType) return;
    const cur = nextDaily[tpl.id] || { id: tpl.id, progress: 0, isCompleted: false, isClaimed: false };
    if (cur.isCompleted) return;
    const nextProg = Math.min(tpl.target, cur.progress + inc);
    const nowDone = nextProg >= tpl.target;
    if (nowDone && !cur.isCompleted) {
      newlyCompletedQuests.push(tpl);
    }
    nextDaily[tpl.id] = {
      ...cur,
      progress: nextProg,
      isCompleted: nowDone
    };
  });

  const nextWeekly = { ...state.weeklyQuests };
  cfg.weeklyQuests.forEach((tpl) => {
    if (tpl.actionType !== actionType) return;
    const cur = nextWeekly[tpl.id] || { id: tpl.id, progress: 0, isCompleted: false, isClaimed: false };
    if (cur.isCompleted) return;
    const nextProg = Math.min(tpl.target, cur.progress + inc);
    const nowDone = nextProg >= tpl.target;
    if (nowDone && !cur.isCompleted) {
      newlyCompletedQuests.push(tpl);
    }
    nextWeekly[tpl.id] = {
      ...cur,
      progress: nextProg,
      isCompleted: nowDone
    };
  });

  const updatedWithQuests: PlayerBattlePassState = {
    ...state,
    dailyQuests: nextDaily,
    weeklyQuests: nextWeekly
  };

  if (directXpBonus > 0) {
    const xpRes = addBattlePassXp(updatedWithQuests, directXpBonus, nowMs, cfg);
    return {
      ...xpRes,
      newlyCompletedQuests
    };
  }

  return {
    nextState: updatedWithQuests,
    leveledUp: false,
    oldLevel: state.level,
    newLevel: state.level,
    newlyCompletedQuests
  };
}

export function getActiveSeasonTitle(
  heroOrBp: any,
  nowMs: number = Date.now()
): {
  id: SeasonTitleId;
  name: string;
  bonusPct: number;
  expiresAt: number;
} | null {
  const bp: PlayerBattlePassState | undefined = heroOrBp?.battlePass
    ? heroOrBp.battlePass
    : heroOrBp?.seasonId
    ? heroOrBp
    : undefined;

  const titleId = (bp?.activeTitleId || heroOrBp?.seasonTitleId) as SeasonTitleId | undefined;
  const titleUntil = Number(bp?.activeTitleUntil || heroOrBp?.seasonTitleUntil || 0);
  if (!titleId || titleUntil <= nowMs) return null;

  if (titleId === 'season_pharaoh') {
    return {
      id: 'season_pharaoh',
      name: bp?.activeTitleName || 'Фараон Сезона',
      bonusPct: Number(bp?.activeTitleBonusPct || 25),
      expiresAt: titleUntil
    };
  }

  if (titleId === 'sand_explorer') {
    return {
      id: 'sand_explorer',
      name: bp?.activeTitleName || 'Исследователь Песков',
      bonusPct: Number(bp?.activeTitleBonusPct || 15),
      expiresAt: titleUntil
    };
  }

  return null;
}

export function createSeasonTransportItem(
  transportId: 'scarab_boat' | 'apache_season',
  customName?: string,
  customDurability?: number
): GameItem {
  if (transportId === 'apache_season') {
    const dur = Math.max(100, Number(customDurability || 1000));
    return {
      id: `bp_transport_apache_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      shopTemplateId: 'bp_apache_season',
      transportTemplateId: 'bp_apache_season',
      name: customName || 'Вертолет «Апач Сезона»',
      slot: 'transport',
      icon: '🚁',
      quality: 'legendary',
      lvl: 1,
      dmg: 25,
      hp: 250,
      dodgeBonus: 5,
      energyBonus: 25,
      goldBonusPct: 15,
      expBonusPct: 15,
      durability: dur,
      maxDurability: dur,
      initialMaxDurability: dur,
      isTransport: true,
      isNamedTransport: true,
      travelTimeSec: 60, // 1 мин в Порт
      timeReductionPct: 50,
      transferable: false,
      origin: 'Эксклюзивная награда 30 уровня Боевого Пропуска (VIP)'
    };
  }

  const dur = Math.max(100, Number(customDurability || 500));
  return {
    id: `bp_transport_scarab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    shopTemplateId: 'bp_scarab_boat',
    transportTemplateId: 'bp_scarab_boat',
    name: customName || 'Легкий катер «Скарабей»',
    slot: 'transport',
    icon: '🚤',
    quality: 'epic',
    lvl: 1,
    dmg: 10,
    hp: 100,
    dodgeBonus: 2,
    energyBonus: 10,
    goldBonusPct: 8,
    expBonusPct: 8,
    durability: dur,
    maxDurability: dur,
    initialMaxDurability: dur,
    isTransport: true,
    isNamedTransport: true,
    travelTimeSec: 120, // 2 мин в Порт
    timeReductionPct: 35,
    transferable: false,
    origin: 'Уникальная награда 5 уровня Боевого Пропуска (VIP)'
  };
}

export function openBattlePassChest(
  chestType: BattlePassChestType,
  count: number = 1,
  heroLevel: number = 1
): {
  gold: number;
  crystals: number;
  energy: number;
  hpPotions: number;
  enPotions: number;
  items: GameItem[];
  summaryText: string;
} {
  const qty = Math.max(1, Math.floor(Number(count) || 1));
  let gold = 0;
  let crystals = 0;
  let energy = 0;
  let hpPotions = 0;
  let enPotions = 0;
  const items: GameItem[] = [];

  for (let i = 0; i < qty; i++) {
    if (chestType === 'basic') {
      gold += 1200 + Math.floor(Math.random() * 800);
      hpPotions += 1;
      if (Math.random() < 0.4) enPotions += 1;
    } else if (chestType === 'silver') {
      gold += 3000 + Math.floor(Math.random() * 2000);
      crystals += 3 + Math.floor(Math.random() * 4);
      hpPotions += 2;
      enPotions += 1;
    } else if (chestType === 'gold') {
      gold += 7500 + Math.floor(Math.random() * 4500);
      crystals += 8 + Math.floor(Math.random() * 8);
      energy += 20;
      hpPotions += 2;
      enPotions += 2;
      if (Math.random() < 0.5) {
        items.push(generateItem(Math.max(1, heroLevel)));
      }
    } else if (chestType === 'elite') {
      gold += 18000 + Math.floor(Math.random() * 12000);
      crystals += 20 + Math.floor(Math.random() * 15);
      energy += 35;
      hpPotions += 3;
      enPotions += 3;
      items.push(generateItem(Math.max(1, heroLevel)));
    }
  }

  const chestNames: Record<BattlePassChestType, string> = {
    basic: 'Базовый сундук',
    silver: 'Серебряный сундук',
    gold: 'Золотой сундук',
    elite: 'Элитный сундук'
  };

  const parts: string[] = [];
  if (gold > 0) parts.push(`+${gold.toLocaleString('ru-RU')} 🪙`);
  if (crystals > 0) parts.push(`+${crystals} 💎`);
  if (energy > 0) parts.push(`+${energy} ⚡`);
  if (hpPotions > 0) parts.push(`+${hpPotions} 🧪HP`);
  if (enPotions > 0) parts.push(`+${enPotions} ⚡EN`);
  if (items.length > 0) parts.push(`+${items.length} ⚔️ предм.`);

  return {
    gold,
    crystals,
    energy,
    hpPotions,
    enPotions,
    items,
    summaryText: `${chestNames[chestType]} (x${qty}): ${parts.join(', ')}`
  };
}

export function getBattlePassClaimableCount(
  hero: any,
  nowMs: number = Date.now(),
  cfg: BattlePassGlobalConfig = getBattlePassConfig()
): number {
  const bp = normalizePlayerBattlePassState(hero?.battlePass, nowMs, cfg);
  let count = 0;

  for (let lvl = 1; lvl <= bp.level; lvl++) {
    if (!bp.claimedFreeLevels.includes(lvl)) {
      count += 1;
    }
    if (bp.isVipUnlocked && !bp.claimedVipLevels.includes(lvl)) {
      count += 1;
    }
  }

  Object.values(bp.dailyQuests).forEach((q) => {
    if (q.isCompleted && !q.isClaimed) count += 1;
  });
  Object.values(bp.weeklyQuests).forEach((q) => {
    if (q.isCompleted && !q.isClaimed) count += 1;
  });

  return count;
}

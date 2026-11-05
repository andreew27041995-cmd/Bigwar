import { GameItem, ItemQualityKey } from '../types/game';

export type FishRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type FishingLocationId = 'loc_1' | 'loc_2' | 'loc_3' | 'loc_4' | 'loc_5';

export interface FishingLocation {
  id: FishingLocationId;
  index: 1 | 2 | 3 | 4 | 5;
  name: string;
  shortName: string;
  icon: string;
  minRodLevel: 1 | 2 | 3 | 4 | 5;
  description: string;
  skyColors: [string, string, string];
  waterColors: [string, string, string, string];
  sunColor: string;
  rareBonusPct: number;
}

export type FishingDepthZoneId = 'shallow' | 'canyon' | 'sunken_barge';

export interface FishingDepthZone {
  id: FishingDepthZoneId;
  name: string;
  shortName: string;
  icon: string;
  depthMeters: string;
  description: string;
  bonusTitle: string;
  rareBonusPct: number;
  weightBonusPct: number;
  chestBonusPct: number;
  biteSpeedBonusPct: number;
  favoredTimeOfDay?: 'morning' | 'day' | 'sunset' | 'night';
  floatTargetXRatio: number;
  floatTargetYRatio: number;
}

export const FISHING_DEPTH_ZONES: FishingDepthZone[] = [
  {
    id: 'shallow',
    name: 'Мелководье у камышей',
    shortName: 'Мелководье',
    icon: '🌾',
    depthMeters: '1.2 - 2.5 м',
    description: 'Тёплые отмели у зарослей лотоса и папируса. Идеально для утренней рыбалки и быстрого клёва.',
    bonusTitle: '+25% к скорости поклёвки, базовые виды',
    rareBonusPct: 10,
    weightBonusPct: 0,
    chestBonusPct: 0,
    biteSpeedBonusPct: 25,
    favoredTimeOfDay: 'morning',
    floatTargetXRatio: 0.32,
    floatTargetYRatio: 0.62
  },
  {
    id: 'canyon',
    name: 'Глубокий каньон у Пирамид',
    shortName: 'Каньон Пирамид',
    icon: '🏛️',
    depthMeters: '8.0 - 15.0 м',
    description: 'Холодное глубинное русло, где укрываются гигантские донные сомы и хищники Нила.',
    bonusTitle: '+40% к весу рыбы и шанс на трофейных гигантов',
    rareBonusPct: 35,
    weightBonusPct: 40,
    chestBonusPct: 3,
    biteSpeedBonusPct: -10,
    favoredTimeOfDay: 'day',
    floatTargetXRatio: 0.48,
    floatTargetYRatio: 0.52
  },
  {
    id: 'sunken_barge',
    name: 'Затонувшая баржа фараона',
    shortName: 'Затонувшая баржа',
    icon: '⛵',
    depthMeters: '4.5 - 7.0 м',
    description: 'Остатки золотого судна вельможи на дне. Здесь скапливаются древние артефакты и редчайшие трофеи Нила.',
    bonusTitle: '+12% к сундукам и удвоенный шанс редких реликвий',
    rareBonusPct: 45,
    weightBonusPct: 20,
    chestBonusPct: 12,
    biteSpeedBonusPct: 0,
    favoredTimeOfDay: 'sunset',
    floatTargetXRatio: 0.64,
    floatTargetYRatio: 0.56
  }
];

export function getActiveColdCurrentZone(nowMs: number = Date.now()): {
  zoneId: FishingDepthZoneId;
  name: string;
  bonusText: string;
  remainingSec: number;
} {
  const currentIntervalMs = 10 * 60 * 1000; // 10 minutes rotation
  const slot = Math.floor(nowMs / currentIntervalMs);
  const zoneIds: FishingDepthZoneId[] = ['shallow', 'canyon', 'sunken_barge'];
  const activeZoneId = zoneIds[slot % zoneIds.length];
  const nextChangeMs = (slot + 1) * currentIntervalMs;
  const remainingSec = Math.max(1, Math.ceil((nextChangeMs - nowMs) / 1000));
  const z = FISHING_DEPTH_ZONES.find((item) => item.id === activeZoneId) || FISHING_DEPTH_ZONES[0];
  return {
    zoneId: activeZoneId,
    name: `Холодное течение: ${z.shortName}`,
    bonusText: '+25% к шансу редких и мифических видов в этой зоне!',
    remainingSec
  };
}

export interface TrophyMuseumItem {
  id: string;
  name: string;
  icon: string;
  rarity: 'rare' | 'epic' | 'legendary' | 'mythic';
  category: 'artifact' | 'trophy';
  source: string;
  description: string;
  bonusText: string;
  bonusType: 'energy' | 'gold_pct' | 'crit_pct' | 'pyramid_chest_pct' | 'gear_durability_pct' | 'max_hp' | 'fishing_exp_pct' | 'rare_fish_pct';
  bonusValue: number;
}

export const NILE_TROPHIES: TrophyMuseumItem[] = [
  {
    id: 'trophy_amulet_ra',
    name: 'Амулет Ока Ра со дна Нила',
    icon: '𓂀',
    rarity: 'epic',
    category: 'artifact',
    source: 'Затонувшие баржи и глубинное русло',
    description: 'Золотой амулет с сапфировым зрачком, пролежавший на дне реки более трёх тысяч лет.',
    bonusText: '+10 к максимальному запасу энергии (⚡)',
    bonusType: 'energy',
    bonusValue: 10
  },
  {
    id: 'trophy_amphora_gold',
    name: 'Золотая амфора фараона',
    icon: '🏺',
    rarity: 'rare',
    category: 'artifact',
    source: 'Иловые отложения и сундуки Нила',
    description: 'Запечатанная смолой старинная амфора с золотыми слитками казны первых династий.',
    bonusText: '+5% к получаемому золоту во всех боях (🪙)',
    bonusType: 'gold_pct',
    bonusValue: 5
  },
  {
    id: 'trophy_croc_tooth',
    name: 'Окаменевший клык Себека',
    icon: '🐊',
    rarity: 'epic',
    category: 'trophy',
    source: 'Глубокий каньон и катакомбы',
    description: 'Огромный окаменелый клык древнего священного нильского крокодила-титана.',
    bonusText: '+3% к шансу критического удара (⚔️)',
    bonusType: 'crit_pct',
    bonusValue: 3
  },
  {
    id: 'trophy_emerald_scarab',
    name: 'Изумрудный скарабей глубин',
    icon: '🪲',
    rarity: 'legendary',
    category: 'artifact',
    source: 'Затонувшие баржи и священные оазисы',
    description: 'Магический скарабей из цельного изумруда, привлекающий подземные сокровища.',
    bonusText: '+10% к шансу найти сундук в залах Пирамиды (🧰)',
    bonusType: 'pyramid_chest_pct',
    bonusValue: 10
  },
  {
    id: 'trophy_golden_hook',
    name: 'Золотой крючок древних зодчих',
    icon: '🪝',
    rarity: 'rare',
    category: 'artifact',
    source: 'Камыши Луксора и причалы',
    description: 'Изящный ювелирный крючок жрецов-рыболовов времён строительства пирамид.',
    bonusText: '+15% к прочности всех рыболовных лесок и крючков',
    bonusType: 'gear_durability_pct',
    bonusValue: 15
  },
  {
    id: 'trophy_anubis_urn',
    name: 'Канопа ночных глубин',
    icon: '⚱️',
    rarity: 'legendary',
    category: 'artifact',
    source: 'Глубокие каньоны Нила',
    description: 'Алебастровый ритуальный сосуд, наполненный благословением духов ночного Нила.',
    bonusText: '+25 к максимальному здоровью героя (❤️)',
    bonusType: 'max_hp',
    bonusValue: 25
  },
  {
    id: 'trophy_lotus_crown',
    name: 'Венец священного лотоса',
    icon: '🪷',
    rarity: 'mythic',
    category: 'trophy',
    source: 'Редчайший улов в дельте Нила',
    description: 'Корона из окаменевших лепестков голубого нильского лотоса с вечным ароматом богов.',
    bonusText: '+15% к опыту рыбалки и скорости прокачки удочек',
    bonusType: 'fishing_exp_pct',
    bonusValue: 15
  },
  {
    id: 'trophy_papyrus_scroll',
    name: 'Свиток картографа русла',
    icon: '📜',
    rarity: 'rare',
    category: 'artifact',
    source: 'Сундуки Нила и отмели',
    description: 'Древняя карта тайных омутов и мест скопления редчайшей рыбы фараонов.',
    bonusText: '+12% к шансу поклёвки редких и эпических рыб',
    bonusType: 'rare_fish_pct',
    bonusValue: 12
  }
];

export interface TrophyMuseumSummary {
  collectedCount: number;
  totalCount: number;
  totalEnergyBonus: number;
  totalGoldBonusPct: number;
  totalCritBonusPct: number;
  totalPyramidChestBonusPct: number;
  totalGearDurabilityBonusPct: number;
  totalMaxHpBonus: number;
  totalFishingExpBonusPct: number;
  totalRareFishBonusPct: number;
  isSetBonus3Active: boolean;
  isSetBonus5Active: boolean;
  isSetBonusAllActive: boolean;
}

export function getTrophyMuseumBonuses(museum?: Record<string, number>): TrophyMuseumSummary {
  const m = museum || {};
  let energy = 0;
  let goldPct = 0;
  let critPct = 0;
  let chestPct = 0;
  let durPct = 0;
  let maxHp = 0;
  let fishExpPct = 0;
  let rareFishPct = 0;

  let collectedCount = 0;
  NILE_TROPHIES.forEach((t) => {
    if (m[t.id] && m[t.id] > 0) {
      collectedCount++;
      switch (t.bonusType) {
        case 'energy': energy += t.bonusValue; break;
        case 'gold_pct': goldPct += t.bonusValue; break;
        case 'crit_pct': critPct += t.bonusValue; break;
        case 'pyramid_chest_pct': chestPct += t.bonusValue; break;
        case 'gear_durability_pct': durPct += t.bonusValue; break;
        case 'max_hp': maxHp += t.bonusValue; break;
        case 'fishing_exp_pct': fishExpPct += t.bonusValue; break;
        case 'rare_fish_pct': rareFishPct += t.bonusValue; break;
      }
    }
  });

  const isSetBonus3Active = collectedCount >= 3;
  const isSetBonus5Active = collectedCount >= 5;
  const isSetBonusAllActive = collectedCount >= NILE_TROPHIES.length;

  if (isSetBonus3Active) energy += 10;
  if (isSetBonus5Active) chestPct += 5;
  if (isSetBonusAllActive) {
    maxHp += 25;
    rareFishPct += 10;
  }

  return {
    collectedCount,
    totalCount: NILE_TROPHIES.length,
    totalEnergyBonus: energy,
    totalGoldBonusPct: goldPct,
    totalCritBonusPct: critPct,
    totalPyramidChestBonusPct: chestPct,
    totalGearDurabilityBonusPct: durPct,
    totalMaxHpBonus: maxHp,
    totalFishingExpBonusPct: fishExpPct,
    totalRareFishBonusPct: rareFishPct,
    isSetBonus3Active,
    isSetBonus5Active,
    isSetBonusAllActive
  };
}

export interface FishingBaitTemplate {
  id: string;
  name: string;
  icon: string;
  packSize: number;
  priceGold: number;
  priceCrystals: number;
  currency: 'gold' | 'crystals';
  rareChanceBonusPct: number;
  weightBonusPct: number;
  tensionControlBonusPct: number;
  minRarityFilter?: 'uncommon' | 'rare';
  chestBonusPct?: number;
  description: string;
}

export interface FishingNetTemplate {
  id: string;
  name: string;
  icon: string;
  minRodLevel: number;
  priceGold: number;
  priceCrystals: number;
  currency: 'gold' | 'crystals';
  catchDurationSec: number; // Time until net is full of fish
  spoilAfterReadySec: number; // Time after readyAt before fish in the net die
  minFishCount: number;
  maxFishCount: number;
  rareBonusPct: number;
  description: string;
}

export interface FishingNetLicensePackage {
  id: string;
  name: string;
  icon: string;
  usesCount: number;
  priceGold: number;
  priceCrystals: number;
  currency: 'gold' | 'crystals';
  description: string;
}

export interface FishingLineTemplate {
  id: string;
  name: string;
  icon: string;
  durability: number;
  maxDurability: number;
  stabilityBonusPct: number; // снижает шанс схода рыбы и обрыва снасти
  priceGold: number;
  priceCrystals: number;
  currency: 'gold' | 'crystals';
  description: string;
}

export interface FishingHookTemplate {
  id: string;
  name: string;
  icon: string;
  durability: number;
  maxDurability: number;
  rareFishChanceBonusPct: number; // повышает шанс поймать редкую рыбу
  chestChanceBonusPct: number; // повышает шанс выловить сундук
  priceGold: number;
  priceCrystals: number;
  currency: 'gold' | 'crystals';
  description: string;
}

export interface ActiveFishingNetState {
  netId: string;
  netName: string;
  netIcon: string;
  locationId: FishingLocationId;
  locationName: string;
  castAt: number;
  readyAt: number;
  spoilAt: number;
  minFishCount: number;
  maxFishCount: number;
  rareBonusPct: number;
}

export interface FishSpecies {
  id: string;
  index: number; // 1..50
  locationId: FishingLocationId;
  name: string;
  rarity: FishRarity;
  rewardType: 'gold' | 'crystals' | 'both';
  baseGold: number;
  baseCrystals: number;
  baseExp: number;
  minWeightKg: number;
  maxWeightKg: number;
  catchWeight: number; // Relative probability weight
  minRodLevel: number; // 1..5
  strugglePower: number; // 1..10 difficulty during reeling
  iconUrl: string; // Cached SVG data URI or custom uploaded image URL
  image?: string; // Alias for iconUrl
  description: string;
  enabled: boolean;
}

export interface FishingRodTemplate {
  id: string;
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  icon: string;
  requiredFishCaught: number; // 0, 25, 55, 90, 130
  priceGold: number;
  priceCrystals: number;
  currency: 'free' | 'gold' | 'crystals' | 'both';
  rareFishChanceBonusPct: number;
  chestChanceBonusPct: number;
  weightMultiplier: number;
  lineStrength: number;
  description: string;
}

export interface SunkenChestConfig {
  dropChancePct: number; // Base % chance to hook a sunken chest instead of a fish
  relicWeightPct: number; // % weight inside chest for Relic
  expBuffWeightPct: number; // % weight inside chest for 10-min EXP buff
  energyWeightPct: number; // % weight inside chest for Energy
  expBuffBonusPct: number; // e.g. +50% EXP
  expBuffPct?: number; // Alias
  expBuffDurationMinutes: number; // 10 minutes
  expBuffDurationMin?: number; // Alias
  energyRewardMin: number; // e.g. 25
  energyMin?: number; // Alias
  energyRewardMax: number; // e.g. 50
  energyMax?: number; // Alias
}

export interface GlobalFishingConfig {
  enabled: boolean;
  energyPerCast: number;
  energyCostPerCast?: number;
  chestConfig: SunkenChestConfig;
  sunkenChest: SunkenChestConfig;
  rods: FishingRodTemplate[];
  fishes: FishSpecies[];
  fishSpecies: FishSpecies[];
}

export interface CaughtFishRecord {
  count: number;
  maxWeightKg: number;
  firstCaughtAt: number;
  totalGoldEarned?: number;
  totalCrystalsEarned?: number;
}

export interface StoredKeepnetFish {
  uid: string;
  fishId: string;
  fishName: string;
  rarity: FishRarity;
  weightKg: number;
  goldValue: number;
  crystalsValue: number;
  caughtAt: number;
}

export interface FishingKeepnetUpgrade {
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  icon: string;
  capacity: number; // Base = 20
  priceGold: number;
  priceCrystals: number;
  description: string;
}

export interface FishingWeatherBoost {
  id: string;
  name: string;
  icon: string;
  badgeColor: string;
  description: string;
  rareBonusPct: number;
  biteDelayMultiplier: number; // < 1 means faster bite timer
  weightBonusPct: number;
  chestBonusPct: number;
  tensionControlBonusPct: number;
}

export type FishingAchievementCategory = 'fish_caught' | 'chests_opened' | 'collection_unique';

export interface FishingAchievementTemplate {
  id: string;
  category: FishingAchievementCategory;
  title: string;
  description: string;
  icon: string;
  target: number;
  rewardGold: number;
  rewardCrystals: number;
}

export interface PlayerFishingState {
  totalFishCaught: number;
  weeklyFishCaught?: number;
  totalFishWeightKg?: number;
  weeklyFishWeightKg?: number;
  weeklyMaxFishWeightKg?: number;
  fishingWeekId?: string;
  lastRewardedFishingWeekId?: string;
  fishingMedalRank?: 1 | 2 | 3 | null;
  totalEscapedFish?: number;
  totalChestsOpened: number;
  totalNetsPulled?: number;
  ownedRodLevels: number[]; // e.g. [1, 2]
  equippedRodLevel: number; // 1..5
  rodExp?: number; // Текущий опыт для экипированной удочки
  selectedLocationId: FishingLocationId;
  equippedBaitId: string | null;
  equippedLine?: FishingLineTemplate | null; // Экипированная леска (оснастка)
  equippedHook?: FishingHookTemplate | null; // Экипированный крючок/аксессуар
  baitsInventory: Record<string, number>;
  netsInventory: Record<string, number>;
  linesInventory?: Record<string, number>; // Запас купленных лесок
  hooksInventory?: Record<string, number>; // Запас купленных крючков
  netLicenseUses: number;
  activeNet: ActiveFishingNetState | null;
  collection: Record<string, CaughtFishRecord>; // keyed by fish.id ('fish_1'..'fish_50')
  keepnetLevel: number; // 1..5 (Base level 1 = 20 fish)
  keepnetFish: StoredKeepnetFish[]; // Fish currently stored in keepnet awaiting sale
  claimedFishingAchievements: string[]; // Claimed angler achievement IDs
  selectedDepthZoneId?: FishingDepthZoneId; // Выбранная зона глубин (мелководье / каньон / баржа)
  trophyMuseum?: Record<string, number>; // Коллекция артефактов и трофеев Нила («Стена славы»)
  expBuffUntil?: number;
  expBuffPct?: number;
}

export function getRodExpRequiredForNextLevel(currentLevel: number): number {
  switch (currentLevel) {
    case 1:
      return 100;
    case 2:
      return 250;
    case 3:
      return 500;
    case 4:
      return 1000;
    default:
      return 2000;
  }
}

/**
 * Returns a canonical weekly identifier (Monday 00:00 UTC boundary) for the Weekly Fishing Leaderboard.
 */
export function getCurrentFishingWeekId(nowMs: number = Date.now()): string {
  // Epoch 1970-01-01 was a Thursday. Shift by +3 days so weeks start Monday 00:00 UTC.
  const weekDurationMs = 7 * 24 * 60 * 60 * 1000;
  const shiftMs = 3 * 24 * 60 * 60 * 1000;
  const weekIndex = Math.floor((nowMs + shiftMs) / weekDurationMs);
  return `fweek_${weekIndex}`;
}

/**
 * Returns the timestamp (ms) of the next Monday 00:00 UTC weekly fishing reset.
 */
export function getNextFishingWeekResetMs(nowMs: number = Date.now()): number {
  const weekDurationMs = 7 * 24 * 60 * 60 * 1000;
  const shiftMs = 3 * 24 * 60 * 60 * 1000;
  const weekIndex = Math.floor((nowMs + shiftMs) / weekDurationMs);
  return (weekIndex + 1) * weekDurationMs - shiftMs;
}

/**
 * Formats the time remaining until the weekly fishing leaderboard reset.
 */
export function formatFishingWeekCountdown(nowMs: number = Date.now()): string {
  const diffMs = Math.max(0, getNextFishingWeekResetMs(nowMs) - nowMs);
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) {
    return `${days}д ${hours}ч ${mins}м`;
  }
  return `${hours}ч ${mins}м`;
}

export interface FishingWeeklyRewardInfo {
  rank: number;
  crystals: number;
  gold: number;
  medalRank: 1 | 2 | 3 | null;
  title: string;
  shortLabel: string;
}

/**
 * Weekly Fishing Leaderboard rewards:
 * 1st place: 500 crystals + Gold Fish Medal
 * 2nd place: 250 crystals + Silver Fish Medal
 * 3rd place: 100 crystals + Bronze Fish Medal
 * 4th-10th place: 500 gold
 */
export function getFishingWeeklyReward(rank: number): FishingWeeklyRewardInfo | null {
  if (rank === 1) {
    return {
      rank: 1,
      crystals: 500,
      gold: 0,
      medalRank: 1,
      title: '🥇 1 место в Рейтинге Рыболовов (Золотая медаль Рыбака)',
      shortLabel: '500 💎 + 🥇 Золотая Рыба'
    };
  }
  if (rank === 2) {
    return {
      rank: 2,
      crystals: 250,
      gold: 0,
      medalRank: 2,
      title: '🥈 2 место в Рейтинге Рыболовов (Серебряная медаль Рыбака)',
      shortLabel: '250 💎 + 🥈 Серебряная Рыба'
    };
  }
  if (rank === 3) {
    return {
      rank: 3,
      crystals: 100,
      gold: 0,
      medalRank: 3,
      title: '🥉 3 место в Рейтинге Рыболовов (Бронзовая медаль Рыбака)',
      shortLabel: '100 💎 + 🥉 Бронзовая Рыба'
    };
  }
  if (rank >= 4 && rank <= 10) {
    return {
      rank,
      crystals: 0,
      gold: 500,
      medalRank: null,
      title: `🏅 ${rank} место в Рейтинге Рыболовов недели`,
      shortLabel: '500 🪙 золота'
    };
  }
  return null;
}

export const FISHING_KEEPNET_UPGRADES: FishingKeepnetUpgrade[] = [
  {
    level: 1,
    name: 'Камышовый садок Новичка',
    icon: '🪣',
    capacity: 20,
    priceGold: 0,
    priceCrystals: 0,
    description: 'Базовый садок рыбака. Вмещает до 20 пойманных рыб до продажи улова.'
  },
  {
    level: 2,
    name: 'Плетёный садок Нила',
    icon: '🧺',
    capacity: 35,
    priceGold: 450,
    priceCrystals: 0,
    description: 'Укреплённый плетёный садок из тростника. Увеличивает вместимость улова до 35 рыб.'
  },
  {
    level: 3,
    name: 'Глубокий садок Фаюма',
    icon: '🛢️',
    capacity: 55,
    priceGold: 1200,
    priceCrystals: 0,
    description: 'Просторный садок оазисных ловцов. Вмещает до 55 рыб без необходимости частой продажи.'
  },
  {
    level: 4,
    name: 'Королевский садок Порта',
    icon: '🏺',
    capacity: 85,
    priceGold: 2600,
    priceCrystals: 3,
    description: 'Корабельный садок с проточной водой. Вмещает до 85 крупных рыб и трофеев.'
  },
  {
    level: 5,
    name: 'Бездонный садок Себека',
    icon: '👑',
    capacity: 130,
    priceGold: 5000,
    priceCrystals: 8,
    description: 'Легендарный зачарованный садок жрецов. Вмещает до 130 рыб за одну экспедицию!'
  }
];

export function getKeepnetCapacity(level: number = 1): number {
  const found = FISHING_KEEPNET_UPGRADES.find((u) => u.level === level);
  return found ? found.capacity : 20;
}

export const FISHING_WEATHER_BOOSTS: FishingWeatherBoost[] = [
  {
    id: 'weather_sunny_ra',
    name: 'Солнечный штиль Ра',
    icon: '☀️',
    badgeColor: 'border-amber-400/70 bg-amber-950/80 text-amber-200',
    description: 'Тёплые лучи Ра прогревают воду: +30% к шансу редкой рыбы и +10% к весу улова.',
    rareBonusPct: 30,
    biteDelayMultiplier: 0.95,
    weightBonusPct: 10,
    chestBonusPct: 0,
    tensionControlBonusPct: 5
  },
  {
    id: 'weather_nile_rain',
    name: 'Благодатный дождь Нила',
    icon: '🌧️',
    badgeColor: 'border-sky-400/70 bg-sky-950/80 text-sky-200',
    description: 'Капли дождя приманивают рыбу к поверхности: клёв ускорен на 30%, +20% к редким видам!',
    rareBonusPct: 20,
    biteDelayMultiplier: 0.7,
    weightBonusPct: 5,
    chestBonusPct: 2,
    tensionControlBonusPct: 10
  },
  {
    id: 'weather_golden_tide',
    name: 'Золотой прилив Дельты',
    icon: '🌊',
    badgeColor: 'border-emerald-400/70 bg-emerald-950/80 text-emerald-200',
    description: 'Мощное течение выносит сокровища: +45% к редкой рыбе и +5% к шансу Затонувшего сундука!',
    rareBonusPct: 45,
    biteDelayMultiplier: 0.85,
    weightBonusPct: 15,
    chestBonusPct: 5,
    tensionControlBonusPct: 0
  },
  {
    id: 'weather_oasis_breeze',
    name: 'Попутный бриз Оазиса',
    icon: '🌬️',
    badgeColor: 'border-cyan-400/70 bg-cyan-950/80 text-cyan-200',
    description: 'Свежий ветер помогает рыболову: клёв быстрее на 25% и +18% к удержанию лески при рывках!',
    rareBonusPct: 15,
    biteDelayMultiplier: 0.75,
    weightBonusPct: 8,
    chestBonusPct: 0,
    tensionControlBonusPct: 18
  },
  {
    id: 'weather_starlight_duat',
    name: 'Звёздное сияние Анубиса',
    icon: '🌙',
    badgeColor: 'border-purple-400/70 bg-purple-950/80 text-purple-200',
    description: 'Мистический час глубин: +65% к шансу редких/эпических рыб и +20% к весу трофеев!',
    rareBonusPct: 65,
    biteDelayMultiplier: 0.88,
    weightBonusPct: 20,
    chestBonusPct: 3,
    tensionControlBonusPct: 12
  }
];

const WEATHER_ROTATION_INTERVAL_MS = 5 * 60 * 1000; // Смена погоды каждые 5 минут

export function getActiveLocationWeather(
  locationId: FishingLocationId,
  nowMs: number = Date.now()
): { weather: FishingWeatherBoost; remainingSec: number } {
  const slotIndex = Math.floor(nowMs / WEATHER_ROTATION_INTERVAL_MS);
  const locOffset =
    locationId === 'loc_1'
      ? 0
      : locationId === 'loc_2'
      ? 1
      : locationId === 'loc_3'
      ? 2
      : locationId === 'loc_4'
      ? 3
      : 4;
  const idx = (slotIndex + locOffset) % FISHING_WEATHER_BOOSTS.length;
  const nextChangeMs = (slotIndex + 1) * WEATHER_ROTATION_INTERVAL_MS;
  const remainingSec = Math.max(1, Math.ceil((nextChangeMs - nowMs) / 1000));
  return {
    weather: FISHING_WEATHER_BOOSTS[idx] || FISHING_WEATHER_BOOSTS[0],
    remainingSec
  };
}

export const FISHING_ACHIEVEMENTS: FishingAchievementTemplate[] = [
  // Количество пойманной рыбы
  {
    id: 'fach_fish_10',
    category: 'fish_caught',
    title: 'Первые шаги с удочкой',
    description: 'Поймайте 10 рыб на любой локации',
    icon: '🐟',
    target: 10,
    rewardGold: 150,
    rewardCrystals: 1
  },
  {
    id: 'fach_fish_50',
    category: 'fish_caught',
    title: 'Опытный удильщик Нила',
    description: 'Доведите общий улов до 50 пойманных рыб',
    icon: '🎣',
    target: 50,
    rewardGold: 500,
    rewardCrystals: 3
  },
  {
    id: 'fach_fish_150',
    category: 'fish_caught',
    title: 'Мастер речного промысла',
    description: 'Поймайте суммарно 150 рыб удочкой или сетями',
    icon: '🏅',
    target: 150,
    rewardGold: 1500,
    rewardCrystals: 6
  },
  {
    id: 'fach_fish_400',
    category: 'fish_caught',
    title: 'Повелитель глубин Египта',
    description: 'Поймайте 400 рыб во всех водоёмах',
    icon: '👑',
    target: 400,
    rewardGold: 4000,
    rewardCrystals: 15
  },
  // Выловленные сундуки
  {
    id: 'fach_chest_1',
    category: 'chests_opened',
    title: 'Находка на дне',
    description: 'Вытяните со дна 1 Затонувший сундук фараона',
    icon: '🧰',
    target: 1,
    rewardGold: 200,
    rewardCrystals: 1
  },
  {
    id: 'fach_chest_5',
    category: 'chests_opened',
    title: 'Искатель затонувших реликвий',
    description: 'Выловите 5 Затонувших сундуков во время рыбалки',
    icon: '🏺',
    target: 5,
    rewardGold: 750,
    rewardCrystals: 4
  },
  {
    id: 'fach_chest_15',
    category: 'chests_opened',
    title: 'Хранитель сокровищ Дуата',
    description: 'Поднимите со дна 15 Затонувших сундуков',
    icon: '💎',
    target: 15,
    rewardGold: 2200,
    rewardCrystals: 10
  },
  // Заполнение коллекции
  {
    id: 'fach_coll_10',
    category: 'collection_unique',
    title: 'Коллекционер прибрежий',
    description: 'Откройте 10 уникальных видов рыб в Альбоме коллекций',
    icon: '📘',
    target: 10,
    rewardGold: 400,
    rewardCrystals: 2
  },
  {
    id: 'fach_coll_25',
    category: 'collection_unique',
    title: 'Знаток ихтиофауны Фараонов',
    description: 'Откройте 25 из 50 уникальных видов рыб',
    icon: '🌟',
    target: 25,
    rewardGold: 1400,
    rewardCrystals: 7
  },
  {
    id: 'fach_coll_50',
    category: 'collection_unique',
    title: 'Легенда 5 Водоёмов Ра',
    description: 'Соберите полную коллекцию из всех 50 видов рыб!',
    icon: '🏆',
    target: 50,
    rewardGold: 5000,
    rewardCrystals: 25
  }
];

export function getFishingAchievementProgress(
  ach: FishingAchievementTemplate,
  fishingState: PlayerFishingState,
  uniqueCaughtCount: number
): number {
  if (ach.category === 'fish_caught') {
    return Math.min(ach.target, Math.max(0, Number(fishingState.totalFishCaught || 0)));
  }
  if (ach.category === 'chests_opened') {
    return Math.min(ach.target, Math.max(0, Number(fishingState.totalChestsOpened || 0)));
  }
  return Math.min(ach.target, Math.max(0, uniqueCaughtCount));
}

const FISHING_CONFIG_STORAGE_KEY = 'piramida_fishing_config_v1';

// 5 Distinct Fishing Locations with dedicated 10-fish collections & rod requirements
export const FISHING_LOCATIONS: FishingLocation[] = [
  {
    id: 'loc_1',
    index: 1,
    name: 'Прибрежные Камыши Луксора',
    shortName: 'Камыши Луксора',
    icon: '🌾',
    minRodLevel: 1,
    description: 'Спокойная заводь у древней пристани Луксора. Доступна с любой удочкой (Ур. 1+). Коллекция рыб #1–#10.',
    skyColors: ['#090d1e', '#1e1b4b', '#f59e0b'],
    waterColors: ['#0e7490', '#0369a1', '#0c4a6e', '#082f49'],
    sunColor: '#fef08a',
    rareBonusPct: 0
  },
  {
    id: 'loc_2',
    index: 2,
    name: 'Священный Оазис Фаюм',
    shortName: 'Оазис Фаюм',
    icon: '🌴',
    minRodLevel: 2,
    description: 'Изумрудные воды цветущего оазиса среди песков. Требуется удочка Ур. 2+. Коллекция рыб #11–#20.',
    skyColors: ['#041f1e', '#064e3b', '#10b981'],
    waterColors: ['#0d9488', '#0f766e', '#115e59', '#042f2e'],
    sunColor: '#a7f3d0',
    rareBonusPct: 12
  },
  {
    id: 'loc_3',
    index: 3,
    name: 'Затопленные Катакомбы Себека',
    shortName: 'Катакомбы Себека',
    icon: '🐊',
    minRodLevel: 3,
    description: 'Глубокие подземные воды под храмом бога крокодилов. Требуется удочка Ур. 3+. Коллекция рыб #21–#30.',
    skyColors: ['#090514', '#2e1065', '#7e22ce'],
    waterColors: ['#312e81', '#1e1b4b', '#172554', '#090d1e'],
    sunColor: '#e9d5ff',
    rareBonusPct: 25
  },
  {
    id: 'loc_4',
    index: 4,
    name: 'Коралловый Залив Красного Моря',
    shortName: 'Коралловый Залив',
    icon: '🪸',
    minRodLevel: 4,
    description: 'Лазурные морские рифы, богатые крупными хищниками и кристальной рыбой. Требуется удочка Ур. 4+. Коллекция #31–#40.',
    skyColors: ['#081c24', '#0c4a6e', '#ec4899'],
    waterColors: ['#0284c7', '#0369a1', '#1d4ed8', '#0f172a'],
    sunColor: '#fbcfe8',
    rareBonusPct: 40
  },
  {
    id: 'loc_5',
    index: 5,
    name: 'Золотые Воды Дуата и Чертог Ра',
    shortName: 'Чертог Ра',
    icon: '☀️',
    minRodLevel: 5,
    description: 'Божественное озеро фараонов, где обитают Легендарные и Мифические рыбы богов. Требуется удочка Ур. 5. Коллекция #41–#50.',
    skyColors: ['#1a0802', '#78350f', '#fbbf24'],
    waterColors: ['#b45309', '#92400e', '#451a03', '#1c0a00'],
    sunColor: '#fef08a',
    rareBonusPct: 65
  }
];

export const FISHING_BAITS: FishingBaitTemplate[] = [
  {
    id: 'bait_worm',
    name: 'Речной червь Нила',
    icon: '🪱',
    packSize: 5,
    priceGold: 60,
    priceCrystals: 0,
    currency: 'gold',
    rareChanceBonusPct: 20,
    weightBonusPct: 5,
    tensionControlBonusPct: 12,
    description: 'Классическая наживка: +20% к шансу редкой рыбы и +12% к удержанию рыбы на крючке.'
  },
  {
    id: 'bait_locust',
    name: 'Золотой кузнечик Оазиса',
    icon: '🦗',
    packSize: 5,
    priceGold: 180,
    priceCrystals: 0,
    currency: 'gold',
    rareChanceBonusPct: 45,
    weightBonusPct: 15,
    tensionControlBonusPct: 18,
    description: 'Любимое лакомство крупных рыб: +45% к шансу редкой рыбы и +15% к весу улова.'
  },
  {
    id: 'bait_shrimp',
    name: 'Королевская креветка Порта',
    icon: '🦐',
    packSize: 5,
    priceGold: 450,
    priceCrystals: 0,
    currency: 'gold',
    rareChanceBonusPct: 80,
    weightBonusPct: 25,
    tensionControlBonusPct: 25,
    minRarityFilter: 'uncommon',
    description: 'Отсекает самую мелкую рыбу! +80% к шансу редких/кристальных рыб и +25% к весу.'
  },
  {
    id: 'bait_scarab',
    name: 'Священный Жук-Скарабей',
    icon: '🪲',
    packSize: 5,
    priceGold: 0,
    priceCrystals: 3,
    currency: 'crystals',
    rareChanceBonusPct: 150,
    weightBonusPct: 35,
    tensionControlBonusPct: 30,
    minRarityFilter: 'uncommon',
    chestBonusPct: 5,
    description: 'Магическая наживка жрецов: +150% к шансу редких, эпических и легендарных рыб, +5% к сундукам.'
  },
  {
    id: 'bait_ra_larva',
    name: 'Солнечная Приманка Ра',
    icon: '✨',
    packSize: 5,
    priceGold: 0,
    priceCrystals: 7,
    currency: 'crystals',
    rareChanceBonusPct: 260,
    weightBonusPct: 50,
    tensionControlBonusPct: 40,
    minRarityFilter: 'rare',
    chestBonusPct: 8,
    description: 'Клюёт ТОЛЬКО Редкая, Эпическая, Легендарная и Мифическая рыба! +260% к шансу трофеев и +40% к контролю лески!'
  },
  {
    id: 'bait_lotus_pollen',
    name: 'Пыльца священного лотоса',
    icon: '🪷',
    packSize: 5,
    priceGold: 850,
    priceCrystals: 0,
    currency: 'gold',
    rareChanceBonusPct: 110,
    weightBonusPct: 30,
    tensionControlBonusPct: 25,
    minRarityFilter: 'uncommon',
    chestBonusPct: 4,
    description: 'Ароматная прикормка жрецов Нила: привлекает крупную и редкую рыбу (+110% к шансу редких видов, +30% к весу).'
  },
  {
    id: 'bait_crocodile_scale',
    name: 'Чешуя священного крокодила',
    icon: '🐊',
    packSize: 5,
    priceGold: 0,
    priceCrystals: 5,
    currency: 'crystals',
    rareChanceBonusPct: 200,
    weightBonusPct: 45,
    tensionControlBonusPct: 35,
    minRarityFilter: 'rare',
    chestBonusPct: 7,
    description: 'Сверхмощная прикормка Себека: отсекает всю обычную рыбу, привлекая хищников и эпических гигантов (+200% к шансу редких/эпических/мифических рыб).'
  }
];

export const FISHING_LINES: FishingLineTemplate[] = [
  {
    id: 'line_flax',
    name: 'Льняная нильская леска',
    icon: '🧵',
    durability: 30,
    maxDurability: 30,
    stabilityBonusPct: 15,
    priceGold: 220,
    priceCrystals: 0,
    currency: 'gold',
    description: 'Плетёная леска из речного льна: +15% к контролю рывков и защите от обрыва на 30 забросов.'
  },
  {
    id: 'line_silk',
    name: 'Кручёная шёлковая леска',
    icon: '🪡',
    durability: 60,
    maxDurability: 60,
    stabilityBonusPct: 30,
    priceGold: 650,
    priceCrystals: 0,
    currency: 'gold',
    description: 'Особо прочная шёлковая нить оазиса: +30% к стабильности вываживания на 60 забросов.'
  },
  {
    id: 'line_sapphire',
    name: 'Сапфировая нить Исиды',
    icon: '💠',
    durability: 120,
    maxDurability: 120,
    stabilityBonusPct: 55,
    priceGold: 0,
    priceCrystals: 5,
    currency: 'crystals',
    description: 'Божественная нить жрецов: почти не рвётся (+55% к удержанию лески) на 120 забросов!'
  }
];

export const FISHING_HOOKS: FishingHookTemplate[] = [
  {
    id: 'hook_bronze',
    name: 'Бронзовый крючок Луксора',
    icon: '🪝',
    durability: 30,
    maxDurability: 30,
    rareFishChanceBonusPct: 20,
    chestChanceBonusPct: 6,
    priceGold: 260,
    priceCrystals: 0,
    currency: 'gold',
    description: 'Кованый речной крючок: +20% к шансу редкой рыбы и +6% к шансу Затонувшего сундука на 30 забросов.'
  },
  {
    id: 'hook_gilded',
    name: 'Позолоченный крючок Фараона',
    icon: '✨',
    durability: 60,
    maxDurability: 60,
    rareFishChanceBonusPct: 45,
    chestChanceBonusPct: 14,
    priceGold: 850,
    priceCrystals: 0,
    currency: 'gold',
    description: 'Царская золотая оснастка: +45% к редкой рыбе и +14% к сундукам с реликвиями на 60 забросов.'
  },
  {
    id: 'hook_eye_horus',
    name: 'Оберег «Глаз Гора»',
    icon: '𓂀',
    durability: 120,
    maxDurability: 120,
    rareFishChanceBonusPct: 80,
    chestChanceBonusPct: 28,
    priceGold: 0,
    priceCrystals: 6,
    currency: 'crystals',
    description: 'Священный амулет глубин: приманивает трофеи (+80% к редким видам, +28% к сундукам) на 120 забросов!'
  }
];

export const FISHING_NETS: FishingNetTemplate[] = [
  {
    id: 'net_reed',
    name: 'Камышовая сеть Нила',
    icon: '🕸️',
    minRodLevel: 1,
    priceGold: 250,
    priceCrystals: 0,
    currency: 'gold',
    catchDurationSec: 120, // 2 минуты
    spoilAfterReadySec: 300, // 5 минут до гибели рыбы
    minFishCount: 3,
    maxFishCount: 4,
    rareBonusPct: 15,
    description: 'Ловит 3–4 рыбы за 2 мин. Если не вытянуть в течение 5 мин после наполнения — рыба погибнет!'
  },
  {
    id: 'net_silk',
    name: 'Шелковая сеть Себека',
    icon: '🥅',
    minRodLevel: 2,
    priceGold: 650,
    priceCrystals: 0,
    currency: 'gold',
    catchDurationSec: 180, // 3 минуты
    spoilAfterReadySec: 480, // 8 минут до гибели рыбы
    minFishCount: 4,
    maxFishCount: 6,
    rareBonusPct: 50,
    description: 'Крепкая сеть из оазисного шелка: ловит 4–6 рыб (+50% к редким видам) за 3 мин. Срок свежести: 8 мин.'
  },
  {
    id: 'net_royal',
    name: 'Золотой невод Фараона',
    icon: '👑',
    minRodLevel: 3,
    priceGold: 0,
    priceCrystals: 4,
    currency: 'crystals',
    catchDurationSec: 240, // 4 минуты
    spoilAfterReadySec: 900, // 15 минут до гибели рыбы
    minFishCount: 6,
    maxFishCount: 9,
    rareBonusPct: 120,
    description: 'Царский невод: ловит 6–9 крупных и кристальных рыб (+120% к редким и мифическим) за 4 мин. Срок свежести: 15 мин.'
  }
];

export const FISHING_NET_LICENSES: FishingNetLicensePackage[] = [
  {
    id: 'lic_net_1',
    name: 'Лицензия на сеть (1 заброс)',
    icon: '📜',
    usesCount: 1,
    priceGold: 200,
    priceCrystals: 0,
    currency: 'gold',
    description: 'Официальное разрешение стражи Порта на 1 заброс рыболовной сети в воды Нила.'
  },
  {
    id: 'lic_net_5',
    name: 'Пакет лицензий (5 забросов сети)',
    icon: '📑',
    usesCount: 5,
    priceGold: 850,
    priceCrystals: 0,
    currency: 'gold',
    description: 'Выгодный набор разрешений на 5 забросов рыболовной сети (скидка 15%).'
  },
  {
    id: 'lic_net_12',
    name: 'Золотая Лицензия Ловца (12 забросов)',
    icon: '👑',
    usesCount: 12,
    priceGold: 0,
    priceCrystals: 4,
    currency: 'crystals',
    description: 'Княжеская грамота Фараона на 12 забросов любых рыболовных сетей.'
  }
];

// In-memory static cache for the 50 generated SVG fish artworks
const fishSvgCache = new Map<number, string>();

interface FishPalette {
  bodyStart: string;
  bodyEnd: string;
  belly: string;
  fin: string;
  accent: string;
  eye: string;
  glow?: string;
}

const RARITY_PALETTES: Record<FishRarity, FishPalette[]> = {
  common: [
    { bodyStart: '#64748b', bodyEnd: '#334155', belly: '#cbd5e1', fin: '#94a3b8', accent: '#475569', eye: '#f8fafc' },
    { bodyStart: '#4d7c0f', bodyEnd: '#365314', belly: '#d9f99d', fin: '#84cc16', accent: '#65a30d', eye: '#fef08a' },
    { bodyStart: '#0369a1', bodyEnd: '#0c4a6e', belly: '#bae6fd', fin: '#38bdf8', accent: '#0284c7', eye: '#ffffff' },
    { bodyStart: '#a16207', bodyEnd: '#713f12', belly: '#fef08a', fin: '#eab308', accent: '#ca8a04', eye: '#ffffff' }
  ],
  uncommon: [
    { bodyStart: '#0d9488', bodyEnd: '#115e59', belly: '#99f6e4', fin: '#2dd4bf', accent: '#14b8a6', eye: '#fef9c3' },
    { bodyStart: '#0284c7', bodyEnd: '#1e3a8a', belly: '#7dd3fc', fin: '#38bdf8', accent: '#60a5fa', eye: '#ffffff' },
    { bodyStart: '#16a34a', bodyEnd: '#14532d', belly: '#bbf7d0', fin: '#4ade80', accent: '#22c55e', eye: '#fef08a' }
  ],
  rare: [
    { bodyStart: '#2563eb', bodyEnd: '#1e1b4b', belly: '#93c5fd', fin: '#60a5fa', accent: '#38bdf8', eye: '#fde047', glow: '#3b82f6' },
    { bodyStart: '#0891b2', bodyEnd: '#164e63', belly: '#a5f3fc', fin: '#22d3ee', accent: '#67e8f9', eye: '#fef08a', glow: '#06b6d4' },
    { bodyStart: '#7c3aed', bodyEnd: '#3b0764', belly: '#ddd6fe', fin: '#a78bfa', accent: '#c084fc', eye: '#fef08a', glow: '#8b5cf6' }
  ],
  epic: [
    { bodyStart: '#9333ea', bodyEnd: '#4c1d95', belly: '#f5d0fe', fin: '#e879f9', accent: '#f472b6', eye: '#fde047', glow: '#d946ef' },
    { bodyStart: '#db2777', bodyEnd: '#831843', belly: '#fbcfe8', fin: '#f43f5e', accent: '#fb7185', eye: '#fef08a', glow: '#ec4899' },
    { bodyStart: '#4f46e5', bodyEnd: '#312e81', belly: '#c7d2fe', fin: '#818cf8', accent: '#38bdf8', eye: '#fde047', glow: '#6366f1' }
  ],
  legendary: [
    { bodyStart: '#f59e0b', bodyEnd: '#92400e', belly: '#fef3c7', fin: '#fbbf24', accent: '#fde047', eye: '#22d3ee', glow: '#f59e0b' },
    { bodyStart: '#ea580c', bodyEnd: '#7c2d12', belly: '#ffedd5', fin: '#fb923c', accent: '#facc15', eye: '#38bdf8', glow: '#f97316' }
  ],
  mythic: [
    { bodyStart: '#fbbf24', bodyEnd: '#b45309', belly: '#ffffff', fin: '#22d3ee', accent: '#f43f5e', eye: '#ec4899', glow: '#fde047' },
    { bodyStart: '#06b6d4', bodyEnd: '#3b0764', belly: '#cffafe', fin: '#facc15', accent: '#f43f5e', eye: '#fde047', glow: '#22d3ee' }
  ]
};

export function getFishSvgDataUri(index: number, rarity: FishRarity = 'common'): string {
  const safeIdx = Math.max(1, Math.min(50, Math.round(index)));
  if (fishSvgCache.has(safeIdx)) {
    return fishSvgCache.get(safeIdx)!;
  }

  const palettes = RARITY_PALETTES[rarity] || RARITY_PALETTES.common;
  const pal = palettes[(safeIdx - 1) % palettes.length];
  const shapeVariant = (safeIdx - 1) % 5;
  const patternVariant = (safeIdx - 1) % 4;
  const hasCrown = rarity === 'legendary' || rarity === 'mythic' || safeIdx % 10 === 0;
  const hasBarbels = safeIdx % 6 === 0 || safeIdx % 7 === 0;

  let bodyPath = 'M 22 48 C 36 22, 76 22, 98 48 C 76 74, 36 74, 22 48 Z';
  let tailPath = 'M 94 48 L 118 26 L 112 48 L 118 70 Z';
  let dorsalPath = 'M 46 28 Q 62 10 78 30 Z';
  let ventralPath = 'M 52 66 Q 64 82 76 64 Z';

  if (shapeVariant === 1) {
    bodyPath = 'M 14 48 C 32 32, 78 32, 100 48 C 78 64, 32 64, 14 48 Z';
    tailPath = 'M 96 48 L 120 30 L 111 48 L 120 66 Z';
    dorsalPath = 'M 58 34 L 74 16 L 82 36 Z';
  } else if (shapeVariant === 2) {
    bodyPath = 'M 24 48 C 38 12, 78 12, 94 48 C 78 84, 38 84, 24 48 Z';
    tailPath = 'M 90 48 L 115 24 Q 108 48 115 72 Z';
    dorsalPath = 'M 38 22 Q 64 4 84 28 Z';
    ventralPath = 'M 42 74 Q 64 90 82 70 Z';
  } else if (shapeVariant === 3) {
    bodyPath = 'M 20 48 C 34 26, 74 24, 96 48 C 74 72, 34 70, 20 48 Z';
    tailPath = 'M 92 48 L 122 20 L 110 48 L 122 76 Z';
    dorsalPath = 'M 40 28 L 48 8 L 56 24 L 66 10 L 72 26 L 82 16 L 84 32 Z';
  } else if (shapeVariant === 4) {
    bodyPath = 'M 16 50 C 28 24, 76 26, 98 48 C 78 68, 32 68, 16 50 Z';
    tailPath = 'M 95 48 L 120 22 L 109 46 L 116 68 Z';
    dorsalPath = 'M 44 29 L 54 15 L 64 27 L 74 17 L 84 31 Z';
  }

  const stripesMarkup =
    patternVariant === 0
      ? `<path d="M 48 29 Q 52 48 48 67 M 62 28 Q 66 48 62 68 M 76 31 Q 80 48 76 65" stroke="${pal.accent}" stroke-width="2.5" fill="none" opacity="0.65" stroke-linecap="round"/>`
      : patternVariant === 1
      ? `<circle cx="52" cy="42" r="3.2" fill="${pal.accent}" opacity="0.75"/><circle cx="65" cy="39" r="3.8" fill="${pal.accent}" opacity="0.75"/><circle cx="77" cy="44" r="3" fill="${pal.accent}" opacity="0.75"/><circle cx="59" cy="53" r="3.2" fill="${pal.belly}" opacity="0.65"/>`
      : patternVariant === 2
      ? `<path d="M 38 48 Q 58 38 86 48 Q 58 58 38 48" stroke="${pal.belly}" stroke-width="2" fill="none" opacity="0.6"/>`
      : `<path d="M 45 36 Q 52 42 45 48 M 58 35 Q 65 42 58 49 M 71 37 Q 78 43 71 49 M 52 48 Q 59 54 52 60 M 65 48 Q 72 54 65 60" stroke="${pal.belly}" stroke-width="1.8" fill="none" opacity="0.55" stroke-linecap="round"/>`;

  const crownMarkup = hasCrown
    ? `<polygon points="34,26 30,13 40,20 46,10 52,20 60,13 56,26" fill="#facc15" stroke="#854d0e" stroke-width="1.2"/>`
    : '';

  const barbelsMarkup = hasBarbels
    ? `<path d="M 22 50 Q 10 56 6 66 M 25 53 Q 16 62 14 70" stroke="${pal.fin}" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : '';

  const glowFilter = pal.glow
    ? `<circle cx="64" cy="48" r="44" fill="${pal.glow}" opacity="0.18"/>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 96">
    <defs>
      <linearGradient id="bg_${safeIdx}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${pal.bodyStart}"/>
        <stop offset="65%" stop-color="${pal.bodyEnd}"/>
        <stop offset="100%" stop-color="${pal.belly}"/>
      </linearGradient>
      <linearGradient id="fin_${safeIdx}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${pal.fin}"/>
        <stop offset="100%" stop-color="${pal.bodyEnd}"/>
      </linearGradient>
    </defs>
    ${glowFilter}
    <path d="${dorsalPath}" fill="url(#fin_${safeIdx})" stroke="${pal.bodyEnd}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="${ventralPath}" fill="url(#fin_${safeIdx})" stroke="${pal.bodyEnd}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="${tailPath}" fill="url(#fin_${safeIdx})" stroke="${pal.bodyEnd}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="${bodyPath}" fill="url(#bg_${safeIdx})" stroke="${pal.bodyEnd}" stroke-width="2"/>
    <path d="M 28 42 C 44 26, 72 26, 88 40" stroke="#ffffff" stroke-width="2.2" fill="none" opacity="0.38" stroke-linecap="round"/>
    ${stripesMarkup}
    <path d="M 42 52 L 56 46 L 52 60 Z" fill="${pal.fin}" opacity="0.88" stroke="${pal.bodyEnd}" stroke-width="1.2"/>
    ${barbelsMarkup}
    ${crownMarkup}
    <circle cx="34" cy="44" r="5.2" fill="${pal.eye}" stroke="#0f172a" stroke-width="1.4"/>
    <circle cx="33" cy="44" r="2.6" fill="#0f172a"/>
    <circle cx="31.8" cy="42.5" r="1.1" fill="#ffffff"/>
  </svg>`;

  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
  fishSvgCache.set(safeIdx, uri);
  return uri;
}

export const DEFAULT_FISHING_RODS: FishingRodTemplate[] = [
  {
    id: 'rod_1',
    level: 1,
    name: 'Тростниковая удочка Нила',
    icon: '🎣',
    requiredFishCaught: 0,
    priceGold: 0,
    priceCrystals: 0,
    currency: 'free',
    rareFishChanceBonusPct: 0,
    chestChanceBonusPct: 0,
    weightMultiplier: 1.0,
    lineStrength: 100,
    description: 'Базовая удочка из гибкого нильского тростника. Открывает «Прибрежные Камыши Луксора».'
  },
  {
    id: 'rod_2',
    level: 2,
    name: 'Бамбуковая удочка Оазиса',
    icon: '🎋',
    requiredFishCaught: 25,
    priceGold: 2500,
    priceCrystals: 0,
    currency: 'gold',
    rareFishChanceBonusPct: 15,
    chestChanceBonusPct: 2,
    weightMultiplier: 1.15,
    lineStrength: 145,
    description: 'Укрепленное удилище с шелковой леской. Открывает локацию «Священный Оазис Фаюм»!'
  },
  {
    id: 'rod_3',
    level: 3,
    name: 'Спиннинг Стража Себека',
    icon: '🔱',
    requiredFishCaught: 55,
    priceGold: 6500,
    priceCrystals: 0,
    currency: 'gold',
    rareFishChanceBonusPct: 30,
    chestChanceBonusPct: 4,
    weightMultiplier: 1.35,
    lineStrength: 200,
    description: 'Кованые кольца и прочная катушка. Открывает локацию «Затопленные Катакомбы Себека»!'
  },
  {
    id: 'rod_4',
    level: 4,
    name: 'Золотое удилище Верховного Жреца',
    icon: '✨',
    requiredFishCaught: 85,
    priceGold: 15000,
    priceCrystals: 35,
    currency: 'both',
    rareFishChanceBonusPct: 55,
    chestChanceBonusPct: 7,
    weightMultiplier: 1.6,
    lineStrength: 270,
    description: 'Зачарованное золотом удилище. Открывает локацию «Коралловый Залив Красного Моря»!'
  },
  {
    id: 'rod_5',
    level: 5,
    name: 'Божественный Гарпун Фараона',
    icon: '👑',
    requiredFishCaught: 110,
    priceGold: 0,
    priceCrystals: 120,
    currency: 'crystals',
    rareFishChanceBonusPct: 90,
    chestChanceBonusPct: 12,
    weightMultiplier: 1.95,
    lineStrength: 360,
    description: 'Топовая реликвия рыболова! Открывает «Золотые Воды Дуата и Чертог Ра» и держит рывки мифических левиафанов!'
  }
];

// 50 Species organized cleanly into 5 Location Collections (10 species per location, from Common to Rare/Epic/Legendary/Mythic!)
const FISH_RAW_CATALOG: Array<{
  locationId: FishingLocationId;
  name: string;
  rarity: FishRarity;
  rewardType: 'gold' | 'crystals' | 'both';
  baseGold: number;
  baseCrystals: number;
  baseExp: number;
  minW: number;
  maxW: number;
  weight: number;
  minRod: number;
  struggle: number;
  desc: string;
}> = [
  // ================= ЛОКАЦИЯ 1: ПРИБРЕЖНЫЕ КАМЫШИ ЛУКСОРА (#1..#10, Удочка 1+) =================
  { locationId: 'loc_1', name: 'Нильский пескарь', rarity: 'common', rewardType: 'gold', baseGold: 14, baseCrystals: 0, baseExp: 6, minW: 0.2, maxW: 0.9, weight: 100, minRod: 1, struggle: 2, desc: 'Юркая прибрежная рыбка, обитающая у камышей Луксора.' },
  { locationId: 'loc_1', name: 'Камышовая плотва', rarity: 'common', rewardType: 'gold', baseGold: 16, baseCrystals: 0, baseExp: 7, minW: 0.3, maxW: 1.2, weight: 92, minRod: 1, struggle: 2, desc: 'Частый гость на крючке начинающего рыболова.' },
  { locationId: 'loc_1', name: 'Песчаный бычок', rarity: 'common', rewardType: 'gold', baseGold: 18, baseCrystals: 0, baseExp: 8, minW: 0.2, maxW: 1.1, weight: 88, minRod: 1, struggle: 3, desc: 'Прячется среди затопленных камней древней набережной.' },
  { locationId: 'loc_1', name: 'Серебристая уклейка', rarity: 'common', rewardType: 'gold', baseGold: 20, baseCrystals: 0, baseExp: 9, minW: 0.2, maxW: 0.9, weight: 84, minRod: 1, struggle: 2, desc: 'Её чешуя сверкает на солнце, словно мелкие монеты.' },
  { locationId: 'loc_1', name: 'Краснопёрка Дельты', rarity: 'uncommon', rewardType: 'gold', baseGold: 28, baseCrystals: 0, baseExp: 12, minW: 0.5, maxW: 2.0, weight: 65, minRod: 1, struggle: 4, desc: 'Отличается ярко-алыми плавниками и бойким сопротивлением на леске.' },
  { locationId: 'loc_1', name: 'Речной окунь Фив', rarity: 'uncommon', rewardType: 'gold', baseGold: 34, baseCrystals: 0, baseExp: 14, minW: 0.7, maxW: 2.8, weight: 58, minRod: 1, struggle: 4, desc: 'Полосатый хищник, резко дёргающий леску при подсечке.' },
  { locationId: 'loc_1', name: 'Папирусный лещ', rarity: 'uncommon', rewardType: 'gold', baseGold: 42, baseCrystals: 0, baseExp: 16, minW: 1.1, maxW: 4.4, weight: 50, minRod: 1, struggle: 5, desc: 'Широкотелая рыба, кормящаяся у корней папируса.' },
  { locationId: 'loc_1', name: 'Зеркальный карп Мемфиса', rarity: 'rare', rewardType: 'gold', baseGold: 75, baseCrystals: 0, baseExp: 28, minW: 2.0, maxW: 7.5, weight: 26, minRod: 1, struggle: 6, desc: 'Редкий упитанный карп, чья крупная чешуя отражает свет факелов.' },
  { locationId: 'loc_1', name: 'Храмовый сом Луксора', rarity: 'rare', rewardType: 'crystals', baseGold: 95, baseCrystals: 1, baseExp: 40, minW: 3.2, maxW: 11.5, weight: 15, minRod: 1, struggle: 7, desc: 'Редкий усатый страж прибрежных омутов, проглотивший древний кристалл.' },
  { locationId: 'loc_1', name: 'Царский жерех Карнака', rarity: 'epic', rewardType: 'crystals', baseGold: 160, baseCrystals: 2, baseExp: 65, minW: 4.5, maxW: 15.0, weight: 7, minRod: 1, struggle: 8, desc: 'Главный трофей Камышей Луксора! Мощными ударами хвоста проверяет леску на прочность.' },

  // ================= ЛОКАЦИЯ 2: СВЯЩЕННЫЙ ОАЗИС ФАЮМ (#11..#20, Удочка 2+) =================
  { locationId: 'loc_2', name: 'Болотный карась Оазиса', rarity: 'common', rewardType: 'gold', baseGold: 26, baseCrystals: 0, baseExp: 11, minW: 0.6, maxW: 2.4, weight: 90, minRod: 2, struggle: 3, desc: 'Золотистый карась из тёплых родниковых вод Фаюма.' },
  { locationId: 'loc_2', name: 'Нильская тиляпия', rarity: 'common', rewardType: 'gold', baseGold: 30, baseCrystals: 0, baseExp: 13, minW: 0.9, maxW: 3.6, weight: 85, minRod: 2, struggle: 3, desc: 'Традиционная рыба древнеегипетских пиров.' },
  { locationId: 'loc_2', name: 'Оливковый линь Пальм', rarity: 'common', rewardType: 'gold', baseGold: 36, baseCrystals: 0, baseExp: 15, minW: 1.3, maxW: 5.0, weight: 78, minRod: 2, struggle: 4, desc: 'Толстокожая рыба с бронзово-изумрудным отливом.' },
  { locationId: 'loc_2', name: 'Пятнистый голавль Оазиса', rarity: 'uncommon', rewardType: 'gold', baseGold: 52, baseCrystals: 0, baseExp: 20, minW: 1.5, maxW: 5.8, weight: 60, minRod: 2, struggle: 5, desc: 'Охотится на упавших в воду кузнечиков и жуков.' },
  { locationId: 'loc_2', name: 'Щука Священного Озера', rarity: 'uncommon', rewardType: 'gold', baseGold: 64, baseCrystals: 0, baseExp: 24, minW: 2.2, maxW: 9.0, weight: 52, minRod: 2, struggle: 6, desc: 'Стремительно атакует приманку из зарослей водных лилий.' },
  { locationId: 'loc_2', name: 'Золотистый сазан Ра', rarity: 'uncommon', rewardType: 'gold', baseGold: 78, baseCrystals: 0, baseExp: 28, minW: 2.8, maxW: 10.5, weight: 45, minRod: 2, struggle: 6, desc: 'Ценится купцами за благородный золотой блеск чешуи.' },
  { locationId: 'loc_2', name: 'Рыба-слон (Мормир)', rarity: 'rare', rewardType: 'gold', baseGold: 115, baseCrystals: 0, baseExp: 42, minW: 2.4, maxW: 8.5, weight: 26, minRod: 2, struggle: 6, desc: 'Священная рыба Осириса с необычным удлинённым рылом.' },
  { locationId: 'loc_2', name: 'Кристальный барбус Фаюма', rarity: 'rare', rewardType: 'crystals', baseGold: 125, baseCrystals: 1, baseExp: 52, minW: 1.8, maxW: 6.2, weight: 18, minRod: 2, struggle: 7, desc: 'Полупрозрачное тело рыбы наполнено кристальной пылью оазиса.' },
  { locationId: 'loc_2', name: 'Лунная рыба Исиды', rarity: 'epic', rewardType: 'crystals', baseGold: 195, baseCrystals: 2, baseExp: 78, minW: 3.5, maxW: 12.0, weight: 10, minRod: 2, struggle: 8, desc: 'Светится мягким лунным сиянием и приносит чистые кристаллы.' },
  { locationId: 'loc_2', name: 'Изумрудный Владыка Оазиса', rarity: 'legendary', rewardType: 'crystals', baseGold: 310, baseCrystals: 4, baseExp: 120, minW: 6.5, maxW: 22.0, weight: 4.5, minRod: 2, struggle: 9, desc: 'Легендарный хранитель вод Фаюма! Поймать его без хорошей наживки — великое искусство.' },

  // ================= ЛОКАЦИЯ 3: ЗАТОПЛЕННЫЕ КАТАКОМБЫ СЕБЕКА (#21..#30, Удочка 3+) =================
  { locationId: 'loc_3', name: 'Полосатый ёрш Подземелий', rarity: 'common', rewardType: 'gold', baseGold: 42, baseCrystals: 0, baseExp: 18, minW: 0.6, maxW: 2.2, weight: 86, minRod: 3, struggle: 4, desc: 'Колючий обитатель тёмных затопленных галерей.' },
  { locationId: 'loc_3', name: 'Илистый сомик Катакомб', rarity: 'common', rewardType: 'gold', baseGold: 48, baseCrystals: 0, baseExp: 20, minW: 1.5, maxW: 5.4, weight: 80, minRod: 3, struggle: 4, desc: 'Донный житель с чувствительными усами, ориентирующийся в темноте.' },
  { locationId: 'loc_3', name: 'Угорь Катакомб', rarity: 'uncommon', rewardType: 'gold', baseGold: 72, baseCrystals: 0, baseExp: 28, minW: 1.8, maxW: 7.5, weight: 60, minRod: 3, struggle: 5, desc: 'Выплывает из расщелин между древними колоннами.' },
  { locationId: 'loc_3', name: 'Нильский многопёр', rarity: 'uncommon', rewardType: 'gold', baseGold: 88, baseCrystals: 0, baseExp: 32, minW: 2.5, maxW: 9.2, weight: 52, minRod: 3, struggle: 6, desc: 'Древняя рыба с гребнем спинных плавников, словно у дракона.' },
  { locationId: 'loc_3', name: 'Глубинный налим Абидоса', rarity: 'uncommon', rewardType: 'gold', baseGold: 108, baseCrystals: 0, baseExp: 38, minW: 3.2, maxW: 11.8, weight: 45, minRod: 3, struggle: 6, desc: 'Холоднокровный обитатель самых глубоких шахт храма.' },
  { locationId: 'loc_3', name: 'Панцирная щука Сета', rarity: 'rare', rewardType: 'gold', baseGold: 155, baseCrystals: 0, baseExp: 52, minW: 4.0, maxW: 14.5, weight: 28, minRod: 3, struggle: 7, desc: 'Её чешуя крепка, словно каменная кладка пирамид.' },
  { locationId: 'loc_3', name: 'Электрический сом Грома', rarity: 'rare', rewardType: 'crystals', baseGold: 175, baseCrystals: 2, baseExp: 65, minW: 4.8, maxW: 18.5, weight: 20, minRod: 3, struggle: 8, desc: 'Разряды тока пробегают по леске при его вытягивании!' },
  { locationId: 'loc_3', name: 'Рубиновый карп Хатхор', rarity: 'rare', rewardType: 'gold', baseGold: 225, baseCrystals: 0, baseExp: 76, minW: 4.5, maxW: 16.0, weight: 16, minRod: 3, struggle: 7, desc: 'Священный карп подземных купелей с рубиновой чешуёй.' },
  { locationId: 'loc_3', name: 'Призрачный лосось Дуата', rarity: 'epic', rewardType: 'crystals', baseGold: 265, baseCrystals: 3, baseExp: 115, minW: 6.0, maxW: 21.0, weight: 9, minRod: 3, struggle: 8, desc: 'Рыба из подземных вод, мерцающая фиолетовым пламенем.' },
  { locationId: 'loc_3', name: 'Чешуйчатый Страж Себека', rarity: 'legendary', rewardType: 'crystals', baseGold: 460, baseCrystals: 6, baseExp: 185, minW: 12.0, maxW: 45.0, weight: 4, minRod: 3, struggle: 9, desc: 'Легендарный хозяин Затопленных Катакомб, благословленный богом Себеком!' },

  // ================= ЛОКАЦИЯ 4: КОРАЛЛОВЫЙ ЗАЛИВ КРАСНОГО МОРЯ (#31..#40, Удочка 4+) =================
  { locationId: 'loc_4', name: 'Морская кефаль Порта', rarity: 'common', rewardType: 'gold', baseGold: 60, baseCrystals: 0, baseExp: 24, minW: 1.4, maxW: 5.2, weight: 82, minRod: 4, struggle: 4, desc: 'Быстрая стайная рыба, гуляющая вдоль коралловых гряд.' },
  { locationId: 'loc_4', name: 'Крылатка Красного Моря', rarity: 'uncommon', rewardType: 'gold', baseGold: 85, baseCrystals: 0, baseExp: 32, minW: 1.5, maxW: 5.5, weight: 64, minRod: 4, struggle: 5, desc: 'Роскошные веерные плавники таят острые шипы.' },
  { locationId: 'loc_4', name: 'Тигровая рыба Рифа', rarity: 'uncommon', rewardType: 'gold', baseGold: 110, baseCrystals: 0, baseExp: 40, minW: 3.0, maxW: 11.5, weight: 52, minRod: 4, struggle: 6, desc: 'Мощный морской хищник с полосами как у тигра.' },
  { locationId: 'loc_4', name: 'Гигантский морской окунь', rarity: 'uncommon', rewardType: 'gold', baseGold: 145, baseCrystals: 0, baseExp: 48, minW: 5.0, maxW: 22.0, weight: 42, minRod: 4, struggle: 7, desc: 'Настоящий тяжеловоз, способный согнуть удилище в дугу.' },
  { locationId: 'loc_4', name: 'Лазурный парусник Порта', rarity: 'rare', rewardType: 'gold', baseGold: 210, baseCrystals: 0, baseExp: 70, minW: 6.5, maxW: 25.0, weight: 26, minRod: 4, struggle: 7, desc: 'Его высокий спинной плавник напоминает парус царской ладьи.' },
  { locationId: 'loc_4', name: 'Сапфировая барракуда', rarity: 'rare', rewardType: 'crystals', baseGold: 165, baseCrystals: 2, baseExp: 85, minW: 5.5, maxW: 20.0, weight: 19, minRod: 4, struggle: 8, desc: 'Молниеносная хищница с сапфировыми глазами.' },
  { locationId: 'loc_4', name: 'Звёздный скат Нут', rarity: 'rare', rewardType: 'crystals', baseGold: 190, baseCrystals: 2, baseExp: 96, minW: 7.0, maxW: 26.0, weight: 16, minRod: 4, struggle: 8, desc: 'На его тёмной спине рассыпаны узоры ночных созвездий.' },
  { locationId: 'loc_4', name: 'Аметистовая мурена Маяка', rarity: 'epic', rewardType: 'crystals', baseGold: 280, baseCrystals: 3, baseExp: 135, minW: 5.5, maxW: 19.0, weight: 10, minRod: 4, struggle: 8, desc: 'Скрывается в затонувших руинах Александрийского маяка.' },
  { locationId: 'loc_4', name: 'Обсидиановый меченосец Гора', rarity: 'epic', rewardType: 'crystals', baseGold: 340, baseCrystals: 4, baseExp: 170, minW: 9.0, maxW: 32.0, weight: 7, minRod: 4, struggle: 9, desc: 'Рассекает волны острым клинком, инкрустированным кристаллами.' },
  { locationId: 'loc_4', name: 'Королевский Кои Клеопатры', rarity: 'legendary', rewardType: 'crystals', baseGold: 520, baseCrystals: 7, baseExp: 240, minW: 8.0, maxW: 28.0, weight: 3.5, minRod: 4, struggle: 9, desc: 'Любимая жемчужно-алая рыба из морского дворца царицы Клеопатры!' },

  // ================= ЛОКАЦИЯ 5: ЗОЛОТЫЕ ВОДЫ ДУАТА И ЧЕРТОГ РА (#41..#50, Удочка 5) =================
  { locationId: 'loc_5', name: 'Серебряный судак Вечности', rarity: 'uncommon', rewardType: 'gold', baseGold: 130, baseCrystals: 0, baseExp: 45, minW: 2.5, maxW: 9.5, weight: 65, minRod: 5, struggle: 6, desc: 'Клыкастый охотник звёздных вод Чертога Ра.' },
  { locationId: 'loc_5', name: 'Бронзовый осётр Фараона', rarity: 'rare', rewardType: 'gold', baseGold: 270, baseCrystals: 0, baseExp: 92, minW: 7.5, maxW: 29.0, weight: 36, minRod: 5, struggle: 7, desc: 'Древний донный гигант с костяными щитками вдоль спины.' },
  { locationId: 'loc_5', name: 'Янтарный тунец Солнца', rarity: 'rare', rewardType: 'gold', baseGold: 320, baseCrystals: 0, baseExp: 110, minW: 8.5, maxW: 34.0, weight: 30, minRod: 5, struggle: 7, desc: 'Сильная золотистая рыба, напитанная солнечной энергией.' },
  { locationId: 'loc_5', name: 'Золотой Скарабей-Рыба', rarity: 'epic', rewardType: 'crystals', baseGold: 360, baseCrystals: 4, baseExp: 155, minW: 6.0, maxW: 20.0, weight: 18, minRod: 5, struggle: 8, desc: 'Панцирь этой редчайшей рыбы отлит из чистого золота и кристаллов.' },
  { locationId: 'loc_5', name: 'Царская Арапайма Нила', rarity: 'epic', rewardType: 'gold', baseGold: 520, baseCrystals: 0, baseExp: 180, minW: 14.0, maxW: 52.0, weight: 15, minRod: 5, struggle: 8, desc: 'Исполинская реликтовая рыба в красно-золотой броне.' },
  { locationId: 'loc_5', name: 'Древний Целокант Эпох', rarity: 'epic', rewardType: 'crystals', baseGold: 420, baseCrystals: 5, baseExp: 205, minW: 11.0, maxW: 40.0, weight: 12, minRod: 5, struggle: 9, desc: 'Живое ископаемое времён строительства первых пирамид.' },
  { locationId: 'loc_5', name: 'Солнечный Дорадо Рамзеса', rarity: 'legendary', rewardType: 'gold', baseGold: 750, baseCrystals: 0, baseExp: 260, minW: 12.0, maxW: 42.0, weight: 8, minRod: 5, struggle: 9, desc: 'Приносит своему ловцу щедрую казну чистого золота.' },
  { locationId: 'loc_5', name: 'Теневая Рыба Анубиса', rarity: 'legendary', rewardType: 'crystals', baseGold: 650, baseCrystals: 9, baseExp: 320, minW: 15.0, maxW: 54.0, weight: 5.5, minRod: 5, struggle: 9, desc: 'Появляется со дна лишь перед самыми искусными мастерами ловли.' },
  { locationId: 'loc_5', name: 'Алмазная Белуга Вечности', rarity: 'mythic', rewardType: 'crystals', baseGold: 950, baseCrystals: 14, baseExp: 440, minW: 24.0, maxW: 85.0, weight: 3.0, minRod: 5, struggle: 10, desc: 'Её спина усыпана сверкающими кристаллами древних фараонов.' },
  { locationId: 'loc_5', name: 'Мифическая Золотая Рыба Ра', rarity: 'mythic', rewardType: 'crystals', baseGold: 1600, baseCrystals: 25, baseExp: 650, minW: 32.0, maxW: 125.0, weight: 1.5, minRod: 5, struggle: 10, desc: 'Воплощение солнечного божества Ра! Вершина коллекции 50 рыб!' }
];

export const DEFAULT_FISH_SPECIES: FishSpecies[] = FISH_RAW_CATALOG.map((raw, idx) => {
  const index = idx + 1;
  return {
    id: `fish_${index}`,
    index,
    locationId: raw.locationId,
    name: raw.name,
    rarity: raw.rarity,
    rewardType: raw.rewardType,
    baseGold: raw.baseGold,
    baseCrystals: raw.baseCrystals,
    baseExp: raw.baseExp,
    minWeightKg: raw.minW,
    maxWeightKg: raw.maxW,
    catchWeight: raw.weight,
    minRodLevel: raw.minRod,
    strugglePower: raw.struggle,
    iconUrl: getFishSvgDataUri(index, raw.rarity),
    description: raw.desc,
    enabled: true
  };
});

export const DEFAULT_SUNKEN_CHEST_CONFIG: SunkenChestConfig = {
  dropChancePct: 8,
  relicWeightPct: 35,
  expBuffWeightPct: 35,
  energyWeightPct: 30,
  expBuffBonusPct: 50,
  expBuffPct: 50,
  expBuffDurationMinutes: 10,
  expBuffDurationMin: 10,
  energyRewardMin: 25,
  energyMin: 25,
  energyRewardMax: 45,
  energyMax: 45
};

export const DEFAULT_GLOBAL_FISHING_CONFIG: GlobalFishingConfig = {
  enabled: true,
  energyPerCast: 2,
  energyCostPerCast: 2,
  chestConfig: DEFAULT_SUNKEN_CHEST_CONFIG,
  sunkenChest: DEFAULT_SUNKEN_CHEST_CONFIG,
  rods: DEFAULT_FISHING_RODS,
  fishes: DEFAULT_FISH_SPECIES,
  fishSpecies: DEFAULT_FISH_SPECIES
};

let memoryFishingConfig: GlobalFishingConfig | null = null;

export function normalizeFishingConfig(raw?: Partial<GlobalFishingConfig> | null): GlobalFishingConfig {
  if (!raw || typeof raw !== 'object') {
    const defFishes = DEFAULT_FISH_SPECIES.map((f) => ({ ...f, image: f.iconUrl }));
    const defChest = { ...DEFAULT_SUNKEN_CHEST_CONFIG };
    return {
      ...DEFAULT_GLOBAL_FISHING_CONFIG,
      chestConfig: defChest,
      sunkenChest: defChest,
      rods: DEFAULT_FISHING_RODS.map((r) => ({ ...r })),
      fishes: defFishes,
      fishSpecies: defFishes
    };
  }

  const chestRaw: Partial<SunkenChestConfig> = raw.sunkenChest || raw.chestConfig || {};
  const expBuffBonusPct = Math.max(
    5,
    Math.min(500, Number(chestRaw.expBuffPct ?? chestRaw.expBuffBonusPct ?? DEFAULT_SUNKEN_CHEST_CONFIG.expBuffBonusPct))
  );
  const expBuffDurationMinutes = Math.max(
    1,
    Math.min(
      120,
      Number(chestRaw.expBuffDurationMin ?? chestRaw.expBuffDurationMinutes ?? DEFAULT_SUNKEN_CHEST_CONFIG.expBuffDurationMinutes)
    )
  );
  const energyRewardMin = Math.max(
    1,
    Number(chestRaw.energyMin ?? chestRaw.energyRewardMin ?? DEFAULT_SUNKEN_CHEST_CONFIG.energyRewardMin)
  );
  const energyRewardMax = Math.max(
    1,
    Number(chestRaw.energyMax ?? chestRaw.energyRewardMax ?? DEFAULT_SUNKEN_CHEST_CONFIG.energyRewardMax)
  );

  const chestConfig: SunkenChestConfig = {
    dropChancePct: Math.max(0, Math.min(80, Number(chestRaw.dropChancePct ?? DEFAULT_SUNKEN_CHEST_CONFIG.dropChancePct))),
    relicWeightPct: Math.max(0, Number(chestRaw.relicWeightPct ?? DEFAULT_SUNKEN_CHEST_CONFIG.relicWeightPct)),
    expBuffWeightPct: Math.max(0, Number(chestRaw.expBuffWeightPct ?? DEFAULT_SUNKEN_CHEST_CONFIG.expBuffWeightPct)),
    energyWeightPct: Math.max(0, Number(chestRaw.energyWeightPct ?? DEFAULT_SUNKEN_CHEST_CONFIG.energyWeightPct)),
    expBuffBonusPct,
    expBuffPct: expBuffBonusPct,
    expBuffDurationMinutes,
    expBuffDurationMin: expBuffDurationMinutes,
    energyRewardMin,
    energyMin: energyRewardMin,
    energyRewardMax,
    energyMax: energyRewardMax
  };

  const rawRods = Array.isArray(raw.rods) ? raw.rods : [];
  const rods: FishingRodTemplate[] = DEFAULT_FISHING_RODS.map((defRod) => {
    const found = rawRods.find((r) => r && (r.id === defRod.id || Number(r.level) === defRod.level));
    if (!found) return { ...defRod };
    return {
      ...defRod,
      ...found,
      level: defRod.level,
      requiredFishCaught: Math.max(0, Number(found.requiredFishCaught ?? defRod.requiredFishCaught)),
      priceGold: Math.max(0, Number(found.priceGold ?? defRod.priceGold)),
      priceCrystals: Math.max(0, Number(found.priceCrystals ?? defRod.priceCrystals)),
      rareFishChanceBonusPct: Math.max(0, Number(found.rareFishChanceBonusPct ?? defRod.rareFishChanceBonusPct)),
      chestChanceBonusPct: Math.max(0, Number(found.chestChanceBonusPct ?? defRod.chestChanceBonusPct)),
      weightMultiplier: Math.max(0.5, Number(found.weightMultiplier ?? defRod.weightMultiplier))
    };
  });

  const rawFishes = Array.isArray(raw.fishSpecies)
    ? raw.fishSpecies
    : Array.isArray(raw.fishes)
    ? raw.fishes
    : [];
  const fishes: FishSpecies[] = DEFAULT_FISH_SPECIES.map((defFish) => {
    const found = rawFishes.find((f) => f && (f.id === defFish.id || Number(f.index) === defFish.index));
    if (!found) return { ...defFish, image: defFish.iconUrl };
    const resolvedIcon = found.image || found.iconUrl || defFish.iconUrl;
    return {
      ...defFish,
      ...found,
      id: defFish.id,
      index: defFish.index,
      locationId: defFish.locationId,
      strugglePower: defFish.strugglePower,
      name: String(found.name || defFish.name),
      baseGold: Math.max(0, Number(found.baseGold ?? defFish.baseGold)),
      baseCrystals: Math.max(0, Number(found.baseCrystals ?? defFish.baseCrystals)),
      baseExp: Math.max(1, Number(found.baseExp ?? defFish.baseExp)),
      catchWeight: Math.max(0.1, Number(found.catchWeight ?? defFish.catchWeight)),
      minWeightKg: Math.max(0.1, Number(found.minWeightKg ?? defFish.minWeightKg)),
      maxWeightKg: Math.max(0.2, Number(found.maxWeightKg ?? defFish.maxWeightKg)),
      iconUrl: resolvedIcon,
      image: resolvedIcon,
      enabled: found.enabled !== false
    };
  });

  const resolvedEnergy = Math.max(
    0,
    Math.min(20, Number(raw.energyPerCast ?? raw.energyCostPerCast ?? DEFAULT_GLOBAL_FISHING_CONFIG.energyPerCast))
  );

  return {
    enabled: raw.enabled !== false,
    energyPerCast: resolvedEnergy,
    energyCostPerCast: resolvedEnergy,
    chestConfig,
    sunkenChest: chestConfig,
    rods,
    fishes,
    fishSpecies: fishes
  };
}

export function getFishingConfig(overrideRaw?: Partial<GlobalFishingConfig> | null): GlobalFishingConfig {
  if (overrideRaw && typeof overrideRaw === 'object') {
    return normalizeFishingConfig(overrideRaw);
  }
  if (memoryFishingConfig) return memoryFishingConfig;
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(FISHING_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        memoryFishingConfig = normalizeFishingConfig(parsed);
        return memoryFishingConfig;
      }
    } catch {
      // ignore
    }
  }
  memoryFishingConfig = normalizeFishingConfig(null);
  return memoryFishingConfig;
}

export function saveFishingConfig(nextConfig: GlobalFishingConfig): GlobalFishingConfig {
  const normalized = normalizeFishingConfig(nextConfig);
  memoryFishingConfig = normalized;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(FISHING_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent('bigwar_fishing_config_updated', { detail: normalized }));
    } catch {
      // ignore
    }
  }
  return normalized;
}

export function createDefaultPlayerFishingState(): PlayerFishingState {
  return {
    totalFishCaught: 0,
    weeklyFishCaught: 0,
    fishingWeekId: getCurrentFishingWeekId(),
    lastRewardedFishingWeekId: undefined,
    fishingMedalRank: null,
    totalEscapedFish: 0,
    totalChestsOpened: 0,
    totalNetsPulled: 0,
    ownedRodLevels: [1],
    equippedRodLevel: 1,
    rodExp: 0,
    selectedLocationId: 'loc_1',
    equippedBaitId: null,
    equippedLine: null,
    equippedHook: null,
    baitsInventory: {},
    netsInventory: {},
    linesInventory: {},
    hooksInventory: {},
    netLicenseUses: 0,
    activeNet: null,
    collection: {},
    keepnetLevel: 1,
    keepnetFish: [],
    claimedFishingAchievements: [],
    selectedDepthZoneId: 'shallow',
    trophyMuseum: {}
  };
}

export function normalizePlayerFishingState(raw?: Partial<PlayerFishingState> | null): PlayerFishingState {
  if (!raw || typeof raw !== 'object') {
    return createDefaultPlayerFishingState();
  }
  const owned = Array.isArray(raw.ownedRodLevels)
    ? Array.from(new Set([1, ...raw.ownedRodLevels.map((n) => Math.max(1, Math.min(5, Number(n) || 1)))]))
    : [1];
  const equipped = owned.includes(Number(raw.equippedRodLevel))
    ? Number(raw.equippedRodLevel)
    : Math.max(...owned);

  const validLocIds: FishingLocationId[] = ['loc_1', 'loc_2', 'loc_3', 'loc_4', 'loc_5'];
  const rawLoc = raw.selectedLocationId as FishingLocationId;
  const locObj = FISHING_LOCATIONS.find((l) => l.id === rawLoc);
  const selectedLocationId: FishingLocationId =
    locObj && equipped >= locObj.minRodLevel && validLocIds.includes(rawLoc) ? rawLoc : 'loc_1';

  const baitsInv: Record<string, number> = {};
  if (raw.baitsInventory && typeof raw.baitsInventory === 'object') {
    for (const [k, v] of Object.entries(raw.baitsInventory)) {
      const count = Math.max(0, Math.floor(Number(v) || 0));
      if (count > 0) baitsInv[k] = count;
    }
  }

  const netsInv: Record<string, number> = {};
  if (raw.netsInventory && typeof raw.netsInventory === 'object') {
    for (const [k, v] of Object.entries(raw.netsInventory)) {
      const count = Math.max(0, Math.floor(Number(v) || 0));
      if (count > 0) netsInv[k] = count;
    }
  }

  const linesInv: Record<string, number> = {};
  if (raw.linesInventory && typeof raw.linesInventory === 'object') {
    for (const [k, v] of Object.entries(raw.linesInventory)) {
      const count = Math.max(0, Math.floor(Number(v) || 0));
      if (count > 0) linesInv[k] = count;
    }
  }

  const hooksInv: Record<string, number> = {};
  if (raw.hooksInventory && typeof raw.hooksInventory === 'object') {
    for (const [k, v] of Object.entries(raw.hooksInventory)) {
      const count = Math.max(0, Math.floor(Number(v) || 0));
      if (count > 0) hooksInv[k] = count;
    }
  }

  const equippedBaitId =
    raw.equippedBaitId && (baitsInv[raw.equippedBaitId] || 0) > 0 ? String(raw.equippedBaitId) : null;

  let equippedLine: FishingLineTemplate | null = null;
  if (raw.equippedLine && typeof raw.equippedLine === 'object' && raw.equippedLine.id) {
    const tmpl = FISHING_LINES.find((l) => l.id === raw.equippedLine!.id);
    const maxDur = tmpl ? tmpl.maxDurability : Number(raw.equippedLine.maxDurability) || 30;
    const dur = Math.max(0, Math.min(maxDur, Number(raw.equippedLine.durability ?? maxDur)));
    if (dur > 0) {
      equippedLine = {
        id: String(raw.equippedLine.id),
        name: String(raw.equippedLine.name || tmpl?.name || 'Леска'),
        icon: String(raw.equippedLine.icon || tmpl?.icon || '🧵'),
        durability: dur,
        maxDurability: maxDur,
        stabilityBonusPct: Number(raw.equippedLine.stabilityBonusPct || tmpl?.stabilityBonusPct || 15),
        priceGold: Number(raw.equippedLine.priceGold || tmpl?.priceGold || 0),
        priceCrystals: Number(raw.equippedLine.priceCrystals || tmpl?.priceCrystals || 0),
        currency: raw.equippedLine.currency || tmpl?.currency || 'gold',
        description: String(raw.equippedLine.description || tmpl?.description || '')
      };
    }
  }

  let equippedHook: FishingHookTemplate | null = null;
  if (raw.equippedHook && typeof raw.equippedHook === 'object' && raw.equippedHook.id) {
    const tmpl = FISHING_HOOKS.find((h) => h.id === raw.equippedHook!.id);
    const maxDur = tmpl ? tmpl.maxDurability : Number(raw.equippedHook.maxDurability) || 30;
    const dur = Math.max(0, Math.min(maxDur, Number(raw.equippedHook.durability ?? maxDur)));
    if (dur > 0) {
      equippedHook = {
        id: String(raw.equippedHook.id),
        name: String(raw.equippedHook.name || tmpl?.name || 'Крючок'),
        icon: String(raw.equippedHook.icon || tmpl?.icon || '🪝'),
        durability: dur,
        maxDurability: maxDur,
        rareFishChanceBonusPct: Number(raw.equippedHook.rareFishChanceBonusPct || tmpl?.rareFishChanceBonusPct || 20),
        chestChanceBonusPct: Number(raw.equippedHook.chestChanceBonusPct || tmpl?.chestChanceBonusPct || 6),
        priceGold: Number(raw.equippedHook.priceGold || tmpl?.priceGold || 0),
        priceCrystals: Number(raw.equippedHook.priceCrystals || tmpl?.priceCrystals || 0),
        currency: raw.equippedHook.currency || tmpl?.currency || 'gold',
        description: String(raw.equippedHook.description || tmpl?.description || '')
      };
    }
  }

  const keepnetLevel = Math.max(1, Math.min(5, Math.floor(Number(raw.keepnetLevel) || 1)));
  const keepnetCap = getKeepnetCapacity(keepnetLevel);
  const keepnetFish: StoredKeepnetFish[] = Array.isArray(raw.keepnetFish)
    ? raw.keepnetFish
        .filter((f) => f && typeof f === 'object' && f.fishId)
        .slice(0, keepnetCap)
        .map((f, idx) => ({
          uid: String(f.uid || `kf_${Date.now()}_${idx}`),
          fishId: String(f.fishId),
          fishName: String(f.fishName || 'Рыба'),
          rarity: (f.rarity as FishRarity) || 'common',
          weightKg: Math.max(0.1, Number(f.weightKg || 0.5)),
          goldValue: Math.max(0, Math.round(Number(f.goldValue || 0))),
          crystalsValue: Math.max(0, Math.round(Number(f.crystalsValue || 0))),
          caughtAt: Number(f.caughtAt || Date.now())
        }))
    : [];

  const claimedFishingAchievements: string[] = Array.isArray(raw.claimedFishingAchievements)
    ? Array.from(new Set(raw.claimedFishingAchievements.map((id) => String(id))))
    : [];

  const normalizedCollection: Record<string, CaughtFishRecord> =
    raw.collection && typeof raw.collection === 'object' ? { ...raw.collection } : {};

  let derivedCollectionCount = 0;
  let derivedCollectionWeightKg = 0;
  let derivedMaxSingleWeightKg = 0;
  for (const rec of Object.values(normalizedCollection)) {
    if (rec && typeof rec === 'object') {
      const c = Math.max(0, Math.floor(Number(rec.count || 0)));
      const mw = Math.max(0, Number(rec.maxWeightKg || 0));
      if (c > 0) {
        derivedCollectionCount += c;
        derivedCollectionWeightKg += Number((c * mw).toFixed(2));
        if (mw > derivedMaxSingleWeightKg) derivedMaxSingleWeightKg = mw;
      }
    }
  }

  const totalFishCaught = Math.max(0, Number(raw.totalFishCaught || 0), derivedCollectionCount);
  const weeklyFishCaught =
    typeof raw.weeklyFishCaught === 'number' && raw.weeklyFishCaught > 0
      ? Math.max(0, Math.floor(raw.weeklyFishCaught))
      : totalFishCaught;
  const rawTotalWeight = Math.max(0, Number(raw.totalFishWeightKg || 0));
  const totalFishWeightKg =
    rawTotalWeight > 0 ? rawTotalWeight : Number(derivedCollectionWeightKg.toFixed(2));
  const weeklyFishWeightKg =
    typeof raw.weeklyFishWeightKg === 'number' && raw.weeklyFishWeightKg > 0
      ? Math.max(0, Number(raw.weeklyFishWeightKg))
      : totalFishWeightKg;
  const weeklyMaxFishWeightKg = Math.max(
    0,
    Number(raw.weeklyMaxFishWeightKg || 0),
    derivedMaxSingleWeightKg
  );
  const fishingWeekId = raw.fishingWeekId ? String(raw.fishingWeekId) : getCurrentFishingWeekId();
  const lastRewardedFishingWeekId = raw.lastRewardedFishingWeekId
    ? String(raw.lastRewardedFishingWeekId)
    : undefined;
  const fishingMedalRank: 1 | 2 | 3 | null =
    raw.fishingMedalRank === 1 || raw.fishingMedalRank === 2 || raw.fishingMedalRank === 3
      ? raw.fishingMedalRank
      : null;

  return {
    totalFishCaught,
    weeklyFishCaught,
    totalFishWeightKg,
    weeklyFishWeightKg,
    weeklyMaxFishWeightKg,
    fishingWeekId,
    lastRewardedFishingWeekId,
    fishingMedalRank,
    totalEscapedFish: Math.max(0, Number(raw.totalEscapedFish || 0)),
    totalChestsOpened: Math.max(0, Number(raw.totalChestsOpened || 0)),
    totalNetsPulled: Math.max(0, Number(raw.totalNetsPulled || 0)),
    ownedRodLevels: owned,
    equippedRodLevel: equipped,
    rodExp: Math.max(0, Number(raw.rodExp || 0)),
    selectedLocationId,
    equippedBaitId,
    equippedLine,
    equippedHook,
    baitsInventory: baitsInv,
    netsInventory: netsInv,
    linesInventory: linesInv,
    hooksInventory: hooksInv,
    netLicenseUses: Math.max(0, Math.floor(Number(raw.netLicenseUses || 0))),
    activeNet: raw.activeNet && typeof raw.activeNet === 'object' ? { ...raw.activeNet } : null,
    collection: normalizedCollection,
    keepnetLevel,
    keepnetFish,
    claimedFishingAchievements,
    selectedDepthZoneId:
      raw.selectedDepthZoneId === 'canyon' || raw.selectedDepthZoneId === 'sunken_barge'
        ? raw.selectedDepthZoneId
        : 'shallow',
    trophyMuseum:
      raw.trophyMuseum && typeof raw.trophyMuseum === 'object'
        ? { ...raw.trophyMuseum }
        : {},
    expBuffUntil: raw.expBuffUntil ? Number(raw.expBuffUntil) : undefined,
    expBuffPct: raw.expBuffPct ? Number(raw.expBuffPct) : undefined
  };
}

/**
 * Monotonically merges two PlayerFishingState snapshots so cumulative fishing progress,
 * caught fish records, claimed achievements, rod unlocks, and trophy museum items are never lost.
 */
export function mergeFishingStatesMonotonically(
  prevRaw?: Partial<PlayerFishingState> | null,
  nextRaw?: Partial<PlayerFishingState> | null
): PlayerFishingState {
  if (!prevRaw && !nextRaw) return normalizePlayerFishingState(null);
  if (!prevRaw) return normalizePlayerFishingState(nextRaw);
  if (!nextRaw) return normalizePlayerFishingState(prevRaw);

  const prev = normalizePlayerFishingState(prevRaw);
  const next = normalizePlayerFishingState(nextRaw);

  const mergedCollection: Record<string, CaughtFishRecord> = { ...prev.collection };
  for (const [fishId, nextRec] of Object.entries(next.collection || {})) {
    const prevRec = mergedCollection[fishId];
    if (!prevRec) {
      mergedCollection[fishId] = { ...nextRec };
    } else {
      mergedCollection[fishId] = {
        count: Math.max(Number(prevRec.count || 0), Number(nextRec.count || 0)),
        maxWeightKg: Math.max(Number(prevRec.maxWeightKg || 0), Number(nextRec.maxWeightKg || 0)),
        firstCaughtAt: Math.min(
          Number(prevRec.firstCaughtAt || Date.now()),
          Number(nextRec.firstCaughtAt || Date.now())
        )
      };
    }
  }

  const mergedTrophies: Record<string, number> = { ...(prev.trophyMuseum || {}) };
  for (const [trophyId, count] of Object.entries(next.trophyMuseum || {})) {
    mergedTrophies[trophyId] = Math.max(Number(mergedTrophies[trophyId] || 0), Number(count || 0));
  }

  const mergedOwnedRods = Array.from(
    new Set([1, ...(prev.ownedRodLevels || []), ...(next.ownedRodLevels || [])])
  ).sort((a, b) => a - b);

  const mergedClaimedAch = Array.from(
    new Set([
      ...(prev.claimedFishingAchievements || []),
      ...(next.claimedFishingAchievements || [])
    ])
  );

  const sameWeek = prev.fishingWeekId === next.fishingWeekId;

  return normalizePlayerFishingState({
    ...prev,
    ...next,
    totalFishCaught: Math.max(prev.totalFishCaught || 0, next.totalFishCaught || 0),
    totalFishWeightKg: Number(Math.max(prev.totalFishWeightKg || 0, next.totalFishWeightKg || 0).toFixed(2)),
    weeklyFishCaught: sameWeek
      ? Math.max(prev.weeklyFishCaught || 0, next.weeklyFishCaught || 0)
      : next.weeklyFishCaught,
    weeklyFishWeightKg: sameWeek
      ? Number(Math.max(prev.weeklyFishWeightKg || 0, next.weeklyFishWeightKg || 0).toFixed(2))
      : next.weeklyFishWeightKg,
    weeklyMaxFishWeightKg: sameWeek
      ? Math.max(prev.weeklyMaxFishWeightKg || 0, next.weeklyMaxFishWeightKg || 0)
      : next.weeklyMaxFishWeightKg,
    totalEscapedFish: Math.max(prev.totalEscapedFish || 0, next.totalEscapedFish || 0),
    totalChestsOpened: Math.max(prev.totalChestsOpened || 0, next.totalChestsOpened || 0),
    totalNetsPulled: Math.max(prev.totalNetsPulled || 0, next.totalNetsPulled || 0),
    rodExp: Math.max(prev.rodExp || 0, next.rodExp || 0),
    keepnetLevel: Math.max(prev.keepnetLevel || 1, next.keepnetLevel || 1),
    ownedRodLevels: mergedOwnedRods,
    claimedFishingAchievements: mergedClaimedAch,
    collection: mergedCollection,
    trophyMuseum: mergedTrophies,
    lastRewardedFishingWeekId:
      next.lastRewardedFishingWeekId || prev.lastRewardedFishingWeekId,
    fishingMedalRank:
      next.fishingMedalRank !== null && next.fishingMedalRank !== undefined
        ? next.fishingMedalRank
        : prev.fishingMedalRank
  });
}

export function getRarityMeta(rarity: FishRarity): {
  label: string;
  colorText: string;
  borderCls: string;
  bgCls: string;
  badgeCls: string;
  qualityKey: ItemQualityKey;
} {
  switch (rarity) {
    case 'uncommon':
      return {
        label: 'Необычная',
        colorText: 'text-emerald-300',
        borderCls: 'border-emerald-500/50',
        bgCls: 'from-emerald-950/70 via-slate-900 to-slate-950',
        badgeCls: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50',
        qualityKey: 'common'
      };
    case 'rare':
      return {
        label: 'Редкая',
        colorText: 'text-sky-300',
        borderCls: 'border-sky-500/60',
        bgCls: 'from-sky-950/75 via-slate-900 to-slate-950',
        badgeCls: 'bg-sky-950/90 text-sky-300 border-sky-400/60',
        qualityKey: 'rare'
      };
    case 'epic':
      return {
        label: 'Эпическая',
        colorText: 'text-purple-300',
        borderCls: 'border-purple-500/70',
        bgCls: 'from-purple-950/80 via-slate-900 to-slate-950',
        badgeCls: 'bg-purple-950/90 text-purple-200 border-purple-400/70',
        qualityKey: 'epic'
      };
    case 'legendary':
      return {
        label: 'Легендарная',
        colorText: 'text-amber-300',
        borderCls: 'border-amber-400/80',
        bgCls: 'from-amber-950/80 via-slate-900 to-slate-950',
        badgeCls: 'bg-amber-950/90 text-amber-200 border-amber-400/80',
        qualityKey: 'legendary'
      };
    case 'mythic':
      return {
        label: 'Мифическая',
        colorText: 'text-rose-300',
        borderCls: 'border-rose-400/90',
        bgCls: 'from-rose-950/85 via-amber-950/50 to-slate-950',
        badgeCls: 'bg-rose-950/90 text-rose-200 border-rose-400/80',
        qualityKey: 'custom'
      };
    default:
      return {
        label: 'Обычная',
        colorText: 'text-slate-200',
        borderCls: 'border-slate-700',
        bgCls: 'from-slate-900 via-slate-950 to-slate-950',
        badgeCls: 'bg-slate-800 text-slate-300 border-slate-600',
        qualityKey: 'common'
      };
  }
}

export const FISH_RARITY_META: Record<
  FishRarity,
  { label: string; color: string; border: string; bg: string }
> = {
  common: {
    label: 'Обычная',
    color: 'text-slate-200',
    border: 'border-slate-700',
    bg: 'bg-slate-900'
  },
  uncommon: {
    label: 'Необычная',
    color: 'text-emerald-300',
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-950/50'
  },
  rare: {
    label: 'Редкая',
    color: 'text-sky-300',
    border: 'border-sky-500/60',
    bg: 'bg-sky-950/50'
  },
  epic: {
    label: 'Эпическая',
    color: 'text-purple-300',
    border: 'border-purple-500/70',
    bg: 'bg-purple-950/50'
  },
  legendary: {
    label: 'Легендарная',
    color: 'text-amber-300',
    border: 'border-amber-400/80',
    bg: 'bg-amber-950/50'
  },
  mythic: {
    label: 'Мифическая',
    color: 'text-rose-300',
    border: 'border-rose-400/90',
    bg: 'bg-rose-950/50'
  }
};

export type FishingRollOutcome =
  | {
      type: 'fish';
      fish: FishSpecies;
      weightKg: number;
      goldEarned: number;
      crystalsEarned: number;
      expEarned: number;
      isNewDiscovery: boolean;
      isRecordWeight: boolean;
      baitUsedName?: string;
      trophyAwarded?: TrophyMuseumItem;
      depthZoneUsed?: FishingDepthZone;
      isColdCurrentBoosted?: boolean;
    }
  | {
      type: 'chest';
      prizeType: 'relic' | 'exp_buff' | 'energy';
      relicItem?: GameItem;
      expBuffPct?: number;
      expBuffMinutes?: number;
      energyRestored?: number;
      expEarned: number;
      trophyAwarded?: TrophyMuseumItem;
      depthZoneUsed?: FishingDepthZone;
      isColdCurrentBoosted?: boolean;
    };

/**
 * Rolls either a Sunken Chest or a Fish from the active Fishing Location, applying Rod, Bait, Depth Zone & Weather bonuses.
 */
export function rollFishingCatch(
  config: GlobalFishingConfig,
  fishingState: PlayerFishingState,
  createRelicFn: () => GameItem,
  overrideLocationId?: FishingLocationId,
  overrideBait?: FishingBaitTemplate | null,
  overrideDepthZoneId?: FishingDepthZoneId
): FishingRollOutcome {
  const rod =
    config.rods.find((r) => r.level === fishingState.equippedRodLevel) ||
    config.rods[0] ||
    DEFAULT_FISHING_RODS[0];

  const locId: FishingLocationId = overrideLocationId || fishingState.selectedLocationId || 'loc_1';
  const locObj = FISHING_LOCATIONS.find((l) => l.id === locId) || FISHING_LOCATIONS[0];
  const { weather } = getActiveLocationWeather(locId);

  const depthZoneId: FishingDepthZoneId =
    overrideDepthZoneId || fishingState.selectedDepthZoneId || 'shallow';
  const depthZoneObj =
    FISHING_DEPTH_ZONES.find((z) => z.id === depthZoneId) || FISHING_DEPTH_ZONES[0];
  const coldCurrent = getActiveColdCurrentZone();
  const isColdCurrentActive = coldCurrent.zoneId === depthZoneId;

  const activeBait =
    overrideBait !== undefined
      ? overrideBait
      : fishingState.equippedBaitId
      ? FISHING_BAITS.find((b) => b.id === fishingState.equippedBaitId) || null
      : null;

  const hookChestBonus = fishingState.equippedHook ? (fishingState.equippedHook.chestChanceBonusPct || 0) : 0;
  const zoneChestBonus = depthZoneObj.chestBonusPct || 0;
  const totalChestChance = Math.min(
    75,
    Math.max(
      0,
      config.chestConfig.dropChancePct +
        (rod.chestChanceBonusPct || 0) +
        (activeBait?.chestBonusPct || 0) +
        (weather.chestBonusPct || 0) +
        hookChestBonus +
        zoneChestBonus
    )
  );

  // Check if player hooked a Sunken Chest
  if (Math.random() * 100 < totalChestChance) {
    const {
      relicWeightPct,
      expBuffWeightPct,
      energyWeightPct,
      expBuffBonusPct,
      expBuffDurationMinutes,
      energyRewardMin,
      energyRewardMax
    } = config.chestConfig;
    const totalWeight = Math.max(1, relicWeightPct + expBuffWeightPct + energyWeightPct);
    const roll = Math.random() * totalWeight;

    // Check for Nile Trophy discovery inside chest
    let chestTrophy: TrophyMuseumItem | undefined = undefined;
    const uncollectedTrophies = NILE_TROPHIES.filter(
      (t) => !(fishingState.trophyMuseum && (fishingState.trophyMuseum[t.id] || 0) > 0)
    );
    if (uncollectedTrophies.length > 0) {
      const trophyChance = depthZoneId === 'sunken_barge' ? 25 : 14;
      if (Math.random() * 100 < trophyChance) {
        chestTrophy = uncollectedTrophies[Math.floor(Math.random() * uncollectedTrophies.length)];
      }
    }

    if (roll < relicWeightPct) {
      return {
        type: 'chest',
        prizeType: 'relic',
        relicItem: createRelicFn(),
        expEarned: 35,
        trophyAwarded: chestTrophy,
        depthZoneUsed: depthZoneObj,
        isColdCurrentBoosted: isColdCurrentActive
      };
    } else if (roll < relicWeightPct + expBuffWeightPct) {
      return {
        type: 'chest',
        prizeType: 'exp_buff',
        expBuffPct: expBuffBonusPct,
        expBuffMinutes: expBuffDurationMinutes,
        expEarned: 30,
        trophyAwarded: chestTrophy,
        depthZoneUsed: depthZoneObj,
        isColdCurrentBoosted: isColdCurrentActive
      };
    } else {
      const minE = Math.min(energyRewardMin, energyRewardMax);
      const maxE = Math.max(energyRewardMin, energyRewardMax);
      const energyRestored = Math.floor(minE + Math.random() * (maxE - minE + 1));
      return {
        type: 'chest',
        prizeType: 'energy',
        energyRestored,
        expEarned: 25,
        trophyAwarded: chestTrophy,
        depthZoneUsed: depthZoneObj,
        isColdCurrentBoosted: isColdCurrentActive
      };
    }
  }

  // Filter fish belonging to this location (fallback to rod level if needed)
  let locationCandidates = config.fishes.filter(
    (f) => f.enabled && f.locationId === locId && f.minRodLevel <= Math.max(rod.level, locObj.minRodLevel)
  );
  if (locationCandidates.length === 0) {
    locationCandidates = config.fishes.filter((f) => f.enabled && f.minRodLevel <= rod.level);
  }
  if (locationCandidates.length === 0) {
    locationCandidates = DEFAULT_FISH_SPECIES.filter((f) => f.locationId === locId);
  }

  // Apply bait minimum rarity filter if active (e.g. shrimp / scarab / solar larva)
  if (activeBait?.minRarityFilter === 'rare') {
    const rareOnly = locationCandidates.filter(
      (f) => f.rarity === 'rare' || f.rarity === 'epic' || f.rarity === 'legendary' || f.rarity === 'mythic'
    );
    if (rareOnly.length > 0) locationCandidates = rareOnly;
  } else if (activeBait?.minRarityFilter === 'uncommon') {
    const uncommonPlus = locationCandidates.filter((f) => f.rarity !== 'common');
    if (uncommonPlus.length > 0) locationCandidates = uncommonPlus;
  }

  const hookRareBonus = fishingState.equippedHook ? (fishingState.equippedHook.rareFishChanceBonusPct || 0) : 0;
  const coldCurrentRareBonus = isColdCurrentActive ? 25 : 0;
  const zoneRareBonus = depthZoneObj.rareBonusPct || 0;
  let morningRareBonusPct = 0;
  try {
    const forced = localStorage.getItem('bigwar_force_time_of_day');
    const hr = new Date().getHours();
    const isMorning = forced ? forced === 'morning' : hr >= 5 && hr < 8;
    if (isMorning) morningRareBonusPct = 25;
  } catch {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 8) morningRareBonusPct = 25;
  }
  const totalRareBonusPct =
    (rod.rareFishChanceBonusPct || 0) +
    (locObj.rareBonusPct || 0) +
    (activeBait?.rareChanceBonusPct || 0) +
    (weather.rareBonusPct || 0) +
    hookRareBonus +
    morningRareBonusPct +
    zoneRareBonus +
    coldCurrentRareBonus;
  const rareBoostMult = 1 + totalRareBonusPct / 100;

  const weightedPool = locationCandidates.map((fish) => {
    let w = Math.max(0.05, Number(fish.catchWeight || 1));
    if (fish.rarity === 'rare' || fish.rarity === 'epic' || fish.rarity === 'legendary' || fish.rarity === 'mythic') {
      w *= rareBoostMult;
    }
    if (fish.rarity === 'legendary' || fish.rarity === 'mythic') {
      w *= 1 + (rod.level - 1) * 0.3 + (activeBait ? activeBait.rareChanceBonusPct / 120 : 0);
    }
    return { fish, weight: w };
  });

  const sumWeights = weightedPool.reduce((acc, item) => acc + item.weight, 0);
  let r = Math.random() * sumWeights;
  let chosenFish = weightedPool[0].fish;
  for (const entry of weightedPool) {
    r -= entry.weight;
    if (r <= 0) {
      chosenFish = entry.fish;
      break;
    }
  }

  const rawWeight =
    chosenFish.minWeightKg +
    Math.random() * Math.max(0.1, chosenFish.maxWeightKg - chosenFish.minWeightKg);
  const baitAndWeatherWeightMult =
    1 + ((activeBait?.weightBonusPct || 0) + (weather.weightBonusPct || 0) + (depthZoneObj.weightBonusPct || 0)) / 100;
  const scaledWeight = Number((rawWeight * (rod.weightMultiplier || 1) * baitAndWeatherWeightMult).toFixed(2));
  const weightRatio =
    scaledWeight / Math.max(0.2, (chosenFish.minWeightKg + chosenFish.maxWeightKg) * 0.5);

  const goldEarned = Math.max(
    1,
    Math.round(chosenFish.baseGold * Math.max(0.65, Math.min(2.4, weightRatio)))
  );
  const crystalsEarned =
    chosenFish.rewardType === 'crystals' || chosenFish.rewardType === 'both' || chosenFish.baseCrystals > 0
      ? Math.max(1, Math.round(chosenFish.baseCrystals * (weightRatio >= 1.35 ? 1.25 : 1)))
      : 0;
  const expEarned = Math.max(1, Math.round(chosenFish.baseExp * Math.max(0.8, Math.min(1.75, weightRatio))));

  const prevRecord = fishingState.collection[chosenFish.id];
  const isNewDiscovery = !prevRecord || prevRecord.count <= 0;
  const isRecordWeight = !prevRecord || scaledWeight > (prevRecord.maxWeightKg || 0);

  // Check for Nile Trophy discovery on fish catch
  let fishTrophy: TrophyMuseumItem | undefined = undefined;
  const uncollectedTrophies = NILE_TROPHIES.filter(
    (t) => !(fishingState.trophyMuseum && (fishingState.trophyMuseum[t.id] || 0) > 0)
  );
  if (uncollectedTrophies.length > 0) {
    const isRarePlus = chosenFish.rarity !== 'common';
    let trophyChance = isRarePlus
      ? chosenFish.rarity === 'mythic'
        ? 20
        : chosenFish.rarity === 'legendary'
        ? 12
        : chosenFish.rarity === 'epic'
        ? 8
        : 4
      : 1;
    if (depthZoneId === 'sunken_barge') trophyChance += 5;
    if (isColdCurrentActive) trophyChance += 3;
    if (Math.random() * 100 < trophyChance) {
      fishTrophy = uncollectedTrophies[Math.floor(Math.random() * uncollectedTrophies.length)];
    }
  }

  return {
    type: 'fish',
    fish: chosenFish,
    weightKg: scaledWeight,
    goldEarned,
    crystalsEarned,
    expEarned,
    isNewDiscovery,
    isRecordWeight,
    baitUsedName: activeBait?.name,
    trophyAwarded: fishTrophy,
    depthZoneUsed: depthZoneObj,
    isColdCurrentBoosted: isColdCurrentActive
  };
}

/**
 * Rolls multiple fish for a successfully pulled Fishing Net in its location.
 */
export function rollFishingNetHaul(
  config: GlobalFishingConfig,
  fishingState: PlayerFishingState,
  activeNet: ActiveFishingNetState
): Array<{
  fish: FishSpecies;
  weightKg: number;
  goldEarned: number;
  crystalsEarned: number;
  expEarned: number;
  isNewDiscovery: boolean;
}> {
  const count =
    activeNet.minFishCount +
    Math.floor(Math.random() * Math.max(1, activeNet.maxFishCount - activeNet.minFishCount + 1));

  const virtualBait: FishingBaitTemplate = {
    id: 'net_bonus',
    name: activeNet.netName,
    icon: activeNet.netIcon,
    packSize: 1,
    priceGold: 0,
    priceCrystals: 0,
    currency: 'gold',
    rareChanceBonusPct: activeNet.rareBonusPct || 25,
    weightBonusPct: 10,
    tensionControlBonusPct: 0,
    description: ''
  };

  const results: Array<{
    fish: FishSpecies;
    weightKg: number;
    goldEarned: number;
    crystalsEarned: number;
    expEarned: number;
    isNewDiscovery: boolean;
  }> = [];

  const simulatedCollection = { ...fishingState.collection };

  for (let i = 0; i < count; i++) {
    // Force a fish roll (no chest roll inside net loop)
    const tempConfig: GlobalFishingConfig = {
      ...config,
      chestConfig: { ...config.chestConfig, dropChancePct: 0 }
    };
    const outcome = rollFishingCatch(
      tempConfig,
      { ...fishingState, collection: simulatedCollection },
      () => ({} as GameItem),
      activeNet.locationId,
      virtualBait
    );
    if (outcome.type === 'fish') {
      results.push({
        fish: outcome.fish,
        weightKg: outcome.weightKg,
        goldEarned: outcome.goldEarned,
        crystalsEarned: outcome.crystalsEarned,
        expEarned: outcome.expEarned,
        isNewDiscovery: outcome.isNewDiscovery
      });
      const prev = simulatedCollection[outcome.fish.id];
      simulatedCollection[outcome.fish.id] = {
        count: (prev?.count || 0) + 1,
        maxWeightKg: Math.max(prev?.maxWeightKg || 0, outcome.weightKg),
        firstCaughtAt: prev?.firstCaughtAt || Date.now()
      };
    }
  }

  return results;
}
